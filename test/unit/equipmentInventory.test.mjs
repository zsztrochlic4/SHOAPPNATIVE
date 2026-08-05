// Equipment TIER vs. INVENTORY (audit R5-005). Proves that a default Bodyweight (no-equipment)
// user is never pre-granted purchased gym equipment, that owning such equipment is opt-in via
// the onboarding chips, and that the generator never prescribes an exercise the user cannot
// physically perform.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_INVENTORY_BY_TIER,
  BODYWEIGHT_BASE_TAGS,
  HOUSEHOLD_EQUIPMENT,
  equipmentTagsSatisfied,
} from '../../.sweep-out/backend/data/equipmentInventory.js'
import { BODYWEIGHT_TAGS } from '../../.sweep-out/backend/data/equipmentTags.js'
import { mapEquipmentTags } from '../../.sweep-out/backend/mapping/onboardingContract.js'
import { generateProgram } from '../../.sweep-out/backend/generator/generate.js'
import { EXERCISE_BY_ID } from '../../.sweep-out/backend/data/index.js'

// Equipment a no-equipment user must NOT be assumed to own by default (audit's explicit list
// plus the other purchased items that leaked into the Bodyweight tag union).
const FORBIDDEN_DEFAULTS = [
  'band',
  'anchor_point',
  'cable_machine',
  'machine_abduction',
  'rack',
  'rings',
  'pull_up_bar',
  'low_bar',
  'bench',
  'dip_bars',
  'barbell',
  'dumbbell',
  'kettlebell',
]

function bodyweightUser(overrides = {}) {
  return {
    uid: 'test', display_name: 'Test', date_of_birth: '2000-01-01', age_verified: true, sex: 'male',
    height_cm: 180, weight_kg: 80, goal_weight_kg: 82, experience: 'Intermediate', goal: 'Hypertrophy',
    followed_structured_program: true, focal_points: [],
    days_available: ['Monday', 'Wednesday', 'Friday', 'Saturday'],
    session_length_min: 45, equipment_tier: 'Bodyweight',
    equipment_tags: DEFAULT_INVENTORY_BY_TIER.Bodyweight,
    trains_alone: 'never', excluded_exercise_ids: [], preferred_exercise_ids: [],
    affected_regions: [], commitments: [],
    screening: { version: 'adult_v1', outcome: 'CLEAR', answers: {}, followups: {}, guardian_consent: false, clearance_confirmed: false, date: '', conditions: [], waiver_accepted: true },
    diet: [], tight_budget: false, motivation: null, notes: null, planned_absences: [], created_at: '2026-07-16', schema_version: 1,
    ...overrides,
  }
}

test('Bodyweight base grants only genuinely household-owned equipment', () => {
  for (const tag of FORBIDDEN_DEFAULTS) {
    assert.ok(!BODYWEIGHT_BASE_TAGS.includes(tag), `Bodyweight base must not include "${tag}"`)
  }
  // Everything in the base must be on the household allowlist.
  for (const tag of BODYWEIGHT_BASE_TAGS) {
    assert.ok(HOUSEHOLD_EQUIPMENT.includes(tag), `unexpected non-household tag in Bodyweight base: "${tag}"`)
  }
  // The base is a strict subset of the raw generated union (we only removed over-grants).
  for (const tag of BODYWEIGHT_BASE_TAGS) {
    assert.ok(BODYWEIGHT_TAGS.includes(tag), `base tag "${tag}" is not in the generated union`)
  }
})

test('onboarding grants a band/pull-up bar only when the chip is ticked', () => {
  const noKit = mapEquipmentTags('bodyweight', [])
  assert.ok(!noKit.includes('band'), 'no chip → no band')
  assert.ok(!noKit.includes('pull_up_bar'), 'no chip → no pull-up bar')

  const withBands = mapEquipmentTags('bodyweight', ['Resistance bands'])
  assert.ok(withBands.includes('band'), 'ticking Resistance bands adds band')
  assert.ok(withBands.includes('anchor_point'), 'ticking Resistance bands adds anchor_point')

  const withBar = mapEquipmentTags('bodyweight', ['Pull-up bar'])
  assert.ok(withBar.includes('pull_up_bar'), 'ticking Pull-up bar adds pull_up_bar')
})

test('a "none" (no-equipment) requirement is satisfiable for everyone, incl. a bare Bodyweight user', () => {
  // R5-005 root cause: the "none" sentinel was compared literally, so push-ups/squats/planks were
  // unreachable for every tier. It must now be always-satisfied.
  const bare = DEFAULT_INVENTORY_BY_TIER.Bodyweight
  assert.equal(equipmentTagsSatisfied(['none'], bare), true)
  assert.equal(equipmentTagsSatisfied([''], bare), true)
  assert.equal(equipmentTagsSatisfied(['none', 'chair'], bare), true) // chair is household
  assert.equal(equipmentTagsSatisfied(['band'], bare), false) // a real, unowned requirement still fails
  assert.equal(equipmentTagsSatisfied(['none', 'band'], bare), false) // AND across elements: band still required

  // A genuine no-equipment movement is now actually prescribed to a bare Bodyweight user.
  const user = bodyweightUser({ goal: 'Hypertrophy', session_length_min: 45 })
  const r = generateProgram(user)
  assert.ok(r.ok)
  const usesNoneOnly = r.program.days.flatMap((d) => d.exercises).some((e) => {
    const tags = EXERCISE_BY_ID[e.exerciseId].requiredEquipmentTags
    return tags.length === 1 && tags[0] === 'none'
  })
  assert.ok(usesNoneOnly, 'a bare Bodyweight plan should include at least one pure no-equipment exercise')
})

test('a default Bodyweight plan never prescribes unavailable equipment', () => {
  for (const goal of ['Hypertrophy', 'Fat Loss', 'Strength', 'General Fitness']) {
    for (const dur of [30, 45, 90]) {
      const user = bodyweightUser({ goal, session_length_min: dur })
      const owned = new Set(user.equipment_tags)
      const r = generateProgram(user)
      assert.ok(r.ok, `${goal}/${dur}min generation should succeed`)
      for (const day of r.program.days) {
        for (const e of day.exercises) {
          const ex = EXERCISE_BY_ID[e.exerciseId]
          const ok = equipmentTagsSatisfied(ex.requiredEquipmentTags, owned)
          assert.ok(ok, `${goal}/${dur}min served impossible exercise ${e.exerciseId} [${ex.requiredEquipmentTags.join(', ')}]`)
        }
      }
    }
  }
})
