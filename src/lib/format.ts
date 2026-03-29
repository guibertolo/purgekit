const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

/**
 * Format bytes into human-readable string.
 * Example: 1536 -> "1.50 KB"
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B'

  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const unit = BYTE_UNITS[i] ?? 'TB'

  return `${(bytes / Math.pow(k, i)).toFixed(decimals)} ${unit}`
}

/**
 * Format temperature in Celsius.
 * Example: 72.5 -> "72.5C"
 */
export function formatTemp(celsius: number | null): string {
  if (celsius === null) return 'N/A'
  return `${celsius.toFixed(1)}\u00B0C`
}

/**
 * Format percentage.
 * Example: 85.3 -> "85.3%"
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

/**
 * Format frequency in MHz or GHz.
 * Example: 3600 -> "3.60 GHz"
 */
export function formatFrequency(mhz: number): string {
  if (mhz >= 1000) {
    return `${(mhz / 1000).toFixed(2)} GHz`
  }
  return `${mhz} MHz`
}

/**
 * Format duration in milliseconds to human-readable.
 * Example: 125000 -> "2m 5s"
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`

  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes === 0) return `${seconds}s`
  return `${minutes}m ${remainingSeconds}s`
}
