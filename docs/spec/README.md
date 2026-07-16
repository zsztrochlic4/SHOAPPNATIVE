# Workout Backend Spec

This folder is the **source of truth** for the workout backend and its onboarding wiring.

## Contents

- **`StrengthHub_Workout_Backend_v16.xlsx`** — the master workbook. 32 sheets defining the data
  model, exercise database, safety logic, generator pipeline and onboarding contract.
- **`BUILD_BRIEF.md`** — the standing build instructions from the product owner.
- **`sheets/`** — a plain-text (TSV) export of every workbook sheet, one file per sheet, so the
  rules are greppable and diffable in the repo. `sheets/_INDEX.txt` lists them in workbook order.
  These are a **read-only mirror** of the `.xlsx`; if the workbook changes, re-export them.

## How the workbook maps to code

Each backend module should trace back to one spec sheet, so a sheet edit maps to a known code
change:

| Spec sheet | Backend concern |
|---|---|
| Onboarding Questions / Onboarding Contract | Deterministic onboarding→backend mapping module |
| Data Schemas | Firestore collections & document shapes |
| Exercise Database / Substitutions | Seed data (exercises, substitution graph) |
| Generator Flow | The 14-step program generation pipeline |
| Split Selector / Splits / Custom Split Rules / Custom Split Resolution | Split choice |
| Session Templates / Weekly Volume | Slot filling & volume budgeting |
| Prescription Logic / Rep Range Guide / Progression Engine | Sets/reps/load prescription & progression |
| Safety Rules / Screening Outcomes / Age Routing / Injury Modifications | HARD safety envelope |
| Schedule Rules / External Commitments | Weekly scheduling & activity integration |
| Goal Change / Exam Survival Protocol | Runtime program changes |
| Coach AI Operating Rules | Coach AI system-prompt contract |
| Build Backlog / Claude Code Notes / Field Guide | Build plan & column semantics |

## Rules that never bend

The Safety Rules, Screening Outcomes, Age Routing and Injury Modifications sheets are HARD
safety logic — applied after every prescription and every runtime change, never overridable by a
user request or the AI. These sheets plus Coach AI Operating Rules require **written sign-off from
an accredited exercise professional before the coach is enabled for real users** (Build Backlog
item 11, P0).
