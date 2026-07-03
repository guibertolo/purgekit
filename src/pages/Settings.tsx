import { useState, useEffect, useCallback, type ReactNode } from 'react'
import {
  Settings as SettingsIcon,
  Thermometer,
  Terminal,
  Activity,
  Info,
  RotateCcw,
  Save,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import Button from '@/components/common/Button'
import { showToast } from '@/components/feedback/Toast'
import { invoke } from '@/lib/tauri'

/** Shape matching Rust AppConfig (relevant fields only) */
interface AppConfig {
  monitor_interval_ms: number
  thresholds: {
    cpu_celsius: number
    gpu_celsius: number
    disk_celsius: number
    motherboard_celsius: number
  }
  scan_paths: {
    projects_dirs: string[]
    inactive_threshold_days: number
    large_file_threshold_mb: number
  }
  portable_mode: boolean
  log_level: string
}

const DEFAULTS: AppConfig = {
  monitor_interval_ms: 2000,
  thresholds: {
    cpu_celsius: 85,
    gpu_celsius: 90,
    disk_celsius: 55,
    motherboard_celsius: 80,
  },
  scan_paths: {
    projects_dirs: [],
    inactive_threshold_days: 90,
    large_file_threshold_mb: 100,
  },
  portable_mode: false,
  log_level: 'info',
}

/**
 * Settings page -- app preferences, thresholds, developer mode config.
 * Wired to Rust backend via get_app_config / update_app_config.
 */
export default function Settings() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const loadConfig = useCallback(async () => {
    try {
      const c = await invoke<AppConfig>('get_app_config')
      setConfig(c)
      setDirty(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast('error', `Failed to load settings: ${msg}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  const handleSave = useCallback(async () => {
    if (!config) return
    setSaving(true)
    try {
      const updated = await invoke<AppConfig>('update_app_config', {
        partial: {
          monitor_interval_ms: config.monitor_interval_ms,
          thresholds: config.thresholds,
          scan_paths: config.scan_paths,
        },
      })
      setConfig(updated)
      setDirty(false)
      showToast('success', 'Settings saved.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast('error', `Failed to save settings: ${msg}`)
    } finally {
      setSaving(false)
    }
  }, [config])

  const handleReset = useCallback(async () => {
    setSaving(true)
    try {
      const updated = await invoke<AppConfig>('update_app_config', {
        partial: {
          monitor_interval_ms: DEFAULTS.monitor_interval_ms,
          thresholds: DEFAULTS.thresholds,
          scan_paths: DEFAULTS.scan_paths,
        },
      })
      setConfig(updated)
      setDirty(false)
      showToast('info', 'Settings reset to defaults.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast('error', `Failed to reset settings: ${msg}`)
    } finally {
      setSaving(false)
    }
  }, [])

  const update = useCallback(
    (fn: (prev: AppConfig) => AppConfig) => {
      setConfig((prev) => {
        if (!prev) return prev
        setDirty(true)
        return fn(prev)
      })
    },
    [],
  )

  return (
    <>
      <Header
        title="Settings"
        icon={<SettingsIcon size={20} strokeWidth={1.5} />}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={handleReset}
              disabled={saving || loading}
            >
              <span className="flex items-center gap-1.5">
                <RotateCcw size={14} />
                Reset to Defaults
              </span>
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving || loading || !dirty}
            >
              <span className="flex items-center gap-1.5">
                <Save size={14} />
                {saving ? 'Saving...' : 'Save'}
              </span>
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Loading settings...
            </p>
          </div>
        ) : config ? (
          <div className="max-w-2xl mx-auto flex flex-col gap-6">
            {/* Temperature Thresholds */}
            <Section
              title="Temperature Thresholds"
              icon={<Thermometer size={16} />}
              description="Alert thresholds for hardware temperature monitoring. Values are in degrees Celsius."
            >
              <div className="grid grid-cols-2 gap-4">
                <NumberInput
                  label="CPU"
                  value={config.thresholds.cpu_celsius}
                  onChange={(v) =>
                    update((c) => ({
                      ...c,
                      thresholds: { ...c.thresholds, cpu_celsius: v },
                    }))
                  }
                  suffix="C"
                  min={40}
                  max={110}
                />
                <NumberInput
                  label="GPU"
                  value={config.thresholds.gpu_celsius}
                  onChange={(v) =>
                    update((c) => ({
                      ...c,
                      thresholds: { ...c.thresholds, gpu_celsius: v },
                    }))
                  }
                  suffix="C"
                  min={40}
                  max={110}
                />
                <NumberInput
                  label="Disk"
                  value={config.thresholds.disk_celsius}
                  onChange={(v) =>
                    update((c) => ({
                      ...c,
                      thresholds: { ...c.thresholds, disk_celsius: v },
                    }))
                  }
                  suffix="C"
                  min={30}
                  max={80}
                />
                <NumberInput
                  label="Motherboard"
                  value={config.thresholds.motherboard_celsius}
                  onChange={(v) =>
                    update((c) => ({
                      ...c,
                      thresholds: { ...c.thresholds, motherboard_celsius: v },
                    }))
                  }
                  suffix="C"
                  min={40}
                  max={100}
                />
              </div>
            </Section>

            {/* Developer Mode */}
            <Section
              title="Developer Mode"
              icon={<Terminal size={16} />}
              description="Configure scan paths and thresholds for developer cache detection."
            >
              <div className="flex flex-col gap-4">
                <TextAreaInput
                  label="Project Directories"
                  value={config.scan_paths.projects_dirs.join('\n')}
                  onChange={(v) =>
                    update((c) => ({
                      ...c,
                      scan_paths: {
                        ...c.scan_paths,
                        projects_dirs: v
                          .split('\n')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      },
                    }))
                  }
                  placeholder="One directory per line"
                  rows={3}
                />
                <div className="grid grid-cols-2 gap-4">
                  <NumberInput
                    label="Inactive Threshold"
                    value={config.scan_paths.inactive_threshold_days}
                    onChange={(v) =>
                      update((c) => ({
                        ...c,
                        scan_paths: { ...c.scan_paths, inactive_threshold_days: v },
                      }))
                    }
                    suffix="days"
                    min={7}
                    max={365}
                  />
                  <NumberInput
                    label="Large File Threshold"
                    value={config.scan_paths.large_file_threshold_mb}
                    onChange={(v) =>
                      update((c) => ({
                        ...c,
                        scan_paths: { ...c.scan_paths, large_file_threshold_mb: v },
                      }))
                    }
                    suffix="MB"
                    min={10}
                    max={10000}
                  />
                </div>
              </div>
            </Section>

            {/* Monitor */}
            <Section
              title="Monitor"
              icon={<Activity size={16} />}
              description="System metrics polling configuration."
            >
              <NumberInput
                label="Polling Interval"
                value={config.monitor_interval_ms}
                onChange={(v) =>
                  update((c) => ({ ...c, monitor_interval_ms: v }))
                }
                suffix="ms"
                min={500}
                max={30000}
                step={500}
              />
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                Lower values increase CPU usage. Default: 2000ms.
              </p>
            </Section>

            {/* About */}
            <Section
              title="About"
              icon={<Info size={16} />}
              description=""
            >
              <div className="flex flex-col gap-2">
                <DetailRow label="Version" value="0.1.0-mvp" />
                <DetailRow label="Mode" value={config.portable_mode ? 'Portable' : 'Installed'} />
                <DetailRow label="Log Level" value={config.log_level} />
                <DetailRow label="Framework" value="Tauri 2.x + React + Rust" />
              </div>
            </Section>
          </div>
        ) : (
          <div
            className="rounded-lg p-6"
            style={{
              backgroundColor: 'var(--bg-2)',
              border: '1px solid var(--border-default)',
            }}
          >
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Failed to load settings. Check the backend connection.
            </p>
          </div>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SectionProps {
  title: string
  icon: ReactNode
  description: string
  children: ReactNode
}

function Section({ title, icon, description, children }: SectionProps) {
  return (
    <div
      className="rounded-lg p-6"
      style={{
        backgroundColor: 'var(--bg-2)',
        border: '1px solid var(--border-default)',
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color: 'var(--color-primary)' }}>{icon}</span>
        <h3
          className="text-sm font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          {title}
        </h3>
      </div>
      {description && (
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
          {description}
        </p>
      )}
      {children}
    </div>
  )
}

interface NumberInputProps {
  label: string
  value: number
  onChange: (value: number) => void
  suffix?: string
  min?: number
  max?: number
  step?: number
}

function NumberInput({ label, value, onChange, suffix, min, max, step = 1 }: NumberInputProps) {
  return (
    <div>
      <label
        className="text-xs font-medium block mb-1"
        style={{ color: 'var(--text-secondary)' }}
      >
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value)
            if (!isNaN(v)) onChange(v)
          }}
          min={min}
          max={max}
          step={step}
          className="w-full rounded-md px-3 py-2 text-sm"
          style={{
            backgroundColor: 'var(--surface)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-default)',
            outline: 'none',
            fontFamily: 'var(--font-mono)',
          }}
        />
        {suffix && (
          <span
            className="text-xs flex-shrink-0"
            style={{ color: 'var(--text-muted)' }}
          >
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}

interface TextAreaInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}

function TextAreaInput({ label, value, onChange, placeholder, rows = 3 }: TextAreaInputProps) {
  return (
    <div>
      <label
        className="text-xs font-medium block mb-1"
        style={{ color: 'var(--text-secondary)' }}
      >
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-md px-3 py-2 text-sm resize-none"
        style={{
          backgroundColor: 'var(--surface)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-default)',
          outline: 'none',
          fontFamily: 'var(--font-mono)',
        }}
      />
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <span
        className="text-xs font-medium"
        style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
      >
        {value}
      </span>
    </div>
  )
}
