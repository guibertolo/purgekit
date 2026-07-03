import { useCallback, useState } from 'react'
import {
  Layers,
  Search,
  Trash2,
  Cpu,
  CheckSquare,
  Square,
  AlertTriangle,
  CheckCircle,
  Monitor,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import Button from '@/components/common/Button'
import Badge from '@/components/common/Badge'
import ConfirmDialog from '@/components/feedback/ConfirmDialog'
import ProgressOverlay from '@/components/feedback/ProgressOverlay'
import { showToast } from '@/components/feedback/Toast'
import { useGpuStore } from '@/stores/gpu-store'
import { invoke } from '@/lib/tauri'
import { formatBytes, formatDuration } from '@/lib/format'
import type {
  GpuInfo,
  GpuScanResult,
  GpuCleanResult,
  GpuCacheCategory,
  GpuCachePath,
} from '@/types/cleaner'

/**
 * GPU Cache page — detect GPUs and manage shader caches.
 * Implements Stories 3.1-3.4 (GPU detection + shader cache scan/clean).
 *
 * Honest UI: shader caches are regenerated automatically. Cleaning
 * may cause slightly longer first loads in games — we tell the user.
 */
export default function GpuCache() {
  const {
    gpus,
    scanResult,
    cleanResult,
    selectedCategories,
    isDetecting,
    isScanning,
    isCleaning,
    setGpus,
    setScanResult,
    setCleanResult,
    toggleCategory,
    selectAllAvailable,
    deselectAll,
    setDetecting,
    setScanning,
    setCleaning,
  } = useGpuStore()

  const [showConfirm, setShowConfirm] = useState(false)
  const [cleanProgress, setCleanProgress] = useState<number | null>(null)

  // --- Detect GPUs ---
  const handleDetect = useCallback(async () => {
    setDetecting(true)
    try {
      const detected = await invoke<GpuInfo[]>('detect_gpus', {})
      setGpus(detected)
      if (detected.length === 0) {
        showToast('info', 'No GPUs detected via NVML or WMI.')
      } else {
        showToast('success', `Detected ${detected.length} GPU(s).`)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast('error', `GPU detection failed: ${msg}`)
    } finally {
      setDetecting(false)
    }
  }, [setDetecting, setGpus])

  // --- Scan Shader Caches ---
  const handleScan = useCallback(async () => {
    setScanning(true)
    setScanResult(null)
    setCleanResult(null)

    try {
      const result = await invoke<GpuScanResult>('scan_gpu_cache', {})
      setScanResult(result)
      if (result.total_size_bytes === 0) {
        showToast('info', 'No shader cache files found.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast('error', `Shader cache scan failed: ${msg}`)
    } finally {
      setScanning(false)
    }
  }, [setScanning, setScanResult, setCleanResult])

  // --- Clean Selected ---
  const handleCleanConfirm = useCallback(async () => {
    setShowConfirm(false)
    setCleaning(true)
    setCleanProgress(10)

    try {
      const ids = Array.from(selectedCategories)
      setCleanProgress(30)
      const result = await invoke<GpuCleanResult>('clean_gpu_cache', {
        categories: ids,
      })
      setCleanProgress(70)
      setCleanResult(result)

      if (result.cleaned_bytes > 0) {
        showToast('success', `Freed ${formatBytes(result.cleaned_bytes)}.`)
      } else {
        showToast('info', 'No shader cache files were removed.')
      }

      // Re-scan to update sizes
      setCleanProgress(90)
      const updated = await invoke<GpuScanResult>('scan_gpu_cache', {})
      setScanResult(updated)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast('error', `Shader cache clean failed: ${msg}`)
    } finally {
      setCleaning(false)
      setCleanProgress(null)
    }
  }, [selectedCategories, setCleaning, setCleanResult, setScanResult])

  // --- Computed ---
  const selectedSize = scanResult
    ? scanResult.cache_categories
        .filter((c) => selectedCategories.has(c.id))
        .reduce((sum, c) => sum + c.total_size_bytes, 0)
    : 0

  const hasSelection = selectedCategories.size > 0
  const availableCategories = scanResult
    ? scanResult.cache_categories.filter((c) => c.available)
    : []
  const allAvailableSelected =
    availableCategories.length > 0 &&
    availableCategories.every((c) => selectedCategories.has(c.id))

  return (
    <>
      <Header
        title="GPU Cache"
        icon={<Layers size={20} strokeWidth={1.5} />}
        actions={
          <div className="flex items-center gap-2">
            {scanResult && (
              <span
                className="text-xs"
                style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
              >
                Scanned in {formatDuration(scanResult.scan_duration_ms)}
              </span>
            )}
            <Button onClick={handleDetect} disabled={isDetecting || isScanning || isCleaning}>
              <span className="flex items-center gap-1.5">
                <Cpu size={14} />
                {isDetecting ? 'Detecting...' : 'Detect GPUs'}
              </span>
            </Button>
            <Button onClick={handleScan} disabled={isScanning || isCleaning}>
              <span className="flex items-center gap-1.5">
                <Search size={14} />
                {isScanning ? 'Scanning...' : 'Scan Caches'}
              </span>
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* No data yet */}
        {gpus.length === 0 && !scanResult && !isDetecting && !isScanning && (
          <EmptyState />
        )}

        {/* Loading spinner */}
        {(isDetecting || isScanning) && !scanResult && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div
                className="w-8 h-8 border-2 rounded-full mx-auto mb-3"
                style={{
                  borderColor: 'var(--border-default)',
                  borderTopColor: 'var(--color-primary)',
                  animation: 'spin 1s linear infinite',
                }}
              />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {isDetecting ? 'Detecting GPUs...' : 'Scanning shader caches...'}
              </p>
            </div>
          </div>
        )}

        {/* GPU cards (shown after detection or scan) */}
        {gpus.length > 0 && !isDetecting && (
          <div className="flex flex-col gap-4">
            {/* GPU Cards */}
            <div className="flex flex-col gap-2">
              {gpus.map((gpu) => (
                <GpuCard key={gpu.index} gpu={gpu} />
              ))}
            </div>

            {/* Shader cache warning */}
            <div
              className="flex items-start gap-3 rounded-lg px-4 py-3"
              style={{
                backgroundColor: 'rgba(255, 179, 0, 0.05)',
                border: '1px solid rgba(255, 179, 0, 0.15)',
              }}
            >
              <AlertTriangle
                size={16}
                className="flex-shrink-0 mt-0.5"
                style={{ color: 'var(--color-warning)' }}
              />
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Shader caches are recreated automatically by GPU drivers. Cleaning them is
                safe but the first load of games or applications may be slightly slower while
                shaders are recompiled.
              </p>
            </div>

            {/* Scan results */}
            {scanResult && !isScanning && (
              <>
                {/* Actions bar */}
                <div
                  className="flex items-center justify-between rounded-lg px-4 py-3"
                  style={{
                    backgroundColor: 'var(--bg-2)',
                    border: '1px solid var(--border-default)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={allAvailableSelected ? deselectAll : selectAllAvailable}
                      className="flex items-center gap-1.5 text-xs"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-primary)',
                        cursor: 'pointer',
                        padding: 0,
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      {allAvailableSelected ? (
                        <>
                          <Square size={14} /> Deselect All
                        </>
                      ) : (
                        <>
                          <CheckSquare size={14} /> Select All
                        </>
                      )}
                    </button>
                    <span
                      className="text-xs"
                      style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                    >
                      {selectedCategories.size} of {scanResult.cache_categories.length} selected
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className="text-sm font-medium"
                      style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
                    >
                      Selected: {formatBytes(selectedSize)}
                    </span>
                    <Button
                      variant="danger"
                      disabled={!hasSelection || isCleaning}
                      onClick={() => setShowConfirm(true)}
                    >
                      <span className="flex items-center gap-1.5">
                        <Trash2 size={14} />
                        Clean Selected
                      </span>
                    </Button>
                  </div>
                </div>

                {/* Clean result summary */}
                {cleanResult && <GpuCleanSummary result={cleanResult} />}

                {/* All clean */}
                {scanResult.total_size_bytes === 0 && (
                  <div
                    className="flex items-center gap-3 rounded-lg px-4 py-3"
                    style={{
                      backgroundColor: 'rgba(0, 230, 118, 0.05)',
                      border: '1px solid rgba(0, 230, 118, 0.2)',
                    }}
                  >
                    <CheckCircle size={18} style={{ color: 'var(--color-success)' }} />
                    <p className="text-sm" style={{ color: 'var(--color-success)' }}>
                      All clean. No shader cache files found.
                    </p>
                  </div>
                )}

                {/* Cache categories */}
                <div className="flex flex-col gap-1">
                  {scanResult.cache_categories.map((cat) => (
                    <CacheCategoryRow
                      key={cat.id}
                      category={cat}
                      selected={selectedCategories.has(cat.id)}
                      onToggle={() => toggleCategory(cat.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Confirm dialog */}
      {showConfirm && (
        <ConfirmDialog
          title="Clean Shader Caches"
          description={`This will delete shader cache files from ${selectedCategories.size} categories. Shaders will be recompiled on next use.`}
          details={`Estimated space to free: ${formatBytes(selectedSize)}`}
          onConfirm={handleCleanConfirm}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {/* Progress overlay */}
      {isCleaning && cleanProgress !== null && (
        <ProgressOverlay
          title="Cleaning Shader Caches"
          progress={cleanProgress}
          statusText="Removing shader cache files..."
        />
      )}

    </>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div
      className="rounded-lg p-6"
      style={{
        backgroundColor: 'var(--bg-2)',
        border: '1px solid var(--border-default)',
      }}
    >
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Click <strong>Detect GPUs</strong> to identify installed graphics cards, or{' '}
        <strong>Scan Caches</strong> to find and measure shader cache files from NVIDIA, AMD,
        and DirectX.
      </p>
    </div>
  )
}

interface GpuCardProps {
  gpu: GpuInfo
}

function GpuCard({ gpu }: GpuCardProps) {
  const vramMB = gpu.vram_bytes > 0 ? (gpu.vram_bytes / (1024 * 1024)).toFixed(0) : null

  return (
    <div
      className="flex items-center gap-4 rounded-lg px-4 py-3"
      style={{
        backgroundColor: 'var(--bg-2)',
        border: '1px solid var(--border-default)',
      }}
    >
      <div
        className="flex items-center justify-center w-10 h-10 rounded-lg"
        style={{
          backgroundColor: 'rgba(0, 210, 255, 0.08)',
        }}
      >
        <Monitor size={20} style={{ color: 'var(--color-primary)' }} />
      </div>

      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium truncate"
          style={{ color: 'var(--text-primary)' }}
        >
          {gpu.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge variant={gpu.vendor === 'NVIDIA' ? 'info' : gpu.vendor === 'AMD' ? 'caution' : 'neutral'}>
            {gpu.vendor}
          </Badge>
          {gpu.nvml_available && (
            <Badge variant="info">NVML</Badge>
          )}
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        {vramMB && (
          <p
            className="text-sm font-medium"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
          >
            {Number(vramMB) >= 1024
              ? `${(Number(vramMB) / 1024).toFixed(1)} GB`
              : `${vramMB} MB`}
          </p>
        )}
        <p
          className="text-xs"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
        >
          Driver: {gpu.driver_version}
        </p>
      </div>
    </div>
  )
}

interface CacheCategoryRowProps {
  category: GpuCacheCategory
  selected: boolean
  onToggle: () => void
}

function CacheCategoryRow({ category, selected, onToggle }: CacheCategoryRowProps) {
  const isDisabled = !category.available || category.total_size_bytes === 0

  return (
    <div
      className="rounded-lg"
      style={{
        backgroundColor: selected ? 'rgba(0, 210, 255, 0.03)' : 'var(--bg-2)',
        border: `1px solid ${selected ? 'rgba(0, 210, 255, 0.15)' : 'var(--border-default)'}`,
        opacity: isDisabled ? 0.5 : 1,
      }}
    >
      {/* Category header */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ cursor: isDisabled ? 'not-allowed' : 'pointer' }}
        onClick={isDisabled ? undefined : onToggle}
      >
        {/* Checkbox */}
        <div
          className="flex items-center justify-center w-5 h-5 rounded flex-shrink-0"
          style={{
            backgroundColor: selected ? 'var(--color-primary)' : 'transparent',
            border: `2px solid ${selected ? 'var(--color-primary)' : 'var(--border-default)'}`,
            transition: 'background-color 150ms, border-color 150ms',
          }}
        >
          {selected && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M2.5 6L5 8.5L9.5 3.5"
                stroke="var(--text-inverse)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-sm font-medium"
              style={{ color: 'var(--text-primary)' }}
            >
              {category.name}
            </span>
            <Badge variant={category.vendor === 'NVIDIA' ? 'info' : category.vendor === 'AMD' ? 'caution' : 'neutral'}>
              {category.vendor}
            </Badge>
            {!category.available && (
              <Badge variant="neutral">Not detected</Badge>
            )}
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <p
            className="text-sm font-medium"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
          >
            {formatBytes(category.total_size_bytes)}
          </p>
        </div>
      </div>

      {/* Sub-paths */}
      {category.paths.length > 0 && category.available && (
        <div
          className="px-4 pb-3"
          style={{ borderTop: '1px solid var(--border-subtle)' }}
        >
          {category.paths.map((p) => (
            <CachePathRow key={p.label} path={p} />
          ))}
        </div>
      )}
    </div>
  )
}

interface CachePathRowProps {
  path: GpuCachePath
}

function CachePathRow({ path }: CachePathRowProps) {
  return (
    <div className="flex items-center justify-between py-1.5 pl-8">
      <div className="min-w-0 flex-1">
        <p
          className="text-xs truncate"
          style={{ color: 'var(--text-secondary)' }}
        >
          {path.label}
        </p>
        <p
          className="text-xs truncate"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
        >
          {path.path}
        </p>
      </div>
      <div className="text-right flex-shrink-0 ml-4">
        <p
          className="text-xs"
          style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
        >
          {path.exists ? formatBytes(path.size_bytes) : 'Not found'}
        </p>
        {path.exists && path.file_count > 0 && (
          <p
            className="text-xs"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
          >
            {path.file_count.toLocaleString()} files
          </p>
        )}
      </div>
    </div>
  )
}

interface GpuCleanSummaryProps {
  result: GpuCleanResult
}

function GpuCleanSummary({ result }: GpuCleanSummaryProps) {
  return (
    <div
      className="rounded-lg p-4"
      style={{
        backgroundColor: 'rgba(0, 230, 118, 0.05)',
        border: '1px solid rgba(0, 230, 118, 0.2)',
      }}
    >
      <h3
        className="text-sm font-semibold mb-2"
        style={{ color: 'var(--text-primary)' }}
      >
        Cleanup Summary
      </h3>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p
            className="text-lg font-bold"
            style={{ color: 'var(--color-success)', fontFamily: 'var(--font-mono)' }}
          >
            {formatBytes(result.cleaned_bytes)}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Freed
          </p>
        </div>
        <div>
          <p
            className="text-lg font-bold"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
          >
            {result.categories_cleaned.length}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Categories
          </p>
        </div>
        <div>
          <p
            className="text-lg font-bold"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
          >
            {formatDuration(result.duration_ms)}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Duration
          </p>
        </div>
      </div>

      {result.first_load_slower_warning && (
        <div className="mt-3 flex items-center gap-1.5">
          <AlertTriangle size={12} style={{ color: 'var(--color-warning)' }} />
          <p className="text-xs" style={{ color: 'var(--color-warning)' }}>
            First load of games may be slightly slower while shaders are recompiled.
          </p>
        </div>
      )}

      {result.failed_bytes > 0 && (
        <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          {formatBytes(result.failed_bytes)} could not be removed (files in use or access denied).
        </p>
      )}
    </div>
  )
}
