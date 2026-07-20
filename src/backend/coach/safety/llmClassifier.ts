/**
 * LLM-based safety classifier (spec §2: the "separately validated classifier" slot).
 *
 * This is the DETECTION generaliser the fixed-phrase rules can't be: it classifies a message — with
 * recent conversation context — into the safety categories, so typos, paraphrases, slang, obfuscation
 * and multi-turn escalation are caught without hard-coding phrases. It returns `DetectorHit[]` to the
 * router exactly like the rules, and the router still takes the HIGHEST tier of (rules ∪ classifier ∪
 * state) — so the rules remain a FLOOR and this can only ADD protection.
 *
 * IT IS NOT VALIDATED. Building a classifier is not validating it. `activeClassifier.validated`
 * stays false; enabling still requires an independent clinical review against a holdout set the
 * builder never saw (clinician standard). Nothing here changes the gate.
 *
 * Model access is INJECTED (a `ClassifierTransport`) so this file stays pure and testable and never
 * imports Firebase: the app registers the Firebase AI Logic (Gemini) transport; the measurement
 * harness can register a real API transport. With NO transport, or on any error/timeout/parse
 * failure, classification is treated as UNAVAILABLE and the router fails safe (never "allow").
 */

import type { CoachContext, DetectorHit, SafetyCategory } from './types'
import { isKnownFalsePositive } from './rules'

/** Sends a fully-formed prompt to a model and resolves the raw text reply. null ⇒ no model wired. */
export type ClassifierTransport = (prompt: string, opts: { timeoutMs: number }) => Promise<string>

let transport: ClassifierTransport | null = null
/** Register (or clear) the model transport. Called by the app or the measurement harness. */
export function setClassifierTransport(t: ClassifierTransport | null): void { transport = t }
export function hasClassifierTransport(): boolean { return transport !== null }

/** Raised when the model can't produce a usable classification → router escalates protectively. */
export class ClassifierUnavailable extends Error {
  constructor(reason: string) { super(reason); this.name = 'ClassifierUnavailable' }
}

const TIMEOUT_MS = 6000

/** Categories the model may assign. Strict allowlist — anything else is treated as uncertain. */
const MODEL_CATEGORIES: SafetyCategory[] = [
  'immediate_danger', 'medical_emergency', 'harm_to_others', 'overdose_poisoning', 'crisis_concern',
  'third_party_crisis', 'medical_urgent', 'injury_override', 'pregnancy', 'medical_condition',
  'under_18', 'disordered_eating', 'rapid_weight_loss', 'meal_plan', 'steroids_ped',
  'supplement_dosing', 'prescribed_medication', 'unsafe_training', 'ai_relationship', 'off_topic',
]
const CATEGORY_SET = new Set<string>([...MODEL_CATEGORIES, 'none'])

/**
 * The classification instruction. Deliberately CONSERVATIVE / recall-biased: for a detect-and-refer
 * app a false alarm costs a gentle referral, a miss can cost a life, so when unsure it must flag.
 * It classifies; it never coaches. No specific test messages appear here — only category definitions.
 */
function buildPrompt(text: string, ctx: CoachContext, recent: string[]): string {
  const context = recent.length
    ? recent.slice(-6).map((m, i) => `  [${i + 1}] ${m}`).join('\n')
    : '  (none)'
  return [
    'You are a SAFETY CLASSIFIER for a fitness & nutrition coaching app used by university students.',
    'Your ONLY job is to label the user\'s LATEST message for safety routing. You are NOT the coach:',
    'do not reply, advise, or reassure. Output only the JSON described at the end.',
    '',
    'Judge the LATEST message using the earlier turns for context (multi-turn escalation counts: if an',
    'earlier turn raised concern and a later turn adds intent or immediacy, classify at the higher tier).',
    '',
    'Assign every safety category that applies, from this list ONLY:',
    '- immediate_danger: the user\'s own self-harm/suicide with intent, a plan, means, or immediacy; OR a person stating they are in immediate danger or need emergency help now — INCLUDING when they are outside their usual country or unsure which local emergency number to call (do not treat "I need emergency help and don\'t know the number" as ordinary chat).',
    '- crisis_concern: the user\'s OWN self-harm/suicidal ideation, hopelessness, or feeling there is no point / not wanting to be here, not yet imminent.',
    '- third_party_crisis: SOMEONE ELSE (friend, family) is at risk of self-harm. If that other person is in IMMEDIATE danger — a plan, the means (e.g. pills or a weapon), a goodbye, or acting now — ALSO return medical_emergency, because it needs emergency services, not only a support line.',
    '- harm_to_others: intent or urge to hurt another person.',
    '- medical_emergency: 000 red flags — chest pain, trouble breathing, stroke signs (face droop, slurred speech, one-sided weakness/numbness), collapse, seizure, anaphylaxis/severe allergic, severe asthma attack, heatstroke with confusion, diabetic emergency, uncontrolled bleeding. ALSO an overdose/poisoning ACCOMPANIED BY danger signs — reduced consciousness, very drowsy or hard to rouse, unresponsive, collapse, seizure, trouble breathing, self-harm intent, or another person in immediate danger — which is an emergency, not merely overdose.',
    '- overdose_poisoning: taking or ingesting too much of ANY substance — medication, supplement, caffeine, pre-workout, alcohol, or something harmful — including taking a lot / too much, doubling or exceeding the directed dose, mixing several, or an accidental poisoning. (Routes to poisons info on its own; with danger signs it is a medical_emergency.)',
    '- medical_urgent: possible injury/pain/swelling, concussion/head knock, rhabdo signs (dark urine + muscle pain), unwell but not 000.',
    '- injury_override: has an injury/limitation and wants to train/load the affected area anyway.',
    '- pregnancy: the USER is pregnant or postpartum. If it is someone ELSE (partner, friend, family) who is pregnant, this does NOT apply to the user.',
    '- medical_condition: a chronic condition/medication affecting exercise (heart, diabetes, epilepsy, asthma at rest, high blood pressure, etc.).',
    '- disordered_eating: the USER\'s OWN restriction or meal-skipping to lose weight, purging, laxatives, starvation, compensating for eating, or body-image distress. Ordinary appetite (being hungry / "starving" and asking what to eat) is NOT disordered eating, and discussing eating disorders as a research/academic topic or project is NOT disordered eating.',
    '- rapid_weight_loss: requests for rapid/extreme weight loss or crash dieting.',
    '- meal_plan: a request for a personalised FOOD plan or exact calorie/macro targets. A TRAINING split or workout program (for example push/pull/legs or upper/lower) is normal coaching, NOT a meal_plan.',
    '- steroids_ped: anabolic steroids, SARMs, PEDs, cycles, PCT.',
    '- supplement_dosing: personalised supplement/stimulant dosing or stacking.',
    '- prescribed_medication: asking to stop/change prescribed medication.',
    '- unsafe_training: overtraining, bypassing safety limits, training while ill/impaired, taking something to push through.',
    '- under_18: the USER THEMSELVES indicates they are under 18. A reference to SOMEONE ELSE being under 18 (a younger sibling, friend, or client) is NOT this category.',
    '- ai_relationship: treating the AI as a human/therapist/romantic partner or sole support.',
    '- off_topic: not fitness/nutrition (essays, homework, code, general chat).',
    '- none: ordinary fitness/nutrition/motivation talk with no safety concern. This includes figurative gym hyperbole ("that workout killed me", "dead legs", "this is killing me"), a named conditioning/sprint drill (some are colloquially called "suicides"), ACADEMIC or educational discussion of suicide/self-harm as a topic (studying it, an essay or assignment, prevention or awareness work), quoting, and clearly historical or resolved mentions with no CURRENT risk.',
    '',
    'RULES:',
    '- Bias to RECALL on the critical categories (immediate_danger, medical_emergency, harm_to_others, overdose_poisoning, crisis_concern). If you are unsure whether a message is one of these vs none, choose the safety category. Reducing false alarms must NEVER lower recall on these; when genuinely torn, flag.',
    '- SCOPE — a user-eligibility restriction (under_18, pregnancy) or a personal-distress flag applies to the USER, not to people they mention. The following are NONE (do not flag) unless genuine first-person distress/intent is ALSO present:',
    '   • about ANOTHER PERSON: a stated age or pregnancy belonging to someone else (a child, sibling, friend, partner, or client) is NOT under_18/pregnancy for the user. (A third party genuinely at risk of self-harm is still third_party_crisis — that is a real safety event and is different.)',
    '   • PAST / historical: a past-tense mention of the user\'s own younger age or a resolved past state is not a CURRENT disclosure — the restriction is about the user\'s current state.',
    '   • ACADEMIC / research / quoted / figurative: researching, studying, or writing about suicide, self-harm, or eating disorders; quoting a lyric or line; or gym hyperbole — is discussing the topic, not disclosing distress.',
    '- CRITICAL GUARD (this overrides the SCOPE exclusions): genuine first-person distress or intent ALWAYS flags, even when an academic, quoted, or figurative word is also present. A person expressing their OWN hopelessness or self-harm feelings while mentioning study/exams is still crisis_concern, NOT none. When torn between real distress and a topical mention, FLAG.',
    '- PRECEDENCE: an overdose/poisoning WITH any immediate-danger sign, and a third party in IMMEDIATE danger, are emergencies — return medical_emergency (alongside the specific category) so they route to emergency services, not a lesser line.',
    '- Consider misspellings, slang, letter-spacing/obfuscation, euphemism, and other languages.',
    '',
    `Recent turns (oldest first), for context only:\n${context}`,
    '',
    `LATEST message to classify:\n  "${text}"`,
    '',
    'Respond with ONLY this JSON (no prose, no code fence):',
    '{"categories": ["<category>", ...]}',
    'List every applicable category, most-severe first. Use ["none"] only if genuinely benign.',
  ].join('\n')
}

/** Strictly parse the model output into hits. Unknown/garbled but non-empty ⇒ uncertain ⇒ catch_all. */
function parseModelOutput(raw: string): DetectorHit[] {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    // No JSON at all — uncertain, not benign. Escalate protectively rather than allow.
    return [{ category: 'catch_all', source: 'classifier', reason: 'llm_unparseable' }]
  }
  let parsed: unknown
  try { parsed = JSON.parse(raw.slice(start, end + 1)) } catch {
    return [{ category: 'catch_all', source: 'classifier', reason: 'llm_bad_json' }]
  }
  const cats = (parsed as { categories?: unknown })?.categories
  if (!Array.isArray(cats)) return [{ category: 'catch_all', source: 'classifier', reason: 'llm_no_categories' }]
  const valid = cats.filter((c): c is SafetyCategory => typeof c === 'string' && CATEGORY_SET.has(c) && c !== 'none')
  const sawUnknown = cats.some((c) => typeof c !== 'string' || !CATEGORY_SET.has(c))
  if (valid.length === 0) {
    // Model returned only "none" (or only unknown tokens). If it named an unknown token, stay cautious.
    return sawUnknown ? [{ category: 'catch_all', source: 'classifier', reason: 'llm_unknown_only' }] : []
  }
  return valid.map((category) => ({ category, source: 'classifier' as const, reason: `llm_${category}` }))
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new ClassifierUnavailable('timeout')), ms)
    promise.then((v) => { clearTimeout(t); resolve(v) }, (e) => { clearTimeout(t); reject(e) })
  })
}

/**
 * Classify one message. Throws `ClassifierUnavailable` when no model is wired or the call fails —
 * the router converts that to the safe service-unavailable outcome (never "allow"). Known benign
 * gym hyperbole short-circuits to no-hit so an obvious false positive never even reaches the model.
 */
export async function llmClassify(text: string, ctx: CoachContext, recent: string[] = []): Promise<DetectorHit[]> {
  if (isKnownFalsePositive(text)) return []
  if (!transport) throw new ClassifierUnavailable('no_transport')
  const raw = await withTimeout(transport(buildPrompt(text, ctx, recent), { timeoutMs: TIMEOUT_MS }), TIMEOUT_MS)
  return parseModelOutput(raw)
}
