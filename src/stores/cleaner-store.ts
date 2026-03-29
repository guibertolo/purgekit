import { create } from 'zustand'
import type { ScanResult, CleanResult, CleanupProgress } from '@/types/cleaner'

interface CleanerStore {
  scanResult: ScanResult | null
  cleanResult: CleanResult | null
  selectedCategories: Set<string>
  isScanning: boolean
  isCleaning: boolean
  progress: CleanupProgress | null

  setScanResult: (result: ScanResult | null) => void
  setCleanResult: (result: CleanResult | null) => void
  toggleCategory: (id: string) => void
  selectAll: () => void
  deselectAll: () => void
  setScanning: (active: boolean) => void
  setCleaning: (active: boolean) => void
  setProgress: (progress: CleanupProgress | null) => void
  reset: () => void
}

export const useCleanerStore = create<CleanerStore>((set) => ({
  scanResult: null,
  cleanResult: null,
  selectedCategories: new Set<string>(),
  isScanning: false,
  isCleaning: false,
  progress: null,

  setScanResult: (result) => {
    if (result) {
      // Auto-select categories that are selectable (not requiring elevation when not elevated)
      const selected = new Set(
        result.categories
          .filter((c) => c.selected)
          .map((c) => c.id),
      )
      set({ scanResult: result, selectedCategories: selected, cleanResult: null })
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
  selectAll: () =>
    set((state) => {
      if (!state.scanResult) return {}
      const all = new Set(state.scanResult.categories.map((c) => c.id))
      return { selectedCategories: all }
    }),
  deselectAll: () => set({ selectedCategories: new Set() }),
  setScanning: (active) => set({ isScanning: active }),
  setCleaning: (active) => set({ isCleaning: active }),
  setProgress: (progress) => set({ progress }),
  reset: () =>
    set({
      scanResult: null,
      cleanResult: null,
      selectedCategories: new Set(),
      isScanning: false,
      isCleaning: false,
      progress: null,
    }),
}))
