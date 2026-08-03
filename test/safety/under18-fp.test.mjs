// FP-reduction regression (audit SA-010 quality follow-up): the server-DOB
// suppression of a benign `under_18` CLASSIFIER hit is correctly scoped — it fires
// only for a verified-adult account, never suppresses a real minor disclosure, and
// only touches the under_18 category.
//   npm run test:safety
import test from 'node:test'
import assert from 'node:assert/strict'
import { scopeClassifierHits } from '../../.sweep-out/backend/coach/safety/rules.js'

const adult = { dateOfBirth: '1990-06-15' }
const minor = { dateOfBirth: '2012-06-15' }
const noDob = { dateOfBirth: null }
const under18Hit = [{ category: 'under_18', source: 'classifier', reason: 'llm_under_18' }]
const benign = 'whats a good upper lower split for me'

test('benign under_18 classifier hit is suppressed when server DOB proves an adult', () => {
  const r = scopeClassifierHits(benign, under18Hit, adult)
  assert.equal(r.hits.length, 0)
  assert.ok(r.suppressions.some((s) => s.category === 'under_18' && s.rule === 'server_dob_adult'))
})

test('under_18 classifier hit is KEPT when the DOB says the user is a minor', () => {
  const r = scopeClassifierHits(benign, under18Hit, minor)
  assert.equal(r.hits.length, 1)
})

test('under_18 classifier hit is KEPT when the DOB is unknown (fail-open, never less safe)', () => {
  const r = scopeClassifierHits(benign, under18Hit, noDob)
  assert.equal(r.hits.length, 1)
})

test('DOB-adult suppression is under_18-ONLY — a crisis_concern classifier hit is untouched', () => {
  const crisis = [{ category: 'crisis_concern', source: 'classifier', reason: 'llm_crisis_concern' }]
  const r = scopeClassifierHits('i feel like there is no point anymore', crisis, adult)
  assert.equal(r.hits.length, 1)
})
