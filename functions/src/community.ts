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
 *                                                          freezeTokens, weekKey, updatedAt }
 *   leagueStandings/{weekKey}/tiers/{tier}/members/{uid} → { username, points }
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
import { FieldPath, FieldValue, getFirestore, type Query } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import * as logger from 'firebase-functions/logger'
import { requireAuth, auditAppCheck, APP_CHECK_ENFORCED } from './lib/guards'
import { enforceDailyLimit } from './lib/rateLimit'

const REGION = 'australia-southeast2'
const MAX_INSTANCES = 10 // cost bound for the callables (audit F-024)
const CALL_OPTS = { region: REGION, enforceAppCheck: APP_CHECK_ENFORCED, maxInstances: MAX_INSTANCES }

// Handles that must not be claimable — impersonation / official-looking names
// (audit F-009). Case-insensitive; extend as policy evolves. This is a minimum
// reserved-name guard, not a full profanity/moderation suite.
const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'strengthhub', 'sho', 'support', 'help', 'official',
  'staff', 'team', 'moderator', 'mod', 'root', 'system', 'coach', 'null', 'undefined',
  'me', 'you', 'everyone', 'anonymous', 'owner',
])

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
  CALL_OPTS,
  async (req) => {
    const uid = requireAuth(req)
    auditAppCheck(req, 'claimUsername')
    // Bounds name-reservation / squatting attempts (audit F-008).
    await enforceDailyLimit('community.claimUsername', uid, 20)
    const raw = (req.data?.username ?? '').trim()
    const lower = raw.toLowerCase()
    if (!USERNAME_RE.test(lower)) {
      throw new HttpsError('invalid-argument', 'Usernames are 3–20 characters: letters, numbers, underscores.')
    }
    if (RESERVED_USERNAMES.has(lower)) {
      throw new HttpsError('invalid-argument', 'That username is reserved.')
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
}

const intIn = (v: unknown, min: number, max: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : min
  return Math.max(min, Math.min(max, n))
}

/** Push the user's honest weekly consistency (odometer points) + streak to the
 *  server, which mirrors it into this week's league standings for their tier. */
export const syncCommunityStats = onCall<SyncInput>(
  CALL_OPTS,
  async (req) => {
    const uid = requireAuth(req)
    auditAppCheck(req, 'syncCommunityStats')
    // Called on League open; generous cap just bounds a scripted abuser.
    await enforceDailyLimit('community.syncStats', uid, 200)
    const points = intIn(req.data?.points, 0, 100)
    const streakCurrent = intIn(req.data?.streakCurrent, 0, 10000)
    const streakBest = intIn(req.data?.streakBest, 0, 10000)
    const freezeTokens = intIn(req.data?.freezeTokens, 0, FREEZE_CAP)
    const volume7 = intIn(req.data?.volume7, 0, 100_000_000)
    const volume30 = intIn(req.data?.volume30, 0, 400_000_000)
    const sessionsThisWeek = intIn(req.data?.sessionsThisWeek, 0, 50)

    const db = getFirestore()
    const profRef = db.collection('communityProfiles').doc(uid)
    const prof = await profRef.get()
    const username = prof.get('username') as string | undefined
    if (!username) throw new HttpsError('failed-precondition', 'Claim a username first.')

    const tier = clampTier(typeof prof.get('tier') === 'number' ? prof.get('tier') : 0)
    const weekKey = mondayKey(new Date())

    // These stats also feed the friend-group leaderboards; they're stored on the
    // profile and fanned out to the user's group member docs by syncGroupStats.
    await profRef.set(
      { points, streakCurrent, streakBest, freezeTokens, volume7, volume30, sessionsThisWeek, tier, weekKey, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    )
    await db.doc(`leagueStandings/${weekKey}/tiers/${tier}/members/${uid}`).set({ username, points }, { merge: true })

    // Fan the fresh stats out to the user's friend-group member docs so group
    // leaderboards reflect current activity (communityGroups.ts owns the shape).
    const groupIds: string[] = Array.isArray(prof.get('groupIds')) ? prof.get('groupIds') : []
    if (groupIds.length) {
      const memberStats = { username, odometer: points, streak: streakCurrent, bestStreak: streakBest, volume7, volume30, sessionsThisWeek }
      const batch = db.batch()
      for (const gid of groupIds.slice(0, 50)) {
        batch.set(db.doc(`groups/${gid}/members/${uid}`), memberStats, { merge: true })
      }
      await batch.commit()
    }
    return { ok: true, tier, weekKey }
  },
)

/* -------------------------------- rolloverLeagues -------------------------- */

/** Weekly promotion/demotion. Runs every Monday: for the just-ended week it moves
 *  each tier's top cohort up and its bottom cohort down, then resets everyone's
 *  points. The movers are found with two *bounded* queries (top N by points desc,
 *  bottom M by points asc) rather than loading the whole tier — promotion wins ties
 *  with demotion in a small cohort (the bottom set is minus the top set), exactly
 *  reproducing the previous rank-based logic. The points reset streams the cohort
 *  in pages so memory stays flat as the user base grows. */
export const rolloverLeagues = onSchedule(
  { schedule: '5 0 * * 1', timeZone: 'Australia/Sydney', region: 'australia-southeast1', timeoutSeconds: 540, memory: '512MiB' },
  async () => {
    const db = getFirestore()
    // The week that just ended = the Monday 7 days before today (in the app tz).
    const now = new Date()
    const prevWeek = mondayKey(new Date(now.getTime() - 7 * 86400000))

    let promoted = 0
    let demoted = 0
    for (let tier = 0; tier < TIERS.length; tier++) {
      const cfg = TIERS[tier]
      const members = db.collection(`leagueStandings/${prevWeek}/tiers/${tier}/members`)

      // Movers: bounded reads of just the top (promote up) and bottom (demote down).
      const moves = new Map<string, number>() // uid → new tier
      if (cfg.promote > 0) {
        const top = await members.orderBy('points', 'desc').limit(cfg.promote).get()
        for (const d of top.docs) moves.set(d.id, clampTier(tier + 1))
      }
      if (cfg.demote > 0) {
        const bottom = await members.orderBy('points', 'asc').limit(cfg.demote).get()
        // Promotion wins in a cohort smaller than promote + demote.
        for (const d of bottom.docs) if (!moves.has(d.id)) moves.set(d.id, clampTier(tier - 1))
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
    logger.info('community.rolloverLeagues', { prevWeek, promoted, demoted })
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
