# Workout Backend — Build Status

Living checklist for the P0→P1→P2 build. Each item points at its spec sheet. Update as
work lands. Source of truth = `StrengthHub_Workout_Backend_v16.xlsx` (see `sheets/`).

## Confirmed decisions (owner)
- **B1** joint follow-ups trigger on screening **Q5 = Yes** or an injury chip (hard req).
- **B2** store `date_of_birth`; **no `?? 20` default**; block generation on unverified age (hard req).
- `planned_absences` **embedded on `users`**.
- **M1** `followed_structured_program` stored; asked for Advanced too.
- **M2** `diet` / `tight_budget` are **infer_ok** (nutrition-only; defaulted, refined later).
- Canonical `users` doc is source of truth; local `Profile` is a **one-directional** derived view;
  the canonical doc is written **only** via the mapping module.

## P0 — safe launch

| # | Item | Sheet | Status | Where |
|---|---|---|---|---|
| 1 | Firestore collection schemas | Data Schemas | ✅ done | `src/backend/schema.ts` |
| 4 | Deterministic onboarding→backend mapping module | Onboarding Contract | ✅ done | `src/backend/mapping/onboardingContract.ts` |
| 4b | UserDoc → local Profile projection (one-directional) | — | ✅ done | `src/backend/mapping/projection.ts` |
| 6 | Screening routing (+ B1 Q5 fix) | Screening Outcomes | ✅ logic done | `src/backend/safety/screening.ts` |
| 7 | Age routing (+ B2 no-default) | Age Routing | ✅ logic done | `src/backend/safety/ageRouting.ts` |
| 8 | Safety Rules engine (S01–S09, P01–P03 floors) | Safety Rules | ✅ core done | `src/backend/safety/safetyRules.ts` |
| 2 | Seed 110 exercises (all columns) | Exercise Database | ⏳ next | `src/backend/data/exercises.ts` |
| 3 | Seed 528 substitutions (ID-based) | Substitutions | ⏳ next | `src/backend/data/substitutions.ts` |
| 5 | Wire new onboarding: B1 flow reorder, B2 dob storage, M1 structured for Advanced, produce UserDoc, persist | Onboarding Questions/Contract | ⏳ next | `src/screens/Onboarding.tsx` |
| 5b | Firestore persistence (write UserDoc / read on load) | Data Schemas | ⏳ todo | `src/backend/repo/*` |
| 9 | Stop-symptom escalation (S06) | Safety Rules S06 | ⏳ todo | `src/backend/safety/stopSymptom.ts` |
| 10 | Coach AI Operating Rules as system-prompt contract | Coach AI Operating Rules | ⏳ todo | `src/backend/coach/operatingRules.ts` |
| CC06 | Free-text red-flag scan on `notes` | Screening Outcomes / S05 | ⏳ todo | `src/backend/safety/redFlagScan.ts` |
| 11 | **Accredited professional sign-off gate** (coach stays disabled until on file) | Safety sheets | ⏳ todo (config flag) | — |

## P1 — engine
14-step Generator Flow, Split Selector, Session Templates, Weekly Volume, Prescription Logic,
Schedule Rules, Progression Engine, Exercise Swaps, Goal Change, Custom Splits, Injury
Modifications application, Exam Survival Protocol. CC01–CC05. Not started.

## P2 — enhancements
Exercise media, structured equipment taxonomy, conversational entry points, notifications,
profile-sweep safety test harness. Not started.

## Open assumptions to confirm (implemented with a deterministic default, flagged here)
1. **Focal cap:** picking "Arms" expands to Biceps+Triceps (2 tokens). If combined with another
   focal chip the expansion is capped to the first 2 tokens in pick order. Confirm this is the
   intended cap behaviour.
2. **love/avoid exercises → IDs (M3):** currently stored as `[]` pending an Exercise Database
   name→ID resolver; the onboarding search list must be sourced from the 110-exercise DB, not the
   hardcoded 20-name list. Wiring deferred until the exercise seed lands.
3. **Injury chips** cover the 6 Injury-Mod regions; contract's Neck/Elbows/Achilles/Feet are not
   collected (Achilles→ankle is mapped for future). Confirm the 6 are sufficient for launch.
4. **Equipment tag vocabulary** reconciled in the mapping (`Dumbbells`, `Barbell`→`barbell`);
   `Sliders or a towel` not yet collected by the UI. Full structured taxonomy is P2 (#25).
5. **`trains_alone`** stored as the 4-value frequency (`always`/`usually`/`sometimes`/`never`);
   Safety S09 fires on `always`/`usually`.
