// Coach capture⟷consume contract (field-drift guard).
//
// The coach's server context builder (functions/src/coachWorkspace.ts) reads a fixed set of
// fields off the canonical UserDoc that onboarding writes (src/backend/mapping/onboardingContract.ts
// -> buildUserDoc). A real bug shipped once because the reader used `experience_level`/`days_per_week`
// while the writer used `experience`/`days_available`; it was masked only because the demo seed
// happened to match the reader. This test fails the moment a consumed field name drifts from the
// produced field name, so that class of silent bug can never regress.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildUserDoc } from '../../.sweep-out/backend/mapping/onboardingContract.js'

// A representative, fully-answered onboarding input (full gym, injuries, diet) so every branch
// of the contract populates its field rather than defaulting to empty.
const INPUT = {
  uid: 'u_contract',
  name: 'Contract Tester',
  dob: '1996-05-01',
  guardianConsent: false,
  sex: 'male',
  height: 180,
  weight: 82,
  goalWeight: 78,
  noGoalWeight: false,
  goal: 'build',
  focus: ['Arms', 'Chest'],
  experience: 'beginner',
  structured: 'no',
  days: ['Monday', 'Wednesday', 'Friday', 'Saturday'],
  session: 60,
  alone: 'usually',
  environment: 'gym',
  equipment: [],
  trainAround: ['Lower back'],
  moreInfo: 'travelling in December',
  activities: [],
  activityOther: '',
  activityDetail: {},
  loveExercises: [],
  avoidExercises: [],
  motivation: 'look and feel stronger',
  safety: {},
  followup: {},
  movements: [],
  movementsOther: '',
  terms: true,
}

// The exact set the coach reads off the backend UserDoc (backend.* in coachWorkspace.ts plus the
// goal-direction backstop). Keep this list in lockstep with the reader: if the coach starts reading
// a new field, add it here; if it stops, remove it. A missing/renamed producer field trips the test.
const CONSUMED_FIELDS = [
  'date_of_birth',
  'days_available',
  'diet',
  'equipment_tags',
  'equipment_tier',
  'experience',
  'goal',
  'goal_weight_kg',
  'height_cm',
  'sex',
  'session_length_min',
  'trains_alone',
  'excluded_exercise_ids',
  'affected_regions',
  'planned_absences',
  'screening',
  'notes',
]

test('onboarding contract produces every field the coach consumes, under its canonical name', () => {
  const doc = buildUserDoc(INPUT, { diet: ['vegetarian'] })
  for (const field of CONSUMED_FIELDS) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(doc, field),
      `UserDoc is missing coach-consumed field "${field}" — a rename would silently blind the coach`,
    )
    assert.notEqual(doc[field], undefined, `coach-consumed field "${field}" is undefined`)
  }
})

test('the fields the coach grounds on carry the real onboarding answers (not stale defaults)', () => {
  const doc = buildUserDoc(INPUT, { diet: ['vegetarian'] })
  assert.equal(doc.experience, 'Beginner')
  assert.equal(doc.goal, 'Hypertrophy')
  assert.equal(doc.equipment_tier, 'Full Gym')
  assert.equal(doc.days_available.length, 4)
  assert.equal(doc.goal_weight_kg, 78)
  assert.deepEqual(doc.diet, ['vegetarian'])
  assert.equal(doc.trains_alone, 'usually')
  // affected region from trainAround must reach the coach's constraints
  assert.ok(doc.affected_regions.length >= 1)
})
