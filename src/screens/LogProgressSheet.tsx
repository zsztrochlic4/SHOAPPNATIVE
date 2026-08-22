/**
 * Log-progress overlay — the modern "Update today's progress" editor exposed as a
 * standalone overlay so anything (e.g. a coach navigation proposal) can open it.
 * It replaces the retired legacy "Log habits" stepper sheet: the dashboard's own
 * streak chip / nudge open the in-screen editor directly, and this overlay reuses
 * the SAME UpdateTodaySheet component for every other entry point.
 *
 * The today-goals checklist is computed here (mirrors the Dashboard's `isToday`
 * path) so the overlay is self-contained and never couples back into the Dashboard
 * screen's local state. If the goal set / targets logic changes on the Dashboard,
 * mirror it here too.
 */
import { useMemo } from 'react'
import { useStore } from '../store/store'
import { useNav } from '../nav'
import { useT } from '../lib/useT'
import { useColors, sectionColor } from '../theme'
import { todayKey } from '../lib/date'
import { fmtFluid } from '../lib/format'
import { todayHabit, todaySession, nutritionTagsForDay, foodReviewForDay, workoutStartedForDay } from '../store/selectors'
import { dailyTargets, examState } from '../store/training'
import { UpdateTodaySheet, type Goal } from './Dashboard'

export function LogProgressSheet({ onClose }: { open?: boolean; onClose: () => void }) {
  const { state, dispatch } = useStore()
  const nav = useNav()
  const colors = useColors()
  const tr = useT()
  const units = state.settings.units

  const goals = useMemo<Goal[]>(() => {
    const habit = todayHabit(state)
    const t = dailyTargets(state)
    const checkedIn = nutritionTagsForDay(state, todayKey).length > 0 || !!foodReviewForDay(state, todayKey)
    const exam = examState(state)
    const session = todaySession(state)
    const restByPeriodMode = exam.active && (exam.mode === 'pause' || exam.mode === 'moving')
    const isRestDay = !session || restByPeriodMode
    const workoutDone = isRestDay || workoutStartedForDay(state, todayKey) || (session?.completed ?? false)
    return [
      { id: 'steps', kind: 'measure', icon: 'footprints', tile: sectionColor('movement', colors), label: tr('Steps'), done: habit.steps >= t.steps, value: habit.steps, target: t.steps, step: 500, fmt: (v) => Math.round(v).toLocaleString(), patch: (v) => dispatch({ type: 'PATCH_HABIT', dateKey: todayKey, patch: { steps: v } }) },
      { id: 'sleep', kind: 'measure', icon: 'moon', tile: sectionColor('sleep', colors), label: tr('Sleep'), done: habit.sleepH >= t.sleepH, value: habit.sleepH, target: t.sleepH, step: 0.5, fmt: (v) => `${Math.round(v * 10) / 10} hrs`, patch: (v) => dispatch({ type: 'PATCH_HABIT', dateKey: todayKey, patch: { sleepH: v } }) },
      { id: 'water', kind: 'measure', icon: 'droplet', tile: sectionColor('hydration', colors), label: tr('Water'), done: habit.waterL >= t.waterL, value: habit.waterL, target: t.waterL, step: 0.2, fmt: (v) => fmtFluid(v, units), patch: (v) => dispatch({ type: 'PATCH_HABIT', dateKey: todayKey, patch: { waterL: v } }) },
      { id: 'nutrition', kind: 'auto', icon: 'leaf', tile: sectionColor('nutrition', colors), label: tr("Today's nutrition choices"), done: checkedIn, sub: checkedIn ? tr('Checked in · auto') : tr('Not checked in yet'), sheetValue: checkedIn ? tr('Checked in') : tr('Not checked in yet'), cta: tr('Log'), onOpen: () => nav.goTab('nutrition') },
      { id: 'workout', kind: 'auto', icon: 'dumbbell', tile: sectionColor('training', colors), label: tr('Workout'), done: workoutDone, sub: isRestDay ? tr('Rest day · auto') : `${session?.name ?? tr('Workout')} · ${workoutDone ? tr('auto') : tr('not started')}`, sheetValue: isRestDay ? tr('Rest day') : workoutDone ? tr('Completed') : tr('Not yet'), cta: tr('Start'), onOpen: () => (session ? nav.open('activeWorkout') : nav.goTab('workout')) },
    ]
  }, [state, colors, units, dispatch, nav, tr])

  const doneCount = goals.filter((g) => g.done).length
  return <UpdateTodaySheet open onClose={onClose} goals={goals} doneCount={doneCount} total={goals.length} colors={colors} />
}
