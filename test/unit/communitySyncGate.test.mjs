// The community sync gate: demo accounts (frozen clock) must never post to the
// competitive backend, or their collapsed-onto-one-day sessions trip the server's
// `impossible_session_cadence` anti-cheat rule and get held off the ladder.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldPostCommunityStats, clampDayCadence } from '../../.sweep-out/community/syncGate.js'
import { ANOMALY_CONFIG } from '../../.sweep-out/community/anomaly.js'
import { evaluateAnomalies } from '../../.sweep-out/community/anomaly.js'

test('real user, username claimed, backend on → posts', () => {
  assert.equal(shouldPostCommunityStats({ backendOn: true, hasUsername: true, demo: false }), true)
})

test('demo account never posts (frozen clock would trip impossible_session_cadence)', () => {
  assert.equal(shouldPostCommunityStats({ backendOn: true, hasUsername: true, demo: true }), false)
})

test('no username → does not post', () => {
  assert.equal(shouldPostCommunityStats({ backendOn: true, hasUsername: false, demo: false }), false)
})

test('backend flag off → does not post', () => {
  assert.equal(shouldPostCommunityStats({ backendOn: false, hasUsername: true, demo: false }), false)
})

test('demo dominates even with username + backend on', () => {
  // The whole point: an onboarded, username-claimed demo must still be excluded.
  assert.equal(shouldPostCommunityStats({ backendOn: true, hasUsername: true, demo: true }), false)
})

/* ----------------------- clampDayCadence ----------------------- */

const day = (over) => ({
  dayKey: '2026-08-14', hasHabit: false, steps: 0, sleepH: 0, waterL: 0, nutritionScore: 0,
  sessions: 0, volume: 0, activities: 0, rest: false, freeze: false, ...over,
})

test('clampDayCadence caps sessions at the anti-cheat ceiling', () => {
  const [r] = clampDayCadence([day({ sessions: 20 })])
  assert.equal(r.sessions, ANOMALY_CONFIG.maxSessionsPerDay)
})

test('clampDayCadence caps activities at the anti-cheat ceiling', () => {
  const [r] = clampDayCadence([day({ activities: 40 })])
  assert.equal(r.activities, ANOMALY_CONFIG.maxActivitiesPerDay)
})

test('clampDayCadence leaves plausible days untouched (same reference)', () => {
  const input = [day({ sessions: 2, activities: 1 })]
  const out = clampDayCadence(input)
  assert.equal(out[0], input[0]) // no needless copy for the common case
})

test('clamped payload no longer trips impossible_session_cadence', () => {
  // Before: a stacked day (10 completed sessions) is flagged and HELD.
  const stacked = clampDayCadence([day({ sessions: 10, volume: 5000 })])
  const { flags } = evaluateAnomalies({
    maxSessionsPerDay: Math.max(...stacked.map((r) => r.sessions)),
    maxActivitiesPerDay: Math.max(...stacked.map((r) => r.activities)),
    volume7: 5000, medianPriorWeeklyVolume: 4800, odometer: 50,
    historyDayCount: 10, backfilledDayCount: 0, targetBelowFloor: false, deviceTokenCount: 1,
  })
  assert.equal(flags.includes('impossible_session_cadence'), false)
})
