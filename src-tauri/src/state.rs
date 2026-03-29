use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use crate::config::AppConfig;
use crate::platform::nvml::NvmlHandle;

/// Shared application state managed by Tauri.
///
/// Note: WMI client is NOT stored here because WMIConnection is not Send.
/// Instead, WMI connections are created per-call in the commands that need them.
/// The cost is negligible since COM init + WMI connect takes < 5ms.
pub struct AppState {
    /// Current application configuration (thread-safe).
    pub config: Mutex<AppConfig>,
    /// Resolved data directory (logs, config, etc.).
    pub data_dir: PathBuf,
    /// NVML handle for NVIDIA GPU queries. Initialized once at startup.
    pub nvml: Arc<NvmlHandle>,
}

impl AppState {
    pub fn new(config: AppConfig, data_dir: PathBuf) -> Self {
        // Initialize NVML (graceful — never crashes)
        let nvml = Arc::new(NvmlHandle::init());

        Self {
            config: Mutex::new(config),
            data_dir,
            nvml,
        }
    }
}
