// Day-reschedule misroute guard: "swap/rearrange my (exercise) DAYS" is a training-DAY change, not an
// exercise swap. The model sometimes emits an exercise `swap` for it (or on a bare "yes" that follows
// such a request); coach.ts drops that swap when isDayRescheduleIntent is true. This locks the detector.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import { isDayRescheduleIntent } from '../../.sweep-out/backend/coach/workoutActions.js'

const MUST_DETECT = [
  ['swap my exercise days around', []],
  ['can u swap my exercise days around', []],
  ['rearrange my training days', []],
  ['switch my workout days please', []],
  ['move my days around', []],
  ['change which days i train', ['no context']], // "change ... days"
  ['yes', ['swap my exercise days around', 'I can help you rearrange your training days']], // affirm after day request
  ['sure', ['switch my training days please']],
]

const MUST_NOT_DETECT = [
  ['swap the bench press, i dont enjoy it', []],
  ['swap the bench on my leg day', []], // singular "day" = an exercise swap
  ['yes', ['want me to swap the bench for dumbbell press?']], // affirm after an EXERCISE swap
  ['change my goal to strength', []],
  ['what should i eat tonight', []],
  ['yes', ['want me to set your water goal to 3 litres?']], // affirm after a non-day action
]

for (const [msg, recent] of MUST_DETECT) {
  test(`detects day-reschedule: ${JSON.stringify(msg)}`, () => assert.equal(isDayRescheduleIntent(msg, recent), true))
}
for (const [msg, recent] of MUST_NOT_DETECT) {
  test(`does NOT flag: ${JSON.stringify(msg)} / ${JSON.stringify(recent)}`, () => assert.equal(isDayRescheduleIntent(msg, recent), false))
}
