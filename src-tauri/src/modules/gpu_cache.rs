//! GPU shader cache management module.
//!
//! Provides GPU detection (NVML + WMI), shader cache scanning per vendor,
//! and safe cache cleaning. This is PurgeKit's differentiating feature —
//! no competitor offers integrated GPU shader cache cleaning.

use std::path::Path;
use std::time::Instant;

use serde::Serialize;

use crate::error::AppError;
use crate::platform::filesystem::{calc_dir_size, expand_env_path, safe_delete_dir_contents};
use crate::platform::nvml::NvmlHandle;
use crate::platform::wmi_client::WmiClient;

// ---------------------------------------------------------------------------
// GPU Detection (Story 3.1)
// ---------------------------------------------------------------------------

/// Information about a single GPU.
#[derive(Debug, Clone, Serialize)]
pub struct GpuInfo {
    pub index: u32,
    pub name: String,
    /// "NVIDIA", "AMD", "Intel", or "Unknown"
    pub vendor: String,
    pub driver_version: String,
    pub vram_bytes: u64,
    /// Whether NVML is available for this GPU (only true for NVIDIA w/ driver)
    pub nvml_available: bool,
}

/// Detect GPU vendor from its name string.
pub fn detect_vendor(name: &str) -> &'static str {
    let name_lower = name.to_lowercase();
    if name_lower.contains("nvidia")
        || name_lower.contains("geforce")
        || name_lower.contains("quadro")
        || name_lower.contains("rtx")
        || name_lower.contains("gtx")
    {
        "NVIDIA"
    } else if name_lower.contains("amd") || name_lower.contains("radeon") || name_lower.contains("rx ") {
        "AMD"
    } else if name_lower.contains("intel")
        || name_lower.contains("uhd")
        || name_lower.contains("iris")
        || name_lower.contains("hd graphics")
    {
        "Intel"
    } else {
        "Unknown"
    }
}

/// Detect all GPUs by combining NVML (for NVIDIA) and WMI (for all vendors).
/// NVML provides more accurate data for NVIDIA GPUs; WMI is the fallback.
pub fn detect_gpus(nvml: &NvmlHandle, wmi: &WmiClient) -> Vec<GpuInfo> {
    let mut gpus = Vec::new();

    // 1. Try NVML first for NVIDIA GPUs (more accurate VRAM, etc.)
    let nvml_gpus = nvml.get_gpu_info();
    let nvml_available = !nvml_gpus.is_empty();

    for ng in &nvml_gpus {
        gpus.push(GpuInfo {
            index: ng.index,
            name: ng.name.clone(),
            vendor: "NVIDIA".to_string(),
            driver_version: ng.driver_version.clone(),
            vram_bytes: ng.vram_bytes,
            nvml_available: true,
        });
    }

    // 2. Query WMI for ALL GPUs (includes AMD, Intel, and NVIDIA as fallback)
    match wmi.query_gpu_info() {
        Ok(wmi_gpus) => {
            for (i, wg) in wmi_gpus.iter().enumerate() {
                let vendor = detect_vendor(&wg.name);

                // Skip NVIDIA GPUs already found via NVML (avoid duplicates)
                if vendor == "NVIDIA" && nvml_available {
                    continue;
                }

                // WMI AdapterRAM is u32 (max ~4GB). For GPUs with more VRAM,
                // the value wraps or is reported as 0. Best effort.
                let vram = wg.adapter_ram.unwrap_or(0) as u64;

                gpus.push(GpuInfo {
                    index: (nvml_gpus.len() + i) as u32,
                    name: wg.name.clone(),
                    vendor: vendor.to_string(),
                    driver_version: wg.driver_version.clone().unwrap_or_else(|| "Unknown".to_string()),
                    vram_bytes: vram,
                    nvml_available: false,
                });
            }
        }
        Err(e) => {
            tracing::warn!("WMI GPU query failed: {}. Only NVML results available.", e);
        }
    }

    if gpus.is_empty() {
        tracing::warn!("No GPUs detected via NVML or WMI");
    } else {
        tracing::info!("Detected {} GPU(s)", gpus.len());
        for g in &gpus {
            tracing::info!(
                "  GPU {}: {} ({}) | VRAM: {} MB | NVML: {}",
                g.index,
                g.name,
                g.vendor,
                g.vram_bytes / (1024 * 1024),
                g.nvml_available
            );
        }
    }

    gpus
}

// ---------------------------------------------------------------------------
// Shader Cache Scanning (Stories 3.2 + 3.3)
// ---------------------------------------------------------------------------

/// NVIDIA shader cache paths.
const NVIDIA_SHADER_CACHE_PATHS: &[(&str, &str)] = &[
    ("DXCache", r"%LOCALAPPDATA%\NVIDIA\DXCache"),
    ("GLCache", r"%LOCALAPPDATA%\NVIDIA\GLCache"),
    ("NV_Cache", r"%LOCALAPPDATA%\NVIDIA Corporation\NV_Cache"),
];

/// AMD shader cache paths.
const AMD_SHADER_CACHE_PATHS: &[(&str, &str)] = &[
    ("DxCache", r"%LOCALAPPDATA%\AMD\DxCache"),
    ("GLCache", r"%LOCALAPPDATA%\AMD\GLCache"),
];

/// DirectX shared shader cache path (vendor-independent).
const DIRECTX_SHADER_CACHE_PATH: &str = r"%LOCALAPPDATA%\D3DSCache";

/// A single cache path with its resolved location and size.
#[derive(Debug, Clone, Serialize)]
pub struct GpuCachePath {
    pub label: String,
    pub path: String,
    pub size_bytes: u64,
    pub file_count: u64,
    pub exists: bool,
}

/// A category of GPU shader cache (e.g., "NVIDIA Shader Cache").
#[derive(Debug, Clone, Serialize)]
pub struct GpuCacheCategory {
    pub id: String,
    pub name: String,
    pub vendor: String,
    pub paths: Vec<GpuCachePath>,
    pub total_size_bytes: u64,
    pub available: bool,
    pub requires_elevation: bool,
}

/// Full scan result combining GPU info and cache categories.
#[derive(Debug, Clone, Serialize)]
pub struct GpuScanResult {
    pub gpus: Vec<GpuInfo>,
    pub cache_categories: Vec<GpuCacheCategory>,
    pub total_size_bytes: u64,
    pub scan_duration_ms: u64,
}

/// Result of cleaning GPU caches.
#[derive(Debug, Clone, Serialize)]
pub struct GpuCleanResult {
    pub cleaned_bytes: u64,
    pub failed_bytes: u64,
    pub categories_cleaned: Vec<String>,
    pub duration_ms: u64,
    pub first_load_slower_warning: bool,
}

/// Scan a list of shader cache paths and build a GpuCacheCategory.
fn scan_cache_paths(
    id: &str,
    name: &str,
    vendor: &str,
    paths: &[(&str, &str)],
    available: bool,
) -> GpuCacheCategory {
    let mut category = GpuCacheCategory {
        id: id.to_string(),
        name: name.to_string(),
        vendor: vendor.to_string(),
        paths: Vec::new(),
        total_size_bytes: 0,
        available,
        requires_elevation: false,
    };

    if !available {
        // Still report the paths but with zero sizes
        for (label, path_template) in paths {
            let path = expand_env_path(path_template);
            category.paths.push(GpuCachePath {
                label: label.to_string(),
                path,
                size_bytes: 0,
                file_count: 0,
                exists: false,
            });
        }
        return category;
    }

    for (label, path_template) in paths {
        let path = expand_env_path(path_template);
        let p = Path::new(&path);
        let exists = p.exists();
        let (size, count) = if exists { calc_dir_size(p) } else { (0, 0) };

        category.paths.push(GpuCachePath {
            label: label.to_string(),
            path: path.clone(),
            size_bytes: size,
            file_count: count,
            exists,
        });
        category.total_size_bytes += size;
    }

    category
}

/// Scan NVIDIA shader caches.
/// Does NOT depend on NVML — purely filesystem-based.
pub fn scan_nvidia_shader_cache(has_nvidia: bool) -> GpuCacheCategory {
    scan_cache_paths(
        "nvidia_shader",
        "NVIDIA Shader Cache",
        "NVIDIA",
        NVIDIA_SHADER_CACHE_PATHS,
        has_nvidia,
    )
}

/// Scan AMD shader caches.
pub fn scan_amd_shader_cache(has_amd: bool) -> GpuCacheCategory {
    scan_cache_paths(
        "amd_shader",
        "AMD Shader Cache",
        "AMD",
        AMD_SHADER_CACHE_PATHS,
        has_amd,
    )
}

/// Scan DirectX shader cache (always available on Windows).
pub fn scan_directx_cache() -> GpuCacheCategory {
    scan_cache_paths(
        "directx",
        "DirectX Shader Cache",
        "DirectX",
        &[("D3DSCache", DIRECTX_SHADER_CACHE_PATH)],
        true, // Always available on Windows
    )
}

/// Scan all GPU shader caches, combining detection and filesystem scan.
pub fn scan_all_gpu_caches(nvml: &NvmlHandle, wmi: &WmiClient) -> GpuScanResult {
    let start = Instant::now();

    // Detect GPUs
    let gpus = detect_gpus(nvml, wmi);

    // Determine which vendors are present
    let has_nvidia = gpus.iter().any(|g| g.vendor == "NVIDIA");
    let has_amd = gpus.iter().any(|g| g.vendor == "AMD");

    // Scan each category
    let mut categories = Vec::new();

    let nvidia_cat = scan_nvidia_shader_cache(has_nvidia);
    tracing::info!(
        "NVIDIA shader cache: {} bytes across {} paths (available: {})",
        nvidia_cat.total_size_bytes,
        nvidia_cat.paths.len(),
        nvidia_cat.available
    );
    categories.push(nvidia_cat);

    let amd_cat = scan_amd_shader_cache(has_amd);
    tracing::info!(
        "AMD shader cache: {} bytes across {} paths (available: {})",
        amd_cat.total_size_bytes,
        amd_cat.paths.len(),
        amd_cat.available
    );
    categories.push(amd_cat);

    let dx_cat = scan_directx_cache();
    tracing::info!(
        "DirectX shader cache: {} bytes (available: {})",
        dx_cat.total_size_bytes,
        dx_cat.available
    );
    categories.push(dx_cat);

    let total_size_bytes = categories.iter().map(|c| c.total_size_bytes).sum();
    let duration = start.elapsed();

    tracing::info!(
        "GPU cache scan complete: {} total bytes in {:?}",
        total_size_bytes,
        duration
    );

    GpuScanResult {
        gpus,
        cache_categories: categories,
        total_size_bytes,
        scan_duration_ms: duration.as_millis() as u64,
    }
}

// ---------------------------------------------------------------------------
// Shader Cache Cleaning (Story 3.3)
// ---------------------------------------------------------------------------

/// Clean selected GPU cache categories.
/// `category_ids` should contain IDs like "nvidia_shader", "amd_shader", "directx".
pub fn clean_gpu_caches(
    category_ids: &[String],
    nvml: &NvmlHandle,
    wmi: &WmiClient,
) -> Result<GpuCleanResult, AppError> {
    let start = Instant::now();

    // Re-scan to get current paths
    let scan = scan_all_gpu_caches(nvml, wmi);

    let mut total_cleaned: u64 = 0;
    let mut total_failed: u64 = 0;
    let mut categories_cleaned = Vec::new();

    for cat in &scan.cache_categories {
        if !category_ids.contains(&cat.id) {
            continue;
        }

        if !cat.available {
            tracing::info!("Skipping unavailable category: {}", cat.name);
            continue;
        }

        tracing::info!("Cleaning category: {} ({} bytes)", cat.name, cat.total_size_bytes);

        for cache_path in &cat.paths {
            if !cache_path.exists {
                continue;
            }

            let p = Path::new(&cache_path.path);
            let result = safe_delete_dir_contents(p);

            total_cleaned += result.freed_bytes;
            // Estimate failed bytes from files that were skipped
            if result.files_skipped > 0 {
                // Rough estimate: use average file size for skipped files
                let avg_size = if result.files_deleted > 0 {
                    result.freed_bytes / result.files_deleted
                } else {
                    0
                };
                total_failed += result.files_skipped * avg_size;
            }

            tracing::info!(
                "  {} — cleaned {} bytes, {} files deleted, {} skipped",
                cache_path.label,
                result.freed_bytes,
                result.files_deleted,
                result.files_skipped
            );
        }

        categories_cleaned.push(cat.id.clone());
    }

    let duration = start.elapsed();

    tracing::info!(
        "GPU cache clean complete: {} bytes freed in {:?}",
        total_cleaned,
        duration
    );

    Ok(GpuCleanResult {
        cleaned_bytes: total_cleaned,
        failed_bytes: total_failed,
        categories_cleaned,
        duration_ms: duration.as_millis() as u64,
        first_load_slower_warning: true,
    })
}

// Legacy struct kept for backward compatibility with existing command stubs
pub struct GpuCacheManager;

impl GpuCacheManager {
    pub fn new() -> Self {
        Self
    }
}

impl Default for GpuCacheManager {
    fn default() -> Self {
        Self::new()
    }
}
