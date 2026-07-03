import { memo } from 'react'
import {
  LayoutDashboard,
  Trash2,
  Layers,
  Terminal,
  Gamepad2,
  Activity,
  Server,
  Zap,
  Settings,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import { SIDEBAR_WIDTH } from '@/lib/constants'

/** Navigation item definition */
interface NavItem {
  path: string
  label: string
  icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={20} strokeWidth={1.5} /> },
  { path: '/cache', label: 'Cache Cleaner', icon: <Trash2 size={20} strokeWidth={1.5} /> },
  { path: '/gpu', label: 'GPU Cache', icon: <Layers size={20} strokeWidth={1.5} /> },
  { path: '/developer', label: 'Developer Mode', icon: <Terminal size={20} strokeWidth={1.5} /> },
  { path: '/gaming', label: 'Gaming Mode', icon: <Gamepad2 size={20} strokeWidth={1.5} /> },
  { path: '/monitor', label: 'Monitor', icon: <Activity size={20} strokeWidth={1.5} /> },
  { path: '/services', label: 'Services', icon: <Server size={20} strokeWidth={1.5} /> },
  { path: '/startup', label: 'Startup', icon: <Zap size={20} strokeWidth={1.5} /> },
  { path: '/settings', label: 'Settings', icon: <Settings size={20} strokeWidth={1.5} /> },
]

interface SidebarProps {
  currentPath: string
  collapsed: boolean
  onNavigate: (path: string) => void
  onToggleCollapse: () => void
}

/** PurgeKit Prism logo — simplified hexagon SVG */
function PrismLogo({ size = 32 }: { size?: number }) {
  const h = size * 1.15
  return (
    <svg
      width={size}
      height={h}
      viewBox="0 0 80 92"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="PurgeKit logo"
    >
      <path
        d="M40 2L74 24V68L40 90L6 68V24L40 2Z"
        stroke="#00D4FF"
        strokeWidth="1.5"
        fill="none"
      />
      <line x1="18" y1="28" x2="40" y2="46" stroke="#00D4FF" strokeWidth="1.5" />
      <line x1="40" y1="46" x2="62" y2="34" stroke="#00D4FF" strokeWidth="1.5" opacity="0.9" />
      <line x1="40" y1="46" x2="58" y2="64" stroke="#00FFE5" strokeWidth="1.5" opacity="0.8" />
      <line x1="40" y1="46" x2="28" y2="68" stroke="#00FFE5" strokeWidth="1.5" opacity="0.7" />
    </svg>
  )
}

/**
 * Sidebar — collapsible navigation panel.
 * 64px when collapsed (icons only), 240px when expanded (icons + labels).
 * Uses CSS flexbox for layout — no JS-driven layout.
 */
function Sidebar({ currentPath, collapsed, onNavigate, onToggleCollapse }: SidebarProps) {
  const width = collapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded

  return (
    <aside
      className="flex flex-col h-screen border-r"
      style={{
        width,
        minWidth: width,
        backgroundColor: 'var(--bg-2)',
        borderColor: 'var(--border-default)',
        transition: 'width 150ms, min-width 150ms',
      }}
    >
      {/* Logo area */}
      <div
        className="flex items-center gap-3 border-b"
        style={{
          padding: collapsed ? '16px 0' : '16px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          borderColor: 'var(--border-default)',
        }}
      >
        <PrismLogo size={collapsed ? 24 : 28} />
        {!collapsed && (
          <div className="flex flex-col">
            <span
              className="text-sm font-semibold tracking-wide"
              style={{ color: 'var(--text-primary)' }}
            >
              PurgeKit
            </span>
            <span
              className="text-xs"
              style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
            >
              v0.1.0
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1 py-2 px-2 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = currentPath === item.path
          return (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              title={collapsed ? item.label : undefined}
              className="flex items-center gap-3 rounded-md"
              style={{
                padding: collapsed ? '10px 0' : '10px 12px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                backgroundColor: isActive ? 'var(--bg-2)' : 'transparent',
                color: isActive ? 'var(--color-primary)' : 'var(--text-secondary)',
                borderTop: 'none',
                borderRight: 'none',
                borderBottom: 'none',
                borderLeft: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                cursor: 'pointer',
                width: '100%',
                fontSize: '13px',
                fontFamily: 'var(--font-sans)',
                transition: 'color 150ms, background-color 150ms',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-3)'
                  e.currentTarget.style.color = 'var(--text-primary)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }
              }}
            >
              {item.icon}
              {!collapsed && <span>{item.label}</span>}
            </button>
          )
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={onToggleCollapse}
        className="flex items-center justify-center border-t"
        style={{
          padding: '12px',
          backgroundColor: 'transparent',
          color: 'var(--text-muted)',
          borderColor: 'var(--border-default)',
          cursor: 'pointer',
          border: 'none',
          borderTop: '1px solid var(--border-default)',
          transition: 'color 150ms',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--text-primary)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text-muted)'
        }}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
      </button>
    </aside>
  )
}

export default memo(Sidebar)
