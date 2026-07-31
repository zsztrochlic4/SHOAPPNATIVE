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
  - `APP_CHECK_ENFORCED` — the single on/off switch (currently `false`).
  - `auditAppCheck(req, label)` — soft observability: logs `appcheck.missing`
    when a call arrives without a verified token, but never rejects.
  - `requireAppCheck` / `requireVerifiedUser` — hard checks (used by the gated
    `coachMessage`).
- Each callable (`analyzeMeal`, `deleteAccount`, `sendNotification`) sets
  `enforceAppCheck: APP_CHECK_ENFORCED` and calls `auditAppCheck(...)` first, so
  flipping the one flag enforces everywhere consistently.

## Rollout — monitor, then enforce

### 1. Register an App Check provider (console)
- Firebase console → **App Check** → your app.
- **Android:** Play Integrity. **iOS:** App Attest (needs the paid Apple
  Developer account). **Web:** reCAPTCHA (the site key already wired via
  `EXPO_PUBLIC_APPCHECK_RECAPTCHA_KEY`).

### 2. Initialise App Check in the client
- Initialise the App Check SDK at app start (after `initializeApp`), using the
  provider(s) from step 1, so the client starts attaching tokens to every
  callable + Firestore request. Ship this in an app build.

### 3. Monitor (no enforcement yet)
- With `APP_CHECK_ENFORCED = false`, calls still succeed, but every untokened
  call logs `appcheck.missing`. Watch **Functions logs** (and the App Check
  metrics page → "verified vs unverified requests").
- Wait until essentially **all real traffic is verified** — i.e. all live app
  builds from step 2 are attesting. Old builds without App Check will show up as
  unverified; give them time to update.

### 4. Enforce
- Flip **`APP_CHECK_ENFORCED = true`** in `functions/src/lib/guards.ts`.
- (Optional, stricter) In the console, enable enforcement for **Firestore** and
  **Storage** too.
- `cd functions && npm run build` then `firebase deploy --only functions`.
  > Note: a functions deploy also redeploys `analyzeMeal` — confirm the
  > `GEMINI_API_KEY` secret is set first, or that function will fail at runtime.

### 5. Rollback
- If legitimate users get `failed-precondition` / App-Check errors: set
  `APP_CHECK_ENFORCED = false`, rebuild, redeploy. One line, one place. Disable
  Firestore/Storage enforcement in the console if you enabled it.

## Guardrails
- Do **not** enable enforcement in the console or set the flag `true` until steps
  1–3 are done and metrics show the live app is attesting.
- `coachMessage` already hard-requires App Check, but it is a disabled stub, so it
  has no effect on the live app.
- Tests (`functions/test/guards.test.mjs`) assert `APP_CHECK_ENFORCED === false`,
  so an accidental flip in the repo fails CI — intentional flips update the test.
