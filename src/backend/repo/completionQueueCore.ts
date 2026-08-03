/**
 * Pure core of the durable completion queue (audit SA-004) — no Firebase, no
 * AsyncStorage — so the idempotency and durability guarantees are unit-testable.
 *
 * The failure the audit flagged: a completion could be reported "safe" while its
 * durable write silently failed, losing the event. Durability is defined here as
 * a single explicit rule and consumed by completionQueue.ts, so the invariant
 * "a completion is safe iff it is persisted OR already synced" is provable.
 */

export interface PendingCompletionEntry {
  /** Idempotency key — the workout instance this completion belongs to. */
  key: string
  attempts: number
}

/** Outcome of an enqueue attempt, surfaced to the UI so it never claims a false safe state. */
export interface CompletionDurability {
  /** True iff the completion is either persisted to the local queue or already synced. */
  durable: boolean
  /** True iff it reached the server in this attempt. */
  synced: boolean
}

/**
 * Upsert an entry by its idempotency key: at most ONE pending entry per instance
 * (last completion wins — the server write is a stable-id merge, so replacing is
 * safe). This is what stops a retry from queueing a duplicate.
 */
export function upsertPending<T extends { key: string }>(list: T[], entry: T): T[] {
  return [...list.filter((e) => e.key !== entry.key), entry]
}

/**
 * The durability rule (audit SA-004). A completion is durable — safe to present
 * as saved — iff its durable local copy was written OR it already synced to the
 * server this attempt. If BOTH the local persist and the immediate sync failed,
 * it is NOT durable and the UI must warn rather than claim success.
 */
export function completionDurability(opts: { persisted: boolean; syncedNow: boolean }): CompletionDurability {
  return { durable: opts.persisted || opts.syncedNow, synced: opts.syncedNow }
}
