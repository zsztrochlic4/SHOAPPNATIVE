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

import type { CoachMemoryCandidate } from './contracts'

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

/** Wellness/lifestyle goals the coach may adjust (the daily targets on the dashboard), with sane
 *  bounds mirroring the Goals editor. NOT calorie/macro targets — nutrition is qualitative app-wide. */
export const WELLNESS_METRICS = ['water', 'sleep', 'steps'] as const
export type WellnessMetricLit = (typeof WELLNESS_METRICS)[number]
export const WELLNESS_BOUNDS: Record<WellnessMetricLit, { min: number; max: number }> = {
  water: { min: 0.5, max: 6 }, // litres per day
  sleep: { min: 4, max: 12 }, // hours per night
  steps: { min: 1000, max: 40000 },
}

/** Goal (target) body weight, stored on the Profile as `goalWeightKg` and reflected in the weight
 *  projections. A body target, NOT a nutrition/calorie target (which stays qualitative app-wide). */
export const GOAL_WEIGHT_BOUNDS_KG = { min: 30, max: 250 } as const

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
  | { action: 'set_wellness_goal'; metric: WellnessMetricLit; value: number }
  | { action: 'set_goal_weight'; valueKg: number }

export type WorkoutActionName = WorkoutAction['action']

/** Every action name the schema accepts. Mirrored in the system prompt allowlist. */
export const WORKOUT_ACTION_NAMES: readonly WorkoutActionName[] = [
  'swap', 'change_goal', 'set_training_days', 'set_session_length', 'deload',
  'catch_up', 'reschedule_days', 'planned_absence', 'exam_mode', 'start_session',
  'open_budget_eats', 'nudge_log', 'share_pr', 'set_wellness_goal', 'set_goal_weight',
] as const

export type WorkoutActionValidation =
  | { ok: true; action: WorkoutAction }
  | { ok: false; reason: string }

/* ------------------------------------------------------------------ */
/*  Validation                                                         */
/* ------------------------------------------------------------------ */

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/
/** Max span for a planned absence / exam period — guards against absurd ranges (C-013/CA-010). */
const MAX_PERIOD_DAYS = 366

const fail = (reason: string): WorkoutActionValidation => ({ ok: false, reason })

/**
 * A real CALENDAR date, not just the right shape (C-013). `2026-99-99` matches the regex but is
 * not a date; `2026-02-30` rolls over. We parse in UTC and require the components to round-trip
 * exactly, so only genuine calendar days (leap years included) pass. Returns the ms epoch or null.
 */
function calendarDateMs(value: string): number | null {
  if (!DATE_KEY.test(value)) return null
  const [y, m, d] = value.split('-').map(Number)
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const ms = Date.UTC(y, m - 1, d)
  const back = new Date(ms)
  // Reject rollover (e.g. Feb 30 → Mar 2): the parsed parts must match the input exactly.
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) return null
  return ms
}

/** Validate a start/end pair: both real calendar dates, end ≥ start, span within the max. */
function validateDateRange(startDate: unknown, endDate: unknown, prefix: string): { ok: true; startDate: string; endDate: string } | { ok: false; reason: string } {
  const start = asString(startDate)
  const end = asString(endDate)
  if (!start) return { ok: false, reason: `${prefix}_bad_start` }
  if (!end) return { ok: false, reason: `${prefix}_bad_end` }
  const startMs = calendarDateMs(start)
  const endMs = calendarDateMs(end)
  if (startMs == null) return { ok: false, reason: `${prefix}_bad_start` }
  if (endMs == null) return { ok: false, reason: `${prefix}_bad_end` }
  if (endMs < startMs) return { ok: false, reason: `${prefix}_end_before_start` }
  if ((endMs - startMs) / 86_400_000 > MAX_PERIOD_DAYS) return { ok: false, reason: `${prefix}_span_too_long` }
  return { ok: true, startDate: start, endDate: end }
}

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
      const range = validateDateRange(payload.startDate, payload.endDate, 'absence')
      if (!range.ok) return fail(range.reason)
      return { ok: true, action: { action, mode, startDate: range.startDate, endDate: range.endDate } }
    }
    case 'exam_mode': {
      if (!onlyKeys(payload, ['action', 'startDate', 'endDate'])) return fail('exam_extra_keys')
      const range = validateDateRange(payload.startDate, payload.endDate, 'exam')
      if (!range.ok) return fail(range.reason)
      return { ok: true, action: { action, startDate: range.startDate, endDate: range.endDate } }
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
    case 'set_wellness_goal': {
      if (!onlyKeys(payload, ['action', 'metric', 'value'])) return fail('wellness_extra_keys')
      const metric = inSet(payload.metric, WELLNESS_METRICS)
      if (!metric) return fail('wellness_bad_metric')
      const value = typeof payload.value === 'number' ? payload.value : Number(payload.value)
      const b = WELLNESS_BOUNDS[metric]
      if (!Number.isFinite(value) || value < b.min || value > b.max) return fail('wellness_out_of_range')
      return { ok: true, action: { action, metric, value } }
    }
    case 'set_goal_weight': {
      if (!onlyKeys(payload, ['action', 'valueKg'])) return fail('goal_weight_extra_keys')
      const valueKg = typeof payload.valueKg === 'number' ? payload.valueKg : Number(payload.valueKg)
      if (!Number.isFinite(valueKg) || valueKg < GOAL_WEIGHT_BOUNDS_KG.min || valueKg > GOAL_WEIGHT_BOUNDS_KG.max) return fail('goal_weight_out_of_range')
      return { ok: true, action: { action, valueKg } }
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Deterministic action backstops (model-independent reliability)     */
/* ------------------------------------------------------------------ */

export interface SynthActionProposal {
  title: string
  summary: string
  /** Honest confirm-gated lead-in; never implies the action has already happened. */
  message: string
  payload: Record<string, string | number | boolean>
}

const ACTION_VERB = /\b(set|change|adjust|make|update|switch|move|reschedule|schedule|start|begin|open|show|give|put|pause|take|add|swap|replace|deload|fit|mark)\b/i
const DAY_ALIASES: Record<string, WeekdayLit> = {
  monday: 'Monday', mon: 'Monday', tuesday: 'Tuesday', tue: 'Tuesday', tues: 'Tuesday',
  wednesday: 'Wednesday', wed: 'Wednesday', thursday: 'Thursday', thu: 'Thursday', thurs: 'Thursday',
  friday: 'Friday', fri: 'Friday', saturday: 'Saturday', sat: 'Saturday', sunday: 'Sunday', sun: 'Sunday',
}

function actionProposal(payload: Record<string, string | number | boolean>, title: string, summary: string, message: string): SynthActionProposal | null {
  if (!validateWorkoutActionPayload(payload).ok) return null
  return { payload, title, summary, message }
}

function mentionedDays(message: string): WeekdayLit[] {
  const found = new Set<WeekdayLit>()
  for (const token of message.toLowerCase().match(/[a-z]+/g) ?? []) {
    const day = DAY_ALIASES[token] ?? DAY_ALIASES[token.replace(/s$/, '')] // accept plurals: "Tuesdays"
    if (day) found.add(day)
  }
  return WEEKDAY_LITS.filter((day) => found.has(day))
}

function dateKeyLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getTime())
  copy.setDate(copy.getDate() + days)
  return copy
}

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
}

function explicitDateKeys(message: string): string[] {
  const out: string[] = []
  const re = /\b(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b/g
  for (const match of message.toLowerCase().matchAll(re)) {
    const date = new Date(Number(match[3]), MONTHS[match[2]], Number(match[1]))
    if (date.getFullYear() === Number(match[3]) && date.getMonth() === MONTHS[match[2]] && date.getDate() === Number(match[1])) out.push(dateKeyLocal(date))
  }
  return out
}

/** Goal synonyms mapped to the four canonical program goals. */
const GOAL_MAP: [RegExp, BackendGoalLit][] = [
  [/\b(build(?:ing)?\s+muscle|muscle\s+building|gain(?:ing)?\s+muscle|put\s+on\s+(?:muscle|size)|get\s+bigger|bulk(?:ing)?|hypertroph\w*|more\s+muscle|muscle\s+mass)\b/, 'Hypertrophy'],
  [/\b(los\w*\s+fat|fat\s+loss|los\w*\s+weight|weight\s+loss|lean\s+out|get\s+lean|shred|cut\s+(?:fat|weight|down))\b/, 'Fat Loss'],
  [/\b(get(?:ting)?\s+stronger|build\s+strength|more\s+strength|\bstronger\b|strength\s+focus|powerlift\w*)\b/, 'Strength'],
  [/\b(stay\s+healthy|get\s+healthy|general\s+fitness|stay\s+fit|keep\s+fit|overall\s+health|just\s+(?:stay\s+)?healthy|maintain(?:ing)?\s+(?:my\s+)?(?:health|fitness))\b/, 'General Fitness'],
]

/**
 * A change of the whole-program GOAL (Fat Loss, Hypertrophy, Strength, General Fitness). Requires an
 * explicit goal/plan/program context so a training aside ("I want to build muscle in my legs today")
 * cannot silently re-point the program, and reads the target BEFORE any "instead of / not" clause so
 * "focus on losing fat instead of building muscle" resolves to Fat Loss, not the thing being dropped.
 */
export function synthesizeGoalChangeProposal(userMessage: string): SynthActionProposal | null {
  if (typeof userMessage !== 'string') return null
  const m = userMessage.toLowerCase()
  const ctx = /\bmy\s+(goal|plan|program|programme)\b|\b(change|switch|update|set|make)\s+(?:my\s+)?(?:goal|plan|program|programme)\b|\bfocus\s+(?:on|now)\b|\binstead\s+of\b|\bnot\s+bulk\b|\bchange\s+that\b/.test(m)
  if (!ctx) return null
  if (/\b(after|once|when)\s+(?:my\s+|the\s+)?exams?\b|\blater\b|\bnext\s+(?:month|year|block)\b/.test(m)) return null // deferred, not a change now
  const primary = m.replace(/\b(instead of|rather than|,?\s*not)\b[\s\S]*$/, '')
  let goal: BackendGoalLit | null = null
  for (const [re, g] of GOAL_MAP) { if (re.test(primary)) { goal = g; break } }
  if (!goal) return null
  return actionProposal({ action: 'change_goal', newGoal: goal }, `Change goal to ${goal}`, `Regenerates your program around ${goal} after confirmation.`, `Want me to change your training goal to ${goal}? Tap confirm and I'll update your program.`)
}

/** Parse an in-month day range like "the 20th to the 30th" into [startKey, endKey], rolling a past
 *  start day into next month. Used only in the exam-mode branch, so the surrounding context is bounded. */
function parseDayOfMonthRange(m: string, now: Date): [string, string] | null {
  const mt = m.match(/(?:from\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(?:to|until|through|till)\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/)
  if (!mt) return null
  const d1 = Number(mt[1]), d2 = Number(mt[2])
  if (!(d1 >= 1 && d1 <= 31 && d2 >= 1 && d2 <= 31)) return null
  const mk = (yy: number, mm: number, dd: number): string | null => { const dt = new Date(yy, mm, dd); return dt.getMonth() === ((mm % 12) + 12) % 12 ? dateKeyLocal(dt) : null }
  let sy = now.getFullYear(), sm = now.getMonth()
  if (d1 < now.getDate()) { sm += 1; if (sm > 11) { sm = 0; sy += 1 } }
  const s = mk(sy, sm, d1)
  if (!s) return null
  let ey = sy, em = sm
  if (d2 < d1) { em += 1; if (em > 11) { em = 0; ey += 1 } }
  const e = mk(ey, em, d2)
  return e ? [s, e] : null
}

/**
 * Deterministic proposal synthesis for bounded, high-confidence action intents. The model may phrase
 * the answer, but is never trusted to decide whether a real product action exists. Ambiguous or
 * parameter-incomplete requests return null so the reply can ask for the missing detail.
 */
export function synthesizeBoundedActionProposal(userMessage: string, now = new Date()): SynthActionProposal | null {
  if (typeof userMessage !== 'string') return null
  const m = userMessage.trim().toLowerCase()
  // No blanket action-verb gate: it wrongly rejected everyday phrasings (cut, bump, trim, "turn on",
  // "changed"). Each branch below carries its own specific noun+intent test, so it cannot over-fire on
  // a plain question. ACTION_VERB is kept only for callers that want a cheap pre-check.
  if (!m) return null
  void ACTION_VERB

  if (/\bbudget eats\b/.test(m) && /\b(open|show|take me|go to)\b/.test(m)) {
    return actionProposal({ action: 'open_budget_eats' }, 'Open Budget Eats', 'Opens budget-friendly food ideas in StrengthHub.', 'Ready to open Budget Eats? Tap confirm to continue.')
  }
  if (/\b(deload|recovery week|easy week)\b/.test(m) && /\b(give|set|schedule|start|make|put|take)\b/.test(m)) {
    return actionProposal({ action: 'deload' }, 'Schedule a deload week', 'Reduces training stress for one week while keeping your plan structure.', "Want me to schedule a deload week? Tap confirm and I'll apply it safely.")
  }
  const startIntent = /\b(start|begin|kick off|get going on)\b/.test(m) || /\blet'?s\s+(do|train|go|smash|get\s+going|get\s+into|crack)\b/.test(m) || /\bdo\s+(today'?s|my|the)\s+(workout|session|training)\b/.test(m)
  if (startIntent && /\b(workout|session|train|training)\b/.test(m)) {
    const quick = /\b(15|quick|short)\b/.test(m)
    return actionProposal(
      { action: 'start_session', variant: quick ? 'quick15' : 'full' },
      quick ? 'Start a 15-minute workout' : "Start today's workout",
      quick ? 'Opens a shortened 15-minute version of the current session.' : 'Opens the full scheduled session for today.',
      quick ? 'Ready for a 15-minute workout? Tap confirm to start it.' : "Ready to train? Tap confirm to start today's full workout.",
    )
  }
  if (/\b(sessions?|workouts?)\b/.test(m)) {
    // Accept a plain number with a minute unit, "to/into 45", or an "hour" phrase, so cut/bump/trim
    // phrasings all resolve. Requires a real time unit so "30 reps" cannot be read as a length.
    let n = Number((m.match(/\b(30|45|60|75|90)\s*(?:minute|min)s?\b/) || m.match(/\b(?:to|into|around|about|of|at)\s+(30|45|60|75|90)\b/))?.[1])
    if (!Number.isFinite(n)) {
      if (/\bhour and a half\b/.test(m)) n = 90
      else if (/\bhalf an hour\b|\bhalf hour\b/.test(m)) n = 30
      else if (/\b(?:an|one|1)\s+hour\b/.test(m)) n = 60
    }
    if ([30, 45, 60, 75, 90].includes(n)) return actionProposal({ action: 'set_session_length', sessionLengthMin: n }, `Set sessions to ${n} minutes`, `Regenerates future sessions around a ${n}-minute target after confirmation.`, `Want me to set your session length to ${n} minutes? Tap confirm and I'll update it.`)
  }
  // Training-day SET: two or more weekdays named in a scheduling context become the full week. A single
  // "move day A to day B" is handled earlier by synthesizeDayMoveProposal; "reschedule/move" lists fall
  // through to the reschedule branch below; and a clear set context is required so a recount ("I trained
  // Monday and Wednesday") cannot fire.
  if (!/\b(reschedule|move)\b/.test(m)) {
    const days = mentionedDays(m)
    const setCtx = /\b(training|workout|gym)\s+days?\b/.test(m) || /\bdays?\s+(?:i\s+)?train\b/.test(m) || /\bdays?\s+a\s+week\b/.test(m) || /\b(set|change|switch|update|adjust|make|only\s+train|train\s+on)\b/.test(m) || /\bi\s+train\b/.test(m)
    // "day A to day B" (exactly two weekdays joined by "to") is a single-day MOVE, handled by
    // synthesizeDayMoveProposal, not a request to set the whole week to just those two days.
    const twoDayToMove = days.length === 2 && /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b\s+to\s+\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(m)
    if (days.length >= 2 && days.length <= 6 && setCtx && !twoDayToMove) {
      const list = days.join(', ')
      return actionProposal({ action: 'set_training_days', days: days.join(',') }, 'Set training days', `Sets your weekly training schedule to ${list}.`, `Want me to set your training days to ${list}? Tap confirm and I'll update the schedule.`)
    }
  }
  const goal = synthesizeGoalChangeProposal(m)
  if (goal) return goal
  if (/\bexam mode\b/.test(m) || (/\bexam/.test(m) && /\b(mode|lighten|reduce|ease|survival)\b/.test(m))) {
    // Prefer explicit "the Nth to the Mth" day-of-month dates; else a "for N weeks" span; else 2 weeks.
    const range = parseDayOfMonthRange(m, now)
    let startDate: string, endDate: string
    if (range) { startDate = range[0]; endDate = range[1] } else {
      const weeks = Math.min(52, Math.max(1, Number(m.match(/\b(?:next|for)\s+(\d+)\s+weeks?\b/)?.[1] ?? 2)))
      startDate = dateKeyLocal(now)
      endDate = dateKeyLocal(addDays(now, weeks * 7 - 1))
    }
    return actionProposal({ action: 'exam_mode', startDate, endDate }, `Use exam mode (${startDate} to ${endDate})`, `Reduces training to a maintenance schedule from ${startDate} to ${endDate}.`, `Want me to use exam mode from ${startDate} to ${endDate}? Tap confirm and I'll adapt the schedule.`)
  }
  if (/\b(away|absence|holiday|vacation|pause training|pause my training)\b/.test(m)) {
    const dates = explicitDateKeys(m)
    if (dates.length >= 2) {
      const mode: AbsenceModeLit = /\b(pause|completely|no training|full)\b/.test(m) ? 'full_pause' : /\bmaintenance\b/.test(m) ? 'maintenance' : /\breduced\b/.test(m) ? 'reduced_frequency' : 'active_rest'
      return actionProposal({ action: 'planned_absence', mode, startDate: dates[0], endDate: dates[1] }, 'Schedule planned time away', `${mode === 'full_pause' ? 'Pauses' : 'Adapts'} training from ${dates[0]} to ${dates[1]}.`, `Want me to ${mode === 'full_pause' ? 'pause' : 'adapt'} training from ${dates[0]} to ${dates[1]}? Tap confirm and I'll update the schedule.`)
    }
  }
  const wantsExemptRest = (/\b(missed|skip(?:ped)?)\b/.test(m) && /\b(today|workout|session|training)\b/.test(m) && /\b(exempt|no[- ]penalty|rest day)\b/.test(m)) ||
    (/\b(mark|set|make|log)\b[\s\S]{0,20}\b(today|it)\b[\s\S]{0,20}\b(rest day|no.?penalty|exempt)\b/.test(m)) ||
    (/\b(rest day|no.?penalty)\b/.test(m) && /\b(doesn'?t count|does not count|not count against|without.*penalty)\b/.test(m))
  if (wantsExemptRest) {
    // Only the no-penalty exemption is genuinely implemented (shift/fold/replan stay prose-only so the
    // coach never offers a confirm button for a resolver path that would later refuse it).
    const label = 'Mark today as a no-penalty rest day'
    return actionProposal({ action: 'catch_up', mode: 'exempt' }, label, 'Marks today as planned rest without inventing extra training.', `Want me to ${label.toLowerCase()}? Tap confirm and I'll update the week.`)
  }
  if (/\b(reschedule|move)\b/.test(m) && /\b(training|workout|gym)\b/.test(m)) {
    const days = mentionedDays(m)
    if (days.length >= 2 && days.length <= 6) {
      const list = days.join(', ')
      return actionProposal({ action: 'reschedule_days', days: days.join(',') }, 'Reschedule training days', `Moves this schedule to ${list}.`, `Want me to reschedule training to ${list}? Tap confirm and I'll update it.`)
    }
  }
  return null
}

/** The coach's redirect when it drops a mis-routed exercise swap for a day-reschedule request. */
export const DAY_RESCHEDULE_LINE =
  'To rearrange your training days, just tell me which days you’d like to train, for example Monday, Wednesday, Friday, and I’ll update your schedule. I won’t change your exercises.'

/** Natural-language weekday list in canonical order: ['Friday','Monday'] -> 'Monday and Friday'. */
export function joinWeekdays(days: readonly string[]): string {
  const list = WEEKDAY_LITS.filter((d) => days.includes(d))
  if (list.length === 0) return ''
  if (list.length === 1) return list[0]
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`
}

/**
 * To-the-point reply for a day-reschedule request that has NOT named the target days yet. It goes
 * straight to the one thing that moves it forward: it states the days the user trains now, so they can
 * decide in a single turn, and asks once which days they want, without first re-confirming an intent
 * they already stated and without making them ask what their current days are. Falls back to the
 * generic line when the current schedule is not in view. Dash-free per the app-wide output rule.
 */
export function dayRescheduleAsk(currentDays: readonly string[] = []): string {
  const current = joinWeekdays(currentDays)
  if (!current) return DAY_RESCHEDULE_LINE
  return `Right now you train ${current}. Which days would you like instead? Tell me the days and I'll move your schedule and keep your exercises the same.`
}

const DAY_TOKENS = 'monday|tuesday|wednesday|thursday|friday|saturday|sunday'
const DAY_MOVE_RE = new RegExp(
  `\\b(?:move|change|switch|shift|swap)\\b[^.?!]*?\\b(${DAY_TOKENS})\\b[^.?!]{0,30}?\\b(?:to|for|and|onto|into|over to|across to|with)\\b[^.?!]{0,10}?\\b(${DAY_TOKENS})\\b`,
  'i',
)

/**
 * Move ONE training day to another weekday, e.g. "change monday to saturday" or "move my monday session
 * to saturday". The user names one day they train now and one day to move it to; we compute the resulting
 * full week and emit a `set_training_days` proposal for it, so the change flows through the SAME validated
 * resolver (no new engine action) and stays confirm-gated. Deliberately narrow: it needs the current
 * schedule in view, the "from" day must be one they actually train, and the "to" day must be free, so an
 * ambiguous request (target already a training day, unknown schedule) returns null and the coach asks
 * rather than guessing. Dash-free per the app-wide output rule.
 */
export function synthesizeDayMoveProposal(userMessage: string, currentDays: readonly string[] = []): SynthActionProposal | null {
  if (typeof userMessage !== 'string') return null
  // Three or more weekdays named is a FULL-SET request ("move my days to Mon, Wed, Fri and Sat"), not a
  // single-day move; leave it to the set/reschedule branch so the whole set is applied, not one day.
  if ((userMessage.toLowerCase().match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/g) || []).length > 2) return null
  const match = userMessage.toLowerCase().match(DAY_MOVE_RE)
  if (!match) return null
  const cap = (t: string): WeekdayLit => (t[0].toUpperCase() + t.slice(1)) as WeekdayLit
  const from = cap(match[1])
  const to = cap(match[2])
  if (from === to) return null
  const current = WEEKDAY_LITS.filter((d) => currentDays.includes(d))
  if (current.length < 2) return null // no known schedule to move within
  if (!current.includes(from)) return null // cannot move a day they do not train
  if (current.includes(to)) return null // target already trained: ambiguous, let the coach clarify
  const next = WEEKDAY_LITS.filter((d) => (current.includes(d) && d !== from) || d === to)
  if (next.length < 2 || next.length > 6) return null
  const list = joinWeekdays(next)
  return actionProposal(
    { action: 'set_training_days', days: next.join(',') },
    `Move ${from} training to ${to}`,
    `Moves your ${from} session to ${to}. Your training days become ${list}.`,
    `Want me to move your ${from} training to ${to}? Your week becomes ${list}. Tap confirm and I'll update the schedule.`,
  )
}

/* ------------------------------------------------------------------ */
/*  Schedule grounding — correct a false premise about what is trained  */
/*  on a given day, from the REAL program, instead of playing along.    */
/* ------------------------------------------------------------------ */

/** One weekday of the user's real program: its type, its lifts, and the muscle groups it trains. */
export interface DaySchedule { weekday: string; dayType: string; exercises: string[]; muscles: string[] }

/** User words → the canonical muscleGroup labels used in the exercise database. */
const MUSCLE_ALIASES: Record<string, string[]> = {
  chest: ['Chest'], pecs: ['Chest'], pec: ['Chest'],
  back: ['Back'], lats: ['Back'], lat: ['Back'],
  legs: ['Quads', 'Hamstrings & Glutes', 'Calves'], leg: ['Quads', 'Hamstrings & Glutes', 'Calves'],
  quads: ['Quads'], quad: ['Quads'], thighs: ['Quads'],
  hamstrings: ['Hamstrings & Glutes'], hams: ['Hamstrings & Glutes'], glutes: ['Hamstrings & Glutes'], glute: ['Hamstrings & Glutes'],
  calves: ['Calves'], calf: ['Calves'],
  shoulders: ['Shoulders'], shoulder: ['Shoulders'], delts: ['Shoulders'], delt: ['Shoulders'],
  arms: ['Biceps', 'Triceps'], arm: ['Biceps', 'Triceps'],
  biceps: ['Biceps'], bicep: ['Biceps'], triceps: ['Triceps'], tricep: ['Triceps'],
  core: ['Core'], abs: ['Core'], ab: ['Core'],
}

function namedMuscle(m: string): { word: string; groups: string[] } | null {
  for (const [word, groups] of Object.entries(MUSCLE_ALIASES)) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(m)) return { word, groups }
  }
  return null
}

function weekdayIn(m: string): WeekdayLit | null {
  const match = m.toLowerCase().match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/)
  return match ? ((match[1][0].toUpperCase() + match[1].slice(1)) as WeekdayLit) : null
}

function naturalList(items: readonly string[]): string {
  const list = items.filter(Boolean)
  if (list.length === 0) return ''
  if (list.length === 1) return list[0]
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`
}

/**
 * Answer a schedule fact or CORRECT a false premise about a training day, grounded entirely in the real
 * program. Returns dash-free reply text, or null when the message is not a schedule fact/claim (so it
 * does not hijack ordinary turns). This is what stops the coach being "sucked in" to a wrong premise
 * ("why the rest day today" when today is a training day; "chest on Monday" when Monday is Legs): the
 * answer is computed from the program, never from the model. A two-weekday move request is left to
 * synthesizeDayMoveProposal.
 */
export function synthesizeScheduleGroundedReply(userMessage: string, schedule: readonly DaySchedule[] = [], todayWeekday = ''): string | null {
  if (typeof userMessage !== 'string' || !Array.isArray(schedule) || schedule.length === 0) return null
  const m = userMessage.toLowerCase()
  // Leave an explicit day-to-day move ("change monday to saturday") to the move synth.
  if (/\b(move|change|switch|shift|swap)\b/.test(m) && (m.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/g) || []).length >= 2) return null
  // Do NOT hijack a motivation, "start/do today's workout" or "is it worth it" turn with a dry day
  // listing; those go to the start-session action or a motivational reply.
  if (/\b(can'?t be bothered|cant be bothered|do not want to|dont want to|don'?t want to|not feeling|no motivation|lost .*motivation|talk me into|worth it|be bothered|too lazy|unmotivated|let'?s (do|go|train)|do (today'?s|my|the) (workout|session)|quick session|15 min)\b/.test(m)) return null
  // A "mark/set today as a rest day" is an ACTION request; let the catch-up action handle it.
  if (/\b(mark|set|make|log)\b[\s\S]{0,20}\b(rest day|no.?penalty|exempt|doesn'?t count|does not count)\b/.test(m)) return null

  const byDay = new Map(schedule.map((d) => [d.weekday, d]))
  const trainsGroup = (groups: string[]): WeekdayLit[] =>
    WEEKDAY_LITS.filter((wd) => { const d = byDay.get(wd); return !!d && d.muscles.some((mg: string) => groups.includes(mg)) })

  const muscle = namedMuscle(m)
  const explicitDay = weekdayIn(m)
  const saysToday = /\b(today|todays|today's|tonight|this (morning|afternoon|evening))\b/.test(m)
  const scheduleCue = /\b(rest day|train|training|trained|gym|gymming|workout|work out|working out|session|schedule|split|do i|what do i|why|is it|meant to|supposed to|on)\b/.test(m) || !!muscle
  const dislike = /\b(don'?t|do not|dont|hate|rather not|sick of|tired of|not a fan|not keen)\b/.test(m)

  // Only engage a genuine schedule fact/claim: a named weekday, or a "today ..." schedule question.
  const targetDay: WeekdayLit | null = explicitDay ?? (saysToday && WEEKDAY_LITS.includes(todayWeekday as WeekdayLit) ? (todayWeekday as WeekdayLit) : null)
  if (!targetDay || !scheduleCue) return null

  const day = byDay.get(targetDay)
  const isRest = !day
  const dayNoun = (saysToday && targetDay === todayWeekday) ? `Today (${targetDay})` : targetDay

  // Muscle premise: "chest on Monday", "why legs on Friday", "I don't like chest on Monday".
  if (muscle) {
    const onDays = trainsGroup(muscle.groups)
    const dayHasIt = !isRest && day!.muscles.some((mg: string) => muscle.groups.includes(mg))
    if (dayHasIt) {
      return `Yes, ${dayNoun} is your ${day!.dayType} day and it trains ${muscle.word}: ${naturalList(day!.exercises)}.`
    }
    // The claimed muscle is NOT on that day: correct it plainly and point to the real day(s).
    const where = onDays.length ? `Your ${muscle.word} work is on ${naturalList(onDays)}.` : `Your program does not have a dedicated ${muscle.word} day right now.`
    const what = isRest ? `${dayNoun} is a rest day, so there is no training then.` : `${dayNoun} is your ${day!.dayType} day: ${naturalList(day!.exercises)}.`
    return `You do not train ${muscle.word} on ${targetDay}. ${what} ${where}`
  }

  // No muscle named: a plain "what/why do I train on <day>" or a "don't want to train on <day>".
  if (isRest) {
    return `${dayNoun} is a rest day in your program, so nothing is scheduled then. Recovery is part of the plan, not a gap in it.`
  }
  const lifts = naturalList(day!.exercises)
  if (/\brest day\b/.test(m)) {
    return `${dayNoun} is not a rest day, it's your ${day!.dayType} day: ${lifts}.`
  }
  if (dislike) {
    return `${dayNoun} is your ${day!.dayType} day: ${lifts}. Want to move it to another day? Tell me which day and I'll update your schedule.`
  }
  return `${dayNoun} is your ${day!.dayType} day: ${lifts}.`
}

/* ------------------------------------------------------------------ */
/*  Memory learning — reliably capture durable facts the model misses  */
/* ------------------------------------------------------------------ */

/** Equipment nouns we can recognise with confidence in a durable-setup statement. */
const EQUIP_NOUN = /\b(dumbbells?|barbell|kettlebells?|resistance bands?|bands?|bench|squat rack|power rack|rack|pull[ -]?up bar|machines?|cables?|smith machine|leg press)\b/gi

/**
 * Capture a HIGH-CONFIDENCE durable training fact the small model routinely fails to store: where the
 * user trains and what equipment they have. Returns a memory candidate whose evidenceQuote is an exact
 * slice of the message (the save path re-checks that), or null. Deliberately narrow, a wrong memory is
 * worse than none, so only unambiguous setup statements match. Non-sensitive, stable scope. This is the
 * app "learning" the user, done in our code, never by changing the model.
 */
export function synthesizeMemoryFromMessage(userMessage: string): CoachMemoryCandidate | null {
  if (typeof userMessage !== 'string') return null
  const m = userMessage.trim()
  const lower = m.toLowerCase()

  // Trains at home.
  const home = lower.match(/\b(?:i|we)\s+(?:train|work\s?out|lift|exercise)\s+(?:at|from)\s+home\b/) ||
    lower.match(/\b(?:i|we)\s+(?:have|have got|got)\s+a\s+home\s+gym\b/) || lower.match(/\bhome\s+gym\b/)
  if (home) return { category: 'Training location', value: 'Trains at home', evidenceQuote: home[0], scope: 'stable', sensitivity: 'ordinary' }

  // Equipment they do NOT have.
  const missing = lower.match(/\b(?:no|don'?t have|do not have|dont have|without)\s+(?:a\s+|an\s+|any\s+)?(dumbbells?|barbell|kettlebells?|bench|squat rack|power rack|rack|pull[ -]?up bar|machines?|cables?|gym access|equipment)\b/)
  if (missing) return { category: 'Equipment', value: `Does not have a ${missing[1]}`, evidenceQuote: missing[0], scope: 'stable', sensitivity: 'ordinary' }

  // A constrained "I only have …" setup.
  if (/\bonly\b/.test(lower) && /\b(?:i|we)\s+(?:only\s+)?(?:have|have got|got|own)\b/.test(lower)) {
    const nouns = [...new Set((lower.match(EQUIP_NOUN) || []).map((x) => x.toLowerCase().trim()))]
    if (nouns.length) {
      const idx = lower.indexOf('only')
      const quote = m.slice(idx, Math.min(m.length, idx + 60)).trim()
      return { category: 'Equipment', value: `Only has ${nouns.join(', ')}`, evidenceQuote: quote, scope: 'stable', sensitivity: 'ordinary' }
    }
  }
  return null
}

/**
 * A request to "swap / rearrange / move my (training/exercise) DAYS" is a training-DAY reschedule, NOT
 * an exercise swap. flash-lite sometimes latches onto "swap"/"exercise" and emits an exercise `swap`
 * proposal for it (e.g. "swap Barbell Back Squat for Front Squat" when the user asked to move their
 * days around). This detects the day-scheduling intent — in the current message, OR in a bare
 * affirmation ("yes") following such a request in the recent turns — so the coach turn can drop the
 * wrong swap and ask which days. Requires the PLURAL "days" so "swap the bench on my leg day" (a real
 * exercise swap) does NOT match.
 */
export function isDayRescheduleIntent(message: string, recentTurns: readonly string[] = []): boolean {
  const DAY = /\b(swap|switch|rearrang\w*|reorder|shuffle|move|change|shift)\b[^.?!]{0,40}\bdays\b/i
  const AFFIRM = /^\s*(yes|yeah|yep|yup|sure|ok(?:ay)?|please|do it|go ahead|sounds good|confirm|correct|that'?s right)\b/i
  if (typeof message !== 'string') return false
  if (DAY.test(message)) return true
  if (AFFIRM.test(message)) return recentTurns.slice(-3).some((t) => typeof t === 'string' && DAY.test(t))
  return false
}

export interface SynthProfileGoalProposal {
  title: string
  summary: string
  /** A clean proposal lead-in for the reply text, used when the model asked in prose / mis-emitted. */
  message: string
  payload:
    | { action: 'set_wellness_goal'; metric: WellnessMetricLit; value: number }
    | { action: 'set_goal_weight'; valueKg: number }
}
/** @deprecated Use SynthProfileGoalProposal. */
export type SynthWellnessGoalProposal = SynthProfileGoalProposal

const _WELLNESS_SET_INTENT = /\b(set|change|adjust|make|update|raise|lower|increase|decrease|bump|move|put|lift|drop)\b/i

function roundForMetric(metric: WellnessMetricLit, value: number): number {
  return metric === 'steps' ? Math.round(value) : Math.round(value * 10) / 10
}

/**
 * Deterministic fallback for an exercise swap ("I don't like the bench press", "swap my squat",
 * "change the deadlift"). flash-lite reliably ASKS in prose instead of emitting the structured swap
 * action — and unlike the goal actions, a swap needs the user's PROGRAM to resolve the exercise NAME
 * to its id, so it takes the program's exercise list. We detect a dislike/swap intent, match the named
 * exercise against the program by token overlap, and build a reason="dislike" swap (the engine picks a
 * safe replacement). Returns null when there is no swap intent or no exercise matches, so the model
 * reply stands. Still confirm-gated on the client and engine-clamped by the resolver.
 */
interface SwapCandidateExercise { id: string; name: string; topSwap?: { id: string; name: string } }
const SWAP_INTENT = /\b(don'?t\s+(?:like|enjoy|want)|do\s+not\s+(?:like|enjoy|want)|dislike|hate|swap|replace|change|switch|drop|remove|sick\s+of|bored\s+(?:of|with)|tired\s+of|get\s+rid\s+of)\b/i
/** Generic position, anatomy, equipment and filler tokens that must NOT drive an exercise match (stems,
 *  final "s" already stripped). Distinctive movement nouns like row, press, curl, squat, lunge stay. */
const SWAP_STOP = new Set([
  'back', 'front', 'upper', 'lower', 'seated', 'standing', 'incline', 'decline', 'barbell', 'dumbbell',
  'kettlebell', 'cable', 'machine', 'bar', 'smith', 'weighted', 'band', 'the', 'and', 'for', 'with',
  'exercise', 'workout', 'different', 'something', 'anything', 'please', 'want', 'like', 'dont', 'hate',
  'program', 'programme', 'plan', 'week', 'day', 'out', 'that', 'this', 'some', 'give', 'another',
  'option', 'instead', 'need', 'stuff', 'thing', 'one', 'can', 'you', 'every', 'same', 'bored',
])
export function synthesizeSwapProposal(userMessage: string, exercises: SwapCandidateExercise[]): SynthActionProposal | null {
  if (typeof userMessage !== 'string' || !Array.isArray(exercises) || !exercises.length) return null
  const m = userMessage.trim().toLowerCase()
  if (!m || !SWAP_INTENT.test(m)) return null
  // Match the named exercise by DISTINCTIVE token overlap. Generic position, anatomy and equipment
  // words (back, front, upper, lower, seated, barbell, dumbbell...) are excluded, otherwise "my lower
  // back is sore" would match "Barbell Back Squat" and "a different back exercise" would swap the squat.
  const tokenize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).map((w) => w.replace(/s$/, '')).filter((w) => w.length >= 3 && !SWAP_STOP.has(w))
  const msgTokens = new Set(tokenize(m))
  let best: { ex: SwapCandidateExercise; score: number } | null = null
  for (const ex of exercises) {
    if (!ex || typeof ex.id !== 'string' || !SAFE_ID.test(ex.id) || typeof ex.name !== 'string') continue
    const nameTokens = tokenize(ex.name)
    const score = nameTokens.reduce((n, t) => n + (msgTokens.has(t) ? 1 : 0), 0)
    if (score > 0 && (!best || score > best.score)) best = { ex, score }
  }
  if (!best) return null
  const ex = best.ex
  // NAME the substitute up front so the user confirms a concrete swap (e.g. "Bench Press for Dumbbell
  // Bench Press"). The engine validates the named lift on confirm and, if it doesn't fit the user's
  // equipment/injuries, replies offering a safe alternative. Falls back to an engine-picked swap
  // (reason "dislike") only when we have no named substitute for this lift.
  const sub = ex.topSwap && SAFE_ID.test(ex.topSwap.id) ? ex.topSwap : null
  if (sub) {
    return actionProposal(
      { action: 'swap', fromExerciseId: ex.id, reason: 'specific', wantedExerciseId: sub.id },
      `Swap ${ex.name} for ${sub.name}`,
      `Replaces ${ex.name} in your program with ${sub.name}, the closest like-for-like alternative. Nothing changes until you confirm.`,
      `Want me to swap ${ex.name} for ${sub.name}? Tap confirm and I'll update your plan.`,
    )
  }
  return actionProposal(
    { action: 'swap', fromExerciseId: ex.id, reason: 'dislike' },
    `Swap ${ex.name}`,
    `Replaces ${ex.name} in your program with a suitable alternative the engine picks for your goal and equipment.`,
    `Want me to swap ${ex.name} for a suitable alternative? Tap confirm and I'll update your plan.`,
  )
}

/**
 * Deterministic fallback for "set my water/sleep/step goal to N". flash-lite frequently ASKS in prose
 * ("Want me to set…?") instead of emitting the structured set_wellness_goal action, so no confirm card
 * renders and a later "yes" applies nothing. When the user's intent is unambiguous — a set/change verb
 * + a wellness metric + the word goal/target + an in-bounds ABSOLUTE number — we build the proposal
 * ourselves so the card always appears (still confirm-gated + engine-clamped downstream). Returns null
 * when it is not clearly an absolute goal-set request or the value is out of range, so the model reply
 * stands (e.g. relative "by 1 litre" changes, or "what is my water goal").
 */
export function synthesizeWellnessGoalProposal(userMessage: string): SynthWellnessGoalProposal | null {
  if (typeof userMessage !== 'string') return null
  const m = userMessage.toLowerCase().replace(/(\d),(\d)/g, '$1$2') // "10,000" -> "10000"
  // A set/change verb OR an intent to hit/aim for a value, so "I want to hit 8 hours of sleep, set that"
  // works even without the literal word "goal". The metric + absolute number are still required.
  if (!(_WELLNESS_SET_INTENT.test(m) || /\b(hit|aim(?:ing)?\s+for|get\s+to|reach|do)\b/.test(m))) return null
  if (/\bby\s+\d/.test(m)) return null // relative change ("increase by 1") — needs the current value; let the model handle it
  const metric: WellnessMetricLit | null =
    /\b(water|hydration|fluid)\b/.test(m) ? 'water'
      : /\bsleep\b/.test(m) ? 'sleep'
        : /\bsteps?\b/.test(m) ? 'steps'
          : null
  if (!metric) return null
  const num = m.match(/(\d+(?:\.\d+)?)(\s*k\b)?/)
  if (!num) return null
  let value = parseFloat(num[1])
  if (!Number.isFinite(value)) return null
  if (metric === 'steps' && num[2]) value = value * 1000 // "10k steps"
  value = roundForMetric(metric, value)
  const payload = { action: 'set_wellness_goal' as const, metric, value }
  // Re-use the canonical bounds gate — never build an out-of-range proposal.
  if (!validateWorkoutActionPayload(payload).ok) return null
  const label =
    metric === 'water' ? `${value} litre${value === 1 ? '' : 's'} a day`
      : metric === 'sleep' ? `${value} hour${value === 1 ? '' : 's'} a night`
        : `${value.toLocaleString('en-AU')} steps a day`
  const noun = metric === 'water' ? 'water' : metric === 'sleep' ? 'sleep' : 'step'
  return {
    payload,
    title: `Set ${noun} goal to ${label}`,
    summary: `Updates your daily ${noun} goal to ${label}. Nothing changes until you confirm.`,
    message: `Want me to set your ${noun} goal to ${label}? Tap confirm and I'll update it.`,
  }
}

const _GOAL_WEIGHT_PHRASE = /\b(goal|target|aim(?:ing)?(?:\s+for)?)\s+(?:body\s+)?weight\b|\bweight\s+(?:goal|target)\b/i
const _WEIGHT_NUM = /(\d+(?:\.\d+)?)\s*(kg|kgs|kilo(?:gram)?s?|lb|lbs|pound(?:s)?)?/i

/**
 * Deterministic fallback for "set my goal weight to N kg/lb" (Capability Plan §2 — update goal/body
 * target). Same rationale as synthesizeWellnessGoalProposal: guarantee the confirm card even when
 * flash-lite asks in prose. Prefers the number after "to " (weight sentences often also name the
 * CURRENT weight), converts lb→kg, and refuses relative ("by 2 kg") or out-of-range values.
 */
export function synthesizeGoalWeightProposal(userMessage: string): SynthProfileGoalProposal | null {
  if (typeof userMessage !== 'string') return null
  const m = userMessage.toLowerCase()
  if (!_WELLNESS_SET_INTENT.test(m) || !_GOAL_WEIGHT_PHRASE.test(m)) return null
  if (/\bby\s+\d/.test(m)) return null // relative change — needs the current value; let the model handle it
  const phraseAt = m.search(_GOAL_WEIGHT_PHRASE)
  const afterPhrase = phraseAt >= 0 ? m.slice(phraseAt) : m
  // Prefer "…to <n>"; else the first weight-like number appearing after the goal-weight phrase.
  const num = m.match(new RegExp(`\\bto\\s+${_WEIGHT_NUM.source}`, 'i')) || afterPhrase.match(_WEIGHT_NUM)
  if (!num) return null
  let kg = parseFloat(num[1])
  if (!Number.isFinite(kg)) return null
  const unit = (num[2] || '').toLowerCase()
  if (/^(lb|pound)/.test(unit)) kg = kg / 2.2046226218 // pounds → kg
  kg = Math.round(kg * 10) / 10
  const payload = { action: 'set_goal_weight' as const, valueKg: kg }
  if (!validateWorkoutActionPayload(payload).ok) return null
  const label = `${kg} kg`
  return {
    payload,
    title: `Set goal weight to ${label}`,
    summary: `Updates your goal weight to ${label} and reflects it in your weight projections. Nothing changes until you confirm.`,
    message: `Want me to set your goal weight to ${label}? Tap confirm and I'll update it.`,
  }
}

export interface SynthExerciseNavProposal {
  overlay: 'exerciseDetail'
  /** The user's raw phrasing, passed through — the CLIENT resolves it to a real exercise id (it owns the
   *  exercise DB) and suppresses the card if it doesn't match, so nothing here needs the DB. */
  exercise: string
  title: string
  summary: string
  message: string
}

// A genuine "how to PERFORM this lift" / form / technique request. Deliberately excludes non-exercise
// "how do i (know|get|get past|feel|fix)…" questions (overtraining, a plateau, motivation) which must
// not trigger an exercise technique guide. A bare "how do i <movement>" (squat, deadlift…) still counts.
const _EXERCISE_HELP_INTENT =
  /\b(form|technique|proper\s+form|cues?\s+for|form\s+cues?|show\s+me\s+how|demonstrate|walk\s+me\s+through|teach\s+me\s+(?:how|to)|how\s+(?:do\s+i|to|should\s+i|can\s+i)\s+(?:do|perform|execute|squat|deadlift|bench|press|row|curl|lunge|hinge))\b/i

/**
 * Deterministic backstop for "show me how to do the bench press" (Capability Plan §7 — open the
 * exercise detail). flash-lite tends to ANSWER in prose without emitting the navigation proposal, so
 * the form‑guide card never appears. When the message is a clear how‑to / form / technique request we
 * synthesise a navigation proposal, passing the message through as `exercise`; the client resolves it
 * to a real lift (`resolveExerciseRef`) and only renders the card if it matches — so a non‑exercise
 * how‑to ("how do i log a workout") simply shows no card. Returns null when there's no how‑to intent.
 */
export function synthesizeExerciseDetailNav(userMessage: string): SynthExerciseNavProposal | null {
  if (typeof userMessage !== 'string') return null
  const m = userMessage.trim()
  if (!m || !_EXERCISE_HELP_INTENT.test(m)) return null
  return {
    overlay: 'exerciseDetail',
    exercise: m.slice(0, 120),
    title: 'Open the technique guide',
    summary: 'Opens the step-by-step cues, the common mistake to avoid and a form clip for this lift.',
    message: "Here's the technique guide. Open it for the step-by-step cues and a form clip.",
  }
}

/** A program lift with its app-reviewed technique, for the deterministic technique answer. */
export interface TechniqueExercise {
  id: string
  name: string
  whatItDoes?: string
  steps?: string[]
  commonMistake?: string
  safetyNote?: string
}

/**
 * DETERMINISTIC technique answer. flash-lite unreliably picks the RIGHT lift's cues when several
 * exercises sit in context (it will give squat cues for a bench-press question), so when the user
 * asks how to perform a SPECIFIC program lift we build the answer straight from that lift's reviewed
 * fields — correct exercise guaranteed. Matches the named lift against the program by token overlap
 * (equipment words rarely appear, so they just score 0). Returns null when there is no how-to intent
 * or no confident match, so the model reply + the guide card stand. Never invents cues.
 */
export function synthesizeTechniqueAnswer(userMessage: string, exercises: TechniqueExercise[]): string | null {
  if (typeof userMessage !== 'string' || !Array.isArray(exercises) || !exercises.length) return null
  const m = userMessage.trim()
  if (!m || !_EXERCISE_HELP_INTENT.test(m)) return null
  const msgTokens = new Set(m.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).map((w) => w.replace(/s$/, '')).filter((w) => w.length >= 3))
  let best: { ex: TechniqueExercise; score: number } | null = null
  for (const ex of exercises) {
    if (!ex || typeof ex.name !== 'string') continue
    const nameTokens = ex.name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).map((w) => w.replace(/s$/, '')).filter((w) => w.length >= 3)
    const score = nameTokens.reduce((n, t) => n + (msgTokens.has(t) ? 1 : 0), 0)
    if (score > 0 && (!best || score > best.score)) best = { ex, score }
  }
  if (!best) return null
  const ex = best.ex
  const cues = Array.isArray(ex.steps) ? ex.steps.slice(0, 3).map((c) => String(c).trim()).filter(Boolean) : []
  if (!cues.length && !ex.commonMistake) return null
  const lines: string[] = []
  lines.push(`${ex.name}: ${ex.whatItDoes ?? ''}`.trim())
  if (cues.length) lines.push(`Key cues: ${cues.join(' ')}`)
  if (ex.commonMistake) lines.push(`Common mistake to avoid: ${ex.commonMistake}`)
  lines.push('Open the guide below for the full walkthrough and a form clip.')
  return lines.join(' ')
}

/**
 * A tiny deterministic answer for the common "how low / how deep should I squat" depth question, which
 * the small model tends to misread as a reps-in-reserve question. Dash-free. Returns null otherwise.
 */
export function synthesizeDepthFactAnswer(userMessage: string): string | null {
  if (typeof userMessage !== 'string') return null
  const t = userMessage.toLowerCase()
  if (/\bhow\s+(?:low|deep|far\s+down)\b/.test(t) && /\bsquat/.test(t)) {
    return 'For squats, aim to break at least to parallel, where your hip crease drops to about the top of your knees, and go deeper if you can keep a neutral spine and your heels flat. A full, controlled range of motion builds more than piling on weight with a shallow one.'
  }
  return null
}

/* ------------------------------------------------------------------ */
/*  Deterministic MEAL-PLAN REVIEW synthesiser                         */
/* ------------------------------------------------------------------ */

/**
 * Reliable qualitative review of the user's OWN saved meal plan, for when the flash-lite classifier
 * flakily refers a genuine review to the meal_plan refusal. Given the plan text (the "This week's
 * planned meals" context) and the user's goal, it computes a QUALITATIVE rating out of 10 plus
 * goal-framed feedback read from the actual meals — and NEVER emits a calorie or macro number
 * (nutrition is qualitative in this app). Returns null when there is no plan to read.
 *
 * The CALLER is responsible for only invoking this on a genuine own-plan REVIEW intent (never a
 * from-scratch CREATION request); this function assumes that gate has already passed.
 */
function mealGoalKind(goal: string): 'muscle' | 'fatloss' | 'strength' | 'general' {
  const g = (goal || '').toLowerCase()
  if (/muscle|hypertroph|build|bulk|gain|mass/.test(g)) return 'muscle'
  if (/fat|lose|loss|cut|lean|slim|deficit|weight.?loss/.test(g)) return 'fatloss'
  if (/strength|stronger|power|1rm/.test(g)) return 'strength'
  return 'general'
}

export function synthesizeMealPlanReview(mealPlanText: string | undefined, goal: string): string | null {
  const plan = typeof mealPlanText === 'string' ? mealPlanText.trim() : ''
  if (plan.length < 8) return null
  const t = plan.toLowerCase()
  const count = (...ws: string[]) => ws.reduce((n, w) => n + (t.split(w).length - 1), 0)
  const protein = count('chicken', 'beef', 'salmon', 'tuna', 'fish', 'egg', 'yoghurt', 'yogurt', 'turkey', 'beans', 'tofu', 'steak', 'mince', 'prawn', 'lamb', 'protein')
  const veg = count('broccoli', 'greens', 'salad', 'spinach', 'veg', 'pepper', 'carrot', 'tomato', 'kale', 'courgette', 'zucchini', 'mushroom')
  const fruit = count('banana', 'berries', 'berry', 'fruit', 'apple', 'orange', 'mango')
  const carbs = count('rice', 'oats', 'pasta', 'potato', 'noodle', 'bread', 'toast', 'granola', 'wrap', 'quinoa', 'couscous')
  const indulgent = count('pizza', 'takeaway', 'take away', 'burger', 'chips', 'fries', 'fried', 'kebab', 'soft drink', 'soda', 'doughnut', 'donut')

  let score = 5
  if (protein >= 5) score += 2
  else if (protein >= 3) score += 1
  else if (protein <= 1) score -= 1
  if (veg + fruit >= 3) score += 1
  else if (veg + fruit === 0) score -= 1
  if (carbs >= 4) score += 1
  if (indulgent === 0) score += 1
  else if (indulgent >= 3) score -= 1
  score = Math.max(3, Math.min(9, score))

  const kind = mealGoalKind(goal)
  const goalName = kind === 'muscle' ? 'building muscle' : kind === 'fatloss' ? 'losing fat' : kind === 'strength' ? 'getting stronger' : 'staying healthy'

  const strengths: string[] = []
  if (protein >= 3) strengths.push('a solid spread of protein')
  if (veg + fruit >= 2) strengths.push('good veg and fruit')
  if (carbs >= 3) strengths.push('decent carbs for energy')
  const strengthsText = strengths.length ? strengths.join(', ') : 'some good building blocks'

  let improvement: string
  if (kind === 'muscle') {
    improvement = protein < 3 ? 'lean on protein a bit harder at each meal, chicken, fish, eggs or yoghurt, since muscle is built on it'
      : carbs < 3 ? 'add a carb like rice, oats or potatoes around your training days to fuel sessions and recover'
      : indulgent >= 3 ? 'swap one or two of the takeaway meals for a home-cooked plate to keep the quality high'
      : 'keep protein at every meal and a carb around training, that combination is what drives muscle gain'
  } else if (kind === 'fatloss') {
    improvement = indulgent >= 2 ? 'trim the takeaway meals back and lean on the leaner home-cooked options to hold a slight deficit'
      : protein < 3 ? 'keep protein high at each meal, it protects muscle and keeps you full while you lean out'
      : 'lead with protein and veg and keep portions sensible, that keeps the deficit comfortable'
  } else if (kind === 'strength') {
    improvement = protein < 3 ? 'get protein into every meal to support recovery between heavy sessions'
      : 'keep enough carbs in on training days so you have the energy to move heavy loads'
  } else {
    improvement = veg + fruit < 2 ? 'add a bit more veg or fruit across the week for variety'
      : indulgent >= 3 ? 'balance the takeaway meals with a few more home-cooked plates'
      : 'nice variety, keep it balanced and consistent'
  }

  return `I'd give your planned meals a ${score}/10 for ${goalName}. You've got ${strengthsText}. To make it work harder for your goal, ${improvement}. This is a qualitative read of your own plan, not calorie or macro targets.`
}

/* ------------------------------------------------------------------ */
/*  SEMANTIC proposal guard (run at SURFACING time)                    */
/* ------------------------------------------------------------------ */

export interface ProposalSurfacingContext {
  /** Every exercise id that actually exists in the workbook database. */
  validExerciseIds: ReadonlySet<string>
  /** The "recent PRs" snapshot line (may be empty), used to sanity-check share_pr proposals. */
  recentPRsText: string
}

/**
 * A model-emitted `workout_action` proposal has already passed the SHAPE + id-FORMAT gate
 * (`validateWorkoutActionPayload`). This second gate runs at SURFACING time (before the confirm card
 * is shown) and checks the ids/values are REAL against the user's data, so the coach never:
 *   • offers to swap in an exercise id that does not exist in the database (AD09), or
 *   • offers to publish a personal record the user has not logged, or one implausibly beyond their
 *     logged bests (AD07).
 * Returns null when the proposal is safe to surface, or a reason + an honest line to show INSTEAD of
 * the proposal. Higher-tier crisis/safety routing is upstream and unaffected.
 */
export function proposalSurfacingIssue(
  payload: Record<string, unknown> | null | undefined,
  ctx: ProposalSurfacingContext,
): { reason: string; coachLine: string } | null {
  const action = payload && typeof payload === 'object' ? String((payload as Record<string, unknown>).action ?? '') : ''
  if (action === 'swap') {
    const from = String((payload as Record<string, unknown>).fromExerciseId ?? '')
    const wantedRaw = (payload as Record<string, unknown>).wantedExerciseId
    const wanted = wantedRaw != null ? String(wantedRaw) : ''
    if (from && !ctx.validExerciseIds.has(from)) {
      return { reason: 'swap_unknown_from', coachLine: "I can't set that swap up: I don't recognise an exercise with that id. Tell me the exercise by name and I'll match it to a real, safe option from your program." }
    }
    if (wanted && !ctx.validExerciseIds.has(wanted)) {
      return { reason: 'swap_unknown_wanted', coachLine: "I won't swap that in: I don't recognise an exercise with that id in the database. Name the exercise you'd like and I'll find a real, safe match." }
    }
  }
  if (action === 'share_pr') {
    const logged = (ctx.recentPRsText.match(/(\d+(?:\.\d+)?)\s*kg/gi) ?? []).map((s) => parseFloat(s)).filter((n) => Number.isFinite(n) && n > 0)
    const prValue = Number((payload as Record<string, unknown>).prValue)
    const noLoggedPRs = logged.length === 0
    const loggedMax = logged.length ? Math.max(...logged) : 0
    // Reject when there's nothing logged to celebrate, or the claimed value is implausibly beyond the
    // user's own logged bests (an un-logged / fabricated PR — AD07). The tolerance leaves genuine PRs
    // (a few kg over the last best) alone.
    const implausible = Number.isFinite(prValue) && (prValue > loggedMax * 1.5 + 20 || prValue > 500)
    if (noLoggedPRs || implausible) {
      return { reason: 'pr_unbacked', coachLine: "I can only celebrate a personal record you've actually logged, and I don't see that one in your recent sessions, so I won't post it. Log the lift and I'll help you share a real PR." }
    }
  }
  return null
}

/** The coach's fixed refusal for a fabricated exercise id (AD09), shared so the conversational-path
 *  guard and any future caller stay identical. */
export const FABRICATED_EXERCISE_ID_LINE =
  "I don't recognise an exercise with that id, so I won't swap it in. Tell me the exercise by name and I'll match it to a real, safe option from your program."

/**
 * AD09 conversational-path guard. Real exercise ids have the shape `[A-Z]{2}\d{2}` (e.g. CH01), so a
 * fabricated id like `ZZ99` is *shaped* like a real one and can only be caught by checking it against
 * the real exercise set. `proposalSurfacingIssue` above only fires when the model emits a structured
 * `workout_action`; when the model answers CONVERSATIONALLY (no proposal) it can still offer to "swap
 * in ZZ99". This catches an id-shaped token that is NOT a real exercise when the user frames it as an
 * exercise or as a swap/replace/sub-in target — regardless of whether a proposal was emitted — so the
 * coach never treats a made-up id as real.
 *
 * `validExerciseIds` is the GLOBAL exercise universe (every real id — see `VALID_EXERCISE_IDS`), so a
 * real exercise the user does not currently have still swaps in fine; only ids that exist in NO
 * exercise are refused. Returns the offending upper-cased token, or null. Bare `id`/`sub`/`add` and
 * digit-led training notation (`3x5`, `5RM`, `80kg`) deliberately do NOT match.
 */
export function fabricatedExerciseIdInMessage(message: string, validExerciseIds: ReadonlySet<string>): string | null {
  if (validExerciseIds.size === 0) return null // no-snapshot path (tests / empty context)
  const notReal = (tok: string): boolean => !validExerciseIds.has(tok.toUpperCase())
  // (a) framed as an exercise, in ANY context: "exercise ZZ99", "movement AB12", "lift ZZ01".
  const framed = message.match(/\b(?:exercise|movement|lift)\s+(?:number\s+|id\s+)?([A-Za-z]{2}\d{2})\b/i)
  if (framed && notReal(framed[1])) return framed[1].toUpperCase()
  // (b) in an exercise-SWAP context, ANY id-shaped token that is not a real exercise is fabricated —
  // this covers both the swapped-in and the swapped-for target ("swap out CH01 for QZ77"). Bare
  // `use`/`add` and digit-led notation (`3x5`, `5RM`, `80kg`) do not qualify.
  if (/\b(?:swap\w*|replac\w*|substitut\w*|sub\s+in|sub\s+out|put\s+in)\b/i.test(message)) {
    for (const tok of message.match(/\b[A-Za-z]{2}\d{2}\b/g) ?? []) {
      if (notReal(tok)) return tok.toUpperCase()
    }
  }
  return null
}
