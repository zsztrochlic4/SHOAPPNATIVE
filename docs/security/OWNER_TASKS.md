# Owner Task Checklist — Security Hardening go-live

Everything the code side needs is committed and green. This is the ordered list
of tasks **only you can do** (they need the Firebase/Google Cloud console, GitHub
settings, or credentials that aren't in the dev environment). Do the phases in
order — later phases depend on earlier ones. Each task says **what**, **why**,
**steps**, and **done when**.

Project: `strengthhub-2ab33` · region `australia-southeast2` · Blaze.

Legend: 🔴 blocks the production deploy · 🟠 do before enforcing App Check · 🟢 hygiene.

---

## Phase 0 — Safety nets (do first, low risk) 🔴

### 0.1 Create a service-account key (needed for the audit + CI deploy)
- **Why:** the audit script and the CI deploy job need a credential that can read/deploy.
- **Steps:**
  1. Firebase console → ⚙ **Project settings** → **Service accounts**.
  2. Click **Generate new private key** → confirm → a JSON downloads.
  3. Store it somewhere private on your machine (NOT in the repo). Note its path.
- **Done when:** you have `serviceAccount.json` locally and can point `GOOGLE_APPLICATION_CREDENTIALS` at it.

### 0.2 Enable a Firestore backup / recovery 🔴
- **Why:** PITR + delete-protection are currently OFF; a bad deploy or migration must be recoverable.
- **Steps:**
  1. Firebase console → **Build → Firestore Database → Backups** tab.
  2. **Create backup schedule** → daily, retention e.g. 7 days.
  3. Enable **Point-in-time recovery (PITR)** on the `(default)` database (same area / database settings).
  4. Enable **delete protection** on the database (database settings ⋯ menu).
- **Done when:** a backup schedule exists, PITR shows enabled, delete-protection is on.

---

## Phase 1 — Audit production data (the deploy gate) 🔴

### 1.1 Run the read-only schema audit
- **Why:** the hardened rules reject documents that violate the new caps/allowlist/id
  rules. If any *existing* user doc violates them, that user's saves will start
  failing after deploy. This finds them first. The script never writes.
- **Steps** (from the repo root):
  ```bash
  npm install --no-save firebase-admin
  export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json   # Windows PowerShell: $env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\serviceAccount.json"
  npm run audit:schema -- --project production --json audit.json
  ```
- **Read the result:**
  - **`✔ Clean`** (exit 0) → skip Phase 2, go to Phase 3.
  - **`✖ NOT clean`** (exit 1) → note the violation categories printed and the full
    list in `audit.json`, then do Phase 2.
- **Done when:** you have an audit result (clean, or a list of violations).

---

## Phase 2 — Migrate violations (only if the audit was NOT clean) 🔴

### 2.1 Fix the offending documents with a one-time trusted migration
- **Why:** so no legitimate user is locked out when the rules tighten.
- **Steps:**
  1. Look at `audit.json` — each finding has a `rule`, `path`, and `detail`.
  2. For each category, decide the fix (Claude can write this migration for you —
     just share the `audit.json` categories):
     - `unknown-root-field` → delete the stray field.
     - `oversize` → truncate to the cap (or move to a subcollection entry).
     - `plaintext-token` → delete `accessToken`/`refreshToken`/`expiresAt`.
     - `id-mismatch` / `bad-datekey` → rewrite the doc under the correct id, delete the old.
     - `premium-true` → move to `entitlements/{uid}` (server-owned) and set profile.premium false.
  3. Run the migration against production (with the service account), keeping it reversible.
  4. **Re-run the audit (1.1)** until it reports **✔ Clean**.
- **Done when:** `npm run audit:schema` exits 0.

---

## Phase 3 — Staging deploy & smoke test 🔴

### 3.1 Create a staging Firebase project
- **Why:** deploy + test the rules somewhere real before touching production.
- **Steps:**
  1. Firebase console → **Add project** → e.g. `strengthhub-staging` → same region if possible.
  2. In the repo, add it to `.firebaserc`:
     ```json
     { "projects": { "default": "strengthhub-2ab33", "production": "strengthhub-2ab33", "staging": "strengthhub-staging" } }
     ```
- **Done when:** `firebase projects:list` shows staging and the alias resolves.

### 3.2 Deploy rules to staging and smoke-test
- **Steps:**
  ```bash
  firebase deploy --only firestore:rules,storage:rules --project staging
  ```
  Then point a dev build / the web app at staging and exercise: onboarding,
  save/load, a workout, a weight log, a meal, a chat message, program generation,
  set logging, push-token registration.
- **Done when:** every one of those flows works with no `permission-denied` errors.

---

## Phase 4 — Production rules deploy 🔴

### 4.1 Record the current live rules (rollback point)
- **Steps:** Firebase console → Firestore → **Rules** tab → copy the current
  ruleset text somewhere safe (and same for Storage). Note the date/version.
- **Done when:** you have the exact previous rules saved.

### 4.2 Deploy to production
- **Precondition:** Phase 1 clean (or Phase 2 done), Phase 3 smoke test passed.
- **Option A — CLI:**
  ```bash
  firebase deploy --only firestore:rules,storage:rules --project production
  ```
- **Option B — GitHub Action:** run the **Security Rules** workflow (Actions tab)
  with `deploy = true` and `project_id = strengthhub-2ab33`. It won't run unless
  `rules-tests` passes (needs the secret from 8.2).
- **Immediately after:** watch Firestore **permission-denied** metrics for ~30–60 min.
- **Rollback if legit writes fail:** paste the saved previous rules back in the
  console Rules tab and **Publish** (never open dev rules).
- **Done when:** rules deployed, no spike in permission-denied for real users.

---

## Phase 5 — App Check setup (web + native) 🟠

> Do NOT enforce yet — set up + monitor first (Phase 6). Enforcing while native
> clients send no token would break them.

### 5.1 Register the web app + reCAPTCHA Enterprise
- **Steps:**
  1. Firebase console → **Build → App Check → Apps** tab.
  2. Select the **web** app → register → provider **reCAPTCHA Enterprise**.
  3. Create the reCAPTCHA Enterprise key (the flow links to Google Cloud →
     Security → reCAPTCHA; create a key for your production domain(s)).
  4. Put the **site key** in your web build env:
     `EXPO_PUBLIC_APPCHECK_RECAPTCHA_ENTERPRISE_KEY=<site key>`
  5. Configure permitted production domains. Use debug tokens for local/staging only.
- **Done when:** the App Check console shows the web app receiving tokens (verified requests appear once the keyed build runs).

### 5.2 Register iOS + Android and add native App Check (dev-build task)
- **Why:** native currently sends NO App Check token (deliberate null). Needed before any Firestore/Storage enforcement.
- **Steps:**
  1. Firebase console → App Check → register the **iOS** and **Android** apps
     (bundle id `com.zaggy887.strengthhub`).
  2. Add an Expo dev-build-compatible native Firebase App Check module (config
     plugin) — this is a code + EAS dev-build change, not console-only.
  3. Configure **App Attest** (with DeviceCheck fallback) on iOS and **Play Integrity** on Android.
  4. Build dev + release, verify tokens on **physical devices**.
- **Done when:** iOS and Android builds produce verified App Check tokens on real devices.

---

## Phase 6 — Enforce App Check (staged, per service) 🟠

- **Precondition:** token-capable web + iOS + Android clients are shipped and you
  can see their traffic classified **verified** in the console (unenforced).
- **Steps (in this order, watching metrics between each):**
  1. If already launched, wait until ~**99% of supported-client traffic is verified for ≥ 7 days**.
  2. App Check console → **APIs** → enforce **Cloud Firestore**.
  3. Enforce **Cloud Storage**.
  4. Enforce **Firebase AI Logic** — do this **before** enabling the live coach.
- **Rollback:** enforcement can be turned off **per service** instantly if verified clients unexpectedly fail.
- **Done when:** Firestore + Storage (+ AI Logic) enforced with no legitimate-client breakage.

---

## Phase 7 — Public asset cleanup 🟢

### 7.1 Migrate the squat poster off its long-lived token
- **Why:** `Thumbnails/squating.avif` is served via a permanent download-token URL
  (see `src/lib/media.ts`); it should be public via the documented model instead.
- **Steps:**
  1. In the Storage bucket, copy/move `Thumbnails/squating.avif` into `exercises/`.
  2. Revoke the old download token (Storage → the file → ⋯ → manage tokens).
  3. Tell Claude (or edit) `src/lib/media.ts` to point at the public `exercises/` path.
- **Done when:** the squat poster loads from `exercises/` and the old token is dead.

---

## Phase 8 — Repo / CI hardening 🟢

### 8.1 Make the rules test a required check
- **Steps:** GitHub → repo **Settings → Branches → Add branch protection rule** for
  `main` → **Require status checks to pass** → select **Rules + sanitisation tests**
  (appears after the workflow has run once on a PR).
- **Done when:** a PR that fails the rules tests cannot be merged.

### 8.2 Add the deploy secret (only if you'll use the deploy Action)
- **Steps:** GitHub → **Settings → Secrets and variables → Actions → New repository
  secret** → name `FIREBASE_SERVICE_ACCOUNT`, value = the full JSON from 0.1.
- **Done when:** the **Security Rules → deploy-rules** job can authenticate.

---

## Phase 9 — Monitoring (ongoing) 🟢

Set up alerts / dashboards for (plan §12):
- Firestore **permission-denied** errors + failed cloud syncs.
- App Check **verified vs unverified** requests.
- Auth abuse / sign-in failure rates.
- **Blaze billing** alerts + usage spikes.
- Input-sanitisation rejection counts; AI schema-rejection + safety-suppression rates.
- Coach fallback/latency/error rate + per-user call volume (once the coach is live).

---

## Note — the coach stays OFF regardless

`COACH_ENABLED` (`src/backend/coach/coachGate.ts`) stays `false` until: input +
output guardrails in place, the detection classifier **validated on the labelled
holdout**, the professional review complete, **and** App Check enforced on AI
Logic (Phase 6.4). None of the above turns the coach on by itself.

---

### Fast path (if the audit comes back clean)
0.1 service account → 0.2 backups → **1.1 audit (clean)** → 3.1/3.2 staging →
4.1/4.2 production deploy → 5.x App Check setup → 6.x enforce → 7/8/9 cleanup.
