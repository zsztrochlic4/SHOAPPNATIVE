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

async function writeQueue(uid: string, list: PendingCompletion[]): Promise<void> {
  try {
    if (list.length === 0) await AsyncStorage.removeItem(keyFor(uid))
    else await AsyncStorage.setItem(keyFor(uid), JSON.stringify(list))
  } catch {
    /* storage failure — the in-flight attempt still ran; next enqueue retries */
  }
  notify(list.length)
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
 */
export async function enqueueCompletion(
  uid: string,
  goal: UserDoc['goal'],
  instance: WorkoutInstanceDoc,
  logged: Record<string, LoggedSetInput[]>,
): Promise<void> {
  if (!uid || uid === 'local') return
  const entry: PendingCompletion = {
    key: instance.instance_id,
    uid,
    goal,
    instance,
    logged,
    queuedAt: new Date().toISOString(),
    attempts: 0,
  }
  const queue = (await readQueue(uid)).filter((e) => e.key !== entry.key)
  queue.push(entry)
  await writeQueue(uid, queue)
  await flushCompletionQueue(uid)
}

/** Refresh the published pending count from storage (e.g. after sign-in). */
export async function refreshPendingCount(uid: string): Promise<void> {
  if (!uid || uid === 'local') {
    notify(0)
    return
  }
  notify((await readQueue(uid)).length)
}
