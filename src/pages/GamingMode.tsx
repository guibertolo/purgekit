import { useEffect, useState, useCallback } from 'react'
import {
  Gamepad2,
  Power,
  Plus,
  Trash2,
  AlertTriangle,
  Shield,
  Cpu,
  HardDrive,
  Monitor,
  Zap,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import Button from '@/components/common/Button'
import AlertBanner from '@/components/feedback/AlertBanner'
import ConfirmDialog from '@/components/feedback/ConfirmDialog'
import { showToast } from '@/components/feedback/Toast'
import { useElevation } from '@/hooks/useElevation'
import { invoke } from '@/lib/tauri'
import { listen } from '@/lib/tauri'
import { useGamingStore } from '@/stores/gaming-store'
import type {
  GamingModeStatus,
  GamingPreview,
  GamingActivateResponse,
  GameConfig,
  GamingOptions,
} from '@/types/gaming'

/**
 * Gaming Mode page — one-click system optimization for gaming.
 * Implements Stories 10.1 through 10.4.
 */
export default function GamingMode() {
  const { isElevated } = useElevation()
  const store = useGamingStore()

  const [showPreviewDialog, setShowPreviewDialog] = useState(false)
  const [showAddGame, setShowAddGame] = useState(false)
  const [newGameName, setNewGameName] = useState('')
  const [newGamePath, setNewGamePath] = useState('')
  const [showRestoreBanner, setShowRestoreBanner] = useState(false)

  // Load initial status and game configs
  useEffect(() => {
    loadStatus()
    loadGameConfigs()
    loadOptions()
  }, [])

  // Listen for game detection events
  useEffect(() => {
    const unlisteners: (() => void)[] = []

    listen<string>('game-detected', (name) => {
      showToast('info', `Game detected: ${name}`)
    }).then((u) => unlisteners.push(u))

    listen<string>('game-detected-needs-elevation', (name) => {
      showToast(
        'info',
        `Game detected: ${name}. Run as admin to activate Gaming Mode automatically.`,
      )
    }).then((u) => unlisteners.push(u))

    listen<void>('gaming-auto-deactivated', () => {
      showToast('success', 'Gaming Mode deactivated automatically. System restored.')
      loadStatus()
    }).then((u) => unlisteners.push(u))

    return () => {
      unlisteners.forEach((u) => u())
    }
  }, [])

  // Show restore banner if pending
  useEffect(() => {
    setShowRestoreBanner(store.pendingRestore)
  }, [store.pendingRestore])

  const loadStatus = useCallback(async () => {
    try {
      const status = await invoke<GamingModeStatus>('get_gaming_mode_status')
      store.setStatus(status)
    } catch (err) {
      console.error('Failed to load gaming mode status:', err)
    }
  }, [])

  const loadGameConfigs = useCallback(async () => {
    try {
      const configs = await invoke<GameConfig[]>('list_game_configs')
      store.setGameConfigs(configs)
    } catch (err) {
      console.error('Failed to load game configs:', err)
    }
  }, [])

  const loadOptions = useCallback(async () => {
    try {
      const config = await invoke<Record<string, unknown>>('get_app_config')
      if (config && typeof config === 'object' && 'gaming_options' in config) {
        store.setOptions(config.gaming_options as GamingOptions)
      }
    } catch {
      // Use defaults
    }
  }, [])

  const handleActivateClick = useCallback(async () => {
    if (!isElevated) {
      showToast('error', 'Gaming Mode requires administrator privileges.')
      return
    }

    store.setPreviewing(true)
    try {
      const preview = await invoke<GamingPreview>('preview_gaming_mode')
      store.setPreview(preview)
      setShowPreviewDialog(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast('error', `Failed to prepare preview: ${msg}`)
    } finally {
      store.setPreviewing(false)
    }
  }, [isElevated])

  const handleConfirmActivate = useCallback(async () => {
    setShowPreviewDialog(false)
    store.setActivating(true)
    store.setError(null)

    try {
      const result = await invoke<GamingActivateResponse>('activate_gaming_mode', {
        options: {
          clean_shader_cache: store.options.clean_shader_cache,
          flush_ram: store.options.flush_ram,
          disable_game_dvr: store.options.disable_game_dvr,
        },
      })
      store.setActiveSummary(result)
      await loadStatus()
      showToast('success', 'Gaming Mode activated successfully!')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      store.setError(msg)
      showToast('error', `Failed to activate: ${msg}`)
    } finally {
      store.setActivating(false)
    }
  }, [store.options])

  const handleDeactivate = useCallback(async () => {
    store.setActivating(true)
    try {
      await invoke<void>('deactivate_gaming_mode')
      store.setActiveSummary(null)
      await loadStatus()
      showToast('success', 'Gaming Mode deactivated. System restored.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast('error', `Failed to deactivate: ${msg}`)
    } finally {
      store.setActivating(false)
    }
  }, [])

  const handleRestore = useCallback(async () => {
    try {
      await invoke<void>('restore_from_snapshot')
      setShowRestoreBanner(false)
      store.setPendingRestore(false)
      showToast('success', 'System restored from previous snapshot.')
      await loadStatus()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast('error', `Failed to restore: ${msg}`)
    }
  }, [])

  const handleDismissRestore = useCallback(async () => {
    try {
      await invoke<void>('dismiss_gaming_restore')
      setShowRestoreBanner(false)
      store.setPendingRestore(false)
    } catch {
      setShowRestoreBanner(false)
    }
  }, [])

  const handleAddGame = useCallback(async () => {
    if (!newGameName.trim() || !newGamePath.trim()) return

    try {
      await invoke<void>('add_game_config', {
        input: { name: newGameName.trim(), exe_path: newGamePath.trim() },
      })
      setNewGameName('')
      setNewGamePath('')
      setShowAddGame(false)
      await loadGameConfigs()
      showToast('success', `Game "${newGameName.trim()}" added.`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast('error', `Failed to add game: ${msg}`)
    }
  }, [newGameName, newGamePath])

  const handleRemoveGame = useCallback(
    async (exePath: string) => {
      try {
        await invoke<void>('remove_game_config', { exePath })
        await loadGameConfigs()
        showToast('info', 'Game removed.')
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        showToast('error', `Failed to remove game: ${msg}`)
      }
    },
    [],
  )

  const handleOptionChange = useCallback(
    async (key: keyof GamingOptions, value: boolean) => {
      const updated = { ...store.options, [key]: value }
      store.setOptions(updated)
      try {
        await invoke<void>('update_gaming_options', { options: updated })
      } catch {
        // Revert on failure
        store.setOptions(store.options)
      }
    },
    [store.options],
  )

  return (
    <>
      <Header
        title="Gaming Mode"
        icon={<Gamepad2 size={20} strokeWidth={1.5} />}
      />

      {/* Crash recovery banner */}
      {showRestoreBanner && (
        <AlertBanner
          level="warning"
          message="Gaming Mode was active when the app closed. Restore system to previous state?"
          onDismiss={handleDismissRestore}
        />
      )}

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Restore action button (separate from banner) */}
          {showRestoreBanner && (
            <div
              className="rounded-lg p-4 flex items-center justify-between"
              style={{
                backgroundColor: 'rgba(255, 179, 0, 0.08)',
                border: '1px solid var(--color-warning)',
              }}
            >
              <div className="flex items-center gap-3">
                <AlertTriangle size={20} style={{ color: 'var(--color-warning)' }} />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  Previous session snapshot detected
                </span>
              </div>
              <Button variant="primary" onClick={handleRestore}>
                Restore System
              </Button>
            </div>
          )}

          {/* Main toggle button */}
          <div
            className="rounded-lg p-8 text-center"
            style={{
              backgroundColor: 'var(--bg-2)',
              border: `1px solid ${store.isActive ? 'var(--color-primary)' : 'var(--border-default)'}`,
            }}
          >
            <button
              onClick={store.isActive ? handleDeactivate : handleActivateClick}
              disabled={store.isActivating || store.isPreviewing}
              className="mx-auto block rounded-full p-6 transition-colors"
              style={{
                backgroundColor: store.isActive
                  ? 'var(--color-primary)'
                  : 'var(--surface)',
                border: `2px solid ${store.isActive ? 'var(--color-primary)' : 'var(--border-default)'}`,
                cursor:
                  store.isActivating || store.isPreviewing
                    ? 'not-allowed'
                    : 'pointer',
                opacity: store.isActivating || store.isPreviewing ? 0.6 : 1,
                boxShadow: store.isActive
                  ? '0 0 20px rgba(0, 212, 255, 0.3), 0 0 40px rgba(0, 212, 255, 0.1)'
                  : 'none',
              }}
            >
              <Power
                size={40}
                strokeWidth={1.5}
                style={{
                  color: store.isActive
                    ? 'var(--text-inverse)'
                    : 'var(--text-muted)',
                }}
              />
            </button>

            <h2
              className="text-lg font-semibold mt-4"
              style={{ color: 'var(--text-primary)' }}
            >
              {store.isActive ? 'Gaming Mode Active' : 'Gaming Mode'}
            </h2>

            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {store.isActivating
                ? 'Processing...'
                : store.isActive
                  ? 'Click to deactivate and restore system'
                  : 'Click to optimize system for gaming'}
            </p>

            {!isElevated && !store.isActive && (
              <p
                className="text-xs mt-2 flex items-center justify-center gap-1"
                style={{ color: 'var(--color-warning)' }}
              >
                <Shield size={12} />
                Requires administrator privileges
              </p>
            )}

            {/* Active summary */}
            {store.isActive && store.activeSummary && (
              <div className="mt-4 flex justify-center gap-6">
                <StatusPill
                  icon={<Cpu size={14} />}
                  label={`${store.activeSummary.services_stopped} services paused`}
                />
                <StatusPill
                  icon={<HardDrive size={14} />}
                  label={`~${store.activeSummary.ram_freed_mb} MB RAM freed`}
                />
                {store.activeSummary.game_dvr_disabled && (
                  <StatusPill icon={<Monitor size={14} />} label="Game DVR OFF" />
                )}
              </div>
            )}

            {store.isActive && store.activatedAt && (
              <p
                className="text-xs mt-3"
                style={{ color: 'var(--text-muted)' }}
              >
                Activated at: {new Date(store.activatedAt * 1000).toLocaleString()}
              </p>
            )}
          </div>

          {/* What Gaming Mode does */}
          <div
            className="rounded-lg p-5"
            style={{
              backgroundColor: 'var(--bg-2)',
              border: '1px solid var(--border-default)',
            }}
          >
            <h3
              className="text-sm font-semibold mb-3"
              style={{ color: 'var(--text-primary)' }}
            >
              What Gaming Mode does
            </h3>
            <div className="space-y-2">
              <FeatureRow
                icon={<Cpu size={16} />}
                text="Disable telemetry and indexing services"
                checked={true}
                disabled={true}
              />
              <FeatureRow
                icon={<HardDrive size={16} />}
                text="Clean GPU shader cache"
                checked={store.options.clean_shader_cache}
                onChange={(v) => handleOptionChange('clean_shader_cache', v)}
              />
              <FeatureRow
                icon={<Zap size={16} />}
                text="Free unused RAM"
                checked={store.options.flush_ram}
                onChange={(v) => handleOptionChange('flush_ram', v)}
              />
              <FeatureRow
                icon={<Monitor size={16} />}
                text="Disable Game DVR / Xbox Game Bar"
                checked={store.options.disable_game_dvr}
                onChange={(v) => handleOptionChange('disable_game_dvr', v)}
              />
            </div>
            {store.options.clean_shader_cache && (
              <p
                className="text-xs mt-3"
                style={{ color: 'var(--color-warning)' }}
              >
                Note: First minutes of gameplay may have longer loading times due to shader
                recompilation.
              </p>
            )}
          </div>

          {/* Configured Games */}
          <div
            className="rounded-lg p-5"
            style={{
              backgroundColor: 'var(--bg-2)',
              border: '1px solid var(--border-default)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3
                className="text-sm font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                Configured Games
              </h3>
              <button
                onClick={() => setShowAddGame(!showAddGame)}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded"
                style={{
                  color: 'var(--color-primary)',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--color-primary)',
                  cursor: 'pointer',
                }}
              >
                <Plus size={12} />
                Add
              </button>
            </div>

            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
              Gaming Mode can activate automatically when these games are detected.
            </p>

            {/* Add game form */}
            {showAddGame && (
              <div
                className="rounded-md p-3 mb-3 space-y-2"
                style={{
                  backgroundColor: 'var(--bg-3)',
                  border: '1px solid var(--border-default)',
                }}
              >
                <input
                  type="text"
                  value={newGameName}
                  onChange={(e) => setNewGameName(e.target.value)}
                  placeholder="Game name (e.g., Valorant)"
                  className="w-full rounded-md px-3 py-2 text-sm"
                  style={{
                    backgroundColor: 'var(--surface)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-default)',
                    outline: 'none',
                  }}
                />
                <input
                  type="text"
                  value={newGamePath}
                  onChange={(e) => setNewGamePath(e.target.value)}
                  placeholder="Path to .exe (e.g., C:\Games\Valorant\VALORANT.exe)"
                  className="w-full rounded-md px-3 py-2 text-sm"
                  style={{
                    backgroundColor: 'var(--surface)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-default)',
                    outline: 'none',
                    fontFamily: 'var(--font-mono)',
                  }}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowAddGame(false)
                      setNewGameName('')
                      setNewGamePath('')
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleAddGame}
                    disabled={!newGameName.trim() || !newGamePath.trim()}
                  >
                    Save
                  </Button>
                </div>
              </div>
            )}

            {/* Game list */}
            {store.gameConfigs.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                No games configured. Add games for automatic activation.
              </p>
            ) : (
              <div className="space-y-2">
                {store.gameConfigs.map((game) => (
                  <div
                    key={game.exe_path}
                    className="flex items-center justify-between rounded-md px-3 py-2"
                    style={{
                      backgroundColor: 'var(--bg-3)',
                      border: '1px solid var(--border-default)',
                    }}
                  >
                    <div>
                      <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                        {game.name}
                      </p>
                      <p
                        className="text-xs"
                        style={{
                          color: 'var(--text-muted)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {game.exe_path}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveGame(game.exe_path)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: 4,
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Error display */}
          {store.error && (
            <div
              className="rounded-lg p-4 text-sm"
              style={{
                backgroundColor: 'rgba(255, 61, 90, 0.1)',
                border: '1px solid var(--color-danger)',
                color: 'var(--color-danger)',
              }}
            >
              {store.error}
            </div>
          )}
        </div>
      </div>

      {/* Preview confirmation dialog */}
      {showPreviewDialog && store.preview && (
        <ConfirmDialog
          title="Activate Gaming Mode"
          description="The following optimizations will be applied:"
          details={buildPreviewDetails(store.preview)}
          onConfirm={handleConfirmActivate}
          onCancel={() => setShowPreviewDialog(false)}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full"
      style={{
        backgroundColor: 'rgba(0, 212, 255, 0.1)',
        color: 'var(--color-primary)',
      }}
    >
      {icon}
      {label}
    </span>
  )
}

interface FeatureRowProps {
  icon: React.ReactNode
  text: string
  checked: boolean
  disabled?: boolean
  onChange?: (checked: boolean) => void
}

function FeatureRow({ icon, text, checked, disabled, onChange }: FeatureRowProps) {
  return (
    <label
      className="flex items-center gap-3 text-sm"
      style={{
        color: 'var(--text-secondary)',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        style={{ accentColor: 'var(--color-primary)' }}
      />
      <span style={{ color: 'var(--text-muted)' }}>{icon}</span>
      {text}
    </label>
  )
}

function buildPreviewDetails(preview: GamingPreview): string {
  const lines: string[] = []

  if (preview.services_to_disable.length > 0) {
    lines.push(`Services to disable (${preview.services_to_disable.length}):`)
    for (const svc of preview.services_to_disable) {
      lines.push(`  - ${svc.name}: ${svc.reason}`)
    }
  }

  if (preview.will_clean_shader_cache) {
    lines.push('Clean GPU shader cache')
  }
  if (preview.will_flush_ram) {
    lines.push('Flush RAM (working sets)')
  }
  if (preview.will_disable_game_dvr) {
    lines.push('Disable Game DVR / Xbox Game Bar')
  }

  lines.push('')
  lines.push('Everything will be restored when deactivated.')

  return lines.join('\n')
}
