//! Session state persistence for UAC re-launch.
//!
//! Before the app re-launches itself as administrator, it serialises the
//! user's current page into a small JSON file in `%TEMP%`. After the
//! elevated instance starts it reads (and deletes) this file to restore
//! the user right where they left off.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Lightweight snapshot of the user's session written before UAC re-launch.
#[derive(Debug, Serialize, Deserialize)]
pub struct SessionState {
    /// Route / page the user was viewing (e.g. "/services").
    pub current_page: String,
    /// Unix timestamp (seconds) when the state was captured.
    pub timestamp: i64,
}

/// Canonical path for the session file: `%TEMP%\purgekit-session.json`.
pub fn session_file_path() -> PathBuf {
    let temp = std::env::var("TEMP")
        .or_else(|_| std::env::var("TMP"))
        .unwrap_or_else(|_| ".".to_string());
    PathBuf::from(temp).join("purgekit-session.json")
}

/// Persist session state so the elevated instance can restore it.
pub fn save_session(state: &SessionState) -> Result<(), crate::error::AppError> {
    let path = session_file_path();
    let json = serde_json::to_string_pretty(state).map_err(|e| {
        crate::error::AppError::Io(format!("Failed to serialise session state: {}", e))
    })?;
    std::fs::write(&path, json)?;
    tracing::info!("Session state saved to {}", path.display());
    Ok(())
}

/// Try to read and delete the session file. Returns `None` if no file exists
/// or it cannot be parsed.
pub fn restore_session() -> Option<SessionState> {
    let path = session_file_path();
    let contents = match std::fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return None,
    };

    // Always delete the file after reading, even if parsing fails
    if let Err(e) = std::fs::remove_file(&path) {
        tracing::warn!("Could not delete session file: {}", e);
    }

    match serde_json::from_str::<SessionState>(&contents) {
        Ok(state) => {
            tracing::info!(
                "Restored session: page={}, ts={}",
                state.current_page,
                state.timestamp
            );
            Some(state)
        }
        Err(e) => {
            tracing::warn!("Failed to parse session file: {}", e);
            None
        }
    }
}
