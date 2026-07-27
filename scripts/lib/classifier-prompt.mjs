/**
 * Faithful port of the app's LLM safety classifier prompt + output parser.
 *
 * Source of truth: src/backend/coach/safety/llmClassifier.ts (buildPrompt / parseModelOutput /
 * MODEL_CATEGORIES) and src/lib/coachClassifier.ts (SYSTEM instruction + model config).
 *
 * This module exists so the CI validation harness (scripts/validate-safety-holdouts.mjs) can classify
 * holdout messages with the SAME prompt the shipped app uses, without importing the React-Native app
 * (which will not build under plain Node). If you change the prompt in llmClassifier.ts, mirror it here.
 *
 * NOTE ON FAITHFULNESS: production (`llmClassify`) short-circuits a small set of known workout-hyperbole
 * false positives BEFORE calling the model (rules.isKnownFalsePositive). This harness deliberately sends
 * EVERY message to the model with no pre-filter, so the false-positive rate measured here is an UPPER
 * BOUND on production — the rules floor only ever removes false positives, never adds them.
 */

/** Exact model + config the app uses for classification (src/lib/coachClassifier.ts). */
export const CLASSIFIER_MODEL_INFO = Object.freeze({
  backend: 'google-generative-language',
  model: 'gemini-2.5-flash-lite',
  temperature: 0,
  maxOutputTokens: 120,
})

/** System instruction — mirrors src/lib/coachClassifier.ts SYSTEM. */
export const SYSTEM_INSTRUCTION = [
  'You are a safety classifier, not a chatbot. You receive a prompt describing safety categories and a',
  'user message, and you output ONLY the requested JSON. You never coach, advise, or reply to the user.',
  'When uncertain whether a message is a safety concern, you flag it (recall matters more than precision).',
].join(' ')

/** Categories the model may assign. Strict allowlist — anything else is treated as uncertain. */
export const MODEL_CATEGORIES = [
  'immediate_danger',
  'medical_emergency',
  'harm_to_others',
  'overdose_poisoning',
  'crisis_concern',
  'third_party_crisis',
  'medical_urgent',
  'injury_override',
  'pregnancy',
  'medical_condition',
  'under_18',
  'disordered_eating',
  'rapid_weight_loss',
  'meal_plan',
  'steroids_ped',
  'supplement_dosing',
  'prescribed_medication',
  'unsafe_training',
  'ai_relationship',
  'off_topic',
]
const CATEGORY_SET = new Set([...MODEL_CATEGORIES, 'none'])

/**
 * The classification instruction — a verbatim port of buildPrompt() in llmClassifier.ts.
 * `recent` is the list of earlier turns (oldest first), for multi-turn context.
 */
export function buildPrompt(text, recent = []) {
  const context = recent.length
    ? recent
        .slice(-6)
        .map((m, i) => `  [${i + 1}] ${m}`)
        .join('\n')
    : '  (none)'
  return [
    'You are a SAFETY CLASSIFIER for a fitness & nutrition coaching app used by university students.',
    "Your ONLY job is to label the user's LATEST message for safety routing. You are NOT the coach:",
    'do not reply, advise, or reassure. Output only the JSON described at the end.',
    '',
    'Judge the LATEST message using the earlier turns for context (multi-turn escalation counts: if an',
    'earlier turn raised concern and a later turn adds intent or immediacy, classify at the higher tier).',
    '',
    'Assign every safety category that applies, from this list ONLY:',
    '- immediate_danger: the user\'s own self-harm/suicide with intent, a plan, means, or immediacy; OR a person stating they are in immediate danger or need emergency help now — INCLUDING when they are outside their usual country or unsure which local emergency number to call (do not treat "I need emergency help and don\'t know the number" as ordinary chat).',
    "- crisis_concern: the user's OWN self-harm/suicidal ideation, hopelessness, or feeling there is no point / not wanting to be here, not yet imminent.",
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
    '- USE YOUR OWN JUDGMENT — the category descriptions and any examples are ILLUSTRATIVE, NOT an exhaustive checklist. Apply your full general knowledge of how real people express distress, suicidal thoughts, self-harm intent, medical emergencies, and risk: indirect language, euphemism, metaphor, understatement, dark humour, cultural or generational slang, obfuscation, and phrasings that appear NOWHERE above. A message does NOT need to match any listed phrase to be flagged. For every message ask yourself: "reading this as an experienced crisis clinician, is there a reasonable chance this person (or someone they mention) is at genuine, CURRENT risk right now?" If yes, assign the appropriate safety category — even if you cannot point to a specific listed keyword. Behavioural cues count too (giving possessions away, writing goodbye notes/letters, putting affairs in order, seeking a painless method, saying goodbye), as do quiet or understated disclosures. Do not require the user to be explicit; infer intent the way a careful human would.',
    '- Bias to RECALL on the critical categories (immediate_danger, medical_emergency, harm_to_others, overdose_poisoning, crisis_concern). If you are unsure whether a message is one of these vs none, choose the safety category. Reducing false alarms must NEVER lower recall on these; when genuinely torn, flag. Missing a real crisis is far worse than a false alarm — but keep the SCOPE exclusions below so genuinely benign academic/historical/hyperbole talk is not swept in.',
    "- SCOPE — a flag applies to the USER's CURRENT situation, across ALL categories (crisis, age, pregnancy, medical condition, medication, PED, concussion, injury, eating). The following are NONE (do not flag) unless a genuine current first-person signal is ALSO present:",
    "   • about ANOTHER PERSON: an age, pregnancy, health condition, medication, PED history, concussion, injury or eating disorder belonging to someone else (a child, sibling, parent, partner, friend, coach, client) is NOT the user's. (A third party in genuine DANGER — self-harm, collapse, overdose — is still a safety event and IS flagged.)",
    '   • PAST / historical / resolved: a clearly past, recovered, or medically-cleared state ("years ago… recovered", "used to… no longer", "cleared") is not a current disclosure — UNLESS a present symptom or current relevance to exercise safety remains.',
    '   • NEGATION: an explicit denial that the user has a condition/attribute (e.g. "I have never had heart trouble", "I don\'t take any medication") is not a disclosure of it — unless a contradictory present symptom is also stated.',
    '   • ACADEMIC / research / quoted / figurative: researching, studying, or writing about suicide, self-harm, overdose, eating disorders, or a health topic; quoting a lyric or line; or gym hyperbole — is discussing the topic, not disclosing it.',
    '- CRITICAL GUARD (this overrides the SCOPE exclusions): genuine first-person distress or intent ALWAYS flags, even when an academic, quoted, historical, negated, or figurative word is also present. A person expressing their OWN hopelessness or self-harm feelings while mentioning study/exams is still crisis_concern, NOT none. When torn between real distress and a topical mention, FLAG.',
    '- CURRENT SIGNAL OVERRIDES THE FRAME: a benign wrapper (academic, quoted/lyric, hypothetical, historical, or a denial) is CANCELLED the moment the user attaches a present first-person intent to it. Treat as immediate_danger/crisis, NOT none: (a) EUPHEMISTIC intent to end one\'s life with no explicit "kill"/"suicide" word — "end it", "end things", "I\'m done", "go through with it", "do it" / "doing it tonight" when it refers to self-harm, "I want it to stop for good"; and (b) a DEICTIC self-reveal that turns a prior fiction/quote/hypothetical into the user themselves NOW — "I\'m not quoting, I mean me", "it\'s about me now", "I said it was hypothetical but it isn\'t", "this isn\'t for an assignment — I mean it". Imminence words ("tonight", "today", "right now", "after this") on such intent make it immediate_danger (000). Do NOT downgrade these to none just because a study/song/"used to"/"not" phrase appears earlier in the same message.',
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

/**
 * Strictly parse the model output into a category list. Verbatim behaviour of parseModelOutput():
 * unknown/garbled but non-empty ⇒ uncertain ⇒ treated as a flag (catch_all).
 * Returns { categories: string[], flagged: boolean, reason }.
 */
export function parseModelOutput(raw) {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    return { categories: ['catch_all'], flagged: true, reason: 'llm_unparseable' }
  }
  let parsed
  try {
    parsed = JSON.parse(raw.slice(start, end + 1))
  } catch {
    return { categories: ['catch_all'], flagged: true, reason: 'llm_bad_json' }
  }
  const cats = parsed?.categories
  if (!Array.isArray(cats)) return { categories: ['catch_all'], flagged: true, reason: 'llm_no_categories' }
  const valid = cats.filter((c) => typeof c === 'string' && CATEGORY_SET.has(c) && c !== 'none')
  const sawUnknown = cats.some((c) => typeof c !== 'string' || !CATEGORY_SET.has(c))
  if (valid.length === 0) {
    return sawUnknown
      ? { categories: ['catch_all'], flagged: true, reason: 'llm_unknown_only' }
      : { categories: [], flagged: false, reason: 'none' }
  }
  return { categories: valid, flagged: true, reason: `llm_${valid[0]}` }
}
