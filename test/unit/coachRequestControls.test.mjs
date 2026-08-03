// P1-AI regression (audit SA-011): coach idempotency + burst/global cost caps.
// The coach stays gated OFF; these prove the activation-readiness controls.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isValidRequestKey,
  coachClaimDocId,
  withinLimit,
  burstBucketId,
  COACH_BURST_MAX,
  COACH_GLOBAL_DAILY_MAX,
} from '../../.sweep-out/backend/coach/requestControls.js'

test('request keys are validated (bounded, safe charset) before use as a doc id', () => {
  assert.equal(isValidRequestKey('req-abc12345'), true)
  assert.equal(isValidRequestKey('short'), false) // < 8 chars
  assert.equal(isValidRequestKey('has space here'), false)
  assert.equal(isValidRequestKey('bad/slash/id!!'), false)
  assert.equal(isValidRequestKey(''), false)
  assert.equal(isValidRequestKey(undefined), false)
  assert.equal(isValidRequestKey('x'.repeat(101)), false) // too long
})

test('claim doc id binds the key to the uid (no cross-user collision)', () => {
  assert.equal(coachClaimDocId('uidA', 'req-123abc45'), 'uidA_req-123abc45')
  assert.notEqual(coachClaimDocId('uidA', 'req-123abc45'), coachClaimDocId('uidB', 'req-123abc45'))
})

test('withinLimit enforces caps (burst + global share one rule)', () => {
  assert.equal(withinLimit(0, COACH_BURST_MAX), true)
  assert.equal(withinLimit(COACH_BURST_MAX - 1, COACH_BURST_MAX), true)
  assert.equal(withinLimit(COACH_BURST_MAX, COACH_BURST_MAX), false) // cap reached
  assert.equal(withinLimit(COACH_GLOBAL_DAILY_MAX, COACH_GLOBAL_DAILY_MAX), false)
})

test('burst bucket id rolls with the time window (spike containment)', () => {
  const win = 60
  const t0 = 16_666_666 * win * 1000 // aligned to a window boundary
  const a = burstBucketId('uidA', t0, win)
  const sameWindow = burstBucketId('uidA', t0 + 30_000, win) // +30s, same 60s window
  const nextWindow = burstBucketId('uidA', t0 + 61_000, win) // +61s, next window
  assert.equal(a, sameWindow)
  assert.notEqual(a, nextWindow)
  assert.ok(a.includes('uidA'))
})
