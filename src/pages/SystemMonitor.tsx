import { Activity } from 'lucide-react'
import Header from '@/components/layout/Header'

/**
 * System Monitor page — real-time system metrics and temperature monitoring.
 * Implements FR-040 to FR-048 in later stories.
 */
export default function SystemMonitor() {
  return (
    <>
      <Header
        title="Monitor"
        icon={<Activity size={20} strokeWidth={1.5} />}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div
          className="rounded-lg p-6"
          style={{
            backgroundColor: 'var(--bg-2)',
            border: '1px solid var(--border-default)',
          }}
        >
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            System monitoring dashboard will be available here. CPU, GPU, RAM, and disk metrics with temperature tracking.
          </p>
        </div>
      </div>
    </>
  )
}
