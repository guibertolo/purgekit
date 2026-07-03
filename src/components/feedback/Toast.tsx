import { useEffect, useState, useCallback } from 'react'
import { X } from 'lucide-react'
import { TOAST_DURATION_MS } from '@/lib/constants'

type ToastType = 'success' | 'error' | 'info'

interface ToastMessage {
  id: string
  type: ToastType
  message: string
}

const TYPE_COLORS: Record<ToastType, string> = {
  success: 'var(--color-success)',
  error: 'var(--color-danger)',
  info: 'var(--color-info)',
}

interface ToastItemProps {
  toast: ToastMessage
  onDismiss: (id: string) => void
}

/** Single toast notification — auto-dismisses after TOAST_DURATION_MS */
function ToastItem({ toast, onDismiss }: ToastItemProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id)
    }, TOAST_DURATION_MS)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  const accentColor = TYPE_COLORS[toast.type]

  return (
    <div
      className="flex items-center gap-3 rounded-md px-4 py-3 text-sm"
      style={{
        backgroundColor: 'var(--bg-3)',
        border: '1px solid var(--border-default)',
        borderLeft: `3px solid ${accentColor}`,
        color: 'var(--text-primary)',
        minWidth: 280,
        maxWidth: 400,
      }}
    >
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          padding: 2,
        }}
      >
        <X size={14} />
      </button>
    </div>
  )
}

/** Global toast state — simple module-level singleton */
let toastListener: ((toasts: ToastMessage[]) => void) | null = null
let toastQueue: ToastMessage[] = []
let toastCounter = 0

/** Show a toast notification. Call from anywhere. */
export function showToast(type: ToastType, message: string) {
  const id = `toast-${++toastCounter}`
  const newToast: ToastMessage = { id, type, message }
  toastQueue = [...toastQueue, newToast]
  toastListener?.(toastQueue)
}

/** Remove a toast by ID */
function removeToast(id: string) {
  toastQueue = toastQueue.filter((t) => t.id !== id)
  toastListener?.(toastQueue)
}

/**
 * Toast container — renders active toast notifications.
 * Mount once in the app root. Toasts appear in the bottom-right corner.
 * Auto-dismiss uses simple setTimeout — no animation frames.
 */
export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  useEffect(() => {
    toastListener = setToasts
    return () => {
      toastListener = null
    }
  }, [])

  const handleDismiss = useCallback((id: string) => {
    removeToast(id)
  }, [])

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-4 right-4 flex flex-col gap-2"
      style={{ zIndex: 60, pointerEvents: 'auto' }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={handleDismiss} />
      ))}
    </div>
  )
}
