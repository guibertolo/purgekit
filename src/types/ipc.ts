/** IPC types matching Rust AppError enum and command signatures */

export type AppErrorKind =
  | { type: 'ElevationRequired'; operation: string }
  | { type: 'DangerousService'; name: string }
  | { type: 'NvmlUnavailable'; reason: string }
  | { type: 'WmiError'; query: string; source: string }
  | { type: 'FileError'; path: string; source: string }
  | { type: 'ProcessNotFound'; pid: number }
  | { type: 'FeatureUnavailable'; feature: string; reason: string }
  | { type: 'Cancelled' }
  | { type: 'Internal'; message: string }

/** Typed Tauri command names for type-safe invoke calls */
export type TauriCommand =
  // Cache (legacy stubs)
  | 'scan_caches'
  | 'clean_caches'
  // Cache (new — Epic 2)
  | 'scan_system_cache'
  | 'clean_system_cache'
  | 'detect_browsers'
  // GPU
  | 'detect_gpus'
  | 'scan_gpu_cache'
  | 'clean_gpu_cache'
  // Monitor
  | 'get_system_metrics'
  | 'start_monitor'
  | 'stop_monitor'
  // Services
  | 'list_services'
  | 'toggle_service'
  // Startup
  | 'list_startup_items'
  | 'toggle_startup_item'
  // Dev
  | 'scan_dev_caches'
  | 'clean_dev_caches'
  // Gaming
  | 'activate_gaming_mode'
  | 'deactivate_gaming_mode'
  // System
  | 'request_elevation'
  | 'is_elevated'
  | 'get_restored_session'
  | 'get_app_config'
  | 'update_app_config'

/** Tauri event names */
export type TauriEvent =
  | 'system-metrics'
  | 'cleanup-progress'
  | 'scan-progress'
  | 'temperature-alert'

export interface CleanupProgressPayload {
  step: string
  percent: number
  current_file: string | null
}

export interface ScanProgressPayload {
  category: string
  percent: number
}

export interface TemperatureAlertPayload {
  sensor: string
  temp: number
  threshold: number
}
