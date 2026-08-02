/**
 * Coach telemetry + human-feel rubric (final plan Phase 6, node --test).
 *
 *   npm run test:unit
 *
 * Telemetry is dormant-by-default and content-free; the rubric scores replies and enforces the ordinary
 * length target. These guard the privacy posture (no data collected until activated) and the pass logic.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  COACH_TELEMETRY_ACTIVE, latencyBucket, recordCoachTelemetry, recordCoachTurn,
  coachTelemetrySummary, createInMemoryCoachSink, __activateCoachSinkForTest, __resetCoachSink,
} from '../../.sweep-out/backend/coach/coachTelemetry.js'
import {
  HUMAN_FEEL_RUBRIC, RUBRIC_PASS_THRESHOLD, scoreReply, withinOrdinaryLength,
} from '../../.sweep-out/backend/coach/eval/humanFeelRubric.js'
import { CONVERSATIONAL_HOLDOUT, HOLDOUT_SET_MINIMUMS } from '../../.sweep-out/backend/coach/eval/conversationalHoldout.js'

test('telemetry is dormant by default (no data collected)', () => {
  assert.equal(COACH_TELEMETRY_ACTIVE, false)
  __resetCoachSink()
  recordCoachTurn('coaching', 2500)
  assert.deepEqual(coachTelemetrySummary(), {}, 'dormant sink must record nothing')
})

test('latency is bucketed, never raw', () => {
  assert.equal(latencyBucket(500), 'lt1s')
  assert.equal(latencyBucket(2000), '1to3s')
  assert.equal(latencyBucket(4500), '3to6s')
  assert.equal(latencyBucket(8000), '6to10s')
  assert.equal(latencyBucket(20000), 'gt10s')
})

test('active sink aggregates content-free counts', () => {
  __activateCoachSinkForTest(createInMemoryCoachSink())
  recordCoachTurn('coaching', 2500)
  recordCoachTelemetry('chip_completion', 'nutrition')
  recordCoachTelemetry('negative_feedback', 'not_helpful')
  const s = coachTelemetrySummary()
  assert.equal(s['route:coaching'], 1)
  assert.equal(s['latency:1to3s'], 1)
  assert.equal(s['chip_completion:nutrition'], 1)
  assert.equal(s['negative_feedback:not_helpful'], 1)
  __resetCoachSink()
})

test('rubric has the seven dimensions and pass threshold', () => {
  assert.equal(HUMAN_FEEL_RUBRIC.length, 7)
  assert.equal(RUBRIC_PASS_THRESHOLD, 6)
  assert.equal(scoreReply({ listened: true, relevant: true, natural: true, personal: true, concise: true, continuous: true, trustworthy: true }).pass, true)
  assert.equal(scoreReply({ listened: true, relevant: true, natural: true, personal: true, concise: true }).pass, false)
})

test('ordinary length target (30–70 words)', () => {
  assert.equal(withinOrdinaryLength(Array.from({ length: 45 }, () => 'word').join(' ')), true)
  assert.equal(withinOrdinaryLength('too short'), false)
  assert.equal(withinOrdinaryLength(Array.from({ length: 120 }, () => 'word').join(' ')), false)
})

test('holdout meets the plan set minimums (≥80 total)', () => {
  assert.ok(CONVERSATIONAL_HOLDOUT.length >= 80, `only ${CONVERSATIONAL_HOLDOUT.length} cases`)
  const counts = {}
  for (const c of CONVERSATIONAL_HOLDOUT) counts[c.set] = (counts[c.set] ?? 0) + 1
  for (const [set, min] of Object.entries(HOLDOUT_SET_MINIMUMS)) {
    assert.ok((counts[set] ?? 0) >= min, `set ${set} has ${counts[set] ?? 0} < ${min}`)
  }
})
