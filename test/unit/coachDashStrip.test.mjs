// Owner rule: no em dash / en dash / dash-as-punctuation in any coach output. stripDashPunctuation is
// applied to every coach reply (functions/src/coach.ts) so it holds even when the model ignores the
// prompt rule and regardless of how the fixed safety responses were authored.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import { stripDashPunctuation } from '../../.sweep-out/lib/sanitize.js'
import { RESPONSES, RESPONSES_NON_AU } from '../../.sweep-out/backend/coach/safety/responses.js'

const hasBannedDash = (s) => /[—–]/.test(s) || /\s-{1,2}\s/.test(s)

test('clause em dash becomes a comma', () => {
  assert.equal(stripDashPunctuation('call 000 right now — that matters'), 'call 000 right now, that matters')
})
test('en dash range becomes "to"', () => {
  assert.equal(stripDashPunctuation('8am–midnight'), '8am to midnight')
  assert.equal(stripDashPunctuation('6–12 reps'), '6 to 12 reps')
})
test('spaced ascii hyphen used as a dash becomes a comma', () => {
  assert.equal(stripDashPunctuation('do this - then that'), 'do this, then that')
})
test('ordinary hyphenated words are preserved', () => {
  assert.equal(stripDashPunctuation('warm-up and one-rep-max, a 4-day full-body split'), 'warm-up and one-rep-max, a 4-day full-body split')
})
test('no comma before end punctuation, no double commas', () => {
  assert.equal(stripDashPunctuation('rest — .'), 'rest.')
})
test('idempotent', () => {
  const once = stripDashPunctuation('a — b — c')
  assert.equal(stripDashPunctuation(once), once)
})

test('every fixed safety response is dash-free after the strip', () => {
  for (const [k, r] of Object.entries({ ...RESPONSES, ...RESPONSES_NON_AU })) {
    assert.equal(hasBannedDash(stripDashPunctuation(r.text)), false, `${k} still has a dash`)
  }
})
