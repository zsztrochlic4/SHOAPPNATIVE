/**
 * Anomaly rules (F-003, v1) — the "don't trust, quarantine the implausible" layer
 * that sits on top of the server recompute. Recomputing from an immutable event
 * log stops a client posting `points: 100` directly, but a determined cheater can
 * still inflate the *raw inputs* they feed the log (30k steps, a dozen sessions in
 * a day, a target floored to nothing). These rules flag those patterns so the
 * standing is held back from the visible ladder rather than trusted.
 *
 * Design:
 *   - Cheap, explainable rules first (no ML). Each fires a named flag.
 *   - The FUNCTION computes raw signals (it owns the clock + the event history);
 *     this pure module only decides status from signals + thresholds, so it's
 *     unit-testable and synced into the server bundle unchanged.
 *   - A HARD flag → `held` (needs review before it can rank). A SOFT flag →
 *     `provisional` (computed + shown to the user as "under review", auto-clears
 *     on a clean recompute, no moderator). No flags → `ok`.
 *
 * Thresholds live in ANOMALY_CONFIG (a constant here for v1) and are intended to
 * move to a server-owned config/community document so they tune without a deploy.
 *
 * `deviceTokenCount` / the `device_churn` flag are a DORMANT placeholder, not a
 * pending feature. App Check attests that a call comes from a genuine app instance
 * but exposes NO stable per-device identifier to the backend (privacy by design —
 * `req.app` is just presence + appId), so "count distinct devices per uid" is not
 * achievable from App Check tokens. The real abuse control is App Check
 * ENFORCEMENT (blocking non-genuine/scripted clients from calling at all), driven
 * by APPCHECK_ENFORCE once the native bridge is device-verified — see
 * docs/APP_CHECK.md. The signal stays fixed at 1 and the rule never fires unless a
 * genuine device counter is wired from some future source.
 */

export type StandingStatus = 'ok' | 'provisional' | 'held'

/** Raw, already-measured signals about one recompute. The caller (the function)
 *  computes these from the event log + clock; this module never reads a clock. */
export interface AnomalySignals {
  /** Highest count of completed sessions logged against any single day. */
  maxSessionsPerDay: number
  /** Highest count of self-logged activities against any single day. */
  maxActivitiesPerDay: number
  /** This week's total volume (kg). */
  volume7: number
  /** Median of prior complete weeks' volume (kg), or null with too little history. */
  medianPriorWeeklyVolume: number | null
  /** Computed odometer (0–100) this recompute. */
  odometer: number
  /** Number of distinct days that carry any logged data (habit/session/activity). */
  historyDayCount: number
  /** Days in THIS ingest whose asserted dayKey lagged the server clock > 24h. */
  backfilledDayCount: number
  /** True if the caller floor-clamped a below-minimum target this ingest. */
  targetBelowFloor: boolean
  /** Distinct App Check device tokens seen for this uid this week. Inert until
   *  App Check is enforced (always 0/1 today). */
  deviceTokenCount: number
}

export interface AnomalyConfig {
  maxSessionsPerDay: number
  maxActivitiesPerDay: number
  /** volume7 above this multiple of the trailing median is a soft flag. */
  volumeJumpFactor: number
  /** odometer at/above this with fewer than `minHistoryForHighScore` active days
   *  is a soft flag ("perfect week, no history to support it"). */
  highOdometer: number
  minHistoryForHighScore: number
  backfillDayFlag: number
  maxDeviceTokensPerWeek: number
}

/** v1 thresholds. Deliberately loose — the goal is to catch the absurd, not to
 *  false-positive honest power users. Tune via a server config doc later. */
export const ANOMALY_CONFIG: AnomalyConfig = {
  maxSessionsPerDay: 6,
  maxActivitiesPerDay: 12,
  volumeJumpFactor: 5,
  highOdometer: 95,
  minHistoryForHighScore: 7,
  backfillDayFlag: 5,
  maxDeviceTokensPerWeek: 8,
}

export interface AnomalyResult {
  status: StandingStatus
  flags: string[]
}

/** HARD flags force `held` (human review); SOFT flags force `provisional`. */
const HARD_FLAGS = new Set(['impossible_session_cadence', 'target_below_floor', 'device_churn'])

/**
 * Decide a standing's status from measured signals. Pure — same inputs, same
 * output, so it's fully unit-testable and identical on client and server.
 */
export function evaluateAnomalies(sig: AnomalySignals, cfg: AnomalyConfig = ANOMALY_CONFIG): AnomalyResult {
  const flags: string[] = []

  if (sig.maxSessionsPerDay > cfg.maxSessionsPerDay || sig.maxActivitiesPerDay > cfg.maxActivitiesPerDay) {
    flags.push('impossible_session_cadence')
  }
  if (sig.medianPriorWeeklyVolume != null && sig.medianPriorWeeklyVolume > 0 && sig.volume7 > sig.medianPriorWeeklyVolume * cfg.volumeJumpFactor) {
    flags.push('volume_jump')
  }
  if (sig.odometer >= cfg.highOdometer && sig.historyDayCount < cfg.minHistoryForHighScore) {
    flags.push('perfect_week_no_history')
  }
  if (sig.backfilledDayCount >= cfg.backfillDayFlag) {
    flags.push('backfill')
  }
  if (sig.targetBelowFloor) {
    flags.push('target_below_floor')
  }
  // Inert until App Check is enforced (deviceTokenCount is 0/1 today).
  if (sig.deviceTokenCount > cfg.maxDeviceTokensPerWeek) {
    flags.push('device_churn')
  }

  const hard = flags.some((f) => HARD_FLAGS.has(f))
  const status: StandingStatus = hard ? 'held' : flags.length > 0 ? 'provisional' : 'ok'
  return { status, flags }
}
