/**
 * Observable cloud-sync status (audit F-039). CloudSync publishes here on
 * every load/save transition; Settings (and any other surface) can show an
 * honest "backed up / waiting / failed" state with a manual retry instead of
 * silently exhausting bounded retries. No health data passes through — just
 * timestamps and flags.
 */

export interface SyncStatus {
  /** Cloud load finished for the signed-in account (saves are allowed). */
  synced: boolean
  /** A save is in flight or queued behind the debounce. */
  pending: boolean
  /** The most recent save attempt failed (retry scheduled or exhausted). */
  error: boolean
  /** Epoch ms of the last confirmed successful save, if any this session. */
  lastSavedAt: number | null
}

let status: SyncStatus = { synced: false, pending: false, error: false, lastSavedAt: null }
const listeners = new Set<(s: SyncStatus) => void>()

export function publishSyncStatus(patch: Partial<SyncStatus>): void {
  status = { ...status, ...patch }
  listeners.forEach((l) => l(status))
}

export function getSyncStatus(): SyncStatus {
  return status
}

export function subscribeSyncStatus(fn: (s: SyncStatus) => void): () => void {
  listeners.add(fn)
  fn(status)
  return () => {
    listeners.delete(fn)
  }
}
