import { invoke as tauriInvoke } from '@tauri-apps/api/core'
import { listen as tauriListen } from '@tauri-apps/api/event'
import type { TauriCommand, TauriEvent } from '@/types/ipc'

/**
 * Type-safe wrapper around Tauri invoke.
 * Maps command names to their expected return types.
 */
export async function invoke<T>(command: TauriCommand, args?: Record<string, unknown>): Promise<T> {
  return tauriInvoke<T>(command, args)
}

/**
 * Type-safe wrapper around Tauri event listener.
 */
export async function listen<T>(
  event: TauriEvent,
  handler: (payload: T) => void,
): Promise<() => void> {
  const unlisten = await tauriListen<T>(event, (e) => {
    handler(e.payload)
  })
  return unlisten
}
