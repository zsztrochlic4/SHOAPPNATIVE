// P1 regression (audit SA-005): the active-workout runtime key is UID-scoped, so
// account B can never resume account A's interrupted workout on a shared device.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import { runtimeStorageKey } from '../../.sweep-out/screens/activeWorkoutRuntime.js'
import { ANON_IDENTITY } from '../../.sweep-out/store/identity.js'

test('runtime key is distinct per identity', () => {
  const a = runtimeStorageKey('uidA')
  const b = runtimeStorageKey('uidB')
  const anon = runtimeStorageKey(ANON_IDENTITY)
  assert.notEqual(a, b)
  assert.notEqual(a, anon)
  assert.ok(a.includes('uidA'))
})

test('runtime key is never the bare legacy global key (cross-account resume)', () => {
  const legacy = 'sho.activeWorkout.runtime.v1'
  assert.notEqual(runtimeStorageKey('uidA'), legacy)
  assert.notEqual(runtimeStorageKey(ANON_IDENTITY), legacy)
})
