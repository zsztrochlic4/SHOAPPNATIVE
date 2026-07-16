/**
 * Pre-exercise screening router — HARD safety logic.
 *
 * Source of truth: workbook sheet "Screening Outcomes"
 * (docs/spec/sheets/13_Screening_Outcomes.tsv), modelled on the Adult Pre-Exercise
 * Screening System. Maps every user to exactly one outcome before anything generates.
 *
 * This is the SINGLE implementation of screening routing. The onboarding wizard and
 * the generator both call it, so the on-screen verdict and the stored/generated
 * verdict can never diverge.
 *
 * Owner-approved B1 fix is baked in here: the joint follow-ups are needed when
 * screening Q5 = Yes OR an injury region is flagged — not only on an injury chip.
 * A bare Q5 = Yes is no longer auto-routed to clearance; the follow-ups decide
 * MODIFY vs REQUIRE_CLEARANCE, exactly as they do for an injury chip.
 */

import type {
  InjuryRegion, ScreeningAnswers, ScreeningFollowups, ScreeningOutcome,
} from '../schema'

export interface ScreeningInput {
  answers: Partial<ScreeningAnswers>
  followups: ScreeningFollowups
  /** Regions flagged by the injury chips (users.affected_regions candidates). */
  affectedRegions: InjuryRegion[]
  /** Result of the CC06 free-text red-flag scan on `notes` (defaults false). */
  redFlag?: boolean
}

export interface ScreeningResult {
  outcome: ScreeningOutcome
  /** A joint/soft-tissue flag exists (Q5 Yes or an injury chip) → follow-ups apply. */
  jointFlag: boolean
  /** Machine-readable reasons, for the generation_audit trail. */
  reasons: string[]
}

/** Whether the joint follow-ups must be asked/applied (B1: Q5 Yes OR a chip). */
export function needsJointFollowups(
  answers: Partial<ScreeningAnswers>,
  affectedRegions: InjuryRegion[] | undefined,
): boolean {
  return answers.q5 === true || (affectedRegions?.length ?? 0) > 0
}

/** Any follow-up answer that routes a joint flag to professional clearance. */
export function followupsIndicateClearance(f: ScreeningFollowups): boolean {
  return (
    f.painful_now === true ||
    f.under_treatment === true ||
    f.exercise_restricted === true ||
    f.status === 'active' ||
    f.status === 'unsure'
  )
}

/**
 * Route to exactly one outcome. Precedence (first match wins):
 *  1. Chest pain at rest (Q3)                          → DO_NOT_GENERATE
 *  2. Q1, Q2, Q4, Q6, Q7 Yes, or a free-text red-flag  → REQUIRE_PROFESSIONAL_CLEARANCE
 *  3. Joint flag (Q5 Yes or chip):
 *       any follow-up to clearance                     → REQUIRE_PROFESSIONAL_CLEARANCE
 *       all follow-ups minor                           → MODIFY_AND_CONTINUE
 *  4. otherwise                                        → CLEAR
 */
export function evaluateScreening(input: ScreeningInput): ScreeningResult {
  const { answers: a, followups, affectedRegions, redFlag } = input
  const reasons: string[] = []
  const jointFlag = needsJointFollowups(a, affectedRegions)

  // 1. Acute red flag: chest pain at rest → hard stop.
  if (a.q3 === true) {
    reasons.push('q3_chest_pain_at_rest')
    return { outcome: 'DO_NOT_GENERATE', jointFlag, reasons }
  }

  // 2. Cardiac / dizziness / pregnancy / other, or a disclosed condition in free text.
  const clearanceQuestions: (keyof ScreeningAnswers)[] = ['q1', 'q2', 'q4', 'q6', 'q7']
  const hit = clearanceQuestions.filter((q) => a[q] === true)
  if (hit.length > 0 || redFlag) {
    if (hit.length) reasons.push(...hit.map((q) => `${q}_yes`))
    if (redFlag) reasons.push('free_text_red_flag')
    return { outcome: 'REQUIRE_PROFESSIONAL_CLEARANCE', jointFlag, reasons }
  }

  // 3. Joint / soft-tissue flag → the follow-ups decide.
  if (jointFlag) {
    if (followupsIndicateClearance(followups)) {
      reasons.push('joint_flag_followups_to_clearance')
      return { outcome: 'REQUIRE_PROFESSIONAL_CLEARANCE', jointFlag, reasons }
    }
    reasons.push('joint_flag_minor')
    return { outcome: 'MODIFY_AND_CONTINUE', jointFlag, reasons }
  }

  // 4. No flags.
  return { outcome: 'CLEAR', jointFlag, reasons }
}

/** Safety Rule S05 gate: these two outcomes block program generation entirely. */
export function blocksGeneration(outcome: ScreeningOutcome): boolean {
  return outcome === 'REQUIRE_PROFESSIONAL_CLEARANCE' || outcome === 'DO_NOT_GENERATE'
}

/** Neutral, non-diagnostic message shown for a blocked screening outcome. */
export function screeningMessage(outcome: ScreeningOutcome): string | null {
  switch (outcome) {
    case 'DO_NOT_GENERATE':
      return 'Some of your answers mean we can’t build a program right now. Please speak to a doctor before starting to train.'
    case 'REQUIRE_PROFESSIONAL_CLEARANCE':
      return 'Before we build your program, we’d like you to get the go-ahead from a GP, physiotherapist or exercise professional. Once you’re cleared, we’ll set everything up.'
    default:
      return null
  }
}
