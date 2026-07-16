/**
 * Calendar adaptation — Generator Flow step 11 (runtime).
 * Source: sheet "Schedule Rules" SCH07 (missed session), SCH08 (recurring conflict), SCH10
 * (planned-absence exemption) + Claude Code Notes CC01 (editable/reschedulable days) and
 * CC02 (catch-up). The program bends instead of snapping — nobody restarts a week over one
 * bad Tuesday, and a day declared busy in advance never counts as a miss. Deterministic;
 * returns the recommended action for the app to apply (which then re-runs the scheduler).
 */

import { buildSchedule, type ScheduleResult } from './schedule'
import type { Commitment, Weekday } from '../schema'

export type MissAction = 'exempt' | 'shift_forward' | 'fold_into_next' | 'replan'

export interface MissedInput {
  missedDate: string        // ISO
  nextSessionDate: string   // ISO of the next scheduled session
  /** ISO dates covered by an active planned_absence (SCH10). */
  plannedAbsenceDates?: string[]
  /** How many weeks running this same session has been missed (SCH08). */
  missStreakForDayType?: number
}

export interface MissResult { action: MissAction; note: string }

const hoursBetween = (a: string, b: string) => Math.abs(new Date(b).getTime() - new Date(a).getTime()) / 3.6e6

/** Decide how to handle a missed session (SCH07/08/10 + CC02). */
export function catchUpMissedSession(input: MissedInput): MissResult {
  // SCH10 — a planned absence is never a miss.
  if (input.plannedAbsenceDates?.includes(input.missedDate.slice(0, 10))) {
    return { action: 'exempt', note: 'You told us about this day in advance — it doesn’t count as a missed session, and nothing reschedules.' }
  }
  // SCH08 — same session missed 3 weeks running → treat the day as unavailable, re-plan, suggest.
  if ((input.missStreakForDayType ?? 0) >= 3) {
    return { action: 'replan', note: 'This session keeps slipping three weeks running — let’s move it. We’ll re-plan around your real week rather than keep marking it missed.' }
  }
  // SCH07 — next session >24h away → shift the week forward a day; otherwise fold the two
  // highest-priority slots into the next compatible session (CC02 catch-up).
  if (hoursBetween(input.missedDate, input.nextSessionDate) > 24) {
    return { action: 'shift_forward', note: 'Shifted your week forward a day so nothing’s lost — your next session just moves along.' }
  }
  return { action: 'fold_into_next', note: 'We’ll fold this session’s two most important exercises into your next one so the key work still happens.' }
}

/**
 * CC01 — reschedule a single training day (move one weekday to another) or edit the whole
 * available-days set, then re-run the scheduler. Progression_state is preserved by the
 * caller (this only re-places day types onto the calendar).
 */
export function rescheduleDays(
  dayStructure: string[],
  currentDays: Weekday[],
  change: { move?: { from: Weekday; to: Weekday }; setDays?: Weekday[] },
  commitments: Commitment[],
): ScheduleResult {
  let days = change.setDays ?? [...currentDays]
  if (change.move) days = days.map((d) => (d === change.move!.from ? change.move!.to : d))
  // Dedupe + canonical order.
  const uniq = [...new Set(days)]
  return buildSchedule(dayStructure, uniq, commitments)
}
