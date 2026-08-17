/**
 * Benign conversational-intent layer (final plan Phase 1). ADDITIVE ONLY.
 *
 * This is consulted by the router EXCLUSIVELY for a decision that is already `allow` — i.e. the
 * deterministic rules, the classifier, the persistent safety state, the escalations, the emergency
 * floor and the fail-safe have all run and NOTHING flagged the message. It can NEVER downgrade a
 * safety decision (the router only calls it on `allow`), never runs before safety, and returns only a
 * small content-free enum.
 *
 * Its whole job is to stop an ordinary human turn — a greeting, a "what can you do?", a vague "I feel
 * off", a mild relational remark, or an in-flow follow-up — from being bounced to the off-topic
 * referral by refer-by-default, so the coach answers it naturally instead of reciting a capability
 * menu. Explicitly out-of-lane requests (homework, politics, jokes, the weather) are caught UPSTREAM by
 * `detectOffTopic` and never reach here. Affirmatively on-topic training/nutrition requests are caught
 * by `isOnTopicFitness` in the router BEFORE this runs, so a fitness message keyed as `coaching` keeps
 * its full training context even when it opens with "hey".
 *
 * Matching is deterministic and phrase-based (never bare-keyword) exactly like `rules.ts`.
 */

import type { ConversationalIntent } from './types'
import { normalize, type Norm } from './rules'

const has = (n: Norm, ...frags: string[]): boolean =>
  frags.some((f) => n.p.includes(` ${f} `) || n.p.includes(f))

const hasRe = (n: Norm, re: RegExp): boolean => re.test(n.p)

const wordCount = (n: Norm): number => n.p.trim().split(/\s+/).filter(Boolean).length

/**
 * A mild relational / bond remark that isn't a hard identity or dependence claim (those are caught by
 * `detectAiRelationship` and routed to the fixed, honest boundary reply). Here we only tag the softer
 * "do you like chatting with me / are we friends / you're the best coach" turns so the reply stays warm
 * but honest instead of being referred as off-topic.
 */
function isRelational(n: Norm): boolean {
  return has(n,
    'do you like talking to me', 'do you like chatting', 'do you enjoy talking to me',
    'are we friends', 'are we mates', 'is this a friendship', 'do you actually care',
    'you re the best', 'youre the best', 'best coach', 'i appreciate you', 'appreciate you',
    'you re amazing', 'youre amazing', 'you get me', 'you understand me',
    // Gratitude and warm sign-offs to the coach: respond warmly, never bounce as off-topic.
    'thanks coach', 'thank you coach', 'thanks so much', 'thank you so much', 'thanks a lot',
    'thanks for', 'thank you for', 'cheers coach', 'appreciate it', 'appreciate the help',
    'you ve been a big help', 'youve been a big help', 'this week actually felt good',
    'this week felt good', 'good week this week')
}

/**
 * A capability / "what is this / how does it work / help" question — the user asking what the coach can
 * do, not asking for coaching itself. A fitness capability question ("what can you do for my squat")
 * is already keyed as `coaching` by `isOnTopicFitness` before this runs.
 */
function isCapability(n: Norm): boolean {
  return has(n,
    'what can you do', 'what can you help', 'what do you do', 'what can you help me with',
    'what can i ask', 'what can i ask you', 'what should i ask', 'how can you help',
    'how does this work', 'how do you work', 'how does the app work', 'what is this',
    'what are you for', 'what do you help with', 'what can you help with', 'can you help me',
    'what else can you do', 'what are my options', 'give me some ideas', 'what can we do',
    'not sure what to ask', 'dont know what to ask', 'not sure where to start', 'where do i start',
    'what should i be doing') ||
    // bare "help" / "help me" with nothing else on the line
    (wordCount(n) <= 3 && has(n, 'help', 'help me', 'help please', 'i need help'))
}

/** An opening greeting or small-talk pleasantry, greeting-dominant (fitness openers are `coaching`). */
function isGreeting(n: Norm): boolean {
  return has(n,
    'hello', 'hey there', 'hey coach', 'hiya', 'heya', 'howdy', 'gday', 'g day', 'yo coach',
    'good morning', 'good afternoon', 'good evening', 'morning coach',
    'how are you', 'how r u', 'how are ya', 'how you doing', 'how are you doing', 'how s it going',
    'hows it going', 'how is it going', 'what s up', 'whats up', 'sup coach', 'long time no see',
    'nice to meet you', 'good to see you') ||
    // very short bare greetings ("hi", "hey", "yo", "sup") — guarded to short lines so
    // "hi, my knee is killing me" (which safety already handled) can't slip through as a greeting.
    (wordCount(n) <= 3 && (
      hasRe(n, /\b(hi|hey|hiya|heya|yo|sup|hullo|hi there)\b/) ||
      has(n, 'morning', 'afternoon', 'evening')))
}

/**
 * A vague, benign wellbeing turn ("I feel off / not myself / a bit flat"). We only ever reach this when
 * the deterministic safety floor AND the real classifier both returned safe, so this is not a crisis —
 * it's the "clarify calmly, once" case from the plan. The reply guidance (operatingRules turn hint)
 * asks exactly one gentle question before assuming anything.
 */
function isWellbeingAmbiguous(n: Norm): boolean {
  return has(n,
    'i feel off', 'feel off', 'feeling off', 'bit off', 'a bit off', 'off today', 'feeling meh',
    'feel meh', 'i feel weird', 'feel weird', 'feeling weird', 'not feeling right', 'not right today',
    'not feeling myself', 'not myself', 'feeling flat', 'feel flat', 'feeling rough', 'feel rough',
    'feeling low', 'feel low', 'a bit low', 'bit low', 'feeling down', 'feel down', 'feeling blah',
    'out of it', 'not 100', 'not one hundred percent', 'feeling unsure', 'i dunno whats wrong',
    'something feels off', 'somethings off', 'not feeling it', 'just not feeling it', 'a bit flat',
    'bit flat', 'not feeling great', 'kind of off', 'kinda off',
    // In-remit motivation / stress / low-energy check-ins. These are squarely a coach's job
    // (motivation, stress, recovery) and reach here only when the safety floor already cleared
    // the turn, so engage with a gentle question instead of a cold off-topic deflection.
    'no motivation', 'lost motivation', 'lost my motivation', 'unmotivated', 'demotivated',
    'cant be bothered', 'cant get motivated', 'cant get going', 'no energy', 'zero energy',
    'so tired lately', 'always tired', 'feeling lazy', 'being lazy', 'in a rut', 'in a slump',
    'no discipline', 'keep procrastinating', 'cant focus', 'stressed', 'stressed out', 'so stressed',
    'overwhelmed', 'burnt out', 'burned out', 'feeling burnt out', 'exam stress', 'exams are stressing')
}

/**
 * A pure in-flow continuation or reference to a prior option ("go on", "the second one", "tell me
 * more"). Short affirmations ("yes", "thanks", "ok") are already treated as on-topic by
 * `isOnTopicFitness`, so this catches the follow-up references that aren't bare affirmations.
 */
function isContinuation(n: Norm): boolean {
  if (wordCount(n) > 6) return false
  return has(n,
    'go on', 'keep going', 'tell me more', 'more please', 'and then', 'what next', 'whats next',
    'the first one', 'the second one', 'the third one', 'first option', 'second option', 'that one',
    'the other one', 'either', 'both', 'which one', 'like what', 'such as', 'for example', 'go ahead')
}

/**
 * Classify a benign conversational intent for an ALREADY-`allow` message. Returns `'none'` when no
 * benign intent is recognised (the router then refers by default if the message isn't on-topic
 * fitness). Order encodes priority: a relational/capability/wellbeing signal is more specific than a
 * bare greeting, which is more specific than a generic continuation.
 */
export function classifyConversationalIntent(text: string): Exclude<ConversationalIntent, 'coaching'> {
  const n = normalize(text)
  if (isRelational(n)) return 'relational'
  if (isCapability(n)) return 'capability'
  if (isWellbeingAmbiguous(n)) return 'wellbeing_ambiguous'
  if (isGreeting(n)) return 'greeting'
  if (isContinuation(n)) return 'continuation'
  return 'none'
}
