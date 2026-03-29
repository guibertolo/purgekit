import type { ReactNode } from 'react'

interface TooltipProps {
  /** Tooltip text to display on hover */
  text: string
  /** Element that triggers the tooltip */
  children: ReactNode
}

/**
 * Tooltip — uses native HTML title attribute for zero-overhead tooltips.
 * No JS-driven positioning, no animation frames.
 * Wraps children in a span with the title attribute.
 */
export default function Tooltip({ text, children }: TooltipProps) {
  return (
    <span title={text} style={{ display: 'inline-flex' }}>
      {children}
    </span>
  )
}
