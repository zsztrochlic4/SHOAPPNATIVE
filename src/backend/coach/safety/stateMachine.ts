/**
 * Deterministic safety STATE MACHINE (spec §2 persistence table, §14, §18).
 *
 * A safety state is NEVER cleared by the coaching model, and never by a bare retraction or
 * minimisation. Some states (injury, pregnancy, concussion, medical condition, under-18) persist
 * ACROSS sessions until an appropriate resolution; crisis persists for the conversation. A
 * genuine contextual correction may be re-evaluated here (not by the coaching model) and may
 * downgrade a state only where it genuinely resolves the concern.
 */

import type { CoachContext, DetectorHit, PersistentState, SafetyDecision, SafetySession } from './types'
import { PERSISTENT_FOR } from './types'
import { engineExcludedExerciseIds } from './engineBridge'
import { normalize, hasActiveCrisisSignal } from './rules'

const p = (text: string) => normalize(text).p

const BARE_RETRACTION = ['jk', 'j k', 'just kidding', 'only kidding', 'im kidding', 'i m kidding', 'kidding',
  'ignore that', 'ignore what i said', 'forget it', 'forget what i said', 'nvm', 'never mind', 'im fine',
  'i m fine', 'im fine now', 'i m fine now', 'just give me the workout', 'just give me my workout',
  'just build the', 'just add the', 'just add squats', 'stop overreacting', 'i was joking', 'im joking', 'i m joking']

const GENUINE_CORRECTION = ['i meant', 'i mean my', 'i mean because', 'i meant because', 'i mean about',
  'i meant about', 'not me', 'talking about my', 'that was last year', 'was last year', 'it s fine now',
  'its fine now', 'was a typo', 'it was a typo',
  'meant my roommate', 'meant my friend', 'about my friend', 'about my roommate', 'about my mate',
  // Quotation class — the earlier line was a quote/lyric, not a personal statement.
  'i was quoting', 'was quoting', 'a quote', 'a lyric', 'lyrics', 'from a song', 'from a book',
  'from a movie', 'from a poem', 'a line from', 'reciting',
  // Figurative / clarification class — the earlier line was figurative, not literal.
  'figure of speech', 'being figurative', 'being dramatic', 'not literally', 'didnt mean it literally',
  'didnt mean that literally', 'exaggerating', 'that came out wrong', 'not what i meant']

/**
 * A correction may only be treated as GENUINE (and so allowed to re-open / downgrade a state) when
 * it is contextually CONSISTENT — i.e. the same message does not still assert a live crisis. The
 * ROUTER makes this call on full context (spec §2), never the coaching model, and never a bare token
 * match: "I was quoting a song" with no live signal may re-evaluate; "I'm quoting… I'm going to do
 * it tonight" may not. A bare retraction / minimisation is handled separately and never downgrades.
 */
export function isGenuineCorrection(text: string): boolean {
  if (hasActiveCrisisSignal(text)) return false // contradicted by a concurrent signal → not genuine
  return GENUINE_CORRECTION.some((f) => p(text).includes(f))
}

/**
 * A bare retraction / minimisation ("forget what I said", "I'm fine", "just give me the workout").
 * By the state-resolution rule it NEVER clears an active protective state — it is not a genuine,
 * credible, contextually-consistent correction (spec §2/§14). Recognising it explicitly lets the
 * router log the distinction; the safety outcome (state persists) is the default either way.
 */
export function isBareRetraction(text: string): boolean {
  const t = p(text)
  return BARE_RETRACTION.some((f) => t.includes(f)) && !isGenuineCorrection(text)
}

/**
 * Re-evaluate a genuine contextual correction (spec §2/§18). Mutates the session to downgrade a
 * state only where the correction genuinely resolves it, and returns any replacement hits (e.g.
 * a first-person crisis that is actually about a roommate becomes a third-party case).
 *
 * Guarded by `isGenuineCorrection`, so a message that still carries a live crisis signal is NEVER
 * downgraded here — most-protective wins on full context, and the state survives to the next turn.
 */
export function correctionAdjust(session: SafetySession, text: string): DetectorHit[] {
  if (!isGenuineCorrection(text)) return []
  const t = p(text)
  const out: DetectorHit[] = []
  // "I meant my roommate, not me" → not the user; still a third-party safety case.
  if ((t.includes('not me') || t.includes('my roommate') || t.includes('my friend') || t.includes('my mate'))) {
    session.active.delete('crisis'); session.carriedOver.delete('crisis')
    out.push({ category: 'third_party_crisis', source: 'state', reason: 'crisis_reattributed_third_party' })
  }
  // "that injury was last year, it's fine now" → resolved; clear the injury/condition hold.
  if (t.includes('last year') || t.includes('it s fine now') || t.includes('its fine now') || t.includes('was a typo')) {
    session.active.delete('injury'); session.carriedOver.delete('injury')
    session.active.delete('medical_condition'); session.carriedOver.delete('medical_condition')
  }
  return out
}

/** Hits contributed by active / carried-over persistent states (spec §2 persistence). */
export function stateHits(session: SafetySession, text: string, ctx: CoachContext): DetectorHit[] {
  const t = p(text)
  const active = new Set<PersistentState>([...session.active, ...session.carriedOver])
  const out: DetectorHit[] = []

  // Crisis: not resumed by a bare retraction / minimisation (spec §2/§18 retraction rule).
  if (active.has('crisis') && !isGenuineCorrection(text)) {
    out.push({ category: 'crisis_concern', source: 'state', reason: 'crisis_state_persists' })
  }
  // Overdose / medical emergency (Jack §2): an acute disclosure must NOT be cleared by a later bare
  // minimisation (a passing "I'm fine, ignore that"). It persists on ANY follow-up until a genuine
  // correction on full context clears it — exactly the crisis rule. The overdose/emergency escalation
  // in the router then re-derives the 000-vs-Poisons tier from the current turn's danger signals.
  if (active.has('overdose') && !isGenuineCorrection(text)) {
    out.push({ category: 'overdose_poisoning', source: 'state', reason: 'overdose_state_persists' })
  }
  if (active.has('emergency') && !isGenuineCorrection(text)) {
    out.push({ category: 'medical_emergency', source: 'state', reason: 'emergency_state_persists' })
  }
  // Under-18: coach remains unavailable until age eligibility is resolved (cross-session).
  if (active.has('under_18')) out.push({ category: 'under_18', source: 'state', reason: 'under18_state_persists' })

  // Injury: a request that would load an engine-excluded area is still declined (cross-session).
  if (active.has('injury')) {
    const loads = /\b(squat|deadlift|bench|run|running|lift|lifting|leg day|lower body|train|program|add)\b/.test(t)
    // Only enforce where the engine actually excludes something for this user, or the message loads.
    if (loads || engineExcludedExerciseIds(ctx).size > 0) {
      out.push({ category: 'injury_override', source: 'state', reason: 'injury_state_persists' })
    }
  }
  if (active.has('pregnancy') && /\b(program|workout|train|lifting|running|session|routine|heavy)\b/.test(t)) {
    out.push({ category: 'pregnancy', source: 'state', reason: 'pregnancy_state_persists' })
  }
  if (active.has('concussion') && /\b(train|workout|session|return|play|program|tomorrow)\b/.test(t)) {
    out.push({ category: 'medical_urgent', source: 'state', reason: 'concussion_state_persists' })
  }
  if (active.has('disordered_eating') && /\b(eat|food|calorie|calories|macro|macros|diet|weight|meal|nutrition)\b/.test(t)) {
    out.push({ category: 'disordered_eating', source: 'state', reason: 'de_state_persists' })
  }
  if (active.has('medical_condition') && /\b(program|workout|train|hiit|session|routine|heart rate|zones|intensity)\b/.test(t)) {
    out.push({ category: 'medical_condition', source: 'state', reason: 'condition_state_persists' })
  }
  return out
}

/** Persist the state implied by an enforced decision (spec §2). Coaching never clears these. */
export function applyDecision(session: SafetySession, decision: SafetyDecision): void {
  const st = PERSISTENT_FOR[decision.category]
  if (st) session.active.add(st)
  if (decision.reason.includes('concussion')) session.active.add('concussion')
  session.lastDecision = decision
}
