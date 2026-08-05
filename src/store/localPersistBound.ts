/**
 * Bounded local persistence (audit SA-007).
 *
 * The store serialises the whole AppState to AsyncStorage on change. For a
 * multi-year account the append-heavy slices (workout sessions with per-set
 * logs, chat, meals…) grow without bound; the audit's benchmark put a 5-year
 * state at ~12 MiB, over the legacy Android AsyncStorage 6 MiB default — at
 * which point local writes fail and persistence silently stops.
 *
 * The device copy is a CACHE, not the source of truth: for a signed-in user the
 * cloud (cloudRepo.ts) holds the complete history and re-hydrates it on load,
 * pulling older entries on demand. So the local write only needs a bounded
 * RECENT window. This trims the heavy slices to their most recent entries before
 * serialising, keeping the on-device footprint flat regardless of account age.
 *
 * The compact, ~one-per-day slices (weights, habits, foodReviews,
 * workoutSummaries) are LEFT INTACT so the all-time Progress charts still render
 * offline from the local cache — they are small even over many years.
 *
 * Pure and framework-free so the bound is unit-tested (store.tsx just calls it).
 */
import type { AppState } from './types'

/** Heavy, unbounded slices trimmed for the local cache, with their per-slice cap. */
export const LOCAL_CAPS = {
  sessions: 200,
  meals: 400,
  activities: 400,
  chat: 400,
  coachThread: 400,
  notifications: 200,
} as const

type CappedKey = keyof typeof LOCAL_CAPS

interface DatedEntry {
  dateKey?: string
}

/**
 * Keep the `n` most-recent entries (largest `dateKey`, ties broken by original
 * position) while PRESERVING the array's original order — so bounding never
 * reorders or otherwise changes the semantics of what remains. Entries without a
 * dateKey sort oldest (kept only if room remains).
 */
export function keepRecent<T extends DatedEntry>(list: T[], n: number): T[] {
  if (!Array.isArray(list) || list.length <= n) return list
  const ranked = list
    .map((e, i) => ({ e, i, k: e.dateKey ?? '' }))
    .sort((a, b) => (a.k === b.k ? a.i - b.i : a.k < b.k ? -1 : 1))
  const keep = new Set(ranked.slice(ranked.length - n).map((r) => r.i))
  return list.filter((_, i) => keep.has(i))
}

/**
 * Produce a size-bounded copy of the state for the LOCAL AsyncStorage write.
 * Only the heavy slices are trimmed; everything else is passed through by
 * reference (no deep copy — the result is immediately serialised).
 */
export function boundStateForLocalPersist(state: AppState): AppState {
  const next: AppState = { ...state }
  for (const key of Object.keys(LOCAL_CAPS) as CappedKey[]) {
    const list = state[key] as DatedEntry[] | undefined
    if (Array.isArray(list) && list.length > LOCAL_CAPS[key]) {
      ;(next as unknown as Record<string, unknown>)[key] = keepRecent(list, LOCAL_CAPS[key])
    }
  }
  return next
}

/* --------------------- cloud root document-size budget --------------------- */

/**
 * Firestore hard-caps a document at 1 MiB (audit SA-007). The cloud root doc
 * (cloudRepo.saveUserState) holds only the BOUNDED fields — the append-heavy
 * logs live in per-entry subcollections — but a few root fields still grow
 * slowly (one entry/day: workoutStartedKeys, nutritionAskedKeys, nutritionTags…).
 * This budget + the accompanying upper-bound test prove the root stays safely
 * under the limit even for a decade-long account, so writes never start failing.
 */
export const ROOT_DOC_BUDGET_BYTES = 700 * 1024 // ~0.68 MiB — headroom under 1 MiB

/** The append-heavy slices that are stored as subcollections, NOT in the root doc. */
const SUBCOLLECTION_KEYS = [
  'sessions', 'weights', 'habits', 'meals', 'activities', 'foodReviews',
  'chat', 'coachThread', 'notifications', 'workoutSummaries',
] as const
/** Device-only fields never written to the root (mirror of cloudRepo LOCAL_ONLY). */
const LOCAL_ONLY_KEYS = ['subscription', 'community'] as const

/** The exact set of fields cloudRepo writes to the root doc. */
export function rootDocFields(state: AppState): Record<string, unknown> {
  const skip = new Set<string>([...SUBCOLLECTION_KEYS, ...LOCAL_ONLY_KEYS])
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(state)) {
    if (!skip.has(key)) out[key] = (state as unknown as Record<string, unknown>)[key]
  }
  return out
}

/** UTF-8 byte length of a string — dependency-free (no Buffer/TextEncoder). */
function utf8Bytes(s: string): number {
  let bytes = 0
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c < 0x80) bytes += 1
    else if (c < 0x800) bytes += 2
    else if (c >= 0xd800 && c <= 0xdbff) { bytes += 4; i++ } // surrogate pair → 4 bytes
    else bytes += 3
  }
  return bytes
}

/** Serialized byte size (UTF-8) of the cloud root document for `state`. */
export function estimateRootDocBytes(state: AppState): number {
  return utf8Bytes(JSON.stringify(rootDocFields(state)))
}
