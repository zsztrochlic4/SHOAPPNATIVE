/**
 * Coach Safety Guardrails — public API. BOTH coach paths (live-AI and on-device fallback) call
 * these so enforcement is identical and cannot drift (spec §2, §7).
 *
 *   coachPrecheck(text, ctx, session, usage, todayKey)  → THE single entry both paths use.
 *       Runs the safety guard FIRST (a crisis/safety block is NEVER gated by the daily limit),
 *       then the daily message limit, then allows normal coaching. Fails safe on any error.
 *   guardIncoming / guardOutgoing                       → the lower-level guard (used by coachPrecheck).
 *   coachEligibility(ctx)                               → stored 18+ gate (calls the engine's age routing).
 *   coachKillSwitchEngaged()                            → server-side remote disable (spec §20).
 *
 * The coach ships DISABLED (coachGate.COACH_ENABLED === false). None of this enables it. Enabling
 * remains gated on the section 21/23 independent review — see ./STATUS.md.
 */

import type { CoachContext, FixedResponse, GuardOutcome, SafetyDecision, SafetySession } from './types'
import { route } from './router'
import { validateOutgoing } from './validator'
import { localizedResponse, localizedServiceUnavailable } from './responses'
import { ageEligibility } from './engineBridge'
import { recordSafetyEvent } from './safetyAnalytics'
import { withinDailyLimit, dailyLimitResponse, type CoachUsage } from './dailyLimit'

export { newSafetySession } from './types'
export type { CoachContext, SafetySession, SafetyDecision, GuardOutcome, FixedResponse, ContactButton } from './types'
export { serviceUnavailable } from './responses'
export { activeClassifier } from './classifier'
export { coachKillSwitchEngaged } from './killSwitch'
export { weeklySafetySummary, ANALYTICS_ACTIVE } from './safetyAnalytics'
export { DAILY_COACH_LIMIT, type CoachUsage } from './dailyLimit'
export { loadSession, persistSession, clearState, PERSISTENCE_ACTIVE } from './operationalStateStore'

/** Lower-level guard: safety only (no rate limit). Both paths reach this via coachPrecheck. */
export function guardIncoming(text: string, ctx: CoachContext, session: SafetySession): GuardOutcome {
  try {
    const decision = route(text, ctx, session)
    recordSafetyEvent(decision.category) // content-free aggregate; no-op while dormant (spec §20)
    if (decision.action === 'allow') return { outcome: 'allow', decision }
    if (decision.action === 'service_unavailable') {
      return { outcome: 'block', decision, response: localizedServiceUnavailable(ctx.isAustralia) }
    }
    return { outcome: 'block', decision, response: localizedResponse(decision.responseKey, ctx.isAustralia) }
  } catch {
    // Classification unavailable → neutral service-unavailable + crisis options. Never the menu.
    const decision: SafetyDecision = {
      category: 'none', tier: -1, action: 'service_unavailable', responseKey: null,
      allowCoaching: false, hits: [], reason: 'guard_threw',
    }
    return { outcome: 'block', decision, response: localizedServiceUnavailable(ctx.isAustralia) }
  }
}

/** Validate the coach's reply. Returns the safe text to actually show the user. */
export function guardOutgoing(reply: string, decision: SafetyDecision, ctx: CoachContext, session: SafetySession): string {
  try {
    return validateOutgoing(reply, decision, ctx, session).text
  } catch {
    return localizedServiceUnavailable(ctx.isAustralia).text
  }
}

/** The precheck outcome the wiring acts on. */
export type CoachPrecheck =
  | { kind: 'block'; response: FixedResponse; decision: SafetyDecision }
  | { kind: 'limit'; response: FixedResponse }
  | { kind: 'allow'; decision: SafetyDecision }

/**
 * The SINGLE entry both coach paths use. Order is enforced here so it cannot drift:
 *   1. safety guard — a crisis/safety block is returned regardless of the daily limit (spec §2/§21)
 *   2. daily limit  — only a NORMAL coaching turn can be limited; the reply is neutral, never a
 *                     safety response and never the fitness menu
 *   3. allow        — proceed to the model / fallback, then guardOutgoing
 */
export function coachPrecheck(
  text: string, ctx: CoachContext, session: SafetySession,
  usage: CoachUsage | undefined, todayKey: string,
): CoachPrecheck {
  const g = guardIncoming(text, ctx, session)
  if (g.outcome === 'block') return { kind: 'block', response: g.response, decision: g.decision }
  if (!withinDailyLimit(usage, todayKey)) return { kind: 'limit', response: dailyLimitResponse() }
  return { kind: 'allow', decision: g.decision }
}

/** Stored 18+ eligibility (spec §20). In-conversation "I'm 16" is handled by the router. */
export function coachEligibility(ctx: CoachContext): { eligible: boolean; response?: FixedResponse } {
  try {
    const age = ageEligibility(ctx)
    if (age.band === 'under_18') return { eligible: false, response: localizedResponse('under_18', ctx.isAustralia) }
    return { eligible: true }
  } catch {
    return { eligible: true } // engine failure must not itself block a legitimate adult; router still guards content
  }
}
