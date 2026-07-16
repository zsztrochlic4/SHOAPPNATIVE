/**
 * Re-screen on a health change — Generator Flow step 13 (runtime), HARD safety.
 * Source: sheets "Screening Outcomes", "Safety Rules" S06, "Injury Modifications", "Coach AI
 * Operating Rules" (consult order: a health change routes before anything else). A goal
 * change, a new injury, a reported stop symptom, or any changed health answer re-runs the
 * screening router BEFORE the program continues. Screening stays current across the life of
 * the program. Deterministic; reuses the single screening + stop-symptom logic.
 */

import type { InjuryRegion, ScreeningAnswers, ScreeningFollowups, ScreeningRecord } from '../schema'
import { blocksGeneration, evaluateScreening } from './screening'
import { escalateStopSymptom, type StopSymptomEscalation } from './stopSymptom'

export interface HealthChange {
  /** A newly reported stop symptom (routes to S06, not a re-screen). */
  stopSymptom?: string
  /** A new injury region flagged mid-program, with its joint follow-ups. */
  newInjury?: { region: InjuryRegion; followups: ScreeningFollowups }
  /** A screening answer that changed since onboarding. */
  answerChange?: Partial<ScreeningAnswers>
  /** Result of a fresh free-text red-flag scan, if any. */
  redFlag?: boolean
}

export type ReScreenResult =
  | { kind: 'stop_symptom'; escalation: StopSymptomEscalation }
  | { kind: 're_screened'; screening: ScreeningRecord; mustHalt: boolean; mustRegenerate: boolean; addedRegions: InjuryRegion[]; note: string }

/**
 * Route a mid-program health change. A stop symptom escalates immediately (S06). Otherwise
 * the screening router re-runs with the merged answers/injury; a blocking outcome halts
 * generation, a MODIFY adds the region and regenerates with the Injury-Mod rules.
 */
export function reScreen(current: ScreeningRecord, change: HealthChange, currentRegions: InjuryRegion[]): ReScreenResult {
  // A reported stop symptom is never a re-screen — it's an S06 escalation.
  if (change.stopSymptom) {
    return { kind: 'stop_symptom', escalation: escalateStopSymptom(change.stopSymptom) }
  }

  const answers: Partial<ScreeningAnswers> = { ...current.answers, ...change.answerChange, ...(change.newInjury ? { q5: true } : {}) }
  const addedRegions = change.newInjury ? [change.newInjury.region] : []
  const affectedRegions = [...new Set([...currentRegions, ...addedRegions])]
  const followups: ScreeningFollowups = { ...current.followups, ...(change.newInjury?.followups ?? {}) }

  const res = evaluateScreening({ answers, followups, affectedRegions, redFlag: change.redFlag ?? false })
  const mustHalt = blocksGeneration(res.outcome)
  return {
    kind: 're_screened',
    screening: { ...current, outcome: res.outcome, answers, followups },
    mustHalt,
    mustRegenerate: !mustHalt && (res.outcome === 'MODIFY_AND_CONTINUE' || addedRegions.length > 0),
    addedRegions,
    note: mustHalt
      ? 'A health answer changed the screening outcome — pausing generation and routing you to a professional before we continue.'
      : addedRegions.length
        ? `Noted a new area to train around (${addedRegions.join(', ')}) — rebuilding your sessions around it with the injury rules.`
        : 'Re-screened; nothing changes.',
  }
}
