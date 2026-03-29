/** Mirrors Rust service/startup types */

export interface ServiceInfo {
  name: string
  display_name: string
  status: ServiceStatus
  startup_type: ServiceStartupType
  classification: ServiceClassification
  description: string
  category: ServiceCategory
}

export type ServiceStatus = 'Running' | 'Stopped' | 'Paused' | 'Unknown'

export type ServiceStartupType = 'Auto' | 'Manual' | 'Disabled'

export type ServiceClassification = 'Safe' | 'Caution' | 'Dangerous'

export type ServiceCategory = 'Telemetry' | 'Legacy' | 'System' | 'UserApp' | 'Unknown'

export interface StartupItem {
  id: string
  name: string
  source: StartupSource
  path: string
  enabled: boolean
  requires_admin: boolean
  impact_estimate: ImpactLevel | null
}

export type StartupSource = 'RegistryHKCU' | 'RegistryHKLM' | 'Folder' | 'TaskScheduler'

export type ImpactLevel = 'Low' | 'Medium' | 'High'

export interface BackupInfo {
  id: string
  timestamp: number
  service_count: number
  startup_count: number
  path: string
}

export interface RestoreResult {
  restored_services: number
  restored_startup: number
  errors: string[]
}

export interface PresetDiff {
  changes: PresetChange[]
  services_affected: number
}

export interface PresetChange {
  service_name: string
  current_startup_type: ServiceStartupType
  target_startup_type: ServiceStartupType
}

export interface StartupImpact {
  item_id: string
  level: ImpactLevel
  boot_time_impact_ms: number | null
  description: string
}

export interface StartupChangeEntry {
  timestamp: number
  item_id: string
  item_name: string
  action: 'Enabled' | 'Disabled'
}
