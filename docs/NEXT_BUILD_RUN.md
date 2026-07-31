# StrengthHub Online — Next Build Run (autonomous)

**Prepared:** 2026-07-31 · **Target:** a multi-hour, self-paced Claude Code run
**Starting point:** branch `feat/quick-workouts-12min` @ `82982eb` (9 commits ahead of `main`, PR #7 open + mergeable)

> ## ✅ Executed — 31 July 2026
> This run is complete. Each track shipped as its own PR, stacked linearly so
> every diff is self-contained; the gate was green after every commit. Merge
> **bottom-up**, starting from PR #7.
>
> | Track | PR | Base |
> |---|---|---|
> | (existing) 12-min workouts | **#7** | `main` |
> | 1 — live Firestore workouts overlay | **#8** | #7 |
> | 3 — pure-domain test coverage | **#9** | #8 |
> | 2 — quick-player hardening + a11y | **#10** | #9 |
> | 4 — "Download my data" export | **#11** | #10 |
> | 6 — accessibility / reduce-motion sweep | **#12** | #11 |
> | 5 — App Check Option B scaffolding | **#13** | #12 |
> | 7 — docs refresh | this PR | #13 |
>
> Final gate: **tsc clean · sweep 85/85 · unit 128 · safety 29 · functions 13 ·
> lint · validate:data 3/3 · web boots clean.** Owner-only items (merges, App
> Check console flip, GEMINI secret, coach sign-off, on-device feel) are listed
> at the bottom of this doc — none were done autonomously, by design.

This is a runbook, not a wish list. Every track below is (a) autonomously actionable with no owner in the loop, (b) independently shippable as its own branch/PR, and (c) ends with a **green gate**. Work top-to-bottom; if a track blocks, skip it and move on rather than stalling the run.

---

## 0. Guardrails for the autonomous run (read first)

These are hard rules carried over from every prior session. The run must **not**:

- **Flip `COACH_ENABLED`** or otherwise enable the AI coach. It stays gated until the crisis classifier is validated *and* an accredited exercise professional signs off. (See memory: `coach-safety-guardrail-gate`, `coach-detection-classifier`.)
- **Enforce App Check** in the Firebase console, or do anything that would block the live app's AI calls.
- **Deploy** Cloud Functions, **submit** to app stores, or run an **EAS production build**.
- **Merge to `main`** or force-push. Open PRs and leave them for owner review.
- **Run destructive Firestore writes.** `workouts:upload`, `recipes:upload`, etc. stay dry-run unless the owner explicitly runs them with `--apply`.
- **Touch the hard safety envelope** (S01–S09 floors, Screening Outcomes, Age Routing, Injury Modifications) without it going through the mapping module and the sweep.

Working mode: one track = one branch off `feat/quick-workouts-12min` (or off `main` once PR #7 merges) = one PR. Keep the gate green after **every** commit.

### The gate (run before committing, every track)
```bash
npm test          # typecheck + check + sweep(85/85) + test:safety + test:unit
npm run lint      # prettier --check scripts/**
npm run validate:data
```
Current baseline is **all green**: tsc clean · sweep 85/85 zero breaches · validate:data 3/3 · unit 93/93 · lint pass. Do not open a PR that regresses any of these.

---

## Track 0 — Baseline + land PR #7 (owner gate) · ~10 min

1. Re-run the full gate on `feat/quick-workouts-12min` to confirm the inherited baseline is still green.
2. **PR #7** (12-minute workouts) is mergeable and green. Merging is an owner call — do **not** auto-merge. Leave a comment confirming the gate is green and that it's ready. Subsequent tracks branch off this branch so they don't block on the merge.
3. Decide the untracked `docs/StrengthHub-Online-Features.docx` (feature overview, 30 Jul): it's a documentation artifact, not code. Leave it for the owner to file — don't commit a binary silently.

---

## Track 1 — Live Firestore overlay for workouts · ~45 min

**Why:** the only feature item explicitly deferred by PR #7. `scripts/upload-workouts.mjs` already creates a `workouts` collection, but the app reads only the bundled `src/data/quickWorkouts.generated.ts`. Add a live overlay so workbook edits surface without an app release — exactly like exercises and recipes already do.

**Pattern to mirror:** [`src/data/exerciseInfo.ts`](src/data/exerciseInfo.ts) and [`src/data/recipes.ts`](src/data/recipes.ts) — bundled base → cached cloud snapshot (AsyncStorage) → live `getDocs(collection(db,'workouts'))`, `useSyncExternalStore` hook, Firestore never required (offline/demo keeps the bundle).

**Steps:**
1. New `src/data/quickWorkouts.ts` overlay module: `BASE` from the generated seed, `CACHE_KEY = 'sho.quickWorkouts.cloud.v1'`, a `getQuickWorkouts()` + `useQuickWorkouts()` hook.
2. Point `QuickWorkoutsSheet` (`src/overlays/index.tsx`) and `startQuick` at the hook instead of the static import. **Keep station `exercise_id`s resolving to the technique sheet** (the whole point of the real ids).
3. Overlay must be **display-only** — `workSec`/`restSec`/`roundRestSec`/circuit order come from the bundle; the cloud doc may only override display fields (name, level badge, repHint, station labels). Never let a cloud doc change timing logic silently.
4. Pure merge function `mergeWorkoutOverlay(base, cloud)` in its own file → unit tests (missing doc, partial doc, unknown id ignored, timing fields non-overridable).

**Verify:** gate green + web render-trick (all 8 still render, ordered, badged). No device needed.

---

## Track 2 — Quick-workout player hardening · ~45 min

**Why:** the time-based player shipped but its *feel* is unverified on device, and timers are the classic place for correctness bugs. Harden the logic that a browser *can* verify and add regression tests.

**Steps (use the `sho-premium-feel` skill):**
1. Extend `src/screens/quickCircuit.ts` tests: single-round workout, per-side "switch halfway" boundary (odd `workSec`), final station of final round (no trailing round rest), transition-vs-round-rest selection. Aim to cover every branch of the circuit builder.
2. Audit the countdown in `src/screens/ActiveWorkout.tsx`: confirm it advances at 0 without a tap, that backgrounding/foregrounding doesn't double-fire `logSet`, and that the "switch sides halfway" cue fires once. Extract any impure timing math into a testable pure helper if it isn't already.
3. Accessibility labels on the player controls (work/rest/skip), respect reduce-motion for the countdown ring.

**Verify:** gate green + render-trick. Flag anything that genuinely needs a device as a follow-up (don't fake device verification).

---

## Track 3 — Pure-domain test coverage (§5 of the readiness plan) · ~40 min

**Why:** cheapest durable risk reduction; extends the pattern that already added quietHours/date/nutritionCoach/historyMerge/workoutSummary tests.

**Targets (all node-safe under `tsconfig.sweep`):**
- `src/store/metrics.ts` — the redesigned Progress selectors (strengthProgress, oneRMSeries, bestLiftId, volumeByWeek) on edge inputs: empty history, one session, tie-breaks.
- `src/store/historyMerge.ts` — collision recency-wins already tested; add out-of-order dateKeys + duplicate ids across pages.
- `src/lib/mealScanParse.ts` — clamp boundaries + food/non-food gate.
- `src/store/workoutSummary.ts` — Epley re-derivation vs raw-session re-derivation parity on a fixture.

Add any newly-tested module to `tsconfig.sweep.json` if not already present. Goal: raise the suite meaningfully above 93 with cases that would actually catch a regression, not filler.

**Verify:** `npm run test:unit` green, count goes up.

---

## Track 4 — "Download my data" export (GDPR companion to deletion) · ~50 min

**Why:** in-app account **deletion** shipped (`deleteUserData` in `src/store/cloudRepo.ts`), but the privacy policy's data-access right has no in-app path. This is the natural pair and it's fully client-side buildable.

**Steps:**
1. Reuse the subcollection enumeration from `deleteUserData` to build `exportUserData()` in `cloudRepo.ts` → a single JSON object of all 14 per-user subcollections + the scrubbed root.
2. Pure `serializeUserExport(state)` module + tests (stable key order, no `undefined`, dates as ISO).
3. Settings button next to "Delete account" (real-auth mode only), writes via `expo-file-system` + `expo-sharing` share sheet. Guard native-only like the existing deletion button.
4. Update `docs/PRIVACY.md` + `docs/DATA_SAFETY.md` to state the export path exists.

**Verify:** gate green + typecheck. Native share can't run in web preview — note that; verify the serializer via unit test.

---

## Track 5 — App Check Option B, code-side only · ~30 min

**Why:** Blocker #4. Enforcement is an owner console action, but the **backend-verified** scaffolding can be advanced now without turning anything on.

**Steps:**
1. In `functions/`, confirm the shared AppCheck guard (`lib/guards.ts`) is wired to every callable and returns a clean typed error when a token is absent — but keep enforcement **off** (no console change).
2. Write `docs/APP_CHECK.md`: the exact owner steps (register app attestation, add the provider client-side, flip enforcement last) and the one-line rollback.
3. Do **not** deploy. `cd functions && npm run build` (tsc) must stay clean.

**Verify:** `functions` tsc clean + functions unit tests green (they're in the per-PR gate).

---

## Track 6 — Accessibility + premium-feel sweep · ~40 min

**Why:** low-risk prop-level polish that raises store-review quality. Use `design:accessibility-review` + `sho-premium-feel`.

**Steps:** touch-target ≥44pt audit on Dashboard/Workout/Nutrition primary actions, `accessibilityRole`/`accessibilityLabel` on icon-only buttons, contrast check on the ink theme tokens, reduce-motion respect on the animated flame/streak + gauge. Keep changes to RN a11y props + token swaps — no layout rewrites.

**Verify:** gate green + render-trick spot-checks (getComputedStyle for contrast).

---

## Track 7 — Docs refresh · ~20 min

Update `docs/DEVELOPMENT_PLAN.md` + `docs/TEST_REPORT.md` to reflect what's actually merged (Phase A–D, Progress redesign, quick workouts) and the new test count. Note which blockers are now closed vs owner-only. Keep it honest — if a track above got skipped, say so.

---

## Suggested order for the run

`Track 0 → 1 → 3 → 2 → 4 → 6 → 5 → 7`

Rationale: Track 1 delivers the one promised deferred feature first; Track 3 (tests) is pure upside and de-risks everything after it; player + export are the next most user-visible; a11y and App Check docs are lower urgency; docs last so they describe what actually landed.

Each track is ~30–50 min including its gate, so the sequence is a comfortable **4–6 hour** run. If time runs short, everything before the stopping point is already a clean, independently-mergeable PR.

---

## Owner-only — NOT part of the autonomous run

These need you (console / billing / legal / a device) and are called out so the run doesn't pretend to do them:

- **Merge PR #7** and any PRs the run opens.
- **App Check:** flip enforcement in the Firebase console (after Track 5's doc).
- **Confirm the `GEMINI_API_KEY` secret** is set on the deployed `analyzeMeal` function (still unverified per memory).
- **Coach:** commission the accredited-professional sign-off + validate the crisis classifier on Jack's holdout. Until both, coach stays gated.
- **On-device feel:** the swipe gestures (#3/#4) and the new time-based player need a real Android device (dev build `8d9d3523…` predates netinfo — a **fresh `eas build --profile development`** is required) and, for iOS, a Mac or the $99 Apple program.
- **EAS:** define the rollback/runtimeVersion channel policy (`eas init` bits) and store-listing completeness.
- **Marketing site:** publish `docs/PRIVACY.md` at strengthhubonline.com/privacy; finish DNS verify on the custom email domain.

---

## How to launch the run

From an interactive session:
```bash
claude
```
then paste: *"Execute docs/NEXT_BUILD_RUN.md top to bottom. One branch + PR per track, keep the gate green after every commit, respect the guardrails in section 0, and stop to report if any track needs an owner."*

Or use `/loop` to have it self-pace through the tracks.
