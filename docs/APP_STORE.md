# Publishing StrengthHub to the App Store

**Important:** Firebase App Hosting / Firebase Hosting only serve *websites*. They
**cannot** publish this app to the Apple App Store. You can disconnect the App
Hosting backend in the Firebase console (or ignore the failed rollouts) — it is
not part of shipping the mobile app. (Firebase is still useful *later* if you
want a cloud backend, e.g. to host the AI-coach API or sync user data.)

A React Native / Expo app ships to the App Store via **EAS** (Expo Application
Services): EAS Build compiles a native iOS binary **in the cloud (no Mac
required)**, and EAS Submit uploads it to App Store Connect.

## One-time prerequisites

1. **Expo account** — free, sign up at https://expo.dev.
2. **Apple Developer Program** — **$99/year**, required to publish to the App
   Store. Enroll at https://developer.apple.com/programs/.
3. **EAS CLI** on your computer:
   ```bash
   npm install -g eas-cli
   eas login
   ```
4. A real **app icon**: replace `assets/icon.png` with a **1024×1024 PNG with no
   transparency** before submitting (Apple rejects transparent/placeholder
   icons). The current icon is the Expo placeholder.

## Build & submit

From the project root after `git pull`:

```bash
# 1. Link this repo to an Expo project (writes extra.eas.projectId into app.json)
eas init

# 2. Build the production iOS app in the cloud.
#    EAS will offer to create & manage your iOS signing credentials for you
#    using your Apple account — say yes.
eas build --platform ios --profile production

# 3. Upload the finished build to App Store Connect / TestFlight.
eas submit --platform ios --profile production
```

Then in **App Store Connect** (https://appstoreconnect.apple.com):
- The app record is created automatically by `eas submit` (or create it manually
  with bundle id `com.zaggy887.strengthhub`).
- Add: app name, description, keywords, support URL, **screenshots** (you can use
  the ones from the iOS Simulator or a device), age rating, and the **privacy**
  questionnaire (this app stores data only on-device via AsyncStorage; it makes
  no network calls unless you enable the AI coach).
- Submit for review. First review typically takes 24–48h.

## Test before you ship (recommended)

- **Simulator build** to click through locally on a Mac:
  `eas build --platform ios --profile preview` (the `preview` profile builds a
  simulator binary).
- **TestFlight**: after `eas submit`, invite testers from App Store Connect to
  try the real build on their devices before public release.

## Config already in this repo

- `eas.json` — build profiles (`development`, `preview`, `production`) + submit.
- `app.json` — `ios.bundleIdentifier` = `com.zaggy887.strengthhub`,
  `ios.buildNumber`, `android.package`, `version` 1.0.0.

## Notes / gotchas

- **App icon & splash**: swap the placeholder art for real 1024×1024 assets.
- **External images**: some demo screens load images from remote URLs. They work,
  but for a store app prefer bundling your own assets or using rights-cleared
  images.
- **Apple review**: make sure the app feels complete (it does — it's fully
  functional on seeded data). Apps that look like thin demos can be rejected.
- **Android / Google Play** is the same flow with `--platform android` and a
  Google Play Developer account ($25 one-time).
- The **AI coach** stays in graceful-fallback (on-device rules) unless you set
  `EXPO_PUBLIC_COACH_API` to a deployed `/api/coach` endpoint — that backend is a
  good candidate for a Firebase Cloud Function if you want it live.
