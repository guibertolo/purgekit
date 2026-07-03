import { Activity, Cpu, HardDrive, Thermometer, Wifi } from 'lucide-react'
import { LineChart, Line, YAxis, ResponsiveContainer, XAxis } from 'recharts'
import Header from '@/components/layout/Header'
import AlertBanner from '@/components/feedback/AlertBanner'
import { useSystemMetrics } from '@/hooks/useSystemMetrics'
import { useMetricsStore } from '@/stores/metrics-store'
import { useMonitorStore } from '@/stores/monitor-store'
import { formatBytes, formatPercent, formatFrequency, formatTemp } from '@/lib/format'
import type {
  CpuMetrics,
  RamMetrics,
  GpuMetrics,
  DiskMetrics,
  NetworkMetrics,
  TemperatureMetrics,
  TimestampedValue,
} from '@/types/metrics'

/**
 * System Monitor page — detailed real-time system metrics with larger charts.
 * Complements Dashboard with a more in-depth view of CPU, RAM, GPU,
 * temperatures, disks, and network activity.
 *
 * Honest UI: factual data, no alarmism, neutral language.
 */
export default function SystemMonitor() {
  const latest = useSystemMetrics()
  const cpuHistory = useMetricsStore((s) => s.cpuHistory)
  const ramHistory = useMetricsStore((s) => s.ramHistory)
  const gpuHistory = useMetricsStore((s) => s.gpuHistory)
  const gpuTempHistory = useMetricsStore((s) => s.gpuTempHistory)
  const alerts = useMonitorStore((s) => s.temperatureAlerts)
  const dismissAlert = useMonitorStore((s) => s.dismissAlert)

  return (
    <>
      <Header
        title="Monitor"
        icon={<Activity size={20} strokeWidth={1.5} />}
      />

      {/* Temperature alerts */}
      {alerts.map((alert) => (
        <AlertBanner
          key={alert.id}
          level="critical"
          message={`${alert.sensor}: ${alert.temp.toFixed(1)}\u00B0C \u2014 above configured threshold of ${alert.threshold.toFixed(0)}\u00B0C`}
          onDismiss={() => dismissAlert(alert.id)}
        />
      ))}

      <div className="flex-1 overflow-y-auto p-6">
        {!latest ? (
          <SkeletonMonitor />
        ) : (
          <div className="flex flex-col gap-4">
            {/* CPU Section — full-width chart */}
            <CpuSection cpu={latest.cpu} history={cpuHistory} />

            {/* RAM + GPU side by side */}
            <div className="grid grid-cols-2 gap-4">
              <RamSection ram={latest.ram} history={ramHistory} />
              <GpuSection gpu={latest.gpu} history={gpuHistory} tempHistory={gpuTempHistory} />
            </div>

            {/* Temperature details */}
            <TemperatureSection temperatures={latest.temperatures} />

            {/* Disks */}
            <DiskSection disks={latest.disks} />

            {/* Network */}
            {latest.network && latest.network.length > 0 && (
              <NetworkSection interfaces={latest.network} />
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Skeleton loading
// ---------------------------------------------------------------------------

function SkeletonMonitor() {
  return (
    <div className="flex flex-col gap-4">
      <SkeletonCard height={200} />
      <div className="grid grid-cols-2 gap-4">
        <SkeletonCard height={180} />
        <SkeletonCard height={180} />
      </div>
      <SkeletonCard height={120} />
      <SkeletonCard height={100} />
    </div>
  )
}

function SkeletonCard({ height = 140 }: { height?: number }) {
  return (
    <div
      className="rounded-lg p-4"
      style={{
        backgroundColor: 'var(--bg-2)',
        border: '1px solid var(--border-default)',
        minHeight: height,
      }}
    >
      <div
        className="h-3 w-16 rounded mb-3"
        style={{ backgroundColor: 'var(--border-default)' }}
      />
      <div
        className="h-6 w-24 rounded mb-2"
        style={{ backgroundColor: 'var(--border-default)' }}
      />
      <div
        className="h-3 w-32 rounded"
        style={{ backgroundColor: 'var(--border-subtle)' }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// CPU Section — larger chart
// ---------------------------------------------------------------------------

interface CpuSectionProps {
  cpu: CpuMetrics
  history: TimestampedValue[]
}

function CpuSection({ cpu, history }: CpuSectionProps) {
  return (
    <MonitorCard title="CPU" icon={<Cpu size={14} />}>
      {/* Main value row */}
      <div className="flex items-baseline gap-4 mb-3">
        <span
          className="text-3xl font-bold"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
        >
          {formatPercent(cpu.total_usage_percent, 0)}
        </span>
        <span
          className="text-sm"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
        >
          {formatFrequency(cpu.frequency_mhz)}
        </span>
        <span
          className="text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          {cpu.core_count} cores / {cpu.thread_count} threads
        </span>
      </div>

      {/* Large chart */}
      {history.length > 1 && (
        <div style={{ height: 100, marginBottom: 12 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history}>
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--color-primary)"
                dot={false}
                strokeWidth={1.5}
                isAnimationActive={false}
              />
              <YAxis domain={[0, 100]} hide />
              <XAxis dataKey="timestamp" hide />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Per-core bars */}
      {cpu.per_core_usage.length > 0 && (
        <div>
          <p
            className="text-xs mb-1.5"
            style={{ color: 'var(--text-muted)' }}
          >
            Per-core usage
          </p>
          <div className="flex gap-0.5" style={{ height: 24 }}>
            {cpu.per_core_usage.slice(0, 32).map((usage, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm"
                style={{
                  backgroundColor: usageColor(usage),
                  opacity: 0.3 + (usage / 100) * 0.7,
                  minWidth: 3,
                }}
                title={`Core ${i}: ${usage.toFixed(0)}%`}
              />
            ))}
          </div>
        </div>
      )}
    </MonitorCard>
  )
}

// ---------------------------------------------------------------------------
// RAM Section
// ---------------------------------------------------------------------------

interface RamSectionProps {
  ram: RamMetrics
  history: TimestampedValue[]
}

function RamSection({ ram, history }: RamSectionProps) {
  const color = usageColor(ram.usage_percent)

  return (
    <MonitorCard title="RAM" icon={<HardDrive size={14} />}>
      <div className="flex items-baseline gap-2 mb-2">
        <span
          className="text-2xl font-bold"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
        >
          {formatPercent(ram.usage_percent, 0)}
        </span>
        <span
          className="text-xs"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
        >
          {formatBytes(ram.used_bytes, 1)} / {formatBytes(ram.total_bytes, 1)}
        </span>
      </div>

      {/* Usage bar */}
      <UsageBar percent={ram.usage_percent} color={color} />

      {/* Chart */}
      {history.length > 1 && (
        <div style={{ height: 60, marginTop: 8, marginBottom: 8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history}>
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--color-primary)"
                dot={false}
                strokeWidth={1.5}
                isAnimationActive={false}
              />
              <YAxis domain={[0, 100]} hide />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="flex items-center gap-4 mt-2">
        <Detail label="Available" value={formatBytes(ram.available_bytes, 1)} />
        {ram.swap_total_bytes > 0 && (
          <Detail
            label="Swap"
            value={`${formatBytes(ram.swap_used_bytes, 1)} / ${formatBytes(ram.swap_total_bytes, 1)}`}
          />
        )}
      </div>
    </MonitorCard>
  )
}

// ---------------------------------------------------------------------------
// GPU Section
// ---------------------------------------------------------------------------

interface GpuSectionProps {
  gpu: GpuMetrics | null
  history: TimestampedValue[]
  tempHistory: TimestampedValue[]
}

function GpuSection({ gpu, history, tempHistory }: GpuSectionProps) {
  if (!gpu) {
    return (
      <MonitorCard title="GPU" icon={<Cpu size={14} />}>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No NVIDIA GPU detected via NVML. AMD and Intel GPUs have limited
          monitoring support.
        </p>
      </MonitorCard>
    )
  }

  return (
    <MonitorCard title="GPU" icon={<Cpu size={14} />} subtitle={gpu.name}>
      <div className="flex items-baseline gap-2 mb-2">
        <span
          className="text-2xl font-bold"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
        >
          {formatPercent(gpu.utilization_percent, 0)}
        </span>
        {gpu.temperature_c != null && (
          <span
            className="text-sm font-medium"
            style={{
              color: tempColor(gpu.temperature_c),
              fontFamily: 'var(--font-mono)',
            }}
          >
            {formatTemp(gpu.temperature_c)}
          </span>
        )}
      </div>

      {/* Utilization chart */}
      {history.length > 1 && (
        <div style={{ height: 60, marginBottom: 8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history}>
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--color-primary)"
                dot={false}
                strokeWidth={1.5}
                isAnimationActive={false}
              />
              <YAxis domain={[0, 100]} hide />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Temperature chart (if available) */}
      {tempHistory.length > 1 && (
        <div style={{ height: 40, marginBottom: 8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={tempHistory}>
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--color-warning)"
                dot={false}
                strokeWidth={1}
                isAnimationActive={false}
              />
              <YAxis domain={[20, 100]} hide />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="flex items-center gap-4">
        <Detail
          label="VRAM"
          value={`${formatBytes(gpu.vram_used_bytes, 1)} / ${formatBytes(gpu.vram_total_bytes, 1)}`}
        />
        {gpu.clock_mhz > 0 && (
          <Detail label="Clock" value={formatFrequency(gpu.clock_mhz)} />
        )}
        {gpu.power_watts != null && (
          <Detail label="Power" value={`${gpu.power_watts.toFixed(0)} W`} />
        )}
        {gpu.fan_speed_percent != null && (
          <Detail label="Fan" value={formatPercent(gpu.fan_speed_percent, 0)} />
        )}
      </div>
    </MonitorCard>
  )
}

// ---------------------------------------------------------------------------
// Temperature Section
// ---------------------------------------------------------------------------

interface TemperatureSectionProps {
  temperatures: TemperatureMetrics
}

function TemperatureSection({ temperatures }: TemperatureSectionProps) {
  const hasAny =
    temperatures.cpu_temp_c != null ||
    temperatures.gpu_temp_c != null ||
    temperatures.motherboard_temp_c != null ||
    temperatures.disk_temps_c.length > 0

  return (
    <MonitorCard title="Temperatures" icon={<Thermometer size={14} />}>
      {!hasAny ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No temperature sensors detected. This is normal on some hardware
          configurations.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-8 gap-y-2">
          {temperatures.cpu_temp_c != null && (
            <TempRow label="CPU" temp={temperatures.cpu_temp_c} />
          )}
          {temperatures.gpu_temp_c != null && (
            <TempRow label="GPU" temp={temperatures.gpu_temp_c} />
          )}
          {temperatures.motherboard_temp_c != null && (
            <TempRow label="Motherboard" temp={temperatures.motherboard_temp_c} />
          )}
          {temperatures.disk_temps_c.map(([name, temp]) => (
            <TempRow key={name} label={name} temp={temp} />
          ))}
        </div>
      )}
    </MonitorCard>
  )
}

function TempRow({ label, temp }: { label: string; temp: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
      <span
        className="text-sm font-medium"
        style={{ color: tempColor(temp), fontFamily: 'var(--font-mono)' }}
      >
        {formatTemp(temp)}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Disk Section
// ---------------------------------------------------------------------------

interface DiskSectionProps {
  disks: DiskMetrics[]
}

function DiskSection({ disks }: DiskSectionProps) {
  if (disks.length === 0) return null

  return (
    <MonitorCard title="Disks" icon={<HardDrive size={14} />}>
      <div className="flex flex-col gap-2">
        {disks.map((disk) => (
          <DiskRow key={disk.mount_point} disk={disk} />
        ))}
      </div>
    </MonitorCard>
  )
}

function DiskRow({ disk }: { disk: DiskMetrics }) {
  const color = usageColor(disk.usage_percent)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {disk.mount_point} {disk.name && `(${disk.name})`}
        </span>
        <span
          className="text-xs"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
        >
          {formatBytes(disk.used_bytes, 1)} / {formatBytes(disk.total_bytes, 1)} ({formatPercent(disk.usage_percent, 0)})
        </span>
      </div>
      <UsageBar percent={disk.usage_percent} color={color} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Network Section
// ---------------------------------------------------------------------------

interface NetworkSectionProps {
  interfaces: NetworkMetrics[]
}

function NetworkSection({ interfaces }: NetworkSectionProps) {
  return (
    <MonitorCard title="Network" icon={<Wifi size={14} />}>
      <div className="flex flex-col gap-2">
        {interfaces.map((iface) => (
          <div
            key={iface.interface_name}
            className="flex items-center justify-between"
          >
            <span
              className="text-xs truncate max-w-[250px]"
              style={{ color: 'var(--text-secondary)' }}
            >
              {iface.interface_name}
            </span>
            <div className="flex items-center gap-6">
              <span
                className="text-xs"
                style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
              >
                {formatBytes(iface.bytes_sent, 1)} sent
              </span>
              <span
                className="text-xs"
                style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
              >
                {formatBytes(iface.bytes_received, 1)} recv
              </span>
            </div>
          </div>
        ))}
      </div>
    </MonitorCard>
  )
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

interface MonitorCardProps {
  title: string
  icon: React.ReactNode
  subtitle?: string
  children: React.ReactNode
}

function MonitorCard({ title, icon, subtitle, children }: MonitorCardProps) {
  return (
    <div
      className="rounded-lg p-4"
      style={{
        backgroundColor: 'var(--bg-2)',
        border: '1px solid var(--border-default)',
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span style={{ color: 'var(--color-primary)' }}>{icon}</span>
        <h3
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-muted)' }}
        >
          {title}
        </h3>
        {subtitle && (
          <span
            className="text-xs truncate"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
          >
            {subtitle}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {label}:{' '}
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

function UsageBar({ percent, color }: { percent: number; color: string }) {
  return (
    <div
      className="w-full rounded-full overflow-hidden"
      style={{
        height: 6,
        backgroundColor: 'var(--border-default)',
      }}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${Math.min(percent, 100)}%`,
          backgroundColor: color,
          transition: 'width 300ms ease',
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

function usageColor(percent: number): string {
  if (percent > 90) return 'var(--color-danger)'
  if (percent > 70) return 'var(--color-warning)'
  return 'var(--color-success)'
}

function tempColor(celsius: number): string {
  if (celsius > 85) return 'var(--color-danger)'
  if (celsius > 70) return 'var(--color-warning)'
  return 'var(--color-success)'
}
