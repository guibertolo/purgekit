use serde::Serialize;

use crate::error::AppError;

#[derive(Debug, Serialize)]
pub struct DevToolInfo {
    pub name: String,
    pub cache_bytes: u64,
    pub path: String,
}

#[tauri::command]
pub async fn scan_dev_caches() -> Result<Vec<DevToolInfo>, AppError> {
    tracing::info!("Scanning dev caches (stub)");
    Ok(vec![])
}

#[tauri::command]
pub async fn clean_dev_caches(tools: Vec<String>) -> Result<u64, AppError> {
    tracing::info!("Cleaning dev caches (stub): {:?}", tools);
    Ok(0)
}
