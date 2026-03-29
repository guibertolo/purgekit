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

/** Developer mode cache types */

export interface DevToolInfo {
  name: string
  tool_type: DevToolType
  path: string
  cache_size_bytes: number
}

export type DevToolType =
  | 'NodeNpm'
  | 'NodeYarn'
  | 'NodePnpm'
  | 'Python'
  | 'Rust'
  | 'Go'
  | 'Docker'
  | 'Gradle'
  | 'Maven'
  | 'NuGet'
  | 'Wsl'

export interface DevScanResult {
  tools: DevToolInfo[]
  orphan_node_modules: OrphanNodeModules[]
  total_size_bytes: number
}

export interface OrphanNodeModules {
  path: string
  size_bytes: number
  last_modified: number
  parent_has_lockfile: boolean
}

export type DevCacheTarget = {
  tool_type: DevToolType
  path: string
}
