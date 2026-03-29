//! Cache cleaner module — scans and removes Windows temp/cache files,
//! browser caches, Windows Update cache, Prefetch, and Recycle Bin.

use std::path::{Path, PathBuf};
use std::time::Instant;

use serde::Serialize;
use tauri::Emitter;

use crate::error::AppError;
use crate::platform::elevation;
use crate::platform::filesystem;

// ---------------------------------------------------------------------------
// Data structures
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct ScanResult {
    pub categories: Vec<CacheCategory>,
    pub total_size_bytes: u64,
    pub scan_duration_ms: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct CacheCategory {
    pub id: String,
    pub name: String,
    pub path: String,
    pub size_bytes: u64,
    pub file_count: u64,
    pub requires_elevation: bool,
    pub browser_running: bool,
    pub locked_files: Vec<String>,
    pub selected: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct CleanResult {
    pub categories_cleaned: Vec<String>,
    pub total_freed_bytes: u64,
    pub files_deleted: u64,
    pub files_skipped: u64,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
    pub duration_ms: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct CleanupProgress {
    pub step: String,
    pub percent: u8,
    pub current_category: String,
}

// ---------------------------------------------------------------------------
// Browser definitions
// ---------------------------------------------------------------------------

struct BrowserDef {
    id: &'static str,
    name: &'static str,
    path_template: &'static str,
    process_name: &'static str,
    is_glob: bool,
}

const BROWSERS: &[BrowserDef] = &[
    BrowserDef {
        id: "chrome",
        name: "Google Chrome",
        path_template: r"%LOCALAPPDATA%\Google\Chrome\User Data\Default\Cache",
        process_name: "chrome.exe",
        is_glob: false,
    },
    BrowserDef {
        id: "edge",
        name: "Microsoft Edge",
        path_template: r"%LOCALAPPDATA%\Microsoft\Edge\User Data\Default\Cache",
        process_name: "msedge.exe",
        is_glob: false,
    },
    BrowserDef {
        id: "opera",
        name: "Opera",
        path_template: r"%APPDATA%\Opera Software\Opera Stable\Cache",
        process_name: "opera.exe",
        is_glob: false,
    },
    BrowserDef {
        id: "firefox",
        name: "Mozilla Firefox",
        path_template: r"%LOCALAPPDATA%\Mozilla\Firefox\Profiles",
        process_name: "firefox.exe",
        is_glob: true, // needs glob for */cache2
    },
];

// ---------------------------------------------------------------------------
// CacheCleaner
// ---------------------------------------------------------------------------

pub struct CacheCleaner {
    elevated: bool,
}

impl CacheCleaner {
    pub fn new() -> Self {
        Self {
            elevated: elevation::is_elevated(),
        }
    }

    /// Scan all cache categories. If `filter` is Some, only scan matching IDs.
    pub async fn scan(
        &self,
        filter: Option<Vec<String>>,
    ) -> Result<ScanResult, AppError> {
        let start = Instant::now();
        let mut categories = Vec::new();

        let should_include = |id: &str| -> bool {
            match &filter {
                Some(ids) => ids.iter().any(|f| f == id),
                None => true,
            }
        };

        // --- Temp files (Story 2.1) ---
        if should_include("user_temp") {
            categories.push(self.scan_user_temp().await);
        }
        if should_include("windows_temp") {
            categories.push(self.scan_windows_temp().await);
        }

        // --- Browser caches (Story 2.2) ---
        let browser_cats = self.scan_browser_caches().await;
        for cat in browser_cats {
            if should_include(&cat.id) {
                categories.push(cat);
            }
        }

        // --- System caches (Story 2.3) ---
        if should_include("windows_update") {
            categories.push(self.scan_windows_update().await);
        }
        if should_include("prefetch") {
            categories.push(self.scan_prefetch().await);
        }
        if should_include("recycle_bin") {
            categories.push(self.scan_recycle_bin().await);
        }

        let total_size_bytes = categories.iter().map(|c| c.size_bytes).sum();
        let scan_duration_ms = start.elapsed().as_millis() as u64;

        tracing::info!(
            categories = categories.len(),
            total_bytes = total_size_bytes,
            duration_ms = scan_duration_ms,
            "Cache scan completed"
        );

        Ok(ScanResult {
            categories,
            total_size_bytes,
            scan_duration_ms,
        })
    }

    /// Clean selected categories. Emits progress events via the app handle.
    pub async fn clean(
        &self,
        app: &tauri::AppHandle,
        category_ids: Vec<String>,
    ) -> Result<CleanResult, AppError> {
        let start = Instant::now();
        let total = category_ids.len();
        let mut result = CleanResult {
            categories_cleaned: Vec::new(),
            total_freed_bytes: 0,
            files_deleted: 0,
            files_skipped: 0,
            warnings: Vec::new(),
            errors: Vec::new(),
            duration_ms: 0,
        };

        for (i, cat_id) in category_ids.iter().enumerate() {
            let percent = if total > 0 {
                ((i as f32 / total as f32) * 100.0) as u8
            } else {
                0
            };

            let _ = app.emit(
                "cleanup-progress",
                CleanupProgress {
                    step: format!("Cleaning {}", cat_id),
                    percent,
                    current_category: cat_id.clone(),
                },
            );

            let clean_result = match cat_id.as_str() {
                "user_temp" => self.clean_category_dir("user_temp", &self.resolve_user_temp()),
                "windows_temp" => {
                    if !self.elevated {
                        result.errors.push("Windows Temp requires admin elevation".into());
                        continue;
                    }
                    self.clean_category_dir("windows_temp", &self.resolve_windows_temp())
                }
                "windows_update" => {
                    if !self.elevated {
                        result.errors.push("Windows Update cache requires admin elevation".into());
                        continue;
                    }
                    // Check if wuauserv is running
                    if is_process_running("svchost.exe") {
                        result.warnings.push(
                            "Windows Update service may be running. Some files might be skipped."
                                .into(),
                        );
                    }
                    self.clean_category_dir("windows_update", &self.resolve_windows_update())
                }
                "prefetch" => {
                    if !self.elevated {
                        result.errors.push("Prefetch requires admin elevation".into());
                        continue;
                    }
                    result.warnings.push(
                        "First boot after Prefetch cleanup may be slower as Windows rebuilds cache."
                            .into(),
                    );
                    self.clean_category_dir("prefetch", &self.resolve_prefetch())
                }
                "recycle_bin" => self.clean_recycle_bin_action(&mut result),
                id if id.starts_with("browser_") => {
                    let browser_id = &id[8..]; // strip "browser_"
                    self.clean_browser(browser_id, &mut result)
                }
                other => {
                    result
                        .errors
                        .push(format!("Unknown category: {}", other));
                    continue;
                }
            };

            if let Some(cr) = clean_result {
                result.total_freed_bytes += cr.freed_bytes;
                result.files_deleted += cr.files_deleted;
                result.files_skipped += cr.files_skipped;
                for e in cr.errors {
                    result.errors.push(e);
                }
                result.categories_cleaned.push(cat_id.clone());
            }
        }

        // Final progress event
        let _ = app.emit(
            "cleanup-progress",
            CleanupProgress {
                step: "Completed".into(),
                percent: 100,
                current_category: String::new(),
            },
        );

        result.duration_ms = start.elapsed().as_millis() as u64;

        tracing::info!(
            freed_bytes = result.total_freed_bytes,
            files_deleted = result.files_deleted,
            files_skipped = result.files_skipped,
            duration_ms = result.duration_ms,
            "Cache clean completed"
        );

        Ok(result)
    }

    // -----------------------------------------------------------------------
    // Scan helpers
    // -----------------------------------------------------------------------

    fn resolve_user_temp(&self) -> PathBuf {
        let temp = filesystem::expand_env_path("%TEMP%");
        PathBuf::from(temp)
    }

    fn resolve_windows_temp(&self) -> PathBuf {
        let windir = filesystem::expand_env_path("%WINDIR%");
        PathBuf::from(windir).join("Temp")
    }

    fn resolve_windows_update(&self) -> PathBuf {
        let windir = filesystem::expand_env_path("%WINDIR%");
        PathBuf::from(windir).join("SoftwareDistribution").join("Download")
    }

    fn resolve_prefetch(&self) -> PathBuf {
        let windir = filesystem::expand_env_path("%WINDIR%");
        PathBuf::from(windir).join("Prefetch")
    }

    async fn scan_user_temp(&self) -> CacheCategory {
        let path = self.resolve_user_temp();
        tracing::info!(path = %path.display(), "Scanning User Temp");

        let scan = tokio::task::spawn_blocking({
            let p = path.clone();
            move || filesystem::scan_dir_with_locks(&p)
        })
        .await
        .unwrap_or_default();

        CacheCategory {
            id: "user_temp".into(),
            name: "User Temp Files".into(),
            path: path.display().to_string(),
            size_bytes: scan.total_bytes,
            file_count: scan.file_count,
            requires_elevation: false,
            browser_running: false,
            locked_files: scan.locked_files,
            selected: true,
        }
    }

    async fn scan_windows_temp(&self) -> CacheCategory {
        let path = self.resolve_windows_temp();
        tracing::info!(path = %path.display(), elevated = self.elevated, "Scanning Windows Temp");

        if !self.elevated {
            return CacheCategory {
                id: "windows_temp".into(),
                name: "Windows Temp Files".into(),
                path: path.display().to_string(),
                size_bytes: 0,
                file_count: 0,
                requires_elevation: true,
                browser_running: false,
                locked_files: vec![],
                selected: false,
            };
        }

        let scan = tokio::task::spawn_blocking({
            let p = path.clone();
            move || filesystem::scan_dir_with_locks(&p)
        })
        .await
        .unwrap_or_default();

        CacheCategory {
            id: "windows_temp".into(),
            name: "Windows Temp Files".into(),
            path: path.display().to_string(),
            size_bytes: scan.total_bytes,
            file_count: scan.file_count,
            requires_elevation: !self.elevated,
            browser_running: false,
            locked_files: scan.locked_files,
            selected: true,
        }
    }

    // --- Browser caches (Story 2.2) ---

    async fn scan_browser_caches(&self) -> Vec<CacheCategory> {
        let mut categories = Vec::new();

        for browser in BROWSERS {
            let cat = if browser.is_glob {
                self.scan_firefox_cache(browser).await
            } else {
                self.scan_standard_browser(browser).await
            };

            if let Some(c) = cat {
                categories.push(c);
            }
        }

        categories
    }

    async fn scan_standard_browser(&self, browser: &BrowserDef) -> Option<CacheCategory> {
        let resolved = filesystem::expand_env_path(browser.path_template);
        let path = PathBuf::from(&resolved);

        if !path.exists() {
            tracing::debug!(browser = browser.id, path = %path.display(), "Browser not installed, skipping");
            return None;
        }

        tracing::info!(browser = browser.id, path = %path.display(), "Scanning browser cache");

        let running = {
            let pname = browser.process_name.to_string();
            is_process_running(&pname)
        };

        let scan = tokio::task::spawn_blocking({
            let p = path.clone();
            move || filesystem::scan_dir(&p)
        })
        .await
        .unwrap_or_default();

        Some(CacheCategory {
            id: format!("browser_{}", browser.id),
            name: format!("{} Cache", browser.name),
            path: path.display().to_string(),
            size_bytes: scan.total_bytes,
            file_count: scan.file_count,
            requires_elevation: false,
            browser_running: running,
            locked_files: vec![],
            selected: true,
        })
    }

    async fn scan_firefox_cache(&self, browser: &BrowserDef) -> Option<CacheCategory> {
        let profiles_dir = filesystem::expand_env_path(browser.path_template);
        let profiles_path = PathBuf::from(&profiles_dir);

        if !profiles_path.exists() {
            tracing::debug!(browser = browser.id, "Firefox profiles dir not found, skipping");
            return None;
        }

        // Enumerate profile directories and sum their cache2/ contents
        let mut total_bytes: u64 = 0;
        let mut total_files: u64 = 0;
        let mut found_any = false;

        let entries = match std::fs::read_dir(&profiles_path) {
            Ok(e) => e,
            Err(_) => return None,
        };

        let mut cache_paths: Vec<PathBuf> = Vec::new();
        for entry in entries.flatten() {
            let cache2 = entry.path().join("cache2");
            if cache2.exists() {
                cache_paths.push(cache2);
                found_any = true;
            }
        }

        if !found_any {
            return None;
        }

        for cache_path in &cache_paths {
            let scan = tokio::task::spawn_blocking({
                let p = cache_path.clone();
                move || filesystem::scan_dir(&p)
            })
            .await
            .unwrap_or_default();

            total_bytes += scan.total_bytes;
            total_files += scan.file_count;
        }

        let running = is_process_running(browser.process_name);

        tracing::info!(
            browser = browser.id,
            profiles = cache_paths.len(),
            total_bytes = total_bytes,
            "Firefox cache scan complete"
        );

        Some(CacheCategory {
            id: format!("browser_{}", browser.id),
            name: format!("{} Cache", browser.name),
            path: profiles_path.display().to_string(),
            size_bytes: total_bytes,
            file_count: total_files,
            requires_elevation: false,
            browser_running: running,
            locked_files: vec![],
            selected: true,
        })
    }

    // --- System caches (Story 2.3) ---

    async fn scan_windows_update(&self) -> CacheCategory {
        let path = self.resolve_windows_update();
        tracing::info!(path = %path.display(), "Scanning Windows Update cache");

        if !self.elevated {
            return CacheCategory {
                id: "windows_update".into(),
                name: "Windows Update Cache".into(),
                path: path.display().to_string(),
                size_bytes: 0,
                file_count: 0,
                requires_elevation: true,
                browser_running: false,
                locked_files: vec![],
                selected: false,
            };
        }

        let scan = tokio::task::spawn_blocking({
            let p = path.clone();
            move || filesystem::scan_dir(&p)
        })
        .await
        .unwrap_or_default();

        CacheCategory {
            id: "windows_update".into(),
            name: "Windows Update Cache".into(),
            path: path.display().to_string(),
            size_bytes: scan.total_bytes,
            file_count: scan.file_count,
            requires_elevation: !self.elevated,
            browser_running: false,
            locked_files: vec![],
            selected: true,
        }
    }

    async fn scan_prefetch(&self) -> CacheCategory {
        let path = self.resolve_prefetch();
        tracing::info!(path = %path.display(), "Scanning Prefetch");

        if !self.elevated {
            return CacheCategory {
                id: "prefetch".into(),
                name: "Prefetch Cache".into(),
                path: path.display().to_string(),
                size_bytes: 0,
                file_count: 0,
                requires_elevation: true,
                browser_running: false,
                locked_files: vec![],
                selected: false,
            };
        }

        let scan = tokio::task::spawn_blocking({
            let p = path.clone();
            move || filesystem::scan_dir(&p)
        })
        .await
        .unwrap_or_default();

        CacheCategory {
            id: "prefetch".into(),
            name: "Prefetch Cache".into(),
            path: path.display().to_string(),
            size_bytes: scan.total_bytes,
            file_count: scan.file_count,
            requires_elevation: !self.elevated,
            browser_running: false,
            locked_files: vec![],
            selected: true,
        }
    }

    async fn scan_recycle_bin(&self) -> CacheCategory {
        tracing::info!("Scanning Recycle Bin");

        let size = tokio::task::spawn_blocking(get_recycle_bin_size)
            .await
            .unwrap_or(0);

        CacheCategory {
            id: "recycle_bin".into(),
            name: "Recycle Bin".into(),
            path: "Recycle Bin".into(),
            size_bytes: size,
            file_count: 0, // Shell API doesn't give us file count easily
            requires_elevation: false,
            browser_running: false,
            locked_files: vec![],
            selected: true,
        }
    }

    // -----------------------------------------------------------------------
    // Clean helpers
    // -----------------------------------------------------------------------

    fn clean_category_dir(
        &self,
        _cat_id: &str,
        path: &Path,
    ) -> Option<filesystem::DirCleanResult> {
        if !path.exists() {
            return Some(filesystem::DirCleanResult::default());
        }
        Some(filesystem::safe_delete_dir_contents(path))
    }

    fn clean_browser(&self, browser_id: &str, result: &mut CleanResult) -> Option<filesystem::DirCleanResult> {
        let browser = BROWSERS.iter().find(|b| b.id == browser_id)?;

        if browser.is_glob {
            // Firefox — clean each profile's cache2
            return self.clean_firefox_cache(browser, result);
        }

        let resolved = filesystem::expand_env_path(browser.path_template);
        let path = PathBuf::from(&resolved);

        if !path.exists() {
            return Some(filesystem::DirCleanResult::default());
        }

        if is_process_running(browser.process_name) {
            result.warnings.push(format!(
                "{} is running. Some cache files may be skipped.",
                browser.name
            ));
        }

        Some(filesystem::safe_delete_dir_contents(&path))
    }

    fn clean_firefox_cache(
        &self,
        browser: &BrowserDef,
        result: &mut CleanResult,
    ) -> Option<filesystem::DirCleanResult> {
        let profiles_dir = filesystem::expand_env_path(browser.path_template);
        let profiles_path = PathBuf::from(&profiles_dir);

        if !profiles_path.exists() {
            return Some(filesystem::DirCleanResult::default());
        }

        if is_process_running(browser.process_name) {
            result.warnings.push(format!(
                "{} is running. Some cache files may be skipped.",
                browser.name
            ));
        }

        let mut combined = filesystem::DirCleanResult::default();

        if let Ok(entries) = std::fs::read_dir(&profiles_path) {
            for entry in entries.flatten() {
                let cache2 = entry.path().join("cache2");
                if cache2.exists() {
                    let cr = filesystem::safe_delete_dir_contents(&cache2);
                    combined.freed_bytes += cr.freed_bytes;
                    combined.files_deleted += cr.files_deleted;
                    combined.files_skipped += cr.files_skipped;
                    combined.errors.extend(cr.errors);
                }
            }
        }

        Some(combined)
    }

    fn clean_recycle_bin_action(
        &self,
        _result: &mut CleanResult,
    ) -> Option<filesystem::DirCleanResult> {
        let emptied = empty_recycle_bin();
        if !emptied {
            tracing::warn!("Failed to empty recycle bin");
        }
        // We can't know exact bytes freed from the shell API after the fact,
        // so report 0 — the scan will show the difference on next run
        Some(filesystem::DirCleanResult::default())
    }
}

impl Default for CacheCleaner {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// Process detection (shared utility)
// ---------------------------------------------------------------------------

fn is_process_running(name: &str) -> bool {
    use sysinfo::System;
    let mut sys = System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    let name_lower = name.to_lowercase();
    sys.processes().values().any(|p| {
        p.name()
            .to_str()
            .map(|n| n.to_lowercase() == name_lower)
            .unwrap_or(false)
    })
}

// ---------------------------------------------------------------------------
// Recycle Bin Shell API
// ---------------------------------------------------------------------------

#[cfg(windows)]
fn get_recycle_bin_size() -> u64 {
    use windows::Win32::UI::Shell::{SHQueryRecycleBinW, SHQUERYRBINFO};

    unsafe {
        let mut info = SHQUERYRBINFO {
            cbSize: std::mem::size_of::<SHQUERYRBINFO>() as u32,
            ..Default::default()
        };
        match SHQueryRecycleBinW(None, &mut info) {
            Ok(()) => info.i64Size as u64,
            Err(e) => {
                tracing::warn!(error = %e, "SHQueryRecycleBinW failed");
                0
            }
        }
    }
}

#[cfg(not(windows))]
fn get_recycle_bin_size() -> u64 {
    0
}

#[cfg(windows)]
fn empty_recycle_bin() -> bool {
    use windows::Win32::UI::Shell::{SHEmptyRecycleBinW, SHERB_NOCONFIRMATION, SHERB_NOSOUND, SHERB_NOPROGRESSUI};

    unsafe {
        let flags = SHERB_NOCONFIRMATION | SHERB_NOSOUND | SHERB_NOPROGRESSUI;
        SHEmptyRecycleBinW(None, None, flags).is_ok()
    }
}

#[cfg(not(windows))]
fn empty_recycle_bin() -> bool {
    false
}
