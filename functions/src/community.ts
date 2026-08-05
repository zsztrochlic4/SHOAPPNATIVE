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
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import * as logger from 'firebase-functions/logger'
import { requireAuth } from './lib/guards'

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

/** Monday (UTC) date-key for the week containing `d`. NOTE: production should pin
 *  this to the app's timezone (Australia) so resets align with users' local week;
 *  UTC is used here for determinism and is fine for a first cut. */
function mondayKey(d: Date): string {
  const dow = (d.getUTCDay() + 6) % 7 // Mon = 0 … Sun = 6
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow))
  return monday.toISOString().slice(0, 10)
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

/** Weekly promotion/demotion. Runs every Monday: ranks each tier's cohort from
 *  the just-ended week and moves the top up / the bottom down, then resets points.
 *  Scale note: this reads all of last week's standings; for a large user base this
 *  should be sharded per tier/region and paginated. Fine for launch volumes. */
export const rolloverLeagues = onSchedule(
  { schedule: '5 0 * * 1', timeZone: 'Australia/Sydney', region: 'australia-southeast1', timeoutSeconds: 540, memory: '512MiB' },
  async () => {
    const db = getFirestore()
    // The week that just ended = the Monday 7 days before today.
    const now = new Date()
    const prevWeek = mondayKey(new Date(now.getTime() - 7 * 86400000))

    let promoted = 0
    let demoted = 0
    for (let tier = 0; tier < TIERS.length; tier++) {
      const cfg = TIERS[tier]
      const snap = await db
        .collection(`leagueStandings/${prevWeek}/tiers/${tier}/members`)
        .orderBy('points', 'desc')
        .get()
      const docs = snap.docs
      const n = docs.length
      let batch = db.batch()
      let ops = 0
      for (let rank = 1; rank <= n; rank++) {
        const uid = docs[rank - 1].id
        let newTier = tier
        if (cfg.promote > 0 && rank <= cfg.promote) newTier = clampTier(tier + 1)
        else if (cfg.demote > 0 && rank > n - cfg.demote) newTier = clampTier(tier - 1)
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
      }
      if (ops > 0) await batch.commit()
    }
    logger.info('community.rolloverLeagues', { prevWeek, promoted, demoted })
  },
)

/* ------------------------------ grantStreakFreezes ------------------------- */

/** Weekly freeze grant — tops every community member up by one freeze token, to a
 *  cap. A field-transform can't itself clamp, so a min() would need a read; for a
 *  weekly grant we simply set the cap when already at/over it and otherwise
 *  increment. Scale note: paginate for very large user bases. */
export const grantStreakFreezes = onSchedule(
  { schedule: '10 0 * * 1', timeZone: 'Australia/Sydney', region: 'australia-southeast1', timeoutSeconds: 540, memory: '512MiB' },
  async () => {
    const db = getFirestore()
    const snap = await db.collection('communityProfiles').get()
    let granted = 0
    let batch = db.batch()
    let ops = 0
    for (const doc of snap.docs) {
      const cur = typeof doc.get('freezeTokens') === 'number' ? doc.get('freezeTokens') : 0
      if (cur >= FREEZE_CAP) continue
      batch.set(doc.ref, { freezeTokens: Math.min(FREEZE_CAP, cur + 1) }, { merge: true })
      granted++
      if (++ops >= 400) { await batch.commit(); batch = db.batch(); ops = 0 }
    }
    if (ops > 0) await batch.commit()
    logger.info('community.grantStreakFreezes', { granted })
  },
)
