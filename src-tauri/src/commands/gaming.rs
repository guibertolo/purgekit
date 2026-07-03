//! Tauri commands for Gaming Mode.

use std::sync::atomic::Ordering;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::config::GamingOptions;
use crate::error::AppError;
use crate::modules::gaming_mode;
use crate::state::AppState;

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct GamingModeStatus {
    pub active: bool,
    pub snapshot_exists: bool,
    pub activated_at: Option<i64>,
    pub pending_restore: bool,
}

#[derive(Debug, Serialize)]
pub struct GamingActivateResponse {
    pub services_stopped: u32,
    pub ram_freed_mb: u32,
    pub shader_cache_cleaned: bool,
    pub game_dvr_disabled: bool,
    pub game_priority_set: bool,
    pub activated_at: i64,
}

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct ActivateOptions {
    pub clean_shader_cache: Option<bool>,
    pub flush_ram: Option<bool>,
    pub disable_game_dvr: Option<bool>,
    pub game_pid: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct GameConfigInput {
    pub name: String,
    pub exe_path: String,
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Get the current Gaming Mode status.
#[tauri::command]
pub async fn get_gaming_mode_status(state: State<'_, AppState>) -> Result<GamingModeStatus, AppError> {
    let active = state.gaming_mode_active.load(Ordering::Relaxed);
    let pending = state.pending_restore.load(Ordering::Relaxed);
    let snapshot_exists = crate::state::gaming_snapshot::GamingSnapshot::exists(&state.data_dir);

    let activated_at = if active || snapshot_exists {
        crate::state::gaming_snapshot::GamingSnapshot::load(&state.data_dir)?
            .map(|s| s.activated_at)
    } else {
        None
    };

    Ok(GamingModeStatus {
        active,
        snapshot_exists,
        activated_at,
        pending_restore: pending,
    })
}

/// Preview what Gaming Mode will do (for confirmation dialog).
#[tauri::command]
pub async fn preview_gaming_mode(
    state: State<'_, AppState>,
) -> Result<gaming_mode::GamingPreview, AppError> {
    let config = state.config.lock().unwrap();
    let options = config.gaming_options.clone();
    drop(config);

    gaming_mode::preview_gaming_mode(&state, &options)
}

/// Activate Gaming Mode with the given options.
#[tauri::command]
pub async fn activate_gaming_mode(
    state: State<'_, AppState>,
    options: Option<ActivateOptions>,
) -> Result<GamingActivateResponse, AppError> {
    let config = state.config.lock().unwrap();
    let default_options = config.gaming_options.clone();
    drop(config);

    let game_pid = options.as_ref().and_then(|o| o.game_pid);

    let gaming_options = match options {
        Some(opts) => GamingOptions {
            clean_shader_cache: opts.clean_shader_cache.unwrap_or(default_options.clean_shader_cache),
            flush_ram: opts.flush_ram.unwrap_or(default_options.flush_ram),
            disable_game_dvr: opts.disable_game_dvr.unwrap_or(default_options.disable_game_dvr),
        },
        None => default_options,
    };

    let result = gaming_mode::activate_gaming_mode(&state, &gaming_options, game_pid)?;

    // Update last_session_at for any configured game
    let mut config = state.config.lock().unwrap();
    let now = chrono::Utc::now().timestamp();
    for gc in &mut config.game_configs {
        gc.last_session_at = Some(now);
    }
    let config_path = crate::config::config_path(&state.data_dir);
    let _ = config.save(&config_path);
    drop(config);

    Ok(GamingActivateResponse {
        services_stopped: result.services_stopped,
        ram_freed_mb: result.ram_freed_mb,
        shader_cache_cleaned: result.shader_cache_cleaned,
        game_dvr_disabled: result.game_dvr_disabled,
        game_priority_set: result.game_priority_set,
        activated_at: result.activated_at,
    })
}

/// Deactivate Gaming Mode and restore the system.
#[tauri::command]
pub async fn deactivate_gaming_mode(state: State<'_, AppState>) -> Result<(), AppError> {
    gaming_mode::deactivate_gaming_mode(&state)
}

/// Restore from a crash-recovery snapshot.
#[tauri::command]
pub async fn restore_from_snapshot(state: State<'_, AppState>) -> Result<(), AppError> {
    gaming_mode::restore_from_snapshot(&state.data_dir, &state)
}

/// Dismiss the crash-recovery banner without restoring.
#[tauri::command]
pub async fn dismiss_gaming_restore(state: State<'_, AppState>) -> Result<(), AppError> {
    crate::state::gaming_snapshot::GamingSnapshot::clear(&state.data_dir)?;
    state.pending_restore.store(false, Ordering::Relaxed);
    tracing::info!("Gaming restore dismissed — snapshot cleared without restoring");
    Ok(())
}

/// Set a process to HIGH priority.
#[tauri::command]
pub async fn set_game_process_priority(pid: u32) -> Result<(), AppError> {
    if !crate::platform::elevation::is_elevated() {
        return Err(AppError::ElevationRequired {
            operation: "Set process priority".to_string(),
        });
    }
    crate::platform::process::set_process_priority_high(pid)
}

/// Add a game configuration.
#[tauri::command]
pub async fn add_game_config(
    state: State<'_, AppState>,
    input: GameConfigInput,
) -> Result<(), AppError> {
    let mut config = state.config.lock().unwrap();

    // Prevent duplicates
    if config.game_configs.iter().any(|g| g.exe_path == input.exe_path) {
        return Err(AppError::Module(format!(
            "Game '{}' already configured",
            input.name
        )));
    }

    config.game_configs.push(crate::config::GameConfig {
        name: input.name.clone(),
        exe_path: input.exe_path.clone(),
        last_session_at: None,
    });

    let config_path = crate::config::config_path(&state.data_dir);
    config.save(&config_path).map_err(|e| {
        AppError::Io(format!("Failed to save config: {}", e))
    })?;

    tracing::info!("Game config added: {} ({})", input.name, input.exe_path);
    Ok(())
}

/// Remove a game configuration by exe_path.
#[tauri::command]
pub async fn remove_game_config(
    state: State<'_, AppState>,
    exe_path: String,
) -> Result<(), AppError> {
    let mut config = state.config.lock().unwrap();
    let before = config.game_configs.len();
    config.game_configs.retain(|g| g.exe_path != exe_path);

    if config.game_configs.len() == before {
        return Err(AppError::NotFound(format!(
            "Game config not found: {}",
            exe_path
        )));
    }

    let config_path = crate::config::config_path(&state.data_dir);
    config.save(&config_path).map_err(|e| {
        AppError::Io(format!("Failed to save config: {}", e))
    })?;

    tracing::info!("Game config removed: {}", exe_path);
    Ok(())
}

/// List all configured games.
#[tauri::command]
pub async fn list_game_configs(
    state: State<'_, AppState>,
) -> Result<Vec<crate::config::GameConfig>, AppError> {
    let config = state.config.lock().unwrap();
    Ok(config.game_configs.clone())
}

/// Update gaming options (checkboxes).
#[tauri::command]
pub async fn update_gaming_options(
    state: State<'_, AppState>,
    options: GamingOptions,
) -> Result<(), AppError> {
    let mut config = state.config.lock().unwrap();
    config.gaming_options = options;

    let config_path = crate::config::config_path(&state.data_dir);
    config.save(&config_path).map_err(|e| {
        AppError::Io(format!("Failed to save config: {}", e))
    })?;

    Ok(())
}
