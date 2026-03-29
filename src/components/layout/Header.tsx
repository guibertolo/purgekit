import { memo } from 'react'
import type { ReactNode } from 'react'

interface HeaderProps {
  /** Page title displayed in the header */
  title: string
  /** Optional icon element displayed before the title */
  icon?: ReactNode
  /** Optional action elements displayed on the right side */
  actions?: ReactNode
}

/**
 * Page header — displays current page title with optional icon and action area.
 */
function Header({ title, icon, actions }: HeaderProps) {
  return (
    <header
      className="flex items-center justify-between px-6 border-b"
      style={{
        height: 56,
        backgroundColor: 'var(--bg-1)',
        borderColor: 'var(--border-default)',
      }}
    >
      <div className="flex items-center gap-3">
        {icon && (
          <span style={{ color: 'var(--color-primary)' }}>{icon}</span>
        )}
        <h1
          className="text-lg font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          {title}
        </h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}

export default memo(Header)
