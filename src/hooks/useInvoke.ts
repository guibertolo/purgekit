import { useState, useCallback } from 'react'
import { invoke } from '@/lib/tauri'
import type { TauriCommand } from '@/types/ipc'

interface UseInvokeResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  execute: (args?: Record<string, unknown>) => Promise<T | null>
}

/**
 * React hook for type-safe Tauri command invocation.
 * Handles loading state and error capture.
 */
export function useInvoke<T>(command: TauriCommand): UseInvokeResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const execute = useCallback(
    async (args?: Record<string, unknown>): Promise<T | null> => {
      setLoading(true)
      setError(null)

      try {
        const result = await invoke<T>(command, args)
        setData(result)
        return result
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        setError(message)
        return null
      } finally {
        setLoading(false)
      }
    },
    [command],
  )

  return { data, loading, error, execute }
}
