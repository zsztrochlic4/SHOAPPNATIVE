import {
  doc, collection, getDoc, getDocs, writeBatch, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
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
  meals: (e: any) => e.id as string,
  activities: (e: any) => e.id as string,
  foodReviews: (e: any) => e.dateKey as string,
  chat: (e: any) => e.id as string,
  coachThread: (e: any) => e.id as string,
  notifications: (e: any) => e.id as string,
} as const

type SubKey = keyof typeof SUBCOLLECTIONS
const SUB_KEYS = Object.keys(SUBCOLLECTIONS) as SubKey[]

/** Kept on-device only — too large for Firestore docs (base64 image data). */
const LOCAL_ONLY: (keyof AppState)[] = ['photos']

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
   */
  baseline: Partial<AppState>
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
 * Read a user's full state: the root singleton doc plus every subcollection,
 * fetched in parallel. Returns null when the account has no saved data yet
 * (brand-new sign-up → caller starts them at onboarding).
 */
export async function loadUserState(uid: string): Promise<LoadedState | null> {
  if (!db) return null

  const rootRef = doc(db, COL, uid)
  const [rootSnap, ...subSnaps] = await Promise.all([
    getDoc(rootRef),
    ...SUB_KEYS.map((k) => getDocs(collection(db!, COL, uid, k))),
  ])

  if (!rootSnap.exists()) return null

  const root = { ...(rootSnap.data() as Record<string, unknown>) }
  delete root.updatedAt

  const state: Record<string, unknown> = { ...root }
  const baseline: Record<string, unknown> = {}

  SUB_KEYS.forEach((k, i) => {
    const fromSub = subSnaps[i].docs.map((d) => d.data())
    baseline[k] = fromSub
    // Legacy accounts still hold these arrays inside the root doc; fall back to
    // them so no data is lost, and let the next save migrate them out.
    const legacy = Array.isArray(root[k]) ? (root[k] as unknown[]) : []
    state[k] = fromSub.length ? fromSub : legacy
  })

  return { state: state as Partial<AppState>, baseline: baseline as Partial<AppState> }
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

  for (let i = 0; i < batches.length; i++) {
    const batch = writeBatch(db)
    if (i === 0) batch.set(rootRef, { ...clean(root), updatedAt: serverTimestamp() })
    for (const op of batches[i]) {
      const ref = doc(db, COL, uid, op.key, op.id)
      if (op.kind === 'set') batch.set(ref, clean(op.data))
      else batch.delete(ref)
    }
    await batch.commit()
  }
}
