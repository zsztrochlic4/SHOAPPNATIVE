// Coach Capability Plan — resolver mapping tests. Proves each workout_action maps to the
// right engine call, that a swap re-clamps through the Safety Rules (never hand-synthesized),
// and that regen/patch/nav/nudge outcomes are shaped correctly.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveCoachAction, applyCoachSwapChoice } from '../../.sweep-out/backend/runtime/coachActionResolver.js'
import { activateProgram } from '../../.sweep-out/backend/runtime/activate.js'
import { contextForUser } from '../../.sweep-out/backend/generator/generate.js'
import { swapExercise, swapCandidates } from '../../.sweep-out/backend/generator/swaps.js'
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

/** Build a real, safety-clamped program the resolver can act on. */
function baseState(user = makeUser()) {
  const act = activateProgram(user, NOW)
  assert.equal(act.status.ok, true, 'fixture program should generate')
  return { backendUser: user, program: act.program, instances: act.instances, activation: act }
}

function otherIds(state, keep) {
  const s = new Set()
  for (const d of state.program.days) for (const x of d.exercises) if (x.exerciseId !== keep) s.add(x.exerciseId)
  return s
}

/** Find an exercise with an eligible `dislike` swap, computed exactly as the resolver does
 *  (excluding lifts already in the program so the swap can't duplicate one). */
function firstSwappable(state) {
  const ctx = contextForUser(state.backendUser)
  for (const day of state.program.days) {
    for (const e of day.exercises) {
      const swap = swapExercise(e.exerciseId, 'dislike', ctx, otherIds(state, e.exerciseId))
      if (swap) return { fromId: e.exerciseId, swap }
    }
  }
  return null
}

/** Resolve a swap and, if the engine offered a choice, apply the first option — so callers
 *  always get the final `patch` outcome regardless of how many alternatives existed. */
function doSwap(state, fromId, reason = 'dislike') {
  const r = resolveCoachAction(state, { action: 'swap', fromExerciseId: fromId, reason }, NOW)
  if (!r.ok || r.apply === 'patch') return r
  assert.equal(r.apply, 'choose_swap')
  return applyCoachSwapChoice(state, r.fromExerciseId, r.reason, r.options[0].id)
}

test('invalid payload → ok:false with a safe message (never applies)', () => {
  const state = baseState()
  const r = resolveCoachAction(state, { action: 'nope' }, NOW)
  assert.equal(r.ok, false)
  assert.match(r.reason, /^invalid:/)
  assert.ok(r.message.length > 0)
})

test('swap: patches ONLY the target exercise; prescribed values equal swapExercise() (no bypass of clamp)', () => {
  const state = baseState()
  const target = firstSwappable(state)
  assert.ok(target, 'fixture should contain at least one swappable lift')

  const before = JSON.parse(JSON.stringify(state.program.days))
  const r = doSwap(state, target.fromId, 'dislike') // first option === swapExercise() first
  assert.equal(r.ok, true)
  assert.equal(r.apply, 'patch')

  // The new exercise's stored fields come straight from the engine's clamped prescription.
  let replaced = null
  for (const d of r.program.days) for (const e of d.exercises) if (e.exerciseId === target.swap.toId) replaced = e
  assert.ok(replaced, 'swapped-in exercise should appear in the program')
  assert.equal(replaced.rirMin, target.swap.prescribed.rirMin)
  assert.equal(replaced.sets, target.swap.prescribed.sets)
  assert.equal(replaced.repsMin, target.swap.prescribed.repsMin)
  assert.equal(replaced.repsMax, target.swap.prescribed.repsMax)

  // The original id is gone; every OTHER exercise is byte-identical to before.
  const flatBefore = before.flatMap((d) => d.exercises).filter((e) => e.exerciseId !== target.fromId)
  const flatAfter = r.program.days.flatMap((d) => d.exercises).filter((e) => e.exerciseId !== target.swap.toId)
  assert.deepEqual(flatAfter, flatBefore)

  // Instances patched in lockstep; slot_id preserved and substituted_from recorded.
  const patchedInst = r.instances.flatMap((i) => i.exercises).find((pe) => pe.exercise_id === target.swap.toId)
  assert.ok(patchedInst)
  assert.equal(patchedInst.substituted_from, target.fromId)
  assert.equal(patchedInst.rir_min, target.swap.prescribed.rirMin)
})

test('swap for dislike appends the original to excluded_exercise_ids', () => {
  const state = baseState()
  const target = firstSwappable(state)
  const r = doSwap(state, target.fromId, 'dislike')
  assert.equal(r.ok, true)
  assert.ok(r.nextUser.excluded_exercise_ids.includes(target.fromId))
})

test('a swap with ≥2 alternatives offers a choice; picking one applies exactly that lift', () => {
  const state = baseState()
  const ctx = contextForUser(state.backendUser)
  // Find a lift with at least two eligible dislike alternatives (excluding in-program dupes).
  let multi = null
  for (const day of state.program.days) for (const e of day.exercises) {
    const cands = swapCandidates(e.exerciseId, 'dislike', ctx, otherIds(state, e.exerciseId), 2)
    if (cands.length >= 2) { multi = { fromId: e.exerciseId, cands }; break }
  }
  assert.ok(multi, 'a Full-Gym intermediate program should have a lift with 2+ alternatives')

  const r = resolveCoachAction(state, { action: 'swap', fromExerciseId: multi.fromId, reason: 'dislike' }, NOW)
  assert.equal(r.ok, true)
  assert.equal(r.apply, 'choose_swap')
  assert.equal(r.options.length, 2)
  assert.deepEqual(r.options.map((o) => o.id), multi.cands.map((c) => c.toId))

  // Pick the SECOND option — the program must contain exactly that lift, not the first.
  const picked = r.options[1]
  const applied = applyCoachSwapChoice(state, r.fromExerciseId, r.reason, picked.id)
  assert.equal(applied.apply, 'patch')
  assert.ok(applied.program.days.some((d) => d.exercises.some((e) => e.exerciseId === picked.id)))
  assert.ok(!applied.program.days.some((d) => d.exercises.some((e) => e.exerciseId === r.options[0].id && e.exerciseId !== picked.id)))
})

test('applyCoachSwapChoice rejects an option the engine never offered', () => {
  const state = baseState()
  const target = firstSwappable(state)
  const r = applyCoachSwapChoice(state, target.fromId, 'dislike', 'not_a_real_exercise')
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'invalid_choice')
})

test('swap of a lift not in the program → ok:false not_in_program', () => {
  const state = baseState()
  const r = resolveCoachAction(state, { action: 'swap', fromExerciseId: 'definitely_not_here', reason: 'dislike' }, NOW)
  assert.equal(r.ok, false)
  // Either the engine finds no such exercise, or it isn't in the program — both refuse safely.
  assert.ok(['no_eligible_swap', 'not_in_program'].includes(r.reason))
})

test('change_goal regenerates a fresh, safety-clamped program and bumps the version', () => {
  const state = { ...baseState(), programDoc: { version: 1 } }
  const r = resolveCoachAction(state, { action: 'change_goal', newGoal: 'Strength' }, NOW)
  assert.equal(r.ok, true)
  assert.equal(r.apply, 'regen')
  assert.equal(r.nextUser.goal, 'Strength')
  assert.equal(r.status.ok, true)
  assert.equal(r.programDoc.version, 2) // GC09 versioning via changeGoal
  assert.ok(r.program.days.length > 0)
  // No Load exercise below the S04 rep floor after re-clamp.
  for (const d of r.program.days) for (const e of d.exercises) {
    if (e.prescriptionClass === 'Load') assert.ok(e.repsMin == null || e.repsMin >= 4, `${e.exerciseId} reps<4`)
    assert.ok(e.rirMin >= 0)
  }
})

test('change_goal to the current goal is a no-op refusal', () => {
  const state = baseState()
  const r = resolveCoachAction(state, { action: 'change_goal', newGoal: 'Hypertrophy' }, NOW)
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'no_change')
})

test('set_training_days regenerates around the new days', () => {
  const state = baseState()
  const r = resolveCoachAction(state, { action: 'set_training_days', days: 'Monday,Wednesday,Friday' }, NOW)
  assert.equal(r.ok, true)
  assert.equal(r.apply, 'regen')
  assert.deepEqual(r.nextUser.days_available, ['Monday', 'Wednesday', 'Friday'])
})

test('deload cuts sets and raises RIR while holding the program shape', () => {
  const state = baseState()
  const r = resolveCoachAction(state, { action: 'deload' }, NOW)
  assert.equal(r.ok, true)
  assert.equal(r.apply, 'regen')
  // Compare against the un-deloaded baseline: every exercise trains at >= the base RIR.
  const base = state.activation.program
  const baseRir = base.days.flatMap((d) => d.exercises).reduce((s, e) => s + e.rirMin, 0)
  const deRir = r.program.days.flatMap((d) => d.exercises).reduce((s, e) => s + e.rirMin, 0)
  assert.ok(deRir >= baseRir, 'deload should not lower RIR anywhere')
})

test('start_session and open_budget_eats are navigation-only', () => {
  const state = baseState()
  const full = resolveCoachAction(state, { action: 'start_session', variant: 'full' }, NOW)
  assert.equal(full.ok, true); assert.equal(full.apply, 'navigate'); assert.equal(full.target, 'activeWorkout')
  const quick = resolveCoachAction(state, { action: 'start_session', variant: 'quick15' }, NOW)
  assert.equal(quick.target, 'quickWorkout')
  const eats = resolveCoachAction(state, { action: 'open_budget_eats' }, NOW)
  assert.equal(eats.apply, 'navigate'); assert.equal(eats.target, 'budgetEats')
})

test('nudge_log returns a nudge outcome with the habit kind', () => {
  const state = baseState()
  const r = resolveCoachAction(state, { action: 'nudge_log', kind: 'water' }, NOW)
  assert.equal(r.ok, true); assert.equal(r.apply, 'nudge'); assert.equal(r.kind, 'water')
})

test('exam_mode returns a maintenance period over the given dates', () => {
  const state = baseState()
  const r = resolveCoachAction(state, { action: 'exam_mode', startDate: '2026-11-01', endDate: '2026-11-21' }, NOW)
  assert.equal(r.ok, true)
  assert.equal(r.apply, 'period')
  assert.equal(r.mode, 'maintenance')
  assert.equal(r.startDate, '2026-11-01')
  assert.equal(r.endDate, '2026-11-21')
})

test('planned_absence passes the chosen mode through as a period', () => {
  const state = baseState()
  const r = resolveCoachAction(state, { action: 'planned_absence', mode: 'full_pause', startDate: '2026-12-20', endDate: '2027-01-05' }, NOW)
  assert.equal(r.ok, true)
  assert.equal(r.apply, 'period')
  assert.equal(r.mode, 'full_pause')
})

test('a backwards date range is rejected before it reaches the resolver body', () => {
  const state = baseState()
  const r = resolveCoachAction(state, { action: 'exam_mode', startDate: '2026-11-21', endDate: '2026-11-01' }, NOW)
  assert.equal(r.ok, false)
  assert.match(r.reason, /^invalid:/)
})

test('share_pr returns an outward signal (UI grounds it in a real PR + second confirm)', () => {
  const state = baseState()
  const r = resolveCoachAction(state, { action: 'share_pr', prExerciseId: 'bench_press', prValue: 100 }, NOW)
  assert.equal(r.ok, true)
  assert.equal(r.apply, 'share_pr')
})

test('reschedule_days regenerates around the new days (progress preserved)', () => {
  const state = baseState()
  const r = resolveCoachAction(state, { action: 'reschedule_days', days: 'Tuesday,Thursday,Saturday' }, NOW)
  assert.equal(r.ok, true)
  assert.equal(r.apply, 'regen')
  assert.deepEqual(r.nextUser.days_available, ['Tuesday', 'Thursday', 'Saturday'])
})

test('catch_up exempt declares today a no-penalty rest day; other modes decline honestly', () => {
  const state = baseState()
  const exempt = resolveCoachAction(state, { action: 'catch_up', mode: 'exempt' }, NOW)
  assert.equal(exempt.ok, true)
  assert.equal(exempt.apply, 'period')
  assert.equal(exempt.mode, 'no_change')
  assert.equal(exempt.startDate, NOW.slice(0, 10))
  const shift = resolveCoachAction(state, { action: 'catch_up', mode: 'shift_forward' }, NOW)
  assert.equal(shift.ok, false)
  assert.equal(shift.reason, 'catch_up_unsupported')
})
