use serde::Serialize;

use crate::error::AppError;

#[derive(Debug, Serialize)]
pub struct StartupItem {
    pub name: String,
    pub path: String,
    pub enabled: bool,
    pub impact: String,
}

#[tauri::command]
pub async fn list_startup_items() -> Result<Vec<StartupItem>, AppError> {
    tracing::info!("Listing startup items (stub)");
    Ok(vec![])
}

#[tauri::command]
pub async fn toggle_startup_item(name: String, enable: bool) -> Result<(), AppError> {
    tracing::info!("Toggle startup item (stub): {} -> {}", name, enable);
    Ok(())
}
