import test from 'node:test'
import assert from 'node:assert/strict'
import { migrateAppState } from '../../.sweep-out/store/migrate.js'
import { buildSeed, SCHEMA_VERSION } from '../../.sweep-out/store/seed.js'

function legacyState() {
  const state = buildSeed()
  state.v = 10
  state.profile = { ...state.profile, name: 'Preserved User' }
  state.meals = [{ id: 'meal-keep', dateKey: '2026-08-01', meal: 'Lunch', name: 'Kept meal', qty: 1, kcal: 500, p: 30, c: 50, f: 15 }]
  state.settings = { ...state.settings, notificationsEnabled: true }
  delete state.settings.notificationConsent
  return state
}

test('migrates a legacy state without discarding user data', () => {
  const result = migrateAppState(legacyState())
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.fromVersion, 10)
  assert.equal(result.state.v, SCHEMA_VERSION)
  assert.equal(result.state.profile.name, 'Preserved User')
  assert.equal(result.state.meals[0]?.id, 'meal-keep')
})

test('legacy seeded notification true is not treated as consent', () => {
  const result = migrateAppState(legacyState())
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.state.settings.notificationsEnabled, false)
  assert.equal(result.state.settings.notificationConsent, 'unknown')
})

test('explicit current consent is preserved', () => {
  const state = buildSeed()
  state.settings = { ...state.settings, notificationsEnabled: true, notificationConsent: 'granted' }
  const result = migrateAppState(state)
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.state.settings.notificationsEnabled, true)
  assert.equal(result.state.settings.notificationConsent, 'granted')
})

test('future state is rejected so an older build cannot overwrite it', () => {
  const state = { ...buildSeed(), v: SCHEMA_VERSION + 1 }
  assert.deepEqual(migrateAppState(state), {
    ok: false,
    reason: 'future-version',
    version: SCHEMA_VERSION + 1,
  })
})

test('malformed collection containers fall back safely', () => {
  const state = legacyState()
  state.meals = 'not-an-array'
  const result = migrateAppState(state)
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.ok(Array.isArray(result.state.meals))
})
