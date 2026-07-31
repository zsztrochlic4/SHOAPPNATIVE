// Pure helpers for the per-user daily rate limit: the UTC day bucket, the
// deterministic doc id, and the TTL expiry used to auto-reap old counters.
//   npm --prefix functions run build && node --test functions/test/rateLimit.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { dayBucket, rateLimitDocId, rateLimitExpiryMs } from '../lib/lib/rateLimit.js'

const T = Date.parse('2026-07-31T09:15:00.000Z')

test('dayBucket is the UTC calendar day', () => {
  assert.equal(dayBucket(T), '2026-07-31')
  assert.equal(dayBucket(Date.parse('2026-07-31T23:59:59.999Z')), '2026-07-31')
  assert.equal(dayBucket(Date.parse('2026-08-01T00:00:00.000Z')), '2026-08-01')
})

test('doc id is stable and namespaced by key + uid + day', () => {
  assert.equal(rateLimitDocId('meal', 'u1', T), 'meal_u1_2026-07-31')
  // Same inputs → same id (idempotent counter), different day → different id.
  assert.equal(rateLimitDocId('meal', 'u1', T), rateLimitDocId('meal', 'u1', T))
  assert.notEqual(rateLimitDocId('meal', 'u1', T), rateLimitDocId('meal', 'u1', Date.parse('2026-08-01T00:00:00Z')))
})

test('expiry is a couple of days out so a live bucket is never reaped mid-use', () => {
  const ms = rateLimitExpiryMs(T)
  assert.equal(ms - T, 2 * 24 * 60 * 60 * 1000)
  assert.equal(rateLimitExpiryMs(T, 5) - T, 5 * 24 * 60 * 60 * 1000)
})
