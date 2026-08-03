// P1 regression (audit SA-004): the completion queue must never present a false
// "safe" state or lose a completion. These cover the pure guarantees the queue
// is built on — idempotent upsert, and the durability rule the UI relies on.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  upsertPending,
  completionDurability,
} from '../../.sweep-out/backend/repo/completionQueueCore.js'

test('upsert keeps at most ONE pending entry per instance (idempotent retry)', () => {
  let q = []
  q = upsertPending(q, { key: 'inst-1', attempts: 0 })
  q = upsertPending(q, { key: 'inst-1', attempts: 1 }) // a retry of the same instance
  assert.equal(q.length, 1)
  assert.equal(q[0].attempts, 1) // last completion wins
})

test('upsert preserves distinct instances', () => {
  let q = []
  q = upsertPending(q, { key: 'inst-1', attempts: 0 })
  q = upsertPending(q, { key: 'inst-2', attempts: 0 })
  assert.deepEqual(q.map((e) => e.key).sort(), ['inst-1', 'inst-2'])
})

test('durable when persisted to the local queue, even if the sync failed', () => {
  const d = completionDurability({ persisted: true, syncedNow: false })
  assert.equal(d.durable, true)
  assert.equal(d.synced, false)
})

test('durable when synced to the server, even if the local persist failed', () => {
  const d = completionDurability({ persisted: false, syncedNow: true })
  assert.equal(d.durable, true)
  assert.equal(d.synced, true)
})

test('NOT durable — the only unsafe case — when BOTH persist and sync fail', () => {
  const d = completionDurability({ persisted: false, syncedNow: false })
  assert.equal(d.durable, false) // UI must warn, never claim a false safe state
  assert.equal(d.synced, false)
})
