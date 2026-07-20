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
import { runRules, hasImmediacy } from './rules'
import { activeClassifier } from './classifier'
import { correctionAdjust, isGenuineCorrection, stateHits, applyDecision } from './stateMachine'

/**
 * The 000/Poisons emergency FLOOR (spec §3/§6/§10). Once any detector asserts a category at or above
 * this tier, the decision can never be downgraded below it by a correction, a persistent-state hit,
 * or the classifier — the most-protective route always wins. `overdose_poisoning` (90) is the lowest
 * emergency-tier category; `crisis_concern` (88) is a Lifeline block, not a 000 case, so it sits just
 * below the floor by design.
 */
const EMERGENCY_FLOOR_TIER = CATEGORY_TIER.overdose_poisoning

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
 * Immediacy escalation (spec §3): an already-detected self-directed crisis PLUS a generic immediacy
 * modifier is active intent, which routes to the 000 emergency response, not the Lifeline block.
 * This is precedence over the detected category — it never inspects a specific reported sentence.
 */
function escalateImmediacy(hits: DetectorHit[], text: string): DetectorHit[] {
  const hasCrisisConcern = hits.some((h) => h.category === 'crisis_concern')
  if (hasCrisisConcern && hasImmediacy(text)) {
    return [{ category: 'immediate_danger', source: 'state', reason: 'crisis_with_immediacy' }]
  }
  return []
}

/**
 * Overdose / third-party EMERGENCY precedence (Jack §1; spec §6/§10). Two class-level rules that
 * operate on the SET of already-detected categories (rules ∪ classifier ∪ state) — never on a
 * specific phrase, so they generalise to any wording that produces those categories:
 *   • An overdose/poisoning is a Poisons-tier referral ALONE, but combined with any immediate-danger
 *     indicator (self-harm intent, a co-occurring medical emergency, or a third party at risk) it is
 *     a 000 emergency, not Poisons.
 *   • A third party in immediate danger routes to 000, not the softer third-party-crisis route.
 * decide() then picks the escalated emergency tier; the emergency floor keeps it from being downgraded.
 */
function escalateToEmergency(hits: DetectorHit[]): DetectorHit[] {
  const present = (c: SafetyCategory) => hits.some((h) => h.category === c)
  const out: DetectorHit[] = []
  const overdose = present('overdose_poisoning')
  const selfHarm = present('immediate_danger') || present('crisis_concern')
  const emergencySignal = present('medical_emergency') || present('harm_to_others')
  const thirdParty = present('third_party_crisis')
  // Overdose + self-harm intent → 000 (immediate danger); overdose + another emergency/third-party
  // danger signal → 000. A bare overdose with NO danger signal stays a Poisons-tier referral.
  if (overdose && selfHarm) {
    out.push({ category: 'immediate_danger', source: 'state', reason: 'overdose_with_self_harm_intent' })
  } else if (overdose && (emergencySignal || thirdParty)) {
    out.push({ category: 'medical_emergency', source: 'state', reason: 'overdose_with_danger' })
  }
  // Third party in IMMEDIATE danger (a co-occurring emergency/overdose/immediate-danger signal, which
  // the classifier emits for a plan/means/goodbye/acting-now) → 000, not the softer support-line route.
  // General third-party concern with no such signal stays third_party_crisis.
  if (thirdParty && (emergencySignal || overdose || present('immediate_danger'))) {
    out.push({ category: 'medical_emergency', source: 'state', reason: 'third_party_immediate_danger' })
  }
  return out
}

/** The highest emergency-tier (000/Poisons) hit present, if any — the floor the decision can't drop below. */
function emergencyFloor(hits: DetectorHit[]): DetectorHit | null {
  let top: DetectorHit | null = null
  for (const h of hits) {
    if (CATEGORY_TIER[h.category] >= EMERGENCY_FLOOR_TIER &&
        (!top || CATEGORY_TIER[h.category] > CATEGORY_TIER[top.category])) top = h
  }
  return top
}

/**
 * Classify one message and enforce the outcome. Deterministic; the coaching model plays no part.
 * A genuine, contextually-consistent correction suppresses the fail-safe classifier escalation for
 * that turn (re-evaluated on full context here, not by naive tokens); a correction contradicted by a
 * live crisis signal is not genuine (stateMachine), so concrete rule/state hits always win. A
 * concrete emergency-tier signal can never be downgraded (the emergency floor below).
 */
export function route(text: string, ctx: CoachContext, session: SafetySession): SafetyDecision {
  try {
    const ruleHits = runRules(text, ctx)
    const correctionHits = correctionAdjust(session, text)
    const sHits = stateHits(session, text, ctx)
    const genuine = isGenuineCorrection(text)
    const clsHits = genuine ? [] : activeClassifier.classify(text, ctx)
    const detected = [...ruleHits, ...sHits, ...clsHits]
    const escalated = [...escalateImmediacy(detected, text), ...escalateToEmergency(detected)]
    let decision = decide([...correctionHits, ...detected, ...escalated])
    // Emergency floor (defence in depth): if a concrete emergency-tier signal is present but the
    // composed decision came out lower, the emergency wins. Most-protective route always prevails.
    const floor = emergencyFloor([...ruleHits, ...escalated])
    if (floor && decision.tier < CATEGORY_TIER[floor.category]) decision = decide([floor])
    applyDecision(session, decision)
    return decision
  } catch {
    return failSafe()
  }
}

/**
 * ASYNC router — identical composition to `route`, but the classifier is the LLM
 * (`activeClassifier.classifyAsync`) fed the recent conversation for multi-turn escalation. Used by
 * both live coach paths via `coachPrecheckAsync`. Guarantees preserved:
 *   • RULES FLOOR — `runRules` still runs; anything the rules catch is still caught.
 *   • MOST-PROTECTIVE WINS — highest tier of (rules ∪ classifier ∪ state ∪ escalation).
 *   • EMERGENCY FLOOR — a concrete 000/Poisons signal can never be downgraded.
 *   • FAIL-SAFE — if the model is unavailable/errors/times out and nothing else flagged the message,
 *     the outcome is service_unavailable, NEVER allow.
 * A genuine, contextually-consistent correction still suppresses the classifier for that turn (the
 * router decides re-engagement on full context, exactly as in the sync path).
 */
export async function routeAsync(
  text: string, ctx: CoachContext, session: SafetySession, recent: string[] = [],
): Promise<SafetyDecision> {
  try {
    const ruleHits = runRules(text, ctx)
    const correctionHits = correctionAdjust(session, text)
    const sHits = stateHits(session, text, ctx)
    const genuine = isGenuineCorrection(text)
    let clsHits: DetectorHit[] = []
    let clsUnavailable = false
    if (!genuine) {
      if (activeClassifier.classifyAsync) {
        try { clsHits = await activeClassifier.classifyAsync(text, ctx, recent) }
        catch { clsUnavailable = true } // model down/uncertain → handled by the fail-safe below
      } else {
        clsHits = activeClassifier.classify(text, ctx) // no async model wired → sync stub floor
      }
    }
    const detected = [...ruleHits, ...sHits, ...clsHits]
    const escalated = [...escalateImmediacy(detected, text), ...escalateToEmergency(detected)]
    let decision = decide([...correctionHits, ...detected, ...escalated])
    const floor = emergencyFloor([...ruleHits, ...escalated])
    if (floor && decision.tier < CATEGORY_TIER[floor.category]) decision = decide([floor])
    // Fail-safe: classifier unavailable AND nothing else caught it → never allow normal coaching.
    if (clsUnavailable && decision.action === 'allow') return failSafe()
    applyDecision(session, decision)
    return decision
  } catch {
    return failSafe()
  }
}
