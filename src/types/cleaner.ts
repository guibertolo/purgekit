/** Mirrors Rust cache cleaner types from modules/cache_cleaner.rs */

/** A single cache category from the scan result */
export interface CacheCategory {
  id: string
  name: string
  path: string
  size_bytes: number
  file_count: number
  requires_elevation: boolean
  browser_running: boolean
  locked_files: string[]
  selected: boolean
}

/** Result of scanning all cache categories */
export interface ScanResult {
  categories: CacheCategory[]
  total_size_bytes: number
  scan_duration_ms: number
}

/** Result of cleaning selected categories */
export interface CleanResult {
  categories_cleaned: string[]
  total_freed_bytes: number
  files_deleted: number
  files_skipped: number
  warnings: string[]
  errors: string[]
  duration_ms: number
}

/** Progress event payload emitted during cleanup */
export interface CleanupProgress {
  step: string
  percent: number
  current_category: string
}

/** GPU types — mirrors Rust modules/gpu_cache.rs */

export interface GpuInfo {
  index: number
  name: string
  vendor: string
  driver_version: string
  vram_bytes: number
  nvml_available: boolean
}

export interface GpuCachePath {
  label: string
  path: string
  size_bytes: number
  file_count: number
  exists: boolean
}

export interface GpuCacheCategory {
  id: string
  name: string
  vendor: string
  paths: GpuCachePath[]
  total_size_bytes: number
  available: boolean
  requires_elevation: boolean
}

export interface GpuScanResult {
  gpus: GpuInfo[]
  cache_categories: GpuCacheCategory[]
  total_size_bytes: number
  scan_duration_ms: number
}

export interface GpuCleanResult {
  cleaned_bytes: number
  failed_bytes: number
  categories_cleaned: string[]
  duration_ms: number
  first_load_slower_warning: boolean
}

/** Developer mode cache types — mirrors Rust modules/dev_cleaner.rs */

export interface DevToolInfo {
  id: string
  name: string
  detected: boolean
  version: string | null
  cache_paths: string[]
}

export type NodeModulesStatus =
  | 'Active'
  | { Inactive: { days_old: number } }
  | 'Orphan'

export interface NodeModulesEntry {
  path: string
  parent_path: string
  size_bytes: number
  last_modified: number
  has_package_json: boolean
  status: NodeModulesStatus
  selected: boolean
}

export interface DevScanProgress {
  scanned_dirs: number
  found_count: number
}

export interface DevCacheCategory {
  id: string
  tool: string
  name: string
  paths: string[]
  size_bytes: number
  available: boolean
  requires_docker_running: boolean
}

export interface DevCleanResult {
  tool: string
  freed_bytes: number
  items_removed: number
  command_output: string | null
}

export interface DockerPruneResult {
  success: boolean
  output: string
  freed_bytes: number
}

export interface Wsl2DistroInfo {
  name: string
  vhdx_path: string
  vhdx_size_bytes: number
  status: string
}
