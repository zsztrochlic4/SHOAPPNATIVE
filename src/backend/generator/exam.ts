/**
 * Exam Survival Protocol — planned absence (Generator Flow step 4/11, runtime).
 * Source: sheet "Exam Survival Protocol". The user declares a future date range and a mode;
 * the generator applies a deterministic rule to every session inside the range, then
 * restores the normal program automatically. Progress is protected — nothing below
 * full_pause loses strength, and even full_pause freezes rather than resets. progression_state
 * is NEVER wiped by an absence. HARD_SAFETY rules are never relaxed inside a range, and a
 * stop symptom still triggers S06. Deterministic.
 */

import type { AbsenceMode, PlannedAbsence, UserDoc } from '../schema'
import { generateProgram, type GeneratedProgram } from './generate'
import { adjustProgram, DELOAD } from './deload'
import { selectSplit } from './select'

/** More-conservative-wins ordering for overlapping ranges (sheet: overlaps take the more conservative mode). */
const CONSERVATISM: AbsenceMode[] = ['full_pause', 'minimal_movement', 'active_rest', 'maintenance', 'reduced_frequency', 'no_change']
export function mostConservative(modes: AbsenceMode[]): AbsenceMode {
  return CONSERVATISM.find((m) => modes.includes(m)) ?? 'no_change'
}

const daysBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)

export interface AbsencePlan {
  mode: AbsenceMode
  /** Training that runs INSIDE the range (null = no lifting scheduled). */
  program: GeneratedProgram | null
  /** True for modes that keep the loads/progression untouched (all except a reset, which none do). */
  loadsHeld: boolean
  /** SCH10: the range suppresses missed-session penalties (SCH07/08) for its dates. */
  suppressesPenalties: boolean
  /** A one-week re-entry ramp (rir+1, sets −40%) runs on return after a long pause. */
  reEntryRamp: boolean
  notes: string[]
}

/**
 * Apply a planned absence and return what training looks like inside the range plus the
 * restore behaviour. Modes that need a program regenerate through generateProgram (so all
 * safety/volume rules still apply) and then transform.
 */
export function applyPlannedAbsence(user: UserDoc, absence: PlannedAbsence): AbsencePlan {
  const rangeDays = Math.max(1, daysBetween(absence.start_date, absence.end_date) + 1)
  const longPause = rangeDays > 14
  const base = { mode: absence.mode_id, loadsHeld: true, suppressesPenalties: true, reEntryRamp: false, notes: [] as string[] }

  switch (absence.mode_id) {
    case 'full_pause': {
      const reEntry = longPause
      return { ...base, program: null, reEntryRamp: reEntry, notes: [
        'Program frozen — no sessions in this range. On return you resume the exact next session at the same loads.',
        reEntry ? 'This pause is longer than ~2 weeks, so the return week runs at RIR +1 and 40% fewer sets to ease back in.' : 'Under ~2 weeks loses almost nothing.',
      ] }
    }
    case 'maintenance': {
      // FB2 across whatever days are available, loads held, sets −40%, +1 RIR.
      const gen = generateProgram(user, { dayStructure: ['Full', 'Full'] })
      const program = gen.ok ? adjustProgram(gen.program, DELOAD, 'EXAM_MAINT') : null
      return { ...base, program, notes: ['Maintenance: two short full-body sessions a week, loads held, sets −40%, +1 RIR. Fully maintains strength and muscle at minimal fatigue (recommended default for exams).'] }
    }
    case 'minimal_movement':
      return { ...base, program: null, notes: ['No lifting — a daily low-effort movement prompt instead (a 20–40 min walk / step goal, optional mobility). Logged as activity, zero fatigue, keeps the habit alive.'] }
    case 'reduced_frequency': {
      // Keep content but compress to 1–2 highest-value sessions; loads held, normal reps.
      const reducedDays = Math.min(2, user.days_available.length)
      const sel = selectSplit(reducedDays, user.experience, user.goal)
      const gen = generateProgram(user, { dayStructure: sel.dayStructure })
      return { ...base, program: gen.ok ? gen.program : null, notes: ['Fewer days: the 1–2 highest-value sessions this range, loads held, normal reps, a touch more RIR in reserve.'] }
    }
    case 'active_rest': {
      // Scheduled deload for up to one week; a longer range becomes full_pause after week 1.
      const gen = generateProgram(user)
      const program = gen.ok ? adjustProgram(gen.program, DELOAD, 'EXAM_DELOAD') : null
      return { ...base, program, notes: [
        'Planned deload: sets −40%, load held, +1 RIR for up to one week.',
        rangeDays > 7 ? 'Beyond one week the remainder becomes a full pause (frozen, same loads on return).' : 'Often you come back stronger.',
      ] }
    }
    case 'no_change': {
      const gen = generateProgram(user)
      return { ...base, program: gen.ok ? gen.program : null, notes: ['No program change — these days are logged as known-busy so the missed-session logic never flags them as failures.'] }
    }
  }
}
