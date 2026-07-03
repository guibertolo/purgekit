/** IPC types matching Rust AppError enum and command signatures */

export type AppErrorKind =
  | { type: 'ElevationRequired'; operation: string }
  | { type: 'Io'; message: string }
  | { type: 'NotFound'; message: string }
  | { type: 'Platform'; message: string }
  | { type: 'Module'; message: string }

/** Typed Tauri command names for type-safe invoke calls */
export type TauriCommand =
  // Cache (legacy stubs)
  | 'scan_caches'
  | 'clean_caches'
  // Cache (new — Epic 2)
  | 'scan_system_cache'
  | 'clean_system_cache'
  // GPU
  | 'detect_gpus'
  | 'scan_gpu_cache'
  | 'clean_gpu_cache'
  // Monitor
  | 'get_system_metrics'
  // Services
  | 'list_services'
  | 'toggle_service'
  // Startup
  | 'list_startup_items'
  | 'toggle_startup_item'
  // Dev (legacy)
  | 'scan_dev_caches'
  | 'clean_dev_caches'
  // Dev (Epic 9)
  | 'detect_dev_tools'
  | 'scan_node_modules'
  | 'cancel_dev_scan'
  | 'clean_node_modules'
  | 'scan_js_caches'
  | 'clean_js_caches'
  | 'scan_docker_usage'
  | 'prune_docker'
  | 'scan_language_caches'
  | 'clean_language_caches'
  | 'detect_wsl2_distributions'
  | 'compact_wsl2_vhdx'
  // Gaming
  | 'get_gaming_mode_status'
  | 'preview_gaming_mode'
  | 'activate_gaming_mode'
  | 'deactivate_gaming_mode'
  | 'restore_from_snapshot'
  | 'dismiss_gaming_restore'
  | 'set_game_process_priority'
  | 'add_game_config'
  | 'remove_game_config'
  | 'list_game_configs'
  | 'update_gaming_options'
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
  | 'game-detected'
  | 'game-detected-needs-elevation'
  | 'game-ended'
  | 'gaming-auto-activate'
  | 'gaming-auto-deactivated'
  | 'dev-scan-progress'

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
