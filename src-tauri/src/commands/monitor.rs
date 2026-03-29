//! Tauri commands for system monitoring.
//!
//! The main monitoring data flow is event-based (the background loop emits
//! `"system-metrics"` every 2 seconds). This command exists as a one-shot
//! fallback for the frontend to request current metrics on demand.

use serde::Serialize;

use crate::error::AppError;

/// Lightweight one-shot metrics snapshot. The frontend primarily uses
/// the event stream, but this command is available for initial load.
#[derive(Debug, Serialize)]
pub struct MetricsSnapshot {
    pub available: bool,
    pub message: String,
}

#[tauri::command]
pub async fn get_system_metrics() -> Result<MetricsSnapshot, AppError> {
    tracing::info!("Command: get_system_metrics (one-shot)");
    Ok(MetricsSnapshot {
        available: true,
        message: "Metrics are streamed via 'system-metrics' event every 2 seconds.".to_string(),
    })
}
