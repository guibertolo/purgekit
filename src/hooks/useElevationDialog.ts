import { useState, useCallback } from 'react'
import { useElevation } from '@/hooks/useElevation'

interface ElevationDialogState {
  /** Whether the elevation dialog is currently visible. */
  isOpen: boolean
  /** The operation name that triggered the dialog (for display). */
  operation: string | null
  /** Show the dialog for a specific operation. */
  showElevationDialog: (operation: string, currentPage: string) => void
  /** Close the dialog without taking action. */
  dismiss: () => void
  /** Confirm elevation — saves session and re-launches. */
  confirmElevation: () => Promise<void>
}

/**
 * Manages the elevation dialog lifecycle. Pages call `showElevationDialog`
 * when they catch an `ElevationRequired` error from the backend. The dialog
 * renders the operation name and, on confirm, triggers the UAC re-launch.
 */
export function useElevationDialog(): ElevationDialogState {
  const { requestElevation } = useElevation()
  const [isOpen, setIsOpen] = useState(false)
  const [operation, setOperation] = useState<string | null>(null)
  const [pendingPage, setPendingPage] = useState<string>('/')

  const showElevationDialog = useCallback(
    (op: string, currentPage: string) => {
      setOperation(op)
      setPendingPage(currentPage)
      setIsOpen(true)
    },
    [],
  )

  const dismiss = useCallback(() => {
    setIsOpen(false)
    setOperation(null)
  }, [])

  const confirmElevation = useCallback(async () => {
    setIsOpen(false)
    await requestElevation(pendingPage)
  }, [requestElevation, pendingPage])

  return { isOpen, operation, showElevationDialog, dismiss, confirmElevation }
}
