// Remote coach kill switch (config/coach.killSwitch). Verifies the cache reflects the source, the
// fail-safe keeps the last known value on a read error, and the cache serves within its TTL.
//   npm --prefix functions run build && node --test functions/test/killSwitch.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeRemoteKillSwitch } from '../lib/killSwitchRemote.js'

test('default before any read is OFF (fail-safe: coach stays available)', () => {
  const ks = makeRemoteKillSwitch(async () => true)
  assert.equal(ks.engaged(), false)
})

test('engaged() reflects the source after a refresh', async () => {
  let value = false
  const ks = makeRemoteKillSwitch(async () => value)
  await ks.refresh()
  assert.equal(ks.engaged(), false)
  value = true
  await ks.refresh()
  assert.equal(ks.engaged(), true)
  value = false
  await ks.refresh()
  assert.equal(ks.engaged(), false)
})

test('fail-safe: a read error keeps the last known value (never engages on its own)', async () => {
  let mode = 'ok-true'
  const ks = makeRemoteKillSwitch(async () => {
    if (mode === 'throw') throw new Error('firestore blip')
    return mode === 'ok-true'
  })
  await ks.refresh()
  assert.equal(ks.engaged(), true) // engaged from the source
  mode = 'throw'
  await ks.refresh()
  assert.equal(ks.engaged(), true) // read error must NOT change it — last value held
})

test('R4-001: a STALE value whose refresh fails is fail-CLOSED for actions (no stale-false fail-open)', async () => {
  let clock = 1_000_000
  let mode = 'ok-false' // first read succeeds with false (actions enabled)
  const ks = makeRemoteKillSwitch(async () => {
    if (mode === 'throw') throw new Error('firestore outage')
    return mode === 'ok-true'
  }, 30_000, () => clock)
  await ks.refresh()
  assert.equal(await ks.engagedFresh(true), false) // fresh + false → actions allowed
  // Time passes beyond the TTL and the refresh now fails (outage).
  clock += 60_000
  mode = 'throw'
  assert.equal(await ks.engagedFresh(true), true, 'stale value + failed refresh must fail closed for actions')
  // Advisory (failClosed=false) still fails SAFE — never engages on its own.
  assert.equal(await ks.engagedFresh(false), false)
})

test('R4-001: once a fresh read succeeds again, actions follow the real value', async () => {
  let clock = 1_000_000
  let mode = 'ok-false'
  const ks = makeRemoteKillSwitch(async () => (mode === 'throw' ? (() => { throw new Error('x') })() : mode === 'ok-true'), 30_000, () => clock)
  await ks.refresh()
  clock += 60_000; mode = 'throw'
  assert.equal(await ks.engagedFresh(true), true) // stale outage → closed
  clock += 1_000; mode = 'ok-false'
  assert.equal(await ks.engagedFresh(true), false) // fresh success → real value
})

test('the cached value is served within the TTL; an explicit refresh picks up a change', async () => {
  let value = true
  let calls = 0
  const ks = makeRemoteKillSwitch(async () => { calls++; return value }, 10_000)
  await ks.refresh()
  assert.equal(calls, 1)
  assert.equal(ks.engaged(), true)
  value = false
  assert.equal(ks.engaged(), true) // within TTL -> cached, no new fetch
  assert.equal(calls, 1)
  await ks.refresh()
  assert.equal(ks.engaged(), false) // explicit refresh sees the change
  assert.equal(calls, 2)
})
