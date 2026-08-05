# Audit rerun (b7e9cf9) — owner follow-up runbook

The code-actionable findings (R5-001, R5-004, R5-005, R5-006, R5-007, R5-009, R5-010, R5-012, R5-015)
are fixed in PR #40. The items below need console access, credentials, physical devices, a paid model
key, or a fitness-reviewer decision, so they are **owner tasks**. Each has exact steps.

Repo: `zsztrochlic4/SHOAPPNATIVE` · Firebase project: `strengthhub-2ab33` (region `australia-southeast2`).

---

## 1. Deploy the new reconciler + index, and wire its alert  *(from PR #40)*

PR #40 adds a scheduled Cloud Function `reconcileCoachActions` and an `actions` collection-group index.
They only take effect once deployed.

```bash
# from repo root, after PR #40 merges to main and you're on main
npm --prefix functions run build
firebase deploy --only functions:reconcileCoachActions,firestore:indexes --project strengthhub-2ab33
```

Then attach a log-based alert so a stranded action journal pages someone:

1. Google Cloud console → **Logging → Logs-based Metrics → Create metric** (project `strengthhub-2ab33`):
   https://console.cloud.google.com/logs/metrics?project=strengthhub-2ab33
   - Type: *Counter*; Filter: `jsonPayload.event="coach_pending_stale"`; name `coach_pending_stale`.
2. **Monitoring → Alerting → Create policy** → condition on that metric `> 0` for 5 min → notification
   channel (email/PagerDuty): https://console.cloud.google.com/monitoring/alerting?project=strengthhub-2ab33
3. (Optional) also alert on `jsonPayload.event="coach_reconcile_query_failed"` (index missing / read fault).

**Done when:** a test pending entry older than 24 h is force-closed to `unresolved`, and a synthetic
`coach_pending_stale` log fires the alert.

---

## 2. R5-005 residual — the last Bodyweight coverage gap  ✅ DONE (PR #46)

**Resolved 2026-08-05 in PR #46** (Option A/B combined). The sweep now prints
`PASSED — 109 profiles, 0 warnings`. Root cause and fix, for the record:

- A genuine **Compound Vertical Pull is biomechanically impossible without a bar/rings/band anchor**,
  so the runbook's original "Option A: add a no-equipment vertical-pull compound" was not real.
- Fix: added an ordered `>` preference to `movementPatternFilter` (mirrors `typeFilter`'s
  `Compound>Isolation`). `Upper-4` is now `"Vertical Pull>Horizontal Pull"` — it fills from the
  preferred pattern and only falls back to a horizontal-pull compound when no vertical-pull option
  exists (i.e. for an equipment-free lifter). Equipped users are provably unaffected (Upper-4 stays
  a vertical pull across every goal × tier).
- Added `BK19 "Door Towel Row"` (towel + sturdy door), the second no-equipment compound back pull,
  so a bodyweight Upper day fills both pull slots without repeating a movement.
- Regression tests added in `test/unit/equipmentInventory.test.mjs`.

<details><summary>Original analysis (superseded)</summary>

After PR #40 the sweep reports **9 profile warnings, and they all reduce to ONE root cause**:

> The Upper/Lower split needs a **Vertical Pull (Back, compound)** on *both* Upper days, but the exercise
> DB has exactly **one** no-equipment vertical-pull movement (`BK16`). The second Upper day's vertical-pull
> slot (`Upper-4`, "Pulldown or chin up pattern") therefore can't be filled for a true no-equipment user.

Pick one (both are content/programming decisions — needs your fitness reviewer, not code I should invent):

- **Option A (recommended): add ≥1 more genuine no-equipment Back/vertical-pull exercise** to the workbook
  (e.g. towel row over a sturdy table, prone floor Y-T-W / "superman" pulls, floor lat pull-over). Set its
  `Required Equipment Tags = none`, tier `Bodyweight`, pattern `Vertical Pull` (or `Horizontal Pull`),
  `type Compound`. Then regenerate the generated data:
  ```bash
  # regenerate exercises.ts + equipmentTags.ts from the workbook (see scripts/upload-exercises.mjs / the
  # generator that produced src/backend/data/exercises.ts), then:
  npm run sweep     # expect: warnings drop to 0
  ```
- **Option B:** make the 2nd Upper-day vertical-pull slot *optional / substitutable with a horizontal pull*
  **for the Bodyweight tier only** in `src/backend/data/sessionTemplates.ts`. This is a template change —
  have the reviewer confirm a horizontal-pull substitute is acceptable programming.

**Done when:** `npm run sweep` prints `PASSED` with 0 warnings, and a Bodyweight plan fills every required slot.

> Note: no user is ever served an *impossible* exercise today (the sweep hard-fails that) — this is a
> completeness gap, not a safety gap, and the coach already refuses to apply a sparse plan.

</details>

---

## 3. R5-002 — hard-gate the classifier benign false-positive rate (needs the paid model)

The FP rate (19.7 % vs 5 % target) can only be re-measured with the live Gemini classifier on the frozen
holdout. The gating + experiment plumbing already exists.

Run the measurement (GitHub → **Actions → "SHO Backend Validation" → Run workflow**):
https://github.com/zsztrochlic4/SHOAPPNATIVE/actions/workflows/backend-validation.yml
- Requires repo secret `GEMINI_API_KEY` (Settings → Secrets and variables → Actions).
- Try the tuning levers (workflow inputs / env): `fewshot=true` (inject `data/fewshot-exemplars.json`),
  `classifier_model` (A/B a stronger model), and set `FP_GATING=hard` once you're satisfied so an
  over-threshold FP rate *fails* the run.
- **Never edit the classifier prompt to fit the holdout** (that's memorising it) and **never trade away
  critical recall** — the pass bar is `0 critical misses AND benign FP ≤ 5 %`.

**Done when:** a recorded run shows `critical_misses = 0` and `false_positive_rate ≤ 0.05`, then flip
`FP_GATING=hard` permanently.

---

## 4. R5-003 — run the paid response-quality evaluation (needs paid key + 2 reviewers)

The gate is hardened (R5-004): it now recomputes SHA-256 over the corpus/replies/prompt and requires the
expected release SHA + model. To actually score the release:

```bash
# 1. Emit the reviewer sheet WITH real model replies (generate replies against b7e9cf9 in an isolated,
#    cost-capped project first; replies.json is { caseId: "model reply text", ... } for all 60 cases).
#    `npm run eval:response` builds .sweep-out itself, so no separate build step is needed:
REPLIES=replies.json MODEL=gemini-2.5-flash-lite RELEASE_SHA=$(git rev-parse HEAD) \
  PROMPT_FILE=path/to/system-prompt.txt npm run eval:response      # writes eval-out/ (sheet + manifest)

# 2. Two INDEPENDENT reviewers each fill a copy of eval-out/reviewer-template.json (all 60 cases × 15 dims).

# 3. Score — the gate recomputes hashes and binds them; expected SHA/model are mandatory:
MODE=score SHEETS=jack.json,sam.json REPLIES=replies.json PROMPT_FILE=path/to/system-prompt.txt \
  EXPECTED_SHA=$(git rev-parse HEAD) EXPECTED_MODEL=gemini-2.5-flash-lite \
  MANIFEST=eval-out/response-eval-manifest.json npm run eval:response
```

**Done when:** the score run prints `"pass": true` (mean ≥ 4.2, critical ≥ 4.0, IRR ≥ 0.75, 0 auto-fails)
and you retain the redacted `eval-out/` bundle as the release evidence.

### ⚠️ Reply-capture: what the offline harness can and cannot do (learned from Reviewer 1)

`npm run eval:replies` (`scripts/generate-coach-eval-replies.mjs`) auto-captures replies to save manual
work, but it is faithful for **normal-coaching cases only** (`multi_turn`, `single_response`):

- **It bypasses the safety router.** In production `coachPrecheckAsync` runs first and BLOCKS/REFERS a
  crisis or adversarial message (with contacts) *before* the coaching model is called. The offline
  harness calls the model directly, so a `safety_sensitive` / `adversarial` reply it generates is NOT
  what the coach would say (this produced a "crisis reply with no contacts" that a reviewer rightly
  flagged). The harness therefore now REFUSES those groups (plus `tool_failure` / `long_context`, which
  need forced failures / long threads) and lists them for capture from the **real coach**.
- **It uses one standard test persona**, so `personalisation` / `context_use` scores are softened — a
  real user with rich history gives the coach more to personalise with. Treat those marks as a soft
  signal, not a verdict.

**For a release-grade result, capture ALL 60 replies from the real coach** (coach-enabled dev/staging
build, safety router live, a realistic user), not the offline harness.

### Reviewers can score in the Word packet — convert it with the parser

Reviewers may score in the human-friendly packet (`StrengthHub_Coach_Review_Packet.docx`) instead of
hand-editing JSON. Convert each filled packet to the gate's reviewer-JSON with:

```bash
node scripts/parse-review-packet.mjs eval-out/<reviewer-1>.docx "Reviewer 1" eval-out/jack.json
node scripts/parse-review-packet.mjs eval-out/<reviewer-2>.docx "Reviewer 2" eval-out/sam.json
# then MODE=score SHEETS=eval-out/jack.json,eval-out/sam.json ... npm run eval:response
```

A case is included only if all 15 dimensions carry a 1–5, so an incomplete pass still fails the gate.

---

## 5. R5-008 — native App Check (App Attest / Play Integrity)

Web wiring exists (`src/lib/appCheck.ts`, reCAPTCHA Enterprise). The **native client bridge is now
DRAFTED (untested)** in `src/lib/appCheckNative.ts` — App Attest / Play Integrity → JS-SDK
`CustomProvider` — and `app.config.js` auto-appends the `@react-native-firebase/*` config plugins +
iOS App Attest entitlement once those packages are installed (guarded no-op until then). It stays
dormant until you install the modules and uncomment the two marked lines in `src/lib/appCheck.ts`.
The remaining work is genuinely device/console-only. See `docs/APP_CHECK.md §Native` for the full
click-by-click checklist. Steps:

1. Firebase console → **App Check** → register the iOS & Android apps with **App Attest** / **Play Integrity**:
   https://console.firebase.google.com/project/strengthhub-2ab33/appcheck
2. Add the native App Check provider in an **EAS dev build** (not Expo Go) and initialise it at startup.
3. Console → App Check → **Monitor** each service (Firestore, Functions, Storage) until the valid-token
   rate is healthy; then **Enforce** service-by-service, with a rollback plan.
4. Flip server enforcement: set `APP_CHECK_ENFORCED = true` (functions `lib/guards.ts`) **after** monitor
   looks clean — do it per service, and test expiry/debug/rollback.

**Done when:** real devices attest, invalid clients are rejected, and no production debug token exists.

---

## 6. R5-011 — require review + release checks on `main` (GitHub ruleset)

This is a repo-settings change only you can make:
https://github.com/zsztrochlic4/SHOAPPNATIVE/settings/rules

Edit the active `main` ruleset (id 20294882) → enable:
- **Require a pull request before merging** → **Require approvals: 1**, **Dismiss stale approvals on push**,
  **Require review from the last pusher**, **Require conversation resolution before merging**.
- **Require status checks to pass** → add the exact check contexts you want mandatory (e.g. the code gate,
  `Security Rules`, `sweep`, and — once secrets are wired — the backend-validation / response-eval jobs).
- (Optional) **Require merge queue**.

**Done when:** a PR cannot merge without 1 independent approval and all selected checks green; a red
scheduled validator or unreviewed change can't reach `main`.

---

## 7. R5-013 — native Firebase-backed E2E + accessibility (device lab)

**Maestro** flows are now DRAFTED (untested) in `.maestro/` — 7 flows covering boot, navigation,
permission, workout, community, background/restart and an accessibility-label baseline, plus a
`.maestro/README.md` and a manual-dispatch CI stub `.github/workflows/native-e2e.yml`. They target
a **demo-mode EAS dev build** (`EXPO_PUBLIC_DEMO_MODE=1`, bundle `com.zaggy887.strengthhub`); run
with `maestro test .maestro`. Selectors came from the code + web e2e, so a few labels need a
first-run refinement (each flow marks them `TODO (on device)`).

The remaining work is infra you provision: a **device lab / CI runners with emulators** (or Maestro
Cloud), the rest of the 18-journey matrix (empty/loading/error/offline/large/conflict states), and
the a11y passes Maestro can't automate — **VoiceOver/TalkBack** order, **200 % text**, **contrast**,
**reduced-motion** (use Xcode Accessibility Inspector / Android Accessibility Scanner). Track under a
`[QA] native E2E` issue and, once green, add the workflow to the `main` ruleset's required checks.

**Done when:** the native matrix gates release builds with 0 P0/P1 accessibility issues.

---

### Quick status
| Item | Who | Blocking release? |
|---|---|---|
| 1. Deploy reconciler + alert | owner (deploy) | no (audit hygiene) |
| 2. Last Bodyweight gap | ✅ DONE (PR #46) | no (completeness) |
| 3. Classifier FP hard-gate | owner + paid key | **yes** |
| 4. Response-quality eval | owner + reviewers | **yes** |
| 5. Native App Check | owner + dev build (client bridge drafted, PR #47) | **yes** |
| 6. Branch protection | owner (GitHub) | governance |
| 7. Native E2E/a11y | owner (device lab); Maestro flows drafted (PR #48) | evidence |
