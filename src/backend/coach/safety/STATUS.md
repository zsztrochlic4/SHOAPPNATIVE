# Coach Safety Guardrails — build status

Implements the architecture of **Coach Safety Guardrail Specification v12** as a new layer on top
of the existing, reviewed workout engine. **The coach stays OFF** (`coachGate.COACH_ENABLED === false`,
`PROFESSIONAL_SIGNOFF.reviewer/accreditation === null`). Nothing in this layer enables it.

## What this layer is (and is not)

- It is the **conversational** safety the workout engine never had: crisis, disordered eating, meal
  plans, medical emergencies, injury-override, PEDs, pregnancy, concussion, harm-to-others, etc.
- It does **not** re-implement injury / age / screening / exercise-safety logic. Where those
  decisions are needed it **calls the reviewed engine** via `engineBridge.ts`
  (`routeByAge`, `ageFromDob`, `injuryExcludeIds`, `EXERCISE_BY_ID`). The engine is the single
  source of truth; "coach proposes, engine performs and validates" (spec §6/§16).

## Components (all built)

| File | Role |
|------|------|
| `router.ts` | Pre-response router: high-recall `rules.ts` + fail-safe `classifier.ts`, highest tier wins |
| `stateMachine.ts` | Deterministic persistence + retraction (crisis stays; injury/pregnancy/concussion/under-18 span sessions) |
| `responses.ts` + `services.ts` | Fixed responses with the §22 verified AU services; tap-to-call buttons; neutral fail-safe screen |
| `validator.ts` | Post-response validator (defence in depth); calls the engine bridge to block engine-prohibited exercises |
| `engineBridge.ts` | The ONLY call-site into the reviewed engine (age/injury/exercise) |
| `index.ts` | Public API used identically by both coach paths: `guardIncoming`, `guardOutgoing`, `coachEligibility` |
| `runCoachSafetyTests.ts` | §18 regression suite, run on the production build |

Wired into both paths (behind the closed gate) via `src/lib/coachSafety.ts`: the 1:1 chat
(`overlays/extra.tsx`), the reducer chat (`store/store.tsx` `SEND_CHAT`), and the nutrition food
coach (`screens/Nutrition.tsx`). If classification is unavailable, all paths **fail safe** to a
neutral service-unavailable screen with crisis options — never the fitness menu.

## Section 21 enabling gate — status

- Guardrail requirements specified — **[SPECIFIED]**
- All guardrails in BOTH paths from one enforced source (rules + classifier + state machine + validator) — **[BUILT — rules layer]**
- Behavioural persistence / retraction — **[BUILT]**
- Fail-safe behaviour (tier response / service-unavailable / limit never blocks crisis) — **[BUILT]**
- Passes the §18 suite on both paths (production build) — **[PASSING — rules + stub]**
- **Validated ML classifier** with clinician-approved sensitivity/false-positive thresholds — **[TO BUILD]** (`classifier.ts` ships a fail-safe stub)
- Privacy & incident governance (§19) — **[TO DO — business-level]**
- Additional controls (§20): 18+ gate wired; **tap-to-call button UI, server-side kill switch, weekly aggregate summary, non-AU locale routing, cross-session operational-state storage** — **[TO BUILD]**
- App Check + daily message limit — **[TO CONFIGURE]**
- **Independent clinical / privacy / safety / security / implementation review of the built system (§23)** — **[REQUIRED BEFORE RELEASE — not done]**

## The hard rule

`COACH_ENABLED` stays `false` until the validated classifier is built, the §18 suite passes on it,
the §20 controls are built, App Check is configured, **and** the four independent §23 reviews are
signed off. Enabling is a separate, deliberate decision — never part of the workout launch.
