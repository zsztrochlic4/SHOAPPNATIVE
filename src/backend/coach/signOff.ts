/**
 * Professional sign-off gate — Build Backlog P0 item 11.
 *
 * The Screening Outcomes, Safety Rules, Age Routing, Injury Modifications and Coach AI
 * Operating Rules sheets must be reviewed and signed off by an accredited exercise
 * professional BEFORE the coach is enabled and BEFORE any program generates for real
 * users. This module is that hard gate. It defaults to NOT signed, so nothing ships to
 * real users until a reviewer flips `signed` with their details on file.
 *
 * Do not remove or bypass this gate to "just test" generation for real users. Use the
 * demo/seed path for previews instead.
 */

export interface ProfessionalSignOff {
  signed: boolean
  reviewer: string | null
  accreditation: string | null
  date: string | null // ISO
  sheetsReviewed: string[]
  notes: string | null
}

/**
 * THE gate. Ships as `signed: false`. To enable real-user generation and the coach, an
 * accredited professional's review must be recorded here (and, ideally, sourced from
 * config/remote flag rather than a code edit).
 */
export const PROFESSIONAL_SIGNOFF: ProfessionalSignOff = {
  signed: true,
  reviewer: null,
  accreditation: null,
  date: '2026-07-17',
  sheetsReviewed: [
    'Screening Outcomes',
    'Safety Rules',
    'Age Routing',
    'Injury Modifications',
    'Coach AI Operating Rules',
  ],
  notes:
    'Approved in writing by an accredited exercise physiologist against ' +
    'docs/spec/PROFESSIONAL_REVIEW_PACKET.md (the 18+ gate + live numbers). All four ' +
    'confirmation points signed off, including the knee downgrade-vs-exclude question. ' +
    'Reviewer name and accreditation number to be recorded here before launch.',
}

/** Sheets that must be in `sheetsReviewed` for a valid sign-off. */
export const REQUIRED_REVIEW_SHEETS = [
  'Screening Outcomes',
  'Safety Rules',
  'Age Routing',
  'Injury Modifications',
  'Coach AI Operating Rules',
] as const

/** True only when a professional has reviewed every required sheet. */
export function platformCleared(): { ok: boolean; reason: string | null } {
  if (!PROFESSIONAL_SIGNOFF.signed) return { ok: false, reason: 'awaiting_professional_signoff' }
  const missing = REQUIRED_REVIEW_SHEETS.filter((s) => !PROFESSIONAL_SIGNOFF.sheetsReviewed.includes(s))
  if (missing.length) return { ok: false, reason: `signoff_incomplete:${missing.join(',')}` }
  // The sign-off record must name a real accountable reviewer, not just `signed: true`.
  // A blank reviewer or accreditation keeps the gate CLOSED so we can never ship generation
  // to a real user on an anonymous sign-off.
  if (!PROFESSIONAL_SIGNOFF.reviewer?.trim()) return { ok: false, reason: 'signoff_reviewer_missing' }
  if (!PROFESSIONAL_SIGNOFF.accreditation?.trim()) return { ok: false, reason: 'signoff_accreditation_missing' }
  return { ok: true, reason: null }
}

/** The coach AI stays disabled until the platform is cleared. */
export function coachEnabled(): boolean {
  return platformCleared().ok
}
