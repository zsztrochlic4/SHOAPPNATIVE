/**
 * Pre-response safety ROUTER (spec §2, §3). Runs BEFORE the coaching model on EVERY message,
 * on BOTH paths. Combines high-recall rules, the (fail-safe) classifier, and persistent safety
 * state; the HIGHEST applicable tier always wins; the coaching model only ever sees the tier the
 * router has already set and can never override it.
 *
 * Fail-safe: if anything in classification throws, the router returns a `service_unavailable`
 * decision — never `allow`, never the fitness menu.
 */

import type { CoachContext, DetectorHit, SafetyAction, SafetyCategory, SafetyDecision, SafetySession } from './types'
import { CATEGORY_TIER } from './types'
import { runRules } from './rules'
import { activeClassifier } from './classifier'
import { correctionAdjust, isGenuineCorrection, stateHits, applyDecision } from './stateMachine'

const ACTION: Record<SafetyCategory, { action: SafetyAction; responseKey: string | null }> = {
  immediate_danger: { action: 'block_emergency', responseKey: 'immediate_danger' },
  medical_emergency: { action: 'block_emergency', responseKey: 'medical_emergency' },
  harm_to_others: { action: 'block_emergency', responseKey: 'harm_to_others' },
  overdose_poisoning: { action: 'block_poisons', responseKey: 'overdose_poisoning' },
  crisis_concern: { action: 'block_crisis', responseKey: 'crisis_concern' },
  third_party_crisis: { action: 'block_third_party', responseKey: 'third_party_crisis' },
  medical_urgent: { action: 'refer', responseKey: 'medical_urgent' },
  injury_override: { action: 'refer', responseKey: 'injury_override' },
  pregnancy: { action: 'refer', responseKey: 'pregnancy' },
  medical_condition: { action: 'refer', responseKey: 'medical_condition' },
  under_18: { action: 'suspend', responseKey: 'under_18' },
  disordered_eating: { action: 'refer', responseKey: 'disordered_eating' },
  steroids_ped: { action: 'refer', responseKey: 'steroids_ped' },
  rapid_weight_loss: { action: 'refer', responseKey: 'rapid_weight_loss' },
  meal_plan: { action: 'refer', responseKey: 'meal_plan' },
  prescribed_medication: { action: 'refer', responseKey: 'prescribed_medication' },
  supplement_dosing: { action: 'refer', responseKey: 'supplement_dosing' },
  unsafe_training: { action: 'refer', responseKey: 'unsafe_training' },
  ai_relationship: { action: 'refer', responseKey: 'ai_relationship' },
  off_topic: { action: 'refer', responseKey: 'off_topic' },
  catch_all: { action: 'refer', responseKey: 'catch_all' },
  none: { action: 'allow', responseKey: null },
}

function decide(hits: DetectorHit[]): SafetyDecision {
  if (hits.length === 0) {
    return { category: 'none', tier: 0, action: 'allow', responseKey: null, allowCoaching: true, hits: [], reason: 'no_signal' }
  }
  let top = hits[0]
  for (const h of hits) if (CATEGORY_TIER[h.category] > CATEGORY_TIER[top.category]) top = h
  const a = ACTION[top.category]
  return {
    category: top.category,
    tier: CATEGORY_TIER[top.category],
    action: a.action,
    responseKey: a.responseKey,
    allowCoaching: top.category === 'none',
    hits,
    reason: top.reason,
  }
}

function failSafe(): SafetyDecision {
  return { category: 'none', tier: -1, action: 'service_unavailable', responseKey: null, allowCoaching: false, hits: [], reason: 'classification_unavailable' }
}

/**
 * Classify one message and enforce the outcome. Deterministic; the coaching model plays no part.
 * A genuine contextual correction suppresses the fail-safe classifier escalation for that turn
 * (it is re-evaluated on context here, not by naive tokens), but concrete rule/state hits still win.
 */
export function route(text: string, ctx: CoachContext, session: SafetySession): SafetyDecision {
  try {
    const correctionHits = correctionAdjust(session, text)
    const ruleHits = runRules(text, ctx)
    const sHits = stateHits(session, text, ctx)
    const genuine = isGenuineCorrection(text)
    const clsHits = genuine ? [] : activeClassifier.classify(text, ctx)
    const decision = decide([...correctionHits, ...ruleHits, ...sHits, ...clsHits])
    applyDecision(session, decision)
    return decision
  } catch {
    return failSafe()
  }
}
