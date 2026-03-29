import { useState } from 'react'
import Button from '@/components/common/Button'

interface ConfirmDialogProps {
  /** Dialog title */
  title: string
  /** Description of what will happen */
  description: string
  /** Optional details like affected items or space */
  details?: string
  /** Called when user confirms */
  onConfirm: () => void
  /** Called when user cancels */
  onCancel: () => void
  /** When true, requires typing "CONFIRM" to proceed (double-confirm for dangerous ops) */
  dangerous?: boolean
}

/**
 * Confirm dialog — modal overlay for confirming destructive or important actions.
 * When `dangerous` is true, requires the user to type "CONFIRM" before proceeding.
 * No animations — renders instantly with a semi-transparent overlay.
 */
export default function ConfirmDialog({
  title,
  description,
  details,
  onConfirm,
  onCancel,
  dangerous = false,
}: ConfirmDialogProps) {
  const [confirmText, setConfirmText] = useState('')
  const canConfirm = dangerous ? confirmText === 'CONFIRM' : true

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onCancel}
    >
      <div
        className="rounded-lg p-6 max-w-md w-full mx-4"
        style={{
          backgroundColor: 'var(--bg-3)',
          border: '1px solid var(--border-default)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className="text-lg font-semibold mb-2"
          style={{ color: dangerous ? 'var(--color-danger)' : 'var(--text-primary)' }}
        >
          {title}
        </h2>

        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          {description}
        </p>

        {details && (
          <div
            className="rounded-md p-3 mb-4 text-sm selectable"
            style={{
              backgroundColor: 'var(--bg-2)',
              color: 'var(--text-code)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {details}
          </div>
        )}

        {dangerous && (
          <div className="mb-4">
            <label
              className="block text-xs mb-1"
              style={{ color: 'var(--text-muted)' }}
            >
              Type CONFIRM to proceed
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full rounded-md px-3 py-2 text-sm selectable"
              style={{
                backgroundColor: 'var(--surface)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
                fontFamily: 'var(--font-mono)',
                outline: 'none',
              }}
              placeholder="CONFIRM"
              autoFocus
            />
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant={dangerous ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={!canConfirm}
          >
            Confirm
          </Button>
        </div>
      </div>
    </div>
  )
}
