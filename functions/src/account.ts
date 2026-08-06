import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { getAuth } from 'firebase-admin/auth'
import * as logger from 'firebase-functions/logger'
import { requireAuth, auditAppCheck, APP_CHECK_ENFORCED } from './lib/guards'

/**
 * Complete, authoritative account deletion (audit F-002 / SA-002).
 *
 * Runs with Admin privileges, so it does the parts the client can't: neutralises
 * the login, hard-deletes the root `users/{uid}` doc (client rules block that by
 * design), every subcollection under it, the coach workspace and safety state,
 * the entitlement record, rate-limit buckets, any Storage objects, and the login
 * record — no "recent login" re-auth required.
 *
 * This is the ONLY deletion path: the client has no destructive fallback (the
 * old one could delete data then fail `deleteUser` on requires-recent-login,
 * leaving a live login with no data — worse than failing).
 *
 * ── Ordering (audit SA-002): AUTH-FIRST, not data-first ────────────────────
 * The identity is REVOKED before any data is destroyed:
 *   0. tombstone (job accepted)                        → phase 'accepted'
 *   1. disable the login + revoke refresh tokens       → phase 'auth_revoked'
 *   2. delete all Firestore data + Storage             → phase 'data_deleted'
 *   3. delete the Auth user record                     → phase 'complete'
 * If step 1 fails, NOTHING has been destroyed → the client truthfully says
 * "Nothing was deleted, retry." Once step 1 succeeds the account can never be
 * used again, so from that point the client must NEVER claim "nothing was
 * deleted": a mid-run failure is reported as an in-progress, resumable deletion.
 *
 * ── Resumability (audit SA-002 acceptance) ─────────────────────────────────
 * The job is IDEMPOTENT and RESUMABLE. Each step tolerates already-deleted
 * resources. A client retry (its ID token stays verifiable until it expires)
 * resumes from the tombstone phase. And because a disabled account can no longer
 * sign in to retry, `resumeAccountDeletions` sweeps stuck jobs on a schedule and
 * finishes them with Admin privileges — so an injected Auth/Storage/Firestore
 * failure always converges to a complete deletion. The tombstone (uid +
 * timestamps + phase only, no personal content) is retained as the deletion
 * audit record — the documented retention exception (docs/PRIVACY.md).
 */

/** Deletion phase, mirrored into the tombstone and returned/thrown to the client. */
export type DeletionPhase = 'accepted' | 'auth_revoked' | 'data_deleted' | 'complete'

/**
 * Deletion registry — every UID-bearing Firestore location (audit F-013). Keep
 * this list in sync with firestore.rules; anything new that stores a uid MUST
 * be added here (and to the export in src/store/cloudRepo.ts where
 * client-readable). Community data outside communityProfiles/{uid}
 * (communityReviews, the usernames reservation, historical leagueStandings rows)
 * is handled explicitly in purgeAccountData below.
 */
// Root docs whose whole subtree is removed. `communityProfiles` carries the F-003
// per-day scoring log (scoreDays/scoreEvents) as subcollections, so it MUST be a
// recursive delete — deleting the parent doc alone would orphan that personal data.
const RECURSIVE_DOCS = ['users', 'coachUsers', 'communityProfiles'] as const
const SINGLE_DOCS = ['coachSafety', 'entitlements'] as const

function jobRef(uid: string) {
  return getFirestore().collection('deletionJobs').doc(uid)
}

function setPhase(uid: string, phase: DeletionPhase, extra: Record<string, unknown> = {}) {
  return jobRef(uid).set(
    {
      uid,
      phase,
      status: phase === 'complete' ? 'complete' : 'in_progress',
      updatedAt: FieldValue.serverTimestamp(),
      ...extra,
    },
    { merge: true },
  )
}

/** Step 1 — neutralise the identity. Idempotent (user-not-found ⇒ already gone). */
async function revokeIdentity(uid: string): Promise<void> {
  try {
    await getAuth().updateUser(uid, { disabled: true })
    await getAuth().revokeRefreshTokens(uid)
  } catch (err) {
    if ((err as { code?: string })?.code === 'auth/user-not-found') return
    throw err
  }
}

/** Step 2 — delete all Firestore data + Storage objects. Idempotent. */
async function purgeAccountData(uid: string): Promise<void> {
  const db = getFirestore()

  // Capture the community handle BEFORE the profile subtree is deleted — we need
  // its lowercase form to release the `usernames/{lower}` reservation below.
  let usernameLower: string | null = null
  try {
    const prof = await db.collection('communityProfiles').doc(uid).get()
    if (prof.exists) usernameLower = (prof.get('usernameLower') as string) || (prof.get('username') as string) || null
  } catch {
    /* community backend off / not readable — nothing to release */
  }

  for (const col of RECURSIVE_DOCS) {
    await db.recursiveDelete(db.collection(col).doc(uid))
  }
  for (const col of SINGLE_DOCS) {
    await db.collection(col).doc(uid).delete()
  }
  // Rate-limit buckets carry a `uid` field precisely so deletion can find them
  // (their doc ids embed the uid + day). TTL would reap them within days anyway;
  // this makes "delete all my data" literally true now.
  const buckets = await db.collection('rateLimits').where('uid', '==', uid).get()
  for (const d of buckets.docs) await d.ref.delete()

  // Community data that lives OUTSIDE communityProfiles/{uid} (so the recursive
  // delete above didn't reach it): the moderation review record, the username
  // reservation, and every historical league-standing row (F-003 privacy sign-off
  // §A.4). Each step is idempotent and attempted independently so a retry makes
  // progress; if ANY fails we THROW, which keeps the deletion job at 'auth_revoked'
  // (in_progress) so the scheduled sweep retries it — the job must NOT be marked
  // complete while personal data remains (the audit record would lie).
  const failed: string[] = []
  const attempt = async (label: string, fn: () => Promise<void>): Promise<void> => {
    try { await fn() } catch (err) { failed.push(label); logger.warn('account.purge.community_step_failed', { uid, step: label, err: String(err) }) }
  }
  await attempt('reviews', () => db.collection('communityReviews').doc(uid).delete().then(() => undefined))
  await attempt('username', async () => {
    // Release the handle only if this user still owns it (guards a since-reassigned
    // reservation — claimUsername keeps usernames/{lower}.uid in sync with the owner).
    if (!usernameLower) return
    const nameRef = db.collection('usernames').doc(usernameLower)
    const nameSnap = await nameRef.get()
    if (nameSnap.exists && nameSnap.get('uid') === uid) await nameRef.delete()
  })
  await attempt('standings', async () => {
    // Historical standings: one member doc per week/tier, each carrying a `uid`
    // field for exactly this lookup. Scoped to leagueStandings so a future `uid` on
    // a group member doc could never be swept here.
    const standings = await db.collectionGroup('members').where('uid', '==', uid).get()
    let batch = db.batch()
    let ops = 0
    for (const d of standings.docs) {
      if (!d.ref.path.startsWith('leagueStandings/')) continue
      batch.delete(d.ref)
      if (++ops >= 400) { await batch.commit(); batch = db.batch(); ops = 0 }
    }
    if (ops > 0) await batch.commit()
  })
  if (failed.length) {
    throw new Error(`community cleanup incomplete: ${failed.join(', ')} — deletion job kept in progress for retry`)
  }
  // Any Storage objects for this user (best-effort; none are stored today).
  try {
    await getStorage().bucket().deleteFiles({ prefix: `users/${uid}/` })
  } catch {
    /* no bucket/objects, or storage not provisioned — non-fatal */
  }
}

/** Step 3 — delete the Auth record. Idempotent. */
async function deleteAuthRecord(uid: string): Promise<void> {
  try {
    await getAuth().deleteUser(uid)
  } catch (err) {
    if ((err as { code?: string })?.code === 'auth/user-not-found') return
    throw err
  }
}

export const deleteAccount = onCall(
  { enforceAppCheck: APP_CHECK_ENFORCED, timeoutSeconds: 300, memory: '512MiB' },
  async (req: CallableRequest): Promise<{ ok: true; status: DeletionPhase }> => {
    auditAppCheck(req, 'deleteAccount')
    const uid = requireAuth(req)

    // 0. Tombstone FIRST: the job is accepted before anything is touched, so a
    // partial failure is visibly in_progress and a retry (client or sweep) resumes it.
    await setPhase(uid, 'accepted', { startedAt: FieldValue.serverTimestamp() })

    // 1. AUTH-FIRST: neutralise the identity before destroying any data. If this
    // fails, no data has been touched — the client can safely say nothing was
    // deleted and retry.
    try {
      await revokeIdentity(uid)
    } catch {
      throw new HttpsError(
        'internal',
        'Could not start deleting your account. Nothing was deleted — please try again.',
        { phase: 'accepted' as DeletionPhase, accountDisabled: false, dataDeleted: false },
      )
    }
    await setPhase(uid, 'auth_revoked')

    // 2. All Firestore data + Storage. A failure here leaves the account already
    // revoked, so the client reports an in-progress deletion — never "nothing
    // was deleted" — and the scheduled sweep will finish it.
    try {
      await purgeAccountData(uid)
    } catch {
      throw new HttpsError(
        'internal',
        'Your account access has been revoked and deletion is in progress; some data is still being removed. Please reopen the app and retry to finish.',
        { phase: 'auth_revoked' as DeletionPhase, accountDisabled: true, dataDeleted: 'partial' },
      )
    }
    await setPhase(uid, 'data_deleted')

    // 3. Remove the login record itself (admin — no recent-login requirement).
    try {
      await deleteAuthRecord(uid)
    } catch {
      throw new HttpsError(
        'internal',
        'Your data has been deleted and your account is disabled; finishing the last step. Please reopen the app and retry.',
        { phase: 'data_deleted' as DeletionPhase, accountDisabled: true, dataDeleted: true },
      )
    }

    // 4. Mark the job complete — this doubles as the minimal audit record.
    await setPhase(uid, 'complete', { completedAt: FieldValue.serverTimestamp() })

    return { ok: true, status: 'complete' }
  },
)

/**
 * Finish a partially-completed deletion from its current phase (audit SA-002).
 * Used by the scheduled sweep. Safe to call at any phase; each step is idempotent.
 */
export async function finishDeletion(uid: string, phase: DeletionPhase): Promise<void> {
  if (phase === 'complete') return
  if (phase === 'accepted') {
    await revokeIdentity(uid)
    await setPhase(uid, 'auth_revoked')
  }
  await purgeAccountData(uid)
  await setPhase(uid, 'data_deleted')
  await deleteAuthRecord(uid)
  await setPhase(uid, 'complete', { completedAt: FieldValue.serverTimestamp() })
}

/**
 * Scheduled resume sweep (audit SA-002 acceptance: "recoverable status"). A
 * disabled account can no longer sign in to retry its own deletion, so any job
 * left in_progress past a grace window is finished here with Admin privileges.
 * Idempotent and bounded; runs every 30 minutes.
 */
export const resumeAccountDeletions = onSchedule(
  // Cloud Scheduler has no australia-southeast2 region; scheduled fns must run in southeast1.
  { schedule: 'every 30 minutes', region: 'australia-southeast1', timeoutSeconds: 540, memory: '512MiB' },
  async () => {
    const db = getFirestore()
    // Grace window so an in-flight callable is never fought over by the sweep.
    const cutoff = Timestamp.fromMillis(Date.now() - 15 * 60_000)
    const stuck = await db
      .collection('deletionJobs')
      .where('status', '==', 'in_progress')
      .where('updatedAt', '<=', cutoff)
      .limit(50)
      .get()
    for (const d of stuck.docs) {
      const uid = (d.get('uid') as string) ?? d.id
      const phase = (d.get('phase') as DeletionPhase) ?? 'accepted'
      try {
        await finishDeletion(uid, phase)
      } catch {
        // Leave it in_progress; the next sweep retries. Never throw — one stuck
        // job must not block the rest of the batch.
      }
    }
  },
)
