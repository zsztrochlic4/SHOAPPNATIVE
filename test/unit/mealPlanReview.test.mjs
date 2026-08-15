/**
 * Deterministic meal-plan review synthesiser (node --test). Guarantees a qualitative /10 review
 * tied to the goal, with NO calorie/macro numbers, for when the flash-lite classifier flakily
 * refers a genuine own-plan review.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { synthesizeMealPlanReview } from '../../.sweep-out/backend/coach/workoutActions.js'

const PLAN = 'Mon Breakfast: Oats with banana and peanut butter. Mon Lunch: Chicken, rice and broccoli. ' +
  'Mon Dinner: Beef stir fry with noodles. Tue Breakfast: Greek yoghurt, berries and granola. ' +
  'Tue Dinner: Salmon, potatoes and greens. Wed Breakfast: Three-egg omelette with toast. Wed Dinner: Takeaway pizza.'

test('opens with a /10 rating tied to the muscle goal', () => {
  const r = synthesizeMealPlanReview(PLAN, 'build-muscle')
  assert.ok(r, 'should return a review')
  assert.match(r, /\b[3-9]\/10\b/)
  assert.match(r, /building muscle/)
})

test('never emits calorie or macro numbers', () => {
  const r = synthesizeMealPlanReview(PLAN, 'hypertrophy')
  assert.doesNotMatch(r, /\b\d{2,4}\s?(cal|calorie|kcal)\b/i)
  assert.doesNotMatch(r, /\b\d{2,4}\s?g\b/i)
})

test('goal framing changes with the goal', () => {
  assert.match(synthesizeMealPlanReview(PLAN, 'lose fat'), /losing fat/)
  assert.match(synthesizeMealPlanReview(PLAN, 'get stronger'), /getting stronger/)
  assert.match(synthesizeMealPlanReview(PLAN, 'stay healthy'), /staying healthy/)
})

test('returns null when there is no plan to read', () => {
  assert.equal(synthesizeMealPlanReview('', 'build-muscle'), null)
  assert.equal(synthesizeMealPlanReview(undefined, 'build-muscle'), null)
  assert.equal(synthesizeMealPlanReview('  ', 'build-muscle'), null)
})

test('a protein-light, takeaway-heavy plan scores lower than a balanced one', () => {
  const poor = 'Mon Dinner: Takeaway pizza. Tue Dinner: Burger and chips. Wed Dinner: Kebab and fries.'
  const good = PLAN
  const scoreOf = (s) => Number((s.match(/\b([3-9])\/10\b/) || [])[1])
  assert.ok(scoreOf(synthesizeMealPlanReview(poor, 'build-muscle')) < scoreOf(synthesizeMealPlanReview(good, 'build-muscle')))
})
