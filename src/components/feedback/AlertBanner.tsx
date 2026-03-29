import { AlertTriangle, XCircle, X } from 'lucide-react'

type AlertLevel = 'warning' | 'critical'

interface AlertBannerProps {
  /** Alert severity level */
  level: AlertLevel
  /** Alert message text */
  message: string
  /** Optional dismiss handler — if provided, shows close button */
  onDismiss?: () => void
}

const LEVEL_CONFIG: Record<AlertLevel, { color: string; bgColor: string; icon: React.ReactNode }> = {
  warning: {
    color: 'var(--color-warning)',
    bgColor: 'rgba(255, 179, 0, 0.1)',
    icon: <AlertTriangle size={16} strokeWidth={1.5} />,
  },
  critical: {
    color: 'var(--color-danger)',
    bgColor: 'rgba(255, 61, 90, 0.1)',
    icon: <XCircle size={16} strokeWidth={1.5} />,
  },
}

/**
 * Alert banner — displayed at the top of the content area.
 * Warning level uses amber, critical uses red.
 * No animations — renders statically.
 */
export default function AlertBanner({ level, message, onDismiss }: AlertBannerProps) {
  const config = LEVEL_CONFIG[level]

  return (
    <div
      className="flex items-center gap-3 px-4 py-2 text-sm"
      style={{
        backgroundColor: config.bgColor,
        color: config.color,
        borderBottom: `1px solid ${config.color}`,
      }}
    >
      <span className="flex-shrink-0">{config.icon}</span>
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: config.color,
            cursor: 'pointer',
            padding: 2,
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
