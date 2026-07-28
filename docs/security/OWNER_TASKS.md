# Owner Task Checklist — what's left to do

> **STATUS (2026-07-28): the hardened Firestore + Storage rules are LIVE in
> production.** Production data was audited **clean (0/7 users)** after migrating
> one legacy account (backed up). Everything below is the remaining **console /
> settings** work — none of it blocks the App Store or the rules already
> protecting your backend.

- **Project:** `strengthhub-2ab33` · region `australia-southeast2` · Blaze plan
- **Repo:** `zsztrochlic4/SHOAPPNATIVE`
- Each task lists a **link** *and* the exact **click-path** — if a link ever
  drifts, follow the click-path instead.

---

## ✅ Already done (no action needed)
- All code hardening (rules, input sanitiser, coach response-schema, tests, CI) — committed & pushed to `main`.
- Read-only production audit → 1 legacy account migrated into subcollections (backup in `migration-backups/`).
- Re-audit **clean**, then **`firebase deploy`** published `firestore.rules` + `storage.rules` to production.

---

## ▶ Your remaining tasks

Ordered by priority. 🔴 = do soon · 🟠 = needed before the AI coach goes live · 🟢 = hygiene.

---

### 0. LIVE SMOKE TEST — confirm real saves still work  🔴
*(You have a reminder set for Wed 29 Jul, 7 pm.)*

**Why:** the rules are now enforcing on real users. A 2-minute check proves no legitimate write is being wrongly blocked.

**Steps:**
1. Open the app on your phone and **sign in** with a real account.
2. Do a few saves: **log a weight**, **send a chat message**, **complete/log a workout**. Each should save with no error.
3. Open the Firestore usage dashboard and watch for a **permission-denied** spike for ~5 min:
   - Link: https://console.firebase.google.com/project/strengthhub-2ab33/firestore/usage
   - Click-path: Firebase console → **Firestore Database** → **Usage** tab.
4. **If a save fails / you see permission-denied:** revert instantly —
   - Link: https://console.firebase.google.com/project/strengthhub-2ab33/firestore/rules
   - Click-path: Firebase console → **Firestore Database** → **Rules** tab → **history** icon (clock, top-right of the editor) → pick the previous version → **Publish**. Do the same on **Storage → Rules**.
   - Then send me the denied write's collection + fields and I'll patch the rule.

**Done when:** weight, chat, and workout saves all succeed and the permission-denied count stays flat.

---

### 1. Turn on backups + recovery  🔴  *(~5 min — do this soon)*

**Why:** Point-in-Time Recovery, scheduled backups, and delete-protection are all **currently OFF**. Right after a rules change + a data migration is exactly when you want a safety net.

**Where:**
- Link: https://console.firebase.google.com/project/strengthhub-2ab33/firestore
- Click-path: Firebase console → **Firestore Database** → **Backups** tab (row of tabs: Data · Rules · Indexes · Usage · **Backups**).

**Steps:**
1. **Point-in-time recovery:** on the `(default)` database, toggle **PITR → Enable** (gives 7 days of continuous recovery).
2. **Scheduled backups:** **Create backup schedule** → **Daily** → retention **7–14 days** → Save.
3. **Delete-protection:** open the database's **settings** (⋯ or gear next to the `(default)` database) → enable **Delete protection**.

**Done when:** PITR shows *Enabled*, one daily schedule is listed, and delete-protection is on.
**Exact steps / screenshots:** https://firebase.google.com/docs/firestore/use-pitr and https://firebase.google.com/docs/firestore/backups

---

### 2. Revoke the OLD admin key  🟢  *(~2 min)*

**Why:** you now have **two** live service-account keys (I used the newer one for the audit/migration). Fewer live keys = less that can leak. Keep the newest, delete yesterday's.

**Where:**
- Link: https://console.firebase.google.com/project/strengthhub-2ab33/settings/serviceaccounts/adminsdk
- Click-path: Firebase console → ⚙ (gear, top-left) → **Project settings** → **Service accounts** tab → **Manage service account permissions** (opens Google Cloud IAM) → **Service Accounts** → click the `firebase-adminsdk` account → **Keys** tab.

**Steps:**
1. In the **Keys** list you'll see two keys. Keep the one created **2026-07-28** (id starts `93b98daa4e`).
2. Delete the older one created **2026-07-27** (id starts `e4bbcb3cdb`) → trash icon → confirm.

**Done when:** only the newer key remains.

---

### 3. Require the security tests before merging to `main`  🟢  *(~2 min)*

**Why:** so a future change that breaks the rules or sanitiser can't be merged.

**Where:**
- Link: https://github.com/zsztrochlic4/SHOAPPNATIVE/settings/branches
- Click-path: GitHub repo → **Settings** → **Branches** (left sidebar) → **Add branch ruleset** / **Add rule**.

**Steps:**
1. Branch name pattern: `main`.
2. Tick **Require status checks to pass before merging**.
3. In the search box add **Rules + sanitisation tests**. *(It only appears in the list after the Security Rules workflow has run once on a pull request — so open any small PR first if you don't see it yet.)*
4. Save.

**Done when:** a PR that fails the rules tests shows a red "required check" and can't be merged.

---

### 4. Move the squat poster to the public folder  🟢  *(~5 min)*

**Why:** `Thumbnails/squating.avif` is currently served through a permanent, unguarded download-token URL. Moving it into the public `exercises/` folder makes it public through the proper security model instead.

**Where:**
- Link: https://console.firebase.google.com/project/strengthhub-2ab33/storage
- Click-path: Firebase console → **Storage** → file browser.

**Steps:**
1. In `Thumbnails/`, download `squating.avif`, then upload it into the `exercises/` folder (or a subfolder there).
2. Open the old `Thumbnails/squating.avif` → file details → **manage/rotate token** → revoke the existing token.
3. Tell me — I'll repoint `src/lib/media.ts` to the new public `exercises/` path and you rebuild.

**Done when:** the poster loads from `exercises/` and the old token is revoked.

---

### 5. App Check  🟠  *(bigger — needed before the AI coach ever goes live, not before)*

App Check blocks unofficial clients from hitting your Firestore/Storage/AI endpoints. **Set it up and monitor first; only enforce once real apps are sending verified tokens** — enforcing too early would break the app.

**5a. Web (console + one env value):**
- Link: https://console.firebase.google.com/project/strengthhub-2ab33/appcheck
- Click-path: Firebase console → **Build** → **App Check** → **Apps** tab → your **web** app → **Register** → provider **reCAPTCHA Enterprise**.
- Create the reCAPTCHA Enterprise key here: https://console.cloud.google.com/security/recaptcha?project=strengthhub-2ab33 (add your production domain + `localhost`).
- Put the **site key** in your web build env: `EXPO_PUBLIC_APPCHECK_RECAPTCHA_ENTERPRISE_KEY=<key>` (already wired in `src/lib/appCheck.ts`).
- Exact steps: https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider

**5b. iOS + Android (needs a code change + an EAS build — this is engineering, not just clicks):**
- Register the **iOS** and **Android** apps in the same App Check → Apps tab (bundle id `com.zaggy887.strengthhub`).
- The app uses the Firebase **JS SDK**, which can't do native attestation — add `@react-native-firebase/app-check` in an EAS dev build (ping me and I'll do the code side), enable **App Attest** (iOS) / **Play Integrity** (Android), and verify tokens on a physical device.
- Exact steps: iOS https://firebase.google.com/docs/app-check/ios/app-attest-provider · Android https://firebase.google.com/docs/app-check/android/play-integrity-provider · RN module https://rnfirebase.io/app-check/usage

**5c. Enforce (only after 5a + 5b are shipping verified traffic):**
- App Check → **APIs** / **Products** tab → enforce in this order, watching metrics between each: **Cloud Firestore** → **Cloud Storage** → **Firebase AI Logic** (AI Logic must be enforced **before** the coach is enabled).
- Enforcement can be turned off **per API** instantly if something breaks.

**Done when:** web + iOS + Android send verified tokens and enforcement is on for Firestore + Storage.

---

## Reference
- Full schema/security contract: [`DATA_SCHEMA.md`](DATA_SCHEMA.md)
- Deploy / monitor / rollback runbook: [`HARDENING_RUNBOOK.md`](HARDENING_RUNBOOK.md)
- Audit script: [`scripts/audit-production-schema.mjs`](../../scripts/audit-production-schema.mjs) · Migration: [`scripts/migrate-legacy-root-arrays.mjs`](../../scripts/migrate-legacy-root-arrays.mjs)
- The AI coach stays disabled (`COACH_ENABLED = false`) until its guardrails, classifier validation, professional review, **and** App Check on AI Logic are all in place.
