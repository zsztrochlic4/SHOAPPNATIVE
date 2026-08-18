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
import { ageFromDob } from '../../safety/ageRouting'

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
    'my teammate', 'my colleague', 'someone i know', 'a friend of mine', 'my housemate',
    'in my group chat', 'someone in my', 'a classmate', 'someone from', 'a guy i know', 'a girl i know']
  const reflexiveOther = has(n, 'himself', 'herself', 'themselves', 'themself', 'theirself')
  const firstPersonReflexive = has(n, 'myself', 'my own life')
  if (firstPersonReflexive && !has(n, 'i meant', 'not me')) return false
  return others.some((o) => has(n, o)) || (reflexiveOther && !firstPersonReflexive)
}

/** A bare denial of a crisis term (e.g. "I'm not suicidal") with no other crisis signal. */
function negatedCrisisOnly(n: Norm): boolean {
  const denied = hasRe(n, /\b(not|isn t|aren t|never|no)\s+(?:(?:feeling|depressed)\s+(?:or\s+)?)?(suicidal|going to hurt|self harm)/)
  const otherSignal = has(n, 'hopeless', 'no point', 'end my life', 'kill myself',
    'better off without', 'want to disappear', 'harm myself', 'hurt myself') || wantsToDie(n)
  return denied && !otherSignal
}

/** Fitness hyperbole that must NOT read as crisis (spec §18 false positives). */
function isWorkoutHyperbole(n: Norm): boolean {
  return has(n, 'killed me', 'killing me', 'kill it', 'killed it', 'dead legs', 'im dead', 'i m dead',
    'dying to', 'killer workout', 'killing it', 'destroyed my', 'wrecked me', 'dead tired')
}

/** Ordinary TRAINING FATIGUE the classifier sometimes over-reads as crisis ("everything feels heavy",
 *  "I'm exhausted / run down / wrecked / drained"). It is a recovery / deload topic, not distress. Used
 *  ONLY to suppress a crisis_concern hit, and only ever alongside suppressionRule's paramount
 *  no-live-distress guard, so it can never hide a genuine disclosure. Self-guards on any first-person
 *  distress and on ambiguous life-directed phrases, so "everything feels heavy and I can't keep going"
 *  keeps the crisis flag. */
const _LIFE_DIRECTED = /\b(be here|here anymore|want to be here|the point|whats the point|what s the point|keep going|go on|carry on|hate (?:my )?(?:life|myself)|not worth|worth (?:it|living)|my life|to live|to die|die|dying|kill|suicid|self harm|hurt myself|harm myself|disappear|dont belong|do not belong|empty inside|numb|worthless|hopeless|give up|giving up|no reason|reason to (?:keep|go|live)|cant anymore|can t anymore|cant go on|can t go on|cant cope|can t cope|breaking down|falling apart|over it all|want it to stop|end it|cant keep going|can t keep going|cant do (?:it|this) anymore|can t do (?:it|this) anymore)\b/
function isBenignTrainingFatigue(n: Norm): boolean {
  if (hasFirstPersonDistress(n) || wantsToDie(n)) return false
  if (hasRe(n, _LIFE_DIRECTED)) return false // any life/existence-directed phrasing keeps the crisis flag
  return has(n, 'everything feels heavy', 'everything is heavy', 'feels heavy', 'feeling heavy',
    'weights feel heavy', 'lifts feel heavy', 'exhausted', 'run down', 'rundown', 'run-down', 'wrecked',
    'shattered', 'drained', 'wiped out', 'knackered', 'no energy', 'zero energy', 'so tired',
    'really tired', 'burnt out', 'burned out', 'sluggish', 'so flat', 'feeling flat', 'running on empty',
    'worn out', 'no gas left')
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

  // Finality declaration ("this is it", "tonight is the night", "today is the day", "this is the end")
  // carrying no explicit self-harm token — the A-class euphemism tail. Finality phrasing alone is common
  // gym/achievement hype, so it is REQUIRED to co-occur with isolation or a goodbye, and is excluded when
  // any fitness or ordinary-life-event context is present. Generalises to the euphemism, not a sentence.
  const finalityDecl = has(n, 'this is it', 'tonight is it', 'today is it', 'this is the night',
    'tonight is the night', 'today is the day', 'this is the end', 'the end for me', 'my time is up')
  const isolationOrGoodbye = has(n, 'im alone', 'i m alone', 'im all alone', 'all alone', 'by myself',
    'on my own', 'no one will', 'nobody will', 'goodbye', 'saying goodbye', 'this is goodbye')
  const benignLifeEvent = has(n, ...FITNESS_TERMS) || has(n, 'quit smoking', 'propose', 'proposal', 'engaged',
    'wedding', 'move out', 'moving out', 'moving to', 'new city', 'new place', 'relocat', 'new job', 'first day',
    'graduat', 'interview', 'exam', 'test ', 'presentation', 'deadline', 'due date')
  const finalityEuphemism = finalityDecl && isolationOrGoodbye && !benignLifeEvent

  const hit = lifeIntent || revealIntent || notExist || finalityEuphemism
  // Escalate to 000 only with a self-reveal, a decision-to-act-now, or an explicit finality/method
  // marker — so a VAGUE euphemism floors at Lifeline, not an over-aggressive 000.
  const finality = has(n, 'it all', 'my life', 'everything', 'for good', 'once and for all', 'for the last time',
    'after tonight', 'after today', 'the pills', 'took the pills', 'taken the pills', 'step off', 'off the bridge') || wantsToDie(n)
  const imminence = hasRe(n, /\b(tonight|today|right now|this (evening|minute|moment)|after this|after tonight|for good|once and for all|doing it now|do it now)\b/)
  const immediate = hit && imminence && (revealIntent || decisionImminent || finality || finalityEuphemism)
  return { hit, immediate }
}

/**
 * Concealed / wrapped present intent — the Jack FINAL §1F failure class: a self-harm / suicide /
 * overdose TOPIC presented behind an academic, quoted, or hypothetical WRAPPER, but carrying a genuine
 * present first-person ACTION, MEANS, METHOD-seeking, or a REVEAL that it is real and about the user
 * NOW. The benign wrapper is exactly what defeats the probabilistic model; this deterministic floor
 * escalates regardless of the wrapper. Bounded so ordinary medical / academic / financial talk does
 * not match. Generalises to the mechanism, not to any specific (now-burned) case.
 */
function concealedIntent(n: Norm): { hit: boolean; immediate: boolean } {
  // Benign medical context that makes "took the pills" ordinary (prescribed / vitamins / feeling better).
  const benignMed = has(n, 'prescribed', 'as directed', 'my vitamins', 'multivitamin', 'the doctor', 'my doctor',
    'feeling better', 'morning pills', 'with food', 'my supplement', 'my supplements', 'creatine')
  // (a) SELF-CONTAINED self-harm ACTION / MEANS / METHOD — unambiguous on their own → immediate.
  const action = !benignMed && has(n, 'ive taken the pills', 'i took the pills', 'ive taken them all', 'i took them all',
    'ive taken all the pills', 'ive swallowed them', 'swallowed the pills', 'im cutting myself')
  const means = has(n, 'the means here', 'means to end my life', 'means to kill myself', 'means to end it',
    'have the means to end', 'have the means to do it', 'ive got the means to', 'intend to use them', 'ready to use them',
    'saved up my medication', 'saving up my medication', 'saved up my meds', 'saving up my meds',
    'saved up my pills', 'saving up my pills', 'stockpiling my medication', 'stockpiling my pills',
    'stockpiling pills', 'hoarding my medication', 'hoarding my pills')
  const method = has(n, 'lethal dose', 'painless way to die', 'painless way to go', 'least painful way to',
    'how to kill myself', 'how to end my life', 'enough pills to overdose', 'enough to overdose', 'best way to kill myself',
    'ways to kill myself') ||
    hasRe(n, /\bhow (many|much)\b[a-z0-9 ]{0,25}\b(it would take|would it take|to (die|od|overdose|end (it|my life)))\b/)
  if (action || means || method) return { hit: true, immediate: true }

  // (b) crisis TOPIC + a present REVEAL/commitment that is otherwise ambiguous, behind a wrapper.
  const topic = has(n, 'suicidal', 'self harm', 'self-harm', 'selfharm', 'kill myself', 'killing myself', 'end my life',
    'take my life', 'take my own life', 'overdose', 'hurt myself', 'harm myself', 'cut myself', 'cutting myself') || wantsToDie(n)
  const revealReal = has(n, 'its not hypothetical', 'it isnt hypothetical', 'not hypothetical anymore', 'wasnt hypothetical',
    'im not quoting', 'not quoting anymore', 'its about me', 'about me now', 'im the one', 'talking about myself', 'but its me', 'its me now',
    'not for an assignment', 'not for a class', 'not for homework', 'forget the assignment', 'forget the essay',
    'forget the class', 'forget it im', 'forget that im') ||
    hasRe(n, /\bplanning my own\b(?![a-z ]{0,4}\b(workout|program|programme|routine|split|plan|diet|meal|session|training|block|cut|bulk)\b)/) ||
    hasRe(n, /\b(im|i m|i am)\s+(cutting|doing it|going through with it)\b/)
  // A QUOTED wrapper explicitly DENIED = revealed as the user's real present intent. Match the split
  // "quoting … but im not" structure (NOT a bare "im not", which would catch "im not sure about tonight").
  const quotedRevealed = has(n, 'im not quoting', 'not just a lyric', 'not just a song', 'not just a quote',
    'more than a lyric', 'not just quoting', 'im not just quoting') ||
    hasRe(n, /\b(quoting|lyrics?|a song|a quote|a poem)\b[a-z0-9 ]{0,25}\bbut (im|i m|i am|its|it s)\s+not\b/)
  if ((topic && revealReal) || quotedRevealed) {
    const imminence = hasRe(n, /\b(tonight|today|right now|this (evening|minute|moment)|after this|now)\b/)
    const isPlan = hasRe(n, /\bplanning my own\b/) // planning one's own [suicide] IS a plan → immediate
    return { hit: true, immediate: imminence || isPlan }
  }
  return { hit: false, immediate: false }
}

/** Whole-word first-person distress/intent — used to guard the topical suppressor so it can NEVER
 *  hide a genuine disclosure that merely mentions an academic setting (Jack round-2 §3 critical guard). */
function hasFirstPersonDistress(n: Norm): boolean {
  return has(n, ...CRISIS_IDEATION) || wantsToDie(n) ||
    has(n, 'kill myself', 'killing myself', 'take my own life', 'end my life', 'harm myself',
      'hurt myself', 'cut myself', 'cutting myself', 'harming myself', 'self harming', 'i self harm',
      'im suicidal', 'i m suicidal', 'feel suicidal', 'feeling suicidal', 'been suicidal') ||
    has(n, ...OTHER_HARM) || selfHarmIntent(n).hit || concealedIntent(n).hit
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
  // Named gym terminology that merely CONTAINS "suicide": the shuttle-run drill ("suicides") and the
  // thumbless bench grip ("suicide grip"), plus the set/press/hold variants. Not a personal disclosure.
  const gymTerm = has(n, 'suicidal sprint', 'suicidal sprints', 'suicidal drill', 'suicidal drills',
    'suicidal run', 'suicidal runs', 'suicidal shuttle', 'suicidal shuttles', 'suicidal grip',
    'suicidal grips', 'suicidal set', 'suicidal sets', 'suicidal press', 'suicidal hold')
  // academic verb/noun immediately (within ~40 chars) followed by the crisis term
  const studyOfTopic = hasRe(n,
    /\b(research|researching|study|studying|studies|thesis|dissertation|essay|assignment|project|paper|degree|coursework|module|lecture|tutorial|seminar|workshop|textbook|quiz|exam|curriculum|syllabus|revision|flashcard|flashcards|glossary|presentation|report|writing|analysing|analyzing|literature review)\b[a-z0-9 ]{0,40}\b(suicidal|self harm|self harming|eating disorder|eating disorders|anorexia|bulimia)\b/)
  // crisis term immediately followed by a topic-label suffix
  const topicLabel = hasRe(n,
    /\b(suicidal|self harm|eating disorder|eating disorders)\b[a-z0-9 ]{0,25}\b(prevention|awareness|risk factor|risk factors|statistics|rates|campaign|in athletes|in sport|in sports|programme|program|module)\b/)
  // Definitional / meta-linguistic query ("what does <term> mean", "define <term>") — asking for the
  // MEANING of a clinical term, not disclosing it. The verb wrapper keeps it off a real disclosure, and
  // the first-person-distress guard below is the paramount backstop.
  const definitional =
    hasRe(n, /\b(what (does|do|is)|whats|define|definition of|meaning of|explain)\b[a-z0-9 ]{0,30}\b(suicidal|self harm|self harming|eating disorder|eating disorders|anorexia|bulimia)\b/) ||
    hasRe(n, /\b(suicidal|self harm|eating disorder|eating disorders|anorexia|bulimia)\b[a-z0-9 ]{0,20}\b(mean|means|meaning|definition|defined)\b/)
  if (!gymTerm && !studyOfTopic && !topicLabel && !definitional) return false
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

/** Rules-FLOOR escalator for concealed/wrapped present intent (Jack FINAL §1F). Fires deterministically
 *  even when the classifier is fooled by the academic/quoted wrapper. Third-party phrasing is left to
 *  the third-party path. Because `concealedIntent().hit` also feeds `hasFirstPersonDistress`, the
 *  cross-category scoping guard (`hasCurrentSafetySignal`) will NOT suppress these. */
function detectConcealedIntent(n: Norm): DetectorHit[] {
  const ci = concealedIntent(n)
  if (!ci.hit || isThirdParty(n)) return []
  return [hit(ci.immediate ? 'immediate_danger' : 'crisis_concern', 'concealed_present_intent')]
}

/** A third party in ACUTE danger via a note/goodbye (Jack FINAL 1I-10) → route to emergency (000 for
 *  the other person), not the softer support line. */
function detectThirdPartyAcute(n: Norm): DetectorHit[] {
  const acute = has(n, 'suicide note', 'suicidal note', 'goodbye note', 'goodbye message', 'left a note',
    'posted a note', 'posted a suicide', 'sent a goodbye', 'saying goodbye', 'said goodbye', 'final goodbye')
  if (acute && isThirdParty(n)) return [hit('medical_emergency', 'third_party_acute_goodbye')]
  return []
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
  // Active self-injury co-occurring with an ACUTE physical sign (faintness, collapse, heavy bleeding) is
  // a medical 000 emergency, not only the crisis-line referral (Jack C2: "hurt myself and feeling faint").
  // Generalises to any self-harm term + acute-sign pairing, not a specific sentence.
  if (has(n, 'hurt myself', 'hurting myself', 'cut myself', 'cutting myself', 'harmed myself', 'harming myself', 'self harm', 'self harmed') &&
      has(n, 'faint', 'light headed', 'lightheaded', 'dizzy', 'passing out', 'pass out', 'blacking out', 'black out',
        'lost a lot of blood', 'cant stop the bleeding', 'can t stop the bleeding', 'bleeding a lot', 'lots of blood',
        'wont stop bleeding', 'won t stop bleeding', 'losing consciousness', 'about to pass out'))
    return [hit('medical_emergency', 'self_harm_with_acute_sign')]
  // Heat illness: hot context + neuro/GI signs (spec §6).
  const hot = has(n, 'heatstroke', 'heat stroke', '40 degrees', '38 degrees', '39 degrees', '41 degrees',
    'in the heat', 'so hot', 'overheating', 'boiling hot')
  const heatSigns = has(n, 'dizzy', 'confused', 'vomit', 'nauseous', 'faint', 'weak', 'collapse')
  if (hot && heatSigns) return [hit('medical_emergency', 'possible_heatstroke')]
  // Diabetic emergency: confusion / can't respond (spec §7).
  if (has(n, 'diabetic', 'diabetes', 'hypo') && has(n, 'confused', 'can t speak', 'unconscious', 'seizing', 'drowsy', 'passing out'))
    return [hit('medical_emergency', 'diabetic_emergency')]
  // Head injury WITH a serious neuro red flag → 000, not the (still-urgent) concussion caution. A milder
  // head knock (e.g. "hit my head and feel dizzy") stays medical_urgent → the concussion response, which
  // itself escalates on these same red flags (YC review, SF03).
  if (has(n, 'hit my head', 'banged my head', 'knock to the head', 'head knock', 'bang to the head', 'concussion', 'knocked out', 'hit his head', 'hit her head') &&
      has(n, 'passed out', 'blacked out', 'black out', 'lost consciousness', 'unconscious', 'keep vomiting', 'kept vomiting', 'repeated vomiting', 'throwing up', 'seizure', 'seizing', 'confused', 'confusion', 'cant stay awake', 'can t stay awake', 'wont wake', 'won t wake', 'slurred', 'weakness', 'numb', 'worst headache'))
    return [hit('medical_emergency', 'serious_head_injury')]
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

/** Non-emergency urgent musculoskeletal symptoms (spec §6 urgent-refer). Kept as a shared const so the
 *  negation scoping (CATEGORY_TERMS.medical_urgent) uses the SAME vocabulary the detector fires on — a
 *  negated symptom ("no swelling") is then suppressed instead of flagged. Previously the two lists had
 *  drifted ('swollen' vs the fired 'swelling'), so an explicit denial slipped through. */
const URGENT_SYMPTOM = ['swollen', 'swelling', 'sharp pain', 'stabbing pain', 'can t put weight',
  'cant put weight', 'pain for a week', 'painful and swollen', 'been painful', 'really painful', 'badly hurt']

function detectMedicalUrgent(n: Norm): DetectorHit[] {
  const out: DetectorHit[] = []
  // Rhabdomyolysis (spec §6): dark urine + muscle pain, or explicit term.
  if (has(n, 'rhabdo') || (has(n, 'dark urine', 'brown pee', 'brown urine', 'cola coloured', 'tea coloured', 'dark pee', 'dark brown') && has(n, 'muscle', 'legs', 'pain', 'agony', 'sore')))
    out.push(hit('medical_urgent', 'possible_rhabdo'))
  // Concussion / head injury (spec §9).
  if (has(n, 'concussion', 'knocked out', 'knock to the head', 'hit my head', 'banged my head', 'head knock', 'bang to the head'))
    out.push(hit('medical_urgent', 'possible_concussion'))
  // Injury / pain / swelling not otherwise an override or emergency (spec §6 urgent-refer).
  if (has(n, ...URGENT_SYMPTOM))
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

/** EXPLICIT, CURRENT clinician clearance to exercise. When the user is telling us a
 *  professional has already assessed the condition and cleared them to train, a benign
 *  programming question is not a deferral case (reviewer over-caution class, IRH-BN-19).
 *  Deliberately a broad general idiom set, not tuned to any one message. Recall is
 *  preserved by ACUTE_OVERRIDE below and by the emergency detectors that run FIRST. */
/** Explicit CURRENT clinician clearance to exercise = a POSITIVE clearance ACT co-occurring
 *  with an EXERCISE OBJECT. Generalised over the verb (cleared / approved / okayed / signed
 *  off / gave the go-ahead / green light) rather than a fixed phrase list, so fresh wordings
 *  like "cleared exercise", "team approved resistance training", "signed off on lifting" all
 *  match. Guarded against a NON-clearance ("not cleared", "need to get cleared", "advised
 *  against"). */
const CLEARANCE_ACT = ['cleared', 'clearance', 'approved', 'approve', 'okayed', 'ok d', 'signed off', 'sign off',
  'given the go ahead', 'go ahead to', 'green light', 'given the all clear', 'gave the all clear', 'all clear to',
  'happy for me to', 'given clearance', 'said i can train', 'said i can lift', 'said i can exercise']
const EXERCISE_OBJECT = ['exercise', 'exercising', 'training', 'train', 'lift', 'lifting', 'resistance training',
  'strength training', 'weights', 'working out', 'work out', 'workout', 'gym', 'me to', 'me for']
const NOT_CLEARED = ['not cleared', 'no clearance', 'advised against', 'told me not to', 'said not to',
  'refused to clear', 'not safe to', 'get cleared', 'getting cleared', 'to get cleared', 'need to get cleared',
  'not to train', 'not to lift', 'not to exercise', 'shouldnt train', 'should not train']
function hasCurrentClearance(n: Norm): boolean {
  if (has(n, ...NOT_CLEARED)) return false
  return has(n, ...CLEARANCE_ACT) && has(n, ...EXERCISE_OBJECT)
}
/** Any acute sign here KEEPS the flag even with a clearance claim (belt-and-braces; the
 *  emergency detectors already run before this, so an emergency still wins on tier). */
const ACUTE_OVERRIDE = ['chest pain', 'cant breathe', 'can t breathe', 'short of breath', 'attack',
  'palpitations', 'passing out', 'passed out', 'fainting', 'faint', 'unconscious', 'seizing', 'seizure',
  'confused', 'slurred', 'blue lips', 'severe']

/** A cleared, stable condition with a benign training question — the professional already
 *  assessed it. Trusts the classifier/rules medical_condition category and only relaxes it
 *  (router benign-override) under explicit current clearance + no acute sign. */
export function clearedConditionBenign(text: string): boolean {
  const n = normalize(text)
  return hasCurrentClearance(n) && !has(n, ...ACUTE_OVERRIDE)
}

/** A PAINLESS joint noise (click / pop / crack / crackle / grind / clunk) with an explicit
 *  no-pain / feels-normal statement and NO asserted red flag (swelling, sharp pain, giving
 *  way, locking, instability, cannot bear weight, dislocation). Negated red flags ("no pain,
 *  giving way, or swelling") do not count — a wide window catches comma lists. */
const JOINT_NOISE = ['click', 'clicks', 'clicking', 'clicked', 'pop', 'pops', 'popping', 'popped', 'crack', 'cracks',
  'cracking', 'crackle', 'crackles', 'crackling', 'grind', 'grinds', 'grinding', 'clunk', 'clunks', 'clunking',
  'crepitus', 'snapping', 'snaps']
const PAINLESS_SIGN = ['no pain', 'painless', 'pain free', 'doesnt hurt', 'does not hurt', 'nothing hurts',
  'not painful', 'feels normal', 'completely normal', 'totally normal', 'feels fine', 'no discomfort', 'no other symptoms']
const JOINT_REDFLAG = ['swollen', 'swelling', 'swells', 'sharp pain', 'stabbing', 'giving way', 'gives way', 'gave way',
  'locking', 'locks up', 'locked up', 'unstable', 'instability', 'cant bear weight', 'can t bear weight',
  'cant put weight', 'can t put weight', 'cant walk', 'can t walk', 'wont move', 'can t move', 'dislocat', 'popped out']
function wideNegated(n: Norm, t: string): boolean {
  return hasRe(n, new RegExp(`\\b(no|not|never|without|free of|nor|neither|dont|don t|didnt)\\b[a-z0-9 ,]{0,40}\\b${esc(t)}(s|es)?\\b`))
}
export function painlessNoiseBenign(text: string): boolean {
  const n = normalize(text)
  if (!has(n, ...JOINT_NOISE) || !has(n, ...PAINLESS_SIGN)) return false
  // Any red flag that is ASSERTED (present and not inside a negation) keeps the flag.
  return !JOINT_REDFLAG.some((t) => has(n, t) && !wideNegated(n, t))
}

function detectMedicalCondition(n: Norm): DetectorHit[] {
  // Asthma is a condition, but an ATTACK is an emergency (handled above).
  const condition = has(n, ...CONDITIONS) || (has(n, 'asthma') && !has(n, 'asthma attack'))
  // Suppress the deferral ONLY when a named condition carries explicit current clearance
  // AND shows no acute sign — the professional already assessed it. Without clearance, or
  // with any acute sign, it still flags (or the emergency floor catches it first).
  if (condition && hasCurrentClearance(n) && !has(n, ...ACUTE_OVERRIDE)) return []
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
  // Compensatory exercise (500-prompt eval #407): training used to make up for / burn off eating, or
  // extra training framed as a consequence of eating "too much". High precision — requires BOTH an
  // extra-exercise cue AND a compensation-for-eating cue, so a benign "I overate and skipped my workout"
  // does not trip it.
  const compExercise = has(n, 'train twice', 'train again', 'train extra', 'extra session', 'extra workout',
    'extra cardio', 'more cardio', 'train harder', 'work it off', 'burn it off', 'twice today')
  const compFood = has(n, 'because i ate', 'since i ate', 'after eating', 'i ate too much', 'ate too much',
    'to burn off', 'burn off', 'make up for', 'to earn', 'compensate')
  if (compExercise && compFood) return [hit('disordered_eating', 'compensatory_exercise')]
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

// Macro/calorie targets — always out of scope (spec §5), never numeric nutrition prescriptions.
function mealPlanMacros(n: Norm): boolean {
  return has(n, 'give me my macros', 'my macro targets', 'exact macros', 'calorie meal plan',
    'macro target', 'macros for', 'how many calories', 'calorie target', 'set my calories', 'set my macros')
    || hasRe(n, /\d{3,4}\s?(cal|calorie|kcal)\b.*(plan|diet|meal)/)
}
function mealPlanPhrase(n: Norm): boolean {
  return has(n, 'meal plan', 'diet plan', 'eating plan', 'what to eat every day',
    'tell me exactly what to eat', 'food schedule', 'day meal plan', 'meal prep plan')
}
// QUALITATIVE review of the user's OWN existing plan is IN scope (owner decision): the coach may
// comment on balance, variety, veggies, protein, carbs qualitatively and suggest improvements.
function mealReviewIntent(n: Norm): boolean {
  return has(n, 'review', 'look at my', 'check my', 'is my', 'how is my', 'hows my',
    'are my', 'thoughts on', 'feedback on', 'improve my', 'improvements', 'rate my', 'critique',
    'balanced', 'enough protein', 'enough veg', 'good enough', 'any good', 'what do you think')
}
// CREATION intent — building a plan from scratch is out of scope no matter how it is dressed up, so it
// forces the block even when a review adjective is also present ("make me a BALANCED meal plan").
function mealCreateIntent(n: Norm): boolean {
  return has(n, 'make me', 'make a', 'build me', 'build a', 'give me a', 'create',
    'design', 'generate', 'write me', 'write a', 'put together', 'come up with', 'draw up',
    'plan me', 'set me up', 'prep me', 'map out', 'lay out')
}

/**
 * The user is asking us to REVIEW their own existing meals/plan qualitatively (in scope): clear
 * review/feedback intent, NO from-scratch creation verb, and NO numeric macro/calorie target. Used to
 * suppress an over-eager CLASSIFIER `meal_plan` hit so the model can actually give feedback — the
 * rules floor still blocks real creation and macros, so a plan-CREATION request is unaffected.
 */
export function isOwnPlanReview(n: Norm): boolean {
  return mealReviewIntent(n) && !mealCreateIntent(n) && !mealPlanMacros(n)
}

function detectMealPlan(n: Norm): DetectorHit[] {
  // Only a review of an EXISTING plan (review intent AND no creation verb) is allowed; macros and
  // from-scratch creation always block.
  const block = mealPlanMacros(n) || (mealPlanPhrase(n) && (mealCreateIntent(n) || !mealReviewIntent(n)))
  if (block) return [hit('meal_plan', 'meal_plan_request')]
  return []
}

function detectSteroidsPED(n: Norm): DetectorHit[] {
  // Prescribed corticosteroids are NOT PEDs (spec §11 boundary) — route elsewhere.
  if (has(n, 'prescribed', 'my doctor prescribed', 'corticosteroid', 'cortico steroid', 'prednisone', 'inhaled steroid'))
    return []
  const ped = has(n, 'steroids', 'steroid cycle', 'anabolic', 'sarm', 'sarms', 'testosterone', 'test e',
    'test cyp', 'trenbolone', 'anavar', 'dianabol', 'winstrol', 'clenbuterol', 'peptide', 'peptides',
    'post cycle', 'post cycle therapy', 'pct', 'inject test', 'how much testosterone', 'best cycle', 'safest cycle',
    'pass a drug test', 'beat a drug test', 'where can i buy sarms', 'buy steroids',
    // 500-prompt eval: definition/education/myth PED questions ("what does TRT mean", "risks of PED use")
    // were falling to the generic off-topic bucket or an awkward model refusal. Route them to the PED
    // referral so they get a risk-aware "speak to a doctor" answer, not a generic deflection. The referral
    // never gives cycles/doses/sourcing, so this only tightens (never loosens) the guardrail.
    'trt', 'peds', 'ped use', 'ped usage', 'ped cycle', 'performance enhancing', 'performance-enhancing',
    'performance enhancer', 'gear cycle') ||
    // 'tren' (trenbolone slang) ONLY as a whole word — a bare substring wrongly fired inside common
    // fitness words "s-TREN-gth" and "TREN-d", referring every strength/weight-trend question as a PED.
    hasRe(n, /\btren\b/)
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

/** Numeric-unit lookahead so an age match isn't a reps/kg/weeks quantity. */
const NOT_A_QUANTITY = '(?!\\s*(kg|kgs|kilo|kilos|pound|pounds|lb|lbs|rep|reps|set|sets|week|weeks|min|minutes|km|hour|hours|days|day|percent))'

function detectUnder18(n: Norm): DetectorHit[] {
  // Age with clear self-reference, guarding against reps/kg/weeks/etc.
  const ageStmt = hasRe(n, /\b(i am|i m|im|only|actually|just|turned|turning)\s+(1[0-7]|[1-9])\b(?!\s*(kg|kgs|kilo|kilos|pound|pounds|lb|lbs|rep|reps|set|sets|week|weeks|min|minutes|km|hour|hours|days|day|percent|reps))/)
  const explicit = has(n, 'under 18', 'underage', 'im a minor', 'i m a minor', 'still in high school',
    'in year 7', 'in year 8', 'in year 9', 'in year 10', 'in year 11', 'year 7', 'year 8', 'year 9', 'year 10',
    'in grade 7', 'in grade 8', 'in grade 9', 'in grade 10', 'grade 7', 'grade 8', 'grade 9', 'high schooler',
    // US high-school class terms, ONLY in the high-school collocation (unambiguous minors: freshman ~14,
    // sophomore ~15, junior ~16-17). Bare 'junior'/'senior'/'freshman'/'sophomore' are deliberately NOT
    // matched — they are overloaded in the gym (junior athlete, senior lifter) and at college (a college
    // freshman is 18+). 'senior' high-schooler (~year 12) is also excluded as a possible 18-year-old.
    'high school freshman', 'high school sophomore', 'high school junior',
    'freshman in high school', 'sophomore in high school', 'junior in high school')
  // Birth-year disclosure that implies a CURRENT minor ("i was born in 2010", "birth year 2009", "dob 2010").
  // Computed against the current year so it stays correct as time passes; only DEFINITE minors flag (born
  // strictly after currentYear-18), leaving the ambiguous edge birth year to the server-trusted DOB gate.
  // Third-party / historical / negated mentions are removed by scope() afterwards, so "my sister born in
  // 2010" does not flag.
  const bornMatch = n.p.match(/\bborn (?:in |on |back in )?(?:\w+ )?(20\d{2})\b/) || n.p.match(/\b(?:birth year|year of birth|dob)\b[^0-9]{0,8}(20\d{2})\b/)
  let bornMinor = false
  if (bornMatch) {
    const y = Number(bornMatch[1])
    const nowY = new Date().getFullYear()
    bornMinor = y > nowY - 18 && y <= nowY
  }
  // Indirect "not yet 18" disclosures (the Jack JV-U03 class): approaching 18, an UPCOMING 18th birthday,
  // or "not yet 18" all mean the user is CURRENTLY under 18. First-person is required by the pattern shape
  // ("i …", or "my 18th/eighteenth birthday" with no relative in between), so a third party's upcoming
  // 18th ("my sister's 18th birthday") does not match. "turned 18 last year" is not matched (that is now 18+).
  const approachingEighteen =
    hasRe(n, new RegExp(`\\b(?:im|i m|i am|i)(?:\\s+(?:will be|ll be))?\\s+(?:turning|turn|almost|nearly|about to (?:turn|be)|going to (?:turn|be))\\s*(?:18|eighteen)\\b${NOT_A_QUANTITY}`)) ||
    hasRe(n, /\bmy (?:18th|eighteenth) birthday\b/) ||
    hasRe(n, /\b(?:before|until|when) i turn (?:18|eighteen)\b/) ||
    hasRe(n, new RegExp(`\\bnot (?:yet|quite) (?:18|eighteen)\\b${NOT_A_QUANTITY}`)) ||
    // First-person "I'm in high school" (present-tense enrolment). Requires the "i (am) …" subject so a
    // teacher/coach ("I teach in high school", "I coach a high school team") does NOT match; a historical
    // "when I was in high school" is removed afterwards by scope()'s `historical` suppressor for under_18.
    hasRe(n, /\b(?:i am|i m|im)\s+(?:still |currently |only )?in high school\b/)
  if (ageStmt || explicit || approachingEighteen || bornMinor) return [hit('under_18', 'stated_under_18')]
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
  const unwell = has(n, 'fever', 'vomiting', 'throwing up', 'i m sick', 'im sick', 'really ill',
    'drunk', 'under the influence', 'high on', 'hungover', 'no sleep', 'haven t slept', 'havent slept') ||
    hasRe(n, /\bflu\b/) // whole word only — must not substring-match "fluids"/"influence"/"fluent"
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
    'do you love me', 'will you be my', 'only one who gets me', 'you re all i have', 'marry me',
    // "do you like me?" and close variants (final plan Phase 1): a direct feelings/relationship
    // question about the coach → the honest warm-boundary reply (ai_relationship keeps noAI:false so
    // the user may continue on a safe topic afterwards).
    'do you like me', 'do you actually like me', 'do you really like me', 'do you even like me',
    'are you my friend', 'will you be my friend', 'do you have feelings', 'do you have feelings for me',
    'can we be friends', 'do you care about me', 'are you in love with me', 'do you think about me',
    'will you always be here for me', 'are you my only friend', 'do you miss me',
    // 500-prompt eval: identity / clinical-role / diagnosis questions belong here (the ai_relationship
    // reply already states "not a real person, a therapist, or your doctor" and redirects to training),
    // not in the generic off-topic bucket they were falling into (#423/#424/#425).
    'are you a doctor', 'are you a physio', 'are you a physiotherapist', 'are you a nurse',
    'are you a dietitian', 'are you a psychologist', 'are you a physician', 'are you medically qualified',
    'are you a qualified', 'are you qualified', 'can you diagnose', 'diagnose injuries', 'diagnose my',
    'diagnose what', 'tell me what is wrong with', 'what is wrong with my'))
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
    'in my teens', 'in my twenties', 'in my thirties', 'when younger', 'when i was younger', 'as a student', 'years back',
    'early twenties', 'late teens', 'my early twenties', 'my late teens', 'back at uni', 'when i was at uni')
  const resolved = has(n, 'recovered', 'fully recovered', 'have recovered', 'am better', 'im better', 'no longer',
    'dont anymore', 'don t anymore', 'not anymore', 'medically cleared', 'was cleared', 'been cleared', 'am safe now',
    'im safe now', 'safe now', 'im fine now', 'am fine now', 'do not use them now', 'dont use them now', 'no longer take',
    'but do not use', 'and have recovered', 'and was medically cleared', 'resolved', 'all good now', 'all clear',
    'no problems since', 'no issues since', 'no issue since', 'no trouble since', 'have stopped', 'stopped',
    'quit', 'off it now', 'off them now', 'cleared up', 'went away', 'sorted now', 'fine since', 'fine ever since',
    'natural ever since', 'natural since', 'clean since', 'clean ever since', 'off it since', 'off them since', 'been natural')
  const presentSignal = has(n, 'still', 'currently', 'right now', 'these days', 'nowadays', 'again now', 'now i') ||
    has(n, ...PRESENT_SYMPTOM) || hasFirstPersonDistress(n) || wantsToDie(n)
  return past && resolved && !presentSignal
}

/** Academic / research / quoted / news / hypothetical framing (general, cross-category). */
function topicalFrame(n: Norm): boolean {
  return has(n, 'research', 'researching', 'studying', 'studies', 'thesis', 'dissertation', 'essay', 'assignment',
    'project', 'coursework', 'lecture', 'tutorial', 'seminar', 'workshop', 'textbook', 'quiz', 'curriculum',
    'syllabus', 'revision', 'flashcards', 'presentation', 'literature review', 'my degree', 'my class', 'my course',
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
const SCOPED: Partial<Record<SafetyCategory, ('third_party' | 'historical' | 'negation' | 'topical' | 'fatigue')[]>> = {
  crisis_concern: ['historical', 'topical', 'fatigue'],
  immediate_danger: ['historical', 'topical'], // never 'fatigue' — an imminent-danger flag is never suppressed by tiredness

  medical_emergency: ['negation'],
  overdose_poisoning: ['topical', 'negation', 'historical'],
  medical_condition: ['third_party', 'historical', 'negation', 'topical'],
  medical_urgent: ['third_party', 'historical', 'negation', 'topical'],
  steroids_ped: ['third_party', 'historical', 'negation', 'topical'],
  disordered_eating: ['third_party', 'historical', 'negation', 'topical'],
  prescribed_medication: ['third_party', 'historical', 'negation'],
  injury_override: ['third_party', 'historical', 'negation'],
  pregnancy: ['third_party', 'historical', 'negation', 'topical'],
  under_18: ['third_party', 'historical', 'negation', 'topical'],
}

/** Trigger terms per category, used by the subject/negation checks. */
const CATEGORY_TERMS: Partial<Record<SafetyCategory, string[]>> = {
  medical_emergency: [...EMERGENCY_REDFLAG],
  medical_condition: [...CONDITIONS, 'asthma', 'diabetes', 'medication', 'medicine', 'condition'],
  medical_urgent: ['concussion', 'knocked out', 'hit my head', 'rhabdo', 'injury', 'injured', ...URGENT_SYMPTOM],
  steroids_ped: ['steroids', 'sarm', 'sarms', 'testosterone', 'ped', 'anabolic', 'cycle'],
  disordered_eating: ['eating disorder', 'eating disorders', 'anorexia', 'bulimia', 'purge', 'purging'],
  prescribed_medication: ['medication', 'medicine', 'meds', 'prescription', 'tablets', 'pills'],
  injury_override: [...INJURY_TERMS],
  pregnancy: ['pregnant', 'pregnancy', 'expecting', 'postpartum'],
  under_18: ['16', '15', '14', '13', '17', 'year old', 'years old', 'teenager', 'teenage',
    'year 7', 'year 8', 'year 9', 'year 10', 'year 11', 'grade 7', 'grade 8', 'grade 9', 'high school', 'high schooler'],
}

/** Scoping options. `adult` = the server-trusted DOB proves the account holder is 18+. */
export interface ScopeOpts { adult?: boolean }

/** True when the stored DOB proves the account holder is an adult (18+). */
function isAdultCtx(ctx: CoachContext): boolean {
  const age = ageFromDob(ctx.dateOfBirth)
  return age != null && age >= 18
}

/** Decide whether a hit is suppressed by scoping, returning the rule name (or null to keep it). */
function suppressionRule(n: Norm, category: SafetyCategory, opts: ScopeOpts = {}): string | null {
  const rules = SCOPED[category]
  if (!rules) return null
  if (hasCurrentSafetySignal(n)) return null // PARAMOUNT: any live distress/intent/action blocks ALL suppression
  if (firstPersonPresent(n, category)) return null // current first-person disclosure of this category wins
  // Server-trusted age (audit SA-010 FP-reduction): an `under_18` flag on a user whose STORED DOB
  // proves they are an adult — with NO current first-person minor disclosure (both guarded above) —
  // is a false positive. The authoritative minor handling runs off the DOB age gate, not this
  // backstop, so suppressing it here only removes noise, never real minor protection.
  if (category === 'under_18' && opts.adult) return 'server_dob_adult'
  const terms = CATEGORY_TERMS[category] ?? []
  if (rules.includes('third_party') && subjectThirdParty(n, terms)) return 'third_party_subject'
  if (rules.includes('historical') && historicalResolved(n)) return 'historical_resolved'
  if (rules.includes('negation') && terms.length > 0 && negatedTerm(n, terms)) return 'explicit_negation'
  if (rules.includes('topical') && topicalFrame(n)) return 'topical_reference'
  if (rules.includes('fatigue') && isBenignTrainingFatigue(n)) return 'training_fatigue'
  return null
}

export interface RulesResult { hits: DetectorHit[]; suppressions: Suppression[] }

/* ------------------------------------------------------------------ */
/*  Public: run all detectors, then apply scoping suppression          */
/* ------------------------------------------------------------------ */

/** Apply scoping suppression to a set of hits (shared by rules and classifier hits). */
function scope(n: Norm, raw: DetectorHit[], opts: ScopeOpts = {}): RulesResult {
  const hits: DetectorHit[] = []
  const suppressions: Suppression[] = []
  for (const h of raw) {
    const rule = suppressionRule(n, h.category, opts)
    if (rule) suppressions.push({ category: h.category, rule })
    else hits.push(h)
  }
  return { hits, suppressions }
}

/**
 * DETERMINISTIC MULTILINGUAL CRISIS BACKSTOP.
 *
 * The English detectors run on normalize(), which strips every non-ASCII character —
 * so a crisis expressed in Chinese/Hindi/Arabic/Vietnamese/Spanish produces ZERO
 * deterministic hits and depends entirely on the (unvalidated) LLM classifier. This
 * adds a small, HIGH-PRECISION floor of the most explicit "I want to die / kill myself"
 * phrases in the app's non-English audience languages, matched on the RAW (non-stripped)
 * lowercased text. It only ever ADDS a crisis_concern hit (Lifeline floor); the classifier
 * still escalates to immediate_danger/000 when it fires alongside. It never suppresses.
 *
 * ⚠️ FIRST PASS — NEEDS NATIVE-SPEAKER + CLINICAL REVIEW before it is relied on as the
 * validated multilingual floor. Coverage is intentionally narrow (only unambiguous,
 * direct suicide/self-harm statements) to keep false-positives near zero; euphemism and
 * indirect distress in these languages still rely on the classifier.
 */
const MULTILINGUAL_CRISIS_PHRASES: string[] = [
  // Chinese (simplified + traditional)
  '我想死', '想死了', '我不想活', '不想活了', '不想活着', '我想自杀', '想自杀', '自杀', '自殺', '结束生命', '結束生命', '了结自己', '活不下去',
  // Hindi
  'मरना चाहता', 'मरना चाहती', 'मैं मरना चाहता', 'आत्महत्या', 'खुदकुशी', 'जीना नहीं चाहता', 'जीना नहीं चाहती', 'मर जाना चाहता',
  // Arabic
  'أريد أن أموت', 'أريد الموت', 'اريد ان اموت', 'الانتحار', 'أنتحر', 'سأنتحر', 'انتحر', 'لا أريد أن أعيش', 'لا اريد العيش',
  // Vietnamese
  'muốn chết', 'muon chet', 'tự tử', 'tu tu', 'tự sát', 'tu sat', 'không muốn sống', 'khong muon song', 'kết thúc cuộc đời',
  // Spanish
  'quiero morir', 'me quiero morir', 'quiero suicidarme', 'me quiero suicidar', 'suicidarme', 'quitarme la vida',
  'acabar con mi vida', 'no quiero vivir', 'no quiero seguir viviendo', 'me quiero matar',
]
export function detectMultilingualCrisis(text: string): DetectorHit[] {
  const raw = (text || '').toLowerCase()
  for (const phrase of MULTILINGUAL_CRISIS_PHRASES) {
    if (raw.includes(phrase)) return [{ category: 'crisis_concern', source: 'rules', reason: 'multilingual_crisis_lexicon' }]
  }
  return []
}

export function runRules(text: string, ctx: CoachContext): RulesResult {
  const n = normalize(text)
  const detectors = [
    detectCrisis, detectConcealedIntent, detectThirdPartyAcute, detectHarmToOthers, detectMedicalEmergency, detectOverdose, detectInjuryOverride,
    detectMedicalUrgent, detectPregnancy, detectMedicalCondition, detectDisorderedEating,
    detectRapidWeightLoss, detectMealPlan, detectSteroidsPED, detectPrescribedMedication,
    detectSupplementDosing, detectUnder18, detectUnsafeTraining, detectAiRelationship,
    detectOffTopic, detectCatchAll,
  ]
  const raw: DetectorHit[] = []
  for (const d of detectors) raw.push(...d(n))
  // NOTE: the rules `under_18` detector keys on EXPLICIT first-person age cues ("im 15",
  // "eighteenth birthday next month") — those must NEVER be DOB-suppressed, so scope() here runs
  // WITHOUT the adult flag. The server-DOB suppression applies ONLY to CLASSIFIER hits
  // (scopeClassifierHits), which is where the benign over-flagging comes from (audit SA-010).
  const scoped = scope(n, raw)
  // Multilingual crisis backstop runs on the RAW text (scoping/normalize strip non-ASCII), and is
  // appended AFTER scope() so the English scoping can never suppress a non-English crisis hit.
  scoped.hits.push(...detectMultilingualCrisis(text))
  return scoped
}

/**
 * Apply the SAME scoping to CLASSIFIER hits — the LLM over-flags the same third-party / historical /
 * negated / topical contexts, and the scoping guards (first-person present ALWAYS wins) keep it safe.
 * `ctx` enables the server-DOB `under_18` suppression (audit SA-010 FP-reduction); omitting it simply
 * skips that one rule (fail-open toward keeping the hit — never less safe).
 */
export function scopeClassifierHits(text: string, hits: DetectorHit[], ctx?: CoachContext): RulesResult {
  const n = normalize(text)
  const scoped = scope(n, hits, { adult: ctx ? isAdultCtx(ctx) : false })
  // Own-plan REVIEW override: the LLM over-flags "review my meal plan" / "is my meal plan balanced"
  // as `meal_plan`, which would refer the user away from the qualitative review the coach is meant to
  // give (owner decision). When the deterministic signals show a review of the user's OWN plan with no
  // creation verb and no numeric macro/calorie target, drop the classifier `meal_plan` hit. Real
  // creation/macros still trip detectMealPlan on the rules floor, so they are unaffected.
  if (isOwnPlanReview(n) && scoped.hits.some((h) => h.category === 'meal_plan')) {
    scoped.hits = scoped.hits.filter((h) => h.category !== 'meal_plan')
    scoped.suppressions.push({ category: 'meal_plan', rule: 'own_plan_review' })
  }
  return scoped
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

/* ------------------------------------------------------------------ */
/*  Option B: refer-by-default — the coach's on-topic allowlist        */
/* ------------------------------------------------------------------ */

/** Health / fitness / wellbeing vocabulary — an affirmatively on-topic coaching request. */
const FITNESS_TERMS = [
  'workout', 'work out', 'training', 'train', 'exercise', 'gym', 'lift', 'lifting', 'weight', 'weights',
  'squat', 'bench', 'deadlift', 'press', 'row', 'curl', 'pull up', 'push up', 'pullup', 'pushup', 'chin up',
  'cardio', 'run', 'running', 'jog', 'sprint', 'hiit', 'conditioning', 'program', 'programme', 'routine',
  'split', 'plan', 'session', 'rep', 'reps', 'set', 'sets', 'superset', 'muscle', 'strength', 'hypertrophy',
  'bulk', 'bulking', 'cut', 'cutting', 'lean', 'physique', 'abs', 'core', 'legs', 'leg day', 'chest', 'back',
  'shoulders', 'arms', 'bicep', 'tricep', 'glute', 'hamstring', 'quad', 'calf', 'calves', 'warm up', 'warmup',
  'cooldown', 'stretch', 'mobility', 'flexibility', 'recovery', 'rest day', 'deload', 'progress', 'progression',
  'pb', '1rm', 'one rep max', 'form', 'technique', 'tempo', 'rir', 'rpe', 'volume', 'frequency', 'motiv',
  'dumbbell', 'barbell', 'kettlebell', 'machine', 'cable', 'band', 'bodyweight', 'treadmill', 'steps', 'walk',
  'swim', 'swimming', 'cycle', 'cycling', 'bike', 'yoga', 'pilates', 'fitness', 'stronger', 'tone', 'toned',
  // nutrition / recovery in scope
  'protein', 'carb', 'carbs', 'calorie', 'calories', 'macro', 'macros', 'meal', 'meals', 'nutrition', 'eat',
  'eating', 'food', 'snack', 'hydration', 'water', 'creatine', 'preworkout', 'post workout', 'soreness',
  'sore', 'doms', 'sleep', 'fuel', 'recipe', 'diet',
  // Bounded general health / wellbeing education (not diagnosis or treatment).
  'wellbeing', 'wellness', 'healthy', 'health', 'stress', 'stressed', 'habit', 'habits', 'routine',
  'energy', 'fatigue', 'focus', 'confidence', 'gym anxiety', 'mental wellbeing', 'physical activity',
  'anatomy', 'adaptation', 'detraining', 'heart health', 'bone health', 'posture', 'sedentary',
  // First-class coach modes/actions. These are bounded by the deterministic action schema downstream.
  'exam mode', 'budget eats', 'planned absence',
  // Scheduling frequency, planned time away, consistency, supplements and alcohol are all on-topic coach
  // conversations (previously bounced as off-topic). Adding them only relaxes the off-topic net; a real
  // safety category is still decided first and is never downgraded by an on-topic term.
  'days a week', 'times a week', 'days per week', 'day a week',
  'time off', 'days off', 'week off', 'away', 'holiday', 'vacation', 'travelling', 'traveling', 'going home', 'trip',
  'skipping', 'skip', 'missing sessions', 'missed sessions', 'fell off', 'falling off', 'consistency', 'stick to',
  'supplement', 'supplements', 'bcaa', 'bcaas', 'protein powder', 'multivitamin', 'fish oil',
  'alcohol', 'drinking', 'beer', 'wine',
  // Training fatigue / recovery vocabulary: a deload or rest conversation, not a crisis (the crisis
  // classifier over-flags these; a scoped fatigue suppressor removes that false positive).
  'exhausted', 'run down', 'rundown', 'worn out', 'wrecked', 'drained', 'shattered', 'sluggish',
  'no energy', 'everything feels heavy', 'feels heavy', 'lifts feel heavy', 'feeling flat', 'running on empty',
  // 500-PROMPT EVAL (2026-08-17): a broad batch of ordinary training / technique / programming / nutrition /
  // equipment / recovery / beginner vocabulary the classifier was bouncing as "off topic". These ONLY relax
  // the off-topic net (a real safety category is decided first and never downgraded by an on-topic term).
  // Curated to avoid short substrings that could match distress words (e.g. no bare "arm" -> "harm").
  // programming / concepts
  'amrap', 'emom', 'drop set', 'dropset', 'to failure', 'progressive overload', 'compound', 'isolation',
  'unilateral', 'range of motion', 'eccentric', 'concentric', 'partial rep', 'partial reps', 'full body',
  'upper lower', 'push pull legs', 'muscle confusion', 'junk volume', 'time under tension', 'rest between',
  'rest period', 'between sets', 'how much rest', 'rest too long', 'periodis', 'periodiz', 'overtrain',
  'over training', 'overreach', 'plateau', 'stalled', 'stalling',
  // recovery / modalities
  'foam roll', 'foam roller', 'sauna', 'ice bath', 'cold shower', 'cold plunge', 'massage', 'active recovery',
  'doing too much', 'too much volume', 'overdoing',
  // exercises / technique
  'lats', 'lat pulldown', 'pulldown', 'pull down', 'lunge', 'lunges', 'lateral raise', 'side raise',
  'chest fly', 'cable fly', 'flyes', 'triceps extension', 'leg extension', 'pushdown', 'dips', 'plank',
  'crunch', 'hip thrust', 'split squat', 'romanian deadlift', 'mixed grip', 'grip strength', 'my grip',
  // accessories / equipment
  'belt', 'lifting belt', 'wrist wrap', 'wrist wraps', 'lifting straps', 'knee sleeve', 'knee sleeves', 'chalk',
  'equipment', 'no equipment',
  // body parts (safe forms only)
  'forearm', 'forearms', 'traps', 'delts', 'left arm', 'right arm', 'weaker', 'imbalance', 'lagging', 'one side',
  // nutrition education
  'fats', 'body fat', 'fat loss', 'healthy fats', 'dietary fat', 'salt', 'sodium', 'sugar', 'fibre', 'fiber',
  'vitamin', 'multivitamin', 'electrolyte', 'electrolytes', 'caffeine', 'beta alanine', 'beta-alanine', 'whey',
  'casein', 'fat burner', 'fat burners', 'cheat meal', 'takeaway', 'breakfast', 'vegan', 'vegetarian', 'fasted', 'fasting',
  // beginner / general coaching
  'beginner', 'beginners', 'novice', 'personal trainer', 'biggest mistake', 'what to track', 'track my',
  'tracking', 'first session', 'first time at the gym', 'never been to a gym', 'starting out', 'get started',
  'inconsistent', 'restart', 'back into it', 'off track', 'fell off', 'feel weak', 'feeling weak',
  // sport / activity (specific, to avoid substring traps)
  'footy', 'football', 'basketball', 'soccer', 'tennis', 'pickleball', 'climbing', 'martial arts', 'dance class',
  // time available
  'an hour', 'one hour', 'half hour', 'hour today', 'quick workout', 'something quick',
]

/** Very short in-flow affirmations — allowed only when the whole message is a brief continuation. */
const CONTINUITY = [
  'yes', 'yeah', 'yep', 'yup', 'ok', 'okay', 'sure', 'thanks', 'thank you', 'cheers', 'sounds good',
  'got it', 'cool', 'great', 'perfect', 'awesome', 'continue', 'go on', 'next', 'please', 'more',
]

/**
 * Bounded on-topic INTENT PATTERNS (final plan Phase 1 — "replace bare allowlist expansion with intent
 * patterns"). Emotionally-loaded but benign coaching turns whose head word ("exam", "scale", "goal") is
 * deliberately NOT a bare allowlist term (adding it alone would over-match). Each requires a training /
 * recovery / progress co-occurrence, so the message is affirmatively about coaching, not the head word
 * in isolation. Generalises to phrasing, not to a specific sentence.
 */
function matchesFitnessIntentPattern(n: Norm): boolean {
  // Set x rep notation ("3 x 10", "5x5", "4 x 8") is unambiguously a training question.
  if (hasRe(n, /\b\d{1,3}\s?x\s?\d{1,3}\b/)) return true
  // exams / study / a busy academic period AND its effect on training, time or recovery.
  const examContext = has(n, 'exam', 'exams', 'study', 'studying', 'assignment', 'deadline', 'deadlines',
    'finals', 'midterm', 'midterms', 'placement', 'thesis')
  const trainingBearing = has(n, 'train', 'training', 'workout', 'work out', 'session', 'sessions', 'gym',
    'lift', 'recovery', 'recover', 'rest', 'sleep', 'schedule', 'time', 'busy', 'fit it in', 'fit in',
    'maintain', 'maintenance', 'keep up', 'routine', 'program', 'energy', 'motivation')
  if (examContext && trainingBearing) return true
  // the scale / bodyweight AND a progress or tracking bearing.
  const scaleContext = has(n, 'scale', 'the scales', 'weigh in', 'weigh-in', 'weighed', 'weighing', 'bodyweight')
  const progressBearing = has(n, 'bodyweight', 'progress', 'trend', 'trending', 'track', 'tracking',
    'going up', 'going down', 'gone up', 'gone down', 'went up', 'went down', 'plateau', 'dropped', 'gained',
    'losing', 'lost', 'up or down', 'week', 'weeks', 'lately', 'the same', 'thing to watch')
  if (scaleContext && progressBearing) return true
  // a stated goal / results question AND training / program / progress.
  const goalContext = has(n, 'my goal', 'the goal', 'goals', 'target', 'on track', 'on target', 'results',
    'see results', 'making progress')
  const goalBearing = has(n, 'train', 'training', 'workout', 'program', 'programme', 'progress', 'plan',
    'track', 'reach', 'hit', 'toward', 'towards', 'get to', 'am i', 'making progress', 'how long until',
    'see results', 'until i see', 'guarantee', 'guaranteed', 'promise', 'transform', 'definitely')
  if (goalContext && goalBearing) return true
  // time available AND a "what do I do / session" bearing — a session-length question in a coach thread.
  const timeContext = hasRe(n, /\b\d{1,3}\s?(min|mins|minute|minutes)\b/) || has(n, 'half an hour', 'an hour', 'one hour', 'quick session', 'short session', 'not much time', 'no time', 'limited time')
  const sessionBearing = has(n, 'what should i do', 'what do i do', 'what can i do', 'session', 'train', 'training',
    'workout', 'work out', 'today', 'gym', 'squeeze in', 'fit in', 'give me', 'most important', 'things to do',
    'prioritise', 'prioritize', 'priority', 'something quick')
  if (timeContext && sessionBearing) return true
  return false
}

/**
 * Option B "refer by default": the coach only free-coaches a message that is affirmatively an on-topic
 * training/nutrition request (or a short in-flow affirmation). Everything else — off-topic, ambiguous,
 * or a distress disclosure that slipped every safety detector — is NOT coached; the router routes it to
 * a gentle referral instead. This inverts the old default (no-signal ⇒ coach) to (no-fitness-intent ⇒
 * refer), so an undetected crisis can never be freely coached. The short-message guard keeps a smuggled
 * euphemism ("ok i'll do it tonight") from passing as a bare affirmation — that would still be scored by
 * the safety detectors upstream, and if it reaches here it is too long to be treated as continuity.
 */
/**
 * A training-SCHEDULE edit: a weekday or schedule noun together with a rearrange/move/set verb, e.g.
 * "change monday to saturday", "move my leg day to friday", "swap my training days around", "shift
 * saturday to sunday". This is affirmatively about the user's own training schedule, so refer-by-default
 * must treat it as on-topic rather than bouncing it as off-topic. Word-boundaried regexes are used on
 * purpose (not `has`, which substring-matches and would trip on money/satisfied/sunset); only full
 * weekday names are accepted so a bare "sat"/"sun" cannot false-match. A euphemistic crisis does not
 * take this weekday-plus-rearrange shape, so widening here does not weaken the crisis backstop.
 */
export function isScheduleEditIntent(text: string): boolean {
  const n = normalize(text)
  const weekday = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/
  const scheduleNoun = /\b(training|workout|gym|rest)\s+days?\b|\b(training\s+week|session|sessions|schedule|split|program|programme|routine)\b/
  const editVerb = /\b(move|moved|moving|change|changed|changing|swap|swapped|switch|switched|shift|shifted|reschedul\w*|rearrang\w*|reorder|shuffle)\b/
  const hasDayOrSchedule = hasRe(n, weekday) || hasRe(n, scheduleNoun)
  return hasDayOrSchedule && hasRe(n, editVerb)
}

export function isOnTopicFitness(text: string): boolean {
  const n = normalize(text)
  if (has(n, ...FITNESS_TERMS)) return true
  if (matchesFitnessIntentPattern(n)) return true
  if (isScheduleEditIntent(text)) return true
  const words = n.p.trim().split(/\s+/).filter(Boolean)
  // Word-boundaried so a continuity token can't match INSIDE another word ("ok" in "joke").
  return words.length <= 4 && CONTINUITY.some((c) => new RegExp(`\\b${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(n.p))
}
