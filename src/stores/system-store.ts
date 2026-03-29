import { create } from 'zustand'
import type { SystemMetrics, HardwareInfo } from '@/types/metrics'

const MAX_HISTORY = 120 // 4 minutes at 2-second intervals

interface SystemStore {
  current: SystemMetrics | null
  history: SystemMetrics[]
  hardware: HardwareInfo | null
  isMonitoring: boolean

  pushMetrics: (metrics: SystemMetrics) => void
  setHardware: (info: HardwareInfo) => void
  setMonitoring: (active: boolean) => void
  clearHistory: () => void
}

export const useSystemStore = create<SystemStore>((set) => ({
  current: null,
  history: [],
  hardware: null,
  isMonitoring: false,

  pushMetrics: (metrics) =>
    set((state) => {
      const history = [...state.history, metrics]
      if (history.length > MAX_HISTORY) {
        history.shift()
      }
      return { current: metrics, history }
    }),

  setHardware: (info) => set({ hardware: info }),
  setMonitoring: (active) => set({ isMonitoring: active }),
  clearHistory: () => set({ history: [], current: null }),
}))
