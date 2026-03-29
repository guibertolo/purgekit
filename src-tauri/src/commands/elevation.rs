//! Tauri commands for UAC elevation detection and re-launch.

use crate::error::AppError;
use crate::platform::elevation;
use crate::session::{self, SessionState};

/// Check whether the current process is running with administrator privileges.
#[tauri::command]
pub async fn is_elevated() -> bool {
    elevation::is_elevated()
}

/// Save session state and re-launch the app as administrator.
///
/// If the process is already elevated this is a no-op (AC-9).
#[tauri::command]
pub async fn request_elevation(current_page: String) -> Result<(), AppError> {
    if elevation::is_elevated() {
        tracing::info!("Already elevated — request_elevation is a no-op");
        return Ok(());
    }

    // Persist the user's current page so the elevated instance can restore it
    let state = SessionState {
        current_page,
        timestamp: chrono::Utc::now().timestamp(),
    };
    session::save_session(&state)?;

    // Re-launch with elevated privileges (does not return on success)
    elevation::relaunch_elevated("")
}

/// Called once at startup to check if a session file exists from a prior
/// non-elevated launch. Returns the page to navigate to, or `null`.
#[tauri::command]
pub async fn get_restored_session() -> Option<String> {
    session::restore_session().map(|s| s.current_page)
}
