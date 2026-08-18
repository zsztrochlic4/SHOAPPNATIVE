/**
 * Community moderation + visibility + ops-metrics — end-to-end against the Firebase
 * emulators (auth + functions + firestore). Covers the layer added on top of the
 * league/streak/group backend:
 *   - blocklist enforced in claimUsername / createGroup (server-authoritative)
 *   - group visibility: private (default) hidden from search, public listed
 *   - join-by-code: a private group is joinable by its short code alone
 *   - report queue: reportContent files a moderator-only doc; owner triages
 *   - ops metrics: owner-only refreshCommunityMetrics returns a snapshot
 *
 * Run against a CLEAN emulator (the harness clears data first). Uses the client SDK
 * for callables + rule-checked reads, and firebase-admin to grant the `owner` claim
 * and to verify server-written state.
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth'
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions'
import { getFirestore, connectFirestoreEmulator, collection, getDocs, query, where } from 'firebase/firestore'
import { initializeApp as adminInit } from 'firebase-admin/app'
import { getFirestore as adminFs } from 'firebase-admin/firestore'
import { getAuth as adminAuth } from 'firebase-admin/auth'

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099'

const PROJECT = process.env.GCLOUD_PROJECT || 'strengthhub-2ab33'
const REGION = 'australia-southeast2'

function makeClient(name) {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'fake-api-key' }, name)
  const auth = getAuth(app)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  const fns = getFunctions(app, REGION)
  connectFunctionsEmulator(fns, '127.0.0.1', 5001)
  const db = getFirestore(app)
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  return {
    app, auth, db, uid: '',
    call: (n, data = {}) => httpsCallable(fns, n)(data).then((r) => r.data),
    async signIn() { this.uid = (await signInAnonymously(this.auth)).user.uid; return this.uid },
    async makeOwner() {
      await adminAuth().setCustomUserClaims(this.uid, { owner: true })
      await this.auth.currentUser.getIdToken(true) // refresh so the claim is on the token
    },
  }
}

async function rejectsCode(p, code) {
  await assert.rejects(p, (e) => { assert.equal(e.code, `functions/${code}`); return true })
}

let A, B, O
before(async () => {
  adminInit({ projectId: PROJECT })
  A = makeClient('mod-A'); B = makeClient('mod-B'); O = makeClient('mod-O')
  await Promise.all([A.signIn(), B.signIn(), O.signIn()])
  await A.call('claimUsername', { username: 'reporter_a' })
  await B.call('claimUsername', { username: 'joiner_b' })
  await O.call('claimUsername', { username: 'owner_o' })
  await O.makeOwner()
})
after(async () => { await Promise.all([deleteApp(A.app), deleteApp(B.app), deleteApp(O.app)]) })

test('blocklist: reserved + profane usernames and group names are rejected server-side', async () => {
  await rejectsCode(A.call('claimUsername', { username: 'admin' }), 'invalid-argument')
  await rejectsCode(A.call('claimUsername', { username: 'fuckhead' }), 'invalid-argument')
  await rejectsCode(A.call('createGroup', { name: 'Fuck Squad' }), 'invalid-argument')
  await rejectsCode(A.call('createGroup', { name: 'StrengthHub Official' }), 'invalid-argument')
})

test('visibility: private (default) is hidden from search; public is listed', async () => {
  await A.call('createGroup', { name: 'Quiet Crew' }) // default private
  await A.call('createGroup', { name: 'Open Gym', visibility: 'public' })

  // A client search MUST filter to public (rules require it) — returns only public.
  const pub = await getDocs(query(collection(A.db, 'groupDirectory'), where('visibility', '==', 'public')))
  const names = pub.docs.map((d) => d.get('name'))
  assert.ok(names.includes('Open Gym'), 'public group should be searchable')
  assert.ok(!names.includes('Quiet Crew'), 'private group must not appear in search')

  // An UNFILTERED list is denied by the rules (would expose private rows).
  await assert.rejects(getDocs(collection(A.db, 'groupDirectory')), (e) => e.code === 'permission-denied')
})

test('join-by-code: a private group is joinable by its code alone', async () => {
  const { groupId, passcode, visibility } = await A.call('createGroup', { name: 'Secret Squad' })
  assert.equal(visibility, 'private')
  const res = await B.call('joinGroupByCode', { code: passcode })
  assert.equal(res.groupId, groupId)
  const member = await adminFs().doc(`groups/${groupId}/members/${B.uid}`).get()
  assert.equal(member.exists, true, 'B should be a member after join-by-code')
  await rejectsCode(B.call('joinGroupByCode', { code: 'ZZZZZZ' }), 'not-found')
})

test('report queue: user files a report; only the owner can read/triage it', async () => {
  await B.call('reportContent', { targetType: 'user', targetId: A.uid, targetLabel: '@reporter_a', reason: 'offensive_name' })
  const reportId = `${B.uid}__user__${A.uid}`
  const doc = await adminFs().doc(`contentReports/${reportId}`).get()
  assert.equal(doc.exists, true)
  assert.equal(doc.get('status'), 'pending')

  // A non-owner cannot read the report queue (rules), the owner can.
  await assert.rejects(getDocs(collection(B.db, 'contentReports')), (e) => e.code === 'permission-denied')
  const ownerView = await getDocs(collection(O.db, 'contentReports'))
  assert.ok(ownerView.docs.some((d) => d.id === reportId), 'owner should see the report')

  // Self-report is refused.
  await rejectsCode(B.call('reportContent', { targetType: 'user', targetId: B.uid, reason: 'other' }), 'invalid-argument')

  // Owner resolves it; non-owner cannot.
  await rejectsCode(B.call('resolveContentReport', { reportId, disposition: 'dismiss' }), 'permission-denied')
  const r = await O.call('resolveContentReport', { reportId, disposition: 'actioned', note: 'renamed' })
  assert.equal(r.ok, true)
  const after = await adminFs().doc(`contentReports/${reportId}`).get()
  assert.equal(after.get('status'), 'resolved')
  assert.equal(after.get('disposition'), 'actioned')
})

test('ops metrics: owner-only refresh returns a numeric snapshot', async () => {
  await rejectsCode(A.call('refreshCommunityMetrics', {}), 'permission-denied')
  const res = await O.call('refreshCommunityMetrics', {})
  assert.equal(res.ok, true)
  assert.equal(typeof res.metrics.profilesTotal, 'number')
  assert.ok(res.metrics.profilesTotal >= 3, 'at least the 3 test users are counted')
  assert.equal(typeof res.metrics.groupsPublic, 'number')
  assert.equal(typeof res.metrics.reportsPending, 'number')
})
