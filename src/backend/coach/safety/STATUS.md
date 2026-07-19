# Coach Safety Guardrails — build status

Implements the architecture of **Coach Safety Guardrail Specification v12** as a new layer on top
of the existing, reviewed workout engine. **The coach stays OFF** (`coachGate.COACH_ENABLED === false`,
`PROFESSIONAL_SIGNOFF.reviewer/accreditation === null`). Nothing in this layer enables it.

## What this layer is (and is not)

- The **conversational** safety the workout engine never had: crisis, disordered eating, meal
  plans, medical emergencies, injury-override, PEDs, pregnancy, concussion, harm-to-others, etc.
- It does **not** re-implement injury / age / screening / exercise-safety logic. Those are **called**
  through `engineBridge.ts` (`routeByAge`, `ageFromDob`, `injuryExcludeIds`, `EXERCISE_BY_ID`). The
  engine is the single source of truth; "coach proposes, engine performs and validates" (§6/§16).

## Components

| File | Role |
|------|------|
| `router.ts` | Pre-response router: high-recall `rules.ts` + fail-safe `classifier.ts`, highest tier wins |
| `stateMachine.ts` | Persistence + retraction (crisis; injury/pregnancy/concussion/under-18 span sessions) |
| `responses.ts` + `services.ts` | Fixed responses, §22 verified AU services, **non-AU locale variants**, tap-to-call button specs, fail-safe screen |
| `validator.ts` | Post-response validator (defence in depth); calls the engine bridge; locale-aware |
| `engineBridge.ts` | The ONLY call-site into the reviewed engine (age/injury/exercise) |
| `dailyLimit.ts` | Daily message limit that **never blocks a crisis** (§21) |
| `killSwitch.ts` | Server-side remote disable, alongside `COACH_ENABLED` (§20) |
| `operationalStateStore.ts` | Cross-session operational safety-state store — **DORMANT** (§2/§19/§20) |
| `safetyAnalytics.ts` | Weekly aggregate summary, content-free/de-identified — **DORMANT** (§20) |
| `index.ts` | Public API both paths use: `coachPrecheck`, `guardIncoming/Outgoing`, `coachEligibility` |
| `runCoachSafetyTests.ts` | §18 regression suite + new-behaviour tests, run on the production build |
| `src/components/SafetyContactButtons.tsx` | Renders the tap-to-call / tap-to-text buttons in the coach chat |

Wired into both paths (behind the closed gate) via `src/lib/coachSafety.ts`: the 1:1 chat
(`overlays/extra.tsx`), the reducer chat (`store/store.tsx`), and the nutrition food coach
(`screens/Nutrition.tsx`), all through one shared `coachPrecheck`. `coachOperational()` gates
availability on both `COACH_ENABLED` **and** the kill switch.

## Built but DORMANT (must not collect real data ahead of §19 privacy work)

- **Operational safety-state store** (`operationalStateStore.ts`): `PERSISTENCE_ACTIVE === false`.
  The active store is a no-op that reads/writes **nothing**. The mechanism (load/persist/clear
  across sessions, minimal content-free fields, owner-only access intended) exists and is unit-tested
  in isolation, but is **not wired to live user data**. Activation requires the separate
  privacy/consent foundation (§19) **and** a real access-controlled backing store (e.g. Firestore
  owner-only rules), kept separate from analytics.
- **Weekly aggregate safety summary** (`safetyAnalytics.ts`): `ANALYTICS_ACTIVE === false`. The
  active sink discards everything. When activated it stores only `{category, timestamp, appVersion}`
  — no message, transcript, name, account id, or any stable identifier — for counts by flag type.

## Section 21 enabling gate — status

- Guardrail requirements specified — **[SPECIFIED]**
- All guardrails in BOTH paths from one enforced source — **[BUILT — rules layer]**
- Behavioural persistence / retraction (per-message) — **[BUILT]**; cross-session store — **[BUILT — DORMANT]**
- Fail-safe behaviour (tier response / service-unavailable / limit never blocks crisis) — **[BUILT]**
- §18 suite on both paths (production build) — **[PASSING — rules + stub]**
- **Validated ML classifier** with clinician-approved thresholds — **[TO BUILD]** (`classifier.ts` ships a fail-safe stub)
- §20 controls: tap-to-call/text buttons — **[BUILT]**; server-side kill switch — **[BUILT]**; weekly aggregate summary — **[BUILT — DORMANT]**; non-AU locale rule — **[BUILT]**; cross-session operational-state storage — **[BUILT — DORMANT]**
- Daily message limit — **[BUILT]** (crisis-exempt)
- App Check — **[CLIENT SCAFFOLDED]** — client wiring in `src/lib/appCheck.ts`, initialised from `src/lib/firebase.ts` right after the Firebase app (web reCAPTCHA v3 provider). Once initialised, the SDK auto-attaches App Check tokens to the coach's Firebase AI Logic calls. It is a **safe no-op** until keyed, and does **not** gate the coach on — `COACH_ENABLED` stays the master switch. **Remaining ops step (owner):** enable App Check in the Firebase console, register the app + reCAPTCHA provider, and set `EXPO_PUBLIC_APPCHECK_RECAPTCHA_KEY` (optionally `EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN` for local web dev). **Native follow-up:** iOS App Attest / Android Play Integrity need the native App Check path in a dev build — reCAPTCHA is web-only.
- Locale detection → `isAustralia` — **[BEST-EFFORT]** (device timezone; a fuller locale signal is a small [TO BUILD])
- Privacy & incident governance (§19) — **[TO DO — business-level]** — GATES activation of the two dormant mechanisms
- **Independent clinical / privacy / safety / security / implementation review of the built system (§23)** — **[REQUIRED BEFORE RELEASE — not done]**

## The hard rule

`COACH_ENABLED` stays `false`, and the dormant mechanisms stay dormant, until the validated
classifier is built, the §20/§21 items and privacy foundation are done, App Check is configured, and
the four independent §23 reviews are signed off. Enabling is a separate, deliberate decision.
