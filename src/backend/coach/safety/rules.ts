/**
 * High-recall deterministic detectors (spec §2: "high-recall rules + a validated classifier").
 *
 * These are tuned for RECALL, accepting some false positives, because a false positive costs a
 * gentle referral while a false negative can cost a life. The router combines these hits with
 * the classifier and applies the HIGHEST tier (spec §2/§13). Detection is intentionally
 * phrase-based (not bare keyword matching) to distinguish "kill myself" from "that workout
 * killed me", and "I" from "they". The coaching model never sees anything but the final tier.
 *
 * Nuance beyond these rules (deep misspelling, indirect multi-sentence context, other
 * languages) is the job of the validated classifier — see classifier.ts. Until that ships,
 * the stub fails safe (classifier.ts), so borderline input still escalates.
 */

import type { CoachContext, DetectorHit, SafetyCategory } from './types'

export interface Norm {
  /** lowercased, punctuation→space, whitespace-collapsed, space-padded. */
  p: string
}

/** A few high-value slang / misspelling normalisations (recall aids, not a spell-checker). */
const SLANG: [RegExp, string][] = [
  [/\bkms\b/g, ' kill myself '],
  [/\bkys\b/g, ' kill yourself '],
  [/\bunalive\b/g, ' suicide '],
  [/\bsuicid(e|al|le|el)?\b/g, ' suicidal '],
  [/\bsu+icide\b/g, ' suicidal '],
  [/\broid(s)?\b/g, ' steroids '],
  [/\bgear\b/g, ' steroids '],
  [/\bpre[- ]?workout\b/g, ' preworkout '],
]

export function normalize(text: string): Norm {
  let s = ` ${(text || '').toLowerCase()} `
  s = s.replace(/[^a-z0-9\s]/g, ' ')
  for (const [re, rep] of SLANG) s = s.replace(re, rep)
  s = s.replace(/\s+/g, ' ')
  return { p: ` ${s.trim()} ` }
}

const has = (n: Norm, ...frags: string[]) => frags.some((f) => n.p.includes(` ${f} `) || n.p.includes(f))
const hasRe = (n: Norm, re: RegExp) => re.test(n.p)
const hit = (category: SafetyCategory, reason: string): DetectorHit => ({ category, source: 'rules', reason })

/* ------------------------------------------------------------------ */
/*  Subject + negation helpers (I vs they, denials)                    */
/* ------------------------------------------------------------------ */

/** The message is about someone OTHER than the user (third-party). */
export function isThirdParty(n: Norm): boolean {
  const others = ['my friend', 'my mate', 'my roommate', 'my room mate', 'my flatmate', 'my brother',
    'my sister', 'my mum', 'my mom', 'my dad', 'my partner', 'my girlfriend', 'my boyfriend',
    'my teammate', 'my colleague', 'someone i know', 'a friend of mine', 'my housemate']
  const reflexiveOther = has(n, 'himself', 'herself', 'themselves', 'themself', 'theirself')
  const firstPersonReflexive = has(n, 'myself', 'my own life')
  if (firstPersonReflexive && !has(n, 'i meant', 'not me')) return false
  return others.some((o) => has(n, o)) || (reflexiveOther && !firstPersonReflexive)
}

/** A bare denial of a crisis term (e.g. "I'm not suicidal") with no other crisis signal. */
function negatedCrisisOnly(n: Norm): boolean {
  const denied = hasRe(n, /\b(not|isn t|aren t|never|no)\s+(feeling\s+)?(suicidal|going to hurt|self harm)/)
  const otherSignal = has(n, 'hopeless', 'no point', 'want to die', 'end my life', 'kill myself',
    'better off without', 'want to disappear', 'harm myself', 'hurt myself')
  return denied && !otherSignal
}

/** Fitness hyperbole that must NOT read as crisis (spec §18 false positives). */
function isWorkoutHyperbole(n: Norm): boolean {
  return has(n, 'killed me', 'killing me', 'kill it', 'killed it', 'dead legs', 'im dead', 'i m dead',
    'dying to', 'killer workout', 'killing it', 'destroyed my', 'wrecked me', 'dead tired')
}

/* ------------------------------------------------------------------ */
/*  Individual guardrail detectors                                     */
/* ------------------------------------------------------------------ */

const CRISIS_IDEATION = ['hopeless', 'no point in anything', 'no point in living', 'don t see the point',
  'dont see the point', 'no point to anything', 'want to disappear', 'better off without me',
  'everyone would be better off', 'worthless', 'can t go on', 'cant go on', 'give up on everything',
  'giving up on everything', 'want to die', 'wish i was dead', 'wish i wasn t here', 'don t want to live',
  'dont want to live', 'don t want to be here', 'no reason to keep going', 'tired of living', 'end it all']

const SELF_HARM = ['kill myself', 'killing myself', 'suicidal', 'take my own life', 'end my life',
  'self harm', 'harm myself', 'hurt myself', 'cut myself', 'cutting myself']

const IMMEDIATE = ['going to kill myself', 'about to kill myself', 'kill myself tonight', 'kill myself now',
  'end my life tonight', 'have a plan to', 'i have a plan', 'right now i m going to', 'take my own life tonight',
  'going to end it', 'about to end it', 'this is goodbye', 'final message']

/** Self-harm phrased about a third party (spec §3 third-party pathway). */
const OTHER_HARM = ['kill himself', 'kill herself', 'kill themselves', 'kill themself', 'end his life',
  'end her life', 'hurt himself', 'hurt herself', 'harm himself', 'harm herself', 'going to kill himself',
  'going to kill herself']

function detectCrisis(n: Norm): DetectorHit[] {
  if (isWorkoutHyperbole(n) && !has(n, ...CRISIS_IDEATION, ...SELF_HARM, ...OTHER_HARM)) return []
  if (negatedCrisisOnly(n)) return []
  const anyCrisis = has(n, ...CRISIS_IDEATION) || has(n, ...SELF_HARM) || has(n, ...OTHER_HARM)
  if (!anyCrisis) return []
  if (isThirdParty(n)) return [hit('third_party_crisis', 'crisis_term_third_party')]
  if (has(n, ...IMMEDIATE)) return [hit('immediate_danger', 'self_harm_intent_now')]
  return [hit('crisis_concern', 'crisis_ideation_or_self_harm')]
}

function detectHarmToOthers(n: Norm): DetectorHit[] {
  const threat = hasRe(n, /\b(going to|gonna|want to|will)\s+(kill|hurt|attack|stab|shoot|beat up)\b/)
  const targetOther = has(n, 'him', 'her', 'them', 'someone', 'my ex', 'that guy', 'people') && !has(n, 'myself')
  if (threat && targetOther && !isThirdParty(n)) return [hit('harm_to_others', 'threat_to_another')]
  return []
}

const EMERGENCY_REDFLAG = ['chest pain', 'chest tightness', 'can t breathe', 'cant breathe',
  'trouble breathing', 'difficulty breathing', 'struggling to breathe', 'collapsed', 'passed out',
  'fainted', 'unconscious', 'unresponsive', 'slurred speech', 'face drooping', 'numb on one side',
  'numbness on one side', 'worst headache', 'severe headache', 'sudden headache', 'having a seizure',
  'seizing', 'blue lips', 'asthma attack', 'anaphylaxis', 'severe allergic']

function detectMedicalEmergency(n: Norm): DetectorHit[] {
  if (has(n, ...EMERGENCY_REDFLAG)) return [hit('medical_emergency', 'emergency_red_flag')]
  // Heat illness: hot context + neuro/GI signs (spec §6).
  const hot = has(n, 'heatstroke', 'heat stroke', '40 degrees', '38 degrees', '39 degrees', '41 degrees',
    'in the heat', 'so hot', 'overheating', 'boiling hot')
  const heatSigns = has(n, 'dizzy', 'confused', 'vomit', 'nauseous', 'faint', 'weak', 'collapse')
  if (hot && heatSigns) return [hit('medical_emergency', 'possible_heatstroke')]
  // Diabetic emergency: confusion / can't respond (spec §7).
  if (has(n, 'diabetic', 'diabetes', 'hypo') && has(n, 'confused', 'can t speak', 'unconscious', 'seizing', 'drowsy', 'passing out'))
    return [hit('medical_emergency', 'diabetic_emergency')]
  return []
}

function detectOverdose(n: Norm): DetectorHit[] {
  const tookTooMuch = hasRe(n, /\b(took|taken|had|swallowed)\b.*\b(too many|too much|a lot of|loads of|overdose)/) ||
    has(n, 'overdosed', 'overdose', 'poisoned')
  const substance = has(n, 'fat burner', 'fat burners', 'caffeine', 'preworkout', 'pre workout', 'pills',
    'tablets', 'supplement', 'supplements', 'medication', 'paracetamol', 'ibuprofen', 'panadol', 'creatine')
  if ((tookTooMuch && substance) || has(n, 'overdosed', 'i overdose'))
    return [hit('overdose_poisoning', 'possible_overdose')]
  return []
}

const INJURY_TERMS = ['broken', 'fracture', 'fractured', 'injured', 'injury', 'sprained', 'sprain',
  'torn', 'tear', 'dislocated', 'swollen', 'swelling', 'bad knee', 'bad back', 'bad shoulder',
  'dodgy knee', 'hurt my', 'busted', 'heals', 'healing', 'still healing', 'recovering from', 'while it heals']
const TRAIN_INTENT = ['still want to', 'still do', 'can i still', 'keep', 'want to squat', 'want to bench',
  'want to run', 'want to lift', 'want to train', 'train through', 'work around', 'work out', 'workout',
  'squat', 'bench', 'run', 'lift', 'program', 'session', 'add', 'variation', 'lighter', 'ignore my injury',
  'ignore the injury', 'ignore my restriction']

function detectInjuryOverride(n: Norm): DetectorHit[] {
  const injury = has(n, ...INJURY_TERMS)
  const wantsTrain = has(n, ...TRAIN_INTENT)
  if (injury && wantsTrain) return [hit('injury_override', 'injury_plus_train_intent')]
  // "ignore my injury restriction and add squats back" — explicit override.
  if (has(n, 'ignore my injury', 'ignore the injury', 'ignore my restriction', 'add squats back', 'add them back'))
    return [hit('injury_override', 'explicit_injury_override')]
  return []
}

function detectMedicalUrgent(n: Norm): DetectorHit[] {
  const out: DetectorHit[] = []
  // Rhabdomyolysis (spec §6): dark urine + muscle pain, or explicit term.
  if (has(n, 'rhabdo') || (has(n, 'dark urine', 'brown pee', 'brown urine', 'cola coloured', 'tea coloured', 'dark pee', 'dark brown') && has(n, 'muscle', 'legs', 'pain', 'agony', 'sore')))
    out.push(hit('medical_urgent', 'possible_rhabdo'))
  // Concussion / head injury (spec §9).
  if (has(n, 'concussion', 'knocked out', 'knock to the head', 'hit my head', 'banged my head', 'head knock', 'bang to the head'))
    out.push(hit('medical_urgent', 'possible_concussion'))
  // Injury / pain / swelling not otherwise an override or emergency (spec §6 urgent-refer).
  if (has(n, 'swollen', 'swelling', 'sharp pain', 'stabbing pain', 'can t put weight', 'cant put weight',
    'pain for a week', 'painful and swollen', 'been painful', 'really painful', 'badly hurt'))
    out.push(hit('medical_urgent', 'urgent_symptom'))
  return out
}

function detectPregnancy(n: Norm): DetectorHit[] {
  const preg = has(n, 'pregnant', 'pregnancy', 'weeks pregnant', 'expecting a baby', 'gave birth',
    'postpartum', 'post partum', 'after giving birth', 'c section', 'caesarean', 'cesarean', 'had my baby',
    'since the birth', 'after the birth', 'since birth', 'postnatal', 'post natal')
  if (!preg) return []
  const warning = has(n, 'bleeding', 'fluid leak', 'contractions', 'chest pain', 'dizzy', 'faint', 'fever',
    'severe pain', 'reduced movement', 'baby not moving')
  if (warning) return [hit('medical_emergency', 'pregnancy_warning_sign'), hit('pregnancy', 'pregnancy_disclosed')]
  return [hit('pregnancy', 'pregnancy_disclosed')]
}

const CONDITIONS = ['heart condition', 'cardiac', 'heart problem', 'had a stroke', 'diabetes', 'diabetic',
  'epilepsy', 'seizure disorder', 'kidney disease', 'high blood pressure', 'hypertension', 'blood pressure',
  'beta blocker', 'beta blockers', 'copd', 'heart murmur', 'pacemaker', 'arrhythmia']

function detectMedicalCondition(n: Norm): DetectorHit[] {
  // Asthma is a condition, but an ATTACK is an emergency (handled above).
  const condition = has(n, ...CONDITIONS) || (has(n, 'asthma') && !has(n, 'asthma attack'))
  const vagueClearance = has(n, 'doctor said exercise is probably', 'doctor said its probably ok',
    'doctor said it s probably ok', 'probably okay to exercise', 'probably fine to exercise')
  if (condition || vagueClearance) return [hit('medical_condition', condition ? 'known_condition' : 'vague_clearance')]
  return []
}

const DE_SIGNALS = ['skipping meals', 'skip meals', 'only eating once', 'once a day to lose', 'not eating',
  'barely eating', 'starving myself', 'starve myself', 'purge', 'purging', 'throw up after eating',
  'make myself sick', 'making myself sick', 'laxative', 'earn my food', 'earn back', 'burn off what i ate',
  'punish myself', 'hate my body', 'feel so fat', 'obsessed with the scale', 'hate the way i look',
  'chew and spit', 'compensate for eating']

function detectDisorderedEating(n: Norm): DetectorHit[] {
  if (has(n, ...DE_SIGNALS)) return [hit('disordered_eating', 'de_signal')]
  return []
}

function detectRapidWeightLoss(n: Norm): DetectorHit[] {
  const rapidNum = hasRe(n, /(lose|drop|shed|cut)\D{0,15}\d+\s?(kg|kgs|kilo|kilos|pound|pounds|lb|lbs)\D{0,20}(day|days|week|weeks|month)/)
  const fastest = has(n, 'fastest way to lose', 'fastest way to drop', 'quickest way to lose', 'lose weight fast',
    'lose weight quickly', 'drop weight fast', 'crash diet', 'extreme cut', 'water fast', 'very low calorie',
    'lose as much weight as possible')
  if (rapidNum || fastest) return [hit('rapid_weight_loss', 'rapid_or_intense_diet')]
  return []
}

function detectMealPlan(n: Norm): DetectorHit[] {
  const plan = has(n, 'meal plan', 'diet plan', 'eating plan', 'what to eat every day', 'tell me exactly what to eat',
    'food schedule', 'day meal plan', 'calorie meal plan', 'give me my macros', 'my macro targets',
    'exact macros', 'meal prep plan') || hasRe(n, /\d{3,4}\s?(cal|calorie|kcal)\b.*(plan|diet|meal)/)
  if (plan) return [hit('meal_plan', 'meal_plan_request')]
  return []
}

function detectSteroidsPED(n: Norm): DetectorHit[] {
  // Prescribed corticosteroids are NOT PEDs (spec §11 boundary) — route elsewhere.
  if (has(n, 'prescribed', 'my doctor prescribed', 'corticosteroid', 'cortico steroid', 'prednisone', 'inhaled steroid'))
    return []
  const ped = has(n, 'steroids', 'steroid cycle', 'anabolic', 'sarm', 'sarms', 'testosterone', 'test e',
    'test cyp', 'trenbolone', 'tren', 'anavar', 'dianabol', 'winstrol', 'clenbuterol', 'peptide', 'peptides',
    'post cycle', 'post cycle therapy', 'pct', 'inject test', 'how much testosterone', 'best cycle', 'safest cycle',
    'pass a drug test', 'beat a drug test', 'where can i buy sarms', 'buy steroids')
  if (ped) return [hit('steroids_ped', 'ped_request')]
  return []
}

function detectPrescribedMedication(n: Norm): DetectorHit[] {
  if (has(n, 'prescribed', 'my doctor prescribed', 'corticosteroid', 'prednisone') &&
      has(n, 'should i stop', 'stop taking', 'come off', 'change my dose', 'quit taking'))
    return [hit('prescribed_medication', 'prescribed_med_change')]
  return []
}

function detectSupplementDosing(n: Norm): DetectorHit[] {
  const dosing = has(n, 'how many scoops', 'how much preworkout', 'how much caffeine', 'how much creatine',
    'how many can i take', 'safe to take', 'how much can i take', 'stack stimulants')
  const interaction = hasRe(n, /(take|use).*(with|alongside).*(antidepressant|medication|ssri|medicine|meds|beta blocker)/)
  if (dosing || interaction) return [hit('supplement_dosing', dosing ? 'supplement_dose' : 'supplement_interaction')]
  return []
}

function detectUnder18(n: Norm): DetectorHit[] {
  // Age with clear self-reference, guarding against reps/kg/weeks/etc.
  const ageStmt = hasRe(n, /\b(i am|i m|im|only|actually|just|turned|turning)\s+(1[0-7]|[1-9])\b(?!\s*(kg|kgs|kilo|kilos|pound|pounds|lb|lbs|rep|reps|set|sets|week|weeks|min|minutes|km|hour|hours|days|day|percent|reps))/)
  const explicit = has(n, 'under 18', 'underage', 'im a minor', 'i m a minor', 'still in high school', 'in year 8',
    'in year 9', 'in year 10', 'in year 11', 'year 8', 'year 9', 'year 10', 'high schooler')
  if (ageStmt || explicit) return [hit('under_18', 'stated_under_18')]
  return []
}

function detectUnsafeTraining(n: Norm): DetectorHit[] {
  const out: DetectorHit[] = []
  if (has(n, 'twice a day every day', 'no rest days', 'no rest day', 'without rest', 'no days off',
    'every single day no rest', 'train every day no rest', 'skip rest days'))
    out.push(hit('unsafe_training', 'overtraining_request'))
  if (has(n, 'heavier than recommended', 'more than the app says', 'bypass the limit', 'ignore the limit',
    'override the safety', 'lift more than you said'))
    out.push(hit('unsafe_training', 'bypass_limit'))
  // Training while unwell / impaired (spec §15).
  const unwell = has(n, 'fever', 'vomiting', 'throwing up', 'i m sick', 'im sick', 'really ill', 'flu',
    'drunk', 'under the influence', 'high on', 'hungover', 'no sleep', 'haven t slept', 'havent slept')
  const wantsSession = has(n, 'workout', 'session', 'train', 'give me a', 'want to train', 'still train')
  if (unwell && wantsSession) out.push(hit('unsafe_training', 'train_while_impaired'))
  if (has(n, 'painkiller', 'pain killer', 'panadol', 'ibuprofen', 'nurofen', 'stimulant') &&
      has(n, 'finish my workout', 'get through', 'push through', 'so i can train', 'to train', 'keep training'))
    out.push(hit('unsafe_training', 'meds_to_train'))
  // "what can I take to train/push through this" — using a substance to complete a workout (spec §15).
  if (has(n, 'what can i take', 'anything i can take', 'something to take', 'what should i take') &&
      has(n, 'train through', 'push through', 'get through', 'finish my workout', 'to train', 'through this', 'keep training'))
    out.push(hit('unsafe_training', 'substance_to_train'))
  return out
}

function detectAiRelationship(n: Norm): DetectorHit[] {
  if (has(n, 'are you a real person', 'are you human', 'are you real', 'are you my therapist',
    'are you a therapist', 'you re the only one who understands', 'youre the only one', 'i love you',
    'do you love me', 'will you be my', 'only one who gets me', 'you re all i have', 'marry me'))
    return [hit('ai_relationship', 'relationship_boundary')]
  return []
}

function detectOffTopic(n: Norm): DetectorHit[] {
  if (has(n, 'write my essay', 'my uni essay', 'my assignment', 'do my homework', 'my homework',
    'write my code', 'debug my', 'translate this', 'the weather', 'who won the', 'your opinion on',
    'tell me a joke', 'politics', 'stock tips', 'dating advice'))
    return [hit('off_topic', 'off_topic_request')]
  return []
}

function detectCatchAll(n: Norm): DetectorHit[] {
  // Uncovered health/symptom + a request to train around/ignore it (spec §13).
  const uncovered = has(n, 'medical condition', 'a condition', 'my condition', 'condition', 'new symptom',
    'my doctor found', 'something unusual', 'a symptom when', 'a health issue', 'a health problem')
  const wantsAround = has(n, 'design around', 'build the session', 'build a workout', 'give me a workout',
    'ignore it', 'anyway', 'work around it')
  if (uncovered && wantsAround) return [hit('catch_all', 'uncovered_health_concern')]
  return []
}

/* ------------------------------------------------------------------ */
/*  Public: run all detectors                                          */
/* ------------------------------------------------------------------ */

export function runRules(text: string, _ctx: CoachContext): DetectorHit[] {
  const n = normalize(text)
  const detectors = [
    detectCrisis, detectHarmToOthers, detectMedicalEmergency, detectOverdose, detectInjuryOverride,
    detectMedicalUrgent, detectPregnancy, detectMedicalCondition, detectDisorderedEating,
    detectRapidWeightLoss, detectMealPlan, detectSteroidsPED, detectPrescribedMedication,
    detectSupplementDosing, detectUnder18, detectUnsafeTraining, detectAiRelationship,
    detectOffTopic, detectCatchAll,
  ]
  const hits: DetectorHit[] = []
  for (const d of detectors) hits.push(...d(n))
  return hits
}

/** A known benign false-positive (workout hyperbole, or a bare crisis denial). */
export function isKnownFalsePositive(text: string): boolean {
  const n = normalize(text)
  return isWorkoutHyperbole(n) || negatedCrisisOnly(n)
}

/** Exposed for the classifier stub: is there ANY safety-adjacent token at all? */
export function hasAnySafetyAdjacentSignal(text: string): boolean {
  const n = normalize(text)
  return has(n,
    // mood / crisis-adjacent
    'sad', 'depress', 'anxious', 'panic', 'cry', 'alone', 'lonely', 'empty', 'numb', 'hopeless', 'die', 'death',
    'hate myself', 'worthless', 'overwhelmed', 'stressed', 'burnt out', 'exhausted', 'cant cope', 'can t cope',
    // body / eating
    'weight', 'fat', 'skinny', 'calorie', 'diet', 'binge', 'restrict', 'body image', 'scale', 'purge',
    // medical
    'pain', 'hurt', 'injur', 'swollen', 'dizzy', 'faint', 'chest', 'breath', 'blood', 'heart', 'seizure',
    'pregnan', 'concussion', 'head', 'medication', 'condition', 'symptom', 'sick', 'fever', 'vomit',
    // substances
    'steroid', 'sarm', 'testosterone', 'supplement', 'caffeine', 'overdose', 'drug', 'alcohol', 'drunk',
  )
}
