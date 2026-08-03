// P0 regression (audit SA-001): "Reset demo data" must never be able to
// overwrite or delete a signed-in user's cloud state. The three layered guards
// (dispatch / cloud-sync / UI) are pure predicates so the invariant is provable
// here rather than only reasoned about across React components.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canDispatchDemoReset,
  canSyncSnapshot,
  canOfferDemoReset,
} from '../../.sweep-out/store/resetGuards.js'
import { ANON_IDENTITY } from '../../.sweep-out/store/identity.js'
import { buildSeed, emptyState } from '../../.sweep-out/store/seed.js'

test('demo reset can be dispatched ONLY for the anonymous demo identity', () => {
  assert.equal(canDispatchDemoReset(ANON_IDENTITY), true)
  assert.equal(canDispatchDemoReset('uidA'), false)
  assert.equal(canDispatchDemoReset('uidB'), false)
})

test('a demo/seed snapshot can NEVER be synced to an account cloud copy', () => {
  // The seed is fabricated history — this is the state a RESET_DEMO produces.
  const seed = buildSeed()
  assert.equal(seed.demo, true)
  assert.equal(canSyncSnapshot(seed), false)
})

test('real (non-demo) state is always syncable', () => {
  const empty = emptyState()
  assert.equal(empty.demo, false)
  assert.equal(canSyncSnapshot(empty), true)
  assert.equal(canSyncSnapshot({ demo: false }), true)
  assert.equal(canSyncSnapshot({}), true) // absent flag ⇒ real state
})

test('the reset-demo control is offered only in the anonymous demo, never signed in', () => {
  // Demo mode (no backend, or backend but signed out) — offered.
  assert.equal(canOfferDemoReset({ authEnabled: false, signedIn: false }), true)
  assert.equal(canOfferDemoReset({ authEnabled: true, signedIn: false }), true)
  // Signed into a real account — hidden.
  assert.equal(canOfferDemoReset({ authEnabled: true, signedIn: true }), false)
})

test('end-to-end invariant: a signed-in account cannot replace cloud state with seed', () => {
  // 1) UI never surfaces the control while signed in …
  assert.equal(canOfferDemoReset({ authEnabled: true, signedIn: true }), false)
  // 2) … the dispatch is dropped even if it were triggered …
  assert.equal(canDispatchDemoReset('uidReal'), false)
  // 3) … and even a demo snapshot in memory can never be pushed to the cloud.
  assert.equal(canSyncSnapshot(buildSeed()), false)
})
