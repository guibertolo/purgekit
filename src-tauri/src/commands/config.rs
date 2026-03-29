use tauri::State;

use crate::config::{self, AppConfig};
use crate::error::AppError;
use crate::state::AppState;

/// Return the current application configuration.
#[tauri::command]
pub async fn get_app_config(state: State<'_, AppState>) -> Result<AppConfig, AppError> {
    let config = state
        .config
        .lock()
        .map_err(|e| AppError::Module(format!("Config lock poisoned: {}", e)))?;
    Ok(config.clone())
}

/// Merge a partial JSON config into the current config and persist it.
///
/// Only fields present in `partial` are overwritten; the rest are preserved.
/// Returns the updated full config.
#[tauri::command]
pub async fn update_app_config(
    state: State<'_, AppState>,
    partial: serde_json::Value,
) -> Result<AppConfig, AppError> {
    let mut config = state
        .config
        .lock()
        .map_err(|e| AppError::Module(format!("Config lock poisoned: {}", e)))?;

    config.merge_partial(&partial);

    let config_file = config::config_path(&state.data_dir);
    config.save(&config_file).map_err(|e| {
        AppError::Io(format!("Failed to save config: {}", e))
    })?;

    tracing::info!("App config updated and saved");
    Ok(config.clone())
}
