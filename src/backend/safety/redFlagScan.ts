/**
 * Free-text health red-flag scan (CC06) — HARD safety support.
 *
 * Source of truth: workbook "Screening Outcomes" (free-text scan) + Coach AI Operating
 * Rules + Safety Rule S05. The optional "anything else we should know?" box is scanned
 * BEFORE it is treated as harmless: if it mentions a cardiac, neurological, respiratory
 * or metabolic condition, pregnancy, recent surgery, or medical-advice language, the user
 * is routed to REQUIRE_PROFESSIONAL_CLEARANCE (via evaluateScreening's `redFlag` input) and
 * no program generates. This is a coarse keyword net, deliberately biased toward catching;
 * it never a substitute for the seven structured questions.
 *
 * Deterministic and side-effect-free.
 */

// Leading word-boundary + stem (no trailing boundary) so a stem like "pregnan" or
// "cardi" still matches "pregnant" / "cardiologist". A coarse net, deliberately biased
// toward catching — false positives just prompt a professional check, which is safe.
const RED_FLAG_PATTERNS: { category: string; re: RegExp }[] = [
  { category: 'cardiac', re: /\b(heart|cardi|angina|chest pain|palpitation|arrhythmia|murmur|stent|bypass|pacemaker|blood pressure|hypertens)/i },
  { category: 'neurological', re: /(\bstroke|\bseizure|\bepilep|\bfaint|\bblack ?out|\bpassed out|\bconcussion|\bnumbness|\btingling|\bmultiple sclerosis|\bms\b|\bneurolog)/i },
  { category: 'respiratory', re: /(\basthma|\bcopd|\bbreathless|short(ness)? of breath|can'?t breathe|\binhaler|\blung)/i },
  { category: 'metabolic', re: /(\bdiabet|\binsulin|\bthyroid|\bkidney|\brenal|\bliver)/i },
  { category: 'pregnancy', re: /(\bpregnan|\bexpecting\b|\btrimester|\bpostpartum|gave birth|c-?section)/i },
  { category: 'surgery', re: /(\bsurgery|\boperation|post-?op|\bacl\b|\bmeniscus|\bhernia|recently had)/i },
  { category: 'medical_advice', re: /(my (doctor|gp|physio|surgeon|specialist|cardiologist|consultant)|i was (told|advised)|advised (not|against)|medical (advice|condition)|on medication|\bprescribed|told not to)/i },
]

export interface RedFlagResult {
  flagged: boolean
  categories: string[]
}

/** Scan free text; returns whether it trips any red-flag category, and which. */
export function scanRedFlags(text: string | null | undefined): RedFlagResult {
  const t = (text ?? '').trim()
  if (!t) return { flagged: false, categories: [] }
  const categories = RED_FLAG_PATTERNS.filter((p) => p.re.test(t)).map((p) => p.category)
  return { flagged: categories.length > 0, categories }
}

/** Convenience boolean for the screening `redFlag` input. */
export function hasRedFlag(text: string | null | undefined): boolean {
  return scanRedFlags(text).flagged
}
