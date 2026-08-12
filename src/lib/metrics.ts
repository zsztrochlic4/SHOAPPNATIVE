import type { AppState, Units, HabitDay, StatTimeframe, WeightEntry, ProgressLiftPeriod } from '../store/types'
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

/** How many stats the overview grid can hold (4 shows as a 2×2 grid). */
export const MAX_DASHBOARD_STATS = 4

export function statById(id: string): StatMetric | undefined {
  return STAT_METRICS.find((m) => m.id === id)
}

/** The stat ids for the dashboard overview (0-3). Undefined = never configured →
 *  starter defaults. An explicit [] = the user cleared them all → stays empty. */
export function dashboardStatIds(s: AppState): string[] {
  const ids = s.settings.dashboardStats
  if (ids === undefined) return DEFAULT_DASHBOARD_STATS
  return ids.slice(0, MAX_DASHBOARD_STATS)
}

/** The stats that can be featured in the dashboard composition card (the big card
 *  under "Progress overview"). Selectable from the dashboard Customise sheet. */
export const DASHBOARD_FEATURED: { id: string; label: string; icon: string; accent: AccentKey }[] = [
  { id: 'nutrition', label: 'Eating quality', icon: 'leaf', accent: 'brand' },
  { id: 'weight', label: 'Body weight', icon: 'scale', accent: 'blue' },
  { id: 'water', label: 'Water', icon: 'droplet', accent: 'blue' },
  { id: 'steps', label: 'Daily steps', icon: 'footprints', accent: 'orange' },
  { id: 'sleep', label: 'Sleep', icon: 'bed', accent: 'yellow' },
]

/** Which metric the dashboard featured card shows (default 'nutrition'). The
 *  sentinel 'none' means the user hid the featured card entirely. */
export function dashboardFeaturedId(s: AppState): string {
  const id = s.settings.dashboardFeatured
  if (id === 'none') return 'none'
  return id && DASHBOARD_FEATURED.some((m) => m.id === id) ? id : 'nutrition'
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

/* ================================================================== */
/*  Progress dashboard: featured composition card, quick stats,        */
/*  ranked tracked lifts, and BMI — all computed from live store data. */
/*  (1:1 port of the "Progress Dashboard" design's cardData/QUICK/EXDB) */
/* ================================================================== */

/** Segment / stat colour role; the screen resolves these to theme colours. */
export type ProgressColor = 'brand' | 'blue' | 'orange' | 'muted' | 'fg' | 'danger'

export interface ProgressSegment { label: string; pct: number; color: ProgressColor; valueLabel: string; dim?: boolean }
export interface ProgressStat { label: string; value: string; accent: boolean; align: 'left' | 'center' | 'right' }
export interface ProgressMini { label: string; pct: number; on: boolean; last: boolean }
export interface ProgressFeatured {
  title: string
  value: string
  unit: string
  deltaText: string
  deltaGood: boolean
  deltaNote: string
  verdict: { label: string; warn: boolean }
  segments: ProgressSegment[]
  stats: ProgressStat[]
  isWeight: boolean
  mini7?: ProgressMini[]
}

const TF_DAYS: Record<StatTimeframe, number> = { '7 days': 7, '4 weeks': 28, '3 months': 90 }
const TF_WORD: Record<StatTimeframe, string> = { '7 days': '7 days', '4 weeks': '4 weeks', '3 months': '3 months' }
const TF_CAP: Record<StatTimeframe, string> = { '7 days': 'last 7 days', '4 weeks': 'last 4 weeks', '3 months': 'last 3 months' }

/** The Progress featured/quick window (Settings, default '4 weeks'). */
export function progressTimeframe(s: AppState): StatTimeframe {
  const tf = s.settings.progressTimeframe
  return tf && STAT_TIMEFRAMES.includes(tf) ? tf : '4 weeks'
}

const seg = (label: string, pct: number, color: ProgressColor, valueLabel: string, dim = false): ProgressSegment => ({ label, pct: Math.max(0, pct), color, valueLabel, dim })
const stat = (label: string, value: string, align: ProgressStat['align'], accent = false): ProgressStat => ({ label, value, align, accent })

/** Eating-quality verdict word from an average score. */
function eatVerdict(avg: number): string {
  return avg >= 85 ? 'Excellent' : avg >= 70 ? 'Strong' : avg >= 55 ? 'Balanced' : avg >= 40 ? 'Mixed' : 'Needs work'
}

/**
 * The featured composition card for whatever metric drives the top of Progress.
 * Mirrors the design's `cardData()` but reads real weights / habits / nutrition
 * tags / est-1RM series instead of seeded values.
 */
export function progressFeatured(s: AppState, metricId: string, tf: StatTimeframe, units: Units): ProgressFeatured {
  const days = TF_DAYS[tf]
  const deltaNote = `vs previous ${TF_WORD[tf]}`

  /* -------------------------------- nutrition ------------------------------- */
  if (metricId === 'nutrition') {
    const map = s.nutritionTags ?? {}
    let g = 0, nz = 0, soft = 0, sum = 0, cnt = 0, best = 0, total = 0
    let first: number | null = null, last: number | null = null
    for (let d = days - 1; d >= 0; d--) {
      total++
      const tags = map[dayKey(d)]
      if (!Array.isArray(tags) || tags.length === 0) continue
      const sc = eatingScore(tags)
      sum += sc; cnt++; if (sc > best) best = sc
      if (first === null) first = sc; last = sc
      for (const t of tags) { const tone = tagById(t)?.tone; if (tone === 'good') g++; else if (tone === 'soft') soft++; else nz++ }
    }
    const avg = cnt ? Math.round(sum / cnt) : 0
    const tot = Math.max(1, g + nz + soft)
    const gp = Math.round((100 * g) / tot), sp = Math.round((100 * soft) / tot), np = 100 - gp - sp
    const cur = last == null ? avg : last
    const delta = (last ?? 0) - (first ?? 0)
    return {
      title: 'Eating quality', value: String(cur), unit: '/100',
      deltaText: `${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta)}`, deltaGood: delta >= 0, deltaNote,
      verdict: { label: eatVerdict(avg), warn: avg < 55 },
      segments: [seg('Balanced choices', gp, 'brand', `${gp}%`), seg('Neutral', np, 'blue', `${np}%`), seg('Indulgent', sp, 'orange', `${sp}%`)],
      stats: [stat('Average', String(avg), 'left'), stat('Check-ins', `${cnt} / ${total}`, 'center'), stat('Best', String(best), 'right', true)],
      isWeight: false,
    }
  }

  /* ---------------------------- steps / water / sleep ----------------------- */
  if (metricId === 'steps' || metricId === 'water' || metricId === 'sleep') {
    const p = s.profile
    const conf = metricId === 'steps'
      ? { goal: p.stepTarget, get: (h: HabitDay) => h.steps, fmt: (v: number) => Math.round(v).toLocaleString(), unit: '', goalLabel: p.stepTarget.toLocaleString() }
      : metricId === 'water'
        ? { goal: p.waterTargetL, get: (h: HabitDay) => h.waterL, fmt: (v: number) => fmtFluid(v, units).split(' ')[0], unit: fluidUnit(units), goalLabel: fmtFluid(p.waterTargetL, units) }
        : { goal: p.sleepTargetH, get: (h: HabitDay) => h.sleepH, fmt: (v: number) => round1(v).toFixed(1), unit: 'h', goalLabel: `${p.sleepTargetH} h` }
    const byKey = new Map(s.habits.map((h) => [h.dateKey, h]))
    const logged: number[] = []
    let cur = 0, firstLogged: number | null = null
    for (let d = days - 1; d >= 0; d--) {
      const h = byKey.get(dayKey(d))
      if (!h) continue
      const v = conf.get(h)
      if (v <= 0) continue
      logged.push(v); if (firstLogged === null) firstLogged = v; cur = v
    }
    const n = logged.length
    const avg = n ? logged.reduce((a, b) => a + b, 0) / n : 0
    const bestV = n ? Math.max(...logged) : 0
    const delta = cur - (firstLogged ?? cur)
    let on = 0, close = 0, under = 0
    for (const v of logged) { const r = conf.goal ? v / conf.goal : 0; if (r >= 1) on++; else if (r >= 0.85) close++; else under++ }
    const days7 = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
    const last7 = Array.from({ length: 7 }, (_, i) => byKey.get(dayKey(6 - i))).map((h) => (h ? conf.get(h) : 0))
    const mmx = Math.max(...last7, conf.goal || 1)
    const mini7: ProgressMini[] = last7.map((v, i) => ({ label: days7[i], pct: v > 0 ? Math.max(8, Math.round((v / mmx) * 100)) : 0, on: conf.goal > 0 && v >= conf.goal, last: i === 6 }))
    const vl = avg >= conf.goal ? 'On track' : avg >= conf.goal * 0.85 ? 'Nearly there' : 'Below goal'
    return {
      title: metricId === 'steps' ? 'Daily steps' : metricId === 'water' ? 'Water' : 'Sleep', value: conf.fmt(cur), unit: conf.unit,
      deltaText: `${delta >= 0 ? '↑' : '↓'} ${conf.fmt(Math.abs(delta))}`, deltaGood: delta >= 0, deltaNote,
      verdict: { label: vl, warn: avg < conf.goal },
      segments: [seg('On goal', n ? Math.round((100 * on) / n) : 0, 'brand', `${on}d`), seg('Close', n ? Math.round((100 * close) / n) : 0, 'blue', `${close}d`), seg('Under', n ? Math.round((100 * under) / n) : 0, 'orange', `${under}d`)],
      stats: [stat('Average', conf.fmt(avg) + (conf.unit ? ` ${conf.unit}` : ''), 'left'), stat('Best', conf.fmt(bestV), 'center'), stat('Goal', conf.goalLabel, 'right', true)],
      isWeight: false, mini7,
    }
  }

  /* --------------------------------- weight --------------------------------- */
  if (metricId === 'weight') {
    const w = weightStats(s)
    const start = s.profile.startWeightKg, target = s.profile.goalWeightKg, cur = w.current
    const losing = target <= start
    const span = Math.max(0.1, Math.abs(start - target))
    const moved = losing ? start - cur : cur - start
    const remain = losing ? Math.max(0, cur - target) : Math.max(0, target - cur)
    const movedC = Math.max(0, moved)
    const delta = cur - start
    const good = losing ? delta <= 0 : delta >= 0
    return {
      title: 'Body weight', value: fmtWeightNum(cur, units), unit: weightUnit(units),
      deltaText: `${delta <= 0 ? '↓' : '↑'} ${fmtWeight(Math.abs(delta), units, 1)}`, deltaGood: good, deltaNote,
      verdict: { label: good ? 'On track' : 'Off track', warn: !good },
      segments: [
        seg(losing ? 'Lost so far' : 'Gained so far', Math.round((100 * movedC) / span), 'brand', fmtWeight(Math.abs(moved), units, 1)),
        seg('To target', Math.round((100 * remain) / span), 'blue', fmtWeight(remain, units, 1)),
      ],
      stats: [stat('Start', fmtWeightNum(start, units, 1), 'left'), stat('Current', fmtWeightNum(cur, units, 1), 'center', true), stat('Target', fmtWeightNum(target, units, 1), 'right')],
      isWeight: true,
    }
  }

  /* ---------------------------------- lift ---------------------------------- */
  const series = oneRMSeries(s, metricId)
  const cutoff = dayKey(days)
  const inWin = series.filter((x) => x.dateKey >= cutoff)
  const fromKg = inWin[0]?.kg ?? series[0]?.kg ?? 0
  const nowKg = series.at(-1)?.kg ?? 0
  const pctV = fromKg > 0 ? Math.round(((nowKg - fromKg) / fromKg) * 100) : 0
  const goalKg = Math.round(fromKg * 1.2)
  const gained = Math.max(0, nowKg - fromKg)
  const remain = Math.max(0, goalKg - nowKg)
  const lspan = Math.max(1, goalKg - fromKg)
  const vl = pctV >= 10 ? 'Strong gains' : pctV >= 6 ? 'Improving' : 'Holding'
  const u = weightUnit(units)
  return {
    title: exById(metricId)?.name ?? 'Strength', value: String(Math.round(weightVal(nowKg, units))), unit: u,
    deltaText: `↑ ${pctV}%`, deltaGood: true, deltaNote,
    verdict: { label: vl, warn: false },
    segments: [
      seg('Gained', Math.round((100 * gained) / lspan), 'brand', `+${Math.round(weightVal(gained, units))}${u}`),
      seg('To +20% goal', Math.round((100 * remain) / lspan), 'muted', `${Math.round(weightVal(remain, units))}${u}`, true),
    ],
    stats: [stat('Start', `${Math.round(weightVal(fromKg, units))}${u}`, 'left'), stat('Now', `${Math.round(weightVal(nowKg, units))}${u}`, 'center', true), stat('Change', `+${pctV}%`, 'right', true)],
    isWeight: false,
  }
}

/* ----------------------------- Quick stats -------------------------------- */
export interface ProgressQuick { id: string; label: string; icon: string }
export const PROGRESS_QUICK: ProgressQuick[] = [
  { id: 'strength', label: 'Strength', icon: 'trending' },
  { id: 'workouts', label: 'Workouts', icon: 'dumbbell' },
  { id: 'steps', label: 'Steps', icon: 'footprints' },
  { id: 'sleep', label: 'Sleep', icon: 'bed' },
  { id: 'water', label: 'Water', icon: 'droplet' },
  { id: 'weight', label: 'Body weight', icon: 'scale' },
  { id: 'nutrition', label: 'Eating quality', icon: 'leaf' },
]
const QUICK_ORDER = PROGRESS_QUICK.map((q) => q.id)
export const DEFAULT_PROGRESS_QUICK = ['strength', 'workouts', 'sleep']
export const MAX_PROGRESS_QUICK = 3

export function progressQuickIds(s: AppState): string[] {
  const ids = s.settings.progressQuickStats
  return ids && ids.length ? ids : DEFAULT_PROGRESS_QUICK
}

/** The quick-stat id the featured card already represents (so it's dropped from the row). */
export function featuredQuickId(metricId: string): string {
  return metricId === 'steps' || metricId === 'water' || metricId === 'sleep' || metricId === 'weight' || metricId === 'nutrition' ? metricId : 'strength'
}

function avgEatingQuality(s: AppState, days: number): number {
  const map = s.nutritionTags ?? {}
  let sum = 0, cnt = 0
  for (let d = days - 1; d >= 0; d--) { const t = map[dayKey(d)]; if (Array.isArray(t) && t.length) { sum += eatingScore(t); cnt++ } }
  return cnt ? Math.round(sum / cnt) : 0
}

export function progressQuickValue(s: AppState, id: string, tf: StatTimeframe, units: Units): { value: string; cap: string } {
  const days = TF_DAYS[tf]
  switch (id) {
    case 'strength': { const g = strengthGainPct(s, days - 1, 0); return { value: `${g < 0 ? '' : '+'}${Math.round(g)}%`, cap: TF_CAP[tf] } }
    case 'workouts': return { value: String(regularWorkoutsInRange(s, days - 1, 0)), cap: TF_CAP[tf] }
    case 'steps': { const v = habitAvg(s, (h) => h.steps, days - 1, 0); return { value: v ? Math.round(v).toLocaleString() : '--', cap: 'avg / day' } }
    case 'sleep': { const v = habitAvg(s, (h) => h.sleepH, days - 1, 0); return { value: v ? `${round1(v).toFixed(1)}h` : '--', cap: 'avg / night' } }
    case 'water': { const v = habitAvg(s, (h) => h.waterL, days - 1, 0); return { value: v ? fmtFluid(v, units) : '--', cap: 'avg / day' } }
    case 'weight': { const w = weightStats(s); return { value: `${fmtWeightNum(w.current, units, 1)}${weightUnit(units)}`, cap: 'current' } }
    case 'nutrition': { const v = avgEatingQuality(s, days); return { value: v ? String(v) : '--', cap: 'avg / 100' } }
    default: return { value: '--', cap: '' }
  }
}

/** The (≤3) quick cards to show: the user's picks minus the featured metric, filled from the pool. */
export function progressQuickCards(s: AppState, metricId: string, tf: StatTimeframe, units: Units) {
  const fq = featuredQuickId(metricId)
  const chosen = progressQuickIds(s)
  let disp = chosen.filter((id) => id !== fq)
  for (const id of QUICK_ORDER) { if (disp.length >= MAX_PROGRESS_QUICK) break; if (id !== fq && !disp.includes(id)) disp.push(id) }
  disp = disp.slice(0, MAX_PROGRESS_QUICK)
  return disp.map((id) => {
    const meta = PROGRESS_QUICK.find((q) => q.id === id)!
    const { value, cap } = progressQuickValue(s, id, tf, units)
    return { id, label: meta.label, icon: meta.icon, value, cap }
  })
}

/* --------------------------- Tracked lifts -------------------------------- */
const LIFT_PERIOD_DAYS: Record<ProgressLiftPeriod, number> = { '4 weeks': 28, '3 months': 90, '6 months': 182 }
export const PROGRESS_LIFT_PERIODS: ProgressLiftPeriod[] = ['4 weeks', '3 months', '6 months']
export const DEFAULT_TRACKED_LIFTS = ['bench', 'squat', 'deadlift', 'ohp']

export function progressTrackedIds(s: AppState): string[] {
  const ids = s.settings.progressTrackedIds
  return (ids && ids.length ? ids : DEFAULT_TRACKED_LIFTS).filter((id) => !!exById(id))
}

export function progressLiftPeriod(s: AppState): ProgressLiftPeriod {
  const p = s.settings.progressLiftPeriod
  return p && PROGRESS_LIFT_PERIODS.includes(p) ? p : '4 weeks'
}

/** Tracked lift ids for the dashboard "Training progress" card (independent of Progress).
 *  Undefined = never configured → starter defaults. An explicit [] = the user cleared
 *  them all → stays empty (the card hides). */
export function dashboardTrackedIds(s: AppState): string[] {
  const ids = s.settings.dashboardTrackedIds
  if (ids === undefined) return DEFAULT_TRACKED_LIFTS.filter((id) => !!exById(id))
  return ids.filter((id) => !!exById(id))
}

/** Trend window for the dashboard "Training progress" card (independent of Progress). */
export function dashboardLiftPeriod(s: AppState): ProgressLiftPeriod {
  const p = s.settings.dashboardLiftPeriod
  return p && PROGRESS_LIFT_PERIODS.includes(p) ? p : '4 weeks'
}

export interface TrackedLift { id: string; name: string; muscle: string; image: string; from: number; now: number; gainPct: number }

/** Ranked est-1RM gain over the trend window for each tracked lift that has data. */
export function progressTrackedLifts(s: AppState, ids: string[], period: ProgressLiftPeriod, units: Units): TrackedLift[] {
  const cutoff = dayKey(LIFT_PERIOD_DAYS[period])
  const rows: TrackedLift[] = []
  for (const id of ids) {
    const series = oneRMSeries(s, id)
    if (series.length === 0) continue
    const inWin = series.filter((x) => x.dateKey >= cutoff)
    const from = inWin[0]?.kg ?? series[0].kg
    const now = series.at(-1)!.kg
    const gainPct = from > 0 ? Math.max(0, Math.round(((now - from) / from) * 100)) : 0
    const def = exById(id)
    rows.push({ id, name: def?.name ?? id, muscle: def?.muscle ?? '', image: def?.image ?? '', from: Math.round(weightVal(from, units)), now: Math.round(weightVal(now, units)), gainPct })
  }
  return rows.sort((a, b) => b.gainPct - a.gainPct)
}

/* -------------------------------- BMI ------------------------------------- */
export interface BmiInfo { bmi: number; label: string; color: ProgressColor; needlePct: number }
export function bmiInfo(s: AppState): BmiInfo | null {
  const h = s.profile.heightCm
  const cur = weightStats(s).current
  if (!h || h <= 0 || !cur || cur <= 0) return null
  const m = h / 100
  const bmi = cur / (m * m)
  const label = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Healthy' : bmi < 30 ? 'Overweight' : 'Obese'
  const color: ProgressColor = bmi < 18.5 ? 'blue' : bmi < 25 ? 'brand' : bmi < 30 ? 'orange' : 'danger'
  // The gradient spans BMI 15→33 (matches the design's segment flexes), needle clamped.
  const needlePct = Math.max(0, Math.min(100, ((bmi - 15) / 18) * 100))
  return { bmi: Math.round(bmi * 10) / 10, label, color, needlePct }
}
