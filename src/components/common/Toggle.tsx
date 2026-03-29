interface ToggleProps {
  /** Whether the toggle is on or off */
  checked: boolean
  /** Called when toggle state changes */
  onChange: (checked: boolean) => void
  /** Optional label text */
  label?: string
  /** Whether the toggle is disabled */
  disabled?: boolean
}

/**
 * Toggle switch — on/off control.
 * Transition limited to 150ms on background-color.
 * Track is 40x20, thumb is 16x16 with 2px inset.
 */
export default function Toggle({ checked, onChange, label, disabled = false }: ToggleProps) {
  return (
    <label
      className="flex items-center gap-2"
      style={{
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <button
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        style={{
          width: 40,
          height: 20,
          borderRadius: 10,
          backgroundColor: checked ? 'var(--color-primary)' : 'var(--surface)',
          border: 'none',
          padding: 2,
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: checked ? 'center' : 'center',
          justifyContent: checked ? 'flex-end' : 'flex-start',
          transition: 'background-color 150ms',
        }}
      >
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            backgroundColor: checked ? 'var(--text-inverse)' : 'var(--text-muted)',
            display: 'block',
          }}
        />
      </button>
      {label && (
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </span>
      )}
    </label>
  )
}
