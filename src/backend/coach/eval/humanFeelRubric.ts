/**
 * Blind human-feel rubric (final plan §8). The seven dimensions a reviewer scores for each ordinary
 * reply, blind to whether it came from the live path or the fallback. A reply "passes" the plan's
 * Phase 3 / Phase 6 gate when it scores 6/7 or better; the target is ≥85% of ordinary replies passing.
 *
 * This module is DATA + scoring helpers only. The scoring itself is a human judgement made against the
 * real production-equivalent model output — it cannot be automated here (see docs/COACH_HUMAN_FEEL_EVAL.md).
 */

export interface RubricDimension {
  key: string
  label: string
  question: string
}

export const HUMAN_FEEL_RUBRIC: RubricDimension[] = [
  { key: 'listened', label: 'Listened', question: 'Did it use the important detail the user actually gave?' },
  { key: 'relevant', label: 'Relevant', question: 'Did it answer the actual question?' },
  { key: 'natural', label: 'Natural', question: 'Could a good coach plausibly phrase it this way?' },
  { key: 'personal', label: 'Personal', question: 'Did context improve the answer without becoming intrusive?' },
  { key: 'concise', label: 'Concise', question: 'Did every sentence earn its place?' },
  { key: 'continuous', label: 'Continuous', question: 'Did it make the next turn easy?' },
  { key: 'trustworthy', label: 'Trustworthy', question: 'Did it avoid fake experience, false certainty and identity deception?' },
]

/** The pass threshold: at least this many of the seven dimensions must be satisfied. */
export const RUBRIC_PASS_THRESHOLD = 6

/** Fraction of ordinary replies that must pass to clear the human-feel gate. */
export const HUMAN_FEEL_TARGET = 0.85

/** Score one reply given which dimensions a reviewer marked satisfied. */
export function scoreReply(satisfied: Partial<Record<string, boolean>>): { score: number; pass: boolean } {
  const score = HUMAN_FEEL_RUBRIC.reduce((n, d) => n + (satisfied[d.key] ? 1 : 0), 0)
  return { score, pass: score >= RUBRIC_PASS_THRESHOLD }
}

/** Length target for an ordinary visible reply (words). Safety/referral responses are exempt. */
export const ORDINARY_REPLY_MIN_WORDS = 30
export const ORDINARY_REPLY_MAX_WORDS = 70

export function withinOrdinaryLength(reply: string): boolean {
  const words = reply.trim().split(/\s+/).filter(Boolean).length
  return words >= ORDINARY_REPLY_MIN_WORDS && words <= ORDINARY_REPLY_MAX_WORDS
}
