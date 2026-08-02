import test from 'node:test'
import assert from 'node:assert/strict'
import { coachEligibility } from '../../.sweep-out/backend/coach/safety/index.js'

const context = (dateOfBirth) => ({
  dateOfBirth,
  affectedRegions: [],
  screeningOutcome: null,
  engineExcludedExerciseIds: [],
  isAustralia: true,
})

test('verified adults can use the coach', () => {
  assert.equal(coachEligibility(context('2000-01-01')).eligible, true)
})

test('missing or malformed age fails closed', () => {
  for (const dob of [null, '', 'not-a-date']) {
    const result = coachEligibility(context(dob))
    assert.equal(result.eligible, false)
    assert.match(result.response.text, /date of birth|18 or older/i)
  }
})

test('under-18 users cannot use the coach', () => {
  assert.equal(coachEligibility(context('2012-01-01')).eligible, false)
})
