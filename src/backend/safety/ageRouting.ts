/**
 * Age Routing — HARD safety logic.
 *
 * Source of truth: workbook sheet "Age Routing" (docs/spec/sheets/15_Age_Routing.tsv).
 * Runs BEFORE the screening questions. StrengthHub is strictly 18+: anyone under 18 is
 * blocked entirely — there is NO young-person or guardian-consent pathway. Age is derived
 * from date_of_birth and is NEVER defaulted: a missing/unparseable DOB routes to
 * `unverified`, which blocks generation.
 *
 * This module is deterministic and has no side effects.
 */

import type { ScreeningVersion } from '../schema'

export type AgeBand = 'adult' | 'under_18' | 'unverified'

export interface AgeRoute {
  band: AgeBand
  ageYears: number | null
  screening_version: ScreeningVersion
  /** true → no program may generate (blocked). */
  blocked: boolean
  age_verified: boolean
  /** Neutral, non-diagnostic message for the blocked states. */
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
 * Route a user by date of birth. StrengthHub is strictly 18+ — anyone under 18 is blocked
 * entirely. The second parameter is accepted for call-site compatibility but ignored: there
 * is no guardian-consent pathway.
 */
export function routeByAge(
  dob: string | null | undefined,
  _unused: boolean = false,
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
      age_verified: false,
      message: 'Please add your date of birth so we can build your program safely.',
    }
  }

  // Under 18: out of scope. Hard stop, no young-person or guardian-consent pathway.
  if (ageYears < 18) {
    return {
      band: 'under_18',
      ageYears,
      screening_version: 'none',
      blocked: true,
      age_verified: true,
      message: 'StrengthHub creates personalised training programs for people aged 18 and over, so we can’t build one for you yet.',
    }
  }

  // 18+: standard adult screening.
  return {
    band: 'adult',
    ageYears,
    screening_version: 'adult_v1',
    blocked: false,
    age_verified: true,
    message: null,
  }
}
