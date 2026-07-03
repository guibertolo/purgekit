//! Tauri commands for Developer Mode (Epic 9 — Stories 9.1-9.4).

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use serde::Deserialize;
use tauri::{AppHandle, Emitter, State};

use crate::error::AppError;
use crate::modules::dev_cleaner;
use crate::state::AppState;

// ---------------------------------------------------------------------------
// Story 9.1: Detect dev tools
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn detect_dev_tools() -> Result<Vec<dev_cleaner::DevToolInfo>, AppError> {
    tracing::info!("Detecting dev tools");
    let tools = tokio::task::spawn_blocking(dev_cleaner::detect_all_dev_tools)
        .await
        .map_err(|e| AppError::Module(format!("Detection task panicked: {}", e)))?;
    Ok(tools)
}

// ---------------------------------------------------------------------------
// Story 9.2: Scan node_modules
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct ScanNodeModulesArgs {
    pub scan_dirs: Vec<String>,
    pub inactive_threshold_days: u32,
}

#[tauri::command]
pub async fn scan_node_modules(
    app: AppHandle,
    state: State<'_, AppState>,
    scan_dirs: Vec<String>,
    inactive_threshold_days: u32,
) -> Result<Vec<dev_cleaner::NodeModulesEntry>, AppError> {
    tracing::info!(
        dirs = ?scan_dirs,
        threshold = inactive_threshold_days,
        "Scanning node_modules"
    );

    // Use default dirs if none provided
    let dirs = if scan_dirs.is_empty() {
        let userprofile = crate::platform::filesystem::expand_env_path("%USERPROFILE%");
        vec![
            format!(r"{}\Projects", userprofile),
            format!(r"{}\Documents", userprofile),
            format!(r"{}\Desktop", userprofile),
        ]
    } else {
        scan_dirs
    };

    let threshold = if inactive_threshold_days == 0 {
        90
    } else {
        inactive_threshold_days
    };

    // Store cancel token in state
    let cancel = Arc::new(AtomicBool::new(false));
    {
        let mut lock = state.dev_scan_cancel.lock().unwrap();
        *lock = Some(Arc::clone(&cancel));
    }

    let handle = app.clone();
    let results = tokio::task::spawn_blocking(move || {
        dev_cleaner::scan_node_modules(&dirs, threshold, &cancel, &|progress| {
            let _ = handle.emit("dev-scan-progress", &progress);
        })
    })
    .await
    .map_err(|e| AppError::Module(format!("Scan task panicked: {}", e)))?;

    // Clear cancel token
    {
        let mut lock = state.dev_scan_cancel.lock().unwrap();
        *lock = None;
    }

    Ok(results)
}

#[tauri::command]
pub async fn cancel_dev_scan(state: State<'_, AppState>) -> Result<(), AppError> {
    let lock = state.dev_scan_cancel.lock().unwrap();
    if let Some(cancel) = lock.as_ref() {
        cancel.store(true, Ordering::Relaxed);
        tracing::info!("Dev scan cancellation requested");
    }
    Ok(())
}

#[tauri::command]
pub async fn clean_node_modules(paths: Vec<String>) -> Result<Vec<dev_cleaner::DevCleanResult>, AppError> {
    tracing::info!(count = paths.len(), "Cleaning node_modules");
    let results = tokio::task::spawn_blocking(move || dev_cleaner::clean_node_modules(&paths))
        .await
        .map_err(|e| AppError::Module(format!("Clean task panicked: {}", e)))?;
    Ok(results)
}

// ---------------------------------------------------------------------------
// Story 9.3: JS caches + Docker
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn scan_js_caches() -> Result<Vec<dev_cleaner::DevCacheCategory>, AppError> {
    tracing::info!("Scanning JS caches");
    let results = tokio::task::spawn_blocking(|| {
        let tools = dev_cleaner::detect_all_dev_tools();
        dev_cleaner::scan_js_caches(&tools)
    })
    .await
    .map_err(|e| AppError::Module(format!("Scan task panicked: {}", e)))?;
    Ok(results)
}

#[tauri::command]
pub async fn clean_js_caches(categories: Vec<String>) -> Result<Vec<dev_cleaner::DevCleanResult>, AppError> {
    tracing::info!(categories = ?categories, "Cleaning JS caches");
    let results = tokio::task::spawn_blocking(move || dev_cleaner::clean_js_caches(&categories))
        .await
        .map_err(|e| AppError::Module(format!("Clean task panicked: {}", e)))?;
    Ok(results)
}

#[tauri::command]
pub async fn scan_docker_usage() -> Result<dev_cleaner::DevCacheCategory, AppError> {
    tracing::info!("Scanning Docker usage");
    tokio::task::spawn_blocking(dev_cleaner::get_docker_disk_usage)
        .await
        .map_err(|e| AppError::Module(format!("Docker scan task panicked: {}", e)))?
}

#[tauri::command]
pub async fn prune_docker(include_volumes: bool) -> Result<dev_cleaner::DockerPruneResult, AppError> {
    tracing::info!(include_volumes, "Pruning Docker");
    tokio::task::spawn_blocking(move || dev_cleaner::prune_docker(include_volumes))
        .await
        .map_err(|e| AppError::Module(format!("Docker prune task panicked: {}", e)))?
}

// ---------------------------------------------------------------------------
// Story 9.4: Language caches + WSL2
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn scan_language_caches() -> Result<Vec<dev_cleaner::DevCacheCategory>, AppError> {
    tracing::info!("Scanning language caches");
    let results = tokio::task::spawn_blocking(|| {
        let tools = dev_cleaner::detect_all_dev_tools();
        dev_cleaner::scan_language_caches(&tools)
    })
    .await
    .map_err(|e| AppError::Module(format!("Scan task panicked: {}", e)))?;
    Ok(results)
}

#[tauri::command]
pub async fn clean_language_caches(categories: Vec<String>) -> Result<Vec<dev_cleaner::DevCleanResult>, AppError> {
    tracing::info!(categories = ?categories, "Cleaning language caches");
    let results =
        tokio::task::spawn_blocking(move || dev_cleaner::clean_language_caches(&categories))
            .await
            .map_err(|e| AppError::Module(format!("Clean task panicked: {}", e)))?;
    Ok(results)
}

#[tauri::command]
pub async fn detect_wsl2_distributions() -> Result<Vec<dev_cleaner::Wsl2DistroInfo>, AppError> {
    tracing::info!("Detecting WSL2 distributions");
    tokio::task::spawn_blocking(dev_cleaner::detect_wsl2_distributions)
        .await
        .map_err(|e| AppError::Module(format!("WSL2 detection task panicked: {}", e)))?
}

#[tauri::command]
pub async fn compact_wsl2_vhdx(
    distro_name: String,
    vhdx_path: String,
) -> Result<u64, AppError> {
    tracing::info!(distro = %distro_name, path = %vhdx_path, "Compacting WSL2 VHDX");
    tokio::task::spawn_blocking(move || dev_cleaner::compact_wsl2_vhdx(&vhdx_path))
        .await
        .map_err(|e| AppError::Module(format!("VHDX compaction task panicked: {}", e)))?
}

// ---------------------------------------------------------------------------
// Legacy stubs (keep for backward compat, delegate to new commands)
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn scan_dev_caches() -> Result<Vec<dev_cleaner::DevToolInfo>, AppError> {
    detect_dev_tools().await
}

#[tauri::command]
pub async fn clean_dev_caches(tools: Vec<String>) -> Result<u64, AppError> {
    // Clean both JS and language caches for backward compatibility
    let js_results = tokio::task::spawn_blocking({
        let t = tools.clone();
        move || dev_cleaner::clean_js_caches(&t)
    })
    .await
    .map_err(|e| AppError::Module(format!("Task panicked: {}", e)))?;

    let lang_results = tokio::task::spawn_blocking({
        let t = tools;
        move || dev_cleaner::clean_language_caches(&t)
    })
    .await
    .map_err(|e| AppError::Module(format!("Task panicked: {}", e)))?;

    let total: u64 = js_results.iter().map(|r| r.freed_bytes).sum::<u64>()
        + lang_results.iter().map(|r| r.freed_bytes).sum::<u64>();
    Ok(total)
}
