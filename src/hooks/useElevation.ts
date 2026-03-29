import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@/lib/tauri'

interface UseElevationResult {
  /** Whether the current process is running as administrator. */
  isElevated: boolean
  /** True while the initial elevation check is in flight. */
  isLoading: boolean
  /**
   * Save the current page and re-launch as administrator.
   * No-op if already elevated.
   */
  requestElevation: (currentPage: string) => Promise<void>
}

/**
 * React hook that exposes the UAC elevation state and a function to
 * request elevation (re-launch as admin).
 */
export function useElevation(): UseElevationResult {
  const [isElevated, setIsElevated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    invoke<boolean>('is_elevated' as never)
      .then(setIsElevated)
      .catch(() => setIsElevated(false))
      .finally(() => setIsLoading(false))
  }, [])

  const requestElevation = useCallback(async (currentPage: string) => {
    await invoke<void>('request_elevation' as never, { currentPage })
  }, [])

  return { isElevated, isLoading, requestElevation }
}
