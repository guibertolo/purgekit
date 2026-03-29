import { useEffect, useState } from 'react'
import { invoke } from '@/lib/tauri'

/**
 * On startup, check if a session file was left by a prior non-elevated
 * instance. If so, return the page to navigate to so the user picks up
 * exactly where they left off after UAC re-launch.
 */
export function useSessionRestore(): {
  restoredPage: string | null
  isChecking: boolean
} {
  const [restoredPage, setRestoredPage] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    invoke<string | null>('get_restored_session' as never)
      .then((page) => {
        if (page) {
          setRestoredPage(page)
        }
      })
      .catch(() => {
        // No session to restore — normal startup
      })
      .finally(() => setIsChecking(false))
  }, [])

  return { restoredPage, isChecking }
}
