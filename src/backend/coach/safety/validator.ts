/**
 * Post-response VALIDATOR (spec §2 "defence in depth"; §26 gate item). Inspects the coach's
 * OUTGOING message before the user sees it, so a model that drifted past the prompt/router still
 * cannot deliver unsafe content. If the reply violates the active safety state or a hard scope
 * limit, it is replaced with the appropriate fixed response.
 *
 * This is the "coach never verbally recommends what the engine would prohibit" check (spec §6/§16)
 * — it calls the engine bridge to know what is excluded.
 */

import type { CoachContext, SafetyDecision, SafetySession } from './types'
import { localizedResponse } from './responses'
import { replyRecommendsProhibited } from './engineBridge'

export interface ValidatedReply {
  text: string
  replaced: boolean
  reason?: string
}

export function validateOutgoing(
  reply: string,
  decision: SafetyDecision,
  ctx: CoachContext,
  session: SafetySession,
): ValidatedReply {
  // If we somehow reach here on a non-allow decision, the fixed response is authoritative.
  if (decision.action !== 'allow') {
    return { text: localizedResponse(decision.responseKey, ctx.isAustralia).text, replaced: true, reason: 'non_allow_decision' }
  }

  const r = ` ${(reply || '').toLowerCase()} `

  // An active crisis state must never be coached over, whatever the model produced.
  if (session.active.has('crisis') || session.carriedOver.has('crisis')) {
    return { text: localizedResponse('crisis_concern', ctx.isAustralia).text, replaced: true, reason: 'crisis_state_active' }
  }
  // Never recommend an exercise the engine excluded for this user's injuries (spec §6/§16).
  if (replyRecommendsProhibited(reply, ctx)) {
    return { text: localizedResponse('injury_override', ctx.isAustralia).text, replaced: true, reason: 'recommended_excluded_exercise' }
  }
  // No meal plans / personalised calorie or macro targets leaking through (spec §5).
  if (/\b\d{3,4}\s?(cal|calorie|calories|kcal)\b/.test(r) || r.includes('your macros are') ||
      /\b\d+\s?g\s?(of\s?)?(protein|carbs|fat)\b/.test(r) || r.includes('meal plan') || r.includes('day meal plan')) {
    return { text: localizedResponse('meal_plan', ctx.isAustralia).text, replaced: true, reason: 'meal_plan_or_targets' }
  }
  // No steroid / PED dosing or cycles leaking through (spec §11).
  if (/\b(mg|ml|iu)\b/.test(r) && /(test |testosterone|tren|steroid|sarm|cycle|inject)/.test(r)) {
    return { text: localizedResponse('steroids_ped', ctx.isAustralia).text, replaced: true, reason: 'ped_dosing' }
  }
  // Never tell a user to stop prescribed medication (spec §11 boundary).
  if (/(stop|quit|come off)\b.*(medication|meds|prescription|prescribed|tablets)/.test(r)) {
    return { text: localizedResponse('prescribed_medication', ctx.isAustralia).text, replaced: true, reason: 'medication_change' }
  }

  return { text: reply, replaced: false }
}
