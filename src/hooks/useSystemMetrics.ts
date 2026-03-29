import { useEffect } from 'react'
import { listen } from '@/lib/tauri'
import { useMetricsStore } from '@/stores/metrics-store'
import { useMonitorStore } from '@/stores/monitor-store'
import type { SystemMetrics } from '@/types/metrics'

/**
 * Hook that subscribes to the `"system-metrics"` and `"temperature-alert"`
 * Tauri events emitted by the Rust monitor loop every 2 seconds.
 *
 * Call once at the app root or in the Dashboard page.
 * Returns the latest metrics snapshot from the store.
 */
export function useSystemMetrics() {
  const addMetrics = useMetricsStore((s) => s.addMetrics)
  const addAlert = useMonitorStore((s) => s.addAlert)
  const pushTemperature = useMonitorStore((s) => s.pushTemperature)

  useEffect(() => {
    let unlistenMetrics: (() => void) | null = null
    let unlistenAlert: (() => void) | null = null

    // Listen for system metrics
    listen<SystemMetrics>('system-metrics', (payload) => {
      addMetrics(payload)

      // Push temperature readings for history
      if (payload.temperatures.cpu_temp_c != null) {
        pushTemperature({
          source: 'Cpu',
          label: 'CPU',
          value_c: payload.temperatures.cpu_temp_c,
          timestamp: payload.timestamp,
        })
      }
      if (payload.temperatures.gpu_temp_c != null) {
        pushTemperature({
          source: 'Gpu',
          label: 'GPU',
          value_c: payload.temperatures.gpu_temp_c,
          timestamp: payload.timestamp,
        })
      }
    }).then((fn) => {
      unlistenMetrics = fn
    })

    // Listen for temperature alerts
    listen<{ sensor: string; temp: number; threshold: number }>(
      'temperature-alert',
      (payload) => {
        addAlert({
          id: `${payload.sensor}-${Date.now()}`,
          sensor: payload.sensor,
          temp: payload.temp,
          threshold: payload.threshold,
          timestamp: Date.now(),
        })
      },
    ).then((fn) => {
      unlistenAlert = fn
    })

    return () => {
      unlistenMetrics?.()
      unlistenAlert?.()
    }
  }, [addMetrics, addAlert, pushTemperature])

  return useMetricsStore((s) => s.latest)
}
