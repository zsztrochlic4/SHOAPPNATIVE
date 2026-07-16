/**
 * Generator Flow step 4 — place day types onto the real calendar.
 * Source: sheet "Schedule Rules" (SCH02 rest floor, SCH03 48h spacing + preferred
 * consecutive pairs, SCH04 commitment adjacency, SCH05 placement order) + "External
 * Commitments" (adjacency classification). SCH06 compression is handled by the caller
 * (it re-selects the split with the reduced day count). SCH07–SCH10 are runtime (P1 later).
 *
 * Deterministic: identical inputs always place identically.
 */

import { EXTERNAL_COMMITMENTS } from '../data/externalCommitments'
import { WEEKDAYS, type Commitment, type Weekday } from '../schema'

export interface Placement { weekday: Weekday; dayType: string }
export interface ScheduleResult {
  placements: Placement[]
  restDays: Weekday[]
  audit: string[]
}

const idx = (d: Weekday) => WEEKDAYS.indexOf(d)
const cyclicDist = (a: number, b: number) => { const x = Math.abs(a - b); return Math.min(x, 7 - x) }

/** SCH05 placement order: most-constrained day types first. */
const PLACE_PRIORITY: Record<string, number> = { Legs: 0, Lower: 1, Pull: 2, Push: 3, Upper: 4, Full: 5, Focus: 6, Cond: 7 }

/** Muscle areas a day type loads directly, for spacing overlap. */
const DAY_MUSCLES: Record<string, string[]> = {
  Full: ['legs', 'chest', 'back', 'shoulders'], Upper: ['chest', 'back', 'shoulders'],
  Lower: ['legs'], Push: ['chest', 'shoulders'], Pull: ['back'], Legs: ['legs'], Focus: [], Cond: [],
}

/** Preferred consecutive pairs (SCH03) — order-agnostic. */
const GOOD_PAIRS = new Set(['Upper|Lower', 'Lower|Upper', 'Push|Pull', 'Pull|Push', 'Push|Legs', 'Legs|Push'])

function commitmentClass(type: string): { legHeavy: boolean; pullBlock: boolean; blockHours: number } {
  const row = EXTERNAL_COMMITMENTS.find((c) => c.commitmentType === type)
  if (!row) return { legHeavy: false, pullBlock: false, blockHours: 0 }
  const legHeavy = row.adjacencyBlockHours > 0 && (row.volumeCutMuscles.includes('Quads') || row.volumeCutMuscles.includes('Hamstrings & Glutes'))
  return { legHeavy, pullBlock: type === 'climbing', blockHours: row.adjacencyBlockHours }
}

export function buildSchedule(
  dayStructure: string[],
  daysAvailable: Weekday[],
  commitments: Commitment[],
): ScheduleResult {
  const audit: string[] = []
  let usable = WEEKDAYS.filter((d) => daysAvailable.includes(d)) // canonical order
  const commitmentDays = new Map<number, ReturnType<typeof commitmentClass>>()
  for (const c of commitments) commitmentDays.set(idx(c.day), commitmentClass(c.commitment_type))

  // SCH02 rest floor: at least one day with no lifting and no commitment.
  const occupied = new Set<number>([...usable.map(idx), ...commitmentDays.keys()])
  if (occupied.size >= 7 && usable.length > 0) {
    const drop = usable[usable.length - 1]
    usable = usable.filter((d) => d !== drop)
    audit.push(`SCH02: no empty day — dropped lifting day ${drop} to protect the rest floor`)
  }

  const sessions = dayStructure
    .map((type, structureOrder) => ({ type, structureOrder, prio: PLACE_PRIORITY[type] ?? 9 }))
    .sort((a, b) => a.prio - b.prio || a.structureOrder - b.structureOrder)

  const placements: Placement[] = []
  const usedDays = new Set<number>()

  for (const s of sessions) {
    let best: { day: number; score: number } | null = null
    for (const d of usable) {
      const di = idx(d)
      if (usedDays.has(di)) continue
      let score = 0

      // SCH03 spacing: distance to same-type and same-muscle placements (bigger = better).
      const myMuscles = DAY_MUSCLES[s.type] ?? []
      let minSame = 7, minMuscle = 7
      for (const p of placements) {
        const pi = idx(p.weekday)
        if (p.dayType === s.type) minSame = Math.min(minSame, cyclicDist(di, pi))
        if ((DAY_MUSCLES[p.dayType] ?? []).some((m) => myMuscles.includes(m))) minMuscle = Math.min(minMuscle, cyclicDist(di, pi))
      }
      score += minSame * 3 + minMuscle
      // Two sessions of the same type closer than 48h (adjacent) is a hard penalty.
      if (minSame < 2) score -= 20

      // SCH04 commitment adjacency: keep Legs/Lower (and Pull vs climbing) off adjacent days.
      for (const [ci, cls] of commitmentDays) {
        const near = cyclicDist(di, ci) <= Math.ceil((cls.blockHours || 0) / 24)
        if (!near) continue
        if ((s.type === 'Legs' || s.type === 'Lower') && cls.legHeavy) score -= 15
        if (s.type === 'Pull' && cls.pullBlock) score -= 15
      }

      // SCH03 preferred consecutive pairs bonus.
      for (const p of placements) {
        if (cyclicDist(di, idx(p.weekday)) === 1 && GOOD_PAIRS.has(`${s.type}|${p.dayType}`)) score += 4
      }

      if (!best || score > best.score) best = { day: di, score }
    }
    if (best) { usedDays.add(best.day); placements.push({ weekday: WEEKDAYS[best.day], dayType: s.type }) }
    else audit.push(`Could not place a ${s.type} day — ran out of usable days`)
  }

  placements.sort((a, b) => idx(a.weekday) - idx(b.weekday))
  const restDays = WEEKDAYS.filter((d) => !usedDays.has(idx(d)) && !commitmentDays.has(idx(d)))
  audit.push(`Placed ${placements.length}/${dayStructure.length} sessions; ${restDays.length} rest day(s)`)
  return { placements, restDays, audit }
}
