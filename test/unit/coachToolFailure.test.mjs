// TF01–TF05 tool-failure fault injection (Coach response-eval Step 4). Forces each of the five
// action-integrity failure modes at the REAL shipping seams (engine resolver, version gate, durable
// outbox, structured no-fabrication guard) and asserts the recovery invariant holds. This locks in
// CI the behaviour that was otherwise only pending on-device capture.
//   npm run test:unit
//
// TF04's transient-timeout → typed-overload throw has a functions-side co-owner
// (functions/test/providerResilience.test.mjs); here we assert the src-side no-fabrication contract.
import test from 'node:test'
import assert from 'node:assert/strict'
import { runTF01, runTF02, runTF03, runTF04, runTF05 } from '../../scripts/lib/coachToolFailureHarness.mjs'

function assertCase(rec) {
  for (const inv of rec.invariants) assert.ok(inv.pass, `${rec.id}: ${inv.name}`)
  assert.ok(rec.pass, `${rec.id} overall`)
}

test('TF01 — forced proposal-write failure: honest failure, no false success', () => {
  const rec = runTF01()
  assert.equal(rec.behaviour.claimedApplied, false)
  assert.equal(rec.behaviour.versionAfter, rec.behaviour.versionBefore)
  assert.equal(rec.behaviour.outbox[0].outcome, 'failed')
  assertCase(rec)
})

test('TF02 — server ack then client-write failure: durable-first, never Applied', () => {
  const rec = runTF02()
  assert.equal(rec.behaviour.claimedApplied, false)
  // Terminal outcome is on the outbox before the mirror, so it can't strand at pending.
  assert.equal(rec.behaviour.outbox.length, 1)
  assert.equal(rec.behaviour.outbox[0].outcome, 'applied')
  assertCase(rec)
})

test('TF03 — partial write / stale version: no half-written program, version-authoritative', () => {
  const rec = runTF03()
  assert.equal(rec.behaviour.versionAfter, rec.behaviour.versionBefore, 'version must not advance on a partial write')
  assert.equal(rec.behaviour.claimedApplied, false)
  assertCase(rec)
})

test('TF04 — model timeout: honest fallback, no fabricated answer', () => {
  const rec = runTF04()
  assert.equal(rec.behaviour.claimedApplied, false)
  assert.match(rec.behaviour.messageToUser, /try (asking )?again/i)
  assertCase(rec)
})

test('TF05 — duplicate confirm: no double-apply, outbox deduped', () => {
  const rec = runTF05()
  assert.equal(rec.behaviour.versionAfter, rec.behaviour.versionBefore + 1, 'exactly one apply')
  assert.equal(rec.behaviour.outbox.length, 1)
  assertCase(rec)
})
