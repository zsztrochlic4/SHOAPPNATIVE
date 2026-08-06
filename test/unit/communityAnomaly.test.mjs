// Community anomaly rules (F-003). The recompute stops a client posting a fake
// points value; these rules quarantine implausible RAW inputs. Verifies each rule
// fires and maps to the right standing status (ok | provisional | held).
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateAnomalies } from '../../.sweep-out/community/anomaly.js'

/** A clean, unremarkable recompute. */
const clean = () => ({
  maxSessionsPerDay: 2,
  maxActivitiesPerDay: 1,
  volume7: 4000,
  medianPriorWeeklyVolume: 3800,
  odometer: 55,
  historyDayCount: 40,
  backfilledDayCount: 0,
  targetBelowFloor: false,
  deviceTokenCount: 1,
})

test('clean signals → ok', () => {
  assert.deepEqual(evaluateAnomalies(clean()), { status: 'ok', flags: [] })
})

test('impossible session cadence → held (hard flag)', () => {
  const r = evaluateAnomalies({ ...clean(), maxSessionsPerDay: 12 })
  assert.equal(r.status, 'held')
  assert.ok(r.flags.includes('impossible_session_cadence'))
})

test('a below-floor target → held (gaming the ratio)', () => {
  const r = evaluateAnomalies({ ...clean(), targetBelowFloor: true })
  assert.equal(r.status, 'held')
  assert.ok(r.flags.includes('target_below_floor'))
})

test('a large volume jump vs trailing median → provisional (soft)', () => {
  const r = evaluateAnomalies({ ...clean(), volume7: 40000, medianPriorWeeklyVolume: 4000 })
  assert.equal(r.status, 'provisional')
  assert.deepEqual(r.flags, ['volume_jump'])
})

test('a perfect week with no history to support it → provisional', () => {
  const r = evaluateAnomalies({ ...clean(), odometer: 98, historyDayCount: 2 })
  assert.equal(r.status, 'provisional')
  assert.ok(r.flags.includes('perfect_week_no_history'))
})

test('heavy backfilling → provisional', () => {
  const r = evaluateAnomalies({ ...clean(), backfilledDayCount: 9 })
  assert.equal(r.status, 'provisional')
  assert.ok(r.flags.includes('backfill'))
})

test('too little history means the volume-jump rule stays silent', () => {
  const r = evaluateAnomalies({ ...clean(), volume7: 999999, medianPriorWeeklyVolume: null })
  assert.equal(r.status, 'ok')
})

test('a hard flag alongside soft flags still resolves to held', () => {
  const r = evaluateAnomalies({ ...clean(), maxSessionsPerDay: 20, backfilledDayCount: 9 })
  assert.equal(r.status, 'held')
  assert.ok(r.flags.includes('impossible_session_cadence'))
  assert.ok(r.flags.includes('backfill'))
})
