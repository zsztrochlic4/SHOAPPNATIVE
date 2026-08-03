import { onCall, type CallableRequest } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'
import * as logger from 'firebase-functions/logger'
import { auditAppCheck, APP_CHECK_ENFORCED } from './lib/guards'
import { dayBucket } from './lib/rateLimit'

/**
 * Remote crash / error + SLO monitoring (audit SA-014).
 *
 * The app previously kept errors only in a local, on-device ring buffer, so a
 * production crash or elevated backend failure rate was invisible to the team.
 * This adds a lightweight remote sink built on the EXISTING infra (Callable +
 * Firestore + Cloud Logging) — no new paid SDK — so:
 *   • every client crash produces a structured, alertable Cloud Logging entry
 *     (`severity=ERROR`, `event="client_error"`), which a log-based alert policy
 *     can page on;
 *   • a per-day error counter feeds an SLO check;
 *   • a scheduled monitor emits `event="slo_breach"` (ERROR) when the daily error
 *     count crosses the threshold — a single, greppable, alertable signal.
 *
 * Records are REDACTED (name + truncated message + tag + time only — never user
 * content or health data), mirroring the client redaction in src/lib/reportError.ts.
 * The owner attaches the alert/SLO policies once — see docs/CRASH_REPORTING.md.
 */

interface ClientErrorInput {
  name?: string
  message?: string
  tag?: string
  at?: string
  fatal?: boolean
}

const ERROR_TTL_DAYS = 30
/** Daily client-error count above which the SLO monitor raises an alert. */
export const SLO_DAILY_ERROR_THRESHOLD = 200

function counterRef(day: string) {
  return getFirestore().collection('errorCounters').doc(day)
}

export const reportClientError = onCall(
  // Errors can happen before sign-in, so this does not require auth; App Check is
  // audited (monitor) but not required for the same reason. It is intentionally
  // cheap and best-effort — diagnostics must never themselves fail the app.
  { enforceAppCheck: APP_CHECK_ENFORCED, timeoutSeconds: 15, memory: '256MiB' },
  async (req: CallableRequest<ClientErrorInput>): Promise<{ ok: true }> => {
    auditAppCheck(req, 'reportClientError')
    const input = req.data ?? {}
    const record = {
      at: String(input.at ?? new Date().toISOString()).slice(0, 40),
      name: String(input.name ?? 'Error').slice(0, 60),
      message: String(input.message ?? '').slice(0, 200),
      tag: String(input.tag ?? '').slice(0, 60),
      fatal: input.fatal === true,
      uid: req.auth?.uid ?? null,
    }

    // 1. Structured, alertable log line (the primary signal for alerting/SLOs).
    logger.error('client_error', { event: 'client_error', ...record })

    // 2. Persist a redacted record + bump the daily counter (best-effort).
    try {
      const db = getFirestore()
      const now = Date.now()
      const day = dayBucket(now)
      await db.collection('clientErrors').add({
        ...record,
        day,
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromMillis(now + ERROR_TTL_DAYS * 24 * 60 * 60 * 1000),
      })
      await counterRef(day).set(
        { day, count: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      )
    } catch {
      /* diagnostics must never cause a second failure */
    }
    return { ok: true }
  },
)

/**
 * Scheduled SLO monitor (audit SA-014). Checks today's client-error count and
 * emits a single alertable signal when it crosses the threshold, so an elevated
 * crash rate is VISIBLE without anyone watching dashboards. Runs every 15 min.
 */
export const monitorSlo = onSchedule(
  { schedule: 'every 15 minutes', region: 'australia-southeast2', timeoutSeconds: 60 },
  async () => {
    const day = dayBucket(Date.now())
    let count = 0
    try {
      const snap = await counterRef(day).get()
      count = snap.exists ? Number(snap.get('count')) || 0 : 0
    } catch {
      return
    }
    if (count >= SLO_DAILY_ERROR_THRESHOLD) {
      // ERROR severity + stable event name → attach a log-based alert to page on this.
      logger.error('slo_breach', { event: 'slo_breach', day, count, threshold: SLO_DAILY_ERROR_THRESHOLD })
      try {
        await getFirestore()
          .collection('sloAlerts')
          .doc(day)
          .set({ day, count, threshold: SLO_DAILY_ERROR_THRESHOLD, at: FieldValue.serverTimestamp() }, { merge: true })
      } catch {
        /* the log line is the primary alert; the doc is a convenience record */
      }
    } else {
      logger.info('slo_ok', { event: 'slo_ok', day, count, threshold: SLO_DAILY_ERROR_THRESHOLD })
    }
  },
)
