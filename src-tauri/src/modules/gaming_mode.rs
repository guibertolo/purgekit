//! Gaming Mode — one-click system optimization for gaming sessions.
//!
//! Orchestrates: service disabling, GPU shader cache cleaning, RAM flushing,
//! Game DVR disabling, and game process priority boosting.
//! All changes are captured in a snapshot and restored on deactivation.

use std::path::Path;
use std::sync::atomic::Ordering;

use serde::Serialize;

use crate::config::GamingOptions;
use crate::error::AppError;
use crate::platform;
use crate::state::gaming_snapshot::{GamingSnapshot, RegistrySnapshot, ServiceSnapshot};
use crate::state::AppState;

/// Default services to disable during gaming (name, display reason).
pub const GAMING_SERVICES: &[(&str, &str)] = &[
    ("DiagTrack", "Telemetria Microsoft"),
    ("WSearch", "Windows Search (indexacao)"),
    ("SysMain", "SysMain/Superfetch"),
    ("wuauserv", "Windows Update"),
    ("BITS", "Background Intelligent Transfer Service"),
];

/// Preview of what Gaming Mode will do (shown before confirmation).
#[derive(Debug, Clone, Serialize)]
pub struct GamingPreview {
    pub services_to_disable: Vec<ServicePreviewItem>,
    pub will_clean_shader_cache: bool,
    pub will_flush_ram: bool,
    pub will_disable_game_dvr: bool,
    pub game_exe: Option<String>,
}

/// Preview of a single service to be disabled.
#[derive(Debug, Clone, Serialize)]
pub struct ServicePreviewItem {
    pub name: String,
    pub reason: String,
    pub current_state: String,
}

/// Result of activating Gaming Mode.
#[derive(Debug, Clone, Serialize)]
pub struct GamingActivateResult {
    pub services_stopped: u32,
    pub ram_freed_mb: u32,
    pub shader_cache_cleaned: bool,
    pub game_dvr_disabled: bool,
    pub game_priority_set: bool,
    pub activated_at: i64,
}

/// Generate a preview of what Gaming Mode will do without making changes.
pub fn preview_gaming_mode(
    state: &AppState,
    options: &GamingOptions,
) -> Result<GamingPreview, AppError> {
    let service_list = {
        let config = state.config.lock().unwrap();
        get_service_list_owned(&config.gaming_services_override)
    };

    let mut services_to_disable = Vec::new();

    for (name, reason) in &service_list {
        if !platform::services::service_exists(name) {
            continue;
        }

        match platform::services::get_service_state(name) {
            Ok(svc_state) => {
                // Only show services that are currently running
                if svc_state.state == "Running" {
                    services_to_disable.push(ServicePreviewItem {
                        name: name.to_string(),
                        reason: reason.to_string(),
                        current_state: svc_state.state,
                    });
                }
            }
            Err(e) => {
                tracing::warn!("Could not query service {}: {}", name, e);
            }
        }
    }

    Ok(GamingPreview {
        services_to_disable,
        will_clean_shader_cache: options.clean_shader_cache,
        will_flush_ram: options.flush_ram,
        will_disable_game_dvr: options.disable_game_dvr,
        game_exe: None,
    })
}

/// Activate Gaming Mode: disable services, flush RAM, clean shaders, disable Game DVR.
///
/// REQUIRES ELEVATION. Will return `AppError::ElevationRequired` if not admin.
pub fn activate_gaming_mode(
    state: &AppState,
    options: &GamingOptions,
    game_pid: Option<u32>,
) -> Result<GamingActivateResult, AppError> {
    // 1. Check elevation
    if !platform::elevation::is_elevated() {
        return Err(AppError::ElevationRequired {
            operation: "Gaming Mode activation".to_string(),
        });
    }

    // 2. Check not already active
    if state.gaming_mode_active.load(Ordering::Relaxed) {
        return Err(AppError::Module(
            "Gaming Mode is already active".to_string(),
        ));
    }

    let timestamp = chrono::Utc::now().timestamp();
    let mut service_snapshots = Vec::new();
    let mut registry_snapshots: Vec<RegistrySnapshot> = Vec::new();
    let mut services_stopped: u32 = 0;

    // 3. Disable services and capture snapshots
    let service_list = {
        let config = state.config.lock().unwrap();
        let overrides = config.gaming_services_override.clone();
        get_service_list_owned(&overrides)
    };

    for (name, _reason) in &service_list {
        if !platform::services::service_exists(name) {
            tracing::info!("Service {} does not exist, skipping", name);
            continue;
        }

        match platform::services::get_service_state(name) {
            Ok(svc_state) => {
                // Save original state regardless
                service_snapshots.push(ServiceSnapshot {
                    name: name.to_string(),
                    original_state: svc_state.state.clone(),
                    original_startup: svc_state.startup_type.clone(),
                });

                // Only stop if currently running
                if svc_state.state == "Running" {
                    match platform::services::stop_service(name) {
                        Ok(()) => {
                            services_stopped += 1;
                            tracing::info!("Stopped service: {}", name);
                        }
                        Err(e) => {
                            tracing::warn!("Failed to stop service {}: {}", name, e);
                        }
                    }
                }
            }
            Err(e) => {
                tracing::warn!("Could not query service {}: {}", name, e);
            }
        }
    }

    // 4. Save snapshot IMMEDIATELY after service changes (crash safety)
    let mut snapshot = GamingSnapshot {
        activated_at: timestamp,
        services: service_snapshots,
        registry_entries: Vec::new(),
        game_process_pid: game_pid,
    };
    snapshot.save(&state.data_dir)?;

    // 5. GPU Shader Cache clean (optional, non-critical)
    let mut shader_cache_cleaned = false;
    if options.clean_shader_cache {
        // Use the existing gpu_cache module to clean caches
        let wmi = crate::platform::wmi_client::WmiClient::new();
        match wmi {
            Ok(wmi_client) => {
                let category_ids: Vec<String> = vec![
                    "nvidia_shader".to_string(),
                    "amd_shader".to_string(),
                    "directx".to_string(),
                ];
                match crate::modules::gpu_cache::clean_gpu_caches(
                    &category_ids,
                    &state.nvml,
                    &wmi_client,
                ) {
                    Ok(result) => {
                        tracing::info!(
                            "Shader cache cleaned: {} bytes freed",
                            result.cleaned_bytes
                        );
                        shader_cache_cleaned = true;
                    }
                    Err(e) => {
                        tracing::warn!("Shader cache clean failed (non-critical): {}", e);
                    }
                }
            }
            Err(e) => {
                tracing::warn!("Could not create WMI client for shader cache: {}", e);
            }
        }
    }

    // 6. RAM Flush (optional, non-critical)
    let mut ram_freed_mb: u32 = 0;
    if options.flush_ram {
        match platform::process::flush_working_sets_idle() {
            Ok(freed_bytes) => {
                ram_freed_mb = (freed_bytes / (1024 * 1024)) as u32;
                tracing::info!("RAM flush: ~{} MB freed", ram_freed_mb);
            }
            Err(e) => {
                tracing::warn!("RAM flush failed (non-critical): {}", e);
            }
        }
    }

    // 7. Game DVR disable (optional)
    let mut game_dvr_disabled = false;
    if options.disable_game_dvr {
        match platform::registry::disable_game_dvr() {
            Ok(reg_snapshots) => {
                registry_snapshots = reg_snapshots;
                game_dvr_disabled = !registry_snapshots.is_empty();
                tracing::info!("Game DVR disabled ({} registry entries modified)", registry_snapshots.len());
            }
            Err(e) => {
                tracing::warn!("Game DVR disable failed (non-critical): {}", e);
            }
        }
    }

    // 8. Set game process priority (if PID provided)
    let mut game_priority_set = false;
    if let Some(pid) = game_pid {
        match platform::process::set_process_priority_high(pid) {
            Ok(()) => {
                game_priority_set = true;
                tracing::info!("Game process {} set to HIGH priority", pid);
            }
            Err(e) => {
                tracing::warn!("Failed to set game process priority: {}", e);
            }
        }
    }

    // 9. Update snapshot with registry entries
    snapshot.registry_entries = registry_snapshots;
    snapshot.game_process_pid = game_pid;
    snapshot.save(&state.data_dir)?;

    // 10. Set state flags
    state.gaming_mode_active.store(true, Ordering::Relaxed);
    state.pending_restore.store(false, Ordering::Relaxed);

    tracing::info!(
        "Gaming Mode ACTIVATED: {} services stopped, ~{} MB RAM freed, DVR={}, shaders={}",
        services_stopped,
        ram_freed_mb,
        game_dvr_disabled,
        shader_cache_cleaned
    );

    Ok(GamingActivateResult {
        services_stopped,
        ram_freed_mb,
        shader_cache_cleaned,
        game_dvr_disabled,
        game_priority_set,
        activated_at: timestamp,
    })
}

/// Deactivate Gaming Mode: restore all services, Registry, and process priorities.
pub fn deactivate_gaming_mode(state: &AppState) -> Result<(), AppError> {
    restore_from_snapshot(&state.data_dir, state)
}

/// Restore system from a gaming snapshot.
/// Used both for normal deactivation and crash recovery.
pub fn restore_from_snapshot(data_dir: &Path, state: &AppState) -> Result<(), AppError> {
    let snapshot = match GamingSnapshot::load(data_dir)? {
        Some(s) => s,
        None => {
            tracing::info!("No gaming snapshot found — nothing to restore");
            state.gaming_mode_active.store(false, Ordering::Relaxed);
            state.pending_restore.store(false, Ordering::Relaxed);
            return Ok(());
        }
    };

    tracing::info!(
        "Restoring from gaming snapshot (activated_at: {})",
        snapshot.activated_at
    );

    // 1. Restore services
    for svc in &snapshot.services {
        tracing::info!(
            "Restoring service {}: original_state={}, original_startup={}",
            svc.name,
            svc.original_state,
            svc.original_startup
        );

        // If it was running before, start it back
        if svc.original_state == "Running" {
            if let Err(e) = platform::services::start_service(&svc.name) {
                tracing::warn!("Failed to restore service {}: {}", svc.name, e);
            }
        }
    }

    // 2. Restore Registry entries
    if !snapshot.registry_entries.is_empty() {
        if let Err(e) = platform::registry::restore_registry_entries(&snapshot.registry_entries) {
            tracing::warn!("Failed to restore some registry entries: {}", e);
        }
    }

    // 3. Restore process priority
    if let Some(pid) = snapshot.game_process_pid {
        if let Err(e) = platform::process::set_process_priority_normal(pid) {
            tracing::warn!("Failed to restore process {} priority (may have exited): {}", pid, e);
        }
    }

    // 4. Clear snapshot and flags
    GamingSnapshot::clear(data_dir)?;
    state.gaming_mode_active.store(false, Ordering::Relaxed);
    state.pending_restore.store(false, Ordering::Relaxed);

    tracing::info!("Gaming Mode DEACTIVATED — system restored");
    Ok(())
}

/// Get the service list as owned strings (avoids borrow issues with MutexGuard).
fn get_service_list_owned(overrides: &[String]) -> Vec<(String, String)> {
    if overrides.is_empty() {
        GAMING_SERVICES
            .iter()
            .map(|&(name, reason)| (name.to_string(), reason.to_string()))
            .collect()
    } else {
        overrides
            .iter()
            .map(|name| (name.clone(), "Custom service".to_string()))
            .collect()
    }
}
