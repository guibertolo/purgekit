import ConfirmDialog from '@/components/feedback/ConfirmDialog'

interface ElevationDialogProps {
  /** The operation that triggered the elevation request. */
  operation: string
  /** Called when the user confirms they want to run as admin. */
  onConfirm: () => void
  /** Called when the user cancels. */
  onCancel: () => void
}

/**
 * ElevationDialog - wraps the generic ConfirmDialog with UAC-specific copy.
 *
 * Shown when a backend command returns `AppError::ElevationRequired`.
 * Explains which operation needs admin and offers to re-launch elevated.
 */
export default function ElevationDialog({
  operation,
  onConfirm,
  onCancel,
}: ElevationDialogProps) {
  return (
    <ConfirmDialog
      title="Administrator Privileges Required"
      description={`The operation "${operation}" requires administrator privileges. PurgeKit will restart with elevated permissions to complete this action.`}
      details="Windows will show a User Account Control (UAC) prompt. Your current session will be saved and restored automatically."
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
