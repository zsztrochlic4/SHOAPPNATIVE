/**
 * Custom Splits — Generator Flow step 3 alternative (runtime).
 * Sources: sheets "Custom Split Resolution" (fuzzy request → day_structure) + "Custom Split
 * Rules" (CS01–CS07). A custom split compiles to the same day_structure string as a preset
 * and flows through Session Templates / Weekly Volume / Prescription / Safety Rules
 * unchanged — no special cases downstream, no relaxed safety (CS05). Deterministic.
 */

import { CUSTOM_SPLIT_RESOLUTION } from '../data/customSplitResolution'
import type { UserDoc } from '../schema'
import { generateProgram, type GenResult } from './generate'

const KNOWN_DAY_TYPES = ['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full', 'Focus', 'Cond']
/** Major muscles each day type covers directly, for the CS02 coverage check. */
const DAY_COVERS: Record<string, string[]> = {
  Full: ['Chest', 'Back', 'Quads', 'Hamstrings & Glutes', 'Shoulders'],
  Upper: ['Chest', 'Back', 'Shoulders'], Push: ['Chest', 'Shoulders'], Pull: ['Back'],
  Legs: ['Quads', 'Hamstrings & Glutes'], Lower: ['Quads', 'Hamstrings & Glutes'], Focus: [], Cond: [],
}
const MAJORS = ['Chest', 'Back', 'Quads', 'Hamstrings & Glutes', 'Shoulders']

function norm(s: string): string { return s.trim().toLowerCase().replace(/\s+/g, ' ') }

export interface ResolvedSplit {
  dayStructure: string[]
  matchedRequest: string
  note: string
  /** When the phrasing didn't match, the two nearest options to offer the user (CS06). */
  alternatives?: { userRequest: string; dayStructure: string[] }[]
}

/** Resolve a fuzzy structural request to a day_structure via the resolution table (CS06). */
export function resolveCustomSplit(days: number, request: string): ResolvedSplit | null {
  const rows = CUSTOM_SPLIT_RESOLUTION.filter((r) => r.daysPerWeek === days)
  if (!rows.length) return null
  const req = norm(request || 'none / balanced')
  // exact-ish match on the request phrase
  const hit = rows.find((r) => norm(r.userRequest) === req)
    ?? rows.find((r) => r.userRequest.split('/').some((p) => norm(p) && req.includes(norm(p))))
  if (hit) return { dayStructure: [...hit.resolvedDayStructure], matchedRequest: hit.userRequest, note: hit.note }
  // no match → offer the two nearest (default balanced + one other)
  const balanced = rows.find((r) => /balanced|none/.test(r.userRequest)) ?? rows[0]
  const other = rows.find((r) => r !== balanced) ?? rows[0]
  return {
    dayStructure: [...balanced.resolvedDayStructure], matchedRequest: balanced.userRequest,
    note: 'Phrasing didn’t match a preset request — defaulting to balanced and offering the nearest options.',
    alternatives: [balanced, other].map((r) => ({ userRequest: r.userRequest, dayStructure: r.resolvedDayStructure })),
  }
}

export interface ValidationResult { valid: boolean; dayStructure: string[]; warnings: string[] }

/** Validate a custom day_structure (CS01 building blocks + length, CS02 coverage). */
export function validateCustomSplit(dayStructure: string[], days: number): ValidationResult {
  const warnings: string[] = []
  const unknown = dayStructure.filter((d) => !KNOWN_DAY_TYPES.includes(d))
  if (unknown.length) warnings.push(`CS01: unknown day type(s) ${unknown.join(', ')}`)
  if (dayStructure.length !== days) warnings.push(`CS01: ${dayStructure.length} day types for ${days} lifting days`)
  // CS02 coverage: every major muscle hit directly at least once.
  const covered = new Set(dayStructure.flatMap((d) => DAY_COVERS[d] ?? []))
  const missing = MAJORS.filter((m) => !covered.has(m))
  if (missing.length) warnings.push(`CS02: ${missing.join(', ')} not trained directly — warn the user and offer to convert a repeated day`)
  // CS03 repeat spacing is enforced by the scheduler (SCH03); flagged there, not rejected here.
  return { valid: unknown.length === 0 && dayStructure.length === days, dayStructure, warnings }
}

/**
 * Build a program from a fuzzy custom request. CS07: offered to Intermediate/Advanced; a
 * beginner gets it honoured (where CS02 passes) with a gentle note. Safety and volume rules
 * apply unchanged (CS05) because it flows through generateProgram.
 */
export function generateCustomSplit(user: UserDoc, request: string): (GenResult & { resolution?: ResolvedSplit; validation?: ValidationResult; notes: string[] }) {
  const notes: string[] = []
  const resolved = resolveCustomSplit(user.days_available.length, request)
  if (!resolved) return { ok: false, reason: 'no_resolution_for_day_count', notes }
  const validation = validateCustomSplit(resolved.dayStructure, user.days_available.length)
  notes.push(...validation.warnings)
  if (user.experience === 'Beginner') notes.push('CS07: honouring your custom split — a preset would serve a beginner slightly better, but it’s your program.')
  const gen = generateProgram(user, { dayStructure: resolved.dayStructure })
  return { ...gen, resolution: resolved, validation, notes }
}
