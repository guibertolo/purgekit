//! Windows Registry access for Gaming Mode.
//!
//! Provides functions to disable/restore Game DVR and Xbox Game Bar settings.

use crate::error::AppError;
use crate::state::gaming_snapshot::RegistrySnapshot;

/// Disable Game DVR and Xbox Game Bar by modifying Registry values.
/// Returns snapshots of the original values for later restoration.
#[cfg(windows)]
pub fn disable_game_dvr() -> Result<Vec<RegistrySnapshot>, AppError> {
    use winreg::enums::{HKEY_CURRENT_USER, KEY_READ, KEY_WRITE};
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let mut snapshots = Vec::new();

    // 1. AppCaptureEnabled in GameDVR
    match hkcu.open_subkey_with_flags(
        r"SOFTWARE\Microsoft\Windows\CurrentVersion\GameDVR",
        KEY_READ | KEY_WRITE,
    ) {
        Ok(key) => {
            let original: u32 = key.get_value("AppCaptureEnabled").unwrap_or(1);
            snapshots.push(RegistrySnapshot {
                hive: "HKCU".into(),
                path: r"SOFTWARE\Microsoft\Windows\CurrentVersion\GameDVR".into(),
                value_name: "AppCaptureEnabled".into(),
                original_value: original.to_string(),
                original_type: "DWORD".into(),
            });

            if let Err(e) = key.set_value("AppCaptureEnabled", &0u32) {
                tracing::warn!("Failed to set AppCaptureEnabled=0: {}", e);
            } else {
                tracing::info!("Game DVR AppCaptureEnabled set to 0 (was {})", original);
            }
        }
        Err(e) => {
            tracing::warn!(
                "Could not open GameDVR registry key: {}. Game DVR may not be installed.",
                e
            );
        }
    }

    // 2. GameDVR_Enabled in GameConfigStore
    match hkcu.open_subkey_with_flags(
        r"System\GameConfigStore",
        KEY_READ | KEY_WRITE,
    ) {
        Ok(key) => {
            let original: u32 = key.get_value("GameDVR_Enabled").unwrap_or(1);
            snapshots.push(RegistrySnapshot {
                hive: "HKCU".into(),
                path: r"System\GameConfigStore".into(),
                value_name: "GameDVR_Enabled".into(),
                original_value: original.to_string(),
                original_type: "DWORD".into(),
            });

            if let Err(e) = key.set_value("GameDVR_Enabled", &0u32) {
                tracing::warn!("Failed to set GameDVR_Enabled=0: {}", e);
            } else {
                tracing::info!("GameConfigStore GameDVR_Enabled set to 0 (was {})", original);
            }
        }
        Err(e) => {
            tracing::warn!(
                "Could not open GameConfigStore registry key: {}. GameDVR may not be installed.",
                e
            );
        }
    }

    Ok(snapshots)
}

#[cfg(not(windows))]
pub fn disable_game_dvr() -> Result<Vec<RegistrySnapshot>, AppError> {
    tracing::warn!("Game DVR disable not supported on this platform");
    Ok(Vec::new())
}

/// Restore Registry values from snapshots.
#[cfg(windows)]
pub fn restore_registry_entries(snapshots: &[RegistrySnapshot]) -> Result<(), AppError> {
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_WRITE};
    use winreg::RegKey;

    for snapshot in snapshots {
        let hive = match snapshot.hive.as_str() {
            "HKCU" => RegKey::predef(HKEY_CURRENT_USER),
            "HKLM" => RegKey::predef(HKEY_LOCAL_MACHINE),
            other => {
                tracing::warn!("Unknown registry hive: {}", other);
                continue;
            }
        };

        match hive.open_subkey_with_flags(&snapshot.path, KEY_WRITE) {
            Ok(key) => {
                if snapshot.original_type == "DWORD" {
                    let value: u32 = snapshot.original_value.parse().unwrap_or(1);
                    if let Err(e) = key.set_value(&snapshot.value_name, &value) {
                        tracing::warn!(
                            "Failed to restore {}\\{}\\{}: {}",
                            snapshot.hive,
                            snapshot.path,
                            snapshot.value_name,
                            e
                        );
                    } else {
                        tracing::info!(
                            "Restored {}\\{}\\{} = {}",
                            snapshot.hive,
                            snapshot.path,
                            snapshot.value_name,
                            value
                        );
                    }
                } else {
                    tracing::warn!(
                        "Unsupported registry type '{}' for restore",
                        snapshot.original_type
                    );
                }
            }
            Err(e) => {
                tracing::warn!(
                    "Failed to open {}\\{} for restore: {}",
                    snapshot.hive,
                    snapshot.path,
                    e
                );
            }
        }
    }

    Ok(())
}

#[cfg(not(windows))]
pub fn restore_registry_entries(_snapshots: &[RegistrySnapshot]) -> Result<(), AppError> {
    tracing::warn!("Registry restore not supported on this platform");
    Ok(())
}
