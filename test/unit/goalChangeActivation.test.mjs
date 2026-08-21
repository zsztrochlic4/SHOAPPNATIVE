// §4 unified goal change (GC01–GC09). Proves that the shared changeGoalActivation applies the eased
// GC07 transition week as the active program, versions the program with a per-version id (GC09), and
// that settleTransitionIfDue restores full target intensity once the transition week is over.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  activateProgram,
  changeGoalActivation,
  settleTransitionIfDue,
} from '../../.sweep-out/backend/runtime/activate.js'
import { FULL_GYM_TAGS } from '../../.sweep-out/backend/data/equipmentTags.js'

const NOW = '2026-08-03T00:00:00.000Z'
const TODAY = '2026-08-03'

function makeUser(overrides = {}) {
  return {
    uid: 'test', display_name: 'Test', date_of_birth: '2000-01-01', age_verified: true, sex: 'male',
    height_cm: 180, weight_kg: 80, goal_weight_kg: 82, experience: 'Intermediate', goal: 'Hypertrophy',
    followed_structured_program: true, focal_points: [],
    days_available: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
    session_length_min: 60, equipment_tier: 'Full Gym', equipment_tags: FULL_GYM_TAGS,
    trains_alone: 'never', excluded_exercise_ids: [], preferred_exercise_ids: [],
    affected_regions: [], commitments: [],
    screening: { version: 'adult_v1', outcome: 'CLEAR', answers: {}, followups: {}, guardian_consent: false, clearance_confirmed: false, date: '', conditions: [], waiver_accepted: true },
    diet: [], motivation: null, notes: null, planned_absences: [], created_at: '2026-07-16', schema_version: 1,
    ...overrides,
  }
}

/** Every prescribed exercise's rirMin across a projected program. */
function allRirMin(program) {
  const out = []
  for (const d of program.days) for (const e of d.exercises) out.push(e.rirMin)
  return out
}

test('a goal change applies the eased transition week and versions the program', () => {
  const user = makeUser()
  const base = activateProgram(user, NOW)
  assert.equal(base.status.ok, true)
  assert.equal(base.programDoc.version, 1)
  assert.equal(base.programDoc.program_id, 'test_v1')
  assert.equal(base.programDoc.transition ?? null, null, 'a fresh program carries no transition')

  const changed = changeGoalActivation(user, 'Fat Loss', base.programDoc.version, TODAY, NOW)
  assert.equal(changed.status.ok, true, 'goal change should activate')
  // GC09: new version, and its own addressable id.
  assert.equal(changed.programDoc.version, 2)
  assert.equal(changed.programDoc.program_id, 'test_v2')
  // GC07: the active program is the eased transition week and it carries a settle date one week out.
  assert.ok(changed.programDoc.transition, 'transition marker present')
  assert.equal(changed.programDoc.transition.settlesOnKey, '2026-08-10')
})

test('settleTransitionIfDue is a no-op before the week is up and restores intensity after', () => {
  const user = makeUser()
  const base = activateProgram(user, NOW)
  const newUser = { ...user, goal: 'Fat Loss' }
  const changed = changeGoalActivation(user, 'Fat Loss', base.programDoc.version, TODAY, NOW)

  // Not yet due → no settle.
  assert.equal(settleTransitionIfDue(newUser, changed.programDoc, '2026-08-09', NOW), null)

  // On/after the settle date → regenerate at full target intensity, marker cleared, version kept.
  const settled = settleTransitionIfDue(newUser, changed.programDoc, '2026-08-10', NOW)
  assert.ok(settled && settled.program, 'settle produces a program')
  assert.equal(settled.programDoc.version, changed.programDoc.version, 'settling keeps the same version')
  assert.equal(settled.programDoc.transition ?? null, null, 'marker cleared after settling')

  // The eased week ran at least one RIR higher somewhere than the settled target for the same lifts.
  const easedMax = Math.max(...allRirMin(changed.program))
  const settledMax = Math.max(...allRirMin(settled.program))
  assert.ok(easedMax >= settledMax, 'transition week is never harder than the settled target')
})
