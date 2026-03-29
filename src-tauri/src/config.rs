use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// Application configuration loaded at startup and persisted to JSON.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    /// Monitoring poll interval in milliseconds.
    #[serde(default = "default_monitor_interval")]
    pub monitor_interval_ms: u64,

    /// Temperature thresholds for hardware monitoring.
    #[serde(default)]
    pub thresholds: TemperatureThresholds,

    /// Scan path configuration for developer mode.
    #[serde(default)]
    pub scan_paths: ScanPaths,

    /// Whether the app is running in portable mode.
    #[serde(default)]
    pub portable_mode: bool,

    /// Log level filter string (e.g. "info", "debug", "warn").
    #[serde(default = "default_log_level")]
    pub log_level: String,
}

fn default_monitor_interval() -> u64 {
    2000
}

fn default_log_level() -> String {
    "info".to_string()
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            monitor_interval_ms: default_monitor_interval(),
            thresholds: TemperatureThresholds::default(),
            scan_paths: ScanPaths::default(),
            portable_mode: false,
            log_level: default_log_level(),
        }
    }
}

/// Temperature thresholds for hardware monitoring alerts.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemperatureThresholds {
    /// CPU warning threshold in Celsius.
    #[serde(default = "default_cpu")]
    pub cpu_celsius: u32,
    /// GPU warning threshold in Celsius.
    #[serde(default = "default_gpu")]
    pub gpu_celsius: u32,
    /// Disk warning threshold in Celsius.
    #[serde(default = "default_disk")]
    pub disk_celsius: u32,
    /// Motherboard warning threshold in Celsius.
    #[serde(default = "default_mobo")]
    pub motherboard_celsius: u32,
}

fn default_cpu() -> u32 {
    85
}
fn default_gpu() -> u32 {
    90
}
fn default_disk() -> u32 {
    60
}
fn default_mobo() -> u32 {
    80
}

impl Default for TemperatureThresholds {
    fn default() -> Self {
        Self {
            cpu_celsius: default_cpu(),
            gpu_celsius: default_gpu(),
            disk_celsius: default_disk(),
            motherboard_celsius: default_mobo(),
        }
    }
}

/// Configuration for scan paths in developer mode.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanPaths {
    /// Directories to scan for developer projects.
    #[serde(default = "default_projects_dirs")]
    pub projects_dirs: Vec<String>,
    /// Number of days after which a project is considered inactive.
    #[serde(default = "default_inactive_days")]
    pub inactive_threshold_days: u32,
    /// File size in MB above which a file is flagged as large.
    #[serde(default = "default_large_file_mb")]
    pub large_file_threshold_mb: u32,
}

fn default_projects_dirs() -> Vec<String> {
    if let Ok(profile) = std::env::var("USERPROFILE") {
        vec![format!("{}\\Projects", profile)]
    } else {
        vec![]
    }
}

fn default_inactive_days() -> u32 {
    90
}

fn default_large_file_mb() -> u32 {
    100
}

impl Default for ScanPaths {
    fn default() -> Self {
        Self {
            projects_dirs: default_projects_dirs(),
            inactive_threshold_days: default_inactive_days(),
            large_file_threshold_mb: default_large_file_mb(),
        }
    }
}

impl AppConfig {
    /// Load config from a JSON file, falling back to defaults if the file
    /// doesn't exist or is malformed. Missing fields use serde defaults.
    pub fn load(path: &Path) -> Self {
        match std::fs::read_to_string(path) {
            Ok(contents) => {
                serde_json::from_str(&contents).unwrap_or_else(|e| {
                    tracing::warn!("Failed to parse config at {}: {}, using defaults", path.display(), e);
                    Self::default()
                })
            }
            Err(_) => {
                tracing::info!("No config file at {}, using defaults", path.display());
                Self::default()
            }
        }
    }

    /// Save the current config to a JSON file.
    pub fn save(&self, path: &Path) -> Result<(), std::io::Error> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string_pretty(self)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
        std::fs::write(path, json)?;
        tracing::info!("Config saved to {}", path.display());
        Ok(())
    }

    /// Merge a partial JSON value into the current config. Only fields present
    /// in the partial value are overwritten; others are preserved.
    pub fn merge_partial(&mut self, partial: &serde_json::Value) {
        let mut current = serde_json::to_value(&*self).unwrap_or_default();
        if let (Some(base), Some(patch)) = (current.as_object_mut(), partial.as_object()) {
            merge_objects(base, patch);
        }
        if let Ok(merged) = serde_json::from_value(current) {
            *self = merged;
        } else {
            tracing::warn!("Partial config merge produced invalid config, ignoring");
        }
    }
}

/// Recursively merge `patch` into `base`, overwriting leaf values.
fn merge_objects(base: &mut serde_json::Map<String, serde_json::Value>, patch: &serde_json::Map<String, serde_json::Value>) {
    for (key, value) in patch {
        if let Some(existing) = base.get_mut(key) {
            if let (Some(existing_obj), Some(patch_obj)) = (existing.as_object_mut(), value.as_object()) {
                // Both are objects — recurse
                let mut cloned = existing_obj.clone();
                merge_objects(&mut cloned, patch_obj);
                *existing = serde_json::Value::Object(cloned);
                continue;
            }
        }
        base.insert(key.clone(), value.clone());
    }
}

/// Resolve the data directory for logs and config.
///
/// - **Portable mode**: If the executable is NOT under `%PROGRAMFILES%` or
///   `%PROGRAMFILES(X86)%`, use `{exe_dir}/data/`.
/// - **Installed mode**: Use `%APPDATA%/PurgeKit/`.
pub fn resolve_data_dir() -> PathBuf {
    if is_portable() {
        let exe_dir = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf()))
            .unwrap_or_else(|| PathBuf::from("."));
        exe_dir.join("data")
    } else {
        dirs_appdata().join("PurgeKit")
    }
}

/// Check whether we're running in portable mode by examining the exe path.
pub fn is_portable() -> bool {
    let exe_path = match std::env::current_exe() {
        Ok(p) => p,
        Err(_) => return false,
    };
    let exe_str = exe_path.to_string_lossy().to_lowercase();

    let program_files = std::env::var("PROGRAMFILES")
        .unwrap_or_default()
        .to_lowercase();
    let program_files_x86 = std::env::var("PROGRAMFILES(X86)")
        .unwrap_or_default()
        .to_lowercase();

    // If under Program Files, it's installed (not portable)
    if !program_files.is_empty() && exe_str.starts_with(&program_files) {
        return false;
    }
    if !program_files_x86.is_empty() && exe_str.starts_with(&program_files_x86) {
        return false;
    }

    // Not under Program Files — portable mode
    true
}

/// Get the %APPDATA% directory.
fn dirs_appdata() -> PathBuf {
    std::env::var("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            // Fallback using directories crate
            directories::BaseDirs::new()
                .map(|d| d.config_dir().to_path_buf())
                .unwrap_or_else(|| PathBuf::from("."))
        })
}

/// Get the config file path for the given data directory.
pub fn config_path(data_dir: &Path) -> PathBuf {
    data_dir.join("config.json")
}
