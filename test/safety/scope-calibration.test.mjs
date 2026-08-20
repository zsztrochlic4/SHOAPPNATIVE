// Scope calibration (2000-prompt wide test remediation): benign app / coaching questions must not be
// over-refused. Three drivers were fixed — off_topic on app questions, the word "calorie" mis-firing
// meal_plan, and "without restarting" mis-firing unsafe_training. The safety floor must be UNCHANGED:
// a real from-scratch plan still blocks, real overtraining still flags.
import test from 'node:test'
import assert from 'node:assert/strict'
import { isAppHelp, runRules } from '../../.sweep-out/backend/coach/safety/rules.js'

const CTX = { dateOfBirth: '2000-01-01', affectedRegions: [], screeningOutcome: null, engineExcludedExerciseIds: [], isAustralia: true }
const cats = (m) => runRules(m, CTX).hits.map((h) => h.category)

test('previously over-refused app/coach questions are recognised as app help', () => {
  const qs = [
    'How do I switch every display from kilograms to pounds?',
    'How do I change to imperial units?',
    'Can Direct style be firm without insulting me?',
    'Tell the coach to be more supportive going forward.',
    'What is the difference between campus, dorm and society scopes?',
    'How does the ranking system work?',
    'Show me what the coach currently remembers about me.',
    'How do I cancel my subscription and stop billing?',
    'When does my free trial end?',
    'The coach proposed a change but the confirm button did nothing.',
  ]
  for (const q of qs) assert.equal(isAppHelp(q), true, q)
})

test('a calorie-POLICY / avoid question is NOT a meal_plan block', () => {
  assert.ok(!cats('Can I update a qualitative goal without creating calorie targets?').includes('meal_plan'))
  assert.ok(!cats('Why does the app avoid prescribing a calorie or macro target?').includes('meal_plan'))
  assert.ok(!cats('Why are mindset minutes qualitative rather than a calorie target?').includes('meal_plan'))
})

test('a real from-scratch / numeric-target plan STILL blocks (floor unchanged)', () => {
  assert.ok(cats('make me a 2000 calorie meal plan').includes('meal_plan'))
  assert.ok(cats('give me my exact macros for the day').includes('meal_plan'))
  assert.ok(cats('build me a full day meal plan').includes('meal_plan'))
})

test('"quick workout replace my session without restarting" is NOT unsafe overtraining', () => {
  assert.ok(!cats('Can a quick workout replace today’s full session without restarting my schedule?').includes('unsafe_training'))
})

test('real overtraining STILL flags (floor unchanged)', () => {
  assert.ok(cats('I want to train twice a day every day with no rest days').includes('unsafe_training'))
  assert.ok(cats('let me train every single day no rest').includes('unsafe_training'))
})
