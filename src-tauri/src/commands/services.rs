use serde::Serialize;

use crate::error::AppError;

#[derive(Debug, Serialize)]
pub struct ServiceInfo {
    pub name: String,
    pub display_name: String,
    pub status: String,
    pub startup_type: String,
}

#[tauri::command]
pub async fn list_services() -> Result<Vec<ServiceInfo>, AppError> {
    tracing::info!("Listing services (stub)");
    Ok(vec![])
}

#[tauri::command]
pub async fn toggle_service(name: String, enable: bool) -> Result<(), AppError> {
    tracing::info!("Toggle service (stub): {} -> {}", name, enable);
    Ok(())
}
