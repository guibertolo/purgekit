import { useEffect, useCallback, useState } from 'react'
import { Trash2, Search, CheckSquare, Square, Shield, AlertTriangle, CheckCircle } from 'lucide-react'
import Header from '@/components/layout/Header'
import Button from '@/components/common/Button'
import Badge from '@/components/common/Badge'
import ConfirmDialog from '@/components/feedback/ConfirmDialog'
import ProgressOverlay from '@/components/feedback/ProgressOverlay'
import { showToast } from '@/components/feedback/Toast'
import { useCleanerStore } from '@/stores/cleaner-store'
import { useElevation } from '@/hooks/useElevation'
import { invoke, listen } from '@/lib/tauri'
import { formatBytes, formatDuration } from '@/lib/format'
import type { ScanResult, CleanResult, CleanupProgress, CacheCategory } from '@/types/cleaner'

/**
 * Cache Cleaner page — scan and clean temporary files, browser caches, etc.
 * Implements Stories 2.1-2.5 of Epic 2 (System Cache Cleaner).
 *
 * Honest UI: no alarmism, factual data, neutral language.
 */
export default function CacheCleaner() {
  const {
    scanResult,
    cleanResult,
    selectedCategories,
    isScanning,
    isCleaning,
    progress,
    setScanResult,
    setCleanResult,
    toggleCategory,
    selectAll,
    deselectAll,
    setScanning,
    setCleaning,
    setProgress,
  } = useCleanerStore()

  const { isElevated } = useElevation()
  const [showConfirm, setShowConfirm] = useState(false)

  // Listen for cleanup progress events
  useEffect(() => {
    let unlisten: (() => void) | null = null

    listen<CleanupProgress>('cleanup-progress', (payload) => {
      setProgress(payload)
    }).then((fn) => {
      unlisten = fn
    })

    return () => {
      unlisten?.()
    }
  }, [setProgress])

  // --- Scan ---
  const handleScan = useCallback(async () => {
    setScanning(true)
    setScanResult(null)
    setCleanResult(null)

    try {
      const result = await invoke<ScanResult>('scan_system_cache', {})
      setScanResult(result)
      if (result.total_size_bytes === 0) {
        showToast('info', 'All clean! No cache files found.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast('error', `Scan failed: ${msg}`)
    } finally {
      setScanning(false)
    }
  }, [setScanning, setScanResult, setCleanResult])

  // --- Clean ---
  const handleCleanConfirm = useCallback(async () => {
    setShowConfirm(false)
    setCleaning(true)
    setProgress(null)

    try {
      const ids = Array.from(selectedCategories)
      const result = await invoke<CleanResult>('clean_system_cache', {
        categories: ids,
      })
      setCleanResult(result)

      if (result.total_freed_bytes > 0) {
        showToast(
          'success',
          `Freed ${formatBytes(result.total_freed_bytes)} (${result.files_deleted} files deleted)`,
        )
      } else {
        showToast('info', 'No files were removed.')
      }

      // Show warnings as separate toasts
      for (const warn of result.warnings) {
        showToast('info', warn)
      }

      // Re-scan to update sizes
      const updated = await invoke<ScanResult>('scan_system_cache', {})
      setScanResult(updated)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast('error', `Clean failed: ${msg}`)
    } finally {
      setCleaning(false)
      setProgress(null)
    }
  }, [selectedCategories, setCleaning, setProgress, setCleanResult, setScanResult])

  // --- Computed values ---
  const selectedSize = scanResult
    ? scanResult.categories
        .filter((c) => selectedCategories.has(c.id))
        .reduce((sum, c) => sum + c.size_bytes, 0)
    : 0

  const hasSelection = selectedCategories.size > 0
  const allSelected =
    scanResult !== null && selectedCategories.size === scanResult.categories.length

  return (
    <>
      <Header
        title="Cache Cleaner"
        icon={<Trash2 size={20} strokeWidth={1.5} />}
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
            <Button onClick={handleScan} disabled={isScanning || isCleaning}>
              <span className="flex items-center gap-1.5">
                <Search size={14} />
                {isScanning ? 'Scanning...' : 'Scan'}
              </span>
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* No scan result yet */}
        {!scanResult && !isScanning && (
          <EmptyState />
        )}

        {/* Scanning spinner */}
        {isScanning && (
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
                Scanning system caches...
              </p>
            </div>
          </div>
        )}

        {/* Scan results */}
        {scanResult && !isScanning && (
          <div className="flex flex-col gap-4">
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
                  onClick={allSelected ? deselectAll : selectAll}
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
                  {allSelected ? (
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
                  {selectedCategories.size} of {scanResult.categories.length} selected
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
            {cleanResult && (
              <CleanResultSummary result={cleanResult} />
            )}

            {/* All clean state */}
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
                  All clean. No cache files found.
                </p>
              </div>
            )}

            {/* Categories list */}
            <div className="flex flex-col gap-1">
              {scanResult.categories.map((cat) => (
                <CategoryRow
                  key={cat.id}
                  category={cat}
                  selected={selectedCategories.has(cat.id)}
                  onToggle={() => handleCategoryToggle(cat, isElevated, toggleCategory)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Confirm dialog */}
      {showConfirm && (
        <ConfirmDialog
          title="Clean Selected Caches"
          description={`This will permanently delete cache files from ${selectedCategories.size} categories.`}
          details={`Estimated space to free: ${formatBytes(selectedSize)}`}
          onConfirm={handleCleanConfirm}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {/* Progress overlay */}
      {isCleaning && progress && (
        <ProgressOverlay
          title="Cleaning Cache"
          progress={progress.percent}
          statusText={progress.step}
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
        Click <strong>Scan</strong> to analyze system caches. PurgeKit will detect temp files,
        browser caches, Windows Update files, and more.
      </p>
    </div>
  )
}

function handleCategoryToggle(
  cat: CacheCategory,
  isElevated: boolean,
  toggleCategory: (id: string) => void,
) {
  if (cat.requires_elevation && !isElevated) {
    showToast('info', `"${cat.name}" requires administrator privileges. Run PurgeKit as admin to clean this category.`)
    return
  }
  toggleCategory(cat.id)
}

interface CategoryRowProps {
  category: CacheCategory
  selected: boolean
  onToggle: () => void
}

function CategoryRow({ category, selected, onToggle }: CategoryRowProps) {
  const isDisabled = category.requires_elevation && category.size_bytes === 0

  return (
    <div
      className="flex items-center gap-3 rounded-lg px-4 py-3"
      style={{
        backgroundColor: selected ? 'rgba(0, 210, 255, 0.03)' : 'var(--bg-2)',
        border: `1px solid ${selected ? 'rgba(0, 210, 255, 0.15)' : 'var(--border-default)'}`,
        opacity: isDisabled ? 0.6 : 1,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
      }}
      onClick={isDisabled ? undefined : onToggle}
    >
      {/* Checkbox */}
      <div
        className="flex items-center justify-center w-5 h-5 rounded"
        style={{
          backgroundColor: selected ? 'var(--color-primary)' : 'transparent',
          border: `2px solid ${selected ? 'var(--color-primary)' : 'var(--border-default)'}`,
          transition: 'background-color 150ms, border-color 150ms',
        }}
      >
        {selected && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="var(--text-inverse)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-medium truncate"
            style={{ color: 'var(--text-primary)' }}
          >
            {category.name}
          </span>
          {category.requires_elevation && (
            <Badge variant="caution">
              <span className="flex items-center gap-1">
                <Shield size={10} /> Requires Admin
              </span>
            </Badge>
          )}
          {category.browser_running && (
            <Badge variant="caution">
              <span className="flex items-center gap-1">
                <AlertTriangle size={10} /> Browser open
              </span>
            </Badge>
          )}
        </div>
        <p
          className="text-xs truncate mt-0.5"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
        >
          {category.path}
        </p>
      </div>

      {/* Size and count */}
      <div className="text-right flex-shrink-0">
        <p
          className="text-sm font-medium"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
        >
          {formatBytes(category.size_bytes)}
        </p>
        {category.file_count > 0 && (
          <p
            className="text-xs"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
          >
            {category.file_count.toLocaleString()} files
          </p>
        )}
      </div>
    </div>
  )
}

interface CleanResultSummaryProps {
  result: CleanResult
}

function CleanResultSummary({ result }: CleanResultSummaryProps) {
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
      <div className="grid grid-cols-4 gap-4 text-center">
        <div>
          <p
            className="text-lg font-bold"
            style={{ color: 'var(--color-success)', fontFamily: 'var(--font-mono)' }}
          >
            {formatBytes(result.total_freed_bytes)}
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
            {result.files_deleted.toLocaleString()}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Deleted
          </p>
        </div>
        <div>
          <p
            className="text-lg font-bold"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
          >
            {result.files_skipped.toLocaleString()}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Skipped
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

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="mt-3 flex flex-col gap-1">
          {result.warnings.map((w, i) => (
            <p
              key={i}
              className="text-xs flex items-center gap-1.5"
              style={{ color: 'var(--color-warning)' }}
            >
              <AlertTriangle size={12} /> {w}
            </p>
          ))}
        </div>
      )}

      {/* Errors */}
      {result.errors.length > 0 && (
        <div className="mt-3 flex flex-col gap-1">
          {result.errors.map((e, i) => (
            <p
              key={i}
              className="text-xs"
              style={{ color: 'var(--color-danger)' }}
            >
              {e}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
