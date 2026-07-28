// Firestore security-rules tests — run against the emulator via:
//   npm run test:rules   (which wraps this in `firebase emulators:exec`)
//
// Covers the hardened security contract (Hardening Plan v3 §4, §6, §10):
// owner-only isolation, cross-user denial, root get-vs-forbidden-list, the
// keys().hasOnly() root allowlist + typed fields, the profile.premium
// entitlement guard, the server-owned entitlements/{uid} Zone B path, the
// per-collection allowlist with id/ownership invariants and free-text caps,
// rejection of obsolete plaintext tokens, and the config/coach lockdown.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { before, after, beforeEach, test } from 'node:test'
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing'
import {
  doc, getDoc, getDocs, setDoc, deleteDoc, collection, serverTimestamp,
} from 'firebase/firestore'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const ALICE = 'alice'
const BOB = 'bob'
const DK = '2026-07-28'

/** A realistic, valid root doc (premium defaults false). */
const rootDoc = (over = {}) => ({
  profile: { premium: false, name: 'Alex', motivation: 'get strong' },
  settings: { units: 'metric', theme: 'dark' },
  foods: [],
  program: [],
  posts: [],
  badges: [],
  beginnerProgress: [],
  v: 10,
  ...over,
})

/** Realistic per-collection fixtures matching cloudRepo / backend repos. */
const fixtures = (uid) => ({
  sessions: ['s1', { id: 's1', dateKey: DK, name: 'Push', focus: 'Chest' }],
  weights: [DK, { dateKey: DK, kg: 80 }],
  habits: [DK, { dateKey: DK, steps: 8000, sleepH: 7, waterL: 2, workout: true }],
  meals: ['m1', { id: 'm1', dateKey: DK, meal: 'Lunch', name: 'Chicken rice' }],
  activities: ['a1', { id: 'a1', dateKey: DK, type: 'run', name: 'Run', minutes: 30, note: 'easy' }],
  foodReviews: [DK, { dateKey: DK, text: 'ate well', score: 8 }],
  chat: ['c1', { id: 'c1', role: 'user', text: 'hi', dateKey: DK }],
  coachThread: ['ct1', { id: 'ct1', dateKey: DK, kind: 'nudge', title: 'Hi', body: 'keep going' }],
  notifications: ['n1', { id: 'n1', type: 'system', title: 'T', body: 'B', dateKey: DK }],
  programs: ['p1', { program_id: 'p1', uid, version: 1, active: true }],
  workout_instances: ['wi1', { instance_id: 'wi1', program_id: 'p1', uid, status: 'planned' }],
  set_logs: ['sl1', { log_id: 'sl1', instance_id: 'wi1', uid, exercise_id: 'squat', set_number: 1 }],
  progression_state: [`${uid}_squat`, { uid, exercise_id: 'squat', current_load_kg: 60 }],
  pushTokens: ['tok123', { token: 'tok123', platform: 'ios', updatedAt: '2026-07-28T00:00:00Z' }],
})

let testEnv

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'strengthhub-rules-test',
    firestore: { rules: readFileSync(join(repoRoot, 'firestore.rules'), 'utf8') },
  })
})
after(async () => { await testEnv?.cleanup() })
beforeEach(async () => { await testEnv.clearFirestore() })

const aliceDb = () => testEnv.authenticatedContext(ALICE).firestore()
const bobDb = () => testEnv.authenticatedContext(BOB).firestore()
const anonDb = () => testEnv.unauthenticatedContext().firestore()
const seed = (fn) => testEnv.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()))

/* -------------------------------- root -------------------------------- */

test('owner can create, get, and fully overwrite their root doc', async () => {
  const db = aliceDb()
  await assertSucceeds(setDoc(doc(db, 'users', ALICE), rootDoc()))
  await assertSucceeds(getDoc(doc(db, 'users', ALICE)))
  await assertSucceeds(setDoc(doc(db, 'users', ALICE), rootDoc({ profile: { premium: false, name: 'Alex 2' } })))
})

test('owner can write root with a server timestamp updatedAt', async () => {
  await assertSucceeds(setDoc(doc(aliceDb(), 'users', ALICE), rootDoc({ updatedAt: serverTimestamp() })))
})

test('legacy root doc missing optional fields is accepted', async () => {
  await assertSucceeds(setDoc(doc(aliceDb(), 'users', ALICE), { profile: { premium: false }, v: 9 }))
})

test('backendUser merge write (only that field) is accepted', async () => {
  const db = aliceDb()
  await assertSucceeds(setDoc(doc(db, 'users', ALICE), rootDoc()))
  await assertSucceeds(setDoc(doc(db, 'users', ALICE), { backendUser: { uid: ALICE, notes: 'ok' } }, { merge: true }))
})

test('root get is allowed but a collection-wide list of users is denied', async () => {
  await seed((db) => setDoc(doc(db, 'users', ALICE), rootDoc()))
  await assertSucceeds(getDoc(doc(aliceDb(), 'users', ALICE)))
  await assertFails(getDocs(collection(aliceDb(), 'users')))
})

test('unknown top-level field is denied (hasOnly allowlist)', async () => {
  await assertFails(setDoc(doc(aliceDb(), 'users', ALICE), rootDoc({ hacked: true })))
})

test('wrong top-level field type is denied', async () => {
  await assertFails(setDoc(doc(aliceDb(), 'users', ALICE), rootDoc({ v: 'ten' })))
  await assertFails(setDoc(doc(aliceDb(), 'users', ALICE), rootDoc({ foods: 'not-a-list' })))
})

test('oversized root free-text is denied', async () => {
  await assertFails(setDoc(doc(aliceDb(), 'users', ALICE), rootDoc({ profile: { premium: false, motivation: 'x'.repeat(2001) } })))
})

test('plaintext OAuth token at root is denied', async () => {
  await assertFails(setDoc(doc(aliceDb(), 'users', ALICE), rootDoc({ accessToken: 'leaked' })))
  await assertFails(setDoc(doc(aliceDb(), 'users', ALICE), rootDoc({ refreshToken: 'leaked' })))
})

test('direct client deletion of the root doc is denied', async () => {
  await seed((db) => setDoc(doc(db, 'users', ALICE), rootDoc()))
  await assertFails(deleteDoc(doc(aliceDb(), 'users', ALICE)))
})

/* --------------------------- cross-user / auth ------------------------ */

test('stranger cannot read or write another user tree', async () => {
  await seed((db) => setDoc(doc(db, 'users', ALICE), rootDoc()))
  const db = bobDb()
  await assertFails(getDoc(doc(db, 'users', ALICE)))
  await assertFails(setDoc(doc(db, 'users', ALICE), rootDoc()))
  await assertFails(setDoc(doc(db, 'users', ALICE, 'sessions', 's1'), { id: 's1' }))
})

test('unauthenticated is denied on the user tree', async () => {
  const db = anonDb()
  await assertFails(getDoc(doc(db, 'users', ALICE)))
  await assertFails(setDoc(doc(db, 'users', ALICE), rootDoc()))
})

/* ------------------------------ entitlement --------------------------- */

test('cannot create root doc with premium true; false allowed', async () => {
  await assertFails(setDoc(doc(aliceDb(), 'users', ALICE), rootDoc({ profile: { premium: true } })))
  await assertSucceeds(setDoc(doc(aliceDb(), 'users', ALICE), rootDoc()))
})

test('cannot flip premium via update; premium-preserving update allowed', async () => {
  await seed((db) => setDoc(doc(db, 'users', ALICE), rootDoc()))
  await assertFails(setDoc(doc(aliceDb(), 'users', ALICE), rootDoc({ profile: { premium: true } })))
  await assertSucceeds(setDoc(doc(aliceDb(), 'users', ALICE), rootDoc({ profile: { premium: false, name: 'changed' } })))
})

test('entitlements/{uid}: owner may read; all client writes denied', async () => {
  await seed((db) => setDoc(doc(db, 'entitlements', ALICE), { premium: true }))
  await assertSucceeds(getDoc(doc(aliceDb(), 'entitlements', ALICE)))
  await assertFails(getDoc(doc(bobDb(), 'entitlements', ALICE)))
  await assertFails(setDoc(doc(aliceDb(), 'entitlements', ALICE), { premium: true }))
  await assertFails(setDoc(doc(aliceDb(), 'entitlements', ALICE), { premium: false })) // no self-created default
})

/* ---------------------------- subcollections -------------------------- */

test('owner can get/list/create/update/delete every allowlisted subcollection', async () => {
  const db = aliceDb()
  const f = fixtures(ALICE)
  for (const [col, [id, data]] of Object.entries(f)) {
    await assertSucceeds(setDoc(doc(db, 'users', ALICE, col, id), data))
    await assertSucceeds(getDoc(doc(db, 'users', ALICE, col, id)))
    await assertSucceeds(getDocs(collection(db, 'users', ALICE, col)))
    await assertSucceeds(deleteDoc(doc(db, 'users', ALICE, col, id)))
  }
})

test('workout_instances status-only merge update is accepted', async () => {
  const db = aliceDb()
  await assertSucceeds(setDoc(doc(db, 'users', ALICE, 'workout_instances', 'wi1'),
    { instance_id: 'wi1', program_id: 'p1', uid: ALICE, status: 'planned' }))
  await assertSucceeds(setDoc(doc(db, 'users', ALICE, 'workout_instances', 'wi1'),
    { status: 'done' }, { merge: true }))
})

test('unknown subcollection is denied', async () => {
  await assertFails(setDoc(doc(aliceDb(), 'users', ALICE, 'wallet', 'w1'), { balance: 999 }))
})

test('id-keyed entry with mismatched embedded id is denied', async () => {
  await assertFails(setDoc(doc(aliceDb(), 'users', ALICE, 'sessions', 's1'), { id: 'DIFFERENT', name: 'x' }))
})

test('dateKey-keyed entry with mismatched / malformed dateKey is denied', async () => {
  await assertFails(setDoc(doc(aliceDb(), 'users', ALICE, 'weights', DK), { dateKey: '2000-01-01', kg: 1 }))
  await assertFails(setDoc(doc(aliceDb(), 'users', ALICE, 'weights', 'not-a-date'), { dateKey: 'not-a-date', kg: 1 }))
})

test('backend record with wrong embedded uid is denied', async () => {
  await assertFails(setDoc(doc(aliceDb(), 'users', ALICE, 'programs', 'p1'), { program_id: 'p1', uid: BOB }))
  await assertFails(setDoc(doc(aliceDb(), 'users', ALICE, 'set_logs', 'sl1'), { log_id: 'sl1', uid: BOB }))
})

test('progression_state doc id must encode uid and exercise_id', async () => {
  const db = aliceDb()
  await assertSucceeds(setDoc(doc(db, 'users', ALICE, 'progression_state', `${ALICE}_squat`), { uid: ALICE, exercise_id: 'squat' }))
  await assertFails(setDoc(doc(db, 'users', ALICE, 'progression_state', 'wrong_id'), { uid: ALICE, exercise_id: 'squat' }))
})

test('pushTokens: doc id must equal token and platform must be a known enum', async () => {
  const db = aliceDb()
  await assertSucceeds(setDoc(doc(db, 'users', ALICE, 'pushTokens', 'tok123'), { token: 'tok123', platform: 'android' }))
  await assertFails(setDoc(doc(db, 'users', ALICE, 'pushTokens', 'tok123'), { token: 'OTHER', platform: 'ios' }))
  await assertFails(setDoc(doc(db, 'users', ALICE, 'pushTokens', 'tok9'), { token: 'tok9', platform: 'nintendo' }))
})

test('oversized subcollection free-text is denied', async () => {
  const db = aliceDb()
  await assertFails(setDoc(doc(db, 'users', ALICE, 'chat', 'c1'), { id: 'c1', text: 'a'.repeat(8001) }))
  await assertFails(setDoc(doc(db, 'users', ALICE, 'notifications', 'n1'), { id: 'n1', title: 'T', body: 'b'.repeat(1001) }))
  await assertSucceeds(setDoc(doc(db, 'users', ALICE, 'chat', 'c1'), { id: 'c1', text: 'hi' }))
})

/* -------------------------------- config ------------------------------ */

test('config/coach: signed-in read allowed; client write + other config denied', async () => {
  await seed((db) => setDoc(doc(db, 'config', 'coach'), { killSwitch: false }))
  await seed((db) => setDoc(doc(db, 'config', 'secret'), { apiKey: 'x' }))
  await assertSucceeds(getDoc(doc(aliceDb(), 'config', 'coach')))
  await assertFails(getDoc(doc(anonDb(), 'config', 'coach')))
  await assertFails(setDoc(doc(aliceDb(), 'config', 'coach'), { killSwitch: true }))
  await assertFails(getDoc(doc(aliceDb(), 'config', 'secret'))) // exact-path lockdown
})

/* -------------------------------- recipes ----------------------------- */

test('recipes: signed-in get + list allowed; client write + anon read denied', async () => {
  await seed((db) => setDoc(doc(db, 'recipes', 'bm-scrambled-eggs'), { id: 'bm-scrambled-eggs', name: 'Eggs', category: 'Breakfast' }))
  await assertSucceeds(getDoc(doc(aliceDb(), 'recipes', 'bm-scrambled-eggs')))
  await assertSucceeds(getDocs(collection(aliceDb(), 'recipes')))
  await assertFails(getDoc(doc(anonDb(), 'recipes', 'bm-scrambled-eggs')))
  await assertFails(setDoc(doc(aliceDb(), 'recipes', 'bm-hack'), { id: 'bm-hack', name: 'x', category: 'Lunch' }))
})
