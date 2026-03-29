import { create } from 'zustand'
import type { TemperatureReading } from '@/types/metrics'

interface MonitorStore {
  temperatureAlerts: TemperatureAlert[]
  temperatureHistory: TemperatureReading[]
  isAlertActive: boolean

  addAlert: (alert: TemperatureAlert) => void
  dismissAlert: (id: string) => void
  pushTemperature: (reading: TemperatureReading) => void
  clearAlerts: () => void
}

interface TemperatureAlert {
  id: string
  sensor: string
  temp: number
  threshold: number
  timestamp: number
}

const MAX_TEMP_HISTORY = 720 // 24 minutes at 2-second intervals

export const useMonitorStore = create<MonitorStore>((set) => ({
  temperatureAlerts: [],
  temperatureHistory: [],
  isAlertActive: false,

  addAlert: (alert) =>
    set((state) => ({
      temperatureAlerts: [...state.temperatureAlerts, alert],
      isAlertActive: true,
    })),

  dismissAlert: (id) =>
    set((state) => {
      const filtered = state.temperatureAlerts.filter((a) => a.id !== id)
      return {
        temperatureAlerts: filtered,
        isAlertActive: filtered.length > 0,
      }
    }),

  pushTemperature: (reading) =>
    set((state) => {
      const history = [...state.temperatureHistory, reading]
      if (history.length > MAX_TEMP_HISTORY) {
        history.shift()
      }
      return { temperatureHistory: history }
    }),

  clearAlerts: () => set({ temperatureAlerts: [], isAlertActive: false }),
}))
