import { Settings as SettingsIcon } from 'lucide-react'
import Header from '@/components/layout/Header'

/**
 * Settings page — app preferences, thresholds, and log viewer.
 */
export default function Settings() {
  return (
    <>
      <Header
        title="Settings"
        icon={<SettingsIcon size={20} strokeWidth={1.5} />}
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
            Application settings will be available here. Configure thresholds, scan schedules, and preferences.
          </p>
        </div>
      </div>
    </>
  )
}
