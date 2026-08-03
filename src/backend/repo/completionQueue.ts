/**
 * Durable, idempotent queue for canonical workout-completion writes
 * (audit F-011 / J-09).
 *
 * Finishing a generated-program session must eventually reach Firestore
 * (set_logs + progression_state + instance status) even if the write fails at
 * the moment of completion — otherwise cross-device progression and the next
 * session's recommended loads silently diverge from what the user actually
 * lifted. The old path was fire-and-forget with the error discarded.
 *
 * Design:
 *  - one pending entry per workout instance (`instance_id` is the idempotency
 *    key; `logCompletedProgramSession` itself writes with stable ids + merge,
 *    so a retry after a half-applied failure converges rather than doubling),
 *  - persisted under a UID-SCOPED AsyncStorage key (audit F-001 applies here
 *    too — a pending write may contain another user's set data otherwise),
 *  - flushed immediately on enqueue, on app foreground, and manually from the
 *    Workout screen's sync status chip,
 *  - `subscribePending` lets UI show an honest pending/error count.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { logCompletedProgramSession } from './setLogRepo'
import { upsertPending, completionDurability, type CompletionDurability } from './completionQueueCore'
import type { LoggedSetInput } from '../runtime/logging'
import type { UserDoc, WorkoutInstanceDoc } from '../schema'

export interface PendingCompletion {
  /** Idempotency key — the workout instance this completion belongs to. */
  key: string
  uid: string
  goal: UserDoc['goal']
  instance: WorkoutInstanceDoc
  logged: Record<string, LoggedSetInput[]>
  queuedAt: string
  attempts: number
}

const keyFor = (uid: string) => `sho.completionQueue.v1.u.${uid}`

const listeners = new Set<(count: number) => void>()
let lastCount = 0

function notify(count: number) {
  lastCount = count
  listeners.forEach((l) => l(count))
}

/** Subscribe to the pending count (for the Workout sync-status chip). */
export function subscribePending(fn: (count: number) => void): () => void {
  listeners.add(fn)
  fn(lastCount)
  return () => {
    listeners.delete(fn)
  }
}

async function readQueue(uid: string): Promise<PendingCompletion[]> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(uid))
    const list = raw ? (JSON.parse(raw) as PendingCompletion[]) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

/**
 * Persist the queue. Returns whether the durable write actually succeeded (audit
 * SA-004): the old version swallowed the failure and still notified as if saved,
 * so a completion whose persist AND immediate sync both failed was lost while the
 * UI showed success. Callers now use the boolean to decide durability honestly.
 */
async function writeQueue(uid: string, list: PendingCompletion[]): Promise<boolean> {
  try {
    if (list.length === 0) await AsyncStorage.removeItem(keyFor(uid))
    else await AsyncStorage.setItem(keyFor(uid), JSON.stringify(list))
    notify(list.length)
    return true
  } catch {
    // Storage failed — the entry is NOT durably queued. Reflect the intended
    // pending count (the in-flight attempt may still sync) but tell the caller
    // the persist failed so it can fall back to a direct sync and never claim
    // a false safe state.
    notify(list.length)
    return false
  }
}

let flushing = false

/**
 * Attempt every pending completion for `uid`, oldest first. Entries that
 * succeed are removed; failures stay queued with their attempt count bumped.
 * Never throws; concurrent calls coalesce.
 */
export async function flushCompletionQueue(uid: string): Promise<void> {
  if (!uid || uid === 'local' || flushing) return
  flushing = true
  try {
    const queue = await readQueue(uid)
    if (queue.length === 0) {
      notify(0)
      return
    }
    const remaining: PendingCompletion[] = []
    for (const entry of queue) {
      try {
        await logCompletedProgramSession(entry.uid, { goal: entry.goal }, entry.instance, entry.logged, entry.queuedAt)
      } catch {
        remaining.push({ ...entry, attempts: entry.attempts + 1 })
      }
    }
    await writeQueue(uid, remaining)
  } finally {
    flushing = false
  }
}

/**
 * Record a finished program session and try to sync it now. The entry replaces
 * any prior pending entry for the same instance (last completion wins — the
 * server write is a stable-id merge, so this is safe).
 *
 * Returns a durability status (audit SA-004) so the caller never presents a
 * completion as saved when it wasn't. A completion is durable when it is either
 * persisted to the local queue (survives restart, retried on foreground) OR
 * already synced to the server. If the local persist fails, we attempt a direct
 * sync as a fallback; only when BOTH fail is `durable` false — the one genuinely
 * unsafe case, which the UI must surface rather than claim success.
 */
export async function enqueueCompletion(
  uid: string,
  goal: UserDoc['goal'],
  instance: WorkoutInstanceDoc,
  logged: Record<string, LoggedSetInput[]>,
): Promise<CompletionDurability> {
  if (!uid || uid === 'local') return { durable: true, synced: true }
  const entry: PendingCompletion = {
    key: instance.instance_id,
    uid,
    goal,
    instance,
    logged,
    queuedAt: new Date().toISOString(),
    attempts: 0,
  }
  const queue = upsertPending(await readQueue(uid), entry)
  const persisted = await writeQueue(uid, queue)

  if (!persisted) {
    // The durable copy doesn't exist. Try to sync this entry directly so the
    // completion isn't lost; if that also fails it is genuinely at risk.
    try {
      await logCompletedProgramSession(entry.uid, { goal: entry.goal }, entry.instance, entry.logged, entry.queuedAt)
      return completionDurability({ persisted: false, syncedNow: true })
    } catch {
      return completionDurability({ persisted: false, syncedNow: false })
    }
  }

  // Persisted → durable regardless of the network. Try to sync now and report
  // whether it reached the server (so the UI can show synced vs pending).
  await flushCompletionQueue(uid)
  const stillPending = (await readQueue(uid)).some((e) => e.key === entry.key)
  return completionDurability({ persisted: true, syncedNow: !stillPending })
}

/**
 * Remove an account's entire pending queue from the device (audit SA-020) —
 * used by sign-out / account deletion so no other account's set data lingers.
 */
export async function clearCompletionQueueFor(uid: string): Promise<void> {
  if (!uid) return
  try {
    await AsyncStorage.removeItem(keyFor(uid))
  } catch {
    /* best-effort — the key dies with the next write anyway */
  }
  notify(0)
}

/** Refresh the published pending count from storage (e.g. after sign-in). */
export async function refreshPendingCount(uid: string): Promise<void> {
  if (!uid || uid === 'local') {
    notify(0)
    return
  }
  notify((await readQueue(uid)).length)
}
