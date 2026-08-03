// Audit reassessment 2026-08-03 — coach ACTION SAFETY invariants (C-002, C-004, C-010, C-011,
// C-013, CA-002). These are the properties most likely to cause harm: every proposed/selected
// exercise must stay legal for all known injuries and exclusions after every action, dates must be
// real, and no transform may surface an illegal plan.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveCoachAction } from '../../.sweep-out/backend/runtime/coachActionResolver.js'
import { activateProgram } from '../../.sweep-out/backend/runtime/activate.js'
import { contextForUser } from '../../.sweep-out/backend/generator/generate.js'
import { swapCandidates, requestSpecific, isCompatibleSwap } from '../../.sweep-out/backend/generator/swaps.js'
import { injuryExcludeIds } from '../../.sweep-out/backend/generator/build.js'
import { validateProgramForUser, estimateDayMinutes } from '../../.sweep-out/backend/runtime/programInvariants.js'
import { validateWorkoutActionPayload } from '../../.sweep-out/backend/coach/workoutActions.js'
import { EXERCISE_BY_ID, substitutesFor } from '../../.sweep-out/backend/data/index.js'
import { FULL_GYM_TAGS } from '../../.sweep-out/backend/data/equipmentTags.js'

const NOW = '2026-08-03T00:00:00.000Z'

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
    diet: [], tight_budget: false, motivation: null, notes: null, planned_absences: [], created_at: '2026-07-16', schema_version: 1,
    ...overrides,
  }
}

/* ---------------- C-002: injury hard-exclusions on EVERY swap reason ---------------- */

test('C-002: SH01/SH08 are shoulder hard-exclusions and appear in SH02 substitutes (audit fixture holds)', () => {
  const shoulderExcl = injuryExcludeIds(['shoulder'])
  assert.ok(shoulderExcl.has('SH01'), 'SH01 must be a shoulder hard-exclusion')
  assert.ok(shoulderExcl.has('SH08'), 'SH08 must be a shoulder hard-exclusion')
  const subs = substitutesFor('SH02')
  assert.ok(subs.includes('SH01'), 'audit fixture: SH01 is a listed SH02 substitute')
})

test('C-002: a NON-pain (dislike) swap never offers an injury hard-excluded exercise', () => {
  const ctx = contextForUser(makeUser({ affected_regions: ['shoulder'] }))
  const excl = injuryExcludeIds(['shoulder'])
  // Ask for MANY candidates so nothing excluded can slip through in any position.
  const cands = swapCandidates('SH02', 'dislike', ctx, new Set(), 20)
  for (const c of cands) assert.ok(!excl.has(c.toId), `dislike swap offered injury-excluded ${c.toId}`)
})

test('C-002: EVERY swap reason respects injury exclusions', () => {
  const ctx = contextForUser(makeUser({ affected_regions: ['shoulder'] }))
  const excl = injuryExcludeIds(['shoulder'])
  for (const reason of ['dislike', 'variety', 'too_hard', 'too_easy', 'equipment', 'pain']) {
    const cands = swapCandidates('SH02', reason, ctx, new Set(), 20)
    for (const c of cands) assert.ok(!excl.has(c.toId), `${reason} swap offered injury-excluded ${c.toId}`)
  }
})

test('C-002: a specific request for an injury-excluded lift is refused with injury_excluded', () => {
  const ctx = contextForUser(makeUser({ affected_regions: ['shoulder'] }))
  const r = requestSpecific('SH02', 'SH01', ctx)
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'injury_excluded')
})

/* ---------------- C-004: specific swap compatibility + no duplicates ---------------- */

test('C-004: requestSpecific rejects an incompatible (unrelated) lift', () => {
  const ctx = contextForUser(makeUser())
  // A leg exercise is not a valid substitute for a shoulder press.
  const wanted = Object.values(EXERCISE_BY_ID).find((e) => e.muscleGroup === 'Quads' && e.active)
  assert.ok(wanted)
  const r = requestSpecific('SH02', wanted.id, ctx)
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'not_compatible')
})

test('C-004: requestSpecific rejects a lift already in the program (no duplicates)', () => {
  const ctx = contextForUser(makeUser())
  // SH07 is a compatible SH02 substitute; pretend it is already in the program via `avoid`.
  assert.ok(isCompatibleSwap('SH02', 'SH07'))
  const r = requestSpecific('SH02', 'SH07', ctx, new Set(['SH07']))
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'already_in_program')
})

test('C-004: a compatible, eligible, non-duplicate specific swap is placed', () => {
  const ctx = contextForUser(makeUser())
  const r = requestSpecific('SH02', 'SH07', ctx)
  assert.ok('toId' in r && r.toId === 'SH07', 'a valid specific swap should be placed')
})

/* ---------------- CA-002: the shared invariant gate ---------------- */

test('CA-002: a clean generated program passes validateProgramForUser', () => {
  const user = makeUser()
  const act = activateProgram(user, NOW)
  const res = validateProgramForUser(user, act.program, { enforceDuration: true })
  assert.equal(res.ok, true, `generated program violated invariants: ${JSON.stringify(res.violations)}`)
})

test('CA-002: an injury-excluded exercise injected into a plan is caught', () => {
  const user = makeUser({ affected_regions: ['shoulder'] })
  const act = activateProgram(user, NOW)
  // Force SH01 (shoulder hard-exclusion) into the first day.
  const bad = { ...act.program, days: act.program.days.map((d, i) => i === 0
    ? { ...d, exercises: [...d.exercises, { exerciseId: 'SH01', name: 'Barbell Overhead Press', muscleGroup: 'Shoulders', prescriptionClass: 'Load', sets: 3, repsMin: 5, repsMax: 8, durationSecMax: null, rirMin: 2, restSecMin: 120, pct1rmMax: null, injuryAdjusted: false }] }
    : d) }
  const res = validateProgramForUser(user, bad)
  assert.equal(res.ok, false)
  assert.ok(res.violations.some((v) => v.code === 'injury' && v.exerciseId === 'SH01'))
})

test('CA-002: a duplicate within a day is caught', () => {
  const user = makeUser()
  const act = activateProgram(user, NOW)
  const first = act.program.days[0].exercises[0]
  const bad = { ...act.program, days: act.program.days.map((d, i) => i === 0
    ? { ...d, exercises: [...d.exercises, { ...first }] } : d) }
  const res = validateProgramForUser(user, bad)
  assert.equal(res.ok, false)
  assert.ok(res.violations.some((v) => v.code === 'duplicate'))
})

test('CA-002 / C-011: estimated session time is computed and within budget for generated plans', () => {
  const user = makeUser({ session_length_min: 60 })
  const act = activateProgram(user, NOW)
  for (const d of act.program.days) {
    const mins = estimateDayMinutes(d)
    assert.ok(mins > 0)
    assert.ok(mins <= 60 * 1.25, `${d.weekday} ~${mins}min exceeds the 60min +25% budget`)
  }
})

/* ---------------- C-013: calendar-valid dates ---------------- */

test('C-013: impossible dates are rejected', () => {
  for (const bad of ['2026-99-99', '2026-02-30', '2026-13-01', '2026-00-10', '0000-01-01']) {
    const r = validateWorkoutActionPayload({ action: 'exam_mode', startDate: bad, endDate: '2026-12-31' })
    assert.equal(r.ok, false, `${bad} should be rejected`)
  }
})

test('C-013: a real leap-day date is accepted', () => {
  const r = validateWorkoutActionPayload({ action: 'exam_mode', startDate: '2028-02-29', endDate: '2028-03-05' })
  assert.equal(r.ok, true)
})

test('C-013: a reversed range and an over-long span are rejected', () => {
  const reversed = validateWorkoutActionPayload({ action: 'exam_mode', startDate: '2026-11-21', endDate: '2026-11-01' })
  assert.equal(reversed.ok, false)
  const tooLong = validateWorkoutActionPayload({ action: 'planned_absence', mode: 'full_pause', startDate: '2026-01-01', endDate: '2027-06-01' })
  assert.equal(tooLong.ok, false)
  assert.match(tooLong.reason, /span_too_long/)
})

/* ---------------- End-to-end: the audit's synthetic failure can no longer happen ---------------- */

test('audit synthetic failure: shoulder user, dislike SH02 → never lands SH01/SH08', () => {
  const user = makeUser({ affected_regions: ['shoulder'] })
  const act = activateProgram(user, NOW)
  // Only meaningful if SH02 is actually in the generated plan; otherwise assert the swap refuses safely.
  const hasSH02 = act.program.days.some((d) => d.exercises.some((e) => e.exerciseId === 'SH02'))
  const state = { backendUser: user, program: act.program, instances: act.instances, programDoc: null }
  const r = resolveCoachAction(state, { action: 'swap', fromExerciseId: 'SH02', reason: 'dislike' }, NOW)
  if (!hasSH02) { assert.ok(!r.ok || r.reason === 'not_in_program' || r.apply, 'no SH02 in plan → safe outcome'); return }
  if (r.ok && (r.apply === 'patch' || r.apply === 'regen')) {
    const excl = injuryExcludeIds(['shoulder'])
    for (const d of r.program.days) for (const e of d.exercises) assert.ok(!excl.has(e.exerciseId), `applied injury-excluded ${e.exerciseId}`)
  }
  if (r.ok && r.apply === 'choose_swap') {
    const excl = injuryExcludeIds(['shoulder'])
    for (const o of r.options) assert.ok(!excl.has(o.id), `offered injury-excluded ${o.id}`)
  }
})
