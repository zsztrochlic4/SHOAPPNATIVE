/**
 * Bounded schema for the coach's `workout_action` proposal (Coach Capability Plan).
 *
 * The coach PROPOSES a workout/program change; the deterministic engine PERFORMS and
 * re-clamps it against the Safety Rules (see src/backend/runtime/coachActionResolver.ts).
 * This module is the SCHEMA GATE every proposed action must pass before the resolver may
 * touch it — the same rigour `structuredResponse.ts` applies to the rest of the reply.
 *
 * DELIBERATELY DEPENDENCY-FREE. This file must import nothing from firebase OR the
 * generator/engine, so that `functions/scripts/sync-shared.mjs` can copy it into the
 * trusted backend without dragging the engine (or a firebase-client import) along. The
 * value domains below are therefore declared as LOCAL literal arrays that MIRROR the
 * canonical engine enums; a non-synced compile-time test (test/*) asserts they stay
 * type-equal to `SwapReason` / `BackendGoal` / `Weekday` / `AbsenceMode` so they can
 * never silently drift.
 *
 * The coach proposal payload is a flat `Record<string, string | number | boolean>`
 * (see contracts.ts) — it CANNOT carry arrays or nested objects. List params (training
 * days) are therefore encoded as a comma-separated string and re-validated token by token.
 */

/* ------------------------------------------------------------------ */
/*  Value domains — MIRROR the engine enums (kept in sync by test)     */
/* ------------------------------------------------------------------ */

/** MIRRORS `SwapReason` in src/backend/generator/swaps.ts. */
export const SWAP_REASONS = ['dislike', 'pain', 'equipment', 'too_hard', 'too_easy', 'specific', 'variety'] as const
export type SwapReasonLit = (typeof SWAP_REASONS)[number]

/** MIRRORS `BackendGoal` in src/backend/schema.ts. */
export const BACKEND_GOALS = ['Hypertrophy', 'Fat Loss', 'Strength', 'General Fitness'] as const
export type BackendGoalLit = (typeof BACKEND_GOALS)[number]

/** MIRRORS `Weekday` in src/backend/schema.ts. */
export const WEEKDAY_LITS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const
export type WeekdayLit = (typeof WEEKDAY_LITS)[number]

/** MIRRORS `AbsenceMode` in src/backend/schema.ts. */
export const ABSENCE_MODES = ['full_pause', 'maintenance', 'minimal_movement', 'reduced_frequency', 'active_rest', 'no_change'] as const
export type AbsenceModeLit = (typeof ABSENCE_MODES)[number]

/** MIRRORS `MissAction` in src/backend/generator/adapt.ts. */
export const CATCH_UP_MODES = ['exempt', 'shift_forward', 'fold_into_next', 'replan'] as const
export type CatchUpModeLit = (typeof CATCH_UP_MODES)[number]

/** Session lengths offered in the training-profile editor (src/overlays/trainingProfile.tsx). */
export const SESSION_LENGTHS = [30, 45, 60, 75, 90] as const

/** Habit loggers the coach may nudge the user toward. */
export const NUDGE_KINDS = ['water', 'sleep', 'steps', 'nutrition', 'weight'] as const
export type NudgeKindLit = (typeof NUDGE_KINDS)[number]

export const START_VARIANTS = ['full', 'quick15'] as const
export type StartVariantLit = (typeof START_VARIANTS)[number]

/* ------------------------------------------------------------------ */
/*  The parsed, validated action (what the resolver consumes)          */
/* ------------------------------------------------------------------ */

export type WorkoutAction =
  | { action: 'swap'; fromExerciseId: string; reason: SwapReasonLit; wantedExerciseId?: string }
  | { action: 'change_goal'; newGoal: BackendGoalLit }
  | { action: 'set_training_days'; days: WeekdayLit[] }
  | { action: 'set_session_length'; sessionLengthMin: number }
  | { action: 'deload' }
  | { action: 'catch_up'; mode: CatchUpModeLit }
  | { action: 'reschedule_days'; days: WeekdayLit[] }
  | { action: 'planned_absence'; mode: AbsenceModeLit; startDate: string; endDate: string }
  | { action: 'exam_mode'; startDate: string; endDate: string }
  | { action: 'start_session'; variant: StartVariantLit }
  | { action: 'open_budget_eats'; recipeId?: string }
  | { action: 'nudge_log'; kind: NudgeKindLit }
  | { action: 'share_pr'; prExerciseId: string; prValue: number }

export type WorkoutActionName = WorkoutAction['action']

/** Every action name the schema accepts. Mirrored in the system prompt allowlist. */
export const WORKOUT_ACTION_NAMES: readonly WorkoutActionName[] = [
  'swap', 'change_goal', 'set_training_days', 'set_session_length', 'deload',
  'catch_up', 'reschedule_days', 'planned_absence', 'exam_mode', 'start_session',
  'open_budget_eats', 'nudge_log', 'share_pr',
] as const

export type WorkoutActionValidation =
  | { ok: true; action: WorkoutAction }
  | { ok: false; reason: string }

/* ------------------------------------------------------------------ */
/*  Validation                                                         */
/* ------------------------------------------------------------------ */

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

const fail = (reason: string): WorkoutActionValidation => ({ ok: false, reason })

function asString(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}
function inSet<T extends string>(v: unknown, set: readonly T[]): T | null {
  return typeof v === 'string' && (set as readonly string[]).includes(v) ? (v as T) : null
}
/** Parse a comma-separated Weekday list; reject empties, dupes and any unknown token. */
function parseDays(v: unknown): WeekdayLit[] | null {
  if (typeof v !== 'string' || v.trim().length === 0) return null
  const tokens = v.split(',').map((t) => t.trim())
  const out: WeekdayLit[] = []
  for (const t of tokens) {
    const day = inSet(t, WEEKDAY_LITS)
    if (!day || out.includes(day)) return null
    out.push(day)
  }
  return out.length > 0 ? out : null
}

/** Reject any key not in the allowed set for this action (tight surface, no smuggling). */
function onlyKeys(payload: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(payload).every((k) => allowed.includes(k))
}

/**
 * Validate a `workout_action` proposal payload against the bounded per-action schema.
 * Runs AFTER the generic ≤12-key / key-regex / scalar-value check in structuredResponse.ts.
 * Returns a parsed `WorkoutAction` or a rejection reason (→ safe fallback upstream).
 */
export function validateWorkoutActionPayload(payload: Record<string, string | number | boolean>): WorkoutActionValidation {
  const action = inSet(payload.action, WORKOUT_ACTION_NAMES)
  if (!action) return fail('unknown_action')

  switch (action) {
    case 'swap': {
      if (!onlyKeys(payload, ['action', 'fromExerciseId', 'reason', 'wantedExerciseId'])) return fail('swap_extra_keys')
      const fromExerciseId = asString(payload.fromExerciseId)
      if (!fromExerciseId || !SAFE_ID.test(fromExerciseId)) return fail('swap_bad_from')
      const reason = inSet(payload.reason, SWAP_REASONS)
      if (!reason) return fail('swap_bad_reason')
      const hasWanted = payload.wantedExerciseId != null
      if (reason === 'specific') {
        const wantedExerciseId = asString(payload.wantedExerciseId)
        if (!wantedExerciseId || !SAFE_ID.test(wantedExerciseId)) return fail('swap_bad_wanted')
        return { ok: true, action: { action, fromExerciseId, reason, wantedExerciseId } }
      }
      // wantedExerciseId is only meaningful for a 'specific' request.
      if (hasWanted) return fail('swap_wanted_without_specific')
      return { ok: true, action: { action, fromExerciseId, reason } }
    }
    case 'change_goal': {
      if (!onlyKeys(payload, ['action', 'newGoal'])) return fail('goal_extra_keys')
      const newGoal = inSet(payload.newGoal, BACKEND_GOALS)
      if (!newGoal) return fail('goal_bad_value')
      return { ok: true, action: { action, newGoal } }
    }
    case 'set_training_days':
    case 'reschedule_days': {
      if (!onlyKeys(payload, ['action', 'days'])) return fail('days_extra_keys')
      const days = parseDays(payload.days)
      if (!days) return fail('days_bad_value')
      // Match the training-profile bound: between 2 and 6 gym days.
      if (days.length < 2 || days.length > 6) return fail('days_out_of_range')
      return { ok: true, action: { action, days } }
    }
    case 'set_session_length': {
      if (!onlyKeys(payload, ['action', 'sessionLengthMin'])) return fail('session_extra_keys')
      const raw = typeof payload.sessionLengthMin === 'number' ? payload.sessionLengthMin : Number(payload.sessionLengthMin)
      if (!(SESSION_LENGTHS as readonly number[]).includes(raw)) return fail('session_bad_value')
      return { ok: true, action: { action, sessionLengthMin: raw } }
    }
    case 'deload': {
      if (!onlyKeys(payload, ['action'])) return fail('deload_extra_keys')
      return { ok: true, action: { action } }
    }
    case 'catch_up': {
      if (!onlyKeys(payload, ['action', 'mode'])) return fail('catchup_extra_keys')
      const mode = inSet(payload.mode, CATCH_UP_MODES)
      if (!mode) return fail('catchup_bad_mode')
      return { ok: true, action: { action, mode } }
    }
    case 'planned_absence': {
      if (!onlyKeys(payload, ['action', 'mode', 'startDate', 'endDate'])) return fail('absence_extra_keys')
      const mode = inSet(payload.mode, ABSENCE_MODES)
      if (!mode) return fail('absence_bad_mode')
      const startDate = asString(payload.startDate)
      const endDate = asString(payload.endDate)
      if (!startDate || !DATE_KEY.test(startDate)) return fail('absence_bad_start')
      if (!endDate || !DATE_KEY.test(endDate)) return fail('absence_bad_end')
      if (endDate < startDate) return fail('absence_end_before_start')
      return { ok: true, action: { action, mode, startDate, endDate } }
    }
    case 'exam_mode': {
      if (!onlyKeys(payload, ['action', 'startDate', 'endDate'])) return fail('exam_extra_keys')
      const startDate = asString(payload.startDate)
      const endDate = asString(payload.endDate)
      if (!startDate || !DATE_KEY.test(startDate)) return fail('exam_bad_start')
      if (!endDate || !DATE_KEY.test(endDate)) return fail('exam_bad_end')
      if (endDate < startDate) return fail('exam_end_before_start')
      return { ok: true, action: { action, startDate, endDate } }
    }
    case 'start_session': {
      if (!onlyKeys(payload, ['action', 'variant'])) return fail('start_extra_keys')
      const variant = inSet(payload.variant, START_VARIANTS)
      if (!variant) return fail('start_bad_variant')
      return { ok: true, action: { action, variant } }
    }
    case 'open_budget_eats': {
      if (!onlyKeys(payload, ['action', 'recipeId'])) return fail('recipe_extra_keys')
      if (payload.recipeId == null) return { ok: true, action: { action } }
      const recipeId = asString(payload.recipeId)
      if (!recipeId || !SAFE_ID.test(recipeId)) return fail('recipe_bad_id')
      return { ok: true, action: { action, recipeId } }
    }
    case 'nudge_log': {
      if (!onlyKeys(payload, ['action', 'kind'])) return fail('nudge_extra_keys')
      const kind = inSet(payload.kind, NUDGE_KINDS)
      if (!kind) return fail('nudge_bad_kind')
      return { ok: true, action: { action, kind } }
    }
    case 'share_pr': {
      if (!onlyKeys(payload, ['action', 'prExerciseId', 'prValue'])) return fail('pr_extra_keys')
      const prExerciseId = asString(payload.prExerciseId)
      if (!prExerciseId || !SAFE_ID.test(prExerciseId)) return fail('pr_bad_exercise')
      const prValue = typeof payload.prValue === 'number' ? payload.prValue : Number(payload.prValue)
      if (!Number.isFinite(prValue) || prValue <= 0 || prValue > 100000) return fail('pr_bad_value')
      return { ok: true, action: { action, prExerciseId, prValue } }
    }
  }
}
