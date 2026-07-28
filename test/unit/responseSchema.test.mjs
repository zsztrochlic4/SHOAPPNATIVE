// AI coach response-handling tests (Hardening Plan v3 §8, §10 "AI
// response-handling tests"). Runs against the compiled module:
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateCoachResponse,
  SAFE_FALLBACK_MESSAGE,
} from '../../.sweep-out/backend/coach/responseSchema.js'

const isFallback = (r, reason) => {
  assert.equal(r.ok, false)
  assert.equal(r.fallback, SAFE_FALLBACK_MESSAGE)
  if (reason) assert.equal(r.reason, reason)
}

test('valid guidance proposal passes', () => {
  const r = validateCoachResponse(JSON.stringify({ kind: 'guidance', message: 'Focus on form today.' }))
  assert.equal(r.ok, true)
  assert.equal(r.proposal.kind, 'guidance')
  assert.equal(r.proposal.message, 'Focus on form today.')
  assert.equal(r.proposal.adjustments, undefined)
})

test('valid set_adjustment proposal passes and is bounded', () => {
  const r = validateCoachResponse(
    JSON.stringify({
      kind: 'set_adjustment',
      message: 'Small bump.',
      adjustments: [{ exercise_id: 'bench_press', set_number: 1, load_kg: 60, reps: 8, rir: 2 }],
    }),
  )
  assert.equal(r.ok, true)
  assert.equal(r.proposal.adjustments.length, 1)
  assert.equal(r.proposal.adjustments[0].load_kg, 60)
})

test('empty output → safe fallback, no write', () => {
  isFallback(validateCoachResponse(''), 'empty')
  isFallback(validateCoachResponse('   '), 'empty')
  isFallback(validateCoachResponse(null), 'empty')
})

test('non-JSON prose → safe fallback', () => {
  isFallback(validateCoachResponse('Sure! Here is your plan.'), 'not_json')
})

test('prose wrapped around JSON → safe fallback (no best-effort salvage)', () => {
  isFallback(validateCoachResponse('Here you go: {"kind":"guidance","message":"hi"} enjoy!'), 'not_json')
})

test('truncated / cut-off JSON → safe fallback', () => {
  isFallback(validateCoachResponse('{"kind":"guidance","message":"hi'), 'not_json')
})

test('wrong types and nulls → safe fallback', () => {
  isFallback(validateCoachResponse(JSON.stringify({ kind: 'guidance', message: 123 })), 'bad_message')
  isFallback(validateCoachResponse(JSON.stringify({ kind: 'guidance', message: null })), 'bad_message')
  isFallback(validateCoachResponse(JSON.stringify({ kind: 'nope', message: 'x' })), 'bad_kind')
  isFallback(validateCoachResponse(JSON.stringify(['array'])), 'not_object')
})

test('whitespace-only message → safe fallback (empty after sanitisation)', () => {
  isFallback(validateCoachResponse(JSON.stringify({ kind: 'guidance', message: '   \n  ' })), 'bad_message')
})

test('schema-violating adjustment is rejected with no partial apply', () => {
  // bad enum-like id
  isFallback(
    validateCoachResponse(JSON.stringify({
      kind: 'set_adjustment', message: 'x',
      adjustments: [{ exercise_id: 'ok_id', set_number: 1 }, { exercise_id: 'bad id!', set_number: 2 }],
    })),
    'bad_adjustments',
  )
  // out-of-range value
  isFallback(
    validateCoachResponse(JSON.stringify({
      kind: 'set_adjustment', message: 'x',
      adjustments: [{ exercise_id: 'ok_id', set_number: 1, load_kg: 99999 }],
    })),
    'bad_adjustments',
  )
  // oversized array (>50)
  const many = Array.from({ length: 51 }, (_, i) => ({ exercise_id: 'e' + i, set_number: 1 }))
  isFallback(
    validateCoachResponse(JSON.stringify({ kind: 'set_adjustment', message: 'x', adjustments: many })),
    'bad_adjustments',
  )
})

test('NaN / Infinity in numeric fields → safe fallback', () => {
  // JSON cannot carry NaN/Infinity, so validate against a pre-parsed object.
  isFallback(
    validateCoachResponse({ kind: 'set_adjustment', message: 'x', adjustments: [{ exercise_id: 'e', set_number: Infinity }] }),
    'bad_adjustments',
  )
})

test('adjustments on a non-adjustment kind → safe fallback', () => {
  isFallback(
    validateCoachResponse(JSON.stringify({ kind: 'guidance', message: 'x', adjustments: [{ exercise_id: 'e', set_number: 1 }] })),
    'bad_adjustments',
  )
})
