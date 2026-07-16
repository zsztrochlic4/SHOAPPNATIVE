/**
 * Age Routing — HARD safety logic.
 *
 * Source of truth: workbook sheet "Age Routing" (docs/spec/sheets/15_Age_Routing.tsv).
 * Runs BEFORE the screening questions. Age is derived from date_of_birth and is
 * NEVER defaulted (owner-approved B2): a missing/unparseable DOB routes to
 * `unverified`, which blocks generation. The old "default to 20" behaviour is gone.
 *
 * This module is deterministic and has no side effects.
 */

import type { ScreeningVersion } from '../schema'

export type AgeBand = 'adult' | 'young_person' | 'under_16' | 'unverified'

export interface AgeRoute {
  band: AgeBand
  ageYears: number | null
  screening_version: ScreeningVersion
  /** true → no program may generate until resolved (block or clearance/consent). */
  blocked: boolean
  guardian_consent_required: boolean
  age_verified: boolean
  /** Neutral, non-diagnostic message for the blocked/consent states. */
  message: string | null
}

/** Whole years between an ISO 'YYYY-MM-DD' DOB and `now`, or null if unparseable. */
export function ageFromDob(dob: string | null | undefined, now: Date = new Date()): number | null {
  if (!dob) return null
  const d = new Date(dob)
  if (isNaN(d.getTime())) return null
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  // Guard against a future or absurd date.
  if (age < 0 || age > 120) return null
  return age
}

/**
 * Route a user by date of birth. `guardianConsent` only matters for the 16–17 band.
 */
export function routeByAge(
  dob: string | null | undefined,
  guardianConsent: boolean = false,
  now: Date = new Date(),
): AgeRoute {
  const ageYears = ageFromDob(dob, now)

  // Unverified: DOB absent or not parseable. Never defaulted.
  if (ageYears === null) {
    return {
      band: 'unverified',
      ageYears: null,
      screening_version: 'none',
      blocked: true,
      guardian_consent_required: false,
      age_verified: false,
      message: 'Please add your date of birth so we can build your program safely.',
    }
  }

  // Under 16: out of scope for launch. Hard stop.
  if (ageYears < 16) {
    return {
      band: 'under_16',
      ageYears,
      screening_version: 'none',
      blocked: true,
      guardian_consent_required: false,
      age_verified: true,
      message: 'StrengthHub isn’t designed for under-16s yet, so we can’t build a program for you.',
    }
  }

  // 16–17: young-person pathway, conservative defaults, guardian consent required.
  if (ageYears < 18) {
    return {
      band: 'young_person',
      ageYears,
      screening_version: 'youth_v1',
      // Blocked until a guardian has consented.
      blocked: !guardianConsent,
      guardian_consent_required: true,
      age_verified: true,
      message: guardianConsent
        ? null
        : 'A parent or guardian needs to give consent before we can build your program.',
    }
  }

  // 18+: standard adult screening.
  return {
    band: 'adult',
    ageYears,
    screening_version: 'adult_v1',
    blocked: false,
    guardian_consent_required: false,
    age_verified: true,
    message: null,
  }
}

/**
 * Young-person (16–17) conservative training defaults, per the sheet:
 * block Advanced + Power classes, rir_min +1, load increments at the bottom.
 * The generator reads these when band === 'young_person'.
 */
export const YOUNG_PERSON_DEFAULTS = {
  block_skill_levels: ['Advanced'] as const,
  block_prescription_classes: ['Power'] as const,
  rir_bump: 1,
  load_increment: 'min' as const,
}
