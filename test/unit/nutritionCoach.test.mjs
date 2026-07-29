// Pure nutrition-coach tests (Production Readiness plan §5 "pure domain tests:
// nutrition calc"). Structural invariants only — deliberately not coupled to the
// exact FOOD_KB keyword list, so they stay green as the food data grows.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  reviewDay,
  answerQuestion,
  coachRespond,
  STARTER_QUESTIONS,
} from '../../.sweep-out/lib/nutritionCoach.js'

const GOALS = ['build-muscle', 'gain-strength', 'lose-fat', 'stay-healthy']

test('reviewDay: empty / whitespace input is flagged empty with score 0', () => {
  for (const g of GOALS) {
    const r = reviewDay('', g)
    assert.equal(r.empty, true)
    assert.equal(r.score, 0)
    assert.deepEqual(r.found, [])
    const r2 = reviewDay('   \n\t ', g)
    assert.equal(r2.empty, true)
  }
})

test('reviewDay: non-empty score is always an integer clamped to 1..10', () => {
  const inputs = [
    'chicken, rice and broccoli',
    'a whole pizza and two beers',
    'nothing much really',
    'eggs oats banana greek yogurt salmon spinach almonds water',
  ]
  for (const g of GOALS) {
    for (const text of inputs) {
      const r = reviewDay(text, g)
      assert.equal(r.empty, false)
      assert.equal(Number.isInteger(r.score), true, `score not integer for "${text}"`)
      assert.ok(r.score >= 1 && r.score <= 10, `score ${r.score} out of range for "${text}"`)
      assert.ok(r.improvements.length <= 3, 'improvements capped at 3')
      assert.ok(r.highlights.length <= 3, 'highlights capped at 3')
    }
  }
})

test('reviewDay is deterministic for the same input', () => {
  const a = reviewDay('chicken and rice with salad', 'build-muscle')
  const b = reviewDay('chicken and rice with salad', 'build-muscle')
  assert.deepEqual(a, b)
})

test('answerQuestion: blank input returns an unmatched prompt', () => {
  const r = answerQuestion('')
  assert.equal(r.matched, false)
  assert.ok(typeof r.answer === 'string' && r.answer.length > 0)
})

test('coachRespond: a clear question routes to an answer', () => {
  const r = coachRespond('what should I eat for more protein?', 'build-muscle')
  assert.equal(r.kind, 'answer')
})

test('coachRespond always returns a well-formed review or answer', () => {
  for (const text of ['grilled chicken salad', 'why am I always hungry', 'zzzz']) {
    const r = coachRespond(text, 'lose-fat')
    assert.ok(r.kind === 'review' || r.kind === 'answer')
    if (r.kind === 'review') assert.equal(typeof r.review.score, 'number')
    else assert.equal(typeof r.answer.answer, 'string')
  }
})

test('STARTER_QUESTIONS surfaces six tappable prompts', () => {
  assert.equal(STARTER_QUESTIONS.length, 6)
  for (const q of STARTER_QUESTIONS) assert.ok(typeof q === 'string' && q.length > 0)
})
