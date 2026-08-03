/**
 * Coach action resolver (Coach Capability Plan) — the bridge that turns a CONFIRMED
 * `workout_action` proposal into an actual program change through the deterministic engine.
 *
 * Governing principle: the coach PROPOSES; this resolver hands the request to the engine,
 * which PERFORMS it and RE-CLAMPS it against the Safety Rules. This module never synthesizes
 * a set / rep / load / RIR / exercise itself — it only calls engine functions
 * (`swapExercise`, `activateProgram`, `adjustProgram`, …) and projects their already-clamped
 * output through the SAME projectors generation uses (`activate.ts`), so a coach-driven
 * change is indistinguishable from a generated one.
 *
 * PURE: no firebase, no dispatch, no navigation. The caller (overlays/extra.tsx) owns the
 * store dispatch, persistence, undo snapshot and any navigation/confirm UX. Deterministic
 * given `now`. This module is NOT part of the coach-safety sync closure — it stays app-side.
 */

import type { UserDoc, ProgramDoc, WorkoutInstanceDoc, Weekday, AbsenceMode } from '../schema'
import {
  activateProgram,
  projectProgram,
  storedExerciseFromPrescription,
  prescribedExerciseFromPrescription,
  type StoredProgram,
  type StoredDay,
  type ProgramStatus,
} from './activate'
import { contextForUser, generateProgram } from '../generator/generate'
import { swapCandidates, requestSpecific, type SwapResult, type SwapReason } from '../generator/swaps'
import { adjustProgram, DELOAD } from '../generator/deload'
import { changeGoal } from '../generator/goalChange'
import { EXERCISE_BY_ID } from '../data/index'
import { validateWorkoutActionPayload, SWAP_REASONS, type NudgeKindLit } from '../coach/workoutActions'

/** The slice of app state the resolver reads. */
export interface CoachActionState {
  backendUser: UserDoc
  program: StoredProgram | null
  instances: WorkoutInstanceDoc[]
  /** Current program's canonical doc — read for its version on a goal change (GC09). */
  programDoc?: ProgramDoc | null
}

/** One offered alternative in a multi-option swap (the user picks which to apply). */
export interface SwapOption {
  id: string
  name: string
  muscleGroup: string
}

export type CoachActionOutcome =
  | { ok: false; reason: string; message: string }
  /** Full regeneration (goal / days / session length / deload): replace program + user. */
  | { ok: true; apply: 'regen'; nextUser: UserDoc; program: StoredProgram; status: ProgramStatus; programDoc: ProgramDoc; instances: WorkoutInstanceDoc[]; message: string }
  /** Surgical single-exercise swap: program projection + instances patched, no regen. */
  | { ok: true; apply: 'patch'; nextUser: UserDoc; program: StoredProgram; instances: WorkoutInstanceDoc[]; message: string }
  /** Two or more eligible alternatives — the user chooses, then applyCoachSwapChoice applies it. */
  | { ok: true; apply: 'choose_swap'; fromExerciseId: string; reason: string; options: SwapOption[]; message: string }
  /** Declare a busy period / exam mode — the UI creates the PlannedPeriod and saves it. */
  | { ok: true; apply: 'period'; mode: AbsenceMode; startDate: string; endDate: string; label: string; message: string }
  /** Navigation-only action (start a session, open Budget Eats). */
  | { ok: true; apply: 'navigate'; target: 'activeWorkout' | 'quickWorkout' | 'budgetEats'; message: string }
  /** A gentle nudge to log a habit — the UI opens the relevant logger. */
  | { ok: true; apply: 'nudge'; kind: NudgeKindLit; message: string }
  /** OUTWARD: draft a PR post — the UI grounds it in a real logged PR and requires a
   *  SECOND explicit confirm before anything is published. */
  | { ok: true; apply: 'share_pr'; message: string }

const dedupe = (ids: string[]): string[] => Array.from(new Set(ids))

const NUDGE_COPY: Record<NudgeKindLit, string> = {
  water: 'Quick one — log your water so we can keep an eye on hydration.',
  sleep: 'Worth logging last night’s sleep — it feeds straight into your recovery.',
  steps: 'Log today’s steps so your activity picture stays complete.',
  nutrition: 'Jot down what you ate today — even a rough log helps.',
  weight: 'Pop today’s weigh-in in so the trend stays accurate.',
}

/** Recompute the tracked weekly-set totals after a swap (mirrors adjustProgram / generator). */
function recomputeWeeklySets(days: StoredDay[], prev: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const m of Object.keys(prev)) {
    out[m] = days.reduce((n, d) => n + d.exercises.filter((e) => e.muscleGroup === m).reduce((a, e) => a + e.sets, 0), 0)
  }
  return out
}

const programContains = (program: StoredProgram, exerciseId: string): boolean =>
  program.days.some((d) => d.exercises.some((e) => e.exerciseId === exerciseId))

/** Every exercise id currently in the program except `keep` — used to avoid swapping into a dupe. */
function otherProgramIds(program: StoredProgram, keep: string): Set<string> {
  const ids = new Set<string>()
  for (const d of program.days) for (const e of d.exercises) if (e.exerciseId !== keep) ids.add(e.exerciseId)
  return ids
}

/** Apply a resolved (clamped) SwapResult to the program projection + instance templates. */
function applySwap(state: CoachActionState, swap: SwapResult): CoachActionOutcome {
  if (!state.program) return { ok: false, reason: 'no_program', message: "You don't have an active program to change yet." }
  const fromId = swap.fromId
  let found = false
  const days = state.program.days.map((d) => ({
    ...d,
    exercises: d.exercises.map((e) => {
      if (e.exerciseId !== fromId) return e
      found = true
      return storedExerciseFromPrescription(swap.prescribed)
    }),
  }))
  if (!found) return { ok: false, reason: 'not_in_program', message: "That lift isn't in your current program, so there's nothing to swap." }

  const instances = state.instances.map((inst) => ({
    ...inst,
    exercises: inst.exercises.map((pe) =>
      pe.exercise_id === fromId ? prescribedExerciseFromPrescription(pe.slot_id, swap.prescribed, fromId) : pe,
    ),
  }))
  const program: StoredProgram = { ...state.program, days, weeklySetsByMuscle: recomputeWeeklySets(days, state.program.weeklySetsByMuscle) }
  const nextUser: UserDoc = swap.excludeOriginal
    ? { ...state.backendUser, excluded_exercise_ids: dedupe([...state.backendUser.excluded_exercise_ids, fromId]) }
    : state.backendUser
  return { ok: true, apply: 'patch', nextUser, program, instances, message: swap.note }
}

/**
 * Apply the alternative the user CHOSE from a `choose_swap` outcome. Re-derives the option
 * from the engine (so it is re-clamped and provably one it offered) honouring the original
 * reason's excludeOriginal, then patches the program. Never trusts a bare id from the client.
 */
export function applyCoachSwapChoice(
  state: CoachActionState,
  fromExerciseId: string,
  reason: string,
  toExerciseId: string,
): CoachActionOutcome {
  if (!state.program) return { ok: false, reason: 'no_program', message: "You don't have an active program to change yet." }
  if (!(SWAP_REASONS as readonly string[]).includes(reason)) return { ok: false, reason: 'bad_reason', message: "I couldn't apply that swap." }
  const ctx = contextForUser(state.backendUser)
  // Re-derive the full candidate list and pick the chosen one — guarantees it is genuinely
  // eligible + safety-clamped, not an arbitrary id.
  const candidates = swapCandidates(fromExerciseId, reason as SwapReason, ctx, otherProgramIds(state.program, fromExerciseId), 8)
  const chosen = candidates.find((c) => c.toId === toExerciseId)
  if (!chosen) return { ok: false, reason: 'invalid_choice', message: "That option isn't available anymore — try the swap again." }
  return applySwap(state, chosen)
}

function regen(nextUser: UserDoc, now: string, message: string): CoachActionOutcome {
  // The SAME gate + generator + safety clamp as onboarding — no rule is relaxed for a
  // coach-driven change. A closed gate (e.g. a goal change that needs re-screening) yields
  // no program: we refuse rather than apply a hold state silently.
  const res = activateProgram(nextUser, now)
  if (!res.status.ok || !res.program || !res.programDoc) {
    return {
      ok: false,
      reason: res.status.reason ?? 'generation_blocked',
      message: 'That change needs a quick health re-check before I can apply it — open your Training profile to finish it.',
    }
  }
  return { ok: true, apply: 'regen', nextUser, program: res.program, status: res.status, programDoc: res.programDoc, instances: res.instances, message }
}

/**
 * Resolve a confirmed workout_action payload into an engine-performed outcome. Re-validates
 * the payload (defence in depth — the caller should only pass a schema-validated payload).
 */
export function resolveCoachAction(
  state: CoachActionState,
  payload: Record<string, string | number | boolean>,
  now: string = new Date().toISOString(),
): CoachActionOutcome {
  const v = validateWorkoutActionPayload(payload)
  if (!v.ok) return { ok: false, reason: `invalid:${v.reason}`, message: "I couldn't apply that change safely, so I've left your plan as it is." }
  const action = v.action

  switch (action.action) {
    case 'swap': {
      if (!state.program) return { ok: false, reason: 'no_program', message: "You don't have an active program to change yet." }
      if (!programContains(state.program, action.fromExerciseId)) {
        return { ok: false, reason: 'not_in_program', message: "That lift isn't in your current program, so there's nothing to swap." }
      }
      const ctx = contextForUser(state.backendUser)

      // A user-named specific lift: no choice, place it directly (SW07).
      if (action.reason === 'specific' && action.wantedExerciseId) {
        const raw = requestSpecific(action.fromExerciseId, action.wantedExerciseId, ctx)
        if ('ok' in raw && raw.ok === false) {
          return { ok: false, reason: 'no_eligible_swap', message: "I couldn't place that lift with your equipment and level — want me to suggest an alternative instead?" }
        }
        return applySwap(state, raw as SwapResult)
      }

      // Offer up to two alternatives (excluding lifts already in the program) so the user
      // can choose. One → apply it; none → refuse rather than invent.
      const options = swapCandidates(action.fromExerciseId, action.reason, ctx, otherProgramIds(state.program, action.fromExerciseId), 2)
      if (options.length === 0) {
        return { ok: false, reason: 'no_eligible_swap', message: "I couldn't find a safe alternative for that lift with your equipment and level — happy to suggest something you could add instead." }
      }
      if (options.length === 1) return applySwap(state, options[0])
      const fromName = EXERCISE_BY_ID[action.fromExerciseId]?.name ?? 'that lift'
      return {
        ok: true, apply: 'choose_swap', fromExerciseId: action.fromExerciseId, reason: action.reason,
        options: options.map((o) => ({ id: o.toId, name: o.toName, muscleGroup: EXERCISE_BY_ID[o.toId]?.muscleGroup ?? '' })),
        message: `Two options to replace ${fromName} — pick the one you'd rather do:`,
      }
    }

    case 'change_goal': {
      if (action.newGoal === state.backendUser.goal) {
        return { ok: false, reason: 'no_change', message: `You're already training for ${action.newGoal}.` }
      }
      // Use the dedicated Goal Change engine (GC01–GC09): re-selects split, re-budgets volume,
      // re-prescribes (re-clamped), preserves logged loads, and versions the program.
      const result = changeGoal(state.backendUser, action.newGoal, state.programDoc?.version ?? 1)
      if (!('ok' in result) || result.ok !== true) {
        return { ok: false, reason: (result as { reason: string }).reason, message: 'That change needs a quick health re-check before I can apply it — open your Training profile to finish it.' }
      }
      const nextUser: UserDoc = { ...state.backendUser, goal: action.newGoal }
      const projected = projectProgram(nextUser.uid, now, result.program, result.version)
      return {
        ok: true, apply: 'regen', nextUser,
        program: projected.program, status: { ok: true, reason: null }, programDoc: projected.programDoc, instances: projected.instances,
        message: `Switched your goal to ${action.newGoal} and rebuilt your plan around it — your logged loads carry over. Take the first week one notch easier so the change doesn't spike your intensity.`,
      }
    }

    case 'set_training_days': {
      return regen({ ...state.backendUser, days_available: action.days as Weekday[] }, now, `Updated your training days to ${action.days.join(', ')} and rebuilt the week around them.`)
    }

    case 'set_session_length': {
      return regen({ ...state.backendUser, session_length_min: action.sessionLengthMin }, now, `Set your sessions to ${action.sessionLengthMin} minutes and rebuilt your plan to fit.`)
    }

    case 'deload': {
      const gen = generateProgram(state.backendUser)
      if (!gen.ok) return { ok: false, reason: `gen_${gen.reason}`, message: "I couldn't prepare a deload just now." }
      const deloaded = adjustProgram(gen.program, DELOAD, 'COACH_DELOAD')
      const projected = projectProgram(state.backendUser.uid, now, deloaded)
      return {
        ok: true, apply: 'regen', nextUser: state.backendUser,
        program: projected.program, status: { ok: true, reason: null }, programDoc: projected.programDoc, instances: projected.instances,
        message: 'Set up a deload week — sets cut back about 40% and intensity eased a notch, with your working loads held, not lost.',
      }
    }

    case 'start_session': {
      return action.variant === 'quick15'
        ? { ok: true, apply: 'navigate', target: 'quickWorkout', message: "Starting a 15-minute quick session — let's move." }
        : { ok: true, apply: 'navigate', target: 'activeWorkout', message: "Let's get today's session going." }
    }

    case 'open_budget_eats': {
      return { ok: true, apply: 'navigate', target: 'budgetEats', message: 'Opening Budget Eats so you can find something that fits.' }
    }

    case 'nudge_log': {
      return { ok: true, apply: 'nudge', kind: action.kind, message: NUDGE_COPY[action.kind] }
    }

    case 'planned_absence': {
      return {
        ok: true, apply: 'period', mode: action.mode, startDate: action.startDate, endDate: action.endDate,
        label: 'Time off',
        message: `Marked ${action.startDate} to ${action.endDate} as planned time off — those days won't count as missed.`,
      }
    }

    case 'exam_mode': {
      // Exam mode = a maintenance period (two easier full-body sessions/week, no penalty).
      return {
        ok: true, apply: 'period', mode: 'maintenance', startDate: action.startDate, endDate: action.endDate,
        label: 'Exam period',
        message: `Exam mode is on from ${action.startDate} to ${action.endDate} — two easier full-body sessions a week, and no penalty for the days you rest.`,
      }
    }

    case 'share_pr': {
      // OUTWARD: only signal intent here. The UI grounds the post in the user's REAL most
      // recent PR (never an invented one) and takes a second explicit confirm before publishing.
      return { ok: true, apply: 'share_pr', message: "Let's get your latest PR ready to share." }
    }

    case 'reschedule_days': {
      // CC01 — re-place the week onto different days; progression is preserved (regen keeps history).
      return regen({ ...state.backendUser, days_available: action.days as Weekday[] }, now, `Rescheduled your training days to ${action.days.join(', ')} and re-placed the week — your progress carries over.`)
    }

    case 'catch_up': {
      // The store has no session-shift primitive, so 'exempt' (the SCH10 effect) is the part we
      // can genuinely action — declare today a no-penalty rest day. The scheduling modes
      // (shift/fold/replan) need a session rescheduler the app doesn't have; decline honestly
      // with the real alternatives instead of pretending.
      if (action.mode === 'exempt') {
        const day = now.slice(0, 10)
        return {
          ok: true, apply: 'period', mode: 'no_change', startDate: day, endDate: day,
          label: 'Rest day',
          message: "Marked today as planned rest — it won't count as a missed session.",
        }
      }
      return {
        ok: false, reason: 'catch_up_unsupported',
        message: "I can't auto-shift or fold sessions yet — but I can mark a day as planned rest so it doesn't count against you, or move your training days. Want either of those?",
      }
    }
  }
}
