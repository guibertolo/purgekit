import { LayoutDashboard, Cpu, HardDrive, Thermometer, Wifi } from 'lucide-react'
import { LineChart, Line, YAxis, ResponsiveContainer } from 'recharts'
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
 * Dashboard page — real-time system overview.
 * Integrates CPU, RAM, GPU, temperature, and disk metrics.
 *
 * Honest UI: factual data, no alarmism, neutral language.
 */
export default function Dashboard() {
  const latest = useSystemMetrics()
  const cpuHistory = useMetricsStore((s) => s.cpuHistory)
  const gpuHistory = useMetricsStore((s) => s.gpuHistory)
  const alerts = useMonitorStore((s) => s.temperatureAlerts)
  const dismissAlert = useMonitorStore((s) => s.dismissAlert)

  return (
    <>
      <Header
        title="Dashboard"
        icon={<LayoutDashboard size={20} strokeWidth={1.5} />}
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
          <SkeletonDashboard />
        ) : (
          <div className="flex flex-col gap-4">
            {/* Row 1: CPU + RAM */}
            <div className="grid grid-cols-2 gap-4">
              <CpuCard cpu={latest.cpu} history={cpuHistory} />
              <RamCard ram={latest.ram} />
            </div>

            {/* Row 2: GPU + Temperature */}
            <div className="grid grid-cols-2 gap-4">
              <GpuCard gpu={latest.gpu} history={gpuHistory} />
              <TemperatureCard temperatures={latest.temperatures} />
            </div>

            {/* Row 3: Disks */}
            <DiskSection disks={latest.disks} />

            {/* Row 4: Network */}
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

function SkeletonDashboard() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <SkeletonCard />
    </div>
  )
}

function SkeletonCard() {
  return (
    <div
      className="rounded-lg p-4"
      style={{
        backgroundColor: 'var(--bg-2)',
        border: '1px solid var(--border-default)',
        minHeight: 140,
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
        className="h-3 w-32 rounded mb-4"
        style={{ backgroundColor: 'var(--border-default)' }}
      />
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Loading system metrics...
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CPU Card
// ---------------------------------------------------------------------------

interface CpuCardProps {
  cpu: CpuMetrics
  history: TimestampedValue[]
}

function CpuCard({ cpu, history }: CpuCardProps) {
  return (
    <MetricCard title="CPU" icon={<Cpu size={14} />}>
      {/* Main value */}
      <div className="flex items-baseline gap-2 mb-2">
        <span
          className="text-2xl font-bold"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
        >
          {formatPercent(cpu.total_usage_percent, 0)}
        </span>
        <span
          className="text-xs"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
        >
          {formatFrequency(cpu.frequency_mhz)}
        </span>
      </div>

      {/* Chart */}
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

      {/* Details */}
      <div className="flex items-center gap-4">
        <Detail label="Cores" value={`${cpu.core_count}`} />
        <Detail label="Threads" value={`${cpu.thread_count}`} />
      </div>

      {/* Per-core mini bars (first 16 cores) */}
      {cpu.per_core_usage.length > 0 && (
        <div className="flex gap-0.5 mt-2" style={{ height: 16 }}>
          {cpu.per_core_usage.slice(0, 16).map((usage, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm"
              style={{
                backgroundColor: usageColor(usage),
                opacity: 0.4 + (usage / 100) * 0.6,
                minWidth: 3,
              }}
              title={`Core ${i}: ${usage.toFixed(0)}%`}
            />
          ))}
        </div>
      )}
    </MetricCard>
  )
}

// ---------------------------------------------------------------------------
// RAM Card
// ---------------------------------------------------------------------------

interface RamCardProps {
  ram: RamMetrics
}

function RamCard({ ram }: RamCardProps) {
  const color = usageColor(ram.usage_percent)

  return (
    <MetricCard title="RAM" icon={<HardDrive size={14} />}>
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

      <div className="flex items-center gap-4 mt-2">
        <Detail label="Available" value={formatBytes(ram.available_bytes, 1)} />
        {ram.swap_total_bytes > 0 && (
          <Detail
            label="Swap"
            value={`${formatBytes(ram.swap_used_bytes, 1)} / ${formatBytes(ram.swap_total_bytes, 1)}`}
          />
        )}
      </div>
    </MetricCard>
  )
}

// ---------------------------------------------------------------------------
// GPU Card
// ---------------------------------------------------------------------------

interface GpuCardProps {
  gpu: GpuMetrics | null
  history: TimestampedValue[]
}

function GpuCard({ gpu, history }: GpuCardProps) {
  if (!gpu) {
    return (
      <MetricCard title="GPU" icon={<Cpu size={14} />}>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No NVIDIA GPU detected via NVML. AMD and Intel GPUs have limited
          monitoring support.
        </p>
      </MetricCard>
    )
  }

  return (
    <MetricCard title="GPU" icon={<Cpu size={14} />} subtitle={gpu.name}>
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

      {/* Chart */}
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
    </MetricCard>
  )
}

// ---------------------------------------------------------------------------
// Temperature Card
// ---------------------------------------------------------------------------

interface TemperatureCardProps {
  temperatures: TemperatureMetrics
}

function TemperatureCard({ temperatures }: TemperatureCardProps) {
  const hasAny =
    temperatures.cpu_temp_c != null ||
    temperatures.gpu_temp_c != null ||
    temperatures.motherboard_temp_c != null ||
    temperatures.disk_temps_c.length > 0

  return (
    <MetricCard title="Temperature" icon={<Thermometer size={14} />}>
      {!hasAny ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No temperature sensors detected. This is normal on some hardware.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
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
    </MetricCard>
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
    <MetricCard title="Disks" icon={<HardDrive size={14} />}>
      <div className="flex flex-col gap-2">
        {disks.map((disk) => (
          <DiskRow key={disk.mount_point} disk={disk} />
        ))}
      </div>
    </MetricCard>
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
  if (interfaces.length === 0) return null

  return (
    <MetricCard title="Network" icon={<Wifi size={14} />}>
      <div className="flex flex-col gap-2">
        {interfaces.map((iface) => (
          <NetworkRow key={iface.interface_name} iface={iface} />
        ))}
      </div>
    </MetricCard>
  )
}

function NetworkRow({ iface }: { iface: NetworkMetrics }) {
  return (
    <div className="flex items-center justify-between">
      <span
        className="text-xs truncate max-w-[200px]"
        style={{ color: 'var(--text-secondary)' }}
      >
        {iface.interface_name}
      </span>
      <div className="flex items-center gap-4">
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
  )
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

interface MetricCardProps {
  title: string
  icon: React.ReactNode
  subtitle?: string
  children: React.ReactNode
}

function MetricCard({ title, icon, subtitle, children }: MetricCardProps) {
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
      <span
        className="text-xs"
        style={{ color: 'var(--text-muted)' }}
      >
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
