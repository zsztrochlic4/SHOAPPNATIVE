/**
 * Pure merge helpers for the bounded-read / lazy-history model (Phase C,
 * DEVELOPMENT_PLAN.md §Phase C). Kept free of any Firebase or React import so it
 * compiles under tsconfig.sweep.json and is unit-testable in plain Node.
 *
 * Cold sign-in loads only a recent window of the append-heavy collections
 * (sessions, meals, …); the older remainder is fetched lazily and merged back in
 * with `mergeById`. The merge must be **loss-free** and **idempotent**: unioning
 * the recent window with the older remainder (or re-merging) never drops or
 * duplicates an entry, so the diff-based save can never mistake a merge for a
 * deletion. See cloudRepo.ts (load) and CloudSync.tsx (wiring).
 */

/** An entry that lives in a per-user subcollection: a stable id + a day key. */
export interface HistoryEntry {
  id?: string
  dateKey?: string
}

/**
 * Union `recent` and `older`, de-duplicated by `idOf`, sorted chronologically
 * (dateKey ascending, then id) for a deterministic, stable array order.
 *
 * On an id collision the `recent` copy wins — it is the fresher/edited version
 * (a lazy history fetch must never clobber an edit the user just made to a
 * still-loaded entry).
 */
export function mergeById<T extends HistoryEntry>(
  recent: readonly T[],
  older: readonly T[],
  idOf: (e: T) => string | undefined = (e) => e.id,
): T[] {
  const byId = new Map<string, T>()
  // Older first, then recent, so a recent entry overwrites an older duplicate.
  for (const e of older) {
    const id = idOf(e)
    if (id != null) byId.set(id, e)
  }
  for (const e of recent) {
    const id = idOf(e)
    if (id != null) byId.set(id, e)
  }
  return [...byId.values()].sort(compareByDateThenId)
}

function compareByDateThenId(a: HistoryEntry, b: HistoryEntry): number {
  const da = a.dateKey ?? ''
  const db = b.dateKey ?? ''
  if (da !== db) return da < db ? -1 : 1
  const ia = a.id ?? ''
  const ib = b.id ?? ''
  return ia < ib ? -1 : ia > ib ? 1 : 0
}
