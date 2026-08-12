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

/** One candidate coach message plus whether it's worth the coach reaching out about UNPROMPTED. */
type CoachCandidate = { msg: CoachMessage; proactive: boolean } | null

/**
 * The ordered ladder of live, data-driven coach messages. `coachDaily` returns the first that
 * fires (falling back to a generic greeting); `proactiveCheckin` returns the first that fires AND
 * is marked `proactive`. Keeping one ladder means the daily message and the proactive check-in can
 * never drift apart in copy or priority.
 */
function coachCandidates(s: AppState): CoachCandidate[] {
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
  const at = (msg: CoachMessage, proactive: boolean): CoachCandidate => ({ msg, proactive })

  return [
    // 1. Exam season takes priority. Protect study and sleep. (Proactive: a plan shift worth surfacing.)
    exam.active
      ? at(
          exam.phase === 'approaching'
            ? msg(
                'exam',
                'Exams are close',
                `I've shifted your plan toward maintenance and shorter sessions, ${name}. The goal now is to hold what you've built while you study, not chase new records.`,
                { label: 'See exam plan', overlay: 'examMode' },
              )
            : msg(
                'exam',
                'Exam season, keep it light',
                'Three key lifts and a good night of sleep is a full win right now. Show up, move, then get back to studying. We ramp back up after.',
                { label: 'Exam plan', overlay: 'examMode' },
              ),
          true,
        )
      : null,

    // 2. Celebrate a real, fresh PR from logged data. (Proactive: a genuine win.)
    pr
      ? at(
          msg(
            'celebration',
            'That was a personal best',
            `${pr.name} at ${fmtW(pr.weightKg)} for ${pr.reps} is the strongest you've logged. That is real progress, ${name}. Take the win.`,
          ),
          true,
        )
      : null,

    // 3. Streak at risk on a training day. NOT proactive: the dashboard already surfaces its own
    //    streak-at-risk nudge, so the coach doesn't double up on it.
    session && !session.completed && streak.current >= 3
      ? at(
          msg(
            'nudge',
            `Keep the ${streak.current} day streak going`,
            `Today is ${session.name.toLowerCase()}. If you're short on time, just do the first three lifts. Twenty minutes still counts.`,
            { label: 'Start workout', overlay: 'activeWorkout' },
          ),
          false,
        )
      : null,

    // 4. Back after a gap. Reassure, do not scold. (Proactive: a re-engagement moment.)
    streak.current === 0 && streak.best > 0
      ? at(
          msg(
            'checkin',
            'Good to see you back',
            'Last week slipped and that is completely normal. One session today and you are rolling again. Let us just start.',
            { label: 'Quick session', overlay: 'quick' },
          ),
          true,
        )
      : null,

    // 5. Milestone moments from real counts. (Proactive: a milestone worth noting.)
    totalWorkouts > 0 && totalWorkouts % 10 === 0
      ? at(msg('celebration', `${totalWorkouts} sessions in`, `You are not starting anymore, ${name}, you are training. Consistency like this is exactly what builds results.`), true)
      : null,

    // 6. Warm, data-aware check in. Sleep-solid is positive but has no action → NOT proactive.
    hc.avgSleep >= s.profile.sleepTargetH - 0.4
      ? at(msg('checkin', 'Sleep has been solid', 'Your sleep this week has been on point, and that is a big reason the weights are moving. Keep protecting it.'), false)
      : null,

    // 7. Actionable recovery nudge — hydration low. (Proactive: a small, useful action.)
    habit.waterL < s.profile.waterTargetL * 0.6
      ? at(msg('checkin', 'Easy win today', 'Water has been a little low. Fill a bottle now and you will train and focus better this afternoon.', { label: 'Log water', overlay: 'logHabit' }), true)
      : null,
  ]
}

/** The generic fallback greeting when no specific signal fired. Never a proactive moment on its own. */
function coachGeneric(s: AppState): CoachMessage {
  const name = s.profile.name
  const streak = streakStats(s)
  const totalWorkouts = completedSessions(s).length
  return {
    id: 'coach-today',
    dateKey: todayKey,
    kind: 'checkin',
    title: `Morning, ${name}`,
    body: `You have logged ${totalWorkouts} sessions and held a ${streak.best} day best streak. Steady beats perfect. Let us add one more good day.`,
  }
}

/** The single most relevant coach message for today. Computed live, never stored. */
export function coachDaily(s: AppState): CoachMessage {
  const first = coachCandidates(s).find((c): c is NonNullable<CoachCandidate> => c !== null)
  return first ? first.msg : coachGeneric(s)
}

/**
 * A PROACTIVE check-in — the delivery behind the "Proactive check-ins" preference. It reuses the
 * same live signal ladder as the daily message, but only surfaces the ones worth the coach
 * reaching out about unprompted: a fresh PR, a return after a gap, a milestone, an exam-season plan
 * shift, or an actionable recovery nudge. Returns null when there's nothing genuinely relevant — the
 * generic greeting, the "sleep has been solid" note, and the streak-at-risk nudge (already shown on
 * the dashboard) never fire here, so a proactive card only ever appears when it earns its place.
 *
 * Gating (the `proactiveEnabled` preference) and once-per-day throttling live in the caller.
 */
export function proactiveCheckin(s: AppState): CoachMessage | null {
  const first = coachCandidates(s).find((c): c is NonNullable<CoachCandidate> => c !== null && c.proactive)
  return first ? first.msg : null
}

/** Coach thread for the dedicated view: today live, then seeded history. */
export function coachThreadView(s: AppState): CoachMessage[] {
  return [coachDaily(s), ...s.coachThread]
}

/** What to call the coach in the UI — the user's chosen name (profile.coachName), or "Coach" by
 *  default. Single source of truth so the name pulls through everywhere the coach is shown. */
export function coachDisplayName(coachName?: string | null): string {
  return (coachName ?? '').trim() || 'Coach'
}
