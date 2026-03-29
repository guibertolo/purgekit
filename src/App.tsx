import { useState, useMemo, useEffect } from 'react'
import MainLayout from '@/components/layout/MainLayout'
import ToastContainer from '@/components/feedback/Toast'
import ElevationDialog from '@/components/feedback/ElevationDialog'
import Dashboard from '@/pages/Dashboard'
import CacheCleaner from '@/pages/CacheCleaner'
import GpuCache from '@/pages/GpuCache'
import DeveloperMode from '@/pages/DeveloperMode'
import GamingMode from '@/pages/GamingMode'
import SystemMonitor from '@/pages/SystemMonitor'
import Settings from '@/pages/Settings'
import { useSessionRestore } from '@/hooks/useSessionRestore'
import { useElevationDialog } from '@/hooks/useElevationDialog'

/**
 * Route definition mapping paths to page components.
 */
const ROUTES: Record<string, () => JSX.Element> = {
  '/': Dashboard,
  '/cache': CacheCleaner,
  '/gpu': GpuCache,
  '/developer': DeveloperMode,
  '/gaming': GamingMode,
  '/monitor': SystemMonitor,
  '/settings': Settings,
}

/**
 * App root — manages client-side routing via simple state-based navigation.
 *
 * On startup, checks for a session file left by a prior non-elevated instance
 * and restores the page the user was on before UAC re-launch (Story 1.4).
 *
 * Uses a lightweight path-state approach instead of full TanStack Router config
 * to keep bundle size minimal. TanStack Router is available for future use
 * when file-based routing or advanced features (loaders, search params) are needed.
 */
export default function App() {
  const [currentPath, setCurrentPath] = useState('/')
  const { restoredPage } = useSessionRestore()
  const elevation = useElevationDialog()

  // Restore page from prior session after UAC re-launch
  useEffect(() => {
    if (restoredPage && restoredPage in ROUTES) {
      setCurrentPath(restoredPage)
    }
  }, [restoredPage])

  const PageComponent = useMemo(() => {
    return ROUTES[currentPath] ?? Dashboard
  }, [currentPath])

  return (
    <MainLayout currentPath={currentPath} onNavigate={setCurrentPath}>
      <PageComponent />
      <ToastContainer />
      {elevation.isOpen && elevation.operation && (
        <ElevationDialog
          operation={elevation.operation}
          onConfirm={elevation.confirmElevation}
          onCancel={elevation.dismiss}
        />
      )}
    </MainLayout>
  )
}
