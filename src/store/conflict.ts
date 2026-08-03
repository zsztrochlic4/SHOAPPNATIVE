/**
 * Cross-device conflict resolution + history paging cursors (audit SA-008/SA-009).
 *
 * The per-entry subcollection diff (cloudRepo.ts) already merges losslessly:
 * two devices editing DIFFERENT log entries both persist, because each save
 * writes only the entries it changed. The residual risk is the small ROOT
 * document (profile, settings, program) where a blind rewrite is last-writer-
 * wins and can silently drop the other device's field edits.
 *
 * `resolveRootConflict` closes that with a predictable 3-way field-level merge
 * against the loaded baseline: a field the OTHER device changed (remote != base)
 * but this device did not (local == base) is kept from remote; a field this
 * device changed wins; unchanged fields are identical either way. No edit is
 * silently lost, and the outcome is deterministic regardless of write order.
 *
 * Pure and framework-free so the policy is unit-tested (cloudRepo/CloudSync wire
 * it in). `isRootStale` decides when a pre-save re-read + merge is needed.
 */

type Dict = Record<string, unknown>

/** Whether the cloud root moved on since we loaded it (another device wrote). */
export function isRootStale(baselineUpdatedAt: unknown, remoteUpdatedAt: unknown): boolean {
  const b = toMillis(baselineUpdatedAt)
  const r = toMillis(remoteUpdatedAt)
  if (b == null || r == null) return false // can't prove staleness → treat as fresh
  return r > b
}

function toMillis(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const t = Date.parse(v)
    return Number.isNaN(t) ? null : t
  }
  // Firestore Timestamp-like { seconds, nanoseconds } or { toMillis() }.
  if (typeof v === 'object') {
    const o = v as { toMillis?: () => number; seconds?: number }
    if (typeof o.toMillis === 'function') return o.toMillis()
    if (typeof o.seconds === 'number') return o.seconds * 1000
  }
  return null
}

/**
 * 3-way field-level merge of the root document. `base` is what we loaded, `local`
 * is our pending write, `remote` is the current cloud copy. For each key across
 * all three: local's value wins when this device changed it; otherwise remote's
 * value is kept (so a concurrent edit from another device is never clobbered).
 */
export function resolveRootConflict(base: Dict, local: Dict, remote: Dict): Dict {
  const out: Dict = { ...remote }
  const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)])
  for (const k of keys) {
    const changedLocally = !deepEqual(local[k], base[k])
    if (changedLocally) out[k] = local[k]
    // else: keep remote[k] (already set from the spread) — this is the other
    // device's value, or unchanged, either way correct.
  }
  return out
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (a && b && typeof a === 'object') return JSON.stringify(a) === JSON.stringify(b)
  return false
}

/* ------------------------- history paging (SA-008) ------------------------- */

/**
 * Whether a fetched page implies more remain: a full page (size === pageSize)
 * means there is likely another page; a short page is the last one.
 */
export function hasMorePage(fetchedCount: number, pageSize: number): boolean {
  return pageSize > 0 && fetchedCount >= pageSize
}

/**
 * The cursor to resume paging after a page: the ordering value of the last item
 * (e.g. its `dateKey`), or null when the page was short (no more to fetch).
 */
export function nextCursor<T>(page: T[], pageSize: number, orderOf: (item: T) => string): string | null {
  if (!hasMorePage(page.length, pageSize) || page.length === 0) return null
  return orderOf(page[page.length - 1])
}
