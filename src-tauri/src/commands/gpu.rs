//! Tauri commands for GPU detection and shader cache management.
//!
//! - `detect_gpus`: Detect installed GPUs via NVML + WMI
//! - `scan_gpu_cache`: Scan all GPU shader caches for size info
//! - `clean_gpu_cache`: Clean selected shader cache categories

use tauri::State;

use crate::error::AppError;
use crate::modules::gpu_cache::{
    self, GpuCleanResult, GpuInfo, GpuScanResult,
};
use crate::platform::wmi_client::WmiClient;
use crate::state::AppState;

/// Create a WMI client for the current call.
/// WMI/COM is thread-affine, so we create a fresh connection per command.
fn make_wmi() -> Result<WmiClient, AppError> {
    WmiClient::new()
}

/// Detect all installed GPUs and return their information.
#[tauri::command]
pub async fn detect_gpus(state: State<'_, AppState>) -> Result<Vec<GpuInfo>, AppError> {
    tracing::info!("Command: detect_gpus");

    let wmi = make_wmi()?;
    let gpus = gpu_cache::detect_gpus(&state.nvml, &wmi);
    Ok(gpus)
}

/// Scan all GPU shader caches (NVIDIA, AMD, DirectX) and return sizes.
#[tauri::command]
pub async fn scan_gpu_cache(state: State<'_, AppState>) -> Result<GpuScanResult, AppError> {
    tracing::info!("Command: scan_gpu_cache");

    let wmi = make_wmi()?;
    let result = gpu_cache::scan_all_gpu_caches(&state.nvml, &wmi);
    Ok(result)
}

/// Clean selected GPU shader cache categories.
/// `categories` is a list of category IDs: "nvidia_shader", "amd_shader", "directx".
#[tauri::command]
pub async fn clean_gpu_cache(
    state: State<'_, AppState>,
    categories: Vec<String>,
) -> Result<GpuCleanResult, AppError> {
    tracing::info!("Command: clean_gpu_cache — categories: {:?}", categories);

    if categories.is_empty() {
        return Err(AppError::Module("No categories selected for cleaning".to_string()));
    }

    let wmi = make_wmi()?;
    let result = gpu_cache::clean_gpu_caches(&categories, &state.nvml, &wmi)?;
    Ok(result)
}
