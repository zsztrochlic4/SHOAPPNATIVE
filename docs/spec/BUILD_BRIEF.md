# Workout Backend — Build Brief

> Verbatim brief provided by the product owner alongside `StrengthHub_Workout_Backend_v16.xlsx`.
> The **workbook is the single source of truth** for backend logic. This file is the standing
> instruction set for the build; the workbook sheets define the rules.

## Goal

Build the backend for the workout section of the SHOAPPNATIVE app (React Native / Expo,
Firestore backend) and wire it to the **new onboarding design already in the repo**, using this
workbook as the single source of truth for the backend logic.

## New onboarding design

The screens described in the workbook's "Onboarding Questions" sheet describe the intended
questions and, crucially, what each answer must feed into the backend. The **actual live UI is
the new design in the codebase** (`src/screens/Onboarding.tsx`). The task is to CONNECT the two:

- Read the new onboarding design in the repo and list every field it collects.
- Read the "Onboarding Contract" sheet (each backend field, its canonical value, what it feeds).
- Map the new onboarding fields to the contract fields. Build the deterministic mapping module
  that turns onboarding answers into stored backend values.
- Flag any mismatch explicitly: any contract field the new design does NOT collect (e.g.
  `date_of_birth`, `trains_alone`, safety-check answers), and any field the design collects that
  the contract doesn't cover. Do NOT silently guess or default — surface it for a decision.
- Safety-critical fields (`date_of_birth` for age routing, screening answers, `trains_alone`)
  must be present; if the new design is missing any, that's a **blocker** to raise.

## Read order (before any code)

1. "Onboarding Questions" → "Coach AI Operating Rules" → "Build Backlog" → "Claude Code Notes".
2. Then the rest. "Field Guide" explains what every other sheet and column is for.
3. Read the new onboarding design and do the field mapping.
4. Return a written summary of: build order, Firestore collections (from "Data Schemas"),
   onboarding→contract field mapping, and any mismatch/ambiguity. **Do NOT start coding until
   the owner confirms.**

## Non-negotiable rules

- The workbook is the source of truth for backend logic. Do not invent exercises,
  prescriptions, splits, or rules not in it. If it's not in the "Exercise Database", it doesn't
  exist.
- "Safety Rules", "Screening Outcomes", "Age Routing", "Injury Modifications" are HARD safety
  logic. Applied after every prescription and every runtime change. Never overridable by a user
  request or the AI. A user may change goal, split and exercises freely; never the safety
  envelope.
- All onboarding-answer→backend-value mappings must be a single deterministic lookup module
  (per "Onboarding Contract"), shared by onboarding and the generator. No AI inference in that
  path — identical answers must always produce identical values.
- Follow the "Build Backlog" priority order: P0 first (nothing generates for real users until
  all P0 items, including the professional sign-off gate, are done), then P1, then P2.
- The coach AI's behaviour is defined by the "Coach AI Operating Rules" sheet, not a free-text
  instruction. Its system prompt points to that sheet's logic.

## Build scope (this pass)

- Create the Firestore collections exactly as specified in "Data Schemas" (`users`, `programs`,
  `workout_instances`, `set_logs`, `progression_state`, `swap_history`, `flags`,
  `planned_absences`).
- Seed the exercise, substitution and rules data from the workbook sheets.
- Implement the 14-step pipeline on the "Generator Flow" sheet.
- Wire the new onboarding design to the mapping module and the generator.
- Implement the Claude Code Notes (CC01–CC06): editable/reschedulable training days, catch-up on
  missed sessions, pulling outside-activity into the generator, a skippable editable activity
  step, injury region mapping, and the free-text health red-flag scan.

Keep the code modular and match each module to its spec sheet, so updating a sheet maps to a
known code change. Ask before making any assumption the workbook or the onboarding design does
not answer.
