/**
 * Community backend — end-to-end round-trips against the Firebase emulators
 * (auth + functions + firestore). This is the "did it actually work" check to run
 * before flipping COMMUNITY_BACKEND on: real signed-in users call the deployed
 * callables and we assert both the return values AND the resulting Firestore
 * state (which is read back through the security rules, so rules are exercised
 * too).
 *
 * Run:  npm run test:community
 *   (builds functions, boots the emulators, runs this file, tears down)
 *
 * Requires a JDK on PATH (the Firestore/Auth emulators are Java). Uses three
 * persistent client apps so we can act as distinct users (anonymous auth issues
 * a fresh uid per sign-in, so each user keeps its own app/session).
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth'
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions'
import { getFirestore, connectFirestoreEmulator, doc, getDoc } from 'firebase/firestore'

const PROJECT = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT || 'strengthhub-2ab33'
const REGION = 'australia-southeast2' // where the community callables live
const AUTH = 'http://127.0.0.1:9099'
const FN_HOST = '127.0.0.1', FN_PORT = 5001
const FS_HOST = '127.0.0.1', FS_PORT = 8080

/** A self-contained client bound to the emulators, acting as one user. */
function makeClient(name) {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'fake-api-key' }, name)
  const auth = getAuth(app)
  connectAuthEmulator(auth, AUTH, { disableWarnings: true })
  const fns = getFunctions(app, REGION)
  connectFunctionsEmulator(fns, FN_HOST, FN_PORT)
  const db = getFirestore(app)
  connectFirestoreEmulator(db, FS_HOST, FS_PORT)
  return {
    app, auth, db, uid: '',
    call: (n, data = {}) => httpsCallable(fns, n)(data).then((r) => r.data),
  }
}

let A, B, C
before(async () => {
  A = makeClient('community-A')
  B = makeClient('community-B')
  C = makeClient('community-C')
  A.uid = (await signInAnonymously(A.auth)).user.uid
  B.uid = (await signInAnonymously(B.auth)).user.uid
  C.uid = (await signInAnonymously(C.auth)).user.uid
})
after(async () => {
  await Promise.all([A, B, C].map((c) => deleteApp(c.app).catch(() => {})))
})

/** Assert a callable rejects with the given HttpsError code (e.g. 'already-exists'). */
async function rejectsCode(promise, code) {
  await assert.rejects(promise, (err) => {
    assert.match(String(err.code ?? ''), new RegExp(code, 'i'), `expected code ${code}, got ${err.code}: ${err.message}`)
    return true
  })
}

test('claimUsername: writes the profile and enforces case-insensitive uniqueness', async () => {
  const r = await A.call('claimUsername', { username: 'alpha_1' })
  assert.equal(r.ok, true)
  assert.equal(r.username, 'alpha_1')
  const prof = await getDoc(doc(A.db, 'communityProfiles', A.uid))
  assert.equal(prof.get('username'), 'alpha_1')
  // A different user cannot take the same handle (case-insensitive).
  await rejectsCode(B.call('claimUsername', { username: 'ALPHA_1' }), 'already-exists')
  // Invalid format is rejected up front.
  await rejectsCode(B.call('claimUsername', { username: 'no spaces!' }), 'invalid-argument')
})

test('createGroup: generates a passcode, adds the owner, writes the directory', async () => {
  await B.call('claimUsername', { username: 'bravo_2' })
  const g = await B.call('createGroup', { name: 'Test Crew', icon: 'flame', color: '#F5A524' })
  assert.ok(g.groupId && /^[A-Z0-9]{6}$/.test(g.passcode), 'returns a group id + 6-char passcode')
  const member = await getDoc(doc(B.db, `groups/${g.groupId}/members/${B.uid}`))
  assert.equal(member.exists(), true, 'owner is a member')
  assert.equal(member.get('username'), 'bravo_2')
  const dir = await getDoc(doc(B.db, 'groupDirectory', g.groupId))
  assert.equal(dir.get('name'), 'Test Crew')
})

test('joinGroupByPasscode: correct code joins, wrong code is denied', async () => {
  await A.call('claimUsername', { username: 'ann_owner' }).catch(() => {}) // A already has a name; ignore
  const g = await A.call('createGroup', { name: 'Join Test', icon: 'dumbbell', color: '#7ED957' })
  await C.call('claimUsername', { username: 'charlie_3' })
  await rejectsCode(C.call('joinGroupByPasscode', { groupId: g.groupId, passcode: 'ZZZZ99' }), 'permission-denied')
  const joined = await C.call('joinGroupByPasscode', { groupId: g.groupId, passcode: g.passcode })
  assert.equal(joined.ok, true)
  const member = await getDoc(doc(C.db, `groups/${g.groupId}/members/${C.uid}`))
  assert.equal(member.exists(), true, 'joiner becomes a member')
})

test('cheerGroupActivity: toggles the count up then back down', async () => {
  const g = await B.call('createGroup', { name: 'Cheer Test', icon: 'target', color: '#EC4899' })
  const up = await B.call('cheerGroupActivity', { groupId: g.groupId, activityId: 'a-streak' })
  assert.deepEqual({ mine: up.mine, count: up.count }, { mine: true, count: 1 })
  const down = await B.call('cheerGroupActivity', { groupId: g.groupId, activityId: 'a-streak' })
  assert.deepEqual({ mine: down.mine, count: down.count }, { mine: false, count: 0 })
  // A non-member cannot cheer.
  await rejectsCode(C.call('cheerGroupActivity', { groupId: g.groupId, activityId: 'a-streak' }), 'permission-denied')
})

test('syncCommunityStats: recomputes from RAW inputs, ignores client-claimed points (F-003)', async () => {
  const g = await B.call('createGroup', { name: 'Stats Test', icon: 'trending', color: '#3B82F6' })

  // A recent civil day (server anchors to Australia/Sydney; ±1 day tz slack is fine
  // — the day stays inside the 7-day windows either way).
  const today = new Date()
  const iso = (d) => d.toISOString().slice(0, 10)
  const dayKey = iso(today)

  const res = await B.call('syncCommunityStats', {
    // A modified client tries to inject a finished score — it MUST be ignored.
    points: 999,
    targets: { stepTarget: 10000, sleepTargetH: 8, waterTargetL: 2.5, daysPerWeek: 4 },
    days: [
      { dayKey, hasHabit: true, steps: 10000, sleepH: 8, waterL: 2.5, nutritionScore: 8, sessions: 1, volume: 15000, activities: 0 },
    ],
    clientTz: 'Australia/Sydney',
  })
  assert.equal(res.ok, true)
  assert.equal(res.calcVersion, 'v2')
  assert.equal(res.status, 'ok') // one honest day → clean

  // The standing carries a SERVER-recomputed score, never the injected 999.
  const standing = await getDoc(doc(B.db, `leagueStandings/${res.weekKey}/tiers/${res.tier}/members/${B.uid}`))
  const points = standing.get('points')
  assert.notEqual(points, 999)
  assert.ok(typeof points === 'number' && points > 0 && points <= 100)
  assert.equal(standing.get('status'), 'ok')
  assert.equal(standing.get('calcVersion'), 'v2')

  // Group fan-out reflects the recomputed values (volume is a deterministic sum).
  const member = await getDoc(doc(B.db, `groups/${g.groupId}/members/${B.uid}`))
  assert.equal(member.get('odometer'), points)
  assert.equal(member.get('volume7'), 15000)

  // The immutable per-day log was written and is owner-readable.
  const day = await getDoc(doc(B.db, `communityProfiles/${B.uid}/scoreDays/${dayKey}`))
  assert.equal(day.exists(), true)
  assert.equal(day.get('volume'), 15000)
})

test('syncCommunityStats: an impossible session cadence is held back from the ranked ladder', async () => {
  const today = new Date().toISOString().slice(0, 10)
  const res = await B.call('syncCommunityStats', {
    targets: { stepTarget: 10000, sleepTargetH: 8, waterTargetL: 2.5, daysPerWeek: 4 },
    days: [{ dayKey: today, hasHabit: true, steps: 10000, sleepH: 8, waterL: 2.5, nutritionScore: 8, sessions: 15, volume: 99999, activities: 0 }],
  })
  assert.equal(res.status, 'held')
  // Held → points withheld from the ranked standing (0), even though a raw odometer exists.
  const standing = await getDoc(doc(B.db, `leagueStandings/${res.weekKey}/tiers/${res.tier}/members/${B.uid}`))
  assert.equal(standing.get('points'), 0)
  assert.equal(standing.get('status'), 'held')
})

test('appealStanding: a held standing is appealable; it clears once the data is honest', async () => {
  const today = new Date().toISOString().slice(0, 10)
  const targets = { stepTarget: 10000, sleepTargetH: 8, waterTargetL: 2.5, daysPerWeek: 4 }
  // Put B in a held state (impossible cadence), then appeal — data unchanged, so it
  // stays held but is now queued as an appeal.
  const held = await B.call('syncCommunityStats', { targets, days: [{ dayKey: today, hasHabit: true, steps: 10000, sleepH: 8, waterL: 2.5, nutritionScore: 8, sessions: 15, volume: 9999, activities: 0 }] })
  assert.equal(held.status, 'held')
  const appeal1 = await B.call('appealStanding', { note: 'genuinely trained a lot' })
  assert.equal(appeal1.appealed, true)
  assert.equal(appeal1.status, 'held')
  // Correct the data to a believable day → recompute clears it; nothing left to appeal.
  const fixed = await B.call('syncCommunityStats', { targets, days: [{ dayKey: today, hasHabit: true, steps: 10000, sleepH: 8, waterL: 2.5, nutritionScore: 8, sessions: 1, volume: 1500, activities: 0 }] })
  assert.equal(fixed.status, 'ok')
  const appeal2 = await B.call('appealStanding', {})
  assert.equal(appeal2.status, 'ok')
  assert.equal(appeal2.appealed, false)
})

test('resolveStandingReview: rejects a caller without the owner claim', async () => {
  // The moderator endpoint is gated by the `owner` custom claim; an ordinary
  // signed-in user must be refused. (The owner happy-path needs a custom-claim test
  // fixture — see the rules test for the owner-only read gate.)
  await rejectsCode(B.call('resolveStandingReview', { uid: B.uid, decision: 'clear' }), 'permission-denied')
})

test('a held standing is withheld from friend-group rankings too (Finding 3)', async () => {
  const g = await B.call('createGroup', { name: 'Withhold Test', icon: 'trending', color: '#10B981' })
  const today = new Date().toISOString().slice(0, 10)
  const targets = { stepTarget: 10000, sleepTargetH: 8, waterTargetL: 2.5, daysPerWeek: 4 }
  const res = await B.call('syncCommunityStats', { targets, days: [{ dayKey: today, hasHabit: true, steps: 10000, sleepH: 8, waterL: 2.5, nutritionScore: 8, sessions: 15, volume: 99999, activities: 0 }] })
  assert.equal(res.status, 'held')
  // The group member row carries status AND has every ranking metric zeroed, so a
  // held user cannot lead the group even if the client ignores status.
  const member = await getDoc(doc(B.db, `groups/${g.groupId}/members/${B.uid}`))
  assert.equal(member.get('status'), 'held')
  assert.equal(member.get('odometer'), 0)
  assert.equal(member.get('volume7'), 0)
  assert.equal(member.get('streak'), 0)
})

test('deleteGroup: owner-only', async () => {
  const g = await B.call('createGroup', { name: 'Delete Test', icon: 'brain', color: '#8B5CF6' })
  await C.call('joinGroupByPasscode', { groupId: g.groupId, passcode: g.passcode })
  // A member who is not the owner cannot delete.
  await rejectsCode(C.call('deleteGroup', { groupId: g.groupId }), 'permission-denied')
  // The owner can.
  const del = await B.call('deleteGroup', { groupId: g.groupId })
  assert.equal(del.ok, true)
  const dir = await getDoc(doc(B.db, 'groupDirectory', g.groupId))
  assert.equal(dir.exists(), false, 'directory entry removed')
})
