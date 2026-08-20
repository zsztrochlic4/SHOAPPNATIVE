// Personalisation for the first-run Welcome tour: the Welcome + Train card titles are
// built from the user's onboarding answers, each with a safe fallback. These tests pin
// the goal→phrase mapping, the day-count validation, and every fallback path so a missing
// or malformed profile can never produce a blank or broken sentence.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildWelcomeSteps, firstNameFrom, GOAL_PHRASE } from '../../.sweep-out/screens/welcomeTourContent.js'

const titleOf = (input, kicker) => buildWelcomeSteps(input).find((s) => s.kicker === kicker).title

test('welcome title uses the first name', () => {
  assert.equal(titleOf({ name: 'Alex Jordan', goal: 'build-muscle', daysPerWeek: 5 }, 'WELCOME'), "Alex, you're all set!")
})

test('welcome title falls back when the name is missing or blank', () => {
  assert.equal(titleOf({ name: undefined }, 'WELCOME'), "You're all set!")
  assert.equal(titleOf({ name: '   ' }, 'WELCOME'), "You're all set!")
  assert.equal(titleOf({ name: null }, 'WELCOME'), "You're all set!")
})

test('train title maps every goal to its phrase and includes the day count', () => {
  assert.equal(titleOf({ goal: 'build-muscle', daysPerWeek: 5 }, 'TRAIN'), 'Built for building muscle, 5 days a week')
  assert.equal(titleOf({ goal: 'lose-fat', daysPerWeek: 3 }, 'TRAIN'), 'Built for losing fat, 3 days a week')
  assert.equal(titleOf({ goal: 'gain-strength', daysPerWeek: 4 }, 'TRAIN'), 'Built for getting stronger, 4 days a week')
  assert.equal(titleOf({ goal: 'stay-healthy', daysPerWeek: 2 }, 'TRAIN'), 'Built for getting fitter, 2 days a week')
})

test('train title falls back when goal or a valid day count is missing', () => {
  assert.equal(titleOf({ goal: undefined, daysPerWeek: 5 }, 'TRAIN'), 'Your program, ready to go')
  assert.equal(titleOf({ goal: 'build-muscle' }, 'TRAIN'), 'Your program, ready to go')
  // Out-of-range / non-integer day counts are rejected rather than shown.
  assert.equal(titleOf({ goal: 'build-muscle', daysPerWeek: 0 }, 'TRAIN'), 'Your program, ready to go')
  assert.equal(titleOf({ goal: 'build-muscle', daysPerWeek: 8 }, 'TRAIN'), 'Your program, ready to go')
  assert.equal(titleOf({ goal: 'build-muscle', daysPerWeek: 3.5 }, 'TRAIN'), 'Your program, ready to go')
})

test('always produces four steps with the fixed kicker order', () => {
  const kickers = buildWelcomeSteps({}).map((s) => s.kicker)
  assert.deepEqual(kickers, ['WELCOME', 'TRAIN', 'NUTRITION', 'COMMUNITY'])
})

test('no user-facing copy contains a dash (owner rule: no dash punctuation)', () => {
  const steps = buildWelcomeSteps({ name: 'Sam', goal: 'gain-strength', daysPerWeek: 4 })
  for (const s of steps) {
    for (const line of [s.title, s.lead, s.secondary].filter(Boolean)) {
      assert.ok(!/[‐-―−]/.test(line) && !/ - /.test(line), `dash found in: ${line}`)
    }
  }
})

test('firstNameFrom and GOAL_PHRASE cover their inputs', () => {
  assert.equal(firstNameFrom('  Jamie Lee  '), 'Jamie')
  assert.equal(firstNameFrom(''), '')
  assert.deepEqual(Object.keys(GOAL_PHRASE).sort(), ['build-muscle', 'gain-strength', 'lose-fat', 'stay-healthy'])
})
