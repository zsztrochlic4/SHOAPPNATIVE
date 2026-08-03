/**
 * Plan Around Your Life — the user's declared busy periods (exams, travel, moving
 * house) and how training bends around each one.
 *
 * This is the app-side model behind the dashboard's "When is your busy period?"
 * card and the hub flow it opens. It maps 1:1 onto the backend's
 * `PlannedAbsence` (backend/schema.ts) so the generator's Exam Survival Protocol
 * rules (backend/generator/exam.ts) can consume exactly what the user picked —
 * the UI mode ids are the friendly names, `absenceMode` is the canonical one.
 *
 * Nothing here mutates: the reducer owns writes (SAVE_PERIOD / CANCEL_PERIOD /
 * END_PERIOD_EARLY), which also mirror the result into
 * `backendUser.planned_absences`.
 */

import { todayKey, fromKey, toKey, addDays } from '../lib/date'
import type { AbsenceMode, PlannedAbsence } from '../backend/schema'
import type { AppState, PlannedPeriod, PeriodMode } from './types'

export const WEEKDAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

/**
 * Which colour a mode or stat paints itself in. Named rather than resolved so
 * this module (and lib/metrics) stay free of any React/theme import — `accentFor`
 * in theme.tsx turns a key into a real colour for the current palette.
 */
export type AccentKey = 'brand' | 'blue' | 'purple' | 'orange' | 'yellow' | 'fg'

export interface PeriodModeMeta {
  id: PeriodMode
  title: string
  /** One-line "what this is" under the title on the picker card. */
  tag: string
  accent: AccentKey
  /** Icon key resolved by the overlay's local icon map. */
  icon: string
  /** The single-sentence summary used on the active banner and detail sheet. */
  effect: string
  /** Which follow-up step this mode needs, if any. */
  followup: 'maintenance' | 'moving' | 'fewer' | null
  /** The canonical backend mode this maps to (backend/schema.ts). */
  absenceMode: AbsenceMode
}

export const PERIOD_MODES: PeriodModeMeta[] = [
  { id: 'pause', title: 'Full pause', tag: 'No training during this period', accent: 'purple', icon: 'pause', effect: 'No workouts are scheduled', followup: null, absenceMode: 'full_pause' },
  { id: 'maintenance', title: 'Maintenance', tag: 'Two easier full body workouts each week', accent: 'brand', icon: 'heart', effect: 'Two easier full body sessions each week', followup: 'maintenance', absenceMode: 'maintenance' },
  { id: 'moving', title: 'Just keep moving', tag: 'Walking and optional mobility, no lifting', accent: 'blue', icon: 'walk', effect: 'A daily walk prompt, no lifting', followup: 'moving', absenceMode: 'minimal_movement' },
  { id: 'fewer', title: 'Fewer days', tag: 'Train once or twice a week', accent: 'orange', icon: 'fewer', effect: 'One or two full sessions a week', followup: 'fewer', absenceMode: 'reduced_frequency' },
  { id: 'deload', title: 'Planned deload', tag: 'A lighter week, then a pause if longer', accent: 'yellow', icon: 'deload', effect: 'A lighter training week', followup: null, absenceMode: 'active_rest' },
  { id: 'asis', title: 'Keep it as is', tag: 'Same program, no penalty for missed sessions', accent: 'fg', icon: 'lock', effect: 'Your program stays the same', followup: null, absenceMode: 'no_change' },
]

export function modeMeta(id: PeriodMode | null | undefined): PeriodModeMeta | undefined {
  return PERIOD_MODES.find((m) => m.id === id)
}

/** A blank draft, used when adding a period and as the reset for mode switches. */
export function newPeriodDraft(): Omit<PlannedPeriod, 'id'> {
  return { start: '', end: '', mode: null, maintDays: ['Mon', 'Wed'], fewerCount: 1, fewerDays: ['Wed'], movingType: 'walking', note: '' }
}

/** Map a backend `AbsenceMode` (from the coach action resolver) to the UI `PeriodMode`.
 *  Falls back to 'maintenance' for an unrecognised value. */
export function periodModeForAbsence(absenceMode: string): PeriodMode {
  return PERIOD_MODES.find((m) => m.absenceMode === absenceMode)?.id ?? 'maintenance'
}

/* ------------------------------ dates ------------------------------ */

export function daysBetweenKeys(aKey: string, bKey: string): number {
  return Math.round((fromKey(bKey).getTime() - fromKey(aKey).getTime()) / 86400000)
}

/** Days from today until `key` (negative once it's passed). */
export function daysUntil(key: string): number {
  return key ? daysBetweenKeys(todayKey, key) : 0
}

/** Inclusive length of a range, in days. */
export function periodLength(startKey: string, endKey: string): number {
  return !startKey || !endKey || endKey < startKey ? 0 : daysBetweenKeys(startKey, endKey) + 1
}

/** The day after `key` — when normal training returns. Empty in, empty out. */
export function nextDayKey(key: string): string {
  return key ? toKey(addDays(fromKey(key), 1)) : ''
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** The design's date format: "Wed 3 Aug". */
export function fmtPeriodDate(key: string): string {
  if (!key) return 'Not set'
  const d = fromKey(key)
  return `${WD[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export function periodRangeText(startKey: string, endKey: string): string {
  return `${fmtPeriodDate(startKey)} to ${fmtPeriodDate(endKey)}`
}

/** "today" / "tomorrow" / "in 12 days". */
export function daysLabel(n: number): string {
  if (n <= 0) return 'today'
  if (n === 1) return 'tomorrow'
  return `in ${n} days`
}

/* ------------------------------ reads ------------------------------ */

/**
 * Every declared period, oldest first.
 *
 * Saves made before this feature existed only carried a flat list of exam dates.
 * Rather than drop them, they're surfaced here as a single maintenance period
 * spanning the first to the last date — read-only, so nothing is rewritten until
 * the user actually edits something.
 */
export function plannedPeriods(s: AppState): PlannedPeriod[] {
  if (s.plannedPeriods) return [...s.plannedPeriods].sort((a, b) => a.start.localeCompare(b.start))
  const legacy = legacyPeriod(s)
  return legacy ? [legacy] : []
}

function legacyPeriod(s: AppState): PlannedPeriod | null {
  const p = s.profile
  if (!p.examMode) return null
  const dates = p.examDates?.length ? [...p.examDates].sort() : null
  const start = dates?.[0] ?? p.examStartKey
  const end = dates?.at(-1) ?? p.examEndKey
  if (!start || !end) return null
  return { id: 'legacy-exams', start, end, mode: 'maintenance', maintDays: ['Tue', 'Thu'], fewerCount: 1, fewerDays: [], movingType: 'both', note: 'Exams' }
}

/** The period today falls inside, if any. */
export function activePeriod(s: AppState): PlannedPeriod | null {
  return plannedPeriods(s).find((p) => p.start <= todayKey && p.end >= todayKey) ?? null
}

/** Everything that hasn't started yet, soonest first. */
export function upcomingPeriods(s: AppState): PlannedPeriod[] {
  return plannedPeriods(s).filter((p) => p.start > todayKey)
}

/** The title a period shows in lists — its note, or a neutral fallback. */
export function periodTitle(p: PlannedPeriod): string {
  return (p.note ?? '').trim() || 'Busy period'
}

/**
 * Does this draft collide with a period the user already has? Two busy periods
 * can't overlap — the second one would silently win.
 */
export function overlapsExisting(s: AppState, draft: { start: string; end: string }, ignoreId?: string | null): boolean {
  if (!draft.start || !draft.end) return false
  return plannedPeriods(s).some((p) => p.id !== ignoreId && draft.start <= p.end && draft.end >= p.start)
}

/** The one blocking problem with a draft's dates, or null when they're usable. */
export function dateIssue(s: AppState, draft: { start: string; end: string }, ignoreId?: string | null): string | null {
  if (!draft.start || !draft.end) return null
  if (draft.end < draft.start) return 'End date cannot be before the start date.'
  if (draft.end < todayKey) return 'That period has already passed. Choose upcoming dates.'
  if (overlapsExisting(s, draft, ignoreId)) return 'That overlaps an existing period. Edit that one or pick different dates.'
  return null
}

/** The days the user normally trains, e.g. ['Mon','Wed','Fri']. */
export function normalTrainingDays(s: AppState): string[] {
  const days = s.program.filter((d) => !d.rest).map((d) => d.day)
  return days.length ? days : ['Mon', 'Wed', 'Fri']
}

/**
 * The plain-English "what happens to your training" bullets for a period. Shown
 * on the review step before anything is committed, so the user confirms the
 * actual consequences rather than a mode name.
 */
export function whatHappens(p: Pick<PlannedPeriod, 'mode' | 'start' | 'end' | 'maintDays' | 'fewerCount' | 'fewerDays' | 'movingType'>): string[] {
  const out: string[] = []
  const days = periodLength(p.start, p.end)
  if (p.mode === 'pause') {
    out.push('No workouts are scheduled')
    out.push('Your loads and progression are saved')
    if (days > 14) out.push('A one week return ramp eases you back in')
  } else if (p.mode === 'maintenance') {
    out.push('Two easier full body sessions each week')
    out.push(`On ${p.maintDays.join(' and ') || 'your chosen days'}`)
    out.push('Loads held, sets reduced, progression paused')
  } else if (p.mode === 'moving') {
    out.push({ walking: 'A daily walking prompt', mobility: 'Daily mobility sessions', both: 'Walking plus optional mobility' }[p.movingType])
    out.push('No lifting during this period')
  } else if (p.mode === 'fewer') {
    out.push(`${p.fewerCount === 1 ? 'One session' : 'Two sessions'} a week`)
    out.push(`On ${p.fewerDays.join(' and ') || 'your chosen days'}`)
    out.push('Loads held at your current level')
  } else if (p.mode === 'deload') {
    if (days > 7) {
      out.push('The first week is a lighter deload')
      out.push('The remaining days are a full pause')
    } else {
      out.push('A lighter training week, then back to normal')
    }
  } else if (p.mode === 'asis') {
    out.push('Your program stays exactly the same')
  }
  out.push('Missed sessions will not be penalised')
  return out
}

/** Is the mode's follow-up step answered well enough to continue? */
export function followupValid(p: Pick<PlannedPeriod, 'mode' | 'maintDays' | 'fewerCount' | 'fewerDays'>): boolean {
  if (p.mode === 'maintenance') return p.maintDays.length >= 1 && p.maintDays.length <= 2
  if (p.mode === 'fewer') return p.fewerDays.length === p.fewerCount
  return true
}

/* --------------------------- backend bridge --------------------------- */

/** Project a period onto the canonical `PlannedAbsence` the generator reads. */
export function toPlannedAbsence(p: PlannedPeriod): PlannedAbsence {
  const meta = modeMeta(p.mode)
  const status = p.end < todayKey ? 'completed' : p.start <= todayKey ? 'active' : 'scheduled'
  return {
    absence_id: p.id,
    start_date: p.start,
    end_date: p.end,
    mode_id: meta?.absenceMode ?? 'no_change',
    note: (p.note ?? '').trim() || undefined,
    status,
  }
}
