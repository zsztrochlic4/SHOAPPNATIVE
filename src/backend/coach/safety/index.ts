/**
 * Coach Safety Guardrails — public API. BOTH coach paths (live-AI and on-device fallback) call
 * these so enforcement is identical and cannot drift (spec §2, §7).
 *
 *   guardIncoming(text, ctx, session)  → run BEFORE any coaching. Blocks with a fixed response,
 *                                        or allows normal coaching. Fails safe on any error.
 *   guardOutgoing(reply, decision, …)  → run on the coach's reply BEFORE the user sees it.
 *   coachEligibility(ctx)              → stored 18+ gate (calls the engine's age routing).
 *
 * The coach ships DISABLED (coachGate.COACH_ENABLED === false). None of this enables it. Enabling
 * remains gated on the section 21/23 independent review — see ./STATUS.md.
 */

import type { CoachContext, FixedResponse, GuardOutcome, SafetyDecision, SafetySession } from './types'
import { route } from './router'
import { validateOutgoing } from './validator'
import { responseFor, serviceUnavailable } from './responses'
import { ageEligibility } from './engineBridge'

export { newSafetySession } from './types'
export type { CoachContext, SafetySession, SafetyDecision, GuardOutcome, FixedResponse } from './types'
export { serviceUnavailable } from './responses'
export { activeClassifier } from './classifier'

/**
 * The single gate every incoming message passes through, on both paths. MUST run before any
 * rate-limit / daily-message-limit check so a crisis is never blocked by the limit (spec §2).
 */
export function guardIncoming(text: string, ctx: CoachContext, session: SafetySession): GuardOutcome {
  try {
    const decision = route(text, ctx, session)
    if (decision.action === 'allow') return { outcome: 'allow', decision }
    if (decision.action === 'service_unavailable') {
      return { outcome: 'block', decision, response: serviceUnavailable() }
    }
    return { outcome: 'block', decision, response: responseFor(decision.responseKey) }
  } catch {
    // Classification unavailable → neutral service-unavailable + crisis options. Never the menu.
    const decision: SafetyDecision = {
      category: 'none', tier: -1, action: 'service_unavailable', responseKey: null,
      allowCoaching: false, hits: [], reason: 'guard_threw',
    }
    return { outcome: 'block', decision, response: serviceUnavailable() }
  }
}

/** Validate the coach's reply. Returns the safe text to actually show the user. */
export function guardOutgoing(reply: string, decision: SafetyDecision, ctx: CoachContext, session: SafetySession): string {
  try {
    return validateOutgoing(reply, decision, ctx, session).text
  } catch {
    return serviceUnavailable().text
  }
}

/** Stored 18+ eligibility (spec §20). In-conversation "I'm 16" is handled by the router. */
export function coachEligibility(ctx: CoachContext): { eligible: boolean; response?: FixedResponse } {
  try {
    const age = ageEligibility(ctx)
    if (age.band === 'under_18') return { eligible: false, response: responseFor('under_18') }
    return { eligible: true }
  } catch {
    return { eligible: true } // engine failure must not itself block a legitimate adult; router still guards content
  }
}
