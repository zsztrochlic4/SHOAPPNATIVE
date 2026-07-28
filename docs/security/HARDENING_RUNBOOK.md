# StrengthHub — Security Hardening Runbook

Operational companion to Hardening Plan v3 (§9, §11, §12). It covers what has
been **implemented in code** and the **console/ops steps that only the project
owner can do**. Nothing here has been deployed to production — deploy is a
deliberate, gated step (below).

> Project: `strengthhub-2ab33` · region `australia-southeast2` · Blaze.

---

## 0. What is already done in the repo

- Hardened `firestore.rules` (root allowlist + typed fields, per-collection id/
  ownership invariants, `entitlements/{uid}` Zone B, `config/coach` exact path,
  root `list`/`delete` denied) and `storage.rules` (`users/**` locked).
- Obsolete OAuth token fields removed from the app types + rejected in rules +
  stripped by the sanitiser.
- Canonical input sanitiser wired at the persist boundary.
- Strict AI coach response-schema validator with safe fallbacks.
- App Check web client swapped to reCAPTCHA **Enterprise** (safe no-op until a
  key + console config exist).
- Emulator rule tests + sanitiser/AI unit tests, all green locally, wired into a
  required CI gate that also gates the deploy job.
- `production` project alias added to `.firebaserc`.

Run the whole suite locally (needs a JDK 11+ on PATH for the emulator):

```bash
npm run test:unit
npm run test:rules
```

---

## 1. Before you deploy the rules (plan §11) — OWNER TASKS

The rules validate structure and caps. **Do not deploy them against production
until you have confirmed existing documents comply** (plan §4.5, §11):

1. **Create a staging project** (e.g. `strengthhub-staging`) and add it to
   `.firebaserc` under a `staging` alias. Deploy + smoke-test there first.
2. **Recovery backup:** enable a scheduled Firestore backup **or** Point-in-Time
   Recovery, and turn on delete-protection. (Currently OFF.)
3. **Read-only production schema audit:** run the bundled script — it scans every
   `users/*` doc + subcollection for exactly what the hardened rules reject
   (unknown top-level fields, oversized free-text, `accessToken`/`refreshToken`
   values, id/dateKey/uid mismatches, bad platform enums) and never writes:

   ```bash
   npm install --no-save firebase-admin
   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
   npm run audit:schema -- --project production --json audit.json
   ```

   Exit 0 = clean (safe to deploy); exit 1 = violations listed (fix via a one-time
   trusted migration before tightening rules, or legitimate saves for those users
   will start failing). See `scripts/audit-production-schema.mjs`.
4. **Confirm app-version compatibility:** the sanitiser + rules match the current
   client; verify any older shipped versions still write compatible shapes.

## 2. Deploy the rules (staged) — OWNER TASK

Rules deploy is intentionally explicit (no accidental prod default):

```bash
# staging first
firebase deploy --only firestore:rules,storage --project staging
# …smoke-test onboarding, save/load, workouts, weights, meals, chat,
#   program generation, set logging, push-token registration…
firebase deploy --only firestore:rules,storage --project production
```

Or use the manual **Security Rules → deploy-rules** GitHub Action (requires the
`FIREBASE_SERVICE_ACCOUNT` secret); it will not run unless `rules-tests` passes.

Preserve the exact previous ruleset + release id for rollback (plan §12).

## 3. App Check rollout (plan §9) — OWNER / CONSOLE TASKS

Enforcement is **off**; enabling it is a controlled change **after** token-capable
clients ship. Do NOT enable Firestore/Storage enforcement while native clients
still send unverified requests.

**Web**
1. Register `strengthhub-web` in the App Check console.
2. Create a **reCAPTCHA Enterprise** key; set `EXPO_PUBLIC_APPCHECK_RECAPTCHA_ENTERPRISE_KEY`.
3. Configure permitted production domains. Use debug tokens for local/staging only.

**iOS / Android** (native returns no token today — a dev-build task)
1. Register the iOS + Android apps (`com.zaggy887.strengthhub`).
2. Add an Expo dev-build-compatible native Firebase App Check module.
3. Configure **App Attest** (DeviceCheck fallback) on iOS, **Play Integrity** on Android.
4. Verify tokens on physical-device dev + release builds.

**Enforcement sequence**
Ship token-capable clients → monitor App Check metrics **unenforced** → confirm
web/iOS/Android traffic is classified verified → (if already launched) require
~99% verified supported-client traffic for ≥ 7 days → enforce Firestore → enforce
Storage → enforce **Firebase AI Logic before enabling the live coach**.

## 4. Coach enablement gate (unchanged, still CLOSED)

`COACH_ENABLED` (`src/backend/coach/coachGate.ts`) stays `false` until: input +
output guardrails in place, the detection classifier **validated** on the labelled
holdout, professional review complete, **and** App Check enforced on AI Logic.
Testing is not validation. App Check does not itself enable the coach.

## 5. Monitor after deployment (plan §12)

Firestore permission-denied errors · failed cloud syncs · read/write/storage
usage · App Check verified-vs-unverified · auth abuse / sign-in failures · Blaze
billing alerts / usage spikes · input-sanitisation rejection counts · AI
schema-rejection + safety-suppression rates · coach fallback/latency/error rate ·
per-user coach call volume + cost anomalies.

## 6. Rollback (plan §12)

- Keep the exact previous production ruleset + release id.
- If legitimate writes fail, **redeploy the previous known-good rules** — never
  open dev rules.
- App Check enforcement can be disabled **per service** if verified clients fail.
- Keep migrations reversible, or restore into a **separate** database from backup.

## 7. Remaining owner/console follow-ups (not doable from the repo)

- [ ] Create staging project + `staging` alias; deploy/smoke-test there first.
- [ ] Enable scheduled backup / PITR + delete-protection (currently OFF).
- [ ] Run the read-only production schema audit + one-time data migration.
- [ ] Migrate `Thumbnails/squating.avif` into public `exercises/`, revoke the old
      download token, then repoint `src/lib/media.ts` to the public path.
- [ ] Register App Check apps (web + iOS + Android) and create the reCAPTCHA
      Enterprise key; add native App Check in a dev build.
- [ ] Deploy hardened rules to production (staged), then roll out App Check per service.
- [ ] Mark the **Security Rules / rules-tests** check as required in branch protection.
- [ ] Add the `FIREBASE_SERVICE_ACCOUNT` GitHub secret if using the deploy action.
