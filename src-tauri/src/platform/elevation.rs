//! UAC elevation detection and re-launch logic for Windows.
//!
//! Uses Win32 APIs to check whether the current process holds an elevated
//! token and, when requested, re-launches the executable via `ShellExecuteW`
//! with the `runas` verb so that Windows displays the UAC consent dialog.

use crate::error::AppError;

/// Check if the current process is running with administrator privileges.
///
/// Queries the process token for `TOKEN_ELEVATION` information. Returns
/// `false` on any API failure so the app gracefully falls back to
/// non-elevated mode.
#[cfg(windows)]
pub fn is_elevated() -> bool {
    use windows::Win32::Security::{
        GetTokenInformation, TOKEN_ELEVATION, TOKEN_QUERY, TokenElevation,
    };
    use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

    unsafe {
        let mut token = Default::default();
        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token).is_err() {
            tracing::warn!("OpenProcessToken failed — assuming not elevated");
            return false;
        }

        let mut elevation = TOKEN_ELEVATION::default();
        let mut return_length: u32 = 0;
        let size = std::mem::size_of::<TOKEN_ELEVATION>() as u32;

        let ok = GetTokenInformation(
            token,
            TokenElevation,
            Some(&mut elevation as *mut _ as *mut _),
            size,
            &mut return_length,
        );

        ok.is_ok() && elevation.TokenIsElevated != 0
    }
}

#[cfg(not(windows))]
pub fn is_elevated() -> bool {
    false
}

/// Re-launch the current executable with elevated privileges via UAC.
///
/// Saves no state itself — the caller is responsible for persisting session
/// state before invoking this function. On success this function does **not**
/// return because the current (non-elevated) process should exit.
#[cfg(windows)]
pub fn relaunch_elevated(args: &str) -> Result<(), AppError> {
    use std::os::windows::ffi::OsStrExt;
    use windows::Win32::UI::Shell::ShellExecuteW;
    use windows::core::PCWSTR;

    let exe_path = std::env::current_exe().map_err(|e| {
        AppError::Platform(format!("Failed to resolve executable path: {}", e))
    })?;

    // Convert strings to wide (UTF-16) null-terminated for Win32
    let verb: Vec<u16> = std::ffi::OsStr::new("runas")
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let file: Vec<u16> = exe_path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let params: Vec<u16> = std::ffi::OsStr::new(args)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    tracing::info!(
        "Re-launching elevated: exe={} args={}",
        exe_path.display(),
        args
    );

    let result = unsafe {
        ShellExecuteW(
            None,
            PCWSTR(verb.as_ptr()),
            PCWSTR(file.as_ptr()),
            PCWSTR(params.as_ptr()),
            PCWSTR::null(),
            windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL,
        )
    };

    // ShellExecuteW returns an HINSTANCE; values > 32 indicate success
    let code = result.0 as isize;
    if code > 32 {
        tracing::info!("ShellExecuteW succeeded (code={}), exiting current process", code);
        // Exit the current (non-elevated) instance
        std::process::exit(0);
    } else {
        tracing::error!("ShellExecuteW failed with code {}", code);
        Err(AppError::Platform(format!(
            "UAC elevation failed (ShellExecuteW returned {})",
            code
        )))
    }
}

#[cfg(not(windows))]
pub fn relaunch_elevated(_args: &str) -> Result<(), AppError> {
    Err(AppError::Platform(
        "UAC elevation is only supported on Windows".to_string(),
    ))
}
