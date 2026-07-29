// AI meal-scan parser tests (Production Readiness plan Blocker #1 / §4.4). These
// validate the food/non-food gate and the number clamping WITHOUT any live AI
// call, so an over-confident or malformed model reply can never reach the UI.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseMealAnalysis, extractJson } from '../../.sweep-out/lib/mealScanParse.js'

test('non-food images are gated out', () => {
  assert.deepEqual(parseMealAnalysis('{"food":false}'), { kind: 'not_food' })
})

test('a valid food reply is parsed into a range + confidence', () => {
  const a = parseMealAnalysis(
    JSON.stringify({
      food: true,
      name: 'Chicken & rice bowl',
      items: ['chicken', 'rice', 'veg'],
      kcalLow: 500,
      kcalHigh: 700,
      protein: 45,
      carbs: 70,
      fat: 15,
      confidence: 'medium',
      rec: 'freely',
      note: 'Lean protein and smart carbs.',
    }),
  )
  assert.equal(a.kind, 'food')
  assert.equal(a.name, 'Chicken & rice bowl')
  assert.equal(a.kcalLow, 500)
  assert.equal(a.kcalHigh, 700)
  assert.equal(a.confidence, 'medium')
  assert.equal(a.rec, 'freely')
  assert.deepEqual(a.items, ['chicken', 'rice', 'veg'])
})

test('kcalHigh is forced to be >= kcalLow', () => {
  const a = parseMealAnalysis('{"food":true,"kcalLow":800,"kcalHigh":200}')
  assert.equal(a.kind, 'food')
  assert.ok(a.kcalHigh >= a.kcalLow)
})

test('out-of-range / non-numeric values are clamped, not trusted', () => {
  const a = parseMealAnalysis(
    '{"food":true,"kcalLow":-50,"kcalHigh":999999,"protein":"lots","carbs":9000,"fat":-3}',
  )
  assert.equal(a.kind, 'food')
  assert.ok(a.kcalLow >= 0)
  assert.ok(a.kcalHigh <= 5000)
  assert.equal(a.p, 0) // "lots" is not a number → fallback
  assert.ok(a.c <= 600)
  assert.equal(a.f, 0) // negative clamped to 0
})

test('unknown enum values fall back to the safest option', () => {
  const a = parseMealAnalysis('{"food":true,"confidence":"certain","rec":"always"}')
  assert.equal(a.kind, 'food')
  assert.equal(a.confidence, 'low') // unknown → low
  assert.equal(a.rec, 'moderation') // unknown → moderation
})

test('em dashes in the note are normalised', () => {
  const a = parseMealAnalysis('{"food":true,"note":"Great choice — really balanced"}')
  assert.equal(a.kind, 'food')
  assert.ok(!a.note.includes('—'))
})

test('missing name and items get safe defaults', () => {
  const a = parseMealAnalysis('{"food":true}')
  assert.equal(a.kind, 'food')
  assert.equal(a.name, 'Your meal')
  assert.deepEqual(a.items, [])
})

test('JSON wrapped in prose / code fences is still extracted', () => {
  assert.equal(extractJson('```json\n{"food":false}\n```'), '{"food":false}')
  const a = parseMealAnalysis('Here is your result:\n```\n{"food":false}\n```')
  assert.deepEqual(a, { kind: 'not_food' })
})

test('garbage input throws rather than guessing', () => {
  assert.throws(() => parseMealAnalysis('not json at all'))
  assert.throws(() => parseMealAnalysis(''))
})
