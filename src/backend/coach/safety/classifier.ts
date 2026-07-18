/**
 * Safety classifier (spec §2: "high-recall rules PLUS a separately validated classifier").
 *
 * A validated ML classifier — trained, evaluated against a clinician-reviewed test set with
 * approved sensitivity / false-positive thresholds per tier, and covering misspellings, slang,
 * indirect language, context and multiple languages — is a data + independent-validation effort
 * that CANNOT be completed in application code here. It is therefore [TO BUILD] (spec §21).
 *
 * Until it ships, `stubClassifier` stands in and is deliberately FAIL-SAFE, not permissive:
 * any input that is not confidently benign resolves toward caution, so borderline cases can
 * never fall through to normal coaching in the rules-only state. The router takes the HIGHEST
 * tier from (rules ∪ classifier), so this stub can only ever ADD caution, never remove it.
 */

import type { CoachContext, DetectorHit } from './types'
import { hasAnySafetyAdjacentSignal, isKnownFalsePositive } from './rules'

export interface SafetyClassifier {
  /** Version string recorded with every safety event (spec §18 "record by classifier version"). */
  readonly version: string
  /** True once a validated model backs this classifier (gates enabling — spec §21). */
  readonly validated: boolean
  classify(text: string, ctx: CoachContext): DetectorHit[]
}

/**
 * Fail-safe stub. Confidently-benign input (no safety-adjacent signal, or a known
 * false-positive like "that workout killed me") returns no hit. ANYTHING ELSE returns a
 * low-tier `catch_all` escalation ("possible safety signal → withhold/refer"), so the
 * rules-only system never coaches a borderline message by default.
 */
export const stubClassifier: SafetyClassifier = {
  version: 'stub-0[TO BUILD]',
  validated: false,
  classify(text: string, _ctx: CoachContext): DetectorHit[] {
    if (isKnownFalsePositive(text)) return []
    if (hasAnySafetyAdjacentSignal(text)) {
      return [{ category: 'catch_all', source: 'classifier', reason: 'stub_uncertain_escalation' }]
    }
    return []
  },
}

/** The active classifier. Swap for the validated model once it exists (spec §21/§23). */
export const activeClassifier: SafetyClassifier = stubClassifier
