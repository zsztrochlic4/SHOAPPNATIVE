// Firestore security-rules tests — run against the emulator via:
//   npm run test:rules   (which wraps this in `firebase emulators:exec`)
//
// Covers the security contract in the hardening plan: owner-only access,
// cross-user denial, the profile.premium entitlement guard, the collection
// allowlist, free-text size caps, and the config/coach lockdown.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { before, after, beforeEach, test } from 'node:test'
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const ALICE = 'alice'
const BOB = 'bob'

/** A minimal-but-valid root doc; premium defaults false. */
const rootDoc = (over = {}) => ({
  profile: { premium: false, motivation: 'get strong' },
  settings: {},
  v: 10,
  ...over,
})

let testEnv

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'strengthhub-rules-test',
    firestore: { rules: readFileSync(join(repoRoot, 'firestore.rules'), 'utf8') },
  })
})

after(async () => {
  await testEnv?.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

const aliceDb = () => testEnv.authenticatedContext(ALICE).firestore()
const bobDb = () => testEnv.authenticatedContext(BOB).firestore()
const anonDb = () => testEnv.unauthenticatedContext().firestore()

// 1. Owner can read/write their own tree, including every allowlisted collection.
test('owner can create + read their root doc', async () => {
  const db = aliceDb()
  await assertSucceeds(setDoc(doc(db, 'users', ALICE), rootDoc()))
  await assertSucceeds(getDoc(doc(db, 'users', ALICE)))
})

test('owner can write every allowlisted subcollection', async () => {
  const db = aliceDb()
  const cols = [
    'sessions', 'weights', 'habits', 'meals', 'activities', 'foodReviews',
    'chat', 'coachThread', 'notifications', 'programs', 'workout_instances',
    'set_logs', 'progression_state', 'pushTokens',
  ]
  for (const c of cols) {
    await assertSucceeds(setDoc(doc(db, 'users', ALICE, c, 'x1'), { hello: 'world' }))
  }
})

// 2. A different signed-in uid is denied on another user's tree.
test('stranger cannot read or write another user tree', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', ALICE), rootDoc())
  })
  const db = bobDb()
  await assertFails(getDoc(doc(db, 'users', ALICE)))
  await assertFails(setDoc(doc(db, 'users', ALICE), rootDoc()))
  await assertFails(setDoc(doc(db, 'users', ALICE, 'sessions', 's1'), { x: 1 }))
})

// 3. Unauthenticated is denied.
test('unauthenticated is denied on user tree', async () => {
  const db = anonDb()
  await assertFails(getDoc(doc(db, 'users', ALICE)))
  await assertFails(setDoc(doc(db, 'users', ALICE), rootDoc()))
})

// 4. Create with premium true denied; premium false allowed.
test('cannot create root doc with premium true', async () => {
  const db = aliceDb()
  await assertFails(setDoc(doc(db, 'users', ALICE), rootDoc({ profile: { premium: true } })))
  await assertSucceeds(setDoc(doc(db, 'users', ALICE), rootDoc()))
})

// 5. Update flipping premium false->true denied; premium-preserving update allowed.
test('cannot flip premium via update; normal update allowed', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', ALICE), rootDoc())
  })
  const db = aliceDb()
  // Attempt to self-grant premium.
  await assertFails(setDoc(doc(db, 'users', ALICE), rootDoc({ profile: { premium: true } })))
  // A normal update that preserves premium=false must still work.
  await assertSucceeds(
    setDoc(doc(db, 'users', ALICE), rootDoc({ profile: { premium: false, motivation: 'changed' } })),
  )
})

// 6. Unknown subcollection is denied.
test('unknown subcollection is denied', async () => {
  const db = aliceDb()
  await assertFails(setDoc(doc(db, 'users', ALICE, 'wallet', 'w1'), { balance: 999 }))
})

// 7. Oversized free-text is denied.
test('oversized chat text is denied', async () => {
  const db = aliceDb()
  const huge = 'a'.repeat(8001)
  await assertFails(setDoc(doc(db, 'users', ALICE, 'chat', 'c1'), { text: huge }))
  await assertSucceeds(setDoc(doc(db, 'users', ALICE, 'chat', 'c2'), { text: 'hi' }))
})

// 8. config/coach: signed-in read allowed, client write denied.
test('config/coach is read-only for clients', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'config', 'coach'), { killSwitch: false })
  })
  await assertSucceeds(getDoc(doc(aliceDb(), 'config', 'coach')))
  await assertFails(getDoc(doc(anonDb(), 'config', 'coach')))
  await assertFails(setDoc(doc(aliceDb(), 'config', 'coach'), { killSwitch: true }))
})
