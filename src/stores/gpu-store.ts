import { create } from 'zustand'
import type { GpuInfo, GpuScanResult, GpuCleanResult, GpuCacheCategory } from '@/types/cleaner'

interface GpuStore {
  gpus: GpuInfo[]
  scanResult: GpuScanResult | null
  cleanResult: GpuCleanResult | null
  selectedCategories: Set<string>
  isDetecting: boolean
  isScanning: boolean
  isCleaning: boolean

  setGpus: (gpus: GpuInfo[]) => void
  setScanResult: (result: GpuScanResult | null) => void
  setCleanResult: (result: GpuCleanResult | null) => void
  toggleCategory: (id: string) => void
  selectAllAvailable: () => void
  deselectAll: () => void
  setDetecting: (active: boolean) => void
  setScanning: (active: boolean) => void
  setCleaning: (active: boolean) => void
  reset: () => void
}

export const useGpuStore = create<GpuStore>((set) => ({
  gpus: [],
  scanResult: null,
  cleanResult: null,
  selectedCategories: new Set<string>(),
  isDetecting: false,
  isScanning: false,
  isCleaning: false,

  setGpus: (gpus) => set({ gpus }),

  setScanResult: (result) => {
    if (result) {
      // Auto-select available categories with size > 0
      const selected = new Set(
        result.cache_categories
          .filter((c: GpuCacheCategory) => c.available && c.total_size_bytes > 0)
          .map((c: GpuCacheCategory) => c.id),
      )
      set({ scanResult: result, selectedCategories: selected, cleanResult: null, gpus: result.gpus })
    } else {
      set({ scanResult: null, selectedCategories: new Set(), cleanResult: null })
    }
  },

  setCleanResult: (result) => set({ cleanResult: result }),

  toggleCategory: (id) =>
    set((state) => {
      const next = new Set(state.selectedCategories)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return { selectedCategories: next }
    }),

  selectAllAvailable: () =>
    set((state) => {
      if (!state.scanResult) return {}
      const all = new Set(
        state.scanResult.cache_categories
          .filter((c: GpuCacheCategory) => c.available && c.total_size_bytes > 0)
          .map((c: GpuCacheCategory) => c.id),
      )
      return { selectedCategories: all }
    }),

  deselectAll: () => set({ selectedCategories: new Set() }),
  setDetecting: (active) => set({ isDetecting: active }),
  setScanning: (active) => set({ isScanning: active }),
  setCleaning: (active) => set({ isCleaning: active }),

  reset: () =>
    set({
      gpus: [],
      scanResult: null,
      cleanResult: null,
      selectedCategories: new Set(),
      isDetecting: false,
      isScanning: false,
      isCleaning: false,
    }),
}))
