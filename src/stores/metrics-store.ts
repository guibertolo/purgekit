import { create } from 'zustand'
import type { SystemMetrics, TimestampedValue } from '@/types/metrics'

const MAX_HISTORY = 120 // 4 minutes at 2-second intervals

interface MetricsStore {
  latest: SystemMetrics | null
  cpuHistory: TimestampedValue[]
  ramHistory: TimestampedValue[]
  gpuHistory: TimestampedValue[]
  gpuTempHistory: TimestampedValue[]

  addMetrics: (metrics: SystemMetrics) => void
  reset: () => void
}

export const useMetricsStore = create<MetricsStore>((set) => ({
  latest: null,
  cpuHistory: [],
  ramHistory: [],
  gpuHistory: [],
  gpuTempHistory: [],

  addMetrics: (metrics) =>
    set((state) => {
      const ts = metrics.timestamp

      const cpuHistory = appendCapped(state.cpuHistory, {
        timestamp: ts,
        value: metrics.cpu.total_usage_percent,
      })

      const ramHistory = appendCapped(state.ramHistory, {
        timestamp: ts,
        value: metrics.ram.usage_percent,
      })

      const gpuHistory = metrics.gpu
        ? appendCapped(state.gpuHistory, {
            timestamp: ts,
            value: metrics.gpu.utilization_percent,
          })
        : state.gpuHistory

      const gpuTempHistory =
        metrics.gpu?.temperature_c != null
          ? appendCapped(state.gpuTempHistory, {
              timestamp: ts,
              value: metrics.gpu.temperature_c,
            })
          : state.gpuTempHistory

      return {
        latest: metrics,
        cpuHistory,
        ramHistory,
        gpuHistory,
        gpuTempHistory,
      }
    }),

  reset: () =>
    set({
      latest: null,
      cpuHistory: [],
      ramHistory: [],
      gpuHistory: [],
      gpuTempHistory: [],
    }),
}))

function appendCapped(
  history: TimestampedValue[],
  entry: TimestampedValue,
): TimestampedValue[] {
  if (history.length >= MAX_HISTORY) {
    // Avoid full array copy: slice from 1 and append
    return [...history.slice(1), entry]
  }
  return [...history, entry]
}
