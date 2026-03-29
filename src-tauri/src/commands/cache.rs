//! Tauri commands for cache scanning and cleaning.

use tauri::State;

use crate::error::AppError;
use crate::modules::cache_cleaner::{CacheCleaner, CleanResult, ScanResult};
use crate::state::AppState;

/// Scan all system cache categories.
/// If `categories` is provided, only scan those specific category IDs.
#[tauri::command]
pub async fn scan_system_cache(
    _state: State<'_, AppState>,
    categories: Option<Vec<String>>,
) -> Result<ScanResult, AppError> {
    tracing::info!(filter = ?categories, "scan_system_cache invoked");
    let cleaner = CacheCleaner::new();
    cleaner.scan(categories).await
}

/// Clean selected cache categories.
/// `categories` is a list of category IDs to clean (e.g., ["user_temp", "browser_chrome"]).
#[tauri::command]
pub async fn clean_system_cache(
    app: tauri::AppHandle,
    _state: State<'_, AppState>,
    categories: Vec<String>,
) -> Result<CleanResult, AppError> {
    tracing::info!(categories = ?categories, "clean_system_cache invoked");
    let cleaner = CacheCleaner::new();
    cleaner.clean(&app, categories).await
}

// Keep backward-compat stubs for existing commands registered in lib.rs
#[tauri::command]
pub async fn scan_caches() -> Result<ScanResult, AppError> {
    let cleaner = CacheCleaner::new();
    cleaner.scan(None).await
}

#[tauri::command]
pub async fn clean_caches(categories: Vec<String>) -> Result<u64, AppError> {
    // Legacy stub — returns 0, use clean_system_cache instead
    tracing::info!("Legacy clean_caches called with {:?}", categories);
    Ok(0)
}
