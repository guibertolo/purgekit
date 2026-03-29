//! System resource monitor — CPU, RAM, disk, GPU temperatures.
//!
//! Runs a background loop that emits `"system-metrics"` events every 2 seconds.
//! Uses `sysinfo` for CPU/RAM/disk data and NVML for NVIDIA GPU metrics.
//!
//! IMPORTANT: `sysinfo::System` is NOT Send. It must live inside a single
//! `tokio::task::spawn_blocking` scope or a dedicated thread. We use
//! `std::thread::spawn` to own the System instance and a `tokio::sync::mpsc`
//! channel to communicate with the async world.

use std::sync::Arc;
use std::time::{Duration, Instant};

use serde::Serialize;
use sysinfo::{Components, Disks, System};
use tauri::{AppHandle, Emitter};

use crate::config::AppConfig;
use crate::platform::nvml::NvmlHandle;

// ---------------------------------------------------------------------------
// Metric structs (emitted as JSON via Tauri events)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct SystemMetrics {
    pub timestamp: i64,
    pub cpu: CpuMetrics,
    pub ram: RamMetrics,
    pub gpu: Option<GpuMetrics>,
    pub temperatures: ThermalMetrics,
    pub disks: Vec<DiskInfo>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CpuMetrics {
    pub total_usage_percent: f32,
    pub frequency_mhz: u64,
    pub per_core_usage: Vec<f32>,
    pub core_count: u32,
    pub thread_count: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct RamMetrics {
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub available_bytes: u64,
    pub usage_percent: f32,
    pub swap_total_bytes: u64,
    pub swap_used_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct GpuMetrics {
    pub name: String,
    pub temperature_c: Option<f32>,
    pub utilization_percent: f32,
    pub vram_total_bytes: u64,
    pub vram_used_bytes: u64,
    pub clock_mhz: u32,
    pub power_watts: Option<f32>,
    pub fan_speed_percent: Option<f32>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ThermalMetrics {
    pub cpu_temp_c: Option<f32>,
    pub gpu_temp_c: Option<f32>,
    pub disk_temps_c: Vec<(String, f32)>,
    pub motherboard_temp_c: Option<f32>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DiskInfo {
    pub name: String,
    pub mount_point: String,
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub available_bytes: u64,
    pub usage_percent: f32,
    pub disk_type: String,
    pub is_removable: bool,
}

// ---------------------------------------------------------------------------
// Temperature alert payload
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct TemperatureAlert {
    pub sensor: String,
    pub temp: f32,
    pub threshold: f32,
}

// ---------------------------------------------------------------------------
// Builder functions
// ---------------------------------------------------------------------------

fn build_cpu_metrics(sys: &System) -> CpuMetrics {
    let cpus = sys.cpus();
    let total_usage = sys.global_cpu_usage();
    let frequency_mhz = cpus.first().map(|c| c.frequency()).unwrap_or(0);
    let per_core_usage: Vec<f32> = cpus.iter().map(|c| c.cpu_usage()).collect();

    CpuMetrics {
        total_usage_percent: total_usage,
        frequency_mhz,
        per_core_usage,
        core_count: sys.physical_core_count().unwrap_or(0) as u32,
        thread_count: cpus.len() as u32,
    }
}

fn build_ram_metrics(sys: &System) -> RamMetrics {
    let total = sys.total_memory();
    let used = sys.used_memory();
    let available = sys.available_memory();
    let usage_percent = if total > 0 {
        (used as f64 / total as f64 * 100.0) as f32
    } else {
        0.0
    };

    RamMetrics {
        total_bytes: total,
        used_bytes: used,
        available_bytes: available,
        usage_percent,
        swap_total_bytes: sys.total_swap(),
        swap_used_bytes: sys.used_swap(),
    }
}

fn build_gpu_metrics(nvml: &NvmlHandle) -> Option<GpuMetrics> {
    if !nvml.is_available() {
        return None;
    }

    // Use helper methods on NvmlHandle. If any fail, return None gracefully.
    #[cfg(feature = "nvidia")]
    {
        let infos = nvml.get_gpu_info();
        let info = infos.first()?;

        let temperature = nvml.gpu_temperature(0).ok().map(|t| t as f32);
        let utilization = nvml.gpu_utilization(0).ok().unwrap_or(0.0);

        // Get memory info and clocks via NVML directly
        let (vram_used, vram_total, clock, power, fan) = nvml.get_gpu_details(0);

        Some(GpuMetrics {
            name: info.name.clone(),
            temperature_c: temperature,
            utilization_percent: utilization,
            vram_total_bytes: vram_total,
            vram_used_bytes: vram_used,
            clock_mhz: clock,
            power_watts: power,
            fan_speed_percent: fan,
        })
    }
    #[cfg(not(feature = "nvidia"))]
    {
        None
    }
}

fn build_thermal_metrics(components: &Components, gpu_temp: Option<f32>) -> ThermalMetrics {
    let mut cpu_temp: Option<f32> = None;
    let mut motherboard_temp: Option<f32> = None;
    let mut disk_temps: Vec<(String, f32)> = Vec::new();

    for component in components.iter() {
        let label = component.label().to_lowercase();
        let temp = component.temperature();

        // Sanity check — ignore clearly invalid readings
        if temp <= 0.0 || temp > 150.0 {
            continue;
        }

        if label.contains("cpu") || label.contains("core") || label.contains("package") {
            // Take the highest CPU temp
            if cpu_temp.is_none() || temp > cpu_temp.unwrap_or(0.0) {
                cpu_temp = Some(temp);
            }
        } else if label.contains("motherboard") || label.contains("mainboard") || label.contains("system") {
            motherboard_temp = Some(temp);
        } else if label.contains("disk") || label.contains("nvme") || label.contains("ssd") || label.contains("hdd") {
            disk_temps.push((component.label().to_string(), temp));
        }
    }

    ThermalMetrics {
        cpu_temp_c: cpu_temp,
        gpu_temp_c: gpu_temp,
        disk_temps_c: disk_temps,
        motherboard_temp_c: motherboard_temp,
    }
}

fn build_disk_info(disks: &Disks) -> Vec<DiskInfo> {
    disks
        .iter()
        .map(|d| {
            let total = d.total_space();
            let available = d.available_space();
            let used = total.saturating_sub(available);
            let usage_percent = if total > 0 {
                (used as f64 / total as f64 * 100.0) as f32
            } else {
                0.0
            };

            let disk_type = match d.kind() {
                sysinfo::DiskKind::SSD => "SSD",
                sysinfo::DiskKind::HDD => "HDD",
                _ => "Unknown",
            };

            DiskInfo {
                name: d.name().to_string_lossy().into_owned(),
                mount_point: d.mount_point().to_string_lossy().into_owned(),
                total_bytes: total,
                used_bytes: used,
                available_bytes: available,
                usage_percent,
                disk_type: disk_type.to_string(),
                is_removable: d.is_removable(),
            }
        })
        .collect()
}

// ---------------------------------------------------------------------------
// Monitor loop — runs in a dedicated OS thread
// ---------------------------------------------------------------------------

/// Start the background monitoring loop. Call once at app startup.
///
/// The loop runs on a dedicated OS thread because `sysinfo::System` is not Send.
/// It emits `"system-metrics"` events every `interval_ms` milliseconds.
/// Disk metrics refresh every 5 ticks (~10 seconds) to avoid unnecessary I/O.
pub fn start_monitor_loop(
    app: AppHandle,
    nvml: Arc<NvmlHandle>,
    config: AppConfig,
) {
    let interval_ms = config.monitor_interval_ms;
    let cpu_threshold = config.thresholds.cpu_celsius as f32;
    let gpu_threshold = config.thresholds.gpu_celsius as f32;

    std::thread::spawn(move || {
        let mut sys = System::new();
        let mut components = Components::new_with_refreshed_list();
        let mut disks = Disks::new_with_refreshed_list();

        // Initial refresh to get baseline CPU usage (first reading is always 0)
        sys.refresh_cpu_all();
        std::thread::sleep(Duration::from_millis(500));

        let mut tick: u64 = 0;
        let mut cached_disks: Vec<DiskInfo> = Vec::new();

        loop {
            let start = Instant::now();

            // Refresh only what we need — NOT System::refresh_all()
            sys.refresh_cpu_all();
            sys.refresh_memory();
            components.refresh();

            // Refresh disks every 5 ticks (~10 seconds)
            if tick % 5 == 0 {
                disks.refresh();
                cached_disks = build_disk_info(&disks);
            }

            let cpu = build_cpu_metrics(&sys);
            let ram = build_ram_metrics(&sys);
            let gpu = build_gpu_metrics(&nvml);
            let gpu_temp = gpu.as_ref().and_then(|g| g.temperature_c);
            let temperatures = build_thermal_metrics(&components, gpu_temp);

            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as i64;

            let metrics = SystemMetrics {
                timestamp: now,
                cpu,
                ram,
                gpu,
                temperatures: temperatures.clone(),
                disks: cached_disks.clone(),
            };

            // Emit main metrics event
            if let Err(e) = app.emit("system-metrics", &metrics) {
                tracing::warn!("Failed to emit system-metrics: {}", e);
            }

            // Check temperature thresholds and emit alerts
            if let Some(cpu_temp) = temperatures.cpu_temp_c {
                if cpu_temp > cpu_threshold {
                    let alert = TemperatureAlert {
                        sensor: "CPU".to_string(),
                        temp: cpu_temp,
                        threshold: cpu_threshold,
                    };
                    app.emit("temperature-alert", &alert).ok();
                }
            }

            if let Some(gpu_temp_val) = temperatures.gpu_temp_c {
                if gpu_temp_val > gpu_threshold {
                    let alert = TemperatureAlert {
                        sensor: "GPU".to_string(),
                        temp: gpu_temp_val,
                        threshold: gpu_threshold,
                    };
                    app.emit("temperature-alert", &alert).ok();
                }
            }

            tick += 1;

            // Sleep for the remainder of the interval
            let elapsed = start.elapsed();
            let target = Duration::from_millis(interval_ms);
            if elapsed < target {
                std::thread::sleep(target - elapsed);
            }
        }
    });

    tracing::info!(
        "Monitor loop started — interval: {}ms",
        interval_ms
    );
}
