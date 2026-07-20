# Coach Safety Guardrails — build status

Implements the architecture of **Coach Safety Guardrail Specification v12** as a new layer on top
of the existing, reviewed workout engine. **The coach stays OFF** (`coachGate.COACH_ENABLED === false`,
`PROFESSIONAL_SIGNOFF.reviewer/accreditation === null`). Nothing in this layer enables it.

## Clinical determination (independent review)

**Reviewer: Jack Dov — determination: NOT ACCEPTABLE. The coach stays DISABLED.**

A detection-results measurement of the current build (rules + fail-safe stub) against an independent
candidate test set handled 55% of scenarios overall, and **44 of 74 critical (000/immediate-danger)
rows failed** — the dominant failure mode being fixed-phrase matching that paraphrase, obfuscation,
and multi-turn escalation slip past. Jack's **section-4 release standard** (zero critical misses,
validated sensitivity/false-positive thresholds per tier, both paths) is the target to clear before
any activation.

**Structural remediation done (Jack §5 — the parts that do NOT need the trained model):** emergency
precedence + immediacy escalation with a 000 floor that cannot be downgraded (`router.ts`);
persistent state not cleared by a bare retraction/minimisation, and genuine-correction vs bare-
retraction resolved by the router on full context (`stateMachine.ts`, `rules.ts` signal reuse);
identical enforcement on the live and fallback paths, incl. the reducer path's retained in-memory
session (`coachSafety.ts`, `store.tsx`, `CloudSync.tsx`); classifier drop-in point confirmed
(`classifier.ts`). **The detection model was NOT built and the rules were NOT tuned to the test
phrases** — that would be memorising the test.

**Detection classifier — BUILT, NOT VALIDATED.** The fail-safe stub is replaced by an LLM-based
classifier (`llmClassifier.ts`) behind the `activeClassifier` interface: it classifies each message
(with recent conversation context for multi-turn escalation) into the safety categories and returns
hits to the router. The high-recall **rules remain a FLOOR** (rules ∪ classifier, most-protective
wins), the **emergency floor** still can't be downgraded, and it **fails safe** (no model / error /
timeout / unparseable → protective, never "allow"). Model access is injected: the app uses Gemini via
Firebase AI Logic (`coachClassifier.ts`); the harness can use a real API for measurement. It runs on
the async path used by BOTH live coach surfaces (`coachPrecheckAsync`). `activeClassifier.validated`
**stays false** — building/wiring a model is **not** validating it, and the rules were **not** tuned
to any test phrases.

**Holdout validation harness — DEV ONLY, owner-run.** Jack's finalised holdout set is encoded
(base64, `src/dev/safetyHoldoutSet.ts` — not absorbed by the detector) and runs through the REAL
production Gemini path (`coachPrecheckAsync`) via a dev screen (`src/dev/SafetyHarnessScreen.tsx`),
guarded by `__DEV__` + `EXPO_PUBLIC_SAFETY_HARNESS=1` so it is stripped from release bundles. It
measures only; it does not enable the coach. The owner runs it in a dev build (client-side Gemini +
App Check) and brings the numbers back — I did not and cannot run it, and did not tune anything to
the set.

**Post-determination structural fixes (Jack NOT APPROVED → failure-class remediation).** After the
holdout run, the failure CLASSES Jack identified were fixed at the mechanism level (no holdout
phrasings added; the burned set was not re-run as proof): overdose/poisoning + any immediate-danger
signal escalates to 000, bare overdose → Poisons (`router.ts` `escalateToEmergency`, prompt
definitions); third-party immediate danger → 000, not the support-line route; overdose + medical-
emergency states persist through a bare minimisation (`types.ts`, `stateMachine.ts`); non-AU / unknown-
location emergencies route to local-services wording (`rules.ts` `indicatesNonAustralia`, `index.ts`);
and false positives reduced conceptually (first-person scope for crisis/under-18, academic/drill
"suicide" guard, training-split ≠ meal_plan, colloquial appetite ≠ DE) without lowering critical
recall. Coach suite still 218/218; a fresh-wording generic mechanism check passes.

**Remaining blocker to release (unchanged):** an **independent clinical validation** of the
classifier **against a fresh holdout set the builder never saw**, meeting Jack's section-4 standard
(zero critical misses + agreed sensitivity/false-positive thresholds per tier, both paths). Testing
the classifier — by me or via the harness — is **not** that. `COACH_ENABLED` stays `false` until the
independent review signs off.

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
- **Validated ML classifier** with clinician-approved thresholds — **[BUILT, NOT VALIDATED]** LLM classifier wired behind `activeClassifier` (`llmClassifier.ts`), rules retained as a floor, fail-safe, both async paths. `validated=false`. Still blocks release: an **independent clinical validation against a fresh holdout set** (Jack §4) is required — building/testing is not validating.
- §20 controls: tap-to-call/text buttons — **[BUILT]**; server-side kill switch — **[BUILT]** (cross-platform Firestore `config/coach.killSwitch` source in `src/lib/coachKillSwitch.ts`, dormant until the coach is enabled — start it after sign-in then); weekly aggregate summary — **[BUILT — DORMANT]**; non-AU locale rule — **[BUILT]**; cross-session operational-state storage — **[BUILT — DORMANT]**
- Daily message limit — **[BUILT]** (crisis-exempt)
- App Check — **[CLIENT SCAFFOLDED]** — client wiring in `src/lib/appCheck.ts`, initialised from `src/lib/firebase.ts` right after the Firebase app (web reCAPTCHA v3 provider). Once initialised, the SDK auto-attaches App Check tokens to the coach's Firebase AI Logic calls. It is a **safe no-op** until keyed, and does **not** gate the coach on — `COACH_ENABLED` stays the master switch. **Remaining ops step (owner):** enable App Check in the Firebase console, register the app + reCAPTCHA provider, and set `EXPO_PUBLIC_APPCHECK_RECAPTCHA_KEY` (optionally `EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN` for local web dev). **Native follow-up:** iOS App Attest / Android Play Integrity need the native App Check path in a dev build — reCAPTCHA is web-only.
- Locale detection → `isAustralia` — **[BEST-EFFORT]** (device timezone; a fuller locale signal is a small [TO BUILD])
- Privacy & incident governance (§19) — **[TO DO — business-level]** — GATES activation of the two dormant mechanisms
- **Independent clinical / privacy / safety / security / implementation review of the built system (§23)** — **[REQUIRED BEFORE RELEASE — not done]**

## The hard rule

`COACH_ENABLED` stays `false`, and the dormant mechanisms stay dormant, until the validated
classifier is built, the §20/§21 items and privacy foundation are done, App Check is configured, and
the four independent §23 reviews are signed off. Enabling is a separate, deliberate decision.
