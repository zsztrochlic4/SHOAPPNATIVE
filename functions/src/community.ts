/**
 * Community competition hub — server-authoritative backend for weekly leagues
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
 *                                                          freezeTokens, weekKey, cohortId,
 *                                                          cohortTier, cohortWeekKey, updatedAt }
 *   leagueStandings/{weekKey}/tiers/{tier}/cohorts/{cohortId}            → { segKey, tz, band, level, size, … }
 *   leagueStandings/{weekKey}/tiers/{tier}/cohorts/{cohortId}/members/{uid} → { username, points, rankKey, … }
 *   leagueAllocator/{weekKey}/tiers/{tier}[/segments/{segKey}]          → allocator bookkeeping (server-only)
 *   leagueRollovers/{weekKey}                                           → rollover idempotency marker (server-only)
 *
 * Weekly leagues run in COHORTS (audit F-005): each user is placed once per week
 * into a small (target 25, cap 30) immutable cohort, segmented adaptively by tier,
 * then timezone, then activity band — so promotion stays fair and reads stay cheap
 * at any population. The cohort math is the pure module functions/src/lib/cohorts.ts.
 *
 * Everything stored is non-sensitive by design — a handle and consistency points
 * (0–100), never bodies, weight or logs.
 *
 * STATUS: first implementation. Client is feature-flagged OFF
 * (src/community/backendConfig.ts COMMUNITY_BACKEND = false). Run the emulator
 * rules/functions tests and review before enabling + deploying. Callables run in
 * australia-southeast2 (matching the app); scheduled jobs in australia-southeast1
 * (Cloud Scheduler has no southeast2 region).
 */
import { FieldPath, FieldValue, getFirestore, type Query, type Transaction } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import * as logger from 'firebase-functions/logger'
import { requireAuth, requireOwner } from './lib/guards'
import {
  COHORT_CAP, TIE_RULES_VERSION, bandOf, tzBucketOf, segmentKeyForLevel, nextLevel, rankKeyFor,
} from './lib/cohorts'

/** Promotion/demotion counts per tier — mirror of src/community/league.ts TIERS. */
const TIERS = [
  { promote: 10, demote: 0 }, // Bronze
  { promote: 8, demote: 5 }, // Silver
  { promote: 6, demote: 5 }, // Gold
  { promote: 5, demote: 6 }, // Platinum
  { promote: 0, demote: 7 }, // Diamond
]
const TOP_TIER = TIERS.length - 1
const FREEZE_CAP = 2

const clampTier = (t: number): number => Math.max(0, Math.min(TOP_TIER, t))

/** The app's home timezone. League weeks reset on the *local* Monday, matching
 *  both the scheduled jobs' `timeZone` and the client's device-local week
 *  (src/community/league.ts weekKey uses the device clock, ≈ Sydney for our AUS
 *  user base). Using UTC here would drift the reset ~10–11h off users' Monday. */
const APP_TZ = 'Australia/Sydney'

// Weekday index (Mon = 0 … Sun = 6) keyed by the `en-CA` short weekday name.
const WEEKDAY_INDEX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }
const APP_TZ_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TZ, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
})

/** Monday date-key (YYYY-MM-DD) for the week containing instant `d`, computed in
 *  the app's home timezone (Australia/Sydney). We take the civil date + weekday as
 *  they read in Sydney, then step back to that week's Monday with pure calendar
 *  arithmetic (Date.UTC handles month/day underflow). DST is irrelevant — a Sydney
 *  calendar day belongs to exactly one calendar Monday regardless of offset. */
function mondayKey(d: Date): string {
  const parts = APP_TZ_PARTS.formatToParts(d)
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? ''
  const y = Number(get('year')), m = Number(get('month')), day = Number(get('day'))
  const dow = WEEKDAY_INDEX[get('weekday')] ?? 0
  const monday = new Date(Date.UTC(y, m - 1, day - dow))
  return monday.toISOString().slice(0, 10)
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
  { region: 'australia-southeast2' },
  async (req) => {
    const uid = requireAuth(req)
    const raw = (req.data?.username ?? '').trim()
    const lower = raw.toLowerCase()
    if (!USERNAME_RE.test(lower)) {
      throw new HttpsError('invalid-argument', 'Usernames are 3–20 characters: letters, numbers, underscores.')
    }

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

interface SyncInput {
  points?: number
  streakCurrent?: number
  streakBest?: number
  freezeTokens?: number
  volume7?: number
  volume30?: number
  sessionsThisWeek?: number
  /** IANA timezone (e.g. 'Australia/Sydney'), used only to bucket the user's
   *  cohort by timezone once a tier is large enough to segment. Absent → home tz. */
  tz?: string
}

/** A reserved slot in a weekly cohort. */
interface CohortSlot { cohortId: string; joinedAtMillis: number }

/** Reserve (or create) an open cohort slot for a user in a given week+tier inside a
 *  transaction, updating the allocator bookkeeping. Performs its reads before any
 *  write, so the CALLER must not have written to the transaction yet (Firestore's
 *  all-reads-before-writes rule). Returns the chosen cohortId; the caller writes the
 *  member + profile docs. Segmentation level is read from the tier control doc and
 *  advanced (for FUTURE joiners only) once the segment has enough cohorts.
 *
 *  Contention note: at level 0 every joiner in a tier touches the same segment doc;
 *  transactions retry under contention, which is fine at launch write rates and self-
 *  distributes once a tier splits by timezone/band. */
async function reserveCohortSlot(
  tx: Transaction,
  db: FirebaseFirestore.Firestore,
  weekKey: string,
  tier: number,
  tzBucket: string,
  band: number,
  nowMs: number,
): Promise<CohortSlot> {
  const ctrlRef = db.doc(`leagueAllocator/${weekKey}/tiers/${tier}`)
  const ctrlSnap = await tx.get(ctrlRef)
  const level = typeof ctrlSnap.get('level') === 'number' ? ctrlSnap.get('level') : 0
  const segKey = segmentKeyForLevel(tier, tzBucket, band, level)
  const segDocId = segKey.replace(/[^\w+-]/g, '_')
  const segRef = db.doc(`leagueAllocator/${weekKey}/tiers/${tier}/segments/${segDocId}`)
  const segSnap = await tx.get(segRef)

  let openCohortId = typeof segSnap.get('openCohortId') === 'string' ? segSnap.get('openCohortId') : ''
  let openCount = typeof segSnap.get('openCount') === 'number' ? segSnap.get('openCount') : 0
  let seq = typeof segSnap.get('seq') === 'number' ? segSnap.get('seq') : 0
  let cohortCount = typeof segSnap.get('cohortCount') === 'number' ? segSnap.get('cohortCount') : 0

  let minted = false
  if (!openCohortId || openCount >= COHORT_CAP) {
    seq += 1
    openCohortId = `${segDocId}-${seq}`
    openCount = 0
    cohortCount += 1
    minted = true
  }
  openCount += 1

  // --- writes (all reads above are done) ---
  const cohortRef = db.doc(`leagueStandings/${weekKey}/tiers/${tier}/cohorts/${openCohortId}`)
  if (minted) {
    tx.set(cohortRef, {
      segKey, tz: tzBucket, band, level, size: 1,
      tieRulesVersion: TIE_RULES_VERSION, rolledOver: false,
      createdAt: FieldValue.serverTimestamp(),
    })
  } else {
    tx.set(cohortRef, { size: FieldValue.increment(1) }, { merge: true })
  }
  tx.set(segRef, { openCohortId, openCount, seq, cohortCount }, { merge: true })
  const lvl = nextLevel(cohortCount, level)
  if (lvl !== level) tx.set(ctrlRef, { level: lvl }, { merge: true })

  return { cohortId: openCohortId, joinedAtMillis: nowMs }
}

const intIn = (v: unknown, min: number, max: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : min
  return Math.max(min, Math.min(max, n))
}

/** Push the user's honest weekly consistency (odometer points) + streak to the
 *  server, which mirrors it into this week's league standings for their tier. */
export const syncCommunityStats = onCall<SyncInput>(
  { region: 'australia-southeast2' },
  async (req) => {
    const uid = requireAuth(req)
    const points = intIn(req.data?.points, 0, 100)
    const streakCurrent = intIn(req.data?.streakCurrent, 0, 10000)
    const streakBest = intIn(req.data?.streakBest, 0, 10000)
    const freezeTokens = intIn(req.data?.freezeTokens, 0, FREEZE_CAP)
    const volume7 = intIn(req.data?.volume7, 0, 100_000_000)
    const volume30 = intIn(req.data?.volume30, 0, 400_000_000)
    const sessionsThisWeek = intIn(req.data?.sessionsThisWeek, 0, 50)
    const tzRaw = typeof req.data?.tz === 'string' ? req.data.tz.slice(0, 64) : undefined

    const db = getFirestore()
    const profRef = db.collection('communityProfiles').doc(uid)
    const nowMs = Date.now()
    const weekKey = mondayKey(new Date(nowMs))
    const tzBucket = tzBucketOf(tzRaw, nowMs)
    const band = bandOf(sessionsThisWeek)

    // Everything competitive is written in ONE transaction so cohort assignment,
    // the member standing and the profile stay consistent (and a user is never
    // double-allocated by two concurrent first-syncs).
    const res = await db.runTransaction(async (tx) => {
      // --- reads first ---
      const prof = await tx.get(profRef)
      const username = prof.get('username') as string | undefined
      if (!username) throw new HttpsError('failed-precondition', 'Claim a username first.')
      const tier = clampTier(typeof prof.get('tier') === 'number' ? prof.get('tier') : 0)

      // The weekly cohort is IMMUTABLE: reuse it while it's still this week and this
      // tier; otherwise (first sync of the week, or a late join) reserve a new slot.
      const reuse = prof.get('cohortWeekKey') === weekKey
        && prof.get('cohortTier') === tier
        && typeof prof.get('cohortId') === 'string' && !!prof.get('cohortId')
      let slot: CohortSlot
      if (reuse) {
        slot = {
          cohortId: prof.get('cohortId') as string,
          joinedAtMillis: typeof prof.get('cohortJoinedAtMillis') === 'number' ? prof.get('cohortJoinedAtMillis') : nowMs,
        }
      } else {
        slot = await reserveCohortSlot(tx, db, weekKey, tier, tzBucket, band, nowMs)
      }
      const groupIds: string[] = Array.isArray(prof.get('groupIds')) ? prof.get('groupIds') : []

      // --- writes ---
      const rankKey = rankKeyFor({ points, sessionsThisWeek, joinedAtMillis: slot.joinedAtMillis, uid })
      tx.set(
        db.doc(`leagueStandings/${weekKey}/tiers/${tier}/cohorts/${slot.cohortId}/members/${uid}`),
        { uid, username, points, sessionsThisWeek, joinedAtMillis: slot.joinedAtMillis, rankKey, tieRulesVersion: TIE_RULES_VERSION },
        { merge: true },
      )
      // These stats also feed the friend-group leaderboards; they're stored on the
      // profile and fanned out to the user's group member docs below.
      tx.set(
        profRef,
        {
          points, streakCurrent, streakBest, freezeTokens, volume7, volume30, sessionsThisWeek,
          tier, weekKey, ...(tzRaw ? { tz: tzRaw } : {}),
          cohortId: slot.cohortId, cohortTier: tier, cohortWeekKey: weekKey, cohortJoinedAtMillis: slot.joinedAtMillis,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
      return { tier, username, groupIds, cohortId: slot.cohortId }
    })

    // Fan the fresh stats out to the user's friend-group member docs so group
    // leaderboards reflect current activity (communityGroups.ts owns the shape).
    if (res.groupIds.length) {
      const memberStats = { username: res.username, odometer: points, streak: streakCurrent, bestStreak: streakBest, volume7, volume30, sessionsThisWeek }
      const batch = db.batch()
      for (const gid of res.groupIds.slice(0, 50)) {
        batch.set(db.doc(`groups/${gid}/members/${uid}`), memberStats, { merge: true })
      }
      await batch.commit()
    }
    return { ok: true, tier: res.tier, weekKey, cohortId: res.cohortId }
  },
)

/* -------------------------------- rolloverLeagues -------------------------- */

/** Weekly promotion/demotion, per COHORT. Runs every Monday: for the just-ended
 *  week it walks every cohort in every tier, moves that cohort's top finishers up
 *  and its bottom finishers down (bounded reads by `rankKey`, promotion winning ties
 *  in a small cohort), and resets everyone's points. Because promotion is now scoped
 *  to a ~25-person cohort rather than the whole tier, the odds are real at any scale.
 *
 *  Idempotent (schedulers retry): a done-marker at leagueRollovers/{prevWeek} short-
 *  circuits a completed run, and each cohort's member resets + its `rolledOver` flag
 *  land in ONE atomic batch (a cohort is ≤ COHORT_CAP, well under the 500-op limit),
 *  so a re-run skips already-processed cohorts and never double-counts the
 *  non-idempotent `seasonWins` increment. */
export const rolloverLeagues = onSchedule(
  { schedule: '5 0 * * 1', timeZone: 'Australia/Sydney', region: 'australia-southeast1', timeoutSeconds: 540, memory: '512MiB' },
  async () => {
    const db = getFirestore()
    // The week that just ended = the Monday 7 days before today (in the app tz).
    const now = new Date()
    const prevWeek = mondayKey(new Date(now.getTime() - 7 * 86400000))

    const rolloverRef = db.doc(`leagueRollovers/${prevWeek}`)
    if ((await rolloverRef.get()).get('done') === true) {
      logger.info('community.rolloverLeagues.skip', { prevWeek })
      return
    }

    let promoted = 0
    let demoted = 0
    let cohorts = 0
    for (let tier = 0; tier < TIERS.length; tier++) {
      const cfg = TIERS[tier]
      const cohortsCol = db.collection(`leagueStandings/${prevWeek}/tiers/${tier}/cohorts`)

      await forEachPaged(cohortsCol, 200, async (cohortDoc) => {
        if (cohortDoc.get('rolledOver') === true) return
        const members = db.collection(`leagueStandings/${prevWeek}/tiers/${tier}/cohorts/${cohortDoc.id}/members`)

        // Movers: bounded reads of just the top (promote up) and bottom (demote down).
        const promoteIds = new Set<string>()
        const demoteIds = new Set<string>()
        if (cfg.promote > 0) {
          const top = await members.orderBy('rankKey', 'asc').limit(cfg.promote).get()
          for (const d of top.docs) promoteIds.add(d.id)
        }
        if (cfg.demote > 0) {
          const bottom = await members.orderBy('rankKey', 'desc').limit(cfg.demote).get()
          // Promotion wins in a cohort smaller than promote + demote.
          for (const d of bottom.docs) if (!promoteIds.has(d.id)) demoteIds.add(d.id)
        }

        // Reset the whole cohort's points + apply moves in ONE atomic batch (≤ cap+1
        // ops), flagging the cohort in the same commit so retries skip it.
        const all = await members.get()
        const batch = db.batch()
        for (const doc of all.docs) {
          const memberUid = doc.id
          const newTier = promoteIds.has(memberUid) ? clampTier(tier + 1)
            : demoteIds.has(memberUid) ? clampTier(tier - 1)
            : tier
          if (newTier > tier) promoted++
          else if (newTier < tier) demoted++
          batch.set(
            db.collection('communityProfiles').doc(memberUid),
            {
              tier: newTier,
              points: 0,
              ...(newTier > tier ? { seasonWins: FieldValue.increment(1) } : {}),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          )
        }
        batch.set(cohortDoc.ref, { rolledOver: true }, { merge: true })
        await batch.commit()
        cohorts++
      })
    }
    await rolloverRef.set({ done: true, cohorts, at: FieldValue.serverTimestamp() }, { merge: true })
    logger.info('community.rolloverLeagues', { prevWeek, promoted, demoted, cohorts })
  },
)

/* -------------------------------- backfillCohorts ------------------------- */

interface BackfillInput { weekKey?: string }

/** One-shot, owner-only migration/repair: assign every active community member into
 *  a cohort for `weekKey` (defaults to the current week). Use it to migrate from the
 *  old flat standings model or to repair users the JIT allocator missed. Idempotent —
 *  a user already placed in that week's cohort is skipped, and each user's placement
 *  runs in its own transaction (correct even if syncCommunityStats runs concurrently).
 *  The lazy allocator in syncCommunityStats handles ordinary late joins, so this is
 *  only for bulk backfills. */
export const backfillCohorts = onCall<BackfillInput>(
  { region: 'australia-southeast2', timeoutSeconds: 540, memory: '512MiB' },
  async (req) => {
    requireOwner(req)
    const db = getFirestore()
    const nowMs = Date.now()
    const weekKey = typeof req.data?.weekKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.data.weekKey)
      ? req.data.weekKey
      : mondayKey(new Date(nowMs))

    let assigned = 0
    let skipped = 0
    await forEachPaged(db.collection('communityProfiles'), 200, async (doc) => {
      if (!doc.get('username')) { skipped++; return }
      if (doc.get('cohortWeekKey') === weekKey && typeof doc.get('cohortId') === 'string' && doc.get('cohortId')) {
        skipped++
        return
      }
      const uid = doc.id
      await db.runTransaction(async (tx) => {
        // Re-read inside the txn so a concurrent syncCommunityStats can't be clobbered.
        const prof = await tx.get(doc.ref)
        if (!prof.get('username')) return
        if (prof.get('cohortWeekKey') === weekKey && typeof prof.get('cohortId') === 'string' && prof.get('cohortId')) return
        const tier = clampTier(typeof prof.get('tier') === 'number' ? prof.get('tier') : 0)
        const points = intIn(prof.get('points'), 0, 100)
        const sessionsThisWeek = intIn(prof.get('sessionsThisWeek'), 0, 50)
        const tzBucket = tzBucketOf(typeof prof.get('tz') === 'string' ? prof.get('tz') : undefined, nowMs)
        const slot = await reserveCohortSlot(tx, db, weekKey, tier, tzBucket, bandOf(sessionsThisWeek), nowMs)
        const rankKey = rankKeyFor({ points, sessionsThisWeek, joinedAtMillis: slot.joinedAtMillis, uid })
        tx.set(
          db.doc(`leagueStandings/${weekKey}/tiers/${tier}/cohorts/${slot.cohortId}/members/${uid}`),
          { uid, username: prof.get('username'), points, sessionsThisWeek, joinedAtMillis: slot.joinedAtMillis, rankKey, tieRulesVersion: TIE_RULES_VERSION },
          { merge: true },
        )
        tx.set(
          doc.ref,
          { cohortId: slot.cohortId, cohortTier: tier, cohortWeekKey: weekKey, cohortJoinedAtMillis: slot.joinedAtMillis, updatedAt: FieldValue.serverTimestamp() },
          { merge: true },
        )
        assigned++
      })
    })
    logger.info('community.backfillCohorts', { weekKey, assigned, skipped })
    return { ok: true, weekKey, assigned, skipped }
  },
)

/* ------------------------------ grantStreakFreezes ------------------------- */

/** Weekly freeze grant — tops every community member up by one freeze token, to a
 *  cap. A field-transform can't itself clamp, so a min() would need a read; for a
 *  weekly grant we simply set the cap when already at/over it and otherwise
 *  increment. The cohort scan is paginated so memory stays flat as it grows. */
export const grantStreakFreezes = onSchedule(
  { schedule: '10 0 * * 1', timeZone: 'Australia/Sydney', region: 'australia-southeast1', timeoutSeconds: 540, memory: '512MiB' },
  async () => {
    const db = getFirestore()
    let granted = 0
    let batch = db.batch()
    let ops = 0
    await forEachPaged(db.collection('communityProfiles'), 400, async (doc) => {
      const cur = typeof doc.get('freezeTokens') === 'number' ? doc.get('freezeTokens') : 0
      if (cur >= FREEZE_CAP) return
      batch.set(doc.ref, { freezeTokens: Math.min(FREEZE_CAP, cur + 1) }, { merge: true })
      granted++
      if (++ops >= 400) { await batch.commit(); batch = db.batch(); ops = 0 }
    })
    if (ops > 0) await batch.commit()
    logger.info('community.grantStreakFreezes', { granted })
  },
)
