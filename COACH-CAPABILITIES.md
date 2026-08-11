# Coach capability matrix

Maps the **SHO AI Coach — Capability Plan** (31 Jul 2026) to the implementation, feature by feature —
the artefact the plan's §10 asks for. Status reflects `main` as of the goal‑weight action landing.

**Legend** — ✅ implemented · ⚠️ partial / honestly declined · ➖ advice‑only (LLM + grounded context, no action needed)

The coach never writes state directly: it **proposes**, the deterministic engine **performs & re‑clamps**
against the Safety Rules, and plan/outward changes take an explicit **confirm**. Advice is grounded in a
per‑turn, intent‑selected slice of the user's real data (`contextSelection.ts`) built from the server
snapshot (`functions/src/coachWorkspace.ts`).

## 1. Workouts & exercises
| Capability | Kind | Status | Module |
|---|---|---|---|
| Why today's session / what a lift does / form cues / sets·reps·RIR rationale / rest / frequency / warm‑up / tempo / quick‑workout stations | answer | ➖ | `operatingRules` + `contextSelection(training)`: `programDay`, `program` + exercise DB |
| Substitute an exercise (dislike / pain / equipment / too_hard / too_easy / specific / variety) | action | ✅ | `swap` → `coachActionResolver` → `generator/swaps` |
| Pain‑aware swap excludes flagged region; stop‑symptom escalates instead of swapping | safety | ✅ | safety precheck + `validateProgramForUser` |
| Reschedule a day / edit the available‑days set, then re‑run the scheduler | action | ✅ | `set_training_days` / `reschedule_days` → regen |
| Handle a missed session — mark exempt (no‑penalty rest) | action | ✅ | `catch_up(exempt)` |
| Missed session — shift / fold / re‑plan | action | ⚠️ | Declined honestly — needs a session‑rescheduler primitive the app lacks |
| Trigger a deload when a lift has stalled | action | ✅ | `deload` (in place; loads preserved) |
| Start the right session (full or 15‑min quick) | action | ✅ | `start_session` → navigate |

## 2. Goals & program direction
| Capability | Kind | Status | Module |
|---|---|---|---|
| Am I on track / trade‑offs of a goal change / timeline / how targets were set | answer | ➖ | `contextSelection(progress)` + profile |
| Change training goal (re‑selects split, re‑budgets, re‑prescribes, easy transition week) | action | ✅ | `change_goal` → `generator/goalChange` |
| Adjust days/week or session length and regenerate | action | ✅ | `set_training_days` / `set_session_length` (duration‑fitted) |
| **Update goal weight / body target, reflected in projections** | action | ✅ | **`set_goal_weight` → `profile_patch{goalWeightKg}`** (added) |
| Flag re‑screening when a goal change needs health screening re‑run | safety | ✅ | regen refuses with a "health re‑check" message when the gate closes |

## 3. Nutrition & food
| Capability | Kind | Status | Module |
|---|---|---|---|
| Food‑log review (0–10, goal‑aware, ≤3 improvements) / ask‑anything food Q&A / protein / budget / fuelling / restriction‑aware / supplements / day‑tag nudge | answer | ➖ | `contextSelection(nutrition)`: `nutrition`, `nutritionCheckins` |
| Suggest & open a Budget Eats recipe that fits | action | ✅ | `open_budget_eats` → navigate |
| Nudge to log water / nutrition when low | action | ✅ | `nudge_log` |
| **Boundary:** no meal‑plan authoring, no from‑scratch macro/calorie targets | boundary | ✅ | `OUT_OF_SCOPE` + HARD refusal (nutrition is qualitative app‑wide) |

## 4. Progress, stats & PRs
| Capability | Kind | Status | Module |
|---|---|---|---|
| Weight trend / celebrate a real PR / est‑1RM climbing‑flat‑stalling / volume & consistency / "why isn't my bench moving?" | answer | ➖ | `contextSelection(progress)`: `recentPRs`, `plateaus`, `weights`, `trainingSummaries` |
| Offer to share a PR to the cohort (confirm) | action | ✅ | `share_pr` (grounded in a real PR; 2nd confirm before publish) |
| Point to the exact Progress card behind an answer | action | ✅ | `navigation(progress)` |

## 5. Recovery, wellbeing & habits
| Capability | Kind | Status | Module |
|---|---|---|---|
| Soreness vs joint‑pain triage / sleep coaching / fatigue & motivation / hydration‑steps‑mindfulness / exam‑season load | answer | ➖ | `contextSelection(recovery)`: `recovery7d` |
| Nudge to log a habit (water / sleep / steps) | action | ✅ | `nudge_log` |
| Suggest & start a shorter session on a low‑energy day | action | ✅ | `start_session(quick15)` |
| Adjust a wellness goal (water / sleep / steps) | action | ✅ | `set_wellness_goal → profile_patch` (added) |

## 6. Plan around your life — busy periods & exams
| Capability | Kind | Status | Module |
|---|---|---|---|
| Explain how training bends during a busy period / exam reassurance | answer | ➖ | `operatingRules` |
| Turn on Exam mode | action | ✅ | `exam_mode` → maintenance period |
| Declare a planned absence (travel / moving) | action | ✅ | `planned_absence` |
| Choose the right period mode and apply it | action | ✅ | `planned_absence` modes |

## 7. New to the gym & app help
| Capability | Kind | Status | Module |
|---|---|---|---|
| Beginner‑track answers & next lesson / how‑to‑use‑app / etiquette / RIR | answer | ➖ | `operatingRules` |
| Open the relevant lesson or app surface | action | ✅ | `navigation` (beginner, workout, nutrition, progress, loggers, budgetEats) |
| Open a specific **exercise detail** by id | action | ⚠️ | Not a navigation target yet — follow‑up (needs an id‑addressable route) |

## 8. Community
| Capability | Kind | Status | Module |
|---|---|---|---|
| Explain challenges / leaderboards / belonging‑scoped competition / partner match % | answer | ➖ | `operatingRules` |
| Draft a PR / progress post for review & publish (confirm) | action | ✅ | `share_pr` |
| Suggest joining a challenge / a partner match | answer | ✅ | advice |
| **Connect** a training partner (outward, confirm) | action | ⚠️ | Suggesting works; the outward connect action is unwired (community backend is behind a service seam — product decision) |

## 9. Cross‑cutting — context & boundaries
**Context always handed to the coach** (`coachWorkspace` → `contextSelection`): profile + goals (always
attached), core goal/experience/units, safety‑approved constraints, and per‑topic sections. The plan's
"context gaps worth adding" are all implemented: **recent PRs, current program day, last‑session
completion, sleep & water 7‑day averages, per‑lift plateau flags.**

**Non‑negotiable boundaries — all encoded:** never writes to the program directly (proposes → engine
re‑clamps) ✅ · never invents an exercise / weight / macro outside the seeded DB ✅ · safety routing
(crisis / disordered‑eating / off‑topic / under‑18) runs first ✅ · no medical diagnosis — triage & refer
✅ · no meal‑plan / from‑scratch macro‑setting ✅ · outward / irreversible actions require confirm ✅ ·
ships gated until independent review (`COACH_ENABLED`, currently internal‑only) ✅.

## Open items (the only non‑complete rows above)
1. **Missed‑session shift / fold / re‑plan** — needs a session‑rescheduler the app doesn't have; `exempt` is honestly offered instead.
2. **Open a specific exercise detail** — add an id‑addressable navigation target.
3. **Outward partner‑connect action** — suggesting works; wiring the connect action is a community‑backend + product decision.

Everything else in the plan is implemented. Per the plan's own framing ("not a fence"), new capabilities
should extend this matrix as the app grows.
