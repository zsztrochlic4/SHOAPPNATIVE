/**
 * Community competition hub — server-authoritative backend for monthly leagues
 * and forgiving streaks (Recommendations 1 & 2).
 *
 * WHY server-side: leagues are competitive, so points, tier and username
 * uniqueness must be tamper-proof. Clients only READ Firestore (rules deny all
 * client writes to the community collections); every mutation goes through these
 * authenticated functions.
 *
 * Data model (see firestore.rules):
 *   usernames/{lower}                                  → { uid }        (uniqueness map)
 *   communityProfiles/{uid}                            → { username, usernameLower, tier,
 *                                                          points, streakCurrent, streakBest,
 *                                                          freezeTokens, weekKey, calcVersion,
 *                                                          status, provenance, scoringTargets,
 *                                                          targetBelowFloor, updatedAt }
 *   communityProfiles/{uid}/scoreDays/{dayKey}         → server-owned current per-day inputs
 *   communityProfiles/{uid}/scoreEvents/{autoId}       → append-only immutable change log
 *   leagueStandings/{weekKey}/tiers/{tier}/members/{uid} → { username, points, status, calcVersion }
 *   communityReviews/{uid}                             → moderation queue for held standings
 *                                                          (flags, state, override) — owner-claim read only
 *
 * F-003 (competitive integrity). syncCommunityStats no longer trusts client-computed
 * metrics. The client sends RAW daily inputs; the server appends them to an
 * immutable, server-timestamped event log and RECOMPUTES odometer/streak/volume/
 * sessions itself, using the exact same pure code the app displays
 * (src/community/scoring.ts, synced into ./_shared). Every standing carries a
 * calcVersion + provenance, and implausible ones are held back from the ranked
 * ladder by the anomaly rules (src/community/anomaly.ts). See
 * docs/security/COMMUNITY_INTEGRITY_F003.md. Everything stored is non-sensitive by
 * design — handle, 0–100 points, streak, per-day activity — never bodies or logs.
 *
 * STATUS: F-003 remediation. Client is feature-flagged OFF
 * (src/community/backendConfig.ts COMMUNITY_BACKEND = false). Run the emulator
 * rules/functions tests and review before enabling + deploying. Callables run in
 * australia-southeast2 (matching the app); scheduled jobs in australia-southeast1
 * (Cloud Scheduler has no southeast2 region).
 */
import { FieldPath, FieldValue, getFirestore, type Query } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import * as logger from 'firebase-functions/logger'
import { requireAuth, requireOwner, auditAppCheck, APP_CHECK_ENFORCED } from './lib/guards'
import { enforceDailyLimit } from './lib/rateLimit'
import {
  CALC_VERSION,
  computeCompetitionMetrics,
  type DayRecord,
  type ScoringTargets,
  type TimeContext,
} from './_shared/community/scoring'
import { evaluateAnomalies, type AnomalySignals } from './_shared/community/anomaly'
import { screenUsername } from './_shared/community/contentModeration'

/** Promotion/demotion DIRECTION per tier (promote>0 = can rise, demote>0 = can
 *  fall) — mirror of src/community/league.ts TIERS. The counts are no longer used
 *  directly; movement is the top/bottom 30% of the cohort (ZONE_PCT). */
const TIERS = [
  { promote: 10, demote: 0 }, // Bronze
  { promote: 8, demote: 5 }, // Silver
  { promote: 6, demote: 5 }, // Gold
  { promote: 5, demote: 6 }, // Platinum
  { promote: 0, demote: 7 }, // Diamond
]
const TOP_TIER = TIERS.length - 1
const FREEZE_CAP = 2
// Top 30% promote, bottom 30% relegate, middle 40% hold — computed from cohort
// size (design spec), replacing the fixed per-tier promote/demote counts. The
// per-tier `promote`/`demote` fields are now just direction flags (Bronze never
// relegates, Diamond never promotes).
const ZONE_PCT = 0.3

const clampTier = (t: number): number => Math.max(0, Math.min(TOP_TIER, t))

/** The app's home timezone. League weeks reset on the *local* Monday, matching
 *  both the scheduled jobs' `timeZone` and the client's device-local week
 *  (src/community/league.ts weekKey uses the device clock, ≈ Sydney for our AUS
 *  user base). Using UTC here would drift the reset ~10–11h off users' Monday. */
const APP_TZ = 'Australia/Sydney'

const APP_TZ_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TZ, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
})

/** First Monday (YYYY-MM-DD) of the given year + 1-based month, pure calendar
 *  arithmetic (Date.UTC handles the weekday math; DST is irrelevant to a calendar
 *  date). This is the monthly league reset instant. */
function firstMondayKeyOfMonth(year: number, month1: number): string {
  const first = new Date(Date.UTC(year, month1 - 1, 1))
  const dow = (first.getUTCDay() + 6) % 7 // Mon = 0 … Sun = 6
  const day = 1 + (dow === 0 ? 0 : 7 - dow)
  return new Date(Date.UTC(year, month1 - 1, day)).toISOString().slice(0, 10)
}

/** The league period key — leagues reset on the FIRST MONDAY of each month (design
 *  spec), so the period id is that Monday's date-key, computed in the app's home
 *  timezone (Australia/Sydney). If today is before this month's first Monday we're
 *  still in last month's period. Matches the client's src/community/league.ts.
 *  Exported for the ops-metrics aggregate (communityMetrics.ts) so "active this
 *  period" counts against the same key syncCommunityStats writes to each profile. */
export function leaguePeriodKey(d: Date): string {
  const parts = APP_TZ_PARTS.formatToParts(d)
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? ''
  const y = Number(get('year')), m = Number(get('month'))
  const todayKey = `${get('year')}-${get('month')}-${get('day')}`
  const thisFM = firstMondayKeyOfMonth(y, m)
  return todayKey >= thisFM ? thisFM : firstMondayKeyOfMonth(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1)
}

/** True when instant `d` is itself the first Monday of its month (app tz) — the
 *  reset day the monthly scheduled jobs act on (they run every Monday). */
function isFirstMondayOfMonth(d: Date): boolean {
  const parts = APP_TZ_PARTS.formatToParts(d)
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? ''
  const todayKey = `${get('year')}-${get('month')}-${get('day')}`
  return todayKey === firstMondayKeyOfMonth(Number(get('year')), Number(get('month')))
}

/** The period that just ended on a reset day — the previous month's first Monday. */
function prevPeriodKey(d: Date): string {
  const parts = APP_TZ_PARTS.formatToParts(d)
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? ''
  const y = Number(get('year')), m = Number(get('month'))
  return firstMondayKeyOfMonth(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1)
}

/** The Monday (YYYY-MM-DD) of the week containing a civil day-key — the WEEKLY
 *  bucket the anomaly baseline uses, independent of the monthly league period. */
function weekMondayKey(todayKey: string): string {
  const [y, m, day] = todayKey.split('-').map(Number)
  const dow = (new Date(Date.UTC(y, m - 1, day)).getUTCDay() + 6) % 7
  return new Date(Date.UTC(y, m - 1, day - dow)).toISOString().slice(0, 10)
}

/** The civil date (YYYY-MM-DD) of instant `d` in the app's home timezone. This is
 *  the server's "today" — the counterpart to the client's device-local todayKey. */
function civilDayKey(d: Date): string {
  const parts = APP_TZ_PARTS.formatToParts(d)
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** YYYY-MM-DD `n` days before the civil day `today` (n=0 → today). Pure calendar
 *  arithmetic on the civil date, matching the client's lib/date.dayKey. */
function offsetKeyFrom(today: string, n: number): string {
  const [y, m, day] = today.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, day - n)).toISOString().slice(0, 10)
}

/** Whole calendar days that `dayKey` sits behind `today` (0 = today, 1 = yesterday;
 *  negative if in the future). Used to flag backfilled (retro-stuffed) events. */
function dayLag(today: string, key: string): number {
  const t = Date.parse(today + 'T00:00:00Z')
  const k = Date.parse(key + 'T00:00:00Z')
  return Math.round((t - k) / 86400000)
}

/** Build the injected time context the shared scoring module needs, anchored to
 *  the app's home timezone so server recompute matches the client's civil week. */
function serverCtx(now: Date): TimeContext {
  const today = civilDayKey(now)
  return { todayKey: today, offsetKey: (n: number) => offsetKeyFrom(today, n) }
}

/** Stream a query in bounded pages (ordered by document id), invoking `onDoc` for
 *  each document. Keeps memory flat for cohort-wide scans — a single `.get()` on a
 *  large collection loads every doc at once. */
async function forEachPaged(
  base: Query,
  pageSize: number,
  onDoc: (doc: FirebaseFirestore.QueryDocumentSnapshot) => void | Promise<void>,
): Promise<void> {
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null
  for (;;) {
    let q = base.orderBy(FieldPath.documentId()).limit(pageSize)
    if (cursor) q = q.startAfter(cursor)
    const snap = await q.get()
    if (snap.empty) break
    for (const doc of snap.docs) await onDoc(doc)
    if (snap.size < pageSize) break
    cursor = snap.docs[snap.docs.length - 1]
  }
}

const USERNAME_RE = /^[a-z0-9_]{3,20}$/

/* --------------------------------- claimUsername --------------------------- */

interface ClaimInput { username?: string }

/** Atomically claim a unique username (case-insensitive). Releases any previous
 *  handle the user held. Throws `already-exists` if another user owns it. */
export const claimUsername = onCall<ClaimInput>(
  { region: 'australia-southeast2', enforceAppCheck: APP_CHECK_ENFORCED },
  async (req) => {
    const uid = requireAuth(req)
    auditAppCheck(req, 'claimUsername')
    const raw = (req.data?.username ?? '').trim()
    const lower = raw.toLowerCase()
    if (!USERNAME_RE.test(lower)) {
      throw new HttpsError('invalid-argument', 'Usernames are 3–20 characters: letters, numbers, underscores.')
    }
    // Content moderation: reserved handles + profanity/slurs (same screen the
    // client runs, enforced here so the UI can't be bypassed).
    const screen = screenUsername(lower)
    if (!screen.ok) throw new HttpsError('invalid-argument', screen.reason)

    const db = getFirestore()
    await db.runTransaction(async (tx) => {
      const unameRef = db.collection('usernames').doc(lower)
      const profRef = db.collection('communityProfiles').doc(uid)
      // All reads first (Firestore transaction requirement).
      const [unameSnap, profSnap] = await Promise.all([tx.get(unameRef), tx.get(profRef)])
      if (unameSnap.exists && unameSnap.get('uid') !== uid) {
        throw new HttpsError('already-exists', 'That username is taken.')
      }
      const prevLower = profSnap.get('usernameLower') as string | undefined
      if (prevLower && prevLower !== lower) {
        tx.delete(db.collection('usernames').doc(prevLower))
      }
      tx.set(unameRef, { uid })
      tx.set(
        profRef,
        {
          username: lower,
          usernameLower: lower,
          tier: profSnap.get('tier') ?? 0,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
    })
    return { ok: true, username: lower }
  },
)

/* ------------------------------ syncCommunityStats ------------------------- */

/** One raw day of self-reported activity, as the client sends it. The server
 *  NEVER trusts a client-computed metric — only these atomic inputs, which it
 *  timestamps, stores immutably, and recomputes from (F-003). */
interface DayInput {
  dayKey?: string
  hasHabit?: boolean
  steps?: number
  sleepH?: number
  waterL?: number
  nutritionScore?: number
  sessions?: number
  volume?: number
  activities?: number
  rest?: boolean
  freeze?: boolean
}

interface SyncInput {
  targets?: Partial<ScoringTargets>
  days?: DayInput[]
  clientTz?: string
}

/** Bounds. Ingest is capped per call (rate-limited elsewhere too); recompute
 *  reads a rolling window wide enough for the 400-day streak. */
const MAX_INGEST_DAYS = 45
const MAX_HISTORY_DAYS = 460
/** Retention for the per-day scoring log (privacy sign-off §A.4/C4 + finding 9):
 *  the recompute window (MAX_HISTORY_DAYS) plus an appeal buffer. Rows older than
 *  this serve no scoring purpose and are pruned daily (pruneScoreLog). Owner may
 *  adjust; lengthen only with a documented reason (APP 11 data minimisation). */
const RETENTION_DAYS = MAX_HISTORY_DAYS + 30
const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/

/** Target floors/caps. A self-reported target below its floor is a gaming lever
 *  (lower your goal → inflate your ratio), so the server clamps it up AND flags
 *  the standing for review. Caps also bound absurd values. */
const TARGET_FLOORS: ScoringTargets = { stepTarget: 3000, sleepTargetH: 5, waterTargetL: 1, daysPerWeek: 2 }
const TARGET_CAPS: ScoringTargets = { stepTarget: 50000, sleepTargetH: 14, waterTargetL: 10, daysPerWeek: 14 }

/** Accept only IANA-shaped timezone tokens (e.g. `Australia/Sydney`, `UTC`,
 *  `Etc/GMT+10`); anything else becomes '' so we never store arbitrary user text
 *  in the event log (F-003 finding — clientTz was previously kept verbatim). */
const TZ_RE = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+){0,2}$/
const sanitizeTz = (v: unknown): string => (typeof v === 'string' && v.length <= 64 && TZ_RE.test(v) ? v : '')

const clampNum = (v: unknown, min: number, max: number, dflt = min): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : dflt
  return Math.max(min, Math.min(max, n))
}
const clampInt = (v: unknown, min: number, max: number, dflt = min): number => Math.round(clampNum(v, min, max, dflt))

/** Clamp self-reported targets into [floor, cap]; report whether any value came
 *  in below its floor (a review signal, not a hard reject — legit users can have
 *  low goals; the anomaly layer decides). */
function clampTargets(raw: Partial<ScoringTargets> | undefined): { targets: ScoringTargets; targetBelowFloor: boolean } {
  const r = raw ?? {}
  let below = false
  const one = (key: keyof ScoringTargets): number => {
    const v = r[key]
    if (typeof v === 'number' && Number.isFinite(v) && v < TARGET_FLOORS[key]) below = true
    return clampNum(v, TARGET_FLOORS[key], TARGET_CAPS[key], TARGET_FLOORS[key])
  }
  return {
    targets: { stepTarget: one('stepTarget'), sleepTargetH: one('sleepTargetH'), waterTargetL: one('waterTargetL'), daysPerWeek: one('daysPerWeek') },
    targetBelowFloor: below,
  }
}

/** Validate + clamp one incoming day into a canonical DayRecord, or null if the
 *  dayKey is malformed or outside the acceptable window (too far future/past).
 *  Field ranges mirror the Zone A habit/session caps in firestore.rules. */
function validateDay(d: DayInput, today: string): DayRecord | null {
  const dayKey = typeof d.dayKey === 'string' ? d.dayKey : ''
  if (!DAY_KEY_RE.test(dayKey)) return null
  const lag = dayLag(today, dayKey)
  if (lag < -1 || lag > MAX_HISTORY_DAYS) return null // >1 day future, or older than the window
  return {
    dayKey,
    hasHabit: d.hasHabit === true,
    steps: clampInt(d.steps, 0, 500000),
    sleepH: clampNum(d.sleepH, 0, 24),
    waterL: clampNum(d.waterL, 0, 50),
    nutritionScore: clampNum(d.nutritionScore, 0, 10),
    sessions: clampInt(d.sessions, 0, 20),
    volume: clampNum(d.volume, 0, 1_000_000),
    activities: clampInt(d.activities, 0, 30),
    rest: d.rest === true,
    freeze: d.freeze === true,
  }
}

/** The stored per-day fields (everything a DayRecord carries except its id key). */
type DayContent = Omit<DayRecord, 'dayKey'>
function dayContent(r: DayRecord): DayContent {
  const { dayKey: _drop, ...rest } = r
  return rest
}
/** Read a stored scoreDays doc back into a DayRecord for recompute. */
function toDayRecord(id: string, doc: FirebaseFirestore.DocumentSnapshot): DayRecord {
  const num = (f: string): number => (typeof doc.get(f) === 'number' ? doc.get(f) : 0)
  return {
    dayKey: id,
    hasHabit: doc.get('hasHabit') === true,
    steps: num('steps'), sleepH: num('sleepH'), waterL: num('waterL'), nutritionScore: num('nutritionScore'),
    sessions: num('sessions'), volume: num('volume'), activities: num('activities'),
    rest: doc.get('rest') === true, freeze: doc.get('freeze') === true,
  }
}
const DAY_FIELDS: (keyof DayContent)[] = ['hasHabit', 'steps', 'sleepH', 'waterL', 'nutritionScore', 'sessions', 'volume', 'activities', 'rest', 'freeze']
function sameDayContent(a: DayContent, b: DayContent): boolean {
  return DAY_FIELDS.every((f) => a[f] === b[f])
}

/** Monday (YYYY-MM-DD) of the civil week a dayKey falls in — pure calendar math,
 *  for bucketing history into weeks when measuring volume trends. */
function mondayOfCivil(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7 // Mon = 0
  return new Date(Date.UTC(y, m - 1, d - dow)).toISOString().slice(0, 10)
}

/** Median of prior complete weeks' total volume (excluding the current week), or
 *  null with too little history — the baseline the volume-jump anomaly rule uses. */
function medianPriorWeeklyVolume(records: DayRecord[], currentWeekKey: string): number | null {
  const byWeek = new Map<string, number>()
  for (const r of records) {
    const wk = mondayOfCivil(r.dayKey)
    if (wk === currentWeekKey) continue
    byWeek.set(wk, (byWeek.get(wk) ?? 0) + r.volume)
  }
  const weeks = [...byWeek.values()].sort((a, b) => a - b)
  if (weeks.length < 2) return null
  const mid = Math.floor(weeks.length / 2)
  return weeks.length % 2 ? weeks[mid] : (weeks[mid - 1] + weeks[mid]) / 2
}

/**
 * Recompute ONE member's competition metrics from their durable per-day log and
 * write the provenance-stamped standing (+ profile + group fan-out). Shared by the
 * live sync path and the scheduled reprocessing sweep, so both produce identical
 * results. Does NOT ingest — it reads whatever `scoreDays` currently hold. `prof`
 * must already carry a username. Persists `scoringTargets`/`targetBelowFloor` so
 * the sweep can recompute later without any client input.
 */
async function finalizeStanding(
  db: FirebaseFirestore.Firestore,
  prof: FirebaseFirestore.DocumentSnapshot,
  ctx: TimeContext,
  periodKey: string,
  targets: ScoringTargets,
  extras: { backfilledDayCount: number; targetBelowFloor: boolean },
): Promise<{ status: string; flags: string[] }> {
  // The league period is monthly, but the anomaly baseline compares against prior
  // WEEKS' volume, so it keeps its own weekly bucket independent of the period.
  const weekMonday = weekMondayKey(ctx.todayKey)
  const uid = prof.id
  const profRef = prof.ref
  const username = prof.get('username') as string
  const tier = clampTier(typeof prof.get('tier') === 'number' ? prof.get('tier') : 0)

  // The review record holds any moderator OVERRIDE + the queue state. Read once,
  // up front: an override can force the final status regardless of the anomaly
  // outcome. It lives here (owner-readable only), never on the user's profile, so
  // moderation internals don't leak to a flagged user (see firestore.rules).
  const reviewRef = db.collection('communityReviews').doc(uid)
  const reviewSnap = await reviewRef.get()
  const override = reviewSnap.exists ? (reviewSnap.get('override') as string | undefined) : undefined

  // Recompute from the durable per-day log (server-authoritative). Bound the read
  // to the recent window with a documentId range (dayKeys sort lexicographically),
  // NOT a descending key scan — the Firestore emulator rejects `orderBy(__name__,
  // 'desc')` with FAILED_PRECONDITION, and this avoids it while staying bounded.
  const windowFloor = ctx.offsetKey(MAX_HISTORY_DAYS)
  const histSnap = await profRef.collection('scoreDays').where(FieldPath.documentId(), '>=', windowFloor).get()
  const records: DayRecord[] = histSnap.docs.map((doc) => toDayRecord(doc.id, doc))
  const metrics = computeCompetitionMetrics({ records, targets, ctx })

  // Days that carry ANY real activity — not just stored docs — so a run of empty
  // day records can't pad history to bypass the perfect-week/no-history signal.
  const activeDays = records.filter((r) => r.hasHabit || r.sessions > 0 || r.activities > 0 || r.rest || r.freeze)

  // Anomaly evaluation → status (ok | provisional | held).
  const signals: AnomalySignals = {
    maxSessionsPerDay: records.reduce((m, r) => Math.max(m, r.sessions), 0),
    maxActivitiesPerDay: records.reduce((m, r) => Math.max(m, r.activities), 0),
    volume7: metrics.volume7,
    medianPriorWeeklyVolume: medianPriorWeeklyVolume(records, weekMonday),
    odometer: metrics.odometer,
    historyDayCount: activeDays.length,
    backfilledDayCount: extras.backfilledDayCount,
    targetBelowFloor: extras.targetBelowFloor,
    deviceTokenCount: 1, // inert until native App Check is enforced (see anomaly.ts)
  }
  const { status: computed, flags } = evaluateAnomalies(signals)

  // A moderator decision (resolveStandingReview) wins: `upheld` pins a sanctioned
  // account to held; `cleared` vouches for it and forces ok. Absent an override the
  // anomaly result stands.
  const status = override === 'upheld' ? 'held' : override === 'cleared' ? 'ok' : computed

  // Implausible standings are computed + stored, but withheld from the ranked
  // ladder (points → 0 in the standing) until a clean recompute clears them.
  const rankedPoints = status === 'ok' ? metrics.odometer : 0
  const dayKeysSeen = records.map((r) => r.dayKey)
  const provenance = {
    eventCount: records.length,
    windowStart: dayKeysSeen.length ? dayKeysSeen.reduce((a, b) => (a < b ? a : b)) : ctx.todayKey,
    windowEnd: ctx.todayKey,
    anomalyFlags: flags,
    backfilledDayCount: extras.backfilledDayCount,
    ...(override ? { override } : {}),
  }

  await profRef.set(
    {
      points: metrics.odometer,
      streakCurrent: metrics.streakCurrent,
      streakBest: metrics.streakBest,
      volume7: metrics.volume7,
      volume30: metrics.volume30,
      sessionsThisWeek: metrics.sessions7,
      tier,
      weekKey: periodKey,
      calcVersion: CALC_VERSION,
      status,
      provenance,
      // Persisted so reprocessStandings can recompute without the client.
      scoringTargets: targets,
      targetBelowFloor: extras.targetBelowFloor,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
  await db.doc(`leagueStandings/${periodKey}/tiers/${tier}/members/${uid}`).set(
    // `uid` is stored (in addition to being the doc id) so account deletion can find
    // every one of a user's historical standing rows via a collection-group query
    // (functions/src/account.ts). It's the doc id anyway, so it leaks nothing new.
    { uid, username, points: rankedPoints, status, calcVersion: CALC_VERSION },
    { merge: true },
  )

  // Maintain the moderator review queue. A fresh `held` episode opens a `pending`
  // item; an in-flight appeal or a prior decision (cleared/upheld) is preserved; a
  // return to a rankable status auto-closes an open (pending/appealed) item.
  const reviewState = reviewSnap.exists ? (reviewSnap.get('state') as string | undefined) : undefined
  const openOrDecided = ['pending', 'appealed', 'cleared', 'upheld']
  if (status === 'held') {
    if (reviewState && openOrDecided.includes(reviewState)) {
      await reviewRef.set({ username, weekKey: periodKey, flags, points: metrics.odometer, status, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    } else {
      await reviewRef.set({ uid, username, weekKey: periodKey, flags, points: metrics.odometer, status, state: 'pending', openedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    }
  } else if (reviewState === 'pending' || reviewState === 'appealed') {
    await reviewRef.set({ status, state: 'auto_cleared', updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  }

  // Fan the recomputed stats out to the user's friend-group member docs so group
  // leaderboards reflect authoritative activity (communityGroups.ts owns the shape).
  // A non-ok standing is WITHHELD from group rankings too: every ranking metric is
  // zeroed (mirroring the league points→0), so a held/provisional user can't lead a
  // friend group even if a client ignores `status`. `status` is also carried so the
  // UI can show an "under review" state (src/community/groupsBackend.ts).
  const groupIds: string[] = Array.isArray(prof.get('groupIds')) ? prof.get('groupIds') : []
  if (groupIds.length) {
    const ranked = status === 'ok'
    const memberStats = {
      username,
      odometer: ranked ? metrics.odometer : 0,
      streak: ranked ? metrics.streakCurrent : 0,
      bestStreak: ranked ? metrics.streakBest : 0,
      volume7: ranked ? metrics.volume7 : 0,
      volume30: ranked ? metrics.volume30 : 0,
      sessionsThisWeek: ranked ? metrics.sessions7 : 0,
      status,
    }
    const batch = db.batch()
    for (const gid of groupIds.slice(0, 50)) {
      batch.set(db.doc(`groups/${gid}/members/${uid}`), memberStats, { merge: true })
    }
    await batch.commit()
  }
  return { status, flags }
}

/**
 * F-003 authoritative recompute. The client posts RAW daily inputs; the server
 * appends any changed day to an immutable, server-timestamped log, then recomputes
 * every competitive metric itself with the shared scoring code, flags implausible
 * results, and writes a provenance-stamped standing (implausible ones held back
 * from the ranked ladder). No client-computed metric is ever trusted.
 */
export const syncCommunityStats = onCall<SyncInput>(
  { region: 'australia-southeast2', enforceAppCheck: APP_CHECK_ENFORCED },
  async (req) => {
    const uid = requireAuth(req)
    auditAppCheck(req, 'syncCommunityStats')
    // Per-account abuse control: an authenticated client mutates days on app open /
    // league view; 500/day is generous for legitimate use and bounds scoreEvents growth.
    await enforceDailyLimit('community_sync', uid, 500)
    const now = new Date()
    const ctx = serverCtx(now)
    const weekKey = leaguePeriodKey(now)
    const clientTz = sanitizeTz(req.data?.clientTz)

    const { targets, targetBelowFloor } = clampTargets(req.data?.targets)
    const incoming = Array.isArray(req.data?.days) ? req.data!.days!.slice(0, MAX_INGEST_DAYS) : []
    const days = incoming.map((d) => validateDay(d, ctx.todayKey)).filter((d): d is DayRecord => d != null)

    const db = getFirestore()
    const profRef = db.collection('communityProfiles').doc(uid)
    const prof = await profRef.get()
    const username = prof.get('username') as string | undefined
    if (!username) throw new HttpsError('failed-precondition', 'Claim a username first.')
    const tier = clampTier(typeof prof.get('tier') === 'number' ? prof.get('tier') : 0)

    const scoreDays = profRef.collection('scoreDays')
    const scoreEvents = profRef.collection('scoreEvents')

    // --- ingest: append immutable events + upsert current per-day docs -------
    // Only days whose content actually CHANGED produce a write, so re-syncing the
    // same window is idempotent and the event log stays bounded. Every change is
    // recorded in the append-only scoreEvents trail (never updated/deleted).
    let backfilledDayCount = 0
    if (days.length) {
      const refs = days.map((d) => scoreDays.doc(d.dayKey))
      const snaps = await db.getAll(...refs)
      const batch = db.batch()
      days.forEach((d, i) => {
        const existing = snaps[i]
        const content = dayContent(d)
        if (existing.exists && sameDayContent(toDayRecord(d.dayKey, existing), d)) return
        const lag = dayLag(ctx.todayKey, d.dayKey)
        if (lag > 1) backfilledDayCount++
        const rev = (existing.exists && typeof existing.get('rev') === 'number' ? existing.get('rev') : 0) + 1
        batch.set(refs[i], { ...content, rev, firstTs: existing.exists ? existing.get('firstTs') ?? FieldValue.serverTimestamp() : FieldValue.serverTimestamp(), lastTs: FieldValue.serverTimestamp() }, { merge: true })
        batch.set(scoreEvents.doc(), { dayKey: d.dayKey, action: existing.exists ? 'change' : 'set', after: content, lagDays: lag, weekKey, clientTz, serverTs: FieldValue.serverTimestamp() })
      })
      await batch.commit()
    }

    // Recompute from the durable log, evaluate anomalies, and write the standing.
    const { status, flags } = await finalizeStanding(db, prof, ctx, weekKey, targets, { backfilledDayCount, targetBelowFloor })

    if (status !== 'ok') logger.info('community.syncCommunityStats.flagged', { status, flags, backfilledDayCount })
    return { ok: true, tier, weekKey, calcVersion: CALC_VERSION, status }
  },
)

/* -------------------------------- globalStreaks ---------------------------- */

/** Global consistency-streak leaderboard: top-N users by CURRENT streak, plus the caller's own
 *  row and global rank. This must be a server aggregate — `communityProfiles` is `list`-forbidden
 *  in firestore.rules (a client can only read its OWN), so there is no client path to a cross-user
 *  streak board. The Admin SDK bypasses rules; we return only public leaderboard fields
 *  (username + streak numbers), never the full profile. Single-field index on `streakCurrent`
 *  (auto-created in prod; unenforced in the emulator) covers the ordered read + the rank count. */
export const globalStreaks = onCall<{ limit?: number }>(
  // maxInstances: 1 — new + low-traffic; keeps the CPU this adds to the region
  // minimal (the region's total-CPU quota is tight on this young billing account).
  { region: 'australia-southeast2', enforceAppCheck: APP_CHECK_ENFORCED, maxInstances: 1 },
  async (req) => {
    const uid = requireAuth(req)
    auditAppCheck(req, 'globalStreaks')
    const db = getFirestore()
    const N = Math.min(Math.max(Math.floor(Number(req.data?.limit ?? 50)) || 50, 1), 100)
    const snap = await db
      .collection('communityProfiles')
      .where('streakCurrent', '>', 0)
      .orderBy('streakCurrent', 'desc')
      .limit(N)
      .get()
    const rows = snap.docs
      .filter((d) => d.get('username'))
      .map((d) => ({
        uid: d.id,
        username: String(d.get('username')),
        streakCurrent: Number(d.get('streakCurrent') ?? 0),
        streakBest: Number(d.get('streakBest') ?? 0),
      }))
    const meSnap = await db.collection('communityProfiles').doc(uid).get()
    let me: { uid: string; username: string; streakCurrent: number; streakBest: number } | null = null
    let youRank: number | null = null
    if (meSnap.exists && meSnap.get('username')) {
      me = {
        uid,
        username: String(meSnap.get('username')),
        streakCurrent: Number(meSnap.get('streakCurrent') ?? 0),
        streakBest: Number(meSnap.get('streakBest') ?? 0),
      }
      const inTop = rows.findIndex((r) => r.uid === uid)
      if (inTop >= 0) youRank = inTop + 1
      else if (me.streakCurrent > 0) {
        try {
          const ahead = await db.collection('communityProfiles').where('streakCurrent', '>', me.streakCurrent).count().get()
          youRank = ahead.data().count + 1
        } catch {
          youRank = null // count() unavailable (older emulator) — leave rank unknown rather than fail the board
        }
      }
    }
    return { ok: true as const, rows, me, youRank }
  },
)

/* -------------------------------- rolloverLeagues -------------------------- */

/** Monthly promotion/demotion. Scheduled every Monday but only acts on the FIRST
 *  Monday of the month (design spec): for the month that just ended it moves each
 *  tier's top 30% up and its bottom 30% down, then resets everyone's points. ONLY
 *  `status == 'ok'` standings are eligible to move — a held/provisional
 *  standing has withheld points (0) and must neither be promoted (it would rise on a
 *  fake score in a sparse/all-zero cohort — F-003 finding) nor demoted (it holds
 *  until review clears it). Movers come from one bounded, ordered read of the ok
 *  cohort (small by design); promotion wins ties with demotion. The points reset
 *  streams the whole cohort in pages so memory stays flat as the user base grows. */
export const rolloverLeagues = onSchedule(
  { schedule: '5 0 * * 1', timeZone: 'Australia/Sydney', region: 'australia-southeast1', timeoutSeconds: 540, memory: '512MiB' },
  async () => {
    const db = getFirestore()
    const now = new Date()
    // Leagues reset on the FIRST MONDAY of each month; this job runs every Monday, so
    // it no-ops on the others. The period that just ended = the previous month's first Monday.
    if (!isFirstMondayOfMonth(now)) {
      logger.info('community.rolloverLeagues.skip', { reason: 'not the first Monday of the month' })
      return
    }
    const prevPeriod = prevPeriodKey(now)

    let promoted = 0
    let demoted = 0
    for (let tier = 0; tier < TIERS.length; tier++) {
      const cfg = TIERS[tier]
      const members = db.collection(`leagueStandings/${prevPeriod}/tiers/${tier}/members`)

      // Movers: only the `ok` cohort is eligible to move, read once ordered by
      // points desc (needs the members(status,points) composite index —
      // firestore.indexes.json). The top `promote` rise; the bottom `demote` of the
      // SAME ok list fall; promotion wins a tie in a cohort smaller than promote +
      // demote. Held/provisional rows are absent here, so they hold their tier.
      const moves = new Map<string, number>() // uid → new tier
      if (cfg.promote > 0 || cfg.demote > 0) {
        const okDocs = (await members.where('status', '==', 'ok').orderBy('points', 'desc').get()).docs
        const n = okDocs.length
        // Top 30% promote, bottom 30% relegate (design spec) — computed from the ok
        // cohort size, gated by whether the tier can move that direction.
        const promoteCount = cfg.promote > 0 ? Math.max(1, Math.round(n * ZONE_PCT)) : 0
        const demoteCount = cfg.demote > 0 ? Math.max(1, Math.round(n * ZONE_PCT)) : 0
        for (let i = 0; i < promoteCount && i < n; i++) moves.set(okDocs[i].id, clampTier(tier + 1))
        for (let i = 0; i < demoteCount && i < n; i++) {
          const d = okDocs[n - 1 - i]
          if (!moves.has(d.id)) moves.set(d.id, clampTier(tier - 1))
        }
      }

      // Reset the whole cohort's points (and apply any tier move), paginated.
      let batch = db.batch()
      let ops = 0
      await forEachPaged(members, 400, async (doc) => {
        const uid = doc.id
        const newTier = moves.get(uid) ?? tier
        if (newTier > tier) promoted++
        else if (newTier < tier) demoted++
        batch.set(
          db.collection('communityProfiles').doc(uid),
          {
            tier: newTier,
            points: 0,
            ...(newTier > tier ? { seasonWins: FieldValue.increment(1) } : {}),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        )
        if (++ops >= 400) { await batch.commit(); batch = db.batch(); ops = 0 }
      })
      if (ops > 0) await batch.commit()
    }
    logger.info('community.rolloverLeagues', { prevPeriod, promoted, demoted })
  },
)

/* ------------------------------ grantStreakFreezes ------------------------- */

/** Monthly freeze grant — at each reset (the first Monday of the month) every
 *  community member gets 2 fresh freezes (design spec). Scheduled every Monday but
 *  only acts on the first; already-topped-up members are skipped. The cohort scan is
 *  paginated so memory stays flat as it grows. */
export const grantStreakFreezes = onSchedule(
  { schedule: '10 0 * * 1', timeZone: 'Australia/Sydney', region: 'australia-southeast1', timeoutSeconds: 540, memory: '512MiB' },
  async () => {
    if (!isFirstMondayOfMonth(new Date())) {
      logger.info('community.grantStreakFreezes.skip', { reason: 'not the first Monday of the month' })
      return
    }
    const db = getFirestore()
    let granted = 0
    let batch = db.batch()
    let ops = 0
    await forEachPaged(db.collection('communityProfiles'), 400, async (doc) => {
      const cur = typeof doc.get('freezeTokens') === 'number' ? doc.get('freezeTokens') : 0
      if (cur >= FREEZE_CAP) return
      // Top up to the 2-freeze cap for the new month.
      batch.set(doc.ref, { freezeTokens: FREEZE_CAP }, { merge: true })
      granted++
      if (++ops >= 400) { await batch.commit(); batch = db.batch(); ops = 0 }
    })
    if (ops > 0) await batch.commit()
    logger.info('community.grantStreakFreezes', { granted })
  },
)

/* ------------------------------ reprocessStandings ------------------------- */

/** Scheduled reprocessing sweep (F-003). Re-runs the authoritative recompute for
 *  every community member against the CURRENT week, from their durable scoreDays
 *  log — no client involvement. This is what makes a `calcVersion` bump or a late
 *  anomaly rule actually re-decide standings; the live sync only recomputes the one
 *  user who happens to open the app. Members who never synced under F-003 (no
 *  persisted `scoringTargets`) are skipped. Paginated so memory stays flat.
 *
 *  Runs daily at 01:30 (after Monday's rollover at 00:05), so a definition change
 *  or a newly-tripped anomaly propagates within a day. NOTE: this reads each
 *  member's scoreDays log (bounded, but O(members) queries) — fine at launch scale;
 *  revisit with sharded fan-out / a work queue as the base grows. */
export const reprocessStandings = onSchedule(
  { schedule: '30 1 * * *', timeZone: 'Australia/Sydney', region: 'australia-southeast1', timeoutSeconds: 540, memory: '512MiB' },
  async () => {
    const db = getFirestore()
    const now = new Date()
    const ctx = serverCtx(now)
    const weekKey = leaguePeriodKey(now)
    let processed = 0
    let held = 0
    let provisional = 0
    await forEachPaged(db.collection('communityProfiles'), 200, async (doc) => {
      if (!doc.get('username')) return
      const stored = doc.get('scoringTargets')
      if (!stored || typeof stored !== 'object') return // never synced under F-003 — nothing to recompute
      const targets = clampTargets(stored as Partial<ScoringTargets>).targets // re-clamp defensively
      const targetBelowFloor = doc.get('targetBelowFloor') === true
      const { status } = await finalizeStanding(db, doc, ctx, weekKey, targets, { backfilledDayCount: 0, targetBelowFloor })
      processed++
      if (status === 'held') held++
      else if (status === 'provisional') provisional++
    })
    logger.info('community.reprocessStandings', { weekKey, processed, held, provisional })
  },
)

/* -------------------------------- pruneScoreLog ---------------------------- */

/** Retention TTL for the per-day scoring log (privacy sign-off C4 / finding 9).
 *  Daily, deletes each member's `scoreDays` and `scoreEvents` older than
 *  RETENTION_DAYS — the recompute never reads that far back, so nothing scored is
 *  affected; this is pure data minimisation (APP 11). Deletion-on-account already
 *  removes everything; this bounds the log for LIVE accounts. Paginated + batched so
 *  memory stays flat. Runs at 02:30, after the daily reprocess. */
export const pruneScoreLog = onSchedule(
  { schedule: '30 2 * * *', timeZone: 'Australia/Sydney', region: 'australia-southeast1', timeoutSeconds: 540, memory: '512MiB' },
  async () => {
    const db = getFirestore()
    const cutoff = serverCtx(new Date()).offsetKey(RETENTION_DAYS) // YYYY-MM-DD floor
    let prunedDays = 0
    let prunedEvents = 0
    const flushDeletes = async (docs: FirebaseFirestore.QueryDocumentSnapshot[]): Promise<number> => {
      let batch = db.batch()
      let ops = 0
      for (const d of docs) {
        batch.delete(d.ref)
        if (++ops >= 400) { await batch.commit(); batch = db.batch(); ops = 0 }
      }
      if (ops > 0) await batch.commit()
      return docs.length
    }
    await forEachPaged(db.collection('communityProfiles'), 100, async (doc) => {
      // scoreDays is keyed by dayKey → delete by documentId below the cutoff.
      const oldDays = await doc.ref.collection('scoreDays').where(FieldPath.documentId(), '<', cutoff).get()
      if (!oldDays.empty) prunedDays += await flushDeletes(oldDays.docs)
      // scoreEvents is auto-id'd but carries the `dayKey` field.
      const oldEvents = await doc.ref.collection('scoreEvents').where('dayKey', '<', cutoff).get()
      if (!oldEvents.empty) prunedEvents += await flushDeletes(oldEvents.docs)
    })
    logger.info('community.pruneScoreLog', { cutoff, retentionDays: RETENTION_DAYS, prunedDays, prunedEvents })
  },
)

/* --------------------------- review queue: appeals ------------------------- */

/** Recompute one member's standing from their PERSISTED state (targets are stored
 *  on the profile). Used by the appeal + resolve callables so a review action takes
 *  effect immediately, without waiting for the daily sweep. Returns null if there's
 *  no such member. */
async function recomputeForUid(db: FirebaseFirestore.Firestore, uid: string): Promise<{ status: string } | null> {
  const prof = await db.collection('communityProfiles').doc(uid).get()
  if (!prof.exists || !prof.get('username')) return null
  const now = new Date()
  const targets = clampTargets((prof.get('scoringTargets') as Partial<ScoringTargets> | undefined) ?? {}).targets
  const targetBelowFloor = prof.get('targetBelowFloor') === true
  return finalizeStanding(db, prof, serverCtx(now), leaguePeriodKey(now), targets, { backfilledDayCount: 0, targetBelowFloor })
}

interface AppealInput { note?: string }

/** A user asks for their HELD standing to be re-reviewed. Records the appeal (with
 *  an optional short note) on the review record and immediately recomputes: if the
 *  underlying data now passes the anomaly rules the appeal auto-clears; if it's
 *  still held, the item stays queued for the owner with the note attached. Only a
 *  `held` standing is appealable — `provisional` clears itself on the next clean
 *  recompute, and `ok` needs nothing. */
export const appealStanding = onCall<AppealInput>(
  { region: 'australia-southeast2', enforceAppCheck: APP_CHECK_ENFORCED },
  async (req) => {
    const uid = requireAuth(req)
    auditAppCheck(req, 'appealStanding')
    await enforceDailyLimit('community_appeal', uid, 10)
    const note = typeof req.data?.note === 'string' ? req.data.note.slice(0, 500) : ''
    const db = getFirestore()
    const prof = await db.collection('communityProfiles').doc(uid).get()
    if (!prof.exists || !prof.get('username')) throw new HttpsError('failed-precondition', 'Claim a username first.')
    const status = prof.get('status') as string | undefined
    if (status !== 'held') return { ok: true, status: status ?? 'ok', appealed: false }

    await db.collection('communityReviews').doc(uid).set(
      { uid, username: prof.get('username'), state: 'appealed', appealNote: note, appealedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    )
    // The review record is moderator-only (rules deny the subject reading it), so
    // mirror the user's OWN appeal text onto their owner-readable profile — that way
    // it's included in "Download my data" (privacy sign-off C2). Moderator internals
    // (flags/override/resolutionNote) intentionally stay withheld.
    await db.collection('communityProfiles').doc(uid).set(
      { lastAppeal: { note, at: FieldValue.serverTimestamp() } },
      { merge: true },
    )
    const res = await recomputeForUid(db, uid)
    return { ok: true, status: res?.status ?? 'held', appealed: true }
  },
)

interface ResolveInput { uid?: string; decision?: 'clear' | 'uphold' | 'reset'; note?: string }

/** Owner/moderator resolution of a review item (gated by the `owner` custom claim,
 *  scripts/set-owner-claim.mjs — the same gate as the notification sender). Sets a
 *  durable override on the review record and recomputes so it takes effect at once:
 *    - clear  → vouch for the account; force its standing to `ok` (it ranks).
 *    - uphold → sanction; pin the standing to `held` regardless of the data.
 *    - reset  → remove the override; the anomaly rules decide again (re-queues if
 *               still held). */
export const resolveStandingReview = onCall<ResolveInput>(
  { region: 'australia-southeast2', enforceAppCheck: APP_CHECK_ENFORCED },
  async (req) => {
    const ownerUid = requireOwner(req)
    auditAppCheck(req, 'resolveStandingReview')
    const targetUid = typeof req.data?.uid === 'string' ? req.data.uid : ''
    const decision = req.data?.decision
    if (!targetUid || (decision !== 'clear' && decision !== 'uphold' && decision !== 'reset')) {
      throw new HttpsError('invalid-argument', 'Provide a member uid and a decision of clear | uphold | reset.')
    }
    const note = typeof req.data?.note === 'string' ? req.data.note.slice(0, 500) : ''

    const db = getFirestore()
    const prof = await db.collection('communityProfiles').doc(targetUid).get()
    if (!prof.exists || !prof.get('username')) throw new HttpsError('not-found', 'No such community member.')
    const reviewRef = db.collection('communityReviews').doc(targetUid)

    if (decision === 'reset') {
      await reviewRef.set(
        { override: FieldValue.delete(), state: 'auto_cleared', resolvedBy: ownerUid, resolutionNote: note, resolvedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      )
    } else {
      const override = decision === 'clear' ? 'cleared' : 'upheld'
      await reviewRef.set(
        { uid: targetUid, username: prof.get('username'), override, state: override, resolvedBy: ownerUid, resolutionNote: note, resolvedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      )
    }
    const res = await recomputeForUid(db, targetUid)
    logger.info('community.resolveStandingReview', { targetUid, decision, status: res?.status })
    return { ok: true, status: res?.status ?? null }
  },
)
