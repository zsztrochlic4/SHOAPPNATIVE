# Publishing StrengthHub to the App Store & Google Play

**Important:** Firebase App Hosting / Firebase Hosting only serve *websites*. They
**cannot** publish this app to the Apple App Store or Google Play. Shipping the
mobile app is done via **EAS** (Expo Application Services): EAS Build compiles the
native binary **in the cloud (no Mac required)**, and EAS Submit uploads it to
App Store Connect / Google Play.

> **What the app actually does (as of 2 Aug 2026):** it is a networked app. It
> uses **Firebase** (Auth, Firestore, Cloud Functions — Australian region
> `australia-southeast2`), **Google Gemini** for the AI Coach and meal-photo
> scan, **Stripe** for the subscription, and the **Expo push service** for
> notifications. It also caches data locally (AsyncStorage). Any store privacy
> answers must reflect this — see [DATA_SAFETY.md](DATA_SAFETY.md).

---

## 🚦 Readiness checklist

### Blockers — must resolve before submission
- [ ] **Payments must use the stores' billing (see "Payments" below).** The
      current auto-renewing subscription goes through **Stripe Checkout**, which
      **violates Apple Guideline 3.1.1 and Google Play's Payments policy** for
      digital content unlocked in-app. This is a product decision and likely a
      code change (Apple IAP + Google Play Billing, e.g. via RevenueCat), or a
      qualifying external-purchase entitlement. **Do not submit until resolved.**
- [ ] **Real app icon** — replace `assets/icon.png` with a **1024×1024 PNG, no
      transparency** (Apple rejects transparent/placeholder icons). Current icon
      is the Expo placeholder.
- [ ] **Public Privacy Policy + Terms URLs** live on strengthhubonline.com
      (`/privacy`, `/terms`). Apple requires a Privacy Policy URL; for
      auto-renewing subscriptions it also requires a functional Terms/EULA link.
      Google Play requires the Privacy Policy URL in the listing + Data Safety.
      (Website build handed off separately.)

### Should do before submission
- [ ] **App Privacy / Data Safety** questionnaires filled per
      [DATA_SAFETY.md](DATA_SAFETY.md) (email, name, DOB, health/fitness, AI Coach
      messages, meal photos [ephemeral], subscription/purchase, push token; no
      tracking/ads; Share = No).
- [ ] **Age rating** — 18+ (health & fitness; general wellbeing guidance).
- [ ] **Screenshots** for each required device size.
- [ ] **App Check** — `APP_CHECK_ENFORCED = false` in
      `functions/src/lib/guards.ts`. Register the native app in Firebase and flip
      it to `true` once real clients attest, to protect the callable/AI endpoints
      (see [APP_CHECK.md](APP_CHECK.md)).

### Already handled in the repo
- [x] iOS camera + photo-library **purpose strings** (`app.json` →
      `expo-image-picker` plugin config) for the meal scanner.
- [x] `ITSAppUsesNonExemptEncryption = false` set (standard HTTPS/TLS is exempt) —
      avoids the per-build export-compliance prompt.
- [x] `eas.json` build profiles (`development`, `preview`, `production`) + submit.
- [x] Notification config (`expo-notifications`) and deep-link scheme
      (`strengthhub://`) for Stripe checkout return.

---

## Payments — App Store & Play Store billing (read first)

The paywall (4-week free trial → **$2.99/week AUD**) currently opens **Stripe
Checkout** and unlocks in-app features via the `entitlements/{uid}` record. That
is fine on the **web** build, but for the **iOS and Android apps**:

- **Apple (Guideline 3.1.1):** digital content/subscriptions consumed inside the
  app **must** use Apple In-App Purchase. Stripe/other external payment for this
  is rejected (narrow exceptions: "reader" apps, or the External Purchase Link
  entitlement in some regions).
- **Google Play:** in-app digital purchases generally **must** use Google Play
  Billing (with limited regional/user-choice-billing exceptions).

**Options to decide (owner call):**
1. Add native IAP — Apple IAP + Google Play Billing — typically via **RevenueCat**
   or `expo-in-app-purchases`, and drive the same entitlement gate. Keep Stripe
   for the web app only.
2. Pursue a qualifying external-purchase entitlement (complex, region-limited).
3. Ship the store app without the paywall (free) and monetise on web only.

Until one of these is in place, the iOS/Android build should **not** go to review
with the Stripe paywall active, or it will be rejected.

---

## One-time prerequisites

1. **Expo account** — free, https://expo.dev. (Project is already linked:
   `extra.eas.projectId` is set in `app.json`, owner `strengthhubonline`.)
2. **Apple Developer Program** — **$99/year**, https://developer.apple.com/programs/.
3. **Google Play Developer** — **$25 one-time**, for the Android release.
4. **EAS CLI**:
   ```bash
   npm install -g eas-cli
   eas login
   ```

## Build & submit

From the project root after `git pull`:

```bash
# iOS: build the production binary in the cloud (EAS manages signing credentials)
eas build --platform ios --profile production
eas submit --platform ios --profile production

# Android:
eas build --platform android --profile production
eas submit --platform android --profile production
```

Then in **App Store Connect** (https://appstoreconnect.apple.com) and **Google
Play Console**:
- The app record is created by `eas submit` (or create manually — iOS bundle id
  `com.zaggy887.strengthhub`, Android package `com.zaggy887.strengthhub`).
- Add: name, description, keywords, support URL, **Privacy Policy URL**,
  **screenshots**, **age rating**, the **App Privacy / Data Safety** answers
  (per [DATA_SAFETY.md](DATA_SAFETY.md)), and — once payments use store billing —
  the subscription products.
- Submit for review. First review typically 24–48h.

## Test before you ship (recommended)

- **Simulator build:** `eas build --platform ios --profile preview`.
- **TestFlight / Play internal testing:** after `eas submit`, invite testers to
  try the real build before public release.

## Config already in this repo

- `eas.json` — build profiles + submit; `appVersionSource: remote`.
- `app.json` — `version` 1.0.0, iOS `bundleIdentifier` / `buildNumber`, Android
  `package` / `versionCode`, camera/photo purpose strings, notification &
  splash config, EAS `projectId`.

## Notes / gotchas

- **Bundle id** is `com.zaggy887.strengthhub` (an older handle). Not a blocker,
  but pick the final id **before first submission** — it cannot be changed after.
- **AI Coach is DISABLED** (`COACH_ENABLED = false` — the 2026-08-01 enablement
  was rolled back on 2026-08-02 because it contradicted the coach's own safety
  record; see [COACH_RELEASE_STATE.md](COACH_RELEASE_STATE.md) for the
  authoritative state and re-enable conditions). The coach UI shows a "coming
  soon" surface; no user message reaches the model. Store privacy answers must
  describe the DISABLED state until the release record changes.
- **External images:** some screens load remote demo images. For a store build,
  prefer bundling rights-cleared assets.
- **Apple review polish:** the app is fully functional on real + seeded data;
  make sure nothing reads as a thin demo.
