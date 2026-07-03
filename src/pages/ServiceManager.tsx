import { Server } from 'lucide-react'
import Header from '@/components/layout/Header'
import Badge from '@/components/common/Badge'

/**
 * Service manager page -- planned for v1.0.
 * Backend commands (list_services, toggle_service) are ready.
 */
export default function ServiceManager() {
  return (
    <>
      <Header
        title="Service Manager"
        icon={<Server size={20} strokeWidth={1.5} />}
        actions={
          <Badge variant="neutral">v1.0</Badge>
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div
          className="rounded-lg p-8 text-center"
          style={{
            backgroundColor: 'var(--bg-2)',
            border: '1px solid var(--border-default)',
          }}
        >
          <Server
            size={40}
            strokeWidth={1}
            style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }}
          />
          <h3
            className="text-sm font-semibold mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            Coming in v1.0
          </h3>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Manage Windows services directly from PurgeKit. Stop, start, and configure
            services that impact system performance.
          </p>
        </div>
      </div>
    </>
  )
}
