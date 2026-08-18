# Coach enablement — owner checklist (the finish line)

Everything code/verification/prep is **done and committed**. What remains are real-world actions that
need a live shipping build + your go/no-go. Work top to bottom; the coach `COACH_ENABLED` flag is the
last step.

## Already done (no action)

- ✅ **Automated safety holdout** — production path 0 critical misses (JV + R10). `COACH_RELEASE_STATE.md`.
- ✅ **§23 clinical review** — **waived** by owner decision (Arthur Smith, 2026-08-16, accepted risk).
- ✅ **Two independent reviewers** — 4.70 overall, all critical dims ≥ 4.0, 0 auto-fails, agreement 0.96.
- ✅ **Release-provenance binding** — passes on commit `0dff7ad` (offline capture; re-run on the shipping
  build per step 4 below).
- ✅ **Kill-switch mechanism** — drilled end-to-end on the emulator; `config/coach.killSwitch = false`
  provisioned in production Firestore.
- ✅ **App Check prerequisites** — Android SHA-1 + SHA-256 registered; **Play Integrity** provider
  registered in **monitor** mode.
- ✅ **AD09 / SF03 / SF10 / LC03 / LC05 / AD07 / under_18** behaviour fixes — landed, tested, verified.

## Remaining — all require a live build + your decision (in order)

1. **Ship a real, signed Android build** on real devices (internal track or Play). App Check and the
   production kill-switch drill are only *observable/validatable* once real traffic exists.

2. **App Check → enforce** (only after monitor metrics show your real Android traffic **verified**):
   ```bash
   cd C:\Users\zsztr\OneDrive\Documents\Git\functions
   firebase functions:secrets:set APPCHECK_ENFORCE       # value = 1
   npm run build && firebase deploy --only functions --project strengthhub-2ab33
   ```
   Rollback: set it to `0` (or unset) + redeploy. Add the **Play App Signing SHA-256** (Play Console →
   App integrity → App signing) before enforcing if the app ships via Play. See
   `docs/APP_CHECK_ENFORCEMENT_CHECKLIST.md`.

3. **Enable the coach on an internal build, then run the PRODUCTION kill-switch drill** as the very first
   step (before any public exposure): with the coach live, set `config/coach.killSwitch = true` in
   production Firestore → confirm the coach returns `coach_unavailable` within ~30s **without a
   redeploy** → set it back to `false` → confirm it answers. Record operator + time in
   `docs/monitoring/COACH_KILLSWITCH_DRILL.md`.

4. **Re-run the release-provenance binding on the shipping build** (deployed-endpoint capture at the
   release SHA) per `docs/coach-eval/RELEASE_CAPTURE_RUNBOOK.md` — so the reviewer scores are bound to
   the exact build that ships, not the offline dev capture.

5. **Flip `COACH_ENABLED`** — your deliberate go/no-go, after 1–4. The gate is channel-based:
   `COACH_RELEASE_CHANNEL=internal` for the internal build (step 3), then the reviewed
   production-channel change for release. Update `COACH_RELEASE_STATE.md` + `STATUS.md` in the same
   change, naming the deployed Functions revision + the passing release run.

> Until step 5, the coach is fail-closed and neither the live model nor the on-device fallback answers.
> No one should flip step 5 until steps 1–4 are genuinely complete and recorded.
