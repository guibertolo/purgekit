import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  Terminal,
  Search,
  Trash2,
  CheckSquare,
  Square,
  CheckCircle,
  FolderOpen,
  HardDrive,
  Package,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import Button from '@/components/common/Button'
import Badge from '@/components/common/Badge'
import ConfirmDialog from '@/components/feedback/ConfirmDialog'
import ProgressOverlay from '@/components/feedback/ProgressOverlay'
import { showToast } from '@/components/feedback/Toast'
import { useDeveloperStore } from '@/stores/developer-store'
import { invoke, listen } from '@/lib/tauri'
import { formatBytes } from '@/lib/format'
import type {
  DevToolInfo,
  NodeModulesEntry,
  DevCacheCategory,
  DevCleanResult,
  DevScanProgress,
  DockerPruneResult,
  Wsl2DistroInfo,
  NodeModulesStatus,
} from '@/types/cleaner'

/**
 * Developer Mode page — detect dev tools, scan caches, clean up.
 * Implements Stories 9.1-9.5 (Epic 9 - Developer Mode).
 *
 * Honest UI: shows real sizes, no inflated numbers.
 */
export default function DeveloperMode() {
  const store = useDeveloperStore()

  const [showCleanConfirm, setShowCleanConfirm] = useState(false)
  const [showWslConfirm, setShowWslConfirm] = useState<Wsl2DistroInfo | null>(null)
  const [showDockerConfirm, setShowDockerConfirm] = useState(false)
  const [cleanProgress, setCleanProgress] = useState<number | null>(null)

  const hasScanned =
    store.jsCaches.length > 0 ||
    store.langCaches.length > 0 ||
    store.nodeModules.length > 0

  // Listen for node_modules scan progress
  useEffect(() => {
    let unlisten: (() => void) | undefined
    listen<DevScanProgress>('dev-scan-progress', (p) => {
      store.setNodeScanProgress({ scanned: p.scanned_dirs, found: p.found_count })
    }).then((fn) => {
      unlisten = fn
    })
    return () => unlisten?.()
  }, [])

  // --- Detect Tools ---
  const handleDetect = useCallback(async () => {
    store.setDetecting(true)
    try {
      const tools = await invoke<DevToolInfo[]>('detect_dev_tools', {})
      store.setTools(tools)
      const detected = tools.filter((t) => t.detected).length
      showToast('success', `Detected ${detected} of ${tools.length} tools.`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast('error', `Detection failed: ${msg}`)
    } finally {
      store.setDetecting(false)
    }
  }, [store])

  // --- Scan All Caches ---
  const handleScanAll = useCallback(async () => {
    store.setCacheScanning(true)
    store.setNodeScanning(true)
    store.setCleanResults([])

    try {
      const [jsResult, langResult, dockerResult, nodeResult, wslResult] =
        await Promise.allSettled([
          invoke<DevCacheCategory[]>('scan_js_caches', {}),
          invoke<DevCacheCategory[]>('scan_language_caches', {}),
          invoke<DevCacheCategory>('scan_docker_usage', {}),
          invoke<NodeModulesEntry[]>('scan_node_modules', {
            scanDirs: [],
            inactiveThresholdDays: 90,
          }),
          invoke<Wsl2DistroInfo[]>('detect_wsl2_distributions', {}),
        ])

      if (jsResult.status === 'fulfilled') store.setJsCaches(jsResult.value)
      if (langResult.status === 'fulfilled') store.setLangCaches(langResult.value)
      if (dockerResult.status === 'fulfilled') store.setDockerCache(dockerResult.value)
      if (nodeResult.status === 'fulfilled') store.setNodeModules(nodeResult.value)
      if (wslResult.status === 'fulfilled') store.setWsl2Distros(wslResult.value)

      showToast('success', 'Scan complete.')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast('error', `Scan failed: ${msg}`)
    } finally {
      store.setCacheScanning(false)
      store.setNodeScanning(false)
      store.setNodeScanProgress(null)
    }
  }, [store])

  // --- Clean Selected ---
  const handleCleanConfirm = useCallback(async () => {
    setShowCleanConfirm(false)
    store.setCleaning(true)
    setCleanProgress(10)

    const allResults: DevCleanResult[] = []

    try {
      // 1. Clean JS caches
      const jsIds = Array.from(store.selectedCaches).filter((id) => id.startsWith('js_'))
      if (jsIds.length > 0) {
        setCleanProgress(20)
        const r = await invoke<DevCleanResult[]>('clean_js_caches', { categories: jsIds })
        allResults.push(...r)
      }

      // 2. Clean language caches
      const langIds = Array.from(store.selectedCaches).filter((id) => id.startsWith('lang_'))
      if (langIds.length > 0) {
        setCleanProgress(40)
        const r = await invoke<DevCleanResult[]>('clean_language_caches', {
          categories: langIds,
        })
        allResults.push(...r)
      }

      // 3. Docker prune
      if (store.selectedCaches.has('docker')) {
        setCleanProgress(60)
        const r = await invoke<DockerPruneResult>('prune_docker', { includeVolumes: false })
        allResults.push({
          tool: 'docker',
          freed_bytes: r.freed_bytes,
          items_removed: 0,
          command_output: r.output,
        })
      }

      // 4. Clean node_modules
      const nmPaths = Array.from(store.selectedNodeModules)
      if (nmPaths.length > 0) {
        setCleanProgress(80)
        const r = await invoke<DevCleanResult[]>('clean_node_modules', { paths: nmPaths })
        allResults.push(...r)
      }

      store.setCleanResults(allResults)
      const totalFreed = allResults.reduce((sum, r) => sum + r.freed_bytes, 0)

      if (totalFreed > 0) {
        showToast('success', `Freed ${formatBytes(totalFreed)}.`)
      } else {
        showToast('info', 'No files were removed.')
      }

      // Re-scan to update sizes
      setCleanProgress(95)
      await handleScanAll()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast('error', `Cleanup failed: ${msg}`)
    } finally {
      store.setCleaning(false)
      setCleanProgress(null)
    }
  }, [store, handleScanAll])

  // --- Docker Prune (standalone) ---
  const handleDockerPrune = useCallback(async () => {
    setShowDockerConfirm(false)
    store.setCleaning(true)
    try {
      const r = await invoke<DockerPruneResult>('prune_docker', { includeVolumes: false })
      if (r.freed_bytes > 0) {
        showToast('success', `Docker freed ${formatBytes(r.freed_bytes)}.`)
      } else {
        showToast('info', 'Docker had nothing to prune.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast('error', `Docker prune failed: ${msg}`)
    } finally {
      store.setCleaning(false)
    }
  }, [store])

  // --- WSL2 Compact ---
  const handleWslCompact = useCallback(
    async (distro: Wsl2DistroInfo) => {
      setShowWslConfirm(null)
      store.setCleaning(true)
      try {
        const saved = await invoke<number>('compact_wsl2_vhdx', {
          distroName: distro.name,
          vhdxPath: distro.vhdx_path,
        })
        if (saved > 0) {
          showToast('success', `WSL2 compaction freed ${formatBytes(saved)}.`)
        } else {
          showToast('info', 'VHDX was already compact.')
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        showToast('error', `WSL2 compaction failed: ${msg}`)
      } finally {
        store.setCleaning(false)
      }
    },
    [store],
  )

  // --- Computed ---
  const allCaches = [
    ...store.jsCaches,
    ...store.langCaches,
    ...(store.dockerCache ? [store.dockerCache] : []),
  ]

  const selectedCacheSize = allCaches
    .filter((c) => store.selectedCaches.has(c.id))
    .reduce((sum, c) => sum + c.size_bytes, 0)

  const selectedNmSize = store.nodeModules
    .filter((nm) => store.selectedNodeModules.has(nm.path))
    .reduce((sum, nm) => sum + nm.size_bytes, 0)

  const totalSelectedSize = selectedCacheSize + selectedNmSize
  const hasSelection = store.selectedCaches.size > 0 || store.selectedNodeModules.size > 0
  const isLoading = store.isDetecting || store.isCacheScanning || store.isNodeScanning

  return (
    <>
      <Header
        title="Developer Mode"
        icon={<Terminal size={20} strokeWidth={1.5} />}
        actions={
          <div className="flex items-center gap-2">
            <Button onClick={handleDetect} disabled={isLoading || store.isCleaning}>
              <span className="flex items-center gap-1.5">
                <Package size={14} />
                {store.isDetecting ? 'Detecting...' : 'Detect Tools'}
              </span>
            </Button>
            <Button
              onClick={handleScanAll}
              disabled={isLoading || store.isCleaning || store.tools.length === 0}
            >
              <span className="flex items-center gap-1.5">
                <Search size={14} />
                {store.isCacheScanning || store.isNodeScanning ? 'Scanning...' : 'Scan Caches'}
              </span>
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-col gap-4">
          {/* No tools detected yet */}
          {store.tools.length === 0 && !store.isDetecting && <EmptyState />}

          {/* Loading spinner */}
          {store.isDetecting && !store.tools.length && <LoadingSpinner text="Detecting tools..." />}

          {/* Detected tools badges */}
          {store.tools.length > 0 && <ToolBadges tools={store.tools} />}

          {/* Scanning indicator */}
          {(store.isCacheScanning || store.isNodeScanning) && (
            <LoadingSpinner
              text={
                store.nodeScanProgress
                  ? `Scanning... Found ${store.nodeScanProgress.found} node_modules`
                  : 'Scanning caches...'
              }
            />
          )}

          {/* Cache table */}
          {hasScanned && !store.isCacheScanning && (
            <>
              {/* Actions bar */}
              <ActionsBar
                selectedCaches={store.selectedCaches}
                selectedNodeModules={store.selectedNodeModules}
                totalSelectedSize={totalSelectedSize}
                hasSelection={hasSelection}
                isCleaning={store.isCleaning}
                onSelectAll={() => {
                  store.selectAllCaches()
                  store.selectAllNodeModules()
                }}
                onDeselectAll={() => {
                  store.deselectAllCaches()
                  store.deselectAllNodeModules()
                }}
                onClean={() => setShowCleanConfirm(true)}
              />

              {/* Clean results summary */}
              {store.cleanResults.length > 0 && <CleanSummary results={store.cleanResults} />}

              {/* Cache categories */}
              {allCaches.length > 0 && (
                <div className="flex flex-col gap-1">
                  <SectionLabel icon={<HardDrive size={14} />} text="Dev Caches" />
                  {allCaches.map((cat) => (
                    <CacheCategoryRow
                      key={cat.id}
                      category={cat}
                      selected={store.selectedCaches.has(cat.id)}
                      onToggle={() => store.toggleCache(cat.id)}
                    />
                  ))}
                </div>
              )}

              {/* node_modules section */}
              {store.nodeModules.length > 0 && (
                <div className="flex flex-col gap-1">
                  <SectionLabel
                    icon={<FolderOpen size={14} />}
                    text={`node_modules (${store.nodeModules.length} found)`}
                  />
                  {store.nodeModules.map((nm) => (
                    <NodeModulesRow
                      key={nm.path}
                      entry={nm}
                      selected={store.selectedNodeModules.has(nm.path)}
                      onToggle={() => store.toggleNodeModule(nm.path)}
                    />
                  ))}
                </div>
              )}

              {/* WSL2 section */}
              {store.wsl2Distros.length > 0 && (
                <div className="flex flex-col gap-1">
                  <SectionLabel icon={<Terminal size={14} />} text="WSL2 Distributions" />
                  {store.wsl2Distros.map((distro) => (
                    <Wsl2Row
                      key={distro.name}
                      distro={distro}
                      onCompact={() => setShowWslConfirm(distro)}
                      disabled={store.isCleaning}
                    />
                  ))}
                </div>
              )}

              {/* All clean */}
              {allCaches.every((c) => c.size_bytes === 0) &&
                store.nodeModules.length === 0 && (
                  <div
                    className="flex items-center gap-3 rounded-lg px-4 py-3"
                    style={{
                      backgroundColor: 'rgba(0, 230, 118, 0.05)',
                      border: '1px solid rgba(0, 230, 118, 0.2)',
                    }}
                  >
                    <CheckCircle size={18} style={{ color: 'var(--color-success)' }} />
                    <p className="text-sm" style={{ color: 'var(--color-success)' }}>
                      All clean. No reclaimable dev cache space found.
                    </p>
                  </div>
                )}
            </>
          )}
        </div>
      </div>

      {/* Confirm clean dialog */}
      {showCleanConfirm && (
        <ConfirmDialog
          title="Clean Dev Caches"
          description={`This will delete files from ${store.selectedCaches.size} cache categories and ${store.selectedNodeModules.size} node_modules directories.`}
          details={`Estimated space to free: ${formatBytes(totalSelectedSize)}`}
          onConfirm={handleCleanConfirm}
          onCancel={() => setShowCleanConfirm(false)}
        />
      )}

      {/* Confirm Docker prune dialog */}
      {showDockerConfirm && (
        <ConfirmDialog
          title="Prune Docker"
          description="This will remove unused Docker images, containers, and build cache. Running containers are not affected."
          onConfirm={handleDockerPrune}
          onCancel={() => setShowDockerConfirm(false)}
        />
      )}

      {/* Confirm WSL2 compact dialog */}
      {showWslConfirm && (
        <ConfirmDialog
          title="Compact WSL2 VHDX"
          description={`This will shut down ALL WSL2 instances and compact the virtual disk for "${showWslConfirm.name}". WSL will be unavailable during the process.`}
          details={`Current VHDX size: ${formatBytes(showWslConfirm.vhdx_size_bytes)}`}
          onConfirm={() => handleWslCompact(showWslConfirm)}
          onCancel={() => setShowWslConfirm(null)}
          dangerous
        />
      )}

      {/* Progress overlay */}
      {store.isCleaning && cleanProgress !== null && (
        <ProgressOverlay
          title="Cleaning Dev Caches"
          progress={cleanProgress}
          statusText="Removing cache files..."
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
        Click <strong>Detect Tools</strong> to identify installed development tools
        (Node.js, Python, Rust, Docker, etc.), then <strong>Scan Caches</strong> to find
        reclaimable space from package managers, build caches, and node_modules.
      </p>
    </div>
  )
}

function LoadingSpinner({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="text-center">
        <div
          className="w-6 h-6 border-2 rounded-full mx-auto mb-2"
          style={{
            borderColor: 'var(--border-default)',
            borderTopColor: 'var(--color-primary)',
            animation: 'spin 1s linear infinite',
          }}
        />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {text}
        </p>
      </div>
    </div>
  )
}

function ToolBadges({ tools }: { tools: DevToolInfo[] }) {
  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-lg px-4 py-3"
      style={{
        backgroundColor: 'var(--bg-2)',
        border: '1px solid var(--border-default)',
      }}
    >
      {tools.map((tool) => (
        <Badge key={tool.id} variant={tool.detected ? 'info' : 'neutral'}>
          {tool.name}
          {tool.version ? ` ${tool.version}` : tool.detected ? '' : ' (not found)'}
        </Badge>
      ))}
    </div>
  )
}

interface SectionLabelProps {
  icon: ReactNode
  text: string
}

function SectionLabel({ icon, text }: SectionLabelProps) {
  return (
    <div className="flex items-center gap-2 mt-2 mb-1">
      <span style={{ color: 'var(--text-muted)' }}>{icon}</span>
      <span className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>
        {text}
      </span>
    </div>
  )
}

interface ActionsBarProps {
  selectedCaches: Set<string>
  selectedNodeModules: Set<string>
  totalSelectedSize: number
  hasSelection: boolean
  isCleaning: boolean
  onSelectAll: () => void
  onDeselectAll: () => void
  onClean: () => void
}

function ActionsBar({
  selectedCaches,
  selectedNodeModules,
  totalSelectedSize,
  hasSelection,
  isCleaning,
  onSelectAll,
  onDeselectAll,
  onClean,
}: ActionsBarProps) {
  const totalSelected = selectedCaches.size + selectedNodeModules.size

  return (
    <div
      className="flex items-center justify-between rounded-lg px-4 py-3"
      style={{
        backgroundColor: 'var(--bg-2)',
        border: '1px solid var(--border-default)',
      }}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={hasSelection ? onDeselectAll : onSelectAll}
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
          {hasSelection ? (
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
          {totalSelected} selected
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span
          className="text-sm font-medium"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
        >
          Selected: {formatBytes(totalSelectedSize)}
        </span>
        <Button variant="danger" disabled={!hasSelection || isCleaning} onClick={onClean}>
          <span className="flex items-center gap-1.5">
            <Trash2 size={14} />
            Clean Selected
          </span>
        </Button>
      </div>
    </div>
  )
}

interface CacheCategoryRowProps {
  category: DevCacheCategory
  selected: boolean
  onToggle: () => void
}

function CacheCategoryRow({ category, selected, onToggle }: CacheCategoryRowProps) {
  const isDisabled = !category.available || category.size_bytes === 0

  return (
    <div
      className="flex items-center gap-3 rounded-lg px-4 py-3"
      style={{
        backgroundColor: selected ? 'rgba(0, 210, 255, 0.03)' : 'var(--bg-2)',
        border: `1px solid ${selected ? 'rgba(0, 210, 255, 0.15)' : 'var(--border-default)'}`,
        opacity: isDisabled ? 0.5 : 1,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
      }}
      onClick={isDisabled ? undefined : onToggle}
    >
      <Checkbox checked={selected} disabled={isDisabled} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {category.name}
          </span>
          <Badge variant={category.available ? 'info' : 'neutral'}>
            {category.tool}
          </Badge>
          {!category.available && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Not installed
            </span>
          )}
          {category.requires_docker_running && !category.available && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Docker not running
            </span>
          )}
        </div>
        {category.paths.length > 0 && category.available && (
          <p
            className="text-xs truncate mt-0.5"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
          >
            {category.paths[0]}
          </p>
        )}
      </div>

      <div className="text-right flex-shrink-0">
        <p
          className="text-sm font-medium"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
        >
          {category.available ? formatBytes(category.size_bytes) : '-'}
        </p>
      </div>
    </div>
  )
}

interface NodeModulesRowProps {
  entry: NodeModulesEntry
  selected: boolean
  onToggle: () => void
}

function NodeModulesRow({ entry, selected, onToggle }: NodeModulesRowProps) {
  const statusInfo = getNodeModulesStatusInfo(entry.status)

  return (
    <div
      className="flex items-center gap-3 rounded-lg px-4 py-3"
      style={{
        backgroundColor: selected ? 'rgba(0, 210, 255, 0.03)' : 'var(--bg-2)',
        border: `1px solid ${selected ? 'rgba(0, 210, 255, 0.15)' : 'var(--border-default)'}`,
        cursor: 'pointer',
      }}
      onClick={onToggle}
    >
      <Checkbox checked={selected} />

      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium truncate"
          style={{ color: 'var(--text-primary)' }}
        >
          {entry.parent_path}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          {statusInfo.detail && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {statusInfo.detail}
            </span>
          )}
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <p
          className="text-sm font-medium"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
        >
          {formatBytes(entry.size_bytes)}
        </p>
      </div>
    </div>
  )
}

interface Wsl2RowProps {
  distro: Wsl2DistroInfo
  onCompact: () => void
  disabled: boolean
}

function Wsl2Row({ distro, onCompact, disabled }: Wsl2RowProps) {
  return (
    <div
      className="flex items-center gap-3 rounded-lg px-4 py-3"
      style={{
        backgroundColor: 'var(--bg-2)',
        border: '1px solid var(--border-default)',
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {distro.name}
          </span>
          <Badge variant={distro.status === 'Running' ? 'safe' : 'neutral'}>
            {distro.status}
          </Badge>
        </div>
        {distro.vhdx_path && (
          <p
            className="text-xs truncate mt-0.5"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
          >
            {distro.vhdx_path}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <p
          className="text-sm font-medium"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
        >
          {formatBytes(distro.vhdx_size_bytes)}
        </p>
        <Button
          variant="secondary"
          disabled={disabled || !distro.vhdx_path}
          onClick={(e) => {
            e.stopPropagation()
            onCompact()
          }}
        >
          Compact
        </Button>
      </div>
    </div>
  )
}

interface CleanSummaryProps {
  results: DevCleanResult[]
}

function CleanSummary({ results }: CleanSummaryProps) {
  const totalFreed = results.reduce((sum, r) => sum + r.freed_bytes, 0)
  const totalItems = results.reduce((sum, r) => sum + r.items_removed, 0)

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
            {formatBytes(totalFreed)}
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
            {results.length}
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
            {totalItems.toLocaleString()}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Items Removed
          </p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

function Checkbox({ checked, disabled }: { checked: boolean; disabled?: boolean }) {
  return (
    <div
      className="flex items-center justify-center w-5 h-5 rounded flex-shrink-0"
      style={{
        backgroundColor: checked ? 'var(--color-primary)' : 'transparent',
        border: `2px solid ${checked ? 'var(--color-primary)' : 'var(--border-default)'}`,
        opacity: disabled ? 0.4 : 1,
        transition: 'background-color 150ms, border-color 150ms',
      }}
    >
      {checked && (
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
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNodeModulesStatusInfo(status: NodeModulesStatus): {
  variant: 'safe' | 'caution' | 'dangerous'
  label: string
  detail?: string
} {
  if (status === 'Active') {
    return { variant: 'safe', label: 'Active' }
  }
  if (status === 'Orphan') {
    return { variant: 'dangerous', label: 'Orphan', detail: 'No package.json' }
  }
  if (typeof status === 'object' && 'Inactive' in status) {
    return {
      variant: 'caution',
      label: 'Inactive',
      detail: `${status.Inactive.days_old} days`,
    }
  }
  return { variant: 'safe', label: 'Unknown' }
}
