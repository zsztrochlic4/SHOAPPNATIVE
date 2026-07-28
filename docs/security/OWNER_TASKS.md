# Owner Task Checklist — Security Hardening go-live

Everything on the code side is committed, tested, and pushed. This is the ordered
list of tasks **only you can do** — they need the Firebase / Google Cloud console,
GitHub settings, or credentials that don't live in the dev environment. Do the
phases in order; later ones depend on earlier ones.

- **Project:** `strengthhub-2ab33` · region `australia-southeast2` · Blaze plan
- **Repo:** `zsztrochlic4/SHOAPPNATIVE`
- **Priority key:** 🔴 blocks the production rules deploy · 🟠 needed before enforcing App Check · 🟢 hygiene

**Quick console links** (bookmark these):
| Area | Link |
|------|------|
| Firebase project home | https://console.firebase.google.com/project/strengthhub-2ab33/overview |
| Service accounts (keys) | https://console.firebase.google.com/project/strengthhub-2ab33/settings/serviceaccounts/adminsdk |
| Firestore Database | https://console.firebase.google.com/project/strengthhub-2ab33/firestore |
| Firestore Rules tab | https://console.firebase.google.com/project/strengthhub-2ab33/firestore/rules |
| Firestore Usage/metrics | https://console.firebase.google.com/project/strengthhub-2ab33/firestore/usage |
| Cloud Firestore backups/PITR (GCP) | https://console.cloud.google.com/firestore/databases/-default-/backups?project=strengthhub-2ab33 |
| Storage | https://console.firebase.google.com/project/strengthhub-2ab33/storage |
| App Check | https://console.firebase.google.com/project/strengthhub-2ab33/appcheck |
| reCAPTCHA Enterprise (GCP) | https://console.cloud.google.com/security/recaptcha?project=strengthhub-2ab33 |
| Billing / budgets (GCP) | https://console.cloud.google.com/billing |
| Cloud Monitoring alerts (GCP) | https://console.cloud.google.com/monitoring/alerting?project=strengthhub-2ab33 |
| GitHub → branch protection | https://github.com/zsztrochlic4/SHOAPPNATIVE/settings/branches |
| GitHub → Actions secrets | https://github.com/zsztrochlic4/SHOAPPNATIVE/settings/secrets/actions |
| GitHub → Actions | https://github.com/zsztrochlic4/SHOAPPNATIVE/actions |

---

## Phase 0 — Safety nets (do first) 🔴

### 0.1 Create a service-account key
**Why:** the audit script (Phase 1) and the optional CI deploy job need a credential that can read/deploy Firestore. Firebase‑CLI login alone can't read raw documents.
**Where:** [Service accounts](https://console.firebase.google.com/project/strengthhub-2ab33/settings/serviceaccounts/adminsdk)
**Steps:**
1. Open the Service accounts link above (Firebase console → ⚙ **Project settings** → **Service accounts**).
2. Under **Firebase Admin SDK**, click **Generate new private key** → **Generate key**. A JSON file downloads.
3. Move it somewhere private **outside the repo**, e.g. `C:\keys\sho-admin.json`. (As a safety net the repo `.gitignore` now ignores `serviceAccount*.json`, `sho-admin*.json`, `*-firebase-adminsdk-*.json`, and `audit.json` — but keeping the key outside the repo folder entirely is best.)
**Done when:** you have the JSON path noted for later.
**Docs:** https://firebase.google.com/docs/admin/setup#initialize-sdk

### 0.2 Turn on backups + delete protection
**Why:** PITR and delete‑protection are currently **OFF**. A bad rules deploy or a migration must be recoverable.
**Where:** [Firestore backups/PITR (GCP)](https://console.cloud.google.com/firestore/databases/-default-/backups?project=strengthhub-2ab33)
**Steps:**
1. Open the backups link. On the `(default)` database:
2. **Point‑in‑time recovery** → **Enable** (gives you 7 days of continuous recovery).
3. **Backup schedules** → **Create schedule** → daily, retention e.g. 7–14 days.
4. Database **settings** (pencil/⋯ on the database) → enable **Delete protection**.
**Done when:** PITR shows *Enabled*, a daily backup schedule exists, delete‑protection is on.
**Docs:** https://firebase.google.com/docs/firestore/backups · https://firebase.google.com/docs/firestore/use-pitr

---

## Phase 1 — Audit production data (the deploy gate) 🔴

### 1.1 Run the read‑only schema audit
**Why:** the hardened rules reject documents that break the new caps / allowlist / id
rules. If an **existing** user doc breaks one, that user's saves start failing after
deploy. This finds them first and **never writes**.
**Where:** your terminal, in the repo root.
**Steps (PowerShell — your shell):**
```powershell
npm install --no-save firebase-admin
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\keys\sho-admin.json"
npm run audit:schema -- --project strengthhub-2ab33 --json audit.json
```
**Steps (bash equivalent):**
```bash
npm install --no-save firebase-admin
export GOOGLE_APPLICATION_CREDENTIALS=/c/keys/sho-admin.json
npm run audit:schema -- --project strengthhub-2ab33 --json audit.json
```
**Read the result:**
- **`✔ Clean`** (exit 0) → skip Phase 2, go to Phase 3.
- **`✖ NOT clean`** (exit 1) → the categories print to screen; the full list is in `audit.json`. Go to Phase 2.
**Done when:** you have a result (clean, or a violations list in `audit.json`).
**Script:** [`scripts/audit-production-schema.mjs`](../../scripts/audit-production-schema.mjs)

---

## Phase 2 — Migrate violations (only if the audit was NOT clean) 🔴

### 2.1 Fix offending documents with a one‑time, reversible migration
**Why:** so no real user is locked out when the rules tighten.
**Steps:**
1. Open `audit.json`. Each finding has `rule`, `path`, `detail`.
2. Map each category to a fix:
   | `rule` | Fix |
   |--------|-----|
   | `unknown-root-field` | delete the stray top‑level field |
   | `oversize` | truncate to the cap (see [`DATA_SCHEMA.md`](DATA_SCHEMA.md)) |
   | `plaintext-token` | delete `accessToken` / `refreshToken` / `expiresAt` |
   | `id-mismatch` / `bad-datekey` | rewrite under the correct id, delete the old doc |
   | `premium-true` | move to `entitlements/{uid}`, set `profile.premium=false` |
   | `bad-enum` (pushTokens) | delete the stale token doc |
3. **Ask Claude to write the migration script** — paste the category counts from
   `audit.json` and it will generate a targeted, reversible Admin‑SDK script.
4. Back up first (Phase 0.2 covers this), run the migration against production.
5. **Re‑run Phase 1.1** until it prints **✔ Clean**.
**Done when:** `npm run audit:schema` exits 0.

---

## Phase 3 — Staging deploy + smoke test 🔴

### 3.1 Create a staging Firebase project
**Why:** deploy and exercise the rules somewhere real before touching production.
**Where:** [Add project](https://console.firebase.google.com/) (the "Add project" card).
**Steps:**
1. Create e.g. `strengthhub-staging`; enable Firestore + Storage; same region if offered.
2. Add it to [`.firebaserc`](../../.firebaserc):
   ```json
   { "projects": {
       "default": "strengthhub-2ab33",
       "production": "strengthhub-2ab33",
       "staging": "strengthhub-staging"
   } }
   ```
**Done when:** `firebase projects:list` shows staging.

### 3.2 Deploy to staging + smoke‑test
```bash
firebase deploy --only firestore:rules,storage:rules --project staging
```
Point a build at staging (set the `EXPO_PUBLIC_FIREBASE_*` env to the staging app's
config) and exercise: **onboarding → save/load → a workout → a weight log → a meal →
a chat message → program generation → set logging → push‑token registration.**
**Done when:** all flows work with **zero** `permission-denied` errors.
**Docs:** https://firebase.google.com/docs/rules/manage-deploy

---

## Phase 4 — Production rules deploy 🔴

### 4.1 Save the current live rules (rollback point)
**Where:** [Firestore Rules](https://console.firebase.google.com/project/strengthhub-2ab33/firestore/rules) and the **Storage → Rules** tab.
**Steps:** copy the current ruleset text from each tab into a local file; note the date. This is your rollback.

### 4.2 Deploy
**Precondition:** Phase 1 clean (or Phase 2 done) **and** Phase 3 smoke test passed.
- **Option A — CLI:**
  ```bash
  firebase deploy --only firestore:rules,storage:rules --project production
  ```
- **Option B — GitHub Action:** open [Security Rules workflow](https://github.com/zsztrochlic4/SHOAPPNATIVE/actions/workflows/security-rules.yml) → **Run workflow** → set `deploy = true`, `project_id = strengthhub-2ab33`. It won't deploy unless the tests job passes (needs the secret in 8.2).
**Immediately after:** watch [Firestore usage/metrics](https://console.firebase.google.com/project/strengthhub-2ab33/firestore/usage) for a **permission‑denied** spike for 30–60 min.
**Rollback:** paste the saved previous rules back into the console Rules tab → **Publish** (never open dev rules).
**Done when:** rules deployed, no permission‑denied spike for real users.

---

## Phase 5 — App Check setup (do NOT enforce yet) 🟠

### 5.1 Register the web app with reCAPTCHA Enterprise
**Where:** [App Check](https://console.firebase.google.com/project/strengthhub-2ab33/appcheck) · [reCAPTCHA Enterprise (GCP)](https://console.cloud.google.com/security/recaptcha?project=strengthhub-2ab33)
**Steps:**
1. App Check → **Apps** → select the **web** app → **Register** → provider **reCAPTCHA Enterprise**.
2. Create a reCAPTCHA **Enterprise key** (score‑based, for your web domain) via the linked reCAPTCHA console; add your production domain(s) and `localhost` for testing.
3. Put the **site key** in your web build env (already wired in code):
   `EXPO_PUBLIC_APPCHECK_RECAPTCHA_ENTERPRISE_KEY=<site key>`
4. (Optional, dev/staging only) generate a **debug token** in the browser console and register it under App Check → **Manage debug tokens**.
**Done when:** the App Check dashboard shows the web app receiving **verified** requests once a keyed build runs.
**Docs:** https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider

### 5.2 Register iOS + Android and add NATIVE App Check (engineering task)
**Why:** native currently sends **no** App Check token by design. Required before any Firestore/Storage enforcement, or the app breaks on device.
**Heads‑up:** this app uses the Firebase **JS SDK**, whose App Check is web/reCAPTCHA only. Native attestation (App Attest / Play Integrity) needs a **native module** — add `@react-native-firebase/app-check` (+ `/app`) in an **EAS dev build**, or a custom provider bridging native attestation. This is code + a dev build, not console‑only.
**Steps:**
1. App Check console → register the **iOS** and **Android** apps (bundle id `com.zaggy887.strengthhub`).
2. Add the native App Check module and config plugin; rebuild with EAS.
3. iOS: enable **App Attest** (DeviceCheck fallback). Android: enable **Play Integrity**.
4. Verify tokens on **physical devices** (dev + release).
**Done when:** iOS + Android builds produce verified tokens on real devices.
**Docs:** iOS https://firebase.google.com/docs/app-check/ios/app-attest-provider · Android https://firebase.google.com/docs/app-check/android/play-integrity-provider · RN module https://rnfirebase.io/app-check/usage

---

## Phase 6 — Enforce App Check (staged, per service) 🟠

**Where:** App Check → **APIs**/**Products**: https://console.firebase.google.com/project/strengthhub-2ab33/appcheck
**Precondition:** token‑capable web + iOS + Android clients shipped and showing **verified** traffic (still unenforced).
**Steps — one at a time, watching metrics between each:**
1. If already launched, wait until **~99% of supported‑client traffic is verified for ≥ 7 days**.
2. Enforce **Cloud Firestore**.
3. Enforce **Cloud Storage**.
4. Enforce **Firebase AI Logic** — **before** enabling the live coach.
**Rollback:** enforcement toggles **per service** and takes effect fast, so you can back any single one out if verified clients fail.
**Done when:** Firestore + Storage (+ AI Logic) enforced with no legitimate‑client breakage.
**Docs:** https://firebase.google.com/docs/app-check

---

## Phase 7 — Public asset cleanup 🟢

### 7.1 Migrate the squat poster off its long‑lived token
**Why:** `Thumbnails/squating.avif` is served via a permanent download‑token URL (see [`src/lib/media.ts`](../../src/lib/media.ts)); make it public through the documented model instead.
**Where:** [Storage](https://console.firebase.google.com/project/strengthhub-2ab33/storage)
**Steps:**
1. In the bucket, copy/move `Thumbnails/squating.avif` into `exercises/`.
2. Open the old file → ⋯ → **manage tokens** → revoke the existing token.
3. Ask Claude to repoint `src/lib/media.ts` at the public `exercises/` path (then rebuild).
**Done when:** the poster loads from `exercises/` and the old token is dead.

---

## Phase 8 — Repo / CI hardening 🟢

### 8.1 Require the rules test check on `main`
**Where:** [Branch protection](https://github.com/zsztrochlic4/SHOAPPNATIVE/settings/branches)
**Steps:**
1. **Add branch protection rule** → branch name pattern `main`.
2. Tick **Require status checks to pass before merging** → search and select **Rules + sanitisation tests** (it appears in the list after the [Security Rules workflow](https://github.com/zsztrochlic4/SHOAPPNATIVE/actions/workflows/security-rules.yml) has run once on a PR).
3. Save.
**Done when:** a PR that fails the rules tests can't be merged.

### 8.2 Add the deploy secret (only if using Option B in 4.2)
**Where:** [Actions secrets](https://github.com/zsztrochlic4/SHOAPPNATIVE/settings/secrets/actions)
**Steps:** **New repository secret** → name `FIREBASE_SERVICE_ACCOUNT`, value = the full JSON from Phase 0.1.
**Done when:** the deploy‑rules job can authenticate.

---

## Phase 9 — Monitoring (ongoing) 🟢

**Where:** [Cloud Monitoring alerts](https://console.cloud.google.com/monitoring/alerting?project=strengthhub-2ab33) · [Billing budgets](https://console.cloud.google.com/billing) · [Firestore usage](https://console.firebase.google.com/project/strengthhub-2ab33/firestore/usage)
Set alerts/dashboards for (plan §12): Firestore **permission‑denied** + failed syncs · App Check **verified vs unverified** · auth abuse / sign‑in failures · **Blaze billing** spikes · input‑sanitisation rejection counts · AI schema‑rejection + safety‑suppression rates · coach fallback/latency/error rate (once live).

---

## The coach stays OFF regardless

`COACH_ENABLED` ([`src/backend/coach/coachGate.ts`](../../src/backend/coach/coachGate.ts)) stays `false` until: input + output guardrails in place, the detection classifier **validated on the labelled holdout**, professional review complete, **and** App Check enforced on AI Logic (Phase 6.4). None of the above flips it on by itself.

---

### Minimum path to get the hardened rules live
**0.1** key → **0.2** backups → **1.1** audit (→ **2** if not clean) → **3** staging → **4** production deploy. Phases 5–9 harden further but aren't required for the rules themselves.
