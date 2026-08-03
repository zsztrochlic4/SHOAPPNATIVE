# Second Independent Full-Scale Audit — Remediation Record

**Source:** StrengthHub Online — Independent Full-Scale Audit, 2 August 2026 (NO-GO, 58/100).
**This branch:** `claude/strengthhub-audit-remediation-058763`.
**Scope of this record:** what was changed in code in response to each finding (SA-001…SA-020),
and the residual items that require an **owner action** (they cannot be closed by code alone).

The verification gate for everything below passes locally:

```
tsc --noEmit ✓   eslint --max-warnings=0 ✓   sweep (85 profiles, 0 breaches) ✓
unit 216/216 ✓   safety 61/61 ✓   periods 221/221 ✓
```

New regression/failure-injection tests added under `test/unit/`:
`resetGuards`, `completionQueueCore`, `activeWorkoutRuntimeKey`, `storageScale`,
`reportThrottle`, `coachRequestControls`.

---

## P0 — release blockers (both closed)

### SA-001 — Authenticated demo reset could rewrite/delete cloud data — FIXED
Three layered, independently-sufficient guards, all driven by one pure, tested policy
(`src/store/resetGuards.ts`):
1. **Dispatch guard** (`src/store/store.tsx`) — `RESET_DEMO` is dropped for any real account
   (`canDispatchDemoReset`).
2. **Cloud guard** (`src/store/CloudSync.tsx`) — a `demo` snapshot can never be written to an
   account's cloud copy (`canSyncSnapshot`); `buildSeed()` sets `demo:true`, real state is always
   `demo:false`.
3. **UI guard** (`src/overlays/index.tsx`) — the control is only shown in the anonymous demo
   (`canOfferDemoReset`).
Test: `test/unit/resetGuards.test.mjs` proves a signed-in account cannot replace cloud state with seed.

### SA-002 — Deletion was data-first / Auth-last and reported partial failure falsely — FIXED
`functions/src/account.ts` rewritten **AUTH-FIRST**: (0) tombstone → (1) disable login + revoke
refresh tokens → (2) delete Firestore + Storage → (3) delete the Auth record. If step 1 fails,
nothing was destroyed and the client truthfully says "Nothing was deleted." Once the identity is
revoked the client **never** claims nothing was deleted — it reports an in-progress, resumable
deletion, using `error.details.accountDisabled` (`src/auth/AuthProvider.tsx`, `src/overlays/index.tsx`).
Because a disabled account can't sign in to retry, a scheduled sweep (`resumeAccountDeletions`,
every 30 min) finishes any stuck job with Admin privileges. Idempotent/resumable throughout.

---

## P1 — production reliability

### SA-003 — Progression retry non-atomic / double-advance — FIXED
`src/backend/repo/setLogRepo.ts`: the read-advance-write now runs inside a Firestore transaction
gated on a per-instance `progression_applied` marker on the `workout_instances` doc (no new
collection/rule). Atomic (concurrent runs serialise; only one advance commits) and idempotent
(a retry sees the marker and no-ops). Set logs + instance status stay merge-idempotent outside the tx.

### SA-004 — Completion queue swallowed persistence failures — FIXED
`src/backend/repo/completionQueue.ts` + `completionQueueCore.ts` (pure, tested): `writeQueue` now
reports success; `enqueueCompletion` returns a `{durable, synced}` status. If the local persist
fails it attempts a direct sync; only when BOTH fail is the completion `durable:false`, which
`ActiveWorkout` surfaces honestly ("saved on this device, couldn't sync yet") instead of a false
"logged". Test: `completionQueueCore.test.mjs`.

### SA-005 / SA-020 — Global runtime key / local health data after sign-out — FIXED
Active-workout runtime is UID-scoped (`src/screens/activeWorkoutRuntime.ts`, `runtimeStorageKey`) —
account B can't resume account A. Sign-out AND deletion run one shared `scrubLocalAccount`
(`src/auth/AuthProvider.tsx`) clearing AppState, coach cache, runtime, completion queue, reminders
and push token. Tests: `activeWorkoutRuntimeKey.test.mjs`.

### SA-007 / SA-008 / SA-009 — Storage/hydration scale — FIXED
- **SA-007** local persist is bounded (`src/store/localPersistBound.ts`, wired in `store.tsx`): the
  device cache trims the heavy slices; cloud holds the full history. Plus a document-size budget
  (`estimateRootDocBytes`) with an upper-bound test proving the root doc stays < 700 KiB for a
  ~10-year account.
- **SA-008** category-specific, **cursor-based** paging (`cloudRepo.loadCategoryPage`,
  `loadRemainingHistory(uid, keys)`); no single call issues an unbounded read.
- **SA-009** cross-device root conflicts merge field-level 3-way against the loaded baseline
  (`src/store/conflict.ts` `resolveRootConflict`, wired into `saveUserState`) — the other device's
  edits are never silently clobbered. Tests: `storageScale.test.mjs`.

### SA-011 — Coach idempotency / burst / global cost / cancellation — FIXED (coach stays gated OFF)
`src/backend/coach/requestControls.ts` (pure, tested) + `functions/src/coach.ts` +
`functions/src/lib/rateLimit.ts`: a client-supplied `requestKey` (reused on retry) is claimed once
server-side so a retry returns the first result instead of a second model call; per-user **burst**
and **global daily** caps run before the model; `coachMessage` gets its own `maxInstances`/`concurrency`.
Client key plumbed in `coachServer.ts`/`coachRequestKey.ts`/`extra.tsx`. Test: `coachRequestControls.test.mjs`.
(Note: idempotency + the client seq-guard neutralise the cost of a cancelled-then-retried turn; true
in-flight model abort is left as a follow-up as it depends on the model SDK's signal support.)

### SA-014 — No remote crash/SLO monitoring — FIXED
The `reportError` seam is now wired to the backend (`src/lib/remoteErrorReporter.ts` →
`functions/src/observability.ts reportClientError`): every crash emits an alertable, redacted Cloud
Logging entry and bumps a daily counter; the scheduled `monitorSlo` emits `slo_breach` (ERROR) when
the daily error count crosses threshold. Throttle is pure/tested (`reportThrottle.ts`).

### SA-015 — Deploy lineage unproven — TOOLING ADDED (owner runs at deploy)
`scripts/record-release.mjs` (`npm run record:release`) writes a committed
`docs/RELEASE_ATTESTATION.json` — git SHA + content hashes of `firestore.rules`, `storage.rules`,
`firebase.json`, indexes and `functions/src` — so a reviewer can confirm the deployed artefacts
match the reviewed source. **Owner action:** run it at each production deploy and commit the result.

### SA-019 — App Check monitor-only — CONFIG-DRIVEN (owner enables)
`functions/src/lib/guards.ts`: `APP_CHECK_ENFORCED = process.env.APPCHECK_ENFORCE === '1'` — flip to
enforce per-environment with no code change. **Owner action:** finish native attestation
(App Attest / Play Integrity) then set `APPCHECK_ENFORCE=1` and redeploy (docs/APP_CHECK.md).

### SA-016 — Old-history edits affected today/progression — FIXED
`COMPLETE_WORKOUT` marks the session's OWN day, never today (`src/store/store.tsx`); the
progression re-advance is prevented by the SA-003 applied-marker.

## P2 — accessibility & premium finish

### SA-012 / SA-013 — Accessibility — SUBSTANTIALLY ADDRESSED
- Focus management: sheets move screen-reader focus to the header on open
  (`src/lib/a11y.ts` `useFocusOnOpen`/`focusRef`, wired into all three `Sheet.tsx` surfaces);
  `MenuDetailPanel` and `BarePanel` now set `accessibilityViewIsModal`.
- Chart alternatives: `src/components/AccessibleChart.tsx` gives a `role="image"` + text summary;
  applied to the readiness `IndexGauge` (decorative SVG hidden from AT).
- Reduced motion: a global, user-overridable preference (`a11y.ts` `setReducedMotionPreference`,
  `motionDuration`); the FinishSheet celebration and the IndexGauge needle now respect it.
- Control names: representative raw controls labelled (e.g. Progress time-range tabs with `selected`).
- **Remaining (ongoing / owner):** exhaustive labelling of every raw `Pressable`, and the
  large-text / landscape / tablet / small-device matrix (a device-testing activity).

### SA-017 — Account/privacy/health/security settings — PARTIALLY ADDRESSED
Added: **Follow-system theme** (`Theme='system'`, resolved in `theme.tsx`), a separate **Haptics**
toggle (gated in `lib/haptics.ts`), and an in-app **Reduced-motion** override (Accessibility group).
**Remaining (owner / larger features):** password/email change, active-session list, MFA/device
revocation, retention & analytics consent, allergies/nutrition prefs editor, text-size control.

### SA-018 — Design-token enforcement — PARTIALLY ADDRESSED
Motion and haptic behaviour are now centralised (`a11y.ts`, `haptics.ts`). The broader token sweep
(spacing/colour/type primitives across ~168 hard-coded hex / 273 raw Pressables) remains an ongoing
enforcement effort.

---

## Owner-only items (cannot be closed in code)

These are release gates the audit correctly flags; the code + reviewer/test artifacts are ready, but
the final action is the owner's. Each now has a prepared, signable/runnable artifact:

1. **SA-006 — Generated-program sign-off** — **CLEARED.** The owner recorded the accredited
   reviewer + accreditation number in `signOff.ts` `PROFESSIONAL_SIGNOFF`, so `platformCleared()`
   now returns ok and real-user program generation is enabled. (The AI coach remains a separate
   gate — `COACH_ENABLED` — still off pending SA-010.) Reviewer checklist: **`docs/PROGRAM_SIGNOFF.md`**.
2. **SA-010 — Coach shipping-SHA holdout** — harness + datasets exist (`npm run validate:holdouts`).
   Signable reviewer record + fresh-set process: **`docs/COACH_HOLDOUT_SIGNOFF.md`**. Owner: run a
   fresh holdout, an independent reviewer signs (0 critical misses, FP<5%). Coach stays `COACH_ENABLED=false`.
3. **SA-015 (live)** — run `npm run record:release` against the real deploy and commit the attestation.
4. **SA-019 (live)** — web attestation is wired; add native (`@react-native-firebase/app-check` in a
   dev build) per **`docs/APP_CHECK.md`**, then set `APPCHECK_ENFORCE=1`.
5. **SA-014 (live)** — run **`scripts/setup-monitoring.sh`** (see `docs/monitoring/ALERTING.md`) to
   attach the alert policy to the `client_error` / `slo_breach` signals.
6. **Device / load evidence** — plans + a k6 skeleton are ready:
   **`docs/DEVICE_TEST_PLAN.md`**, **`docs/LOAD_TEST_PLAN.md`**, `scripts/load/coach-load.js`. Owner:
   run on real iOS/Android + staging load, incl. a coach burst/kill-switch drill.
