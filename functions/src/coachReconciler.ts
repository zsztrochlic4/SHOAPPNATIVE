import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'
import * as logger from 'firebase-functions/logger'

/**
 * Coach action-journal reconciler (audit R5-007).
 *
 * A confirmed coach action enters the server journal at `outcome: 'pending_apply'`; the client is
 * meant to report the real terminal state (applied / failed / rolled_back) via
 * `recordCoachActionOutcome`. If the app is killed or goes offline before that call — and even with
 * the client's durable outbox, if the app is never reopened — the entry can sit at `pending_apply`
 * forever, so the audit trail silently diverges from reality.
 *
 * This scheduled backstop:
 *   • ALERTS (ERROR log, attachable to a paging policy) when any entry has been pending longer than
 *     the SLO, reporting the oldest age and count — "alert on oldest pending";
 *   • force-closes entries pending beyond a long horizon (the client outbox would have reported by
 *     then, so a still-pending entry is genuinely stranded) to a distinct, HONEST terminal state
 *     `unresolved` — never a false `failed`/`applied` — so the journal cannot grow unbounded.
 */

/** Alert if any action has been pending longer than this (SLO: terminal < 60 s). */
export const PENDING_ALERT_SLA_MS = 60_000
/** Force-close entries pending beyond this horizon (definitely stranded — app never came back). */
export const PENDING_FORCE_TERMINAL_MS = 24 * 60 * 60 * 1000
/** Max entries force-closed per run (bounded work; the alert still reports the true backlog). */
export const RECONCILE_BATCH = 200

export interface PendingActionRef {
  path: string
  createdAtMs: number | null
}

export interface ReconcilePlan {
  scanned: number
  /** Entries older than the SLO — the number the alert should page on. */
  staleCount: number
  /** Age of the oldest pending entry in ms (0 when none). */
  oldestAgeMs: number
  /** Entries to force-close now (older than the long horizon), capped to the batch size. */
  toTerminalize: PendingActionRef[]
}

/**
 * Pure planning step (testable without Firestore): given the pending entries and the clock, decide
 * what to alert on and what to force-close. An entry with an unknown createdAt is treated as very
 * old (fail-safe: surface and eventually close it rather than let it hide forever).
 */
export function planReconciliation(
  entries: PendingActionRef[],
  nowMs: number,
  opts: { alertMs?: number; terminalMs?: number; batch?: number } = {},
): ReconcilePlan {
  const alertMs = opts.alertMs ?? PENDING_ALERT_SLA_MS
  const terminalMs = opts.terminalMs ?? PENDING_FORCE_TERMINAL_MS
  const batch = opts.batch ?? RECONCILE_BATCH
  const ageOf = (e: PendingActionRef) => (e.createdAtMs == null ? Number.MAX_SAFE_INTEGER : Math.max(0, nowMs - e.createdAtMs))

  let oldestAgeMs = 0
  let staleCount = 0
  const terminable: PendingActionRef[] = []
  for (const e of entries) {
    const age = ageOf(e)
    if (age !== Number.MAX_SAFE_INTEGER && age > oldestAgeMs) oldestAgeMs = age
    if (age > alertMs) staleCount++
    if (age > terminalMs) terminable.push(e)
  }
  // Force-close the oldest first.
  terminable.sort((a, b) => ageOf(b) - ageOf(a))
  return { scanned: entries.length, staleCount, oldestAgeMs, toTerminalize: terminable.slice(0, batch) }
}

export const reconcileCoachActions = onSchedule(
  // Cloud Scheduler has no australia-southeast2 region; scheduled fns run in southeast1.
  { schedule: 'every 30 minutes', region: 'australia-southeast1', timeoutSeconds: 120 },
  async () => {
    const db = getFirestore()
    const nowMs = Date.now()
    let entries: PendingActionRef[] = []
    try {
      // collectionGroup so one query covers every user's `actions` subcollection.
      const snap = await db
        .collectionGroup('actions')
        .where('outcome', '==', 'pending_apply')
        .orderBy('createdAt', 'asc')
        .limit(1000)
        .get()
      entries = snap.docs.map((d) => {
        const c = d.get('createdAt')
        const createdAtMs = c instanceof Timestamp ? c.toMillis() : typeof c === 'string' ? Date.parse(c) : null
        return { path: d.ref.path, createdAtMs: Number.isFinite(createdAtMs) ? (createdAtMs as number) : null }
      })
    } catch (e) {
      // A missing composite index or transient read failure must not crash the scheduler.
      logger.error('coach_reconcile_query_failed', { event: 'coach_reconcile_query_failed', message: (e as Error)?.message })
      return
    }

    const plan = planReconciliation(entries, nowMs)
    if (plan.staleCount > 0) {
      // ERROR severity + stable event name → attach a log-based alert to page on stuck journals.
      logger.error('coach_pending_stale', {
        event: 'coach_pending_stale',
        staleCount: plan.staleCount,
        oldestAgeMs: plan.oldestAgeMs,
        sloMs: PENDING_ALERT_SLA_MS,
        scanned: plan.scanned,
      })
    } else {
      logger.info('coach_pending_ok', { event: 'coach_pending_ok', scanned: plan.scanned })
    }

    let closed = 0
    for (const entry of plan.toTerminalize) {
      try {
        await db.runTransaction(async (tx) => {
          const ref = db.doc(entry.path)
          const snap = await tx.get(ref)
          // Only close if it's STILL pending (the client may have reported in the meantime).
          if (snap.exists && snap.get('outcome') === 'pending_apply') {
            tx.update(ref, {
              outcome: 'unresolved',
              reasonCode: 'reconciler_timeout',
              reconciledAt: FieldValue.serverTimestamp(),
            })
            closed++
          }
        })
      } catch (e) {
        logger.warn('coach_reconcile_close_failed', { event: 'coach_reconcile_close_failed', path: entry.path, message: (e as Error)?.message })
      }
    }
    if (closed > 0) logger.warn('coach_pending_force_closed', { event: 'coach_pending_force_closed', closed })
  },
)
