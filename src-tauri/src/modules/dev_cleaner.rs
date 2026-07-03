//! Developer tools cache cleaner — detects dev tools, scans node_modules,
//! scans/cleans JS package manager caches, language caches, Docker, and WSL2.

use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde::Serialize;
use walkdir::WalkDir;

use crate::error::AppError;
use crate::platform::filesystem;

// ---------------------------------------------------------------------------
// Windows-specific: hide console window for spawned processes
// ---------------------------------------------------------------------------

#[cfg(windows)]
fn new_cmd(program: &str) -> Command {
    use std::os::windows::process::CommandExt as _;
    let mut cmd = Command::new(program);
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    cmd
}

#[cfg(not(windows))]
fn new_cmd(program: &str) -> Command {
    Command::new(program)
}

// ---------------------------------------------------------------------------
// Data structures (Story 9.1)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct DevToolInfo {
    pub id: String,
    pub name: String,
    pub detected: bool,
    pub version: Option<String>,
    pub cache_paths: Vec<String>,
}

// ---------------------------------------------------------------------------
// Data structures (Story 9.2)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub enum NodeModulesStatus {
    Active,
    Inactive { days_old: u32 },
    Orphan,
}

#[derive(Debug, Clone, Serialize)]
pub struct NodeModulesEntry {
    pub path: String,
    pub parent_path: String,
    pub size_bytes: u64,
    pub last_modified: i64,
    pub has_package_json: bool,
    pub status: NodeModulesStatus,
    pub selected: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct DevScanProgress {
    pub scanned_dirs: u32,
    pub found_count: u32,
}

// ---------------------------------------------------------------------------
// Data structures (Story 9.3 + 9.4)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct DevCacheCategory {
    pub id: String,
    pub tool: String,
    pub name: String,
    pub paths: Vec<String>,
    pub size_bytes: u64,
    pub available: bool,
    pub requires_docker_running: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct DevCleanResult {
    pub tool: String,
    pub freed_bytes: u64,
    pub items_removed: u64,
    pub command_output: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DockerPruneResult {
    pub success: bool,
    pub output: String,
    pub freed_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct Wsl2DistroInfo {
    pub name: String,
    pub vhdx_path: String,
    pub vhdx_size_bytes: u64,
    pub status: String,
}

// ---------------------------------------------------------------------------
// Tool Detection (Story 9.1)
// ---------------------------------------------------------------------------

/// Try to get version string from an executable.
fn detect_tool_version(executable: &str, args: &[&str]) -> Option<String> {
    let output = new_cmd(executable)
        .args(args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let s = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if s.is_empty() {
        let se = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if se.is_empty() {
            None
        } else {
            Some(se.lines().next().unwrap_or("").to_string())
        }
    } else {
        Some(s.lines().next().unwrap_or("").to_string())
    }
}

/// Check if an executable is in PATH via `where` (Windows).
fn is_in_path(executable: &str) -> bool {
    new_cmd("where")
        .arg(executable)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

fn expand(path_template: &str) -> String {
    filesystem::expand_env_path(path_template)
}

fn path_exists(path_template: &str) -> bool {
    Path::new(&expand(path_template)).exists()
}

fn detect_nodejs() -> DevToolInfo {
    let version = detect_tool_version("node", &["--version"]);
    DevToolInfo {
        id: "nodejs".into(),
        name: "Node.js".into(),
        detected: version.is_some(),
        version,
        cache_paths: vec![],
    }
}

fn detect_npm() -> DevToolInfo {
    let version = detect_tool_version("npm", &["--version"]);
    DevToolInfo {
        id: "npm".into(),
        name: "npm".into(),
        detected: version.is_some() || is_in_path("npm.cmd"),
        version,
        cache_paths: vec![r"%APPDATA%\npm-cache".into()],
    }
}

fn detect_pnpm() -> DevToolInfo {
    let detected = path_exists(r"%LOCALAPPDATA%\pnpm") || is_in_path("pnpm.cmd");
    let version = if detected {
        detect_tool_version("pnpm", &["--version"])
    } else {
        None
    };
    DevToolInfo {
        id: "pnpm".into(),
        name: "pnpm".into(),
        detected,
        version,
        cache_paths: vec![
            r"%LOCALAPPDATA%\pnpm-store".into(),
            r"%LOCALAPPDATA%\pnpm\store".into(),
        ],
    }
}

fn detect_yarn() -> DevToolInfo {
    let detected = path_exists(r"%LOCALAPPDATA%\Yarn") || is_in_path("yarn.cmd");
    let version = if detected {
        detect_tool_version("yarn", &["--version"])
    } else {
        None
    };
    DevToolInfo {
        id: "yarn".into(),
        name: "Yarn".into(),
        detected,
        version,
        cache_paths: vec![r"%LOCALAPPDATA%\Yarn\Cache".into()],
    }
}

fn detect_python() -> DevToolInfo {
    let version = detect_tool_version("python", &["--version"])
        .or_else(|| detect_tool_version("python3", &["--version"]));
    DevToolInfo {
        id: "python".into(),
        name: "Python".into(),
        detected: version.is_some(),
        version,
        cache_paths: vec![r"%LOCALAPPDATA%\pip\Cache".into()],
    }
}

fn detect_rust_cargo() -> DevToolInfo {
    let cargo_path = expand(r"%USERPROFILE%\.cargo\bin\cargo.exe");
    let detected = Path::new(&cargo_path).exists();
    let version = if detected {
        detect_tool_version(&cargo_path, &["--version"])
    } else {
        None
    };
    DevToolInfo {
        id: "cargo".into(),
        name: "Rust (cargo)".into(),
        detected,
        version,
        cache_paths: vec![
            r"%USERPROFILE%\.cargo\registry\cache".into(),
            r"%USERPROFILE%\.cargo\registry\src".into(),
        ],
    }
}

fn detect_go() -> DevToolInfo {
    let detected = is_in_path("go.exe") || path_exists(r"%USERPROFILE%\go");
    let version = if detected {
        detect_tool_version("go", &["version"])
    } else {
        None
    };
    DevToolInfo {
        id: "go".into(),
        name: "Go".into(),
        detected,
        version,
        cache_paths: vec![r"%USERPROFILE%\go\pkg\mod".into()],
    }
}

fn detect_docker() -> DevToolInfo {
    let detected = is_in_path("docker.exe");
    let version = if detected {
        detect_tool_version("docker", &["--version"])
    } else {
        None
    };
    DevToolInfo {
        id: "docker".into(),
        name: "Docker".into(),
        detected,
        version,
        cache_paths: vec![],
    }
}

fn detect_wsl2() -> DevToolInfo {
    let windir = expand(r"%WINDIR%");
    let wsl_path = PathBuf::from(&windir).join("System32").join("wsl.exe");
    let detected = wsl_path.exists();
    DevToolInfo {
        id: "wsl2".into(),
        name: "WSL2".into(),
        detected,
        version: None,
        cache_paths: vec![],
    }
}

fn detect_maven() -> DevToolInfo {
    let detected =
        is_in_path("mvn.cmd") || is_in_path("mvn") || path_exists(r"%USERPROFILE%\.m2\repository");
    let version = if detected {
        detect_tool_version("mvn", &["--version"])
    } else {
        None
    };
    DevToolInfo {
        id: "maven".into(),
        name: "Maven".into(),
        detected,
        version,
        cache_paths: vec![r"%USERPROFILE%\.m2\repository".into()],
    }
}

fn detect_gradle() -> DevToolInfo {
    let detected = is_in_path("gradle")
        || is_in_path("gradle.bat")
        || path_exists(r"%USERPROFILE%\.gradle\caches");
    let version = if detected {
        detect_tool_version("gradle", &["--version"])
    } else {
        None
    };
    DevToolInfo {
        id: "gradle".into(),
        name: "Gradle".into(),
        detected,
        version,
        cache_paths: vec![r"%USERPROFILE%\.gradle\caches".into()],
    }
}

/// Detect all dev tools.
pub fn detect_all_dev_tools() -> Vec<DevToolInfo> {
    let start = Instant::now();
    let tools = vec![
        detect_nodejs(),
        detect_npm(),
        detect_pnpm(),
        detect_yarn(),
        detect_python(),
        detect_rust_cargo(),
        detect_go(),
        detect_docker(),
        detect_wsl2(),
        detect_maven(),
        detect_gradle(),
    ];
    tracing::info!(
        count = tools.len(),
        detected = tools.iter().filter(|t| t.detected).count(),
        elapsed_ms = start.elapsed().as_millis() as u64,
        "Dev tools detection complete"
    );
    tools
}

// ---------------------------------------------------------------------------
// node_modules scan (Story 9.2)
// ---------------------------------------------------------------------------

fn get_dir_last_modified(path: &Path) -> i64 {
    let parent = path.parent();
    let check_path = if let Some(p) = parent {
        let pkg = p.join("package.json");
        if pkg.exists() {
            pkg
        } else {
            path.to_path_buf()
        }
    } else {
        path.to_path_buf()
    };

    std::fs::metadata(&check_path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// Scan for node_modules directories.
pub fn scan_node_modules(
    scan_dirs: &[String],
    inactive_threshold_days: u32,
    cancel: &Arc<AtomicBool>,
    progress_callback: &dyn Fn(DevScanProgress),
) -> Vec<NodeModulesEntry> {
    let threshold_secs = inactive_threshold_days as u64 * 86400;
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::ZERO)
        .as_secs();

    let mut results = Vec::new();
    let mut scanned_dirs: u32 = 0;
    let mut found_count: u32 = 0;

    for base_dir in scan_dirs {
        let expanded = expand(base_dir);
        let base = Path::new(&expanded);
        if !base.exists() {
            continue;
        }

        for entry in WalkDir::new(base)
            .max_depth(10)
            .into_iter()
            .filter_entry(|e| {
                let name = e.file_name().to_str().unwrap_or("");
                // Skip hidden dirs (except base) and don't recurse into node_modules
                if e.depth() > 0 && name == "node_modules" {
                    return false;
                }
                if e.depth() > 0 && name.starts_with('.') {
                    return false;
                }
                e.file_type().is_dir()
            })
        {
            if cancel.load(Ordering::Relaxed) {
                tracing::info!("node_modules scan cancelled");
                return results;
            }

            let entry = match entry {
                Ok(e) => e,
                Err(_) => continue,
            };

            scanned_dirs += 1;

            // Check if this directory contains a node_modules child
            let nm_path = entry.path().join("node_modules");
            if nm_path.is_dir() {
                let parent = entry.path();
                let has_pkg_json = parent.join("package.json").exists();
                let (size, _) = filesystem::calc_dir_size(&nm_path);
                let last_mod = get_dir_last_modified(&nm_path);
                let last_mod_secs = if last_mod > 0 { last_mod as u64 } else { 0 };

                let status = if !has_pkg_json {
                    NodeModulesStatus::Orphan
                } else if last_mod_secs > 0 && (now - last_mod_secs) > threshold_secs {
                    NodeModulesStatus::Inactive {
                        days_old: ((now - last_mod_secs) / 86400) as u32,
                    }
                } else {
                    NodeModulesStatus::Active
                };

                let selected = !matches!(status, NodeModulesStatus::Active);
                found_count += 1;

                results.push(NodeModulesEntry {
                    path: nm_path.display().to_string(),
                    parent_path: parent.display().to_string(),
                    size_bytes: size,
                    last_modified: last_mod,
                    has_package_json: has_pkg_json,
                    status,
                    selected,
                });

                progress_callback(DevScanProgress {
                    scanned_dirs,
                    found_count,
                });
            }
        }
    }

    tracing::info!(found = results.len(), scanned = scanned_dirs, "node_modules scan complete");
    results
}

// ---------------------------------------------------------------------------
// JS package manager caches (Story 9.3)
// ---------------------------------------------------------------------------

const JS_CACHE_PATHS: &[(&str, &str, &str)] = &[
    ("npm", "npm cache", r"%APPDATA%\npm-cache"),
    ("yarn", "Yarn cache", r"%LOCALAPPDATA%\Yarn\Cache"),
    ("pnpm", "pnpm store", r"%LOCALAPPDATA%\pnpm-store"),
    ("pnpm", "pnpm store v2", r"%LOCALAPPDATA%\pnpm\store"),
];

pub fn scan_js_caches(detected_tools: &[DevToolInfo]) -> Vec<DevCacheCategory> {
    let detected_ids: Vec<&str> = detected_tools
        .iter()
        .filter(|t| t.detected)
        .map(|t| t.id.as_str())
        .collect();

    let mut categories = Vec::new();

    for (tool_id, tool_name) in &[("npm", "npm"), ("yarn", "Yarn"), ("pnpm", "pnpm")] {
        let available = detected_ids.contains(tool_id);
        let mut paths = Vec::new();
        let mut total_size: u64 = 0;

        for (id, _name, path_template) in JS_CACHE_PATHS {
            if *id != *tool_id {
                continue;
            }
            let resolved = expand(path_template);
            let p = Path::new(&resolved);
            if p.exists() && available {
                let (size, _) = filesystem::calc_dir_size(p);
                total_size += size;
            }
            paths.push(resolved);
        }

        categories.push(DevCacheCategory {
            id: format!("js_{}", tool_id),
            tool: tool_id.to_string(),
            name: format!("{} cache", tool_name),
            paths,
            size_bytes: total_size,
            available,
            requires_docker_running: false,
        });
    }

    categories
}

pub fn clean_js_caches(category_ids: &[String]) -> Vec<DevCleanResult> {
    let mut results = Vec::new();

    for cat_id in category_ids {
        let tool_id = cat_id.strip_prefix("js_").unwrap_or(cat_id);
        let mut freed: u64 = 0;
        let mut removed: u64 = 0;

        for (id, _name, path_template) in JS_CACHE_PATHS {
            if *id != tool_id {
                continue;
            }
            let resolved = expand(path_template);
            let p = Path::new(&resolved);
            if p.exists() {
                let result = filesystem::safe_delete_dir_contents(p);
                freed += result.freed_bytes;
                removed += result.files_deleted;
            }
        }

        results.push(DevCleanResult {
            tool: tool_id.to_string(),
            freed_bytes: freed,
            items_removed: removed,
            command_output: None,
        });
    }

    results
}

// ---------------------------------------------------------------------------
// Docker (Story 9.3)
// ---------------------------------------------------------------------------

pub fn is_docker_running() -> bool {
    new_cmd("docker")
        .arg("info")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

pub fn get_docker_disk_usage() -> Result<DevCacheCategory, AppError> {
    if !is_docker_running() {
        return Ok(DevCacheCategory {
            id: "docker".into(),
            tool: "docker".into(),
            name: "Docker (images, build cache)".into(),
            paths: vec![],
            size_bytes: 0,
            available: false,
            requires_docker_running: true,
        });
    }

    let output = new_cmd("docker")
        .args(["system", "df", "--format", "{{.Reclaimable}}"])
        .output()
        .map_err(|e| AppError::Io(format!("Failed to run docker system df: {}", e)))?;

    let text = String::from_utf8_lossy(&output.stdout);
    let mut reclaimable_bytes: u64 = 0;
    for line in text.lines() {
        reclaimable_bytes += parse_docker_size(line);
    }

    Ok(DevCacheCategory {
        id: "docker".into(),
        tool: "docker".into(),
        name: "Docker (images, build cache)".into(),
        paths: vec!["Docker managed storage".into()],
        size_bytes: reclaimable_bytes,
        available: true,
        requires_docker_running: true,
    })
}

fn parse_docker_size(s: &str) -> u64 {
    let s = s.trim();
    let s = if let Some(idx) = s.find('(') {
        s[..idx].trim()
    } else {
        s
    };

    let s_lower = s.to_lowercase();
    let (num_str, multiplier) = if s_lower.ends_with("tb") {
        (&s[..s.len() - 2], 1_099_511_627_776_u64)
    } else if s_lower.ends_with("gb") {
        (&s[..s.len() - 2], 1_073_741_824_u64)
    } else if s_lower.ends_with("mb") {
        (&s[..s.len() - 2], 1_048_576_u64)
    } else if s_lower.ends_with("kb") {
        (&s[..s.len() - 2], 1024_u64)
    } else if s_lower.ends_with('b') {
        (&s[..s.len() - 1], 1_u64)
    } else {
        return 0;
    };

    num_str
        .trim()
        .parse::<f64>()
        .map(|n| (n * multiplier as f64) as u64)
        .unwrap_or(0)
}

pub fn prune_docker(include_volumes: bool) -> Result<DockerPruneResult, AppError> {
    if !is_docker_running() {
        return Err(AppError::Module(
            "Docker is not running. Start Docker Desktop and try again.".into(),
        ));
    }

    let mut cmd = new_cmd("docker");
    cmd.args(["system", "prune", "-f"]);
    if include_volumes {
        cmd.arg("--volumes");
    }

    let output = cmd
        .output()
        .map_err(|e| AppError::Io(format!("Failed to run docker prune: {}", e)))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let freed_bytes = stdout
        .lines()
        .find(|l| l.contains("reclaimed space"))
        .and_then(|l| l.split(':').nth(1))
        .map(|s| parse_docker_size(s.trim()))
        .unwrap_or(0);

    Ok(DockerPruneResult {
        success: output.status.success(),
        output: stdout,
        freed_bytes,
    })
}

// ---------------------------------------------------------------------------
// Language caches (Story 9.4)
// ---------------------------------------------------------------------------

const LANGUAGE_CACHE_PATHS: &[(&str, &str, &[&str])] = &[
    ("pip", "pip cache", &[r"%LOCALAPPDATA%\pip\Cache"]),
    (
        "cargo",
        "Cargo cache",
        &[
            r"%USERPROFILE%\.cargo\registry\cache",
            r"%USERPROFILE%\.cargo\registry\src",
        ],
    ),
    ("go", "Go module cache", &[r"%USERPROFILE%\go\pkg\mod"]),
    (
        "maven",
        "Maven local repo",
        &[r"%USERPROFILE%\.m2\repository"],
    ),
    (
        "gradle",
        "Gradle caches",
        &[r"%USERPROFILE%\.gradle\caches"],
    ),
];

pub fn scan_language_caches(detected_tools: &[DevToolInfo]) -> Vec<DevCacheCategory> {
    let detected_ids: Vec<&str> = detected_tools
        .iter()
        .filter(|t| t.detected)
        .map(|t| t.id.as_str())
        .collect();

    let mut categories = Vec::new();

    for (tool_id, name, path_templates) in LANGUAGE_CACHE_PATHS {
        let detection_id = match *tool_id {
            "pip" => "python",
            other => other,
        };
        let available = detected_ids.contains(&detection_id);

        let mut paths = Vec::new();
        let mut total_size: u64 = 0;

        for tmpl in *path_templates {
            let resolved = expand(tmpl);
            let p = Path::new(&resolved);
            if p.exists() && available {
                let (size, _) = filesystem::calc_dir_size(p);
                total_size += size;
            }
            paths.push(resolved);
        }

        categories.push(DevCacheCategory {
            id: format!("lang_{}", tool_id),
            tool: tool_id.to_string(),
            name: name.to_string(),
            paths,
            size_bytes: total_size,
            available,
            requires_docker_running: false,
        });
    }

    categories
}

pub fn clean_language_caches(category_ids: &[String]) -> Vec<DevCleanResult> {
    let mut results = Vec::new();

    for cat_id in category_ids {
        let tool_id = cat_id.strip_prefix("lang_").unwrap_or(cat_id);
        let mut freed: u64 = 0;
        let mut removed: u64 = 0;

        for (id, _name, path_templates) in LANGUAGE_CACHE_PATHS {
            if *id != tool_id {
                continue;
            }
            for tmpl in *path_templates {
                let resolved = expand(tmpl);
                let p = Path::new(&resolved);
                if p.exists() {
                    let result = filesystem::safe_delete_dir_contents(p);
                    freed += result.freed_bytes;
                    removed += result.files_deleted;
                }
            }
        }

        results.push(DevCleanResult {
            tool: tool_id.to_string(),
            freed_bytes: freed,
            items_removed: removed,
            command_output: None,
        });
    }

    results
}

// ---------------------------------------------------------------------------
// WSL2 (Story 9.4)
// ---------------------------------------------------------------------------

pub fn detect_wsl2_distributions() -> Result<Vec<Wsl2DistroInfo>, AppError> {
    let windir = expand(r"%WINDIR%");
    let wsl_path = PathBuf::from(&windir).join("System32").join("wsl.exe");
    if !wsl_path.exists() {
        return Ok(vec![]);
    }

    let output = new_cmd(wsl_path.to_str().unwrap_or("wsl"))
        .args(["--list", "--verbose"])
        .output();

    let output = match output {
        Ok(o) if o.status.success() => o,
        _ => return Ok(vec![]),
    };

    let text = decode_wsl_output(&output.stdout);
    let mut distros = Vec::new();

    for line in text.lines().skip(1) {
        let line = line.trim().trim_start_matches('*').trim();
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 3 {
            continue;
        }

        let name = parts[0].to_string();
        let status = parts[1].to_string();
        let version = parts.get(2).unwrap_or(&"0");

        if *version != "2" {
            continue;
        }

        let (vhdx_path, vhdx_size) = find_vhdx_for_distro(&name);

        distros.push(Wsl2DistroInfo {
            name,
            vhdx_path,
            vhdx_size_bytes: vhdx_size,
            status,
        });
    }

    Ok(distros)
}

fn decode_wsl_output(bytes: &[u8]) -> String {
    if bytes.len() >= 2 && bytes[0] == 0xFF && bytes[1] == 0xFE {
        let u16_slice: Vec<u16> = bytes[2..]
            .chunks_exact(2)
            .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
            .collect();
        String::from_utf16_lossy(&u16_slice)
    } else if bytes.iter().any(|&b| b == 0) {
        let u16_slice: Vec<u16> = bytes
            .chunks_exact(2)
            .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
            .collect();
        String::from_utf16_lossy(&u16_slice)
    } else {
        String::from_utf8_lossy(bytes).to_string()
    }
}

fn find_vhdx_for_distro(distro_name: &str) -> (String, u64) {
    let local_appdata = expand(r"%LOCALAPPDATA%");
    let packages_dir = PathBuf::from(&local_appdata).join("Packages");

    if !packages_dir.exists() {
        return (String::new(), 0);
    }

    let distro_lower = distro_name.to_lowercase();

    // First pass: direct name match
    if let Ok(entries) = std::fs::read_dir(&packages_dir) {
        for entry in entries.flatten() {
            let dir_name = entry.file_name().to_string_lossy().to_lowercase();
            if dir_name.contains(&distro_lower) {
                let vhdx = entry.path().join("LocalState").join("ext4.vhdx");
                if vhdx.exists() {
                    let size = std::fs::metadata(&vhdx).map(|m| m.len()).unwrap_or(0);
                    return (vhdx.display().to_string(), size);
                }
            }
        }
    }

    // Second pass: known mappings (Canonical -> Ubuntu, etc.)
    if let Ok(entries) = std::fs::read_dir(&packages_dir) {
        for entry in entries.flatten() {
            let vhdx = entry.path().join("LocalState").join("ext4.vhdx");
            if vhdx.exists() {
                let dir_name = entry.file_name().to_string_lossy().to_lowercase();
                let matched = (dir_name.contains("canonical") && distro_lower.contains("ubuntu"))
                    || (dir_name.contains("debian") && distro_lower.contains("debian"))
                    || (dir_name.contains("kali") && distro_lower.contains("kali"))
                    || (dir_name.contains("suse") && distro_lower.contains("suse"));
                if matched {
                    let size = std::fs::metadata(&vhdx).map(|m| m.len()).unwrap_or(0);
                    return (vhdx.display().to_string(), size);
                }
            }
        }
    }

    (String::new(), 0)
}

pub fn compact_wsl2_vhdx(vhdx_path: &str) -> Result<u64, AppError> {
    use crate::platform::elevation;

    if !elevation::is_elevated() {
        return Err(AppError::ElevationRequired {
            operation: "WSL2 VHDX compaction".into(),
        });
    }

    let size_before = std::fs::metadata(vhdx_path).map(|m| m.len()).unwrap_or(0);

    // Shutdown WSL
    tracing::info!("Shutting down WSL for VHDX compaction");
    let _ = new_cmd("wsl").arg("--shutdown").output();
    std::thread::sleep(Duration::from_secs(2));

    // Try Optimize-VHD first
    let ps_cmd = format!("Optimize-VHD -Path '{}' -Mode Full", vhdx_path);
    let optimize = new_cmd("powershell")
        .args(["-Command", &ps_cmd])
        .output();

    match optimize {
        Ok(output) if output.status.success() => {
            tracing::info!("Optimize-VHD succeeded");
        }
        _ => {
            // Fallback: diskpart
            tracing::info!("Optimize-VHD not available, trying diskpart fallback");

            let script_content = format!(
                "select vdisk file=\"{}\"\nattach vdisk readonly\ncompact vdisk\ndetach vdisk\nexit",
                vhdx_path
            );

            let temp_dir = expand(r"%TEMP%");
            let script_path = PathBuf::from(&temp_dir).join("purgekit_compact.txt");
            std::fs::write(&script_path, &script_content)
                .map_err(|e| AppError::Io(format!("Failed to write diskpart script: {}", e)))?;

            let diskpart_result = new_cmd("diskpart")
                .args(["/s", &script_path.display().to_string()])
                .output();

            let _ = std::fs::remove_file(&script_path);

            match diskpart_result {
                Ok(output) if output.status.success() => {
                    tracing::info!("Diskpart compaction succeeded");
                }
                Ok(output) => {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    return Err(AppError::Module(format!(
                        "VHDX compaction failed. Neither Optimize-VHD nor diskpart succeeded. {}",
                        stderr
                    )));
                }
                Err(e) => {
                    return Err(AppError::Io(format!("Failed to run diskpart: {}", e)));
                }
            }
        }
    }

    let size_after = std::fs::metadata(vhdx_path).map(|m| m.len()).unwrap_or(0);
    let saved = size_before.saturating_sub(size_after);

    tracing::info!(before = size_before, after = size_after, saved, "VHDX compaction complete");
    Ok(saved)
}

// ---------------------------------------------------------------------------
// Clean node_modules (Story 9.2)
// ---------------------------------------------------------------------------

pub fn clean_node_modules(paths: &[String]) -> Vec<DevCleanResult> {
    let mut results = Vec::new();

    for nm_path in paths {
        let p = Path::new(nm_path);
        if !p.exists() {
            continue;
        }

        let (size_before, _) = filesystem::calc_dir_size(p);

        match std::fs::remove_dir_all(p) {
            Ok(()) => {
                tracing::info!(path = %nm_path, freed = size_before, "Removed node_modules");
                results.push(DevCleanResult {
                    tool: "node_modules".into(),
                    freed_bytes: size_before,
                    items_removed: 1,
                    command_output: None,
                });
            }
            Err(e) => {
                tracing::warn!(path = %nm_path, error = %e, "Partial node_modules cleanup");
                let result = filesystem::safe_delete_dir_contents(p);
                results.push(DevCleanResult {
                    tool: "node_modules".into(),
                    freed_bytes: result.freed_bytes,
                    items_removed: result.files_deleted,
                    command_output: Some(format!("Partial cleanup: {}", e)),
                });
            }
        }
    }

    results
}
