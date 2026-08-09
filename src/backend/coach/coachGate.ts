/**
 * Coach availability gate — a HARD, default-OFF switch for the in-app coach.
 *
 * The coach stays OFF until it has PASSED ITS OWN AUTOMATED SAFETY HOLDOUT (crisis /
 * self-harm / eating-disorder routing, zero critical misses — see below), AND Firebase
 * App Check is configured to protect the AI endpoint from abuse. This covers BOTH the
 * live AI chat and its on-device rules fallback: when the coach is off, neither answers —
 * the UI shows a "coming soon" state instead.
 *
 * This is deliberately INDEPENDENT of the workout `PROFESSIONAL_SIGNOFF` (see
 * signOff.ts). Enabling the workout generator must never enable the coach; the coach
 * is not part of that launch and gets reviewed and switched on separately.
 *
 * DISABLED 2026-08-09 (owner decision — launch reconciliation). The coach stays OFF for
 * launch. Although the automated critical-safety holdout passed (see history below), the
 * owner's stated launch gate also requires (a) the independent §23 professional/clinical
 * reviews and (b) Firebase App Check enforcement — BOTH still outstanding. Until those land,
 * the coach does not ship, and every record (this file, docs/COACH_RELEASE_STATE.md,
 * src/backend/coach/safety/STATUS.md, docs/DATA_SAFETY.md, docs/APP_STORE.md, and the
 * pre-launch sign-off packet) states DISABLED consistently. This reconciles the 2026-08-09
 * legal-master audit finding that the flag (then `true`) contradicted the store declarations.
 *
 * History:
 *  - DISABLED 2026-08-02 (audit F-003) after r8's final holdout missed 9/123 critical cases.
 *  - The r9 remediation closed that class on the DETERMINISTIC rules floor
 *    (src/backend/coach/safety/rules.ts `concealedIntent` etc.), independent of the model.
 *  - ENABLED 2026-08-03 (owner decision) on a passing run against Jack Dov's OWN sealed reviewer
 *    set (data/holdouts/JV.json — 66 cases, 46 critical + 20 benign) via `npm run validate:holdouts`:
 *      • CRITICAL MISSES: 0/46   ← the zero-miss safety bar (criterion 1) — PASS
 *      • emergency under-routes:  0
 *      • benign false positives: 3/20 (15%, classifier-alone upper bound; harness treats FP as WARN)
 *  - DISABLED 2026-08-09 (this change) — reverted to OFF for launch pending §23 reviews + App Check.
 *
 * This is deliberately INDEPENDENT of the workout `PROFESSIONAL_SIGNOFF` (see signOff.ts).
 *
 * RE-ENABLE CONDITIONS (owner, tracked in docs/COACH_RELEASE_STATE.md) — ALL required:
 *  - the automated critical-safety holdout passes on the exact shipping build (0 critical misses),
 *  - the independent §23 professional/clinical reviews are completed and recorded,
 *  - App Check enforcement is live on the AI endpoint,
 *  - a live kill-switch rollback drill (config/coach.killSwitch) has been performed,
 *  - reduce the benign FP rate toward the 5% quality target.
 */

export const COACH_ENABLED = false

/** True only when the coach has been deliberately enabled post-review. */
export function coachAvailable(): boolean {
  return COACH_ENABLED
}
