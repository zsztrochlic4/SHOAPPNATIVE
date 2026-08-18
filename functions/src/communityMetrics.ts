/**
 * Community ops/health metrics — a daily server-side aggregate the app owner reads
 * to see how the hub is doing (participation, integrity holds, moderation backlog,
 * group mix). Computed with Firestore count() aggregations (cheap — no document
 * fan-out), written to `communityMetrics/{dateKey}` plus a `latest` pointer.
 *
 * Deliberately NOT product analytics: there is no third-party SDK and no new PII —
 * every number here is derived from data the backend already holds. Owner-readable
 * only (firestore.rules), written only by this scheduled function.
 */
import { FieldValue, getFirestore, type Query } from 'firebase-admin/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import * as logger from 'firebase-functions/logger'
import { onCall } from 'firebase-functions/v2/https'
import { requireOwner, auditAppCheck, APP_CHECK_ENFORCED } from './lib/guards'
import { mondayKey } from './community'

const REGION_SCHED = 'australia-southeast1'
const REGION_CALL = 'australia-southeast2'

const countOf = async (q: Query): Promise<number> => {
  try {
    const snap = await q.count().get()
    return snap.data().count
  } catch (e) {
    logger.warn('community.metrics.count_failed', { error: String(e) })
    return 0
  }
}

/** Compute one metrics snapshot. Exposed so both the schedule and a manual
 *  owner-triggered refresh run identical code. */
async function computeSnapshot(): Promise<Record<string, unknown>> {
  const db = getFirestore()
  const now = new Date()
  const weekKey = mondayKey(now)
  const profiles = db.collection('communityProfiles')
  const directory = db.collection('groupDirectory')

  const [
    profilesTotal, streaksActive, activeThisWeek, held, provisional,
    reportsPending, reviewsPending, groupsTotal, groupsPublic,
  ] = await Promise.all([
    countOf(profiles),
    countOf(profiles.where('streakCurrent', '>', 0)),
    countOf(profiles.where('weekKey', '==', weekKey)),
    countOf(profiles.where('status', '==', 'held')),
    countOf(profiles.where('status', '==', 'provisional')),
    countOf(db.collection('contentReports').where('status', '==', 'pending')),
    countOf(db.collection('communityReviews').where('state', '==', 'pending')),
    countOf(directory),
    countOf(directory.where('visibility', '==', 'public')),
  ])

  return {
    weekKey,
    profilesTotal,
    streaksActive,
    activeThisWeek,
    heldStandings: held,
    provisionalStandings: provisional,
    reportsPending,
    reviewsPending,
    groupsTotal,
    groupsPublic,
    groupsPrivate: Math.max(0, groupsTotal - groupsPublic),
    computedAt: FieldValue.serverTimestamp(),
  }
}

async function writeSnapshot(): Promise<Record<string, unknown>> {
  const db = getFirestore()
  const snap = await computeSnapshot()
  const dateKey = String(snap.weekKey) // week-bucketed; a daily key would also work
  const today = new Date().toISOString().slice(0, 10)
  const batch = db.batch()
  batch.set(db.collection('communityMetrics').doc(today), snap)
  batch.set(db.collection('communityMetrics').doc('latest'), snap)
  await batch.commit()
  logger.info('community.metrics.written', { dateKey, today, profilesTotal: snap.profilesTotal, reportsPending: snap.reportsPending })
  return snap
}

/** Daily community health snapshot (03:00 Sydney). */
export const computeCommunityMetrics = onSchedule(
  { schedule: '0 3 * * *', timeZone: 'Australia/Sydney', region: REGION_SCHED, timeoutSeconds: 120, memory: '256MiB' },
  async () => { await writeSnapshot() },
)

/** Owner-only on-demand refresh (so the owner can pull fresh numbers without
 *  waiting for the daily run). Returns the snapshot it just wrote. */
export const refreshCommunityMetrics = onCall(
  { region: REGION_CALL, enforceAppCheck: APP_CHECK_ENFORCED },
  async (req) => {
    requireOwner(req)
    auditAppCheck(req, 'refreshCommunityMetrics')
    const snap = await writeSnapshot()
    return { ok: true as const, metrics: snap }
  },
)
