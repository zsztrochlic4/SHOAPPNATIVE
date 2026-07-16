/**
 * Static workbook data types (the seeded, immutable side of the backend).
 * Source sheets: "Exercise Database" (04) and "Substitutions" (05).
 * These are generated into exercises.ts / substitutions.ts from the workbook — do not
 * hand-edit the generated files; edit the sheet and re-run the generator.
 */

import type { EquipmentTier, MeasurementType } from '../schema'
import type { BodyRegion, PrescriptionClass, SkillLevel } from '../safety/safetyRules'

export interface Exercise {
  id: string
  name: string
  muscleGroup: string
  primaryMuscles: string
  movementPattern: string
  /** "Chest | Press" → ['Chest', 'Press']; used for substitution grouping. */
  substitutionGroup: string[]
  type: 'Compound' | 'Isolation'
  equipmentTier: EquipmentTier
  /** Human-readable equipment string, e.g. "Barbell, bench". */
  equipment: string
  skillLevel: SkillLevel
  unilateral: boolean
  loadable: boolean
  prescriptionClass: PrescriptionClass
  /** Weighting tag (not a hard filter): Strength/Hypertrophy/etc. */
  primaryGoalFit: string
  /** Closest-to-failure this exercise may EVER be taken (Safety S03/floor). */
  minRir: number
  failureAllowed: boolean
  spotterRecommended: boolean
  /** Structured tags; comma-separated in the sheet, a slash = any-one-of (bench/chair). */
  requiredEquipmentTags: string[]
  optionalEquipmentTags: string[]
  /** Authored in the Exercise Database (Impact Level column). Injury-Mod rules prefer Low. */
  impactLevel: 'Low' | 'Moderate' | 'High'
  supported: boolean
  active: boolean
  /** Derived from Load Unit (the sheet's Measurement Type column is blank). */
  measurementType: MeasurementType
  loadUnit: 'kg' | 'bodyweight' | 'rounds' | 'seconds' | 'assist_kg'
  /** Normalised region tokens the exercise loads (matched vs affected_regions). */
  stressRegions: string[]
  /** Ordered best-first substitute ids (Substitutions sheet is authoritative). */
  substitutionIds: string[]
  substitutionCount: number
  /** Upper/lower for the Safety S07 absolute weekly load cap. */
  bodyRegion: BodyRegion
  // Screen copy (shown on the exercise screen).
  whyInDatabase: string
  whatItDoes: string
  steps: string[]
  commonMistake: string
  safetyNote: string
}

export interface Substitution {
  /** `${exerciseId}-${substituteId}`, the Firestore doc id. */
  key: string
  exerciseId: string
  substituteId: string
  /** 1 = best match; the generator walks priority order. */
  priority: number
  matchType: string
}

/** Training split (sheet "Splits"). day_structure is the ordered list of day types. */
export interface Split {
  splitId: string
  name: string
  daysMin: number
  daysMax: number
  dayStructure: string[] // e.g. ['Upper','Lower','Upper','Lower']
  bestForGoals: string[] // 'All' = any
  experience: string[]   // 'All' = any
  why: string
}

/** Split Selector decision-table row (sheet "Split Selector"); first match wins. */
export interface SplitSelectorRow {
  daysPerWeek: number
  experience: string[] // pipe tokens, 'All' = any
  goal: string[]       // pipe tokens, 'All' = any
  splitId: string
  reason: string
}

/** One slot in a day-type template (sheet "Session Templates"). */
export interface SessionSlot {
  slotId: string
  dayType: string
  order: number
  slotName: string
  muscleGroupFilter: string      // pipe tokens, 'Any', or FOCAL_1/FOCAL_2, or conditioning
  movementPatternFilter: string  // pipe tokens or 'Any' or free note
  typeFilter: string             // Compound/Isolation/Any/Compound>Isolation/Isolation>Compound (+notes)
  required: boolean
  note: string
}

/** Weekly volume target (sheet "Weekly Volume"). */
export interface WeeklyVolumeRow {
  goal: string
  experience: string // 'All' = any
  weeklySetsMin: number
  weeklySetsMax: number
  appliesTo: string[] // muscle tokens, or a prose note for Strength/GenFitness
}

/** External commitment adjustment row (sheet "External Commitments"). */
export interface CommitmentRow {
  commitmentType: string
  examples: string
  loadProfile: string[]
  volumeCutMuscles: string[] // may be ['user_reported']
  volumeCutSetsMin: number
  volumeCutSetsMax: number
  adjacencyBlockHours: number
  intervalSlotsRemoved: number
  rirPenaltyNextDay: number
  notes: string
}

/** Injury Modifications region row (sheet "Injury Modifications"). */
export interface InjuryModRow {
  region: string
  matchesStressRegion: string
  avoidPatterns: string
  prefer: string
  rirBump: number
  excludeIds: string[]
  downgradeIds: string[]
  reviewAfter: string
  coachNote: string
}

/**
 * Prescription Grid row (sheet "Prescription Logic"), keyed by `${Goal}|${Class}`. Every
 * numeric field is a plain number or null (empty = not applicable). RIR is reps-in-reserve;
 * higher = easier/safer. The generator reads the row, then clamps it against Safety Rules.
 */
export interface PrescriptionRow {
  key: string
  goal: string
  prescriptionClass: string
  setsMin: number | null
  setsMax: number | null
  repsMin: number | null
  repsMax: number | null
  durationSecMin: number | null
  durationSecMax: number | null
  rirMin: number | null
  rirMax: number | null
  restSecMin: number | null
  restSecMax: number | null
  pct1rmMin: number | null
  pct1rmMax: number | null
  roundsMin: number | null
  roundsMax: number | null
  progressionRule: string
  coachNote: string
}
