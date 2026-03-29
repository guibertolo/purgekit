use serde::Serialize;

use crate::error::AppError;

#[derive(Debug, Serialize)]
pub struct GamingModeStatus {
    pub active: bool,
    pub services_stopped: u32,
    pub ram_freed_bytes: u64,
}

#[tauri::command]
pub async fn activate_gaming_mode() -> Result<GamingModeStatus, AppError> {
    tracing::info!("Activating gaming mode (stub)");
    Ok(GamingModeStatus {
        active: true,
        services_stopped: 0,
        ram_freed_bytes: 0,
    })
}

#[tauri::command]
pub async fn deactivate_gaming_mode() -> Result<GamingModeStatus, AppError> {
    tracing::info!("Deactivating gaming mode (stub)");
    Ok(GamingModeStatus {
        active: false,
        services_stopped: 0,
        ram_freed_bytes: 0,
    })
}
