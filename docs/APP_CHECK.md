# App Check (Option B) — owner rollout runbook

App Check ensures that **only your genuine, unmodified app** can call the backend
(Cloud Functions) and — optionally — read/write Firestore/Storage. It closes
Blocker #4. This is "Option B": the **backend** verifies an attestation token on
every callable.

The **code** for this is already in place and safe to ship. The remaining steps
are console/client actions only **you** can take. Enforcement is deliberately
**OFF** until you finish them — turning it on early would reject the live app's
own calls (e.g. the meal scan), because the client isn't attesting yet.

## Where it lives in the code

- `functions/src/lib/guards.ts`
  - `APP_CHECK_ENFORCED` — the single on/off switch, now **config-driven**
    (audit SA-019): `process.env.APPCHECK_ENFORCE === '1'`. Default OFF. Flip it
    per environment with an env var + redeploy — **no code edit**, easy rollback.
  - `auditAppCheck(req, label)` — soft observability: logs `appcheck.missing`
    when a call arrives without a verified token, but never rejects.
  - `requireAppCheck` / `requireVerifiedUser` — hard checks (used by the gated
    `coachMessage`).
- Each callable (`analyzeMeal`, `deleteAccount`, `reportClientError`,
  `sendNotification`, `coachMessage`) sets `enforceAppCheck: APP_CHECK_ENFORCED`
  and calls `auditAppCheck(...)` first, so enabling the env var enforces
  everywhere consistently.
- **Community hub callables are on the same path** — `claimUsername`,
  `syncCommunityStats`, `globalStreaks`, `appealStanding`, `resolveStandingReview`
  (community.ts); `createGroup`, `joinGroupByPasscode`, `joinGroupByCode`,
  `leaveGroup`, `deleteGroup`, `setGroupGoal`, `cheerGroupActivity`
  (communityGroups.ts); `reportContent`, `resolveContentReport`
  (communityModeration.ts); `refreshCommunityMetrics` (communityMetrics.ts) all set
  `enforceAppCheck: APP_CHECK_ENFORCED`. The scheduled functions (`rolloverLeagues`,
  `grantStreakFreezes`, `reprocessStandings`, `pruneScoreLog`,
  `computeCommunityMetrics`) are not client-facing and are correctly exempt.
- **Regression guard:** `test/unit/appcheckCoverage.test.mjs` fails the unit build
  if any `onCall` in the community/coach/account/notifications/observability files
  omits `enforceAppCheck: APP_CHECK_ENFORCED`, so a new callable can't silently ship
  unprotected.
- `src/lib/appCheck.ts` — client wiring, invoked at startup from
  `src/lib/firebase.ts` (`initAppCheck(app)`).
  - **Web is fully wired** (reCAPTCHA Enterprise, debug-token support, auto-refresh).
  - `appCheckStatus()` — a diagnostic snapshot (platform / key configured / active /
    attestable-now) to confirm the client is attesting during the monitor phase.

## Rollout — monitor, then enforce

### 1. Register an App Check provider (console)
- Firebase console → **App Check** → your app.
- **Android:** Play Integrity. **iOS:** App Attest (needs the paid Apple
  Developer account). **Web:** reCAPTCHA (the site key already wired via
  `EXPO_PUBLIC_APPCHECK_RECAPTCHA_KEY`).

### 2. Initialise App Check in the client
- **Web: already done.** `initAppCheck(app)` runs at startup once
  `EXPO_PUBLIC_APPCHECK_RECAPTCHA_ENTERPRISE_KEY` is set and the console is
  configured. Set the key in your web build env and the client starts attaching
  tokens automatically. Verify with `appCheckStatus().active === true`.
- **Native (iOS/Android): a build step you still own — but the client bridge is now DRAFTED.**
  The `firebase` **JS SDK** only supports the web reCAPTCHA provider — it cannot do App Attest /
  Play Integrity. So the app attests with the native module and feeds that token into the JS SDK
  via a `CustomProvider`. That bridge lives in **`src/lib/appCheckNative.ts`** (⚠️ UNTESTED — never
  run on a device; verify each step). It is intentionally dormant — not in the import graph and
  guarded — so today's JS-SDK-only managed build is unchanged. Activation checklist:

  1. **Register the iOS & Android apps** in the Firebase project (only a WEB app exists today — see
     the firebase-verified-state note). Download `GoogleService-Info.plist` (iOS) and
     `google-services.json` (Android); reference them via `ios.googleServicesFile` /
     `android.googleServicesFile`.
  2. Firebase console → **App Check** → register **iOS = App Attest** (needs the paid Apple
     Developer account) and **Android = Play Integrity**.
  3. `npx expo install @react-native-firebase/app @react-native-firebase/app-check`
     — `app.config.js` then auto-appends their config plugins and turns on the iOS App Attest
     entitlement (a guarded no-op until the packages resolve).
  4. In **`src/lib/appCheck.ts`**, uncomment the two marked `./appCheckNative` lines (the import and
     the native branch inside `initAppCheck`). That is the only code edit.
  5. Build a **dev/EAS build** (App Attest / Play Integrity do NOT work in Expo Go). In `__DEV__`
     the bridge uses the **debug** provider — register the printed debug token in the console
     (DEV/STAGING only, never ship it). Release builds use App Attest / Play Integrity.
  6. On a real device confirm `appCheckStatus().active === true` and that Functions logs stop
     logging `appcheck.missing` for that client.

  Until native ships, keep enforcement scoped so native calls aren't rejected (enforce per-service,
  or keep monitor mode for the mobile clients).

### 3. Monitor (no enforcement yet)
- With `APP_CHECK_ENFORCED = false`, calls still succeed, but every untokened
  call logs `appcheck.missing`. Watch **Functions logs** (and the App Check
  metrics page → "verified vs unverified requests").
- Wait until essentially **all real traffic is verified** — i.e. all live app
  builds from step 2 are attesting. Old builds without App Check will show up as
  unverified; give them time to update.

### 4. Enforce
- Set the env var **`APPCHECK_ENFORCE=1`** for the functions (no code edit):
  - `firebase functions:secrets:set APPCHECK_ENFORCE` (or a param/`.env`), then
  - `cd functions && npm run build && firebase deploy --only functions`.
  > Note: a functions deploy also redeploys `analyzeMeal` — confirm the
  > `GEMINI_API_KEY` secret is set first, or that function will fail at runtime.
- (Optional, stricter) In the console, enable enforcement for **Firestore** and
  **Storage** too.

### 5. Rollback
- If legitimate users get `failed-precondition` / App-Check errors: set
  `APPCHECK_ENFORCE=0` (or unset it) and redeploy. One env var, easy to roll back.
  Disable Firestore/Storage enforcement in the console if you enabled it.

## Guardrails
- Do **not** enable enforcement in the console or set the flag `true` until steps
  1–3 are done and metrics show the live app is attesting.
- `coachMessage` already hard-requires App Check, but it is a disabled stub, so it
  has no effect on the live app.
- Enforcement is now driven by `APPCHECK_ENFORCE` (default OFF), so there is no
  hardcoded flag to flip by accident in the repo; turning it on is an explicit,
  reversible deploy-env change. CI runs without the var set, so it stays in
  monitor mode there.
