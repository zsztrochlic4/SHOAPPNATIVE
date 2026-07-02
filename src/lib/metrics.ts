import type { AppState, Units, HabitDay } from '../store/types'
import {
  weightStats, strengthProgress, habitConsistency7d, streakStats,
  regularWorkoutsInRange, oneRMSeries,
} from '../store/selectors'
import { fmtWeight, fmtWeightNum, weightUnit, weightVal } from './format'
import { dayKey, shortDate } from './date'
import { exById } from '../data/catalog'

/* ------------------------------------------------------------------ */
/*  Stat metrics: single-number cards (dashboard Progress overview)    */
/* ------------------------------------------------------------------ */
export interface StatResult { icon: string; label: string; value: string; unit?: string; sub: string; delta: string }
export interface StatMetric { id: string; label: string; icon: string; compute: (s: AppState, units: Units) => StatResult }

export const STAT_METRICS: StatMetric[] = [
  {
    id: 'workouts', label: 'Workouts', icon: 'dumbbell',
    compute: (s) => {
      const now = regularWorkoutsInRange(s, 6, 0)
      const prev = regularWorkoutsInRange(s, 13, 7)
      return { icon: 'dumbbell', label: 'Workouts', value: String(now), sub: 'Last 7 days', delta: `${now >= prev ? '↑' : '↓'} ${Math.abs(now - prev)}` }
    },
  },
  {
    id: 'strength', label: 'Strength', icon: 'trending',
    compute: (s) => {
      const sp = strengthProgress(s)
      const avg = sp.length ? Math.round(sp.reduce((a, x) => a + x.pct, 0) / sp.length) : 0
      return { icon: 'trending', label: 'Strength', value: `+${avg}%`, sub: '4 weeks', delta: '↑' }
    },
  },
  {
    id: 'weight', label: 'Body weight', icon: 'scale',
    compute: (s, units) => {
      const w = weightStats(s)
      return { icon: 'scale', label: 'Body weight', value: fmtWeightNum(w.current, units), unit: weightUnit(units), sub: '', delta: `${w.delta <= 0 ? '↓' : '↑'} ${fmtWeight(Math.abs(w.delta), units, 1)}` }
    },
  },
  {
    id: 'steps', label: 'Steps', icon: 'footprints',
    compute: (s) => {
      const hc = habitConsistency7d(s)
      return { icon: 'footprints', label: 'Steps', value: hc.avgSteps ? hc.avgSteps.toLocaleString() : '--', sub: 'avg / day', delta: '' }
    },
  },
  {
    id: 'sleep', label: 'Sleep', icon: 'bed',
    compute: (s) => {
      const hc = habitConsistency7d(s)
      return { icon: 'bed', label: 'Sleep', value: hc.avgSleep ? `${hc.avgSleep.toFixed(1)}h` : '--', sub: 'avg / night', delta: '' }
    },
  },
  {
    id: 'streak', label: 'Day streak', icon: 'flame',
    compute: (s) => {
      const st = streakStats(s)
      return { icon: 'flame', label: 'Day streak', value: String(st.current), sub: `best ${st.best}d`, delta: '' }
    },
  },
]

export const DEFAULT_DASHBOARD_STATS = ['workouts', 'strength', 'weight']

export function statById(id: string): StatMetric | undefined {
  return STAT_METRICS.find((m) => m.id === id)
}

/** The stat ids for the dashboard overview (1-3), falling back to defaults. */
export function dashboardStatIds(s: AppState): string[] {
  const ids = s.settings.dashboardStats
  if (!ids || ids.length === 0) return DEFAULT_DASHBOARD_STATS
  return ids.slice(0, 3)
}

/* ------------------------------------------------------------------ */
/*  Chart metrics: time series for the main Progress chart             */
/* ------------------------------------------------------------------ */
export interface ChartMetric { id: string; label: string; icon: string }

export const CHART_METRICS: ChartMetric[] = [
  { id: 'weight', label: 'Body weight', icon: 'scale' },
  { id: 'bench', label: 'Bench press', icon: 'dumbbell' },
  { id: 'squat', label: 'Back squat', icon: 'dumbbell' },
  { id: 'deadlift', label: 'Deadlift', icon: 'dumbbell' },
  { id: 'ohp', label: 'Overhead press', icon: 'dumbbell' },
  { id: 'steps', label: 'Daily steps', icon: 'footprints' },
  { id: 'water', label: 'Water', icon: 'droplet' },
  { id: 'sleep', label: 'Sleep', icon: 'bed' },
]

export interface ChartData {
  points: { date: string; value: number }[]
  unit: string
  title: string
  currentLabel: string
  deltaText: string
  deltaGood: boolean
  isWeight: boolean
  /** y-axis domain, or undefined for auto. */
  domain?: [number, number]
}

export function progressMetricId(s: AppState): string {
  const id = s.settings.progressMetric
  return id && CHART_METRICS.some((m) => m.id === id) ? id : 'weight'
}

export function buildChartData(s: AppState, metricId: string, days: number, units: Units): ChartData {
  const cutoff = dayKey(days)

  // Daily habit metrics: steps, water, sleep (one value logged per day)
  if (metricId === 'steps' || metricId === 'water' || metricId === 'sleep') {
    const imperialWater = units === 'imperial'
    const conf =
      metricId === 'steps'
        ? { get: (h?: HabitDay) => h?.steps ?? 0, unit: 'steps', title: 'Daily steps', dec: 0 }
        : metricId === 'water'
          ? { get: (h?: HabitDay) => (h?.waterL ?? 0) * (imperialWater ? 33.814 : 1), unit: imperialWater ? 'oz' : 'L', title: 'Water', dec: 1 }
          : { get: (h?: HabitDay) => h?.sleepH ?? 0, unit: 'h', title: 'Sleep', dec: 1 }
    const round = (v: number) => (conf.dec ? Math.round(v * 10) / 10 : Math.round(v))
    const fmt = (v: number) => (conf.dec ? v.toFixed(conf.dec) : v.toLocaleString())
    const points = Array.from({ length: days + 1 }, (_, i) => dayKey(days - i)).map((k) => {
      const h = s.habits.find((x) => x.dateKey === k)
      return { date: shortDate(k), value: round(conf.get(h)) }
    })
    const vals = points.map((p) => p.value)
    const current = vals.length ? vals[vals.length - 1] : 0
    const first = vals.find((v) => v > 0) ?? 0
    const delta = current - first
    const max = Math.max(1, ...vals)
    return {
      points, unit: conf.unit, title: conf.title,
      currentLabel: fmt(current),
      deltaText: `${delta >= 0 ? '↑' : '↓'} ${fmt(Math.abs(round(delta)))}`,
      deltaGood: delta >= 0, isWeight: false,
      domain: [0, metricId === 'steps' ? Math.ceil(max / 1000) * 1000 : Math.ceil(max + 1)],
    }
  }

  if (metricId === 'weight') {
    const w = weightStats(s)
    const points = w.series.filter((x) => x.dateKey >= cutoff).map((x) => ({ date: shortDate(x.dateKey), value: Math.round(weightVal(x.kg, units) * 10) / 10 }))
    const vals = points.map((p) => p.value)
    const yMin = vals.length ? Math.floor(Math.min(...vals) - 1) : 0
    const yMax = vals.length ? Math.ceil(Math.max(...vals) + 1) : 1
    return {
      points, unit: weightUnit(units), title: 'Body weight',
      currentLabel: fmtWeightNum(w.current, units),
      deltaText: `${w.delta <= 0 ? '↓' : '↑'} ${fmtWeight(Math.abs(w.delta), units, 1)}`,
      deltaGood: w.delta <= 0, isWeight: true, domain: [yMin, yMax],
    }
  }

  // Strength: estimated 1RM for a lift
  const series = oneRMSeries(s, metricId).filter((x) => x.dateKey >= cutoff)
  const points = series.map((x) => ({ date: shortDate(x.dateKey), value: Math.round(weightVal(x.kg, units)) }))
  const vals = points.map((p) => p.value)
  const current = vals.length ? vals[vals.length - 1] : 0
  const first = vals.length ? vals[0] : 0
  const delta = current - first
  const def = exById(metricId)
  return {
    points, unit: weightUnit(units), title: def?.name ?? 'Strength',
    currentLabel: String(current),
    deltaText: `${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta)} ${weightUnit(units)}`,
    deltaGood: delta >= 0, isWeight: false,
    domain: vals.length ? [Math.floor(Math.min(...vals) - 5), Math.ceil(Math.max(...vals) + 5)] : undefined,
  }
}
