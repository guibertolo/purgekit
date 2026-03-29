//! NVIDIA Management Library (NVML) wrapper with graceful degradation.
//!
//! If the `nvidia` feature is disabled or NVML fails to initialize (e.g.,
//! no NVIDIA GPU or missing driver), all methods return safe defaults instead
//! of crashing.

#[cfg(feature = "nvidia")]
use nvml_wrapper::Nvml;

/// Handle wrapping an optional NVML instance.
/// Initialized once at app startup and shared via `AppState`.
pub struct NvmlHandle {
    #[cfg(feature = "nvidia")]
    inner: Option<Nvml>,
    #[cfg(not(feature = "nvidia"))]
    _phantom: (),
}

/// Information about a single NVIDIA GPU retrieved via NVML.
#[derive(Debug, Clone)]
pub struct NvmlGpuInfo {
    pub index: u32,
    pub name: String,
    pub driver_version: String,
    pub vram_bytes: u64,
}

impl NvmlHandle {
    /// Try to initialize NVML. Never panics — returns a handle with
    /// `is_available() == false` if NVML cannot be loaded.
    pub fn init() -> Self {
        #[cfg(feature = "nvidia")]
        {
            match Nvml::init() {
                Ok(nvml) => {
                    tracing::info!("NVML initialized successfully");
                    NvmlHandle {
                        inner: Some(nvml),
                    }
                }
                Err(e) => {
                    tracing::warn!("NVML not available: {}. NVIDIA features disabled.", e);
                    NvmlHandle { inner: None }
                }
            }
        }
        #[cfg(not(feature = "nvidia"))]
        {
            tracing::info!("NVML feature not compiled — NVIDIA GPU detection via NVML disabled");
            NvmlHandle { _phantom: () }
        }
    }

    /// Whether NVML is available and initialized.
    pub fn is_available(&self) -> bool {
        #[cfg(feature = "nvidia")]
        {
            self.inner.is_some()
        }
        #[cfg(not(feature = "nvidia"))]
        {
            false
        }
    }

    /// Number of NVIDIA devices detected.
    pub fn device_count(&self) -> u32 {
        #[cfg(feature = "nvidia")]
        {
            self.inner
                .as_ref()
                .and_then(|n| n.device_count().ok())
                .unwrap_or(0)
        }
        #[cfg(not(feature = "nvidia"))]
        {
            0
        }
    }

    /// Retrieve info for all NVIDIA GPUs via NVML.
    pub fn get_gpu_info(&self) -> Vec<NvmlGpuInfo> {
        #[cfg(feature = "nvidia")]
        {
            let nvml = match &self.inner {
                Some(n) => n,
                None => return vec![],
            };

            let count = match nvml.device_count() {
                Ok(c) => c,
                Err(e) => {
                    tracing::warn!("NVML device_count failed: {}", e);
                    return vec![];
                }
            };

            let driver_version = nvml
                .sys_driver_version()
                .unwrap_or_else(|_| "Unknown".to_string());

            let mut gpus = Vec::with_capacity(count as usize);
            for i in 0..count {
                match nvml.device_by_index(i) {
                    Ok(device) => {
                        let name = device.name().unwrap_or_else(|_| "Unknown NVIDIA GPU".to_string());
                        let vram = device
                            .memory_info()
                            .map(|m| m.total)
                            .unwrap_or(0);
                        gpus.push(NvmlGpuInfo {
                            index: i,
                            name,
                            driver_version: driver_version.clone(),
                            vram_bytes: vram,
                        });
                    }
                    Err(e) => {
                        tracing::warn!("NVML: failed to query device {}: {}", i, e);
                    }
                }
            }
            gpus
        }
        #[cfg(not(feature = "nvidia"))]
        {
            vec![]
        }
    }

    /// GPU temperature in Celsius (for future Epic 4 use).
    pub fn gpu_temperature(&self, _index: u32) -> Result<f64, crate::error::AppError> {
        #[cfg(feature = "nvidia")]
        {
            let nvml = self
                .inner
                .as_ref()
                .ok_or_else(|| crate::error::AppError::Platform("NVML not available".to_string()))?;
            let device = nvml
                .device_by_index(_index)
                .map_err(|e| crate::error::AppError::Platform(format!("NVML device error: {}", e)))?;
            let temp = device
                .temperature(nvml_wrapper::enum_wrappers::device::TemperatureSensor::Gpu)
                .map_err(|e| crate::error::AppError::Platform(format!("NVML temperature error: {}", e)))?;
            Ok(temp as f64)
        }
        #[cfg(not(feature = "nvidia"))]
        {
            Err(crate::error::AppError::Platform(
                "NVML not available (feature disabled)".to_string(),
            ))
        }
    }

    /// Get detailed GPU metrics: (vram_used, vram_total, clock_mhz, power_watts, fan_speed_percent).
    /// Returns safe defaults on failure.
    pub fn get_gpu_details(&self, _index: u32) -> (u64, u64, u32, Option<f32>, Option<f32>) {
        #[cfg(feature = "nvidia")]
        {
            let nvml = match &self.inner {
                Some(n) => n,
                None => return (0, 0, 0, None, None),
            };
            let device = match nvml.device_by_index(_index) {
                Ok(d) => d,
                Err(_) => return (0, 0, 0, None, None),
            };

            let (vram_used, vram_total) = device
                .memory_info()
                .map(|m| (m.used, m.total))
                .unwrap_or((0, 0));

            let clock = device
                .clock_info(nvml_wrapper::enum_wrappers::device::Clock::Graphics)
                .unwrap_or(0);

            let power = device
                .power_usage()
                .ok()
                .map(|mw| mw as f32 / 1000.0); // milliwatts to watts

            let fan = device
                .fan_speed(0)
                .ok()
                .map(|f| f as f32);

            (vram_used, vram_total, clock, power, fan)
        }
        #[cfg(not(feature = "nvidia"))]
        {
            (0, 0, 0, None, None)
        }
    }

    /// GPU utilization percentage.
    pub fn gpu_utilization(&self, _index: u32) -> Result<f32, crate::error::AppError> {
        #[cfg(feature = "nvidia")]
        {
            let nvml = self
                .inner
                .as_ref()
                .ok_or_else(|| crate::error::AppError::Platform("NVML not available".to_string()))?;
            let device = nvml
                .device_by_index(_index)
                .map_err(|e| crate::error::AppError::Platform(format!("NVML device error: {}", e)))?;
            let util = device
                .utilization_rates()
                .map_err(|e| crate::error::AppError::Platform(format!("NVML utilization error: {}", e)))?;
            Ok(util.gpu as f32)
        }
        #[cfg(not(feature = "nvidia"))]
        {
            Err(crate::error::AppError::Platform(
                "NVML not available (feature disabled)".to_string(),
            ))
        }
    }
}

// NvmlHandle is Send+Sync safe because Nvml itself is Send+Sync
unsafe impl Send for NvmlHandle {}
unsafe impl Sync for NvmlHandle {}
