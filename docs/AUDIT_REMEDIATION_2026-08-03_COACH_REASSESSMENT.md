# Coach Reassessment Audit — Remediation Record

**Source:** StrengthHub Online — Coach Reassessment and Updated Audit Results, 3 August 2026
(FAIL / NO-GO, 50/100). Change under review: PR #33 (deterministic coach program actions, live).
**This branch:** `claude/strengthhub-audit-improvements-e78196`.
**Scope of this record:** what changed in code for each finding (C-001…C-018) and the residual
items that require an **owner action** (they cannot be closed by code alone).

The verification gate for everything below passes locally:

```
app:  tsc --noEmit ✓   eslint --max-warnings=0 ✓   check 221/221 ✓
      sweep (85 profiles, 0 breaches) ✓   unit 264/264 ✓   safety 65/65 ✓
fns:  sync-shared ✓   tsc ✓   functions tests 34/34 ✓
```

New tests added under `test/unit/`: `coachActionSafety.test.mjs` (15 cases — injury-aware swaps
for every reason, specific-swap compatibility + duplicate guards, the shared invariant gate,
calendar-date validation, and the audit's exact synthetic failure). Updated: `coachActionResolver`
(deload is now an in-place transform), `functions/test/coach.test.mjs` (enable-gate + server action
capability, audit C-009 stale-assertion fix).

---

## P0 — release blockers (both closed)

### C-001 — Canonical injuries/exclusions omitted from server context — FIXED
`functions/src/coachWorkspace.ts` read the non-existent `backend.injuries` and hardcoded
`engineExcludedExerciseIds: []`. It now reads the CANONICAL fields the onboarding contract actually
writes: `backend.affected_regions` and `backend.excluded_exercise_ids`, and surfaces the exclusions
in the coach's safety-approved constraints. Missing/malformed values fall closed to empty arrays.

### C-002 — Coach swaps could select an injury hard-excluded exercise — FIXED
`src/backend/generator/swaps.ts`: injury hard-exclusions (`injuryExcludeIds(affectedRegions)`) are
now applied to EVERY swap candidate for EVERY reason — not only when the model happened to label the
reason `pain`. `requestSpecific` (SW07) additionally refuses an injury-excluded lift outright
(`injury_excluded`). Proven by `coachActionSafety.test.mjs` reproducing the audit's SH02→SH01 case:
a shoulder-injured user's dislike/variety/any-reason swap of SH02 can no longer land SH01/SH08.

---

## P1 / P2 — code-addressable findings (all closed)

### C-003 — Optimistic client writes / swallowed failures / false success — FIXED
`src/overlays/extra.tsx`: for a signed-in user, `commitProgramOutcome` now **persists to the cloud
FIRST**, then applies to the store and claims success only after the durable write resolves. A
failed write leaves the plan unchanged and shows **"Couldn't save" + Retry** instead of a false
"Applied". The proposal card shows **Applying… → Applied** honest timing (demo/local users apply
instantly, which is truthful there). Undo awaits its restore writes. See also C-018.

### C-004 — Specific swap ignored compatibility + program duplicates — FIXED
`requestSpecific` now requires the requested lift to be an **approved substitute** of the one it
replaces (`isCompatibleSwap`: curated substitution list OR same muscle+pattern+type) and rejects a
lift already in the program (`already_in_program`). The resolver passes the in-program id set.

### C-005 — Regeneration left obsolete workout-instance docs — FIXED
`src/backend/repo/programRepo.ts`: `writeActiveProgram` now writes the program + new instances AND
deletes every existing instance for that program not in the new set, **in a single batched commit**,
so a Mon/Wed/Fri → Tue/Thu change can no longer leave contradictory stale weekday docs. Rules already
permit owner `list`/`delete` on `workout_instances`.

### C-006 — Action-only kill switch was client-controlled — FIXED
`functions/src/killSwitchRemote.ts` adds a **server-owned** `coachActionsSwitch`
(`config/coach.actionsDisabled`). `functions/src/coach.ts` gates actions on
`allowActions === true && !actionsDisabled()`, so a modified/stale client sending
`allowActions=true` is refused server-side while advisory chat continues. Owner can disable actioning
live, no redeploy. Test: `functions/test/coach.test.mjs` (surfaced when permitted; downgraded when
disabled server-side).

### C-007 — Imperial preference ignored — FIXED
`coachWorkspace.ts` reads `settings.units` (the app's real unit setting) before falling back to
`profile.units`/metric.

### C-008 — Current program day used UTC — FIXED
`coachWorkspace.ts` names the day in the user's **local timezone** (`localWeekdayName`, stored IANA
tz → Australian market default), so 20:00 UTC Monday is correctly "Tuesday" in Sydney.

### C-011 — Actions inherited generator time/equipment defects — MITIGATED
The shared invariant gate (CA-002, below) runs equipment/skill checks and an estimated
session-duration check (`estimateDayMinutes`, budget +25% tolerance) after every transform. Generated
plans pass (`coachActionSafety.test.mjs`); a transform that produced an over-budget or ineligible plan
is refused before preview/commit. The underlying bodyweight-slot generator gap is unchanged and stays
tracked, but a coach action can no longer surface an unexecutable plan.

### C-012 — Deload regenerated instead of transforming — FIXED
`coachActionResolver.ts`: `deload` now transforms the CURRENT stored program + instances in place
(sets −40%, +1 RIR), preserving exercise identity, substitutions and logged loads. Returns a `patch`,
not a regen. Test updated to assert identity preservation.

### C-013 — Impossible dates passed the regex — FIXED
`src/backend/coach/workoutActions.ts` validates real **calendar** dates (rejects `2026-99-99`,
`2026-02-30`, month/day out of range), enforces end ≥ start and a max span (366 days). Leap days pass.

### C-014 — Proposal controls lacked a11y semantics; motion ignored — FIXED
`extra.tsx`: every proposal control (Confirm / Not now / Publish / swap options / Undo / Retry) has
`accessibilityRole`, label, hint and busy/disabled state. `TypingDots` and the row entrance animation
now honour reduce-motion (`useReducedMotion` / `motionDuration`) and render a static fallback.

### C-015 — Failed context reads silently became empty — FIXED
`coachWorkspace.ts` tracks which context reads FAILED (vs were genuinely empty) and passes a
`contextGaps` note into the snapshot; `contextSelection.ts` renders an **INCOMPLETE CONTEXT** line so
the coach discloses the gap and asks/qualifies instead of asserting "no history/injury".

### C-018 — Server recorded approval, not the terminal outcome — FIXED
`functions/src/coachProfile.ts`: a confirm records `approvedByUser` + `outcome: pending_apply` and
returns the `actionId`. A new **`recordCoachActionOutcome`** callable advances the journal to
`applied` / `failed` / `rolled_back` (redacted reason codes only, idempotent terminal states). The
client reports the real outcome after applying/failing/undoing. `actions` remains server-write-only
in the rules with owner read.

### CA-002 — One shared post-transform invariant gate — ADDED
`src/backend/runtime/programInvariants.ts` (`validateProgramForUser`): after EVERY program-mutating
outcome (swap patch, goal/day/session regen, deload) the resolver runs the gate over injuries,
exclusions, equipment, skill, duplicates and duration BEFORE returning it for preview/commit; a
violation refuses the change and keeps the prior plan. The model may choose intent, never the safety
policy.

---

## Owner-only residual items (cannot be closed by code)

These are process / infrastructure / human-review actions. The code scaffolding each needs is in
place; the owner must perform the action and record it.

- **C-009 — Branch protection / exact-SHA release gate.** A `main` ruleset requires status checks +
  "branches up to date". **Required checks must be `sweep`, `e2e`, `Rules + sanitisation tests`** —
  these run on every PR to `main`. Do **NOT** require `validate` (it is the nightly
  `backend-validation` job; it never runs on a PR, so requiring it blocks every merge). This branch
  loosened the `e2e` and `security-rules` `pull_request` triggers to run on all PRs to `main` (a
  path-filtered required check silently blocks PRs that don't touch those paths). The stale
  `coach_disabled` functions test that caused the original red gate is also corrected here.
- **C-016 — App Check enforcement.** `APP_CHECK_ENFORCED` is still monitor-mode by design (no native
  app is attesting yet). Follow `docs/APP_CHECK.md`: measure legitimate-attestation telemetry, then
  flip enforcement with a rollback drill. Owner decision + release build.
- **C-017 — Independent live coach evaluation.** Run the 60-case controlled suite (report §6) with
  two blind reviewers against the exact release SHA and attach the scored artifact. Requires an
  isolated key, a staging account and an approved cost envelope — an owner action, not code.

## Follow-ups worth scheduling (not release-blocking)

- Persist an IANA timezone from the client so C-008 uses the device tz rather than the AU default.
- Server-authoritative action command (CA-003) — move the mutation itself behind an idempotent,
  versioned Cloud Function with before/after hashes. This branch closes the observable false-success
  and audit-trail defects (C-003/C-018) client-side; the fully server-authoritative commit is the
  larger follow-up the report scopes as XL.
