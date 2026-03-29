interface ProgressStep {
  label: string
  completed: boolean
}

interface ProgressOverlayProps {
  /** Title of the operation in progress */
  title: string
  /** Progress value from 0 to 100 */
  progress: number
  /** Current status text */
  statusText: string
  /** Optional step list showing multi-stage progress */
  steps?: ProgressStep[]
}

/**
 * Progress overlay — full-screen overlay showing operation progress.
 * Uses CSS width transition for smooth progress bar movement.
 * No keyframe animations — purely CSS transition on width.
 */
export default function ProgressOverlay({
  title,
  progress,
  statusText,
  steps,
}: ProgressOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
    >
      <div
        className="rounded-lg p-6 max-w-sm w-full mx-4"
        style={{
          backgroundColor: 'var(--bg-3)',
          border: '1px solid var(--border-default)',
        }}
      >
        <h2
          className="text-base font-semibold mb-4"
          style={{ color: 'var(--text-primary)' }}
        >
          {title}
        </h2>

        {/* Progress bar */}
        <div
          className="rounded-full h-2 mb-3 overflow-hidden"
          style={{ backgroundColor: 'var(--surface)' }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(100, Math.max(0, progress))}%`,
              backgroundColor: 'var(--color-primary)',
              transition: 'width 150ms',
            }}
          />
        </div>

        {/* Status text */}
        <p
          className="text-xs mb-1"
          style={{
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {statusText}
        </p>
        <p
          className="text-xs mb-4"
          style={{
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {progress.toFixed(0)}%
        </p>

        {/* Optional steps */}
        {steps && steps.length > 0 && (
          <div className="flex flex-col gap-2">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[10px]"
                  style={{
                    backgroundColor: step.completed
                      ? 'var(--color-success)'
                      : 'var(--surface)',
                    color: step.completed
                      ? 'var(--text-inverse)'
                      : 'var(--text-muted)',
                  }}
                >
                  {step.completed ? '\u2713' : i + 1}
                </span>
                <span
                  style={{
                    color: step.completed
                      ? 'var(--text-primary)'
                      : 'var(--text-muted)',
                  }}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
