import {
  doc, collection, getDoc, getDocs, query, orderBy, limit, writeBatch, setDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { sanitizeForPersist, sanitizeEntry } from '../lib/sanitize'
import { mergeById } from './historyMerge'
import type { AppState } from './types'

/**
 * Cloud persistence layer (Firestore) for a signed-in user.
 *
 * ── Why this shape ──────────────────────────────────────────────────────────
 * The naive approach — store the whole AppState in one document at users/{uid}
 * and rewrite it on every change — does not scale per user:
 *
 *   1. Firestore caps a document at 1 MB. A committed user's history (workout
 *      sessions with per-set logs, chat, food/weight/habit logs…) grows without
 *      bound and eventually crosses that ceiling, at which point every write
 *      fails and data silently stops saving.
 *   2. Rewriting the entire document on every tiny change (logging a glass of
 *      water re-sends the user's whole history) means write cost and latency
 *      grow with account age — the "lag" that shows up for your most engaged
 *      users, i.e. exactly the ones you least want to lose.
 *
 * So we split the state:
 *
 *   users/{uid}                       ← one small "singleton" doc: profile,
 *                                        settings, program, badges, and other
 *                                        bounded fields.
 *   users/{uid}/{collection}/{id}     ← one document PER ENTRY for each
 *                                        unbounded, append-heavy log.
 *
 * A save then writes only the entries that actually changed (a diff against the
 * previously-saved state), batched atomically. Per-write cost is O(changed
 * entries) instead of O(entire history), and no single document can approach
 * the 1 MB limit. This is the standard Firestore modelling for user-scoped
 * time-series data and is what lets the platform hold many active users, each
 * with a long history, without degrading.
 */

const COL = 'users'

/**
 * The unbounded collections, and how to derive a stable document id for each
 * entry. `dateKey`-keyed logs are naturally one-per-day; the rest carry an `id`.
 * A stable id is what makes incremental upsert + delete reconciliation possible.
 */
const SUBCOLLECTIONS = {
  sessions: (e: any) => e.id as string,
  weights: (e: any) => e.dateKey as string,
  habits: (e: any) => e.dateKey as string,
  activities: (e: any) => e.id as string,
  foodReviews: (e: any) => e.dateKey as string,
  chat: (e: any) => e.id as string,
  coachThread: (e: any) => e.id as string,
  notifications: (e: any) => e.id as string,
  workoutSummaries: (e: any) => e.id as string,
} as const

type SubKey = keyof typeof SUBCOLLECTIONS
const SUB_KEYS = Object.keys(SUBCOLLECTIONS) as SubKey[]

/**
 * Cold-start read policy per subcollection (Phase C — bounded reads).
 *
 * The naive "load every doc on sign-in" degrades for the most engaged users: a
 * year in, a cold open reads thousands of documents (slow + costly). So the
 * genuinely unbounded, many-per-day collections load only their most recent
 * `RECENT_DOCS` on sign-in; the older remainder loads lazily on demand
 * (loadRemainingHistory), only when an all-time screen needs it.
 *
 *   'full'  — load every doc now (tiny, ~1 doc/day; feeds always-on stats like
 *             the streak's 400-day look-back and the weight chart).
 *   'window'— load only the most recent RECENT_DOCS (orderBy dateKey desc);
 *             the rest is fetched later by loadRemainingHistory.
 *
 * Ordering only ever uses the single `dateKey` field, so Firestore's automatic
 * single-field index covers it — no composite index is required.
 */
const RECENT_DOCS = 300
const LOAD_POLICY: Record<SubKey, 'full' | 'window'> = {
  weights: 'full',
  habits: 'full',
  foodReviews: 'full',
  // The compact per-session projection (Phase C Option B): tiny, and it backs the
  // all-time Progress charts, so load it fully — that's what lets full sessions
  // stay windowed without the charts losing history.
  workoutSummaries: 'full',
  sessions: 'window',
  activities: 'window',
  chat: 'window',
  coachThread: 'window',
  notifications: 'window',
}
const WINDOWED_KEYS = SUB_KEYS.filter((k) => LOAD_POLICY[k] === 'window')

/** Slices kept on-device only (e.g. anything too large for a Firestore doc).
 *  Currently none — every slice syncs. */
const LOCAL_ONLY: (keyof AppState)[] = []

/** Firestore allows 500 writes per batch; stay safely under it. */
const BATCH_LIMIT = 400

export interface LoadedState {
  /** Full assembled state used to hydrate the local store. */
  state: Partial<AppState>
  /**
   * What is currently persisted in the subcollections (empty arrays for a
   * legacy single-document account). Used as the diff baseline for the first
   * save so a legacy account migrates its embedded arrays into subcollections
   * exactly once, then rewrites the root doc without them.
   *
   * NOTE (Phase C): for a WINDOWED collection this holds only the recent window
   * that was loaded, NOT the full server contents. That is safe for the
   * diff-save: it can only *delete* a doc that is in the baseline but not in
   * current state, and un-loaded older docs are in neither — so they are never
   * touched. See loadRemainingHistory + CloudSync.ensureFullHistory.
   */
  baseline: Partial<AppState>
  /**
   * True for each WINDOWED collection whose server contents may exceed the
   * recent window that was loaded (i.e. older docs remain to be fetched lazily).
   * Empty/all-false means everything is already loaded.
   */
  partial: Partial<Record<SubKey, boolean>>
}

/** Drop `undefined` values (Firestore rejects them) via a plain-data round-trip. */
function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/**
 * Delete a signed-in user's cloud data, for in-app account deletion.
 *
 * Removes every document in every per-user subcollection (firestore.rules allows
 * an owner to delete these), then best-effort scrubs the root singleton doc. The
 * root doc itself cannot be *deleted* from the client by design (firestore.rules:
 * `allow delete: if false` — reserved for the server account-deletion workflow),
 * so we overwrite it to strip personal data; once the user's Auth account is
 * removed the doc is owner-less and unreadable, and the backend workflow removes
 * it fully later.
 *
 * Call this BEFORE deleting the Auth user, while the owner is still authenticated
 * (the delete rules require `isOwner()`).
 */
/** Every per-user subcollection defined in firestore.rules — the complete set that
 *  a full account wipe removes and a full data export reads. Kept in one place so
 *  deletion and export can never drift out of sync. */
const ALL_SUBCOLLECTIONS = [
  'sessions', 'weights', 'habits', 'meals', 'activities', 'foodReviews',
  'chat', 'coachThread', 'notifications', 'workoutSummaries', 'programs',
  'workout_instances', 'set_logs', 'progression_state', 'pushTokens',
] as const

export async function deleteUserData(uid: string): Promise<void> {
  if (!db || !uid || uid === 'local') return
  for (const sub of ALL_SUBCOLLECTIONS) {
    const snap = await getDocs(collection(db, COL, uid, sub))
    for (const group of chunk(snap.docs, BATCH_LIMIT)) {
      const batch = writeBatch(db)
      for (const d of group) batch.delete(d.ref)
      await batch.commit()
    }
  }
  // Strip personal data from the root doc (a client delete is blocked by rules).
  try {
    await setDoc(doc(db, COL, uid), { demo: false }, { merge: false })
  } catch {
    /* Rules may reject the scrub (e.g. a set premium flag); the root becomes
       unreadable once the Auth account is gone, and the backend cleanup finishes it. */
  }
}

/**
 * Gather a signed-in user's COMPLETE cloud data for "Download my data": the root
 * profile document plus every per-user subcollection read in full (no windowing —
 * an export must be complete, and it is a rare, explicit, user-initiated action).
 * Returns the raw shape for src/lib/dataExport.ts to normalise + serialise. Safe
 * no-op shape when Firebase is unconfigured / no uid (caller falls back to local).
 */
export async function collectUserExport(
  uid: string,
): Promise<{ profile: Record<string, unknown>; collections: Record<string, unknown[]> }> {
  const empty = { profile: {}, collections: {} }
  if (!db || !uid || uid === 'local') return empty
  const rootSnap = await getDoc(doc(db, COL, uid))
  const profile = rootSnap.exists() ? { ...(rootSnap.data() as Record<string, unknown>) } : {}
  const collections: Record<string, unknown[]> = {}
  await Promise.all(
    ALL_SUBCOLLECTIONS.map(async (sub) => {
      const snap = await getDocs(collection(db!, COL, uid, sub))
      if (snap.size) collections[sub] = snap.docs.map((d) => d.data())
    }),
  )
  return { profile, collections }
}

/**
 * Read a user's full state: the root singleton doc plus every subcollection,
 * fetched in parallel. Returns null when the account has no saved data yet
 * (brand-new sign-up → caller starts them at onboarding).
 */
export async function loadUserState(uid: string): Promise<LoadedState | null> {
  if (!db) return null

  const rootRef = doc(db, COL, uid)
  // FULL collections load in one unbounded read; WINDOWED collections load only
  // the most recent RECENT_DOCS (newest first) so a cold start stays bounded.
  const [rootSnap, ...subSnaps] = await Promise.all([
    getDoc(rootRef),
    ...SUB_KEYS.map((k) =>
      LOAD_POLICY[k] === 'window'
        ? getDocs(query(collection(db!, COL, uid, k), orderBy('dateKey', 'desc'), limit(RECENT_DOCS)))
        : getDocs(collection(db!, COL, uid, k)),
    ),
  ])

  if (!rootSnap.exists()) return null

  const root = { ...(rootSnap.data() as Record<string, unknown>) }
  delete root.updatedAt

  const state: Record<string, unknown> = { ...root }
  const baseline: Record<string, unknown> = {}
  const partial: Partial<Record<SubKey, boolean>> = {}

  SUB_KEYS.forEach((k, i) => {
    const snap = subSnaps[i]
    // Windowed reads come back newest-first; normalise to a stable chronological
    // order (dateKey asc) so array order never depends on the load path.
    const fromSub =
      LOAD_POLICY[k] === 'window'
        ? mergeById(snap.docs.map((d) => d.data() as { id?: string; dateKey?: string }), [])
        : snap.docs.map((d) => d.data())
    baseline[k] = fromSub
    // Legacy accounts still hold these arrays inside the root doc; fall back to
    // them so no data is lost, and let the next save migrate them out.
    const legacy = Array.isArray(root[k]) ? (root[k] as unknown[]) : []
    state[k] = fromSub.length ? fromSub : legacy
    // A windowed collection that filled the window may have older docs waiting.
    if (LOAD_POLICY[k] === 'window' && snap.size >= RECENT_DOCS) partial[k] = true
  })

  return {
    state: state as Partial<AppState>,
    baseline: baseline as Partial<AppState>,
    partial,
  }
}

/**
 * Fetch the FULL contents of every WINDOWED collection — used on demand when an
 * all-time screen (e.g. Progress) needs the complete history that the bounded
 * cold-start load deliberately skipped. Returns one array per windowed key.
 *
 * The caller (CloudSync.ensureFullHistory) merges these into the store and the
 * save baseline together via `mergeById`, so the recent window and the older
 * remainder are unioned with no loss and no spurious deletes.
 */
export async function loadRemainingHistory(
  uid: string,
): Promise<Partial<Record<SubKey, unknown[]>>> {
  if (!db) return {}
  const snaps = await Promise.all(
    WINDOWED_KEYS.map((k) => getDocs(collection(db!, COL, uid, k))),
  )
  const out: Partial<Record<SubKey, unknown[]>> = {}
  WINDOWED_KEYS.forEach((k, i) => {
    out[k] = snaps[i].docs.map((d) => d.data())
  })
  return out
}

/**
 * Persist the user's state. Only entries that changed since `prev` are written
 * (added/updated) or deleted; the small root doc is rewritten each time. Writes
 * are grouped into atomic batches.
 *
 * @param prev the previously-saved state (or its subcollection baseline). When
 *   omitted, every entry is treated as new — the correct behaviour for a first
 *   save or a legacy→subcollection migration.
 */
export async function saveUserState(
  uid: string,
  state: AppState,
  prev?: Partial<AppState>,
): Promise<void> {
  if (!db) return

  const rootRef = doc(db, COL, uid)

  // Root doc = everything that is neither an unbounded subcollection nor a
  // device-local field. This is bounded in size, so a full rewrite is cheap.
  const root: Record<string, unknown> = {}
  for (const key of Object.keys(state) as (keyof AppState)[]) {
    if ((SUB_KEYS as string[]).includes(key as string)) continue
    if (LOCAL_ONLY.includes(key)) continue
    root[key] = state[key]
  }

  // Diff each subcollection against the previous state.
  type Op = { kind: 'set'; key: SubKey; id: string; data: unknown } | { kind: 'del'; key: SubKey; id: string }
  const ops: Op[] = []

  for (const k of SUB_KEYS) {
    const idOf = SUBCOLLECTIONS[k]
    const cur = (state[k] as unknown[] | undefined) ?? []
    const before = (prev?.[k] as unknown[] | undefined) ?? []

    const curById = new Map<string, unknown>()
    for (const e of cur) {
      const id = idOf(e)
      if (id) curById.set(id, e)
    }
    const beforeById = new Map<string, string>()
    for (const e of before) {
      const id = idOf(e)
      if (id) beforeById.set(id, JSON.stringify(e))
    }

    for (const [id, entry] of curById) {
      if (beforeById.get(id) !== JSON.stringify(entry)) ops.push({ kind: 'set', key: k, id, data: entry })
    }
    for (const id of beforeById.keys()) {
      if (!curById.has(id)) ops.push({ kind: 'del', key: k, id })
    }
  }

  // Commit. The root write goes in the first batch alongside the first slice of
  // entry writes; remaining entries follow in their own batches.
  const batches = chunk(ops, BATCH_LIMIT)
  if (batches.length === 0) batches.push([])

  // Canonical sanitisation boundary (Hardening Plan v3 §7.1): every free-text
  // field is normalised, and obsolete plaintext tokens stripped, IMMEDIATELY
  // before persistence. Done after the diff so it never disturbs which entries
  // are written. The server-side backend, when it exists, must run the same
  // routine — the client layer improves UX; the server is the security boundary.
  const safeRoot = sanitizeForPersist(root)

  for (let i = 0; i < batches.length; i++) {
    const batch = writeBatch(db)
    if (i === 0) batch.set(rootRef, { ...clean(safeRoot), updatedAt: serverTimestamp() })
    for (const op of batches[i]) {
      const ref = doc(db, COL, uid, op.key, op.id)
      if (op.kind === 'set') batch.set(ref, clean(sanitizeEntry(op.key, op.data as Record<string, unknown>)))
      else batch.delete(ref)
    }
    await batch.commit()
  }
}
