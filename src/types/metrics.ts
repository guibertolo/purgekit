/** Mirrors Rust SystemMetrics struct */
export interface SystemMetrics {
  timestamp: number
  cpu: CpuMetrics
  ram: RamMetrics
  gpu: GpuMetrics | null
  disks: DiskMetrics[]
  network: NetworkMetrics[]
  temperatures: TemperatureMetrics
}

export interface CpuMetrics {
  total_usage_percent: number
  frequency_mhz: number
  per_core_usage: number[]
  core_count: number
  thread_count: number
}

export interface RamMetrics {
  total_bytes: number
  used_bytes: number
  available_bytes: number
  usage_percent: number
  swap_total_bytes: number
  swap_used_bytes: number
}

export interface GpuMetrics {
  name: string
  temperature_c: number | null
  utilization_percent: number
  vram_total_bytes: number
  vram_used_bytes: number
  clock_mhz: number
  power_watts: number | null
  fan_speed_percent: number | null
}

export interface DiskMetrics {
  name: string
  mount_point: string
  total_bytes: number
  used_bytes: number
  available_bytes: number
  usage_percent: number
  disk_type: DiskType
  is_removable: boolean
}

export interface NetworkMetrics {
  interface_name: string
  bytes_sent: number
  bytes_received: number
  packets_sent: number
  packets_received: number
}

export interface TemperatureMetrics {
  cpu_temp_c: number | null
  gpu_temp_c: number | null
  disk_temps_c: [string, number][]
  motherboard_temp_c: number | null
}

export type DiskType = 'SSD' | 'HDD' | 'NVMe' | 'Unknown'

export interface TemperatureReading {
  source: TemperatureSource
  label: string
  value_c: number
  timestamp: number
}

export type TemperatureSource = 'Cpu' | 'Gpu' | 'Disk' | 'Motherboard' | 'Unknown'

export interface HardwareInfo {
  cpu_name: string
  cpu_cores: number
  cpu_threads: number
  ram_total_bytes: number
  gpu_name: string | null
  os_version: string
  os_build: string
}

export interface TimestampedValue {
  timestamp: number
  value: number
}
