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
| 2 | Seed exercises (all columns) | Exercise Database | ✅ done (113) | `src/backend/data/exercises.ts` |
| 3 | Seed substitutions (ID-based) | Substitutions | ✅ done (542) | `src/backend/data/substitutions.ts` |
| 5 | Wire new onboarding: B1 flow reorder, B2 dob storage, M1 structured for Advanced, produce UserDoc | Onboarding Questions/Contract | ✅ done | `src/screens/Onboarding.tsx` |
| 5b | Firestore persistence (write UserDoc / read on load) | Data Schemas | ✅ done | `src/backend/repo/userRepo.ts` |
| 9 | Stop-symptom escalation (S06) | Safety Rules S06 | ✅ logic done | `src/backend/safety/stopSymptom.ts` |
| 10 | Coach AI Operating Rules as system-prompt contract | Coach AI Operating Rules | ✅ done | `src/backend/coach/operatingRules.ts` |
| CC06 | Free-text red-flag scan on `notes` | Screening Outcomes / S05 | ✅ done | `src/backend/safety/redFlagScan.ts` |
| 11 | **Accredited professional sign-off gate** (coach + generation blocked until on file) | Safety sheets | ✅ gate done (defaults unsigned) | `src/backend/coach/signOff.ts` |

**P0 status: ALL P0 items complete.** The sign-off gate ships unsigned, so `canGenerate()`
blocks real-user generation until an accredited professional signs off. Verified by 65
deterministic assertions over the pure modules. P1 (generator) not started — on hold
pending the owner's safety review.

The canonical `users` doc persists to Firestore at `users/{uid}.backendUser` (merge write,
so it never clobbers the app root doc that cloudRepo owns) and round-trips via AsyncStorage
in demo mode. Naming note: the workbook calls the collection `users`; the app already owned
`users/{uid}`, so the canonical record lives under that doc's `backendUser` field rather than
at its top level.

## P1 — engine
**Steps 1–8 (initial generation) DONE and gated.** `src/backend/generator/`:
`select.ts` (Split Selector), `schedule.ts` (Schedule Rules SCH02–06), `volume.ts` (Weekly
Volume + reconciliation rules 1/2/3/7), `build.ts` (Session Templates fill + Prescription +
Safety clamp + Injury-Mod application + S09 cue), `generate.ts` (orchestrator), plus the
data seeds `splits/splitSelector/sessionTemplates/weeklyVolume/externalCommitments/injuryModifications/equipmentTags`.

**Hard gate — `sweep.ts::runProfileSweep()` PASSES:** 60 core profiles (4 goals × 3
experience × 2–6 days) + 3 edge cases (consecutive days, injury flag, conditioning-covering
commitment) with **zero safety-floor breaches and zero empty required slots**. Verifies S04
(reps≥4, %1RM≤88), Min-RIR + grid-RIR floors, S01 (advanced-gate), S09 (solo spotter cue),
and the volume floor(4)/cap(20). Backlog #15 acceptance met (UL4 Int-Hypertrophy chest 10–16;
PPL6 back trimmed <16).

Equipment taxonomy reconciled to the Exercise Database's own 46-tag vocabulary
(`equipmentTags.ts`); the onboarding mapping now emits those tags (fixes M4).

Still P1: runtime steps 9–14 (Progression Engine, Exercise Swaps, Goal Change, calendar
adaptation SCH07/08, deload, re-screen), Custom Splits, Exam Survival Protocol, CC01–CC05.
Not started — on hold per owner (safety review in progress).

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

## Workbook parsing — RESOLVED (the workbook is NOT corrupted)
Earlier "corruption" claims (Impact Level, Optional Equipment Tags, Measurement Type, and the
Prescription grid) were a **bug in a hand-rolled raw-XML parser**, which mis-read inline numeric
cells and collapsed empty columns — it surfaced sharedStrings indices (`432`, `2666`…) as data
and shifted values. Fixed by switching all workbook reading to **SheetJS (openpyxl-equivalent)**.
Everything now reads clean and is seeded from the authored source:
1. **Measurement Type** — authored, read directly (`weight_reps`×68, `reps`×26, `duration`×8,
   `interval`×10, `assisted`×1). Matches Load Unit with 0 mismatches.
2. **Impact Level** — authored, read directly: **Low ×104, High ×5, Moderate ×4**. High =
   Jump Squat, Pogo Hop, Burpee, Jumping Jack, High Knees; Moderate = Kettlebell Swing,
   Mountain Climber, Dumbbell Swing, Treadmill Interval. (Replaces the earlier binary
   derivation, which wrongly marked Treadmill High and the swings/mtn-climber Low.)
3. **Optional Equipment Tags** — authored: 109 empty + 4 real (QD04/QD08/HG07 `dumbbell`,
   CO14 `dumbbell/plate`). Seeded verbatim.
4. **Prescription grid** — seeded verbatim from the owner-supplied `Prescription_Logic_CLEAN.csv`
   (`src/backend/data/prescriptionGrid.ts`); all 20 rows aligned, every non-interval row carries
   its `rir_min` floor. `video_url` is genuinely absent (media is P2 #24).
- Row counts: **113** exercises, **542** substitutions (Backlog prose said 110/528). 0 dangling
  refs, 0 exercises with empty substitutes.
- The buggy raw-XML `parse.js` is retired; TSV mirrors in `sheets/` are regenerated via SheetJS.
