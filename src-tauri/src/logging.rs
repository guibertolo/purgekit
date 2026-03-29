use std::path::Path;
use tracing_appender::rolling::{RollingFileAppender, Rotation};
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

/// Initialize the tracing/logging subsystem.
///
/// - Logs to a daily-rotating file at `{data_dir}/logs/purgekit-YYYY-MM-DD.log`
/// - In debug builds, also logs to stdout
/// - Cleans up log files older than 30 days on startup
pub fn init_logging(data_dir: &Path) {
    let log_dir = data_dir.join("logs");
    if let Err(e) = std::fs::create_dir_all(&log_dir) {
        eprintln!("Failed to create log directory {}: {}", log_dir.display(), e);
        // Fall back to stdout-only logging
        init_stdout_only();
        return;
    }

    // Clean up old logs once at startup (non-blocking, best-effort)
    cleanup_old_logs(&log_dir, 30);

    let file_appender = RollingFileAppender::new(
        Rotation::DAILY,
        &log_dir,
        "purgekit",
    );

    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("purgekit_lib=info,warn"));

    let file_layer = fmt::layer()
        .with_writer(file_appender)
        .with_target(true)
        .with_file(true)
        .with_line_number(true)
        .with_ansi(false);

    // In debug builds, also log to stdout
    #[cfg(debug_assertions)]
    {
        let stdout_layer = fmt::layer()
            .with_writer(std::io::stdout)
            .with_target(true)
            .with_file(true)
            .with_line_number(true);

        tracing_subscriber::registry()
            .with(filter)
            .with(file_layer)
            .with(stdout_layer)
            .init();
    }

    #[cfg(not(debug_assertions))]
    {
        tracing_subscriber::registry()
            .with(filter)
            .with(file_layer)
            .init();
    }

    tracing::info!("PurgeKit logging initialized — log dir: {}", log_dir.display());
}

/// Fallback: stdout-only logging when file logging fails.
fn init_stdout_only() {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("purgekit_lib=info,warn"));

    fmt()
        .with_env_filter(filter)
        .with_target(true)
        .with_file(true)
        .with_line_number(true)
        .init();

    tracing::warn!("PurgeKit logging: file appender unavailable, using stdout only");
}

/// Remove log files older than `max_days` from the log directory.
/// Runs once at startup — best-effort, errors are silently ignored.
fn cleanup_old_logs(log_dir: &Path, max_days: u64) {
    let cutoff = std::time::SystemTime::now()
        - std::time::Duration::from_secs(max_days * 24 * 60 * 60);

    let entries = match std::fs::read_dir(log_dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        // Only clean files that look like our log files
        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) if n.starts_with("purgekit") => n.to_string(),
            _ => continue,
        };

        // Check file age via metadata
        if let Ok(metadata) = path.metadata() {
            if let Ok(modified) = metadata.modified() {
                if modified < cutoff {
                    if let Err(e) = std::fs::remove_file(&path) {
                        tracing::debug!("Failed to remove old log {}: {}", name, e);
                    } else {
                        tracing::debug!("Cleaned up old log file: {}", name);
                    }
                }
            }
        }
    }
}
