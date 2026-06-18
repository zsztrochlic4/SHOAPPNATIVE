import { todayKey, dayKey } from '../lib/date'
import { fmtWeightNum, weightUnit } from '../lib/format'
import {
  completedSessions,
  streakStats,
  todayHabit,
  todaySession,
  habitConsistencyWeek,
} from './selectors'
import { examState } from './training'
import type { AppState, CoachMessage, WorkoutSession } from './types'

function est1RM(session: WorkoutSession, defId: string): number {
  const ex = session.exercises.find((e) => e.defId === defId)
  if (!ex) return 0
  return Math.max(0, ...ex.sets.map((set) => set.weightKg * (1 + set.reps / 30)))
}

export type PR = { defId: string; name: string; weightKg: number; reps: number }

/** Did the most recent completed session beat any earlier best for a lift? */
export function recentPR(s: AppState): PR | null {
  const done = completedSessions(s).sort((a, b) => a.dateKey.localeCompare(b.dateKey))
  if (done.length < 2) return null
  const latest = done[done.length - 1]
  if (latest.dateKey < dayKey(2)) return null // only celebrate something fresh
  const earlier = done.filter((x) => x.dateKey < latest.dateKey)

  let best: (PR & { gain: number }) | null = null
  for (const ex of latest.exercises) {
    const now = est1RM(latest, ex.defId)
    const prev = Math.max(0, ...earlier.map((x) => est1RM(x, ex.defId)))
    if (prev > 0 && now > prev + 0.5) {
      const topSet = [...ex.sets].sort((a, b) => b.weightKg - a.weightKg)[0]
      const gain = now - prev
      if (!best || gain > best.gain) {
        best = { defId: ex.defId, name: ex.name, weightKg: topSet.weightKg, reps: topSet.reps, gain }
      }
    }
  }
  return best ? { defId: best.defId, name: best.name, weightKg: best.weightKg, reps: best.reps } : null
}

/** PR check for a specific session (used when finishing a workout). */
export function prForSession(s: AppState, session: WorkoutSession): PR | null {
  const earlier = completedSessions(s).filter((x) => x.id !== session.id)
  let best: (PR & { gain: number }) | null = null
  for (const ex of session.exercises) {
    if (!ex.sets.some((set) => set.done)) continue
    const now = est1RM(session, ex.defId)
    const prev = Math.max(0, ...earlier.map((x) => est1RM(x, ex.defId)))
    if (prev > 0 && now > prev + 0.5) {
      const topSet = [...ex.sets].filter((set) => set.done).sort((a, b) => b.weightKg - a.weightKg)[0]
      const gain = now - prev
      if (topSet && (!best || gain > best.gain)) best = { defId: ex.defId, name: ex.name, weightKg: topSet.weightKg, reps: topSet.reps, gain }
    }
  }
  return best ? { defId: best.defId, name: best.name, weightKg: best.weightKg, reps: best.reps } : null
}

/** The single most relevant coach message for today. Computed live, never stored. */
export function coachDaily(s: AppState): CoachMessage {
  const units = s.settings.units
  const u = weightUnit(units)
  const fmtW = (kg: number) => `${fmtWeightNum(kg, units, units === 'imperial' ? 0 : 1)}${u}`
  const name = s.profile.name
  const streak = streakStats(s)
  const exam = examState(s)
  const session = todaySession(s)
  const pr = recentPR(s)
  const totalWorkouts = completedSessions(s).length
  const hc = habitConsistencyWeek(s)
  const habit = todayHabit(s)

  const msg = (kind: CoachMessage['kind'], title: string, body: string, cta?: CoachMessage['cta']): CoachMessage => ({
    id: 'coach-today',
    dateKey: todayKey,
    kind,
    title,
    body,
    cta,
  })

  // 1. Exam season takes priority. Protect study and sleep.
  if (exam.active) {
    if (exam.phase === 'approaching') {
      return msg(
        'exam',
        'Exams are close',
        `I've shifted your plan toward maintenance and shorter sessions, ${name}. The goal now is to hold what you've built while you study, not chase new records.`,
        { label: 'See exam plan', overlay: 'examMode' },
      )
    }
    return msg(
      'exam',
      'Exam season, keep it light',
      'Three key lifts and a good night of sleep is a full win right now. Show up, move, then get back to studying. We ramp back up after.',
      { label: 'Exam plan', overlay: 'examMode' },
    )
  }

  // 2. Celebrate a real, fresh PR from logged data.
  if (pr) {
    return msg(
      'celebration',
      'That was a personal best',
      `${pr.name} at ${fmtW(pr.weightKg)} for ${pr.reps} is the strongest you've logged. That is real progress, ${name}. Take the win.`,
      { label: 'Share it', overlay: 'createPost' },
    )
  }

  // 3. Streak at risk on a training day.
  if (session && !session.completed && streak.current >= 3) {
    return msg(
      'nudge',
      `Keep the ${streak.current} day streak going`,
      `Today is ${session.name.toLowerCase()}. If you're short on time, just do the first three lifts. Twenty minutes still counts.`,
      { label: 'Start workout', overlay: 'activeWorkout' },
    )
  }

  // 4. Back after a gap. Reassure, do not scold.
  if (streak.current === 0 && streak.best > 0) {
    return msg(
      'checkin',
      'Good to see you back',
      'Last week slipped and that is completely normal. One session today and you are rolling again. Let us just start.',
      { label: 'Quick session', overlay: 'quick' },
    )
  }

  // 5. Milestone moments from real counts.
  if (totalWorkouts > 0 && totalWorkouts % 10 === 0) {
    return msg('celebration', `${totalWorkouts} sessions in`, `You are not starting anymore, ${name}, you are training. Consistency like this is exactly what builds results.`)
  }

  // 6. Warm, data-aware check in.
  if (hc.avgSleep >= s.profile.sleepTargetH - 0.4) {
    return msg('checkin', 'Sleep has been solid', 'Your sleep this week has been on point, and that is a big reason the weights are moving. Keep protecting it.')
  }
  if (habit.waterL < s.profile.waterTargetL * 0.6) {
    return msg('checkin', 'Easy win today', 'Water has been a little low. Fill a bottle now and you will train and focus better this afternoon.', { label: 'Log water', overlay: 'logHabit' })
  }
  return msg(
    'checkin',
    `Morning, ${name}`,
    `You have logged ${totalWorkouts} sessions and held a ${streak.best} day best streak. Steady beats perfect. Let us add one more good day.`,
  )
}

/** Coach thread for the dedicated view: today live, then seeded history. */
export function coachThreadView(s: AppState): CoachMessage[] {
  return [coachDaily(s), ...s.coachThread]
}
