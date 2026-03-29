import { useState } from 'react'
import type { ReactNode } from 'react'
import Sidebar from '@/components/layout/Sidebar'

interface MainLayoutProps {
  /** Current active route path */
  currentPath: string
  /** Handler for navigation events from the sidebar */
  onNavigate: (path: string) => void
  /** Page content to render in the main area */
  children: ReactNode
}

/**
 * Main application layout — sidebar + content area.
 * Flex container: sidebar is fixed-width, content fills remaining space.
 */
export default function MainLayout({ currentPath, onNavigate, children }: MainLayoutProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-0)' }}>
      <Sidebar
        currentPath={currentPath}
        collapsed={collapsed}
        onNavigate={onNavigate}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
      />
      <main
        className="flex-1 flex flex-col overflow-hidden"
        style={{ backgroundColor: 'var(--bg-1)' }}
      >
        {children}
      </main>
    </div>
  )
}
