import type { ReactNode } from 'react'

export type BadgeVariant = 'safe' | 'caution' | 'dangerous' | 'info' | 'neutral'

interface BadgeProps {
  /** Visual variant */
  variant: BadgeVariant
  /** Badge content */
  children: ReactNode
}

const VARIANT_STYLES: Record<BadgeVariant, { color: string; bg: string }> = {
  safe: {
    color: 'var(--color-success)',
    bg: 'rgba(0, 230, 118, 0.1)',
  },
  caution: {
    color: 'var(--color-warning)',
    bg: 'rgba(255, 179, 0, 0.1)',
  },
  dangerous: {
    color: 'var(--color-danger)',
    bg: 'rgba(255, 61, 90, 0.1)',
  },
  info: {
    color: 'var(--color-primary)',
    bg: 'rgba(0, 210, 255, 0.1)',
  },
  neutral: {
    color: 'var(--text-muted)',
    bg: 'rgba(128, 128, 128, 0.1)',
  },
}

/**
 * Badge — status indicator with 5 variants.
 * - safe: green — system healthy, no action needed
 * - caution: yellow — attention recommended
 * - dangerous: red — action required
 * - info: blue — informational
 * - neutral: grey — inactive or disabled
 *
 * Honest UI: labels are neutral — no alarmist language.
 */
export default function Badge({ variant, children }: BadgeProps) {
  const v = VARIANT_STYLES[variant]

  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
      style={{
        color: v.color,
        backgroundColor: v.bg,
        fontFamily: 'var(--font-mono)',
      }}
    >
      {children}
    </span>
  )
}
