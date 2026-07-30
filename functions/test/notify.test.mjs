// Unit tests for the Phase D notification sender. Pure helpers plus the
// orchestration driven by an injected fake Firestore + fetch (no network).
//   npm --prefix functions run build && node --test functions/test/notify.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { chunk, localHour, inQuietHours, filterRecipients, classifyTickets } from '../lib/lib/notify.js'
import { sendToAudience } from '../lib/lib/send.js'

/* ------------------------------ pure helpers ------------------------------ */

test('chunk splits into batches of at most size', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]])
  assert.deepEqual(chunk([], 100), [])
})

test('localHour applies the device UTC offset and wraps', () => {
  assert.equal(localHour(720, 0), 12) // 12:00 UTC, no offset
  assert.equal(localHour(720, 600), 22) // +10h → 22:00 local
  assert.equal(localHour(60, -120), 23) // 01:00 UTC − 2h → 23:00 prev day
})

test('inQuietHours handles windows that wrap midnight', () => {
  assert.equal(inQuietHours(23, 22, 7), true)
  assert.equal(inQuietHours(3, 22, 7), true)
  assert.equal(inQuietHours(12, 22, 7), false)
  assert.equal(inQuietHours(5, 9, 17), false)
  assert.equal(inQuietHours(9, 9, 9), false) // empty window
})

test('filterRecipients drops master-off, category opt-out, and dedupes', () => {
  const rows = [
    { token: 'a', uid: 'u1', notificationsEnabled: false },
    { token: 'b', uid: 'u2', prefs: { workoutReminder: false } },
    { token: 'c', uid: 'u3', prefs: {} },
    { token: 'c', uid: 'u3', prefs: {} }, // duplicate token → ignored, not "skipped"
  ]
  const workout = filterRecipients(rows, { nowUtcMinutes: 720, category: 'workout' })
  assert.deepEqual(workout.send.map((r) => r.token), ['c'])
  assert.equal(workout.skipped, 2) // a (master off) + b (workout opt-out)

  // A general announcement ignores the workout opt-out.
  const general = filterRecipients(rows, { nowUtcMinutes: 720, category: 'general' })
  assert.deepEqual(general.send.map((r) => r.token).sort(), ['b', 'c'])
})

test('filterRecipients honours per-device quiet hours in local time', () => {
  const prefs = { quiet: true, quietStartHour: 22, quietEndHour: 7 }
  const rows = [
    { token: 'aest', uid: 'u1', utcOffsetMinutes: 600, prefs }, // 12:00 UTC → 22:00 local → quiet
    { token: 'utc', uid: 'u2', utcOffsetMinutes: 0, prefs }, //    12:00 UTC → 12:00 local → awake
  ]
  const r = filterRecipients(rows, { nowUtcMinutes: 720 })
  assert.deepEqual(r.send.map((x) => x.token), ['utc'])
  assert.equal(r.skipped, 1)

  // override delivers even inside quiet hours.
  const forced = filterRecipients(rows, { nowUtcMinutes: 720, override: true })
  assert.equal(forced.send.length, 2)
})

test('classifyTickets prunes only DeviceNotRegistered tokens', () => {
  const tokens = ['t1', 't2', 't3']
  const tickets = [
    { status: 'ok' },
    { status: 'error', details: { error: 'DeviceNotRegistered' } },
    { status: 'error', details: { error: 'MessageRateExceeded' } },
  ]
  const c = classifyTickets(tokens, tickets)
  assert.equal(c.ok, 1)
  assert.equal(c.errors, 2)
  assert.deepEqual(c.prune, ['t2'])
})

/* --------------------------- sendToAudience (faked) --------------------------- */

// Minimal in-memory Firestore covering exactly what send.ts uses.
function makeDeps({ users = {}, tokensByUid = {}, tickets, priorAudit } = {}) {
  const audit = new Map()
  if (priorAudit) audit.set(priorAudit.id, priorAudit.data)
  const deleted = []
  const fetchCalls = []

  const tokenDoc = (uid, data) => ({
    ref: { id: data.token, parent: { parent: { id: uid } } },
    id: data.token,
    data: () => data,
  })
  const allTokenDocs = Object.entries(tokensByUid).flatMap(([uid, list]) => list.map((d) => tokenDoc(uid, d)))

  const userRef = (uid) => ({
    _uid: uid,
    collection: (name) => {
      assert.equal(name, 'pushTokens')
      return { get: async () => docsSnap((tokensByUid[uid] ?? []).map((d) => tokenDoc(uid, d))) }
    },
  })
  const docsSnap = (docs) => ({ empty: docs.length === 0, size: docs.length, docs })

  const db = {
    collection(name) {
      if (name === 'notificationSends') {
        return {
          doc: (id) => ({
            get: async () => ({ exists: audit.has(id), get: (f) => audit.get(id)?.[f] }),
            set: async (obj) => audit.set(id, obj),
          }),
        }
      }
      if (name === 'users') return { doc: userRef }
      throw new Error('unexpected collection ' + name)
    },
    collectionGroup(name) {
      assert.equal(name, 'pushTokens')
      const q = { limit: () => q, startAfter: () => q, get: async () => docsSnap(allTokenDocs) }
      return q
    },
    async getAll(...refs) {
      return refs.map((r) => ({ get: (field) => (field === 'settings' ? users[r._uid]?.settings : undefined) }))
    },
    batch() {
      const ops = []
      return { delete: (ref) => ops.push(ref.id), commit: async () => deleted.push(...ops) }
    },
  }

  const fetchFn = async (url, init) => {
    fetchCalls.push(JSON.parse(init.body))
    return { ok: true, json: async () => ({ data: tickets ?? JSON.parse(init.body).map(() => ({ status: 'ok' })) }) }
  }

  return { deps: { db, fetchFn, now: new Date(Date.UTC(2026, 0, 1, 12, 0)) }, deleted, fetchCalls, audit }
}

test('dryRun reports counts, sends nothing, writes no audit', async () => {
  const { deps, fetchCalls, audit } = makeDeps({
    users: { u1: { settings: { notificationsEnabled: true } } },
    tokensByUid: { u1: [{ token: 't1' }, { token: 't2' }] },
  })
  const r = await sendToAudience(deps, { audience: { uid: 'u1' }, title: 'Hi', body: 'B', sendId: 'dry1', dryRun: true })
  assert.equal(r.recipients, 2)
  assert.equal(r.sent, 0)
  assert.equal(fetchCalls.length, 0)
  assert.equal(audit.size, 0)
})

test('committed send fans out, prunes dead tokens, writes an audit', async () => {
  const { deps, deleted, fetchCalls, audit } = makeDeps({
    users: { u1: { settings: { notificationsEnabled: true } } },
    tokensByUid: { u1: [{ token: 't1' }, { token: 't2' }] },
    tickets: [{ status: 'ok' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }],
  })
  const r = await sendToAudience(deps, { audience: { uid: 'u1' }, title: 'Hi', body: 'B', sendId: 's1' })
  assert.equal(r.sent, 1)
  assert.equal(r.errors, 1)
  assert.equal(r.pruned, 1)
  assert.deepEqual(deleted, ['t2'])
  assert.equal(fetchCalls.length, 1) // one batch
  assert.equal(audit.get('s1').dryRun, false)
})

test('a repeated committed sendId is idempotent (no re-send)', async () => {
  const priorResult = { sendId: 's1', dryRun: false, recipients: 1, skipped: 0, sent: 1, errors: 0, pruned: 0 }
  const { deps, fetchCalls } = makeDeps({
    users: { u1: { settings: { notificationsEnabled: true } } },
    tokensByUid: { u1: [{ token: 't1' }] },
    priorAudit: { id: 's1', data: { dryRun: false, result: priorResult } },
  })
  const r = await sendToAudience(deps, { audience: { uid: 'u1' }, title: 'Hi', body: 'B', sendId: 's1' })
  assert.deepEqual(r, priorResult)
  assert.equal(fetchCalls.length, 0) // nothing sent again
})

test('broadcast resolves the collection group and skips quiet-hours devices', async () => {
  const quiet = { quiet: true, quietStartHour: 22, quietEndHour: 7 }
  const { deps, fetchCalls } = makeDeps({
    users: {
      u1: { settings: { notificationsEnabled: true, notificationPrefs: quiet } },
      u2: { settings: { notificationsEnabled: true, notificationPrefs: quiet } },
    },
    tokensByUid: {
      u1: [{ token: 'aest', utcOffsetMinutes: 600 }], // 22:00 local → quiet → skipped
      u2: [{ token: 'utc', utcOffsetMinutes: 0 }], //     12:00 local → delivered
    },
  })
  const r = await sendToAudience(deps, { audience: { all: true }, title: 'Hi', body: 'B', sendId: 'b1' })
  assert.equal(r.recipients, 1)
  assert.equal(r.skipped, 1)
  assert.equal(fetchCalls[0][0].to, 'utc')
})
