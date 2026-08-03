# Generated-program professional sign-off (audit SA-006 / F-007)

Real generated programs stay **blocked** until an **accredited exercise
professional** reviews the safety logic and their identity is recorded. This is the
signable record for that review. The full evidence pack for the reviewer is
`docs/spec/PROFESSIONAL_REVIEW_PACKET.md`.

## The gate (already enforced in code)

`src/backend/coach/signOff.ts` → `platformCleared()` returns `ok:false` — so no
program generates for a real user — until **all** of these are true in
`PROFESSIONAL_SIGNOFF`:

- `signed: true`
- every sheet in `REQUIRED_REVIEW_SHEETS` is in `sheetsReviewed`
- `reviewer` is a real name (non-blank) — a blank reviewer keeps the gate CLOSED
- `accreditation` is a real accreditation number (non-blank)

Today `reviewer`/`accreditation` are `null`, so the gate is correctly **closed**
(`reason: 'signoff_reviewer_missing'`). Filling them (below) is what opens it.

## What the professional verifies

The deterministic generator is already covered by an automated safety sweep —
**85 profiles, zero safety-floor breaches, zero empty required slots**
(`npm run sweep`). The reviewer confirms the *rules themselves* are clinically
sound, across the five sheets:

**1. Screening Outcomes** — the pre-exercise screening questions and how each
outcome maps to clear / modify / refer.

**2. Safety Rules (S01–S09)** — confirm each is correct and conservative:
- S02 muscle **coverage** — every major muscle trained directly at least once.
- S03/S04 **repeat spacing + variety** — day types and exercises don't over-repeat.
- S04 **intensity ceilings** — %1RM ≤ 88, rep floors on loaded lifts, Min RIR.
- S07 **weekly load cap** — progression never exceeds min(5%, region cap) per week.
- S05 **determinism** — same inputs → same program (auditable).
- S01/S06/S09 — base build, escalation and the remaining floors.

**3. Age Routing** — the server-trusted 18+ gate and how under-18 is handled.

**4. Injury Modifications** — downgrade-vs-exclude decisions per injury (e.g. the
knee downgrade-vs-exclude question called out in the packet).

**5. Coach AI Operating Rules** — the guardrails the coach must obey (this also
feeds the coach release gate; see `docs/COACH_HOLDOUT_SIGNOFF.md`).

## Reviewer checklist

- ☐ Reviewed all five sheets in `docs/spec/PROFESSIONAL_REVIEW_PACKET.md`.
- ☐ Confirmed the S01–S09 safety rules are clinically appropriate and conservative.
- ☐ Confirmed injury modifications (downgrade vs exclude) per injury.
- ☐ Confirmed the age-routing / 18+ gate.
- ☐ Reviewed representative generated programs (or the sweep output) for plausibility.
- ☐ No unresolved safety concerns (or all listed below and addressed).

## Record (complete, then enter into code)

| Field | Value |
|---|---|
| Reviewer name | ______ |
| Accreditation body + number | ______ |
| Date (ISO) | ______ |
| Sheets reviewed | Screening Outcomes · Safety Rules · Age Routing · Injury Modifications · Coach AI Operating Rules |
| Notes / conditions | ______ |
| Signature | ______ |

To **open the gate**, set these in `src/backend/coach/signOff.ts` →
`PROFESSIONAL_SIGNOFF` (or, preferably, source them from a remote config flag so it
isn't a code edit):

```ts
signed: true,
reviewer: '<reviewer name>',
accreditation: '<body + number>',
date: '<ISO date>',
// sheetsReviewed already lists all five required sheets
```

`platformCleared()` then returns `ok:true`. Note this gate governs **program
generation**; enabling the **coach** additionally requires the signed
`docs/COACH_HOLDOUT_SIGNOFF.md` and the conditions in `docs/COACH_RELEASE_STATE.md`.
