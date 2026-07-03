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
const ALERT_COOLDOWN_MS = 30_000 // One alert per sensor per 30 seconds

export const useMonitorStore = create<MonitorStore>((set, get) => ({
  temperatureAlerts: [],
  temperatureHistory: [],
  isAlertActive: false,

  addAlert: (alert) => {
    const state = get()
    // Deduplicate: skip if same sensor already alerted within cooldown
    const existing = state.temperatureAlerts.find(
      (a) => a.sensor === alert.sensor && alert.timestamp - a.timestamp < ALERT_COOLDOWN_MS,
    )
    if (existing) return
    set({
      temperatureAlerts: [...state.temperatureAlerts, alert],
      isAlertActive: true,
    })
  },

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
      const history =
        state.temperatureHistory.length >= MAX_TEMP_HISTORY
          ? [...state.temperatureHistory.slice(1), reading]
          : [...state.temperatureHistory, reading]
      return { temperatureHistory: history }
    }),

  clearAlerts: () => set({ temperatureAlerts: [], isAlertActive: false }),
}))
