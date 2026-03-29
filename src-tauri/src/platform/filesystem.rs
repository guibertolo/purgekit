//! Filesystem utilities for scanning directories, calculating sizes,
//! detecting locked files, and safely deleting file contents.

use std::path::{Path, PathBuf};
use walkdir::WalkDir;

use crate::error::AppError;

/// Result of scanning a directory.
#[derive(Debug, Clone, Default)]
pub struct DirScanResult {
    pub total_bytes: u64,
    pub file_count: u64,
    pub locked_files: Vec<String>,
}

/// Result of cleaning a directory.
#[derive(Debug, Clone, Default)]
pub struct DirCleanResult {
    pub freed_bytes: u64,
    pub files_deleted: u64,
    pub files_skipped: u64,
    pub errors: Vec<String>,
}

/// Expand Windows environment variables in a path string.
/// Supports `%TEMP%`, `%WINDIR%`, `%LOCALAPPDATA%`, `%APPDATA%`, etc.
pub fn expand_env_path(path: &str) -> String {
    let mut result = path.to_string();
    // Find all %VAR% patterns and replace them
    while let Some(start) = result.find('%') {
        if let Some(end) = result[start + 1..].find('%') {
            let var_name = &result[start + 1..start + 1 + end];
            if let Ok(value) = std::env::var(var_name) {
                result = format!("{}{}{}", &result[..start], value, &result[start + 2 + end..]);
            } else {
                // Can't resolve, break to avoid infinite loop
                break;
            }
        } else {
            break;
        }
    }
    result
}

/// Scan a directory recursively, calculating total size and file count.
/// Ignores permission errors gracefully.
/// Uses iterator-based approach to avoid loading all entries into memory.
pub fn scan_dir(path: &Path) -> DirScanResult {
    let mut result = DirScanResult::default();

    if !path.exists() {
        return result;
    }

    for entry in WalkDir::new(path)
        .min_depth(1)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() {
            match entry.metadata() {
                Ok(meta) => {
                    result.total_bytes += meta.len();
                    result.file_count += 1;
                }
                Err(_) => {
                    // Permission denied or other error — skip silently
                }
            }
        }
    }

    result
}

/// Calculate total size and file count of a directory.
pub fn calc_dir_size(path: &Path) -> (u64, u64) {
    let result = scan_dir(path);
    (result.total_bytes, result.file_count)
}

/// Detect locked files in a directory by attempting exclusive write access.
/// Returns a list of paths that could not be opened exclusively.
pub fn detect_locked_files(path: &Path) -> Vec<String> {
    let mut locked = Vec::new();

    if !path.exists() {
        return locked;
    }

    for entry in WalkDir::new(path)
        .min_depth(1)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() {
            let file_path = entry.path();
            // Try to open with write access — if it fails, the file is locked
            match std::fs::OpenOptions::new()
                .write(true)
                .open(file_path)
            {
                Ok(_) => {} // File is not locked
                Err(_) => {
                    locked.push(file_path.display().to_string());
                }
            }
        }
    }

    locked
}

/// Scan a directory with locked file detection.
pub fn scan_dir_with_locks(path: &Path) -> DirScanResult {
    let mut result = scan_dir(path);
    result.locked_files = detect_locked_files(path);
    result
}

/// Safely delete all contents of a directory without deleting the directory itself.
/// Skips locked files and logs each operation.
/// Returns a summary of the operation.
pub fn safe_delete_dir_contents(path: &Path) -> DirCleanResult {
    let mut result = DirCleanResult::default();

    if !path.exists() {
        return result;
    }

    // Collect files first (iterator approach — we process one at a time)
    for entry in WalkDir::new(path)
        .min_depth(1)
        .contents_first(true) // Process files before their parent dirs
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let entry_path = entry.path();

        if entry.file_type().is_file() {
            let file_size = entry.metadata().map(|m| m.len()).unwrap_or(0);

            match std::fs::remove_file(entry_path) {
                Ok(()) => {
                    result.freed_bytes += file_size;
                    result.files_deleted += 1;
                    tracing::info!(
                        module = "cache_cleaner",
                        action = "delete",
                        result = "OK",
                        path = %entry_path.display(),
                        bytes = file_size,
                        "File deleted"
                    );
                }
                Err(e) => {
                    result.files_skipped += 1;
                    tracing::debug!(
                        module = "cache_cleaner",
                        action = "delete",
                        result = "SKIP",
                        path = %entry_path.display(),
                        error = %e,
                        "File skipped (in use or permission denied)"
                    );
                }
            }
        } else if entry.file_type().is_dir() {
            // Try to remove empty directories, ignore errors
            let _ = std::fs::remove_dir(entry_path);
        }
    }

    result
}

/// Validate that a path is within expected boundaries.
/// Prevents path traversal attacks.
pub fn validate_path_within(path: &Path, allowed_root: &Path) -> Result<PathBuf, AppError> {
    let canonical = path.canonicalize().map_err(|e| {
        AppError::Io(format!(
            "Cannot canonicalize path {}: {}",
            path.display(),
            e
        ))
    })?;
    let root_canonical = allowed_root.canonicalize().map_err(|e| {
        AppError::Io(format!(
            "Cannot canonicalize root {}: {}",
            allowed_root.display(),
            e
        ))
    })?;

    if canonical.starts_with(&root_canonical) {
        Ok(canonical)
    } else {
        Err(AppError::Platform(format!(
            "Path {} is outside allowed root {}",
            canonical.display(),
            root_canonical.display()
        )))
    }
}
