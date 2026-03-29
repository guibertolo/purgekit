//! WMI (Windows Management Instrumentation) client for GPU and system queries.
//!
//! Uses the `wmi` crate to query Win32_VideoController for GPU information
//! on AMD, Intel, and as fallback for NVIDIA when NVML is unavailable.

use serde::Deserialize;

use crate::error::AppError;

/// WMI client holding a reusable connection.
pub struct WmiClient {
    connection: wmi::WMIConnection,
}

/// Raw GPU information from WMI Win32_VideoController.
#[derive(Debug, Clone, Deserialize)]
pub struct WmiGpuInfo {
    #[serde(rename = "Name")]
    pub name: String,
    #[serde(rename = "DriverVersion")]
    pub driver_version: Option<String>,
    #[serde(rename = "AdapterRAM")]
    pub adapter_ram: Option<u32>,
    #[serde(rename = "VideoProcessor")]
    pub video_processor: Option<String>,
}

impl WmiClient {
    /// Create a new WMI connection. Should be called once at app startup.
    pub fn new() -> Result<Self, AppError> {
        let com = wmi::COMLibrary::new()
            .map_err(|e| AppError::Platform(format!("COM initialization failed: {}", e)))?;
        let connection = wmi::WMIConnection::new(com)
            .map_err(|e| AppError::Platform(format!("WMI connection failed: {}", e)))?;
        tracing::info!("WMI client initialized successfully");
        Ok(WmiClient { connection })
    }

    /// Query Win32_VideoController for all GPU information.
    pub fn query_gpu_info(&self) -> Result<Vec<WmiGpuInfo>, AppError> {
        let results: Vec<WmiGpuInfo> = self
            .connection
            .raw_query("SELECT Name, DriverVersion, AdapterRAM, VideoProcessor FROM Win32_VideoController")
            .map_err(|e| AppError::Platform(format!("WMI GPU query failed: {}", e)))?;

        tracing::info!("WMI found {} video controller(s)", results.len());
        for gpu in &results {
            tracing::debug!(
                "WMI GPU: {} | Driver: {:?} | VRAM: {:?}",
                gpu.name,
                gpu.driver_version,
                gpu.adapter_ram
            );
        }
        Ok(results)
    }

    /// Query WMI for temperature sensor data (stub for future use).
    pub fn query_temperatures(&self) -> Result<Vec<f64>, AppError> {
        tracing::debug!("WMI temperature query (not implemented for GPU yet)");
        Ok(vec![])
    }
}

// WmiClient is NOT Send because COM is thread-affine.
// It must be accessed via Mutex in AppState.
