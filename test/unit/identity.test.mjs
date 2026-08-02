// Local-data identity scoping (audit F-001): per-account storage keys, the
// single legitimate anon→account state hand-off, and the publish/subscribe
// bridge AuthProvider uses to swap the store's slot.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ANON_IDENTITY,
  LEGACY_STORAGE_KEY,
  getActiveIdentity,
  setActiveIdentity,
  subscribeIdentity,
  storageKeyFor,
  shouldCarryLocalState,
} from '../../.sweep-out/store/identity.js'

test('storage keys are distinct per identity and never the legacy global key', () => {
  const anonKey = storageKeyFor(ANON_IDENTITY)
  const aKey = storageKeyFor('uidA')
  const bKey = storageKeyFor('uidB')
  assert.notEqual(anonKey, LEGACY_STORAGE_KEY)
  assert.notEqual(aKey, LEGACY_STORAGE_KEY)
  assert.notEqual(aKey, bKey)
  assert.notEqual(aKey, anonKey)
  // uid appears in the key so a slot is attributable to exactly one account
  assert.ok(aKey.includes('uidA'))
})

test('state carries ONLY on the anon→account hand-off for a real onboarded user', () => {
  const onboarded = { profile: { onboarded: true }, demo: false }
  // The one legitimate case: onboarding just finished, account just created.
  assert.equal(shouldCarryLocalState(ANON_IDENTITY, 'uidA', onboarded), true)
})

test('state never carries between two signed-in accounts (cross-account exposure)', () => {
  const onboarded = { profile: { onboarded: true }, demo: false }
  assert.equal(shouldCarryLocalState('uidA', 'uidB', onboarded), false)
})

test('state never carries on sign-out (account → anon)', () => {
  const onboarded = { profile: { onboarded: true }, demo: false }
  assert.equal(shouldCarryLocalState('uidA', ANON_IDENTITY, onboarded), false)
})

test('demo or un-onboarded local state never carries into an account', () => {
  assert.equal(shouldCarryLocalState(ANON_IDENTITY, 'uidA', { profile: { onboarded: true }, demo: true }), false)
  assert.equal(shouldCarryLocalState(ANON_IDENTITY, 'uidA', { profile: { onboarded: false }, demo: false }), false)
  assert.equal(shouldCarryLocalState(ANON_IDENTITY, 'uidA', {}), false)
})

test('identity publish/subscribe notifies on change and not on repeats', () => {
  const seen = []
  const unsub = subscribeIdentity((id) => seen.push(id))
  const initial = getActiveIdentity()
  setActiveIdentity('uidX')
  setActiveIdentity('uidX') // repeat — no notification
  setActiveIdentity(ANON_IDENTITY)
  unsub()
  setActiveIdentity('uidY') // after unsubscribe — no notification
  assert.deepEqual(seen, ['uidX', ANON_IDENTITY])
  // restore for any later test in this process
  setActiveIdentity(initial)
})
