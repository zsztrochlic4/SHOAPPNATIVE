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
  impactLevel: 'Low' | 'Moderate' | 'High' | null
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
