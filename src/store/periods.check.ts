/**
 * Checks for the Plan Around Your Life domain + the dashboard stat metrics.
 *
 * Run with `npm run check` (compiles via tsconfig.check.json, then executes with
 * node). Follows the same shape as the backend profile sweep: no test framework,
 * just assertions that exit non-zero so CI fails on a regression.
 *
 * Everything under test is deliberately React-free (store/periods.ts,
 * lib/metrics.ts and the selectors they read), so it runs in plain node.
 */

import { setLiveClock, todayKey, toKey, addDays, fromKey } from '../lib/date'
import {
  PERIOD_MODES, activePeriod, dateIssue, daysLabel, daysUntil, fmtPeriodDate, followupValid,
  modeMeta, newPeriodDraft, nextDayKey, normalTrainingDays, overlapsExisting, periodLength,
  periodRangeText, periodTitle, plannedPeriods, toPlannedAbsence, upcomingPeriods, whatHappens,
} from './periods'
import { examState, dailyTargets } from './training'
import {
  STAT_METRICS, STAT_TIMEFRAMES, dashboardStatIds, dashboardTimeframe, statById, timeframeLabel,
} from '../lib/metrics'
import type { AppState, PlannedPeriod, HabitDay } from './types'

/* ------------------------------ harness ------------------------------ */

let failures = 0
let checks = 0

function ok(name: string, cond: boolean, detail?: string) {
  checks++
  if (cond) return
  failures++
  console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
}

function eq<T>(name: string, actual: T, expected: T) {
  ok(name, Object.is(actual, expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

function section(title: string) {
  console.log(`\n${title}`)
}

/* ------------------------------ fixtures ------------------------------ */

// The demo clock is frozen, so every relative assertion below is stable.
setLiveClock(false)

const shift = (days: number) => toKey(addDays(fromKey(todayKey), days))

function period(over: Partial<PlannedPeriod> & { id: string; start: string; end: string }): PlannedPeriod {
  return { ...newPeriodDraft(), mode: 'maintenance', ...over }
}

function habit(dateKey: string, over: Partial<HabitDay> = {}): HabitDay {
  return { dateKey, steps: 0, sleepH: 0, waterL: 0, mindsetMin: 0, nutritionScore: 0, workout: false, ...over }
}

/** A minimal AppState — only the slices the code under test actually reads. */
function makeState(over: Partial<AppState> = {}): AppState {
  return {
    profile: {
      name: 'Test', age: 20, sex: 'other', university: 'U', cohort: '', dorm: '', society: '',
      goal: 'build-muscle', experience: 'beginner', daysPerWeek: 3, equipment: 'full-gym',
      heightCm: 175, startWeightKg: 75, goalWeightKg: 72,
      calorieTarget: 0, proteinTarget: 0, carbTarget: 0, fatTarget: 0, // no calorie/nutrition goals (app-wide rule)
      waterTargetL: 3, stepTarget: 9000, sleepTargetH: 8,
      onboarded: true, examMode: false, budgetMode: false, newToGym: false, premium: false,
      createdAtKey: todayKey,
    },
    settings: { units: 'metric', theme: 'dark', notificationsEnabled: false },
    weights: [], habits: [], meals: [], foodReviews: [], chat: [], foods: [], sessions: [],
    program: [
      { id: 'a', day: 'Mon', name: 'Push', focus: '', exerciseIds: [] },
      { id: 'b', day: 'Wed', name: 'Pull', focus: '', exerciseIds: [] },
      { id: 'c', day: 'Thu', name: 'Rest', focus: '', rest: true, exerciseIds: [] },
      { id: 'd', day: 'Fri', name: 'Legs', focus: '', exerciseIds: [] },
    ],
    posts: [], leaderboard: [], challenges: [], badges: [], notifications: [], events: [],
    groups: [], partners: [], coachThread: [], beginnerProgress: [],
    v: 1,
    ...over,
  } as AppState
}

/* ============================ date helpers ============================ */
section('date helpers')
{
  eq('periodLength is inclusive', periodLength('2026-06-01', '2026-06-07'), 7)
  eq('periodLength single day', periodLength('2026-06-01', '2026-06-01'), 1)
  eq('periodLength rejects reversed range', periodLength('2026-06-07', '2026-06-01'), 0)
  eq('periodLength on empty input', periodLength('', ''), 0)

  eq('nextDayKey crosses a month boundary', nextDayKey('2026-06-30'), '2026-07-01')
  eq('nextDayKey crosses a year boundary', nextDayKey('2026-12-31'), '2027-01-01')
  // Regression: an unset draft used to render "undefined NaN undefined".
  eq('nextDayKey passes empty through', nextDayKey(''), '')
  eq('fmtPeriodDate handles empty', fmtPeriodDate(''), 'Not set')
  eq('fmtPeriodDate formats as the design does', fmtPeriodDate('2026-08-03'), 'Mon 3 Aug')
  eq('periodRangeText joins both ends', periodRangeText('2026-08-03', '2026-08-14'), 'Mon 3 Aug to Fri 14 Aug')

  eq('daysLabel today', daysLabel(0), 'today')
  eq('daysLabel past reads as today', daysLabel(-3), 'today')
  eq('daysLabel tomorrow', daysLabel(1), 'tomorrow')
  eq('daysLabel plural', daysLabel(12), 'in 12 days')
  eq('daysUntil is 0 for today', daysUntil(todayKey), 0)
  eq('daysUntil counts forward', daysUntil(shift(9)), 9)
  eq('daysUntil goes negative for the past', daysUntil(shift(-2)), -2)
}

/* ============================ mode metadata ============================ */
section('mode metadata')
{
  eq('six modes, matching the design', PERIOD_MODES.length, 6)
  const ids = PERIOD_MODES.map((m) => m.id).join(',')
  eq('mode ids and order', ids, 'pause,maintenance,moving,fewer,deload,asis')

  // Every UI mode must land on a real backend AbsenceMode or the generator
  // silently falls back to "no change" and the user's choice is lost.
  const absences = PERIOD_MODES.map((m) => m.absenceMode).join(',')
  eq('each mode maps to its backend absence', absences, 'full_pause,maintenance,minimal_movement,reduced_frequency,active_rest,no_change')
  ok('every mode has copy', PERIOD_MODES.every((m) => !!m.title && !!m.tag && !!m.effect))
  ok('only the three configurable modes have a follow-up',
    PERIOD_MODES.filter((m) => m.followup).map((m) => m.id).join(',') === 'maintenance,moving,fewer')
  eq('modeMeta finds by id', modeMeta('deload')?.title, 'Planned deload')
  eq('modeMeta tolerates null', modeMeta(null), undefined)
}

/* ========================= validation + overlap ========================= */
section('date validation')
{
  const s = makeState({ plannedPeriods: [period({ id: 'p1', start: shift(10), end: shift(20) })] })

  eq('no issue while incomplete', dateIssue(s, { start: shift(3), end: '' }), null)
  eq('valid future range passes', dateIssue(s, { start: shift(1), end: shift(5) }), null)
  eq('reversed range is rejected',
    dateIssue(s, { start: shift(5), end: shift(1) }), 'End date cannot be before the start date.')
  eq('fully past range is rejected',
    dateIssue(s, { start: shift(-9), end: shift(-2) }), 'That period has already passed. Choose upcoming dates.')

  const overlapMsg = 'That overlaps an existing period. Edit that one or pick different dates.'
  eq('range swallowing an existing one overlaps', dateIssue(s, { start: shift(8), end: shift(25) }), overlapMsg)
  eq('range starting inside an existing one overlaps', dateIssue(s, { start: shift(15), end: shift(25) }), overlapMsg)
  eq('touching the last day overlaps', dateIssue(s, { start: shift(20), end: shift(25) }), overlapMsg)
  eq('the day after is free', dateIssue(s, { start: shift(21), end: shift(25) }), null)
  eq('the day before is free', dateIssue(s, { start: shift(5), end: shift(9) }), null)

  // Editing a period must not be blocked by its own dates.
  ok('a period does not overlap itself when editing',
    !overlapsExisting(s, { start: shift(10), end: shift(20) }, 'p1'))
  ok('...but does without the ignore id',
    overlapsExisting(s, { start: shift(10), end: shift(20) }))
  eq('editing keeps its own range valid', dateIssue(s, { start: shift(10), end: shift(22) }, 'p1'), null)
}

/* ========================== follow-up gating ========================== */
section('follow-up validation')
{
  const base = newPeriodDraft()
  ok('maintenance needs at least one day',
    !followupValid({ ...base, mode: 'maintenance', maintDays: [] }))
  ok('maintenance accepts one day',
    followupValid({ ...base, mode: 'maintenance', maintDays: ['Tue'] }))
  ok('maintenance accepts two days',
    followupValid({ ...base, mode: 'maintenance', maintDays: ['Tue', 'Thu'] }))
  ok('maintenance rejects three days',
    !followupValid({ ...base, mode: 'maintenance', maintDays: ['Tue', 'Thu', 'Sat'] }))

  ok('fewer days needs exactly its count (1)',
    followupValid({ ...base, mode: 'fewer', fewerCount: 1, fewerDays: ['Wed'] }))
  ok('fewer days rejects too few',
    !followupValid({ ...base, mode: 'fewer', fewerCount: 2, fewerDays: ['Wed'] }))
  ok('fewer days accepts the pair',
    followupValid({ ...base, mode: 'fewer', fewerCount: 2, fewerDays: ['Wed', 'Sat'] }))

  ok('modes without a follow-up are always valid',
    followupValid({ ...base, mode: 'pause' }) && followupValid({ ...base, mode: 'asis' }))
}

/* ====================== "what happens" review copy ====================== */
section('review copy')
{
  const d = (over: Partial<PlannedPeriod>) => ({ ...newPeriodDraft(), start: shift(1), end: shift(7), ...over })

  const pause = whatHappens(d({ mode: 'pause' }) as PlannedPeriod)
  eq('short pause has no return ramp', pause.length, 3)
  ok('every mode promises no penalty', pause.at(-1) === 'Missed sessions will not be penalised')

  const longPause = whatHappens(d({ mode: 'pause', end: shift(30) }) as PlannedPeriod)
  ok('a pause over two weeks adds the return ramp',
    longPause.includes('A one week return ramp eases you back in'))

  const maint = whatHappens(d({ mode: 'maintenance', maintDays: ['Tue', 'Thu'] }) as PlannedPeriod)
  ok('maintenance names the chosen days', maint.includes('On Tue and Thu'))

  const fewer2 = whatHappens(d({ mode: 'fewer', fewerCount: 2, fewerDays: ['Wed', 'Sat'] }) as PlannedPeriod)
  ok('fewer days states the count', fewer2.includes('Two sessions a week'))
  ok('fewer days names the days', fewer2.includes('On Wed and Sat'))

  for (const t of ['walking', 'mobility', 'both'] as const) {
    const out = whatHappens(d({ mode: 'moving', movingType: t }) as PlannedPeriod)
    ok(`moving/${t} produces real copy`, typeof out[0] === 'string' && out[0].length > 0)
  }

  const shortDeload = whatHappens(d({ mode: 'deload', end: shift(5) }) as PlannedPeriod)
  ok('a short deload stays one week', shortDeload.includes('A lighter training week, then back to normal'))
  const longDeload = whatHappens(d({ mode: 'deload', end: shift(25) }) as PlannedPeriod)
  ok('a long deload becomes deload + pause', longDeload.includes('The remaining days are a full pause'))

  // Every mode must produce copy — an empty review card would be a dead end.
  for (const m of PERIOD_MODES) {
    ok(`${m.id} produces review bullets`, whatHappens(d({ mode: m.id }) as PlannedPeriod).length >= 2)
  }
}

/* ======================== active / upcoming reads ======================== */
section('active and upcoming')
{
  const empty = makeState({ plannedPeriods: [] })
  eq('no periods, nothing active', activePeriod(empty), null)
  eq('no periods, nothing upcoming', upcomingPeriods(empty).length, 0)

  const s = makeState({
    plannedPeriods: [
      period({ id: 'past', start: shift(-20), end: shift(-10) }),
      period({ id: 'now', start: shift(-2), end: shift(3), mode: 'pause', note: 'Final exams' }),
      period({ id: 'soon', start: shift(12), end: shift(18) }),
      period({ id: 'later', start: shift(40), end: shift(45) }),
    ],
  })
  eq('the containing period is active', activePeriod(s)?.id, 'now')
  eq('only future periods are upcoming', upcomingPeriods(s).map((p) => p.id).join(','), 'soon,later')
  eq('upcoming is sorted soonest first', upcomingPeriods(s)[0].id, 'soon')
  eq('a note becomes the title', periodTitle(activePeriod(s)!), 'Final exams')
  eq('a blank note falls back', periodTitle(period({ id: 'x', start: shift(1), end: shift(2), note: '  ' })), 'Busy period')

  const edge = makeState({ plannedPeriods: [period({ id: 'edge', start: todayKey, end: todayKey })] })
  eq('a single-day period starting today is active', activePeriod(edge)?.id, 'edge')

  const ends = makeState({ plannedPeriods: [period({ id: 'e', start: shift(-5), end: todayKey })] })
  eq('the last day is still inside the period', activePeriod(ends)?.id, 'e')

  const starts = makeState({ plannedPeriods: [period({ id: 's', start: shift(1), end: shift(4) })] })
  eq('a period starting tomorrow is not yet active', activePeriod(starts), null)

  eq('training days come from the program', normalTrainingDays(makeState()).join(','), 'Mon,Wed,Fri')
  eq('training days fall back when there is no program',
    normalTrainingDays(makeState({ program: [] })).join(','), 'Mon,Wed,Fri')
}

/* ====================== legacy exam-date migration ====================== */
section('legacy migration')
{
  const legacy = makeState({
    profile: { ...makeState().profile, examMode: true, examDates: [shift(5), shift(6), shift(9)] },
  })
  const got = plannedPeriods(legacy)
  eq('old exam dates surface as one period', got.length, 1)
  eq('spanning the first date', got[0].start, shift(5))
  eq('...to the last', got[0].end, shift(9))

  const window = makeState({
    profile: { ...makeState().profile, examMode: true, examStartKey: shift(2), examEndKey: shift(8) },
  })
  eq('an old start/end window also migrates', plannedPeriods(window).length, 1)

  // Once the real array exists it wins outright, including when emptied — a
  // cancelled last period must not resurrect the legacy one.
  const migrated = makeState({
    plannedPeriods: [],
    profile: { ...makeState().profile, examMode: true, examDates: [shift(5)] },
  })
  eq('an empty periods array beats legacy dates', plannedPeriods(migrated).length, 0)

  eq('exam mode off means no legacy period', plannedPeriods(makeState()).length, 0)
}

/* ========================= backend projection ========================= */
section('backend projection')
{
  const p = period({ id: 'p1', start: shift(3), end: shift(9), mode: 'moving', note: '  Away interstate  ' })
  const a = toPlannedAbsence(p)
  eq('id carries over', a.absence_id, 'p1')
  eq('dates carry over', `${a.start_date}/${a.end_date}`, `${shift(3)}/${shift(9)}`)
  eq('mode maps to the backend vocabulary', a.mode_id, 'minimal_movement')
  eq('the note is trimmed', a.note, 'Away interstate')
  eq('a future period is scheduled', a.status, 'scheduled')

  eq('a current period is active',
    toPlannedAbsence(period({ id: 'x', start: shift(-1), end: shift(1) })).status, 'active')
  eq('a finished period is completed',
    toPlannedAbsence(period({ id: 'y', start: shift(-9), end: shift(-3) })).status, 'completed')
  eq('a blank note is omitted rather than sent empty',
    toPlannedAbsence(period({ id: 'z', start: shift(1), end: shift(2), note: '   ' })).note, undefined)

  // Round-trip every mode so a renamed backend id can't slip through.
  for (const m of PERIOD_MODES) {
    const abs = toPlannedAbsence(period({ id: 'm', start: shift(1), end: shift(2), mode: m.id }))
    eq(`${m.id} projects to ${m.absenceMode}`, abs.mode_id, m.absenceMode)
  }
}

/* ===================== examState + target adaptation ===================== */
section('examState wiring')
{
  eq('nothing declared means disabled', examState(makeState()).enabled, false)
  eq('nothing declared is not active', examState(makeState()).active, false)

  const inside = makeState({ plannedPeriods: [period({ id: 'a', start: shift(-1), end: shift(4), mode: 'pause' })] })
  eq('inside a period the phase is during', examState(inside).phase, 'during')
  eq('inside a period it is active', examState(inside).active, true)
  eq('days left counts to the end', examState(inside).daysLeft, 4)
  eq('targets are eased while active', dailyTargets(inside).adjusted, true)

  // "Keep it as is" promises nothing moves — it must not ease targets.
  const asis = makeState({ plannedPeriods: [period({ id: 'b', start: shift(-1), end: shift(4), mode: 'asis' })] })
  eq('keep-as-is is enabled', examState(asis).enabled, true)
  eq('keep-as-is is never active', examState(asis).active, false)
  eq('keep-as-is leaves targets alone', dailyTargets(asis).adjusted, false)

  const soon = makeState({ plannedPeriods: [period({ id: 'c', start: shift(3), end: shift(9) })] })
  eq('a period within a week is approaching', examState(soon).phase, 'approaching')
  eq('approaching does not adapt training yet', examState(soon).active, false)
  eq('approaching leaves targets alone', dailyTargets(soon).adjusted, false)
  eq('approaching counts down', examState(soon).daysUntil, 3)

  const far = makeState({ plannedPeriods: [period({ id: 'd', start: shift(30), end: shift(40) })] })
  eq('a distant period is phase none', examState(far).phase, 'none')
  eq('...but still counts down', examState(far).daysUntil, 30)

  const justEnded = makeState({ plannedPeriods: [period({ id: 'e', start: shift(-9), end: shift(-2) })] })
  eq('just after a period we are recovering', examState(justEnded).phase, 'recovering')
  eq('recovering is not active', examState(justEnded).active, false)

  const longGone = makeState({ plannedPeriods: [period({ id: 'f', start: shift(-30), end: shift(-20) })] })
  eq('an old period is phase none', examState(longGone).phase, 'none')
  eq('an old period never re-activates', examState(longGone).active, false)
}

/* =========================== stat metrics =========================== */
section('stat metrics')
{
  eq('three windows', STAT_TIMEFRAMES.length, 3)
  eq('window label', timeframeLabel('4 weeks'), 'Last 4 weeks')
  eq('default window', dashboardTimeframe(makeState()), '7 days')
  eq('a stored window is honoured',
    dashboardTimeframe(makeState({ settings: { ...makeState().settings, dashboardTimeframe: '3 months' } })), '3 months')
  eq('an unknown window falls back',
    dashboardTimeframe(makeState({ settings: { ...makeState().settings, dashboardTimeframe: 'nonsense' as never } })), '7 days')

  eq('seven metrics, matching the design', STAT_METRICS.length, 7)
  eq('metric ids', STAT_METRICS.map((m) => m.id).join(','), 'workouts,strength,weight,water,steps,streak,sleep')
  ok('statById resolves every metric', STAT_METRICS.every((m) => statById(m.id)?.id === m.id))
  eq('statById returns undefined for junk', statById('nope'), undefined)

  eq('default stats when unset', dashboardStatIds(makeState()).join(','), 'workouts,strength,weight')
  eq('an empty list falls back',
    dashboardStatIds(makeState({ settings: { ...makeState().settings, dashboardStats: [] } })).join(','), 'workouts,strength,weight')
  eq('never more than three tiles',
    dashboardStatIds(makeState({ settings: { ...makeState().settings, dashboardStats: ['a', 'b', 'c', 'd', 'e'] } })).length, 3)

  // Every metric must survive a completely empty account without throwing or
  // rendering NaN — a brand-new user hits this on their first dashboard.
  const blank = makeState()
  for (const m of STAT_METRICS) {
    for (const tf of STAT_TIMEFRAMES) {
      const r = m.compute(blank, 'metric', tf)
      ok(`${m.id}/${tf} produces a value`, typeof r.value === 'string' && r.value.length > 0)
      ok(`${m.id}/${tf} has no NaN`, !r.value.includes('NaN') && !r.delta.includes('NaN'), `${r.value} / ${r.delta}`)
      ok(`${m.id}/${tf} has no undefined`, !r.value.includes('undefined') && !r.delta.includes('undefined'))
      ok(`${m.id}/${tf} declares a direction`, ['up', 'down', 'flat'].includes(r.dir))
    }
  }

  // Water and weight must respect imperial units.
  const imperial = STAT_METRICS.find((m) => m.id === 'weight')!.compute(blank, 'imperial', '7 days')
  eq('weight uses lb in imperial', imperial.unit, 'lb')
  const waterImp = STAT_METRICS.find((m) => m.id === 'water')!.compute(blank, 'imperial', '7 days')
  eq('water uses oz in imperial', waterImp.unit, 'oz')

  // Direction and "good" have to be independent: losing weight is a win.
  const losing = makeState({
    weights: [{ dateKey: shift(-8), kg: 76 }, { dateKey: todayKey, kg: 74 }],
  })
  const wl = STAT_METRICS.find((m) => m.id === 'weight')!.compute(losing, 'metric', '7 days')
  eq('losing weight reads as down', wl.dir, 'down')
  ok('losing weight is good', wl.good)

  const gaining = makeState({
    weights: [{ dateKey: shift(-8), kg: 74 }, { dateKey: todayKey, kg: 76 }],
  })
  const wg = STAT_METRICS.find((m) => m.id === 'weight')!.compute(gaining, 'metric', '7 days')
  eq('gaining weight reads as up', wg.dir, 'up')
  ok('gaining weight is not good', !wg.good)

  // Sleep is the opposite: more is the win.
  const sleeping = makeState({
    habits: [
      ...Array.from({ length: 7 }, (_, i) => habit(shift(-13 + i), { sleepH: 6 })),
      ...Array.from({ length: 7 }, (_, i) => habit(shift(-6 + i), { sleepH: 8 })),
    ],
  })
  const sl = STAT_METRICS.find((m) => m.id === 'sleep')!.compute(sleeping, 'metric', '7 days')
  eq('more sleep reads as up', sl.dir, 'up')
  ok('more sleep is good', sl.good)
  eq('sleep averages the window', sl.value, '8.0')

  // The streak pill shows a record, not a change, so it must not draw an arrow.
  const streak = STAT_METRICS.find((m) => m.id === 'streak')!.compute(blank, 'metric', '7 days')
  ok('streak suppresses the arrow', !streak.arrow)
  ok('every other metric shows an arrow',
    STAT_METRICS.filter((m) => m.id !== 'streak').every((m) => m.compute(blank, 'metric', '7 days').arrow))

  // A wider window must actually widen the window.
  const stepped = makeState({
    habits: Array.from({ length: 60 }, (_, i) => habit(shift(-i), { steps: i < 7 ? 10000 : 4000 })),
  })
  const s7 = STAT_METRICS.find((m) => m.id === 'steps')!.compute(stepped, 'metric', '7 days')
  const s28 = STAT_METRICS.find((m) => m.id === 'steps')!.compute(stepped, 'metric', '4 weeks')
  ok('the 7-day window sees only the recent spike', s7.value === '10k', `got ${s7.value}`)
  ok('the 4-week window dilutes it', s28.value !== s7.value, `both ${s7.value}`)
}

/* ------------------------------ report ------------------------------ */

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — ${checks - failures}/${checks} checks passed`)
if (failures > 0) {
  console.error(`${failures} check(s) failed`)
  process.exit(1)
}
