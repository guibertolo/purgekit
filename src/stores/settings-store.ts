import { create } from 'zustand'

interface SettingsStore {
  monitorInterval: number
  tempThresholdCpu: number
  tempThresholdGpu: number
  autoStartMonitor: boolean
  compactSidebar: boolean

  setMonitorInterval: (ms: number) => void
  setTempThresholdCpu: (celsius: number) => void
  setTempThresholdGpu: (celsius: number) => void
  setAutoStartMonitor: (enabled: boolean) => void
  setCompactSidebar: (compact: boolean) => void
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  monitorInterval: 2000,
  tempThresholdCpu: 85,
  tempThresholdGpu: 90,
  autoStartMonitor: true,
  compactSidebar: false,

  setMonitorInterval: (ms) => set({ monitorInterval: ms }),
  setTempThresholdCpu: (celsius) => set({ tempThresholdCpu: celsius }),
  setTempThresholdGpu: (celsius) => set({ tempThresholdGpu: celsius }),
  setAutoStartMonitor: (enabled) => set({ autoStartMonitor: enabled }),
  setCompactSidebar: (compact) => set({ compactSidebar: compact }),
}))
