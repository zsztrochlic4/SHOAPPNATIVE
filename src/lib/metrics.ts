import type { AppState, Units, HabitDay, StatTimeframe, WeightEntry } from '../store/types'
import { weightStats, streakStats, regularWorkoutsInRange, oneRMSeries } from '../store/selectors'
import type { AccentKey } from '../store/periods'
import { fluidUnit, fmtFluid, fmtWeight, fmtWeightNum, weightUnit, weightVal } from './format'
import { dayKey, shortDate } from './date'
import { exById } from '../data/catalog'
import { tagById } from '../data/nutrition'

/* ------------------------------------------------------------------ */
/*  Stat metrics: single-number cards (dashboard Progress overview)    */
/* ------------------------------------------------------------------ */

/** The three windows the overview can be measured over. */
export const STAT_TIMEFRAMES: StatTimeframe[] = ['7 days', '4 weeks', '3 months']

const TIMEFRAME_DAYS: Record<StatTimeframe, number> = { '7 days': 7, '4 weeks': 28, '3 months': 90 }

const TIMEFRAME_LABELS: Record<StatTimeframe, string> = {
  '7 days': 'Last 7 days',
  '4 weeks': 'Last 4 weeks',
  '3 months': 'Last 3 months',
}

/** The window currently selected for the dashboard overview. */
export function dashboardTimeframe(s: AppState): StatTimeframe {
  const tf = s.settings.dashboardTimeframe
  return tf && STAT_TIMEFRAMES.includes(tf) ? tf : '7 days'
}

/** "Last 4 weeks" — the caption under the section title. */
export function timeframeLabel(tf: StatTimeframe): string {
  return TIMEFRAME_LABELS[tf]
}

/**
 * Which way a stat moved. `dir` is the raw direction; whether that's *good* is
 * per-metric (losing weight is a win, losing sleep isn't), so the card asks
 * `good` rather than assuming up is always green.
 */
export type StatDir = 'up' | 'down' | 'flat'

export interface StatResult {
  icon: string
  label: string
  value: string
  unit?: string
  /** the delta pill text without its arrow, e.g. "1.4 kg" or "best 9" */
  delta: string
  dir: StatDir
  /** false when the direction is the wrong way for this metric */
  good: boolean
  /** false when `delta` isn't a change (the streak's record), so no arrow */
  arrow: boolean
}

export interface StatMetric {
  id: string
  label: string
  icon: string
  accent: AccentKey
  compute: (s: AppState, units: Units, tf: StatTimeframe) => StatResult
}

/* --------------------------- window helpers --------------------------- */

/** Mean of a habit field across the logged days in a window (0 when none). */
function habitAvg(s: AppState, sel: (h: HabitDay) => number, fromDays: number, toDays = 0): number {
  const lo = dayKey(fromDays)
  const hi = dayKey(toDays)
  const days = s.habits.filter((h) => h.dateKey >= lo && h.dateKey <= hi)
  if (days.length === 0) return 0
  return days.reduce((a, h) => a + sel(h), 0) / days.length
}

/** The last weight logged on or before a day, in kg. */
function weightAt(series: WeightEntry[], key: string): number | null {
  const at = [...series].reverse().find((w) => w.dateKey <= key)
  return at?.kg ?? null
}

/** Average estimated-1RM gain across the main lifts within a window, as a %. */
function strengthGainPct(s: AppState, fromDays: number, toDays = 0): number {
  const lo = dayKey(fromDays)
  const hi = dayKey(toDays)
  const pcts: number[] = []
  for (const id of ['bench', 'squat', 'deadlift', 'ohp']) {
    const win = oneRMSeries(s, id).filter((p) => p.dateKey >= lo && p.dateKey <= hi)
    if (win.length < 2) continue
    const from = win[0].kg
    const to = win.at(-1)!.kg
    if (from > 0) pcts.push(((to - from) / from) * 100)
  }
  if (pcts.length === 0) return 0
  return pcts.reduce((a, x) => a + x, 0) / pcts.length
}

/** Direction of a change, with a dead zone so noise doesn't flip the arrow. */
function dirOf(delta: number, epsilon = 0): StatDir {
  if (Math.abs(delta) <= epsilon) return 'flat'
  return delta > 0 ? 'up' : 'down'
}

const round1 = (v: number) => Math.round(v * 10) / 10

/* ------------------------------ the metrics ------------------------------ */

export const STAT_METRICS: StatMetric[] = [
  {
    id: 'workouts', label: 'Workouts', icon: 'dumbbell', accent: 'brand',
    compute: (s, _u, tf) => {
      const d = TIMEFRAME_DAYS[tf]
      const now = regularWorkoutsInRange(s, d - 1, 0)
      const prev = regularWorkoutsInRange(s, d * 2 - 1, d)
      const delta = now - prev
      return { icon: 'dumbbell', label: 'Workouts', value: String(now), delta: String(Math.abs(delta)), dir: dirOf(delta), good: delta >= 0, arrow: true }
    },
  },
  {
    id: 'strength', label: 'Strength', icon: 'trending', accent: 'brand',
    compute: (s, _u, tf) => {
      const d = TIMEFRAME_DAYS[tf]
      const now = strengthGainPct(s, d - 1, 0)
      const prev = strengthGainPct(s, d * 2 - 1, d)
      const delta = now - prev
      const sign = now < 0 ? '' : '+'
      return {
        icon: 'trending', label: 'Strength',
        value: `${sign}${Math.round(now)}%`,
        delta: `${Math.abs(round1(delta))}%`,
        dir: dirOf(delta, 0.05), good: delta >= 0, arrow: true,
      }
    },
  },
  {
    id: 'weight', label: 'Body weight', icon: 'scale', accent: 'blue',
    compute: (s, units, tf) => {
      const w = weightStats(s)
      const then = weightAt(w.series, dayKey(TIMEFRAME_DAYS[tf]))
      const delta = then == null ? 0 : w.current - then
      return {
        icon: 'scale', label: 'Body weight',
        value: fmtWeightNum(w.current, units), unit: weightUnit(units),
        delta: fmtWeight(Math.abs(delta), units, 1),
        dir: dirOf(delta, 0.05),
        // The only stat where down is the win.
        good: delta <= 0, arrow: true,
      }
    },
  },
  {
    id: 'water', label: 'Water', icon: 'droplet', accent: 'blue',
    compute: (s, units, tf) => {
      const d = TIMEFRAME_DAYS[tf]
      const now = habitAvg(s, (h) => h.waterL, d - 1, 0)
      const prev = habitAvg(s, (h) => h.waterL, d * 2 - 1, d)
      const delta = now - prev
      return {
        icon: 'droplet', label: 'Water',
        value: fmtFluid(now, units).split(' ')[0], unit: fluidUnit(units),
        delta: fmtFluid(Math.abs(delta), units),
        dir: dirOf(delta, 0.05), good: delta >= 0, arrow: true,
      }
    },
  },
  {
    id: 'steps', label: 'Daily steps', icon: 'footprints', accent: 'orange',
    compute: (s, _u, tf) => {
      const d = TIMEFRAME_DAYS[tf]
      const now = habitAvg(s, (h) => h.steps, d - 1, 0)
      const prev = habitAvg(s, (h) => h.steps, d * 2 - 1, d)
      const pct = prev > 0 ? ((now - prev) / prev) * 100 : 0
      return {
        icon: 'footprints', label: 'Daily steps',
        value: now >= 10000 ? `${round1(now / 1000)}k` : Math.round(now).toLocaleString(),
        delta: `${Math.abs(Math.round(pct))}%`,
        dir: dirOf(pct, 0.5), good: pct >= 0, arrow: true,
      }
    },
  },
  {
    id: 'streak', label: 'Streak', icon: 'flame', accent: 'orange',
    compute: (s) => {
      const st = streakStats(s)
      // A streak has no "previous window" to compare against — the useful second
      // number is the record it's chasing, so the pill stays neutral.
      return { icon: 'flame', label: 'Streak', value: String(st.current), unit: st.current === 1 ? 'day' : 'days', delta: `best ${st.best}`, dir: 'flat', good: true, arrow: false }
    },
  },
  {
    id: 'sleep', label: 'Sleep', icon: 'bed', accent: 'yellow',
    compute: (s, _u, tf) => {
      const d = TIMEFRAME_DAYS[tf]
      const now = habitAvg(s, (h) => h.sleepH, d - 1, 0)
      const prev = habitAvg(s, (h) => h.sleepH, d * 2 - 1, d)
      const delta = now - prev
      return {
        icon: 'bed', label: 'Sleep',
        value: round1(now).toFixed(1), unit: 'h',
        delta: `${Math.abs(round1(delta))}h`,
        dir: dirOf(delta, 0.05), good: delta >= 0, arrow: true,
      }
    },
  },
]

export const DEFAULT_DASHBOARD_STATS = ['workouts', 'strength', 'weight']

/** How many stats the overview grid can hold. */
export const MAX_DASHBOARD_STATS = 3

export function statById(id: string): StatMetric | undefined {
  return STAT_METRICS.find((m) => m.id === id)
}

/** The stat ids for the dashboard overview (1-3), falling back to defaults. */
export function dashboardStatIds(s: AppState): string[] {
  const ids = s.settings.dashboardStats
  if (!ids || ids.length === 0) return DEFAULT_DASHBOARD_STATS
  return ids.slice(0, MAX_DASHBOARD_STATS)
}

/* ------------------------------------------------------------------ */
/*  Chart metrics: time series for the main Progress chart             */
/* ------------------------------------------------------------------ */
export interface ChartMetric { id: string; label: string; icon: string }

export const CHART_METRICS: ChartMetric[] = [
  { id: 'weight', label: 'Body weight', icon: 'scale' },
  { id: 'nutrition', label: 'Eating quality', icon: 'leaf' },
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
  if (!id) return 'weight'
  // A preset chart metric, or any exercise pinned via the Progress customise
  // sheet (its 1RM series drives the same strength chart path below).
  if (CHART_METRICS.some((m) => m.id === id) || exById(id)) return id
  return 'weight'
}

/**
 * A single day's eating quality (0-100) from the "how did your eating go" tags:
 * each `good` tag pulls the day up, each `soft` (indulgent) tag pulls it down,
 * `neutral` tags don't move it. 50 is a wash; a day of only good tags is 100.
 * A general read on the day rather than tracking any one of the ~16 tags.
 */
function eatingScore(tagIds: string[]): number {
  let good = 0, soft = 0
  for (const id of tagIds) {
    const tone = tagById(id)?.tone
    if (tone === 'good') good++
    else if (tone === 'soft') soft++
  }
  const total = tagIds.length
  if (total === 0) return 50
  return Math.round(50 + (50 * (good - soft)) / total)
}

export function buildChartData(s: AppState, metricId: string, days: number, units: Units): ChartData {
  const cutoff = dayKey(days)

  // Eating quality: a 0-100 read per day, only for days the user checked in with tags.
  if (metricId === 'nutrition') {
    const map = s.nutritionTags ?? {}
    const points = Array.from({ length: days + 1 }, (_, i) => dayKey(days - i))
      .map((k) => ({ k, tags: map[k] }))
      .filter((d): d is { k: string; tags: string[] } => Array.isArray(d.tags) && d.tags.length > 0)
      .map((d) => ({ date: shortDate(d.k), value: eatingScore(d.tags) }))
    const vals = points.map((p) => p.value)
    const current = vals.length ? vals[vals.length - 1] : 0
    const first = vals.length ? vals[0] : 0
    const delta = current - first
    return {
      points, unit: '/100', title: 'Eating quality',
      currentLabel: String(current),
      deltaText: `${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta)}`,
      deltaGood: delta >= 0, isWeight: false, domain: [0, 100],
    }
  }

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
