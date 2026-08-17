// Server-side coach orchestration. Production is default-OFF; internal builds opt in explicitly.
// The guarded behaviour — a crisis never reaches
// the model, an allowed turn does + is validated, the daily cap is honoured, and the SERVER is
// authoritative on action capability (audit C-006) — is verified via coachTurnCore with injected
// fakes. The first test locks in the production fail-closed release state.
//   npm --prefix functions run build && node --test functions/test/coach.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { runCoachTurn, coachTurnCore } from '../lib/coach.js'
import { newSafetySession } from '../lib/_shared/backend/coach/safety/index.js'

const baseDeps = (over = {}) => {
  let replyCalls = 0
  const deps = {
    readDob: async () => '2000-01-01', // adult
    classify: async () => '{"categories":["none"]}', // benign classification
    generateReply: async () => {
      replyCalls++
      return JSON.stringify({
        mode: 'general',
        message: 'Focus on hitting depth with a braced core.',
        citations: [],
        memory: null,
        proposal: { kind: 'none' },
      })
    },
    enforceLimit: async () => {},
    killSwitchEngaged: () => false,
    todayKey: '2026-07-31',
    ...over,
  }
  return { deps, replyCalls: () => replyCalls }
}

test('runCoachTurn fails closed when the internal release channel is not explicitly enabled', async () => {
  const { deps, replyCalls } = baseDeps()
  await assert.rejects(() => runCoachTurn('u1', { message: 'how do I squat?' }, deps), /coach_disabled/)
  assert.equal(replyCalls(), 0)
})

test('a crisis message is blocked by the safety floor and NEVER reaches the model', async () => {
  const { deps, replyCalls } = baseDeps()
  const out = await coachTurnCore('u1', { message: 'i want to kill myself tonight' }, deps)
  assert.equal(out.blocked, true)
  assert.ok(out.text.length > 0)
  assert.ok(Array.isArray(out.buttons)) // crisis responses carry tap-to-call buttons
  assert.equal(replyCalls(), 0) // the model was not called on a block
})

test('an allowed turn calls the model once and returns the validated reply', async () => {
  const { deps, replyCalls } = baseDeps()
  // NB: a "how do I …" phrasing naming a lift now trips the deterministic exercise-detail backstop
  // (synthesizeExerciseDetailNav), which replaces the model text with a technique-guide nav reply.
  // This test verifies the plain passthrough of a validated model reply, so it asks a question that
  // isn't an exercise how-to; the backstop's own behaviour is covered in coach-exercise-nav.test.
  const out = await coachTurnCore('u1', { message: 'why does squat depth matter for progress?' }, deps)
  assert.equal(out.blocked, false)
  assert.equal(replyCalls(), 1)
  assert.match(out.text, /depth/i)
  assert.equal(out.mode, 'general')
})

test('malformed model output fails closed to the structured fallback', async () => {
  const { deps } = baseDeps({ generateReply: async () => 'not valid json' })
  const out = await coachTurnCore('u1', { message: 'explain progressive overload' }, deps)
  assert.equal(out.blocked, false)
  assert.match(out.text, /couldn.t put together a reliable answer/i)
  assert.deepEqual(out.citations, [])
})

test('unapproved citations are stripped from an otherwise valid answer', async () => {
  const { deps } = baseDeps({ generateReply: async () => JSON.stringify({
    mode: 'general', message: 'Progress gradually.', memory: null, proposal: { kind: 'none' },
    citations: [{ sourceKey: 'random_blog', title: 'Random Blog' }],
  }) })
  const out = await coachTurnCore('u1', { message: 'explain progressive overload' }, deps)
  assert.deepEqual(out.citations, [])
})

test('the server hard daily cap returns the limit response without calling the model', async () => {
  const { deps, replyCalls } = baseDeps({
    enforceLimit: async () => {
      throw new Error('resource-exhausted')
    },
  })
  const out = await coachTurnCore('u1', { message: 'quick form check please' }, deps)
  assert.equal(out.blocked, true)
  assert.ok(out.text.length > 0)
  assert.equal(replyCalls(), 0)
})

test('an empty message is rejected before any model/classifier call', async () => {
  const { deps, replyCalls } = baseDeps()
  await assert.rejects(() => coachTurnCore('u1', { message: '   ' }, deps), /Empty message/)
  assert.equal(replyCalls(), 0)
})

test('a classifier failure fails SAFE (blocks, model not called) rather than allowing', async () => {
  const { deps, replyCalls } = baseDeps({
    classify: async () => {
      throw new Error('model down')
    },
  })
  const out = await coachTurnCore('u1', { message: 'anything at all' }, deps)
  assert.equal(out.blocked, true) // service-unavailable, never a silent allow
  assert.equal(replyCalls(), 0)
})

/* ---------------- C-006: the SERVER is authoritative on action capability ---------------- */

const actionReplyDeps = (over = {}) => baseDeps({
  // The model emits a valid workout_action proposal every turn.
  generateReply: async () => JSON.stringify({
    mode: 'general', message: 'Let’s deload this week.', citations: [], memory: null,
    proposal: { kind: 'workout_action', title: 'Deload week', summary: 'Cut sets ~40%.', payload: { action: 'deload' } },
  }),
  saveProposal: async (_uid, p) => ({ ...p, id: 'prop1', status: 'pending', createdAt: '', expiresAt: '' }),
  ...over,
}).deps

test('C-006: a workout_action is SURFACED when the client opts in and the server permits actions', async () => {
  const deps = actionReplyDeps({ actionsDisabled: () => false })
  const out = await coachTurnCore('u1', { message: 'can you set up a deload week for me?', allowActions: true }, deps)
  assert.ok(out.proposal && out.proposal.kind === 'workout_action', 'action should be surfaced when permitted')
})

for (const [message, action] of [
  ['Start a quick workout for me now, I only have 15 minutes.', 'start_session'],
  ['Change my training days to Tuesday, Thursday and Saturday.', 'set_training_days'],
  ['Make my workouts fit into 30 minutes.', 'set_session_length'],
  ['Open Budget Eats for me.', 'open_budget_eats'],
  ['Change my goal to build muscle.', 'change_goal'],
  ['Put me in exam mode for the next two weeks.', 'exam_mode'],
  ['I missed today. Mark it as an exempt no-penalty rest day.', 'catch_up'],
  ['Reschedule my training to Monday, Wednesday and Friday.', 'reschedule_days'],
  ['I will be away from 20 August 2026 to 27 August 2026. Pause training completely for those dates.', 'planned_absence'],
]) {
  test(`deterministic action backstop surfaces ${action} when model emits prose only`, async () => {
    const deps = baseDeps({
      generateReply: async () => JSON.stringify({ mode: 'personalised', message: 'Want me to do that?', citations: [], memory: null, proposal: { kind: 'none' } }),
      saveProposal: async (_uid, p) => ({ ...p, id: 'prop1', status: 'pending', createdAt: '', expiresAt: '' }),
    }).deps
    const out = await coachTurnCore('u1', { message, allowActions: true }, deps)
    assert.equal(out.proposal?.kind, 'workout_action')
    assert.equal(out.proposal?.payload?.action, action)
    assert.match(out.text, /confirm/i)
  })
}

test('C-006: the server DOWNGRADES a workout_action when actioning is disabled server-side, even if the client sent allowActions=true', async () => {
  const deps = actionReplyDeps({ actionsDisabled: () => true })
  const out = await coachTurnCore('u1', { message: 'can you set up a deload week for me?', allowActions: true }, deps)
  assert.equal(out.proposal, null) // a modified/stale client cannot force an action through
})

/* ---- To-the-point day reschedule: name current days + ask once, no re-confirm loop ---- */

test('day reschedule with no days named: replies to the point, no proposal, asks which days once', async () => {
  // Model stalls with a re-confirm ("would you like to change your days?"); the backstop replaces it
  // with the single forward question instead of looping the user through extra messages.
  const { deps } = baseDeps({
    generateReply: async () => JSON.stringify({ mode: 'personalised', message: 'Would you like to change which days you train on?', citations: [], memory: null, proposal: { kind: 'none' } }),
  })
  const out = await coachTurnCore('u1', { message: 'can u change my training days', allowActions: true }, deps)
  assert.equal(out.proposal, null) // never a confirm card until they name days
  assert.match(out.text, /which days/i) // asks the one thing it needs
  assert.doesNotMatch(out.text, /would you like to change/i) // the redundant re-confirm is gone
})

test('day reschedule names the current training days when the schedule is in view', async () => {
  const { deps } = baseDeps()
  deps.loadTurnData = async () => ({
    context: { dateOfBirth: '2000-01-01', affectedRegions: [], screeningOutcome: null, engineExcludedExerciseIds: [], isAustralia: true },
    contextText: '', snapshot: { coachingStyle: 'balanced', goal: '', experience: '', units: 'metric', constraints: '', profile: '', canonicalProfile: '', program: '', recentTraining: '', trainingSummaries: '', activity: '', readiness: '', weights: '', nutrition: '', nutritionCheckins: '', memories: [] },
    recent: [], safetySession: newSafetySession(), memoryEnabled: false, coachingStyle: 'balanced',
    programExercises: [], trainingDays: ['Monday', 'Wednesday', 'Friday', 'Sunday'], validExerciseIds: new Set(),
  })
  const out = await coachTurnCore('u1', { message: 'can u change my training days', allowActions: true }, deps)
  assert.equal(out.proposal, null)
  assert.match(out.text, /Monday, Wednesday, Friday and Sunday/) // current days surfaced in the same reply
  assert.match(out.text, /which days/i)
})

test('day reschedule WITH days named still surfaces the confirm card (no regression)', async () => {
  const { deps } = baseDeps({
    generateReply: async () => JSON.stringify({ mode: 'personalised', message: 'Sure.', citations: [], memory: null, proposal: { kind: 'none' } }),
    saveProposal: async (_uid, p) => ({ ...p, id: 'prop1', status: 'pending', createdAt: '', expiresAt: '' }),
  })
  const out = await coachTurnCore('u1', { message: 'change my training days to Tuesday, Thursday and Saturday', allowActions: true }, deps)
  assert.equal(out.proposal?.kind, 'workout_action')
  assert.equal(out.proposal?.payload?.action, 'set_training_days')
})

test('joinWeekdays / dayRescheduleAsk build a dash-free, canonically ordered reply', async () => {
  const { joinWeekdays, dayRescheduleAsk, DAY_RESCHEDULE_LINE } = await import('../lib/_shared/backend/coach/workoutActions.js')
  assert.equal(joinWeekdays(['Friday', 'Monday']), 'Monday and Friday') // reordered Mon..Sun
  assert.equal(joinWeekdays(['Wednesday']), 'Wednesday')
  assert.equal(joinWeekdays([]), '')
  const ask = dayRescheduleAsk(['Monday', 'Wednesday', 'Friday'])
  assert.match(ask, /Monday, Wednesday and Friday/)
  assert.match(ask, /which days/i)
  assert.doesNotMatch(ask, /[—–]/) // no em or en dash
  assert.equal(dayRescheduleAsk([]), DAY_RESCHEDULE_LINE) // graceful fallback when schedule not in view
})

/* ---- Single-day move: "change monday to saturday" becomes a confirm-gated set_training_days ---- */

const dayMoveDeps = (trainingDays) => {
  const { deps } = baseDeps({
    generateReply: async () => JSON.stringify({ mode: 'personalised', message: 'Sure.', citations: [], memory: null, proposal: { kind: 'none' } }),
    saveProposal: async (_uid, p) => ({ ...p, id: 'prop1', status: 'pending', createdAt: '', expiresAt: '' }),
  })
  deps.loadTurnData = async () => ({
    context: { dateOfBirth: '2000-01-01', affectedRegions: [], screeningOutcome: null, engineExcludedExerciseIds: [], isAustralia: true },
    contextText: '', snapshot: { coachingStyle: 'balanced', goal: '', experience: '', units: 'metric', constraints: '', profile: '', canonicalProfile: '', program: '', recentTraining: '', trainingSummaries: '', activity: '', readiness: '', weights: '', nutrition: '', nutritionCheckins: '', memories: [] },
    recent: [], safetySession: newSafetySession(), memoryEnabled: false, coachingStyle: 'balanced',
    programExercises: [], trainingDays, validExerciseIds: new Set(),
  })
  return deps
}

test('day move: "change monday to saturday" proposes the moved full week', async () => {
  const deps = dayMoveDeps(['Monday', 'Wednesday', 'Friday', 'Sunday'])
  const out = await coachTurnCore('u1', { message: 'change monday to saturday', allowActions: true }, deps)
  assert.equal(out.proposal?.kind, 'workout_action')
  assert.equal(out.proposal?.payload?.action, 'set_training_days')
  assert.equal(out.proposal?.payload?.days, 'Wednesday,Friday,Saturday,Sunday') // Monday removed, Saturday added, canonical order
  assert.match(out.text, /move your Monday training to Saturday/i)
  assert.doesNotMatch(out.text, /[—–]/)
})

test('day move is ambiguous when the target day is already trained: no proposal', async () => {
  // Sunday already trained, so "move monday to sunday" is left for the coach to clarify, not auto-applied.
  const deps = dayMoveDeps(['Monday', 'Wednesday', 'Friday', 'Sunday'])
  const out = await coachTurnCore('u1', { message: 'change monday to sunday', allowActions: true }, deps)
  assert.notEqual(out.proposal?.payload?.action, 'set_training_days')
})

test('synthesizeDayMoveProposal is null without a known schedule or a real from-day', async () => {
  const { synthesizeDayMoveProposal } = await import('../lib/_shared/backend/coach/workoutActions.js')
  assert.equal(synthesizeDayMoveProposal('change monday to saturday', []), null) // no schedule in view
  assert.equal(synthesizeDayMoveProposal('change tuesday to saturday', ['Monday', 'Wednesday', 'Friday', 'Sunday']), null) // Tuesday not a training day
  const ok = synthesizeDayMoveProposal('move my monday to saturday', ['Monday', 'Wednesday', 'Friday', 'Sunday'])
  assert.equal(ok?.payload?.days, 'Wednesday,Friday,Saturday,Sunday')
  assert.doesNotMatch(ok.message, /[—–]/)
})

/* ---- Schedule grounding: correct a false premise from the REAL program, do not play along ---- */

const SCHEDULE = [
  { weekday: 'Monday', dayType: 'Legs', exercises: ['Barbell Back Squat', 'Romanian Deadlift', 'Leg Press'], muscles: ['Quads', 'Hamstrings & Glutes', 'Calves'] },
  { weekday: 'Wednesday', dayType: 'Pull', exercises: ['Barbell Bent Over Row', 'Lat Pulldown', 'Barbell Curl'], muscles: ['Back', 'Biceps'] },
  { weekday: 'Friday', dayType: 'Push', exercises: ['Barbell Bench Press', 'Overhead Press', 'Cable Chest Fly'], muscles: ['Chest', 'Shoulders', 'Triceps'] },
  { weekday: 'Sunday', dayType: 'Upper', exercises: ['Barbell Bench Press', 'Bent Over Row'], muscles: ['Chest', 'Back', 'Shoulders'] },
]

const scheduleDeps = (over = {}) => {
  const { deps } = baseDeps({
    generateReply: async () => JSON.stringify({ mode: 'personalised', message: over.modelText ?? 'Sure thing.', citations: [], memory: null, proposal: over.modelProposal ?? { kind: 'none' } }),
    saveProposal: async (_uid, p) => ({ ...p, id: 'prop1', status: 'pending', createdAt: '', expiresAt: '' }),
  })
  deps.loadTurnData = async () => ({
    context: { dateOfBirth: '2000-01-01', affectedRegions: [], screeningOutcome: null, engineExcludedExerciseIds: [], isAustralia: true },
    contextText: '', snapshot: { coachingStyle: 'balanced', goal: '', experience: '', units: 'metric', constraints: '', profile: '', canonicalProfile: '', program: '', recentTraining: '', trainingSummaries: '', activity: '', readiness: '', weights: '', nutrition: '', nutritionCheckins: '', memories: [] },
    recent: [], safetySession: newSafetySession(), memoryEnabled: false, coachingStyle: 'balanced',
    programExercises: [], trainingDays: ['Monday', 'Wednesday', 'Friday', 'Sunday'],
    programSchedule: SCHEDULE, todayWeekday: over.today ?? 'Friday', validExerciseIds: new Set(),
  })
  return deps
}

test('grounding: "why the rest day today" is CORRECTED, today is a training day (no fabrication)', async () => {
  const deps = scheduleDeps({ today: 'Friday', modelText: 'Today is a rest day because you have trained enough.' })
  const out = await coachTurnCore('u1', { message: 'why did you give me a rest day today', allowActions: true }, deps)
  assert.match(out.text, /not a rest day/i)
  assert.match(out.text, /Push day/i)
  assert.equal(out.proposal, null)
})

test('grounding: "I dont like chest on monday" is CORRECTED (Monday is Legs), no swap proposal', async () => {
  const deps = scheduleDeps({ today: 'Friday', modelProposal: { kind: 'workout_action', title: 'Swap', summary: 'x', payload: { action: 'swap', fromExerciseId: 'CH06', reason: 'dislike' } } })
  const out = await coachTurnCore('u1', { message: 'i dont like training chest on monday', allowActions: true }, deps)
  assert.match(out.text, /do not train chest on Monday/i)
  assert.match(out.text, /Legs day/i)
  assert.equal(out.proposal, null) // must NOT be sucked into swapping a chest lift on a legs day
})

test('grounding: "I dont like gymming on monday" grounds the day and offers a move, invents no target', async () => {
  const deps = scheduleDeps({ today: 'Friday' })
  const out = await coachTurnCore('u1', { message: 'i dont like gymming on monday', allowActions: true }, deps)
  assert.match(out.text, /Monday is your Legs day/i)
  assert.match(out.text, /which day/i)
  assert.doesNotMatch(out.text, /saturday/i) // no invented target day
  assert.equal(out.proposal, null)
})

test('phantom confirm-card guard: parroted "Tap confirm" with no proposal is replaced', async () => {
  const deps = scheduleDeps({ today: 'Tuesday', modelText: "Want me to move your Monday training to Saturday? Tap confirm and I'll update the schedule." })
  // Tuesday is a rest day and the message is unrelated to schedule, so grounding does not fire; the
  // phantom guard must catch the parroted confirm prose that has no proposal behind it.
  const out = await coachTurnCore('u1', { message: 'sounds good', allowActions: true }, deps)
  assert.doesNotMatch(out.text, /tap confirm/i)
  assert.equal(out.proposal, null)
})

/* ---- Richer memory: reliably capture durable setup facts the model misses ---- */

test('memory: "I train at home" is captured deterministically when the model misses it', async () => {
  let saved = null
  const { deps } = baseDeps({ generateReply: async () => JSON.stringify({ mode: 'general', message: 'Got it.', citations: [], memory: null, proposal: { kind: 'none' } }) })
  deps.loadTurnData = async () => ({
    context: { dateOfBirth: '2000-01-01', affectedRegions: [], screeningOutcome: null, engineExcludedExerciseIds: [], isAustralia: true },
    contextText: '', snapshot: { coachingStyle: 'balanced', goal: '', experience: '', units: 'metric', constraints: '', profile: '', canonicalProfile: '', program: '', recentTraining: '', trainingSummaries: '', activity: '', readiness: '', weights: '', nutrition: '', nutritionCheckins: '', memories: [] },
    recent: [], safetySession: newSafetySession(), memoryEnabled: true, coachingStyle: 'balanced',
    programExercises: [], trainingDays: [], programSchedule: [], todayWeekday: 'Monday', validExerciseIds: new Set(),
  })
  deps.saveMemory = async (_uid, _msg, candidate) => { saved = candidate; return { ...candidate, id: 'm1', status: 'confirmed', confidence: 1, source: 'user_statement', evidenceRef: '', visible: true, createdAt: '', updatedAt: '' } }
  const out = await coachTurnCore('u1', { message: 'i train at home now', allowActions: true }, deps)
  assert.equal(out.blocked, false)
  assert.equal(saved?.value, 'Trains at home')
  assert.equal(saved?.category, 'Training location')
})

test('memory: nothing is captured when memory is OFF (consent gate honoured)', async () => {
  let called = false
  const { deps } = baseDeps()
  deps.loadTurnData = async () => ({
    context: { dateOfBirth: '2000-01-01', affectedRegions: [], screeningOutcome: null, engineExcludedExerciseIds: [], isAustralia: true },
    contextText: '', snapshot: { coachingStyle: 'balanced', goal: '', experience: '', units: 'metric', constraints: '', profile: '', canonicalProfile: '', program: '', recentTraining: '', trainingSummaries: '', activity: '', readiness: '', weights: '', nutrition: '', nutritionCheckins: '', memories: [] },
    recent: [], safetySession: newSafetySession(), memoryEnabled: false, coachingStyle: 'balanced',
    programExercises: [], trainingDays: [], programSchedule: [], todayWeekday: 'Monday', validExerciseIds: new Set(),
  })
  deps.saveMemory = async () => { called = true; return null }
  await coachTurnCore('u1', { message: 'i only have dumbbells', allowActions: true }, deps)
  assert.equal(called, false)
})

test('synthesizeMemoryFromMessage: high-precision, no false positives', async () => {
  const { synthesizeMemoryFromMessage } = await import('../lib/_shared/backend/coach/workoutActions.js')
  assert.equal(synthesizeMemoryFromMessage('i train at home')?.value, 'Trains at home')
  assert.equal(synthesizeMemoryFromMessage('i only have dumbbells and a bench')?.value, 'Only has dumbbells, bench')
  assert.equal(synthesizeMemoryFromMessage('i dont have a barbell')?.value, 'Does not have a barbell')
  assert.equal(synthesizeMemoryFromMessage('i only have 20 minutes today'), null)
  assert.equal(synthesizeMemoryFromMessage('how do i squat'), null)
  assert.equal(synthesizeMemoryFromMessage('i hate mondays'), null)
  const cand = synthesizeMemoryFromMessage('i train at home')
  // evidenceQuote must be an exact slice of the message (the save path re-checks this).
  assert.ok('i train at home'.includes(cand.evidenceQuote))
})

test('synthesizeScheduleGroundedReply: grounded, dash-free, defers moves and non-schedule turns', async () => {
  const { synthesizeScheduleGroundedReply } = await import('../lib/_shared/backend/coach/workoutActions.js')
  assert.match(synthesizeScheduleGroundedReply('i dont like training chest on monday', SCHEDULE, 'Friday'), /do not train chest on Monday.*Legs day/i)
  assert.match(synthesizeScheduleGroundedReply('why the rest day today', SCHEDULE, 'Friday'), /not a rest day.*Push/i)
  assert.match(synthesizeScheduleGroundedReply('do i train chest on friday', SCHEDULE, 'Friday'), /trains chest/i)
  assert.match(synthesizeScheduleGroundedReply('is saturday a rest day', SCHEDULE, 'Friday'), /rest day/i)
  assert.equal(synthesizeScheduleGroundedReply('change monday to saturday', SCHEDULE, 'Friday'), null) // a move, not a fact
  assert.equal(synthesizeScheduleGroundedReply('how do i squat', SCHEDULE, 'Friday'), null) // not a schedule question
  assert.equal(synthesizeScheduleGroundedReply('anything', [], 'Friday'), null) // no schedule in view
  assert.doesNotMatch(synthesizeScheduleGroundedReply('i dont like gymming on monday', SCHEDULE, 'Friday'), /[—–]/)
})

test('U-003: a cold-start action switch that resolves DISABLED after being read blocks the action (fail-closed freshness)', async () => {
  // Simulate the real makeRemoteKillSwitch cold start: engaged() would return a stale false, but the
  // awaited engagedFresh(true) resolves the true value before the action gate decides.
  let resolvedDisabled = false
  const deps = actionReplyDeps({
    actionsDisabledFresh: async () => { resolvedDisabled = true; return true }, // fresh read says disabled
  })
  const out = await coachTurnCore('u1', { message: 'can you set up a deload week for me?', allowActions: true }, deps)
  assert.equal(resolvedDisabled, true)
  assert.equal(out.proposal, null) // no stale-false fail-open on cold start
})

// R5-010 — the coach names the correct LOCAL day on the FIRST turn after a timezone change by
// trusting the validated per-turn timezone the client sends, instead of the lagging stored setting.
test('R5-010: the per-turn timezone is threaded to loadTurnData', async () => {
  const { deps } = baseDeps()
  let captured = 'UNSET'
  deps.loadTurnData = async (_uid, opts) => {
    captured = opts?.requestTimezone
    throw new Error('stop-after-capture') // short-circuit; we only assert the plumbing here
  }
  await assert.rejects(
    () => coachTurnCore('u1', { message: 'what should I train today?', timezone: 'Australia/Perth' }, deps),
    /stop-after-capture/,
  )
  assert.equal(captured, 'Australia/Perth')
})

test('R5-010: isValidTimezone accepts real IANA zones and rejects junk', async () => {
  const { isValidTimezone } = await import('../lib/coachWorkspace.js')
  assert.equal(isValidTimezone('Australia/Perth'), true)
  assert.equal(isValidTimezone('America/New_York'), true)
  assert.equal(isValidTimezone('UTC'), true)
  assert.equal(isValidTimezone('Not/AZone'), false)
  assert.equal(isValidTimezone(''), false)
  assert.equal(isValidTimezone(undefined), false)
  assert.equal(isValidTimezone(123), false)
})
