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

import type { CoachContext, DetectorHit, SafetyCategory, Suppression } from './types'

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

/**
 * "want to die" as a whole phrase — NOT inside "want to diet"/"dieting" (Jack round-2 §4 word
 * boundary). `has` matches raw substrings, which is REQUIRED for stems ("hopeless"→"hopelessness",
 * "injur"→"injured"), so the one crisis term with a benign-longer-word collision ("die" in "diet")
 * is checked here with an explicit boundary and kept OUT of the substring CRISIS_IDEATION list. All
 * other crisis matching keeps full substring recall — this narrows one false positive, nothing else.
 */
const wantsToDie = (n: Norm): boolean => hasRe(n, /\bwants? to die\b/)

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
  const otherSignal = has(n, 'hopeless', 'no point', 'end my life', 'kill myself',
    'better off without', 'want to disappear', 'harm myself', 'hurt myself') || wantsToDie(n)
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
  'giving up on everything', 'wish i was dead', 'wish i wasn t here', 'don t want to live',
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

/**
 * Euphemistic / deictic first-person present intent to end one's life, carrying NO explicit
 * "kill"/"suicide"/means token — the gap Jack R5 §1 exposed: the paramount guard PRESERVED such a
 * signal, but nothing GENERATED a hit, so the rules floor (and a missing classifier) let it through.
 * Bounded to first-person volition + an end-of-life object ("want/going to end it/things/my life"),
 * OR a deictic self-reveal ("i mean me", "it's about me", "not quoting") sitting beside an ending /
 * method idiom — so ordinary "let's end it here", "ending things with my ex", or "going to do it
 * tonight" (the workout) do NOT match without that self-harm framing. `immediate` is set only when the
 * intent already fired AND an explicit imminence marker is present, so gating "today"/"tonight" here
 * is safe (it escalates an existing self-harm hit, never benign wording). Generalises to phrasing,
 * not to any specific reported case.
 */
function selfHarmIntent(n: Norm): { hit: boolean; immediate: boolean } {
  // A RELATIONAL or occupational object means "end/finish things" is a break-up or a work/day
  // wrap-up, NOT self-harm ("ending things with my ex", "finishing things at work / for the day").
  const relationalEnd = hasRe(n, /\b(end|ending|finish|finishing)\s+(it|things|everything)\s+(with|at work|at the office|at uni|for the day|here)\b/)
  const lifeIntent = !relationalEnd && (
    hasRe(n, /\b(want|wanna|need|going|gonna|ready|about|decided|have|planning|trying)\s+to\s+(end|finish)\s+(it|it all|things|my life|everything)\b/) ||
    hasRe(n, /\b(im|i m|i am)\s+(ending|finishing|going to end|about to end)\s+(it|it all|things|my life|everything)\b/))

  // Euphemisms for ceasing to exist / to live, in the FIRST PERSON. These carry no explicit
  // "kill"/"suicide"/means token, so nothing else generates a hit (Jack R6 §B1 misses: "check out for
  // good", "wont be around after tonight", "dont want to wake up"). Bounded by three benign guards so
  // ordinary talk does NOT match: future ABSENCE ("wont be around next week, travelling"), an early
  // ALARM ("dont want to wake up early for the gym"), and DEPARTURE from a place/activity ("gone for
  // good from this gym, moving cities"). Generalises to the euphemism class, not to any one phrasing.
  const benignAbsence = hasRe(n, /\b(be around|be here|be back|around|here|away|be in|be on|be at)\b[a-z0-9 ]{0,18}\b(next week|next month|for a while|for a bit|this weekend|next weekend|on weekends|on the weekend|over the weekend|travelling|traveling|on holiday|on vacation|for work|for a few days|a few days|back on|tomorrow morning|later today|for the trip|much this)\b/)
  const benignWake = hasRe(n, /\bwake up\b[a-z0-9 ]{0,12}\b(early|earlier|at \d|for the gym|for training|for work|in time|on time|refreshed|before)\b/)
  const benignDeparture = hasRe(n, /\b(gone|leaving|left|check(ing)? out|checked out|done|quit|quitting|moving)\b[a-z0-9 ]{0,25}\b(from (here|this|the)|the gym|this gym|this club|this app|this place|this program|another gym|new gym|for the season|for the year|to (a )?new|cities|overseas|abroad|interstate)\b/)
  const notExist =
    (!benignWake && has(n, 'dont want to wake up', 'do not want to wake up', 'never want to wake up',
      'never wake up', 'not going to wake up', 'wont wake up', 'just not wake up')) ||
    has(n, 'wont see tomorrow', 'not see tomorrow', 'wont make it to tomorrow', 'not make it to tomorrow',
      'not be here anymore', 'wont be here anymore', 'not be around anymore', 'wont be around anymore') ||
    (!benignDeparture && has(n, 'check out for good', 'checking out for good', 'cash it in for good',
      'be gone for good', 'gone for good', 'slip away for good')) ||
    (!benignAbsence &&
      has(n, 'wont be around', 'will not be around', 'not be around', 'wont be here', 'will not be here', 'not be here') &&
      (has(n, 'for good', 'forever', 'permanently', 'for the last time', 'after tonight', 'after today', 'anymore') ||
        hasRe(n, /\b(ive|i ve|i have)\s+(decided|chosen|made up my mind|made my decision)\b/)))

  // Deictic self-reveal ("i mean ME", "it's about me") that turns a prior fiction/quote into the user
  // themselves, beside an ending/method idiom OR a decision-to-act-now. "i mean it" is deliberately
  // EXCLUDED — too benign-collision-prone with emphatic gym talk ("i mean it, doing it tonight").
  const strongReveal = has(n, 'i mean me', 'i mean myself', 'its about me', 'it s about me', 'about me now',
    'not quoting', 'im the one', 'i m the one', 'this is about me', 'talking about myself')
  const endingOrMethod = has(n, 'end it', 'ending it', 'end things', 'ending things', 'go through with it',
    'going through with it', 'going thru with it', 'the pills', 'took the pills', 'taken the pills',
    'swallowed them all', 'step off', 'off the bridge') || wantsToDie(n)
  const decisionImminent =
    hasRe(n, /\b(ive|i ve|i have)\s+(chosen|decided|picked (the time|tonight|the day)|set a date|made up my mind|made my decision)\b/) &&
    hasRe(n, /\b(tonight|today|this (evening|minute|moment)|after this|after tonight|right now|now)\b/)
  const revealIntent = strongReveal && (endingOrMethod || decisionImminent)

  const hit = lifeIntent || revealIntent || notExist
  // Escalate to 000 only with a self-reveal, a decision-to-act-now, or an explicit finality/method
  // marker — so a VAGUE euphemism floors at Lifeline, not an over-aggressive 000.
  const finality = has(n, 'it all', 'my life', 'everything', 'for good', 'once and for all', 'for the last time',
    'after tonight', 'after today', 'the pills', 'took the pills', 'taken the pills', 'step off', 'off the bridge') || wantsToDie(n)
  const imminence = hasRe(n, /\b(tonight|today|right now|this (evening|minute|moment)|after this|after tonight|for good|once and for all|doing it now|do it now)\b/)
  const immediate = hit && imminence && (revealIntent || decisionImminent || finality)
  return { hit, immediate }
}

/** Whole-word first-person distress/intent — used to guard the topical suppressor so it can NEVER
 *  hide a genuine disclosure that merely mentions an academic setting (Jack round-2 §3 critical guard). */
function hasFirstPersonDistress(n: Norm): boolean {
  return has(n, ...CRISIS_IDEATION) || wantsToDie(n) ||
    has(n, 'kill myself', 'killing myself', 'take my own life', 'end my life', 'harm myself',
      'hurt myself', 'cut myself', 'cutting myself', 'harming myself', 'self harming', 'i self harm',
      'im suicidal', 'i m suicidal', 'feel suicidal', 'feeling suicidal', 'been suicidal') ||
    has(n, ...OTHER_HARM) || selfHarmIntent(n).hit
}

/**
 * A crisis/self-harm word appearing as the OBJECT OF STUDY/RESEARCH/WRITING, a topic label, or a
 * named exercise drill — not a personal disclosure. Requires tight ADJACENCY between an academic
 * verb/noun and the crisis term (or a topic-label suffix), so a genuine disclosure that merely
 * mentions study ("I feel suicidal and can't focus on my thesis") is NOT caught. Suppress only when
 * there is also no first-person distress. Generalises to any wording, not specific reported cases.
 * (The normaliser maps "suicide" → "suicidal".)
 */
function isTopicalCrisisReference(n: Norm): boolean {
  const drillName = has(n, 'suicidal sprint', 'suicidal sprints', 'suicidal drill', 'suicidal drills',
    'suicidal run', 'suicidal runs', 'suicidal shuttle', 'suicidal shuttles')
  // academic verb/noun immediately (within ~40 chars) followed by the crisis term
  const studyOfTopic = hasRe(n,
    /\b(research|researching|study|studying|studies|thesis|dissertation|essay|assignment|project|paper|degree|coursework|module|lecture|presentation|report|writing|analysing|analyzing|literature review)\b[a-z0-9 ]{0,40}\b(suicidal|self harm|self harming|eating disorder|eating disorders|anorexia|bulimia)\b/)
  // crisis term immediately followed by a topic-label suffix
  const topicLabel = hasRe(n,
    /\b(suicidal|self harm|eating disorder|eating disorders)\b[a-z0-9 ]{0,25}\b(prevention|awareness|risk factor|risk factors|statistics|rates|campaign|in athletes|in sport|in sports|programme|program|module)\b/)
  if (!drillName && !studyOfTopic && !topicLabel) return false
  return !hasFirstPersonDistress(n)
}

function detectCrisis(n: Norm): DetectorHit[] {
  if (isWorkoutHyperbole(n) && !has(n, ...CRISIS_IDEATION, ...SELF_HARM, ...OTHER_HARM) && !wantsToDie(n)) return []
  if (negatedCrisisOnly(n)) return []
  if (isTopicalCrisisReference(n)) return [] // named drill or academic topic, no personal distress
  const shi = selfHarmIntent(n)
  const anyCrisis = has(n, ...CRISIS_IDEATION) || wantsToDie(n) || has(n, ...SELF_HARM) || has(n, ...OTHER_HARM) || shi.hit
  if (!anyCrisis) return []
  if (isThirdParty(n)) return [hit('third_party_crisis', 'crisis_term_third_party')]
  if (has(n, ...IMMEDIATE) || shi.immediate) return [hit('immediate_danger', 'self_harm_intent_now')]
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
  // Too-much / mixing / large-quantity ingestion wording (generalised — Jack R4-2D10: "mixed several
  // stimulants", "took many", "a handful", "a whole box", "double the dose" all read as overdose).
  const tookTooMuch =
    hasRe(n, /\b(took|taken|had|swallowed|necked|downed)\b[a-z0-9 ]{0,25}\b(too many|too much|a lot of|lots of|loads of|a load of|overdose|a handful|handful of|a whole|a box|a bunch|a heap|large amount|large handful|way more|double|many of|all my|all of my|all of them|the whole lot|the lot)\b/) ||
    hasRe(n, /\b(mixed|mixing|combined|stacked|took|taken)\b[a-z0-9 ]{0,25}\b(several|multiple|a few|a load|loads|a bunch|different|too many|lots)\b/) ||
    hasRe(n, /\b(took|swallowed|had)\b[a-z0-9 ]{0,20}\bmany\b/) ||
    has(n, 'overdosed', 'overdose', 'poisoned', 'double my', 'double the dose', 'twice the dose', 'exceeded the dose')
  const substance = has(n, 'fat burner', 'fat burners', 'caffeine', 'preworkout', 'pre workout', 'pills',
    'tablets', 'supplement', 'supplements', 'stimulant', 'stimulants', 'medication', 'medicine', 'meds',
    'paracetamol', 'ibuprofen', 'panadol', 'creatine', 'capsules', 'tablet', 'pill')
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
  // First-person vs third-party (Jack round-2 §1): the pregnancy RESTRICTION applies to the USER. If
  // it is clearly SOMEONE ELSE who is pregnant (a partner, family member, or friend) and the user is
  // not, don't apply the user restriction. A warning sign is still surfaced as an emergency (whoever
  // it concerns). Guarded by an explicit first-person cue so a genuine disclosure is never dropped.
  const thirdPartyPreg = hasRe(n,
    /\b(my (partner|wife|husband|girlfriend|boyfriend|missus|friend|mate|sister|mum|mom|mother|daughter|colleague|room ?mate|housemate|flatmate|teammate)|a friend|someone)\b[a-z0-9 ]{0,20}\b(pregnant|pregnancy|expecting|gave birth|had a baby|postpartum)/)
  const firstPersonPreg = has(n, 'im pregnant', 'i m pregnant', 'i am pregnant', 'my pregnancy', 'im expecting',
    'i gave birth', 'i had my baby', 'my baby', 'weeks pregnant', 'since i gave birth', 'my c section',
    'my caesarean', 'after i gave birth', 'im postpartum', 'im postnatal')
  if (thirdPartyPreg && !firstPersonPreg) {
    return warning ? [hit('medical_emergency', 'third_party_pregnancy_warning')] : []
  }
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
/*  Cross-category SUPPRESSION scoping (Jack round-3 approved spec)     */
/*                                                                      */
/*  Reduces contextual false positives WITHOUT lowering critical        */
/*  recall. A suppression fires only when the trigger is clearly        */
/*  third-party / historical / negated / topical AND there is no        */
/*  CURRENT first-person disclosure of that category. Uncertainty is    */
/*  never benign — when unclear the flag is RETAINED. Every suppression */
/*  is logged so each no-flag decision is auditable.                    */
/* ------------------------------------------------------------------ */

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** A present first-person symptom term (used by the current-disclosure guards). */
const PRESENT_SYMPTOM = ['chest pain', 'cant breathe', 'can t breathe', 'trouble breathing', 'bleeding',
  'vomiting', 'throwing up', 'dizzy', 'faint', 'collapsed', 'passed out', 'drowsy', 'slurred', 'swelling',
  'swollen', 'numb', 'seizure', 'shaky', 'confused', 'passing out', 'sharp pain', 'stabbing pain']

/** Is this specific term negated (a denial within a short span before it)? Allows a plural suffix so
 *  "no heart problems" negates the singular term "heart problem". */
function termNegated(n: Norm, t: string): boolean {
  return hasRe(n, new RegExp(`\\b(no|not|never|dont|don t|didnt|did not|havent|haven t|isnt|isn t|am not|im not|i m not|do not have|dont have|without any|free of)\\b[a-z0-9 ]{0,12}\\b${esc(t)}(s|es)?\\b`))
}
/** A denial immediately governing one of `terms` (e.g. a denied condition or symptom). */
function negatedTerm(n: Norm, terms: string[]): boolean {
  return terms.some((t) => termNegated(n, t))
}
/** True if ANY of `terms` is present AND NOT itself negated — a real, un-denied symptom. Used so a
 *  denied term can never suppress a DIFFERENT present symptom stated in the same message. */
function unnegatedSymptom(n: Norm, terms: string[]): boolean {
  return terms.some((t) => has(n, t) && !termNegated(n, t))
}

const RELATION = '(son|daughter|kid|child|children|boy|girl|brother|sister|sibling|mum|mom|mother|dad|father|parent|grandparent|grandma|grandpa|grandson|granddaughter|grandchild|nan|pop|partner|wife|husband|girlfriend|boyfriend|missus|fiance|fiancee|friend|mate|buddy|roommate|room mate|housemate|flatmate|teammate|team mate|colleague|coworker|co worker|coach|trainer|client|cousin|nephew|niece|aunt|uncle|neighbour|neighbor)'

/** The attribute (`terms`) clearly belongs to ANOTHER person and the user is not self-attributing it. */
function subjectThirdParty(n: Norm, terms: string[]): boolean {
  const grp = `(${terms.map(esc).join('|')})`
  // Allow up to two adjectives between "my" and the relation ("my teenage niece", "my older brother").
  // Match the attribute AFTER the relation ("my niece is 15"), or as an adjective BEFORE it
  // ("my teenage niece"), or attributed to another person via a pronoun.
  const linked = hasRe(n, new RegExp(`\\bmy (?:[a-z]+ ){0,2}${RELATION}\\b[a-z0-9 ]{0,30}\\b${grp}\\b`)) ||
    hasRe(n, new RegExp(`\\bmy (?:[a-z]+ ){0,2}${grp}\\b[a-z0-9 ]{0,2}\\b${RELATION}\\b`)) ||
    hasRe(n, new RegExp(`\\b(he|she|they|his|her|their|hers|theirs)\\b[a-z0-9 ]{0,20}\\b${grp}\\b`))
  if (!linked) return false
  const selfAttr = hasRe(n, new RegExp(`\\b(i|im|i m|i am|i ve|ive|i have|i had|i take|i took|i use|my own)\\b[a-z0-9 ]{0,20}\\b${grp}\\b`))
  return !selfAttr
}

/** Clearly resolved, past-tense reference with no present-tense signal. */
function historicalResolved(n: Norm): boolean {
  const past = has(n, 'years ago', 'a year ago', 'last year', 'a decade ago', 'decade ago', 'used to', 'back then',
    'in the past', 'previously', 'when i was', 'as a teenager', 'as a kid', 'growing up', 'a while ago', 'long ago',
    'five years ago', 'two years ago', 'ago and', 'at school', 'in school', 'back in school', 'in high school',
    'in my teens', 'in my twenties', 'in my thirties', 'when younger', 'when i was younger', 'as a student', 'years back')
  const resolved = has(n, 'recovered', 'fully recovered', 'have recovered', 'am better', 'im better', 'no longer',
    'dont anymore', 'don t anymore', 'not anymore', 'medically cleared', 'was cleared', 'been cleared', 'am safe now',
    'im safe now', 'safe now', 'im fine now', 'am fine now', 'do not use them now', 'dont use them now', 'no longer take',
    'but do not use', 'and have recovered', 'and was medically cleared', 'resolved', 'all good now', 'all clear',
    'no problems since', 'no issues since', 'no issue since', 'no trouble since', 'have stopped', 'stopped',
    'quit', 'off it now', 'off them now', 'cleared up', 'went away', 'sorted now', 'fine since', 'fine ever since')
  const presentSignal = has(n, 'still', 'currently', 'right now', 'these days', 'nowadays', 'again now', 'now i') ||
    has(n, ...PRESENT_SYMPTOM) || hasFirstPersonDistress(n) || wantsToDie(n)
  return past && resolved && !presentSignal
}

/** Academic / research / quoted / news / hypothetical framing (general, cross-category). */
function topicalFrame(n: Norm): boolean {
  return has(n, 'research', 'researching', 'studying', 'studies', 'thesis', 'dissertation', 'essay', 'assignment',
    'project', 'coursework', 'lecture', 'presentation', 'literature review', 'my degree', 'my class', 'my course',
    'my unit', 'for class', 'for uni', 'for university', 'for school', 'case study', 'case studies',
    'poster', 'reading about', 'statistics for', 'for an essay', 'news story', 'article', 'documentary', 'a quote',
    'a lyric', 'quoting', 'hypothetical', 'in a movie', 'in a book', 'for a project', 'writing a report on', 'covers')
}

/** A present FIRST-PERSON disclosure of `category` — if present, that category is NEVER suppressed. */
function firstPersonPresent(n: Norm, category: SafetyCategory): boolean {
  switch (category) {
    case 'crisis_concern': case 'immediate_danger': case 'third_party_crisis':
      return hasFirstPersonDistress(n) || wantsToDie(n)
    case 'medical_emergency':
      return unnegatedSymptom(n, [...EMERGENCY_REDFLAG, ...PRESENT_SYMPTOM])
    case 'overdose_poisoning':
      return hasRe(n, /\bi(ve| ve| have|m| m)?\s*(just\s*)?(took|taken|swallowed|had|necked|downed|swallow|take)\b/) &&
        has(n, 'too much', 'too many', 'a lot', 'loads', 'overdose', 'handful', 'several', 'large', 'box of', 'bunch', 'double')
    case 'pregnancy':
      return has(n, 'im pregnant', 'i m pregnant', 'i am pregnant', 'my pregnancy', 'im expecting', 'weeks pregnant',
        'i gave birth', 'i had my baby', 'my baby', 'since i gave birth', 'my c section', 'after i gave birth', 'im postpartum')
    case 'steroids_ped':
      return hasRe(n, /\bi(m| m| am|ve| ve| have)?\s*(currently\s*)?(take|taking|took|use|using|on|inject|injecting|started)\b[a-z0-9 ]{0,20}\b(steroids|sarm|sarms|testosterone|tren|anavar|dianabol|winstrol|clenbuterol|test e|cycle)\b/)
    case 'disordered_eating':
      return has(n, ...DE_SIGNALS)
    case 'medical_condition': case 'medical_urgent': case 'prescribed_medication': case 'injury_override':
      return unnegatedSymptom(n, PRESENT_SYMPTOM)
    default:
      return false
  }
}

/**
 * ANY current first-person safety signal — distress, INTENT, action, or a de-obfuscation reveal.
 * This is the paramount guard (Jack R4): NO suppressor may fire while such a signal is present, so an
 * academic/historical/topical frame can never hide a live suicide plan or method (fixes R4-2A05). It
 * covers distress (`hasFirstPersonDistress`), intent-to-act (a plan / goodbye / a method), immediacy,
 * and a "this is actually about me / not fictional" reveal used in adversarial framing.
 */
export function hasCurrentSafetySignal(n: Norm): boolean {
  if (hasFirstPersonDistress(n) || wantsToDie(n)) return true
  if (has(n, ...IMMEDIATE)) return true // "i have a plan", "going to kill myself", "this is goodbye", ...
  // intent-to-act idioms (the crisis word is often not repeated after a suppressor frame)
  if (hasRe(n, /\b(going to do it|gonna do it|doing it (tonight|now|today)|do it (tonight|now)|end it (tonight|all|now)|going through with it|ready to end (it|things|my life)|wont be here (much longer|tomorrow|anymore)|not be here (tomorrow|much longer)|planned it all|everything is ready|its all planned|got a plan to|made a plan to|have a plan to)\b/)) return true
  // adversarial de-obfuscation: a "fictional/hypothetical" framing revealed to be real/the user
  if (has(n, 'this is real', 'it is real', 'its real', 'really happening', 'happening to me', 'not fictional',
    'not hypothetical', 'not made up', 'not a story', 'not a joke', 'this is actually real', 'im the one')) return true
  // a lethal means/action co-present with immediacy (pills/weapon/rope/jump/traffic + now/tonight/about to)
  if (has(n, 'took the pills', 'taking the pills', 'took everything', 'took the tablets', 'pills in my hand',
    'the pills in my', 'a weapon', 'the weapon', 'a knife', 'a rope', 'the rope', 'jump', 'into traffic',
    'off the bridge', 'on a bridge', 'on the roof') &&
    hasRe(n, /\b(right now|tonight|this (minute|second|moment|evening)|about to|going to|gonna|doing it now|now)\b/)) return true
  return false
}

/** Which scoping rules apply to which categories (Jack round-3). Crisis/emergency keep their in-detector
 *  guards too; this adds the cross-category historical/third-party/negation/topical layer. */
const SCOPED: Partial<Record<SafetyCategory, ('third_party' | 'historical' | 'negation' | 'topical')[]>> = {
  crisis_concern: ['historical', 'topical'],
  immediate_danger: ['historical', 'topical'],
  medical_emergency: ['negation'],
  overdose_poisoning: ['topical', 'negation', 'historical'],
  medical_condition: ['third_party', 'historical', 'negation', 'topical'],
  medical_urgent: ['third_party', 'historical', 'negation', 'topical'],
  steroids_ped: ['third_party', 'historical', 'negation', 'topical'],
  disordered_eating: ['third_party', 'historical', 'negation', 'topical'],
  prescribed_medication: ['third_party', 'historical', 'negation'],
  injury_override: ['third_party', 'historical', 'negation'],
  pregnancy: ['third_party', 'historical', 'negation', 'topical'],
  under_18: ['third_party', 'historical', 'negation'],
}

/** Trigger terms per category, used by the subject/negation checks. */
const CATEGORY_TERMS: Partial<Record<SafetyCategory, string[]>> = {
  medical_emergency: [...EMERGENCY_REDFLAG],
  medical_condition: [...CONDITIONS, 'asthma', 'diabetes', 'medication', 'medicine', 'condition'],
  medical_urgent: ['concussion', 'knocked out', 'hit my head', 'rhabdo', 'swollen', 'injury', 'injured'],
  steroids_ped: ['steroids', 'sarm', 'sarms', 'testosterone', 'ped', 'anabolic', 'cycle'],
  disordered_eating: ['eating disorder', 'eating disorders', 'anorexia', 'bulimia', 'purge', 'purging'],
  prescribed_medication: ['medication', 'medicine', 'meds', 'prescription', 'tablets', 'pills'],
  injury_override: [...INJURY_TERMS],
  pregnancy: ['pregnant', 'pregnancy', 'expecting', 'postpartum'],
  under_18: ['16', '15', '14', '13', '17', 'year old', 'years old', 'teenager', 'teenage'],
}

/** Decide whether a hit is suppressed by scoping, returning the rule name (or null to keep it). */
function suppressionRule(n: Norm, category: SafetyCategory): string | null {
  const rules = SCOPED[category]
  if (!rules) return null
  if (hasCurrentSafetySignal(n)) return null // PARAMOUNT: any live distress/intent/action blocks ALL suppression
  if (firstPersonPresent(n, category)) return null // current first-person disclosure of this category wins
  const terms = CATEGORY_TERMS[category] ?? []
  if (rules.includes('third_party') && subjectThirdParty(n, terms)) return 'third_party_subject'
  if (rules.includes('historical') && historicalResolved(n)) return 'historical_resolved'
  if (rules.includes('negation') && terms.length > 0 && negatedTerm(n, terms)) return 'explicit_negation'
  if (rules.includes('topical') && topicalFrame(n)) return 'topical_reference'
  return null
}

export interface RulesResult { hits: DetectorHit[]; suppressions: Suppression[] }

/* ------------------------------------------------------------------ */
/*  Public: run all detectors, then apply scoping suppression          */
/* ------------------------------------------------------------------ */

/** Apply scoping suppression to a set of hits (shared by rules and classifier hits). */
function scope(n: Norm, raw: DetectorHit[]): RulesResult {
  const hits: DetectorHit[] = []
  const suppressions: Suppression[] = []
  for (const h of raw) {
    const rule = suppressionRule(n, h.category)
    if (rule) suppressions.push({ category: h.category, rule })
    else hits.push(h)
  }
  return { hits, suppressions }
}

export function runRules(text: string, _ctx: CoachContext): RulesResult {
  const n = normalize(text)
  const detectors = [
    detectCrisis, detectHarmToOthers, detectMedicalEmergency, detectOverdose, detectInjuryOverride,
    detectMedicalUrgent, detectPregnancy, detectMedicalCondition, detectDisorderedEating,
    detectRapidWeightLoss, detectMealPlan, detectSteroidsPED, detectPrescribedMedication,
    detectSupplementDosing, detectUnder18, detectUnsafeTraining, detectAiRelationship,
    detectOffTopic, detectCatchAll,
  ]
  const raw: DetectorHit[] = []
  for (const d of detectors) raw.push(...d(n))
  return scope(n, raw)
}

/**
 * Apply the SAME scoping to CLASSIFIER hits — the LLM over-flags the same third-party / historical /
 * negated / topical contexts, and the scoping guards (first-person present ALWAYS wins) keep it safe.
 */
export function scopeClassifierHits(text: string, hits: DetectorHit[]): RulesResult {
  return scope(normalize(text), hits)
}

/** A known benign false-positive (workout hyperbole, or a bare crisis denial). */
export function isKnownFalsePositive(text: string): boolean {
  const n = normalize(text)
  return isWorkoutHyperbole(n) || negatedCrisisOnly(n)
}

/**
 * True if the message itself carries an active crisis / self-harm signal, using ONLY the existing
 * detector lexicons (no new phrases). The state machine uses this so a correction/retraction can
 * never downgrade a protective state while the SAME message still asserts a crisis — "most
 * protective wins on full context" (spec §2). This is routing/precedence, not new detection.
 */
export function hasActiveCrisisSignal(text: string): boolean {
  const n = normalize(text)
  if (isWorkoutHyperbole(n) && !has(n, ...CRISIS_IDEATION, ...SELF_HARM, ...OTHER_HARM) && !wantsToDie(n)) return false
  if (negatedCrisisOnly(n)) return false
  return has(n, ...CRISIS_IDEATION) || wantsToDie(n) || has(n, ...SELF_HARM) || has(n, ...OTHER_HARM)
}

/**
 * Generic IMMEDIACY modifier (spec §3 "active intent with immediacy → emergency"). Deliberately a
 * small set of general time/intent adverbs — NOT any specific reported sentence — so the router can
 * escalate an already-detected crisis category to the 000 tier when immediacy is present. Precedence
 * logic over detected categories, not a new hazard detector.
 */
export function hasImmediacy(text: string): boolean {
  const n = normalize(text)
  // Intent-immediacy only. Deliberately NOT the bare adverbs "now"/"today", which fire on benign
  // context ("I'm safe now"); we require an explicit imminence phrase so the escalation can't
  // over-fire on incidental wording.
  return hasRe(n, /\b(right now|tonight|this (minute|second|moment|evening)|about to|going to|gonna|planning to|plan to|have a plan)\b/)
}

/**
 * True if the message indicates the user is OUTSIDE Australia (or their location is unknown), as a
 * general concept — not a specific reported sentence. The guard uses this to serve local-services
 * emergency wording instead of assuming AU 000, since device timezone alone can be wrong (Jack §3).
 * Over-triggering is safe: "contact your local emergency services" is correct advice anywhere.
 */
export function indicatesNonAustralia(text: string): boolean {
  const n = normalize(text)
  return has(n, 'overseas', 'abroad', 'not in australia', 'not in au', 'outside australia', 'another country',
    'different country', 'in the uk', 'in england', 'in the us', 'in america', 'in canada', 'in ireland',
    'new zealand', 'in europe', 'location unknown', 'location is unknown', 'dont know where i am', 'don t know where i am')
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
