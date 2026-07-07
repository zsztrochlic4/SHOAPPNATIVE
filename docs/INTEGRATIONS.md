# Health integrations — Strava, Whoop, Apple Health & co.

The app pulls activities (runs, rides, swims…) into **Workout → History**, and
steps/sleep into the habit tracker — all of which feed the 14-day on-track
gauge. Users connect platforms in **Settings → Connected apps**, data syncs
automatically on app launch, and there are **Sync now** buttons in Settings and
on the Workout History tab.

## Architecture

```
App (Settings → Connect)
  └─ OAuth consent page (Strava / Whoop)      user approves
       └─ code → Cloud Function `oauthToken`  exchanges code using the CLIENT
          (holds the client secrets)          SECRET, returns tokens
  └─ sync: Cloud Function `providerFetch`     proxies API reads (CORS + allowlist)
       └─ activities/steps/sleep → store      de-duped by the platform's own id
```

- Client **IDs** are public → `.env` (`EXPO_PUBLIC_*`).
- Client **SECRETS** live only in Cloud Function secrets.
- Tokens are stored in the user's own state (owner-only Firestore doc).

## One-time setup

### 1. Strava
1. Create an API application at https://www.strava.com/settings/api
   (any name; category "Training").
2. Set **Authorization Callback Domain** to the domain the app runs on
   (for the Bolt preview use its domain; for local dev `localhost`).
3. Copy the **Client ID** into `.env` → `EXPO_PUBLIC_STRAVA_CLIENT_ID`.
4. Store the **Client Secret** server-side:
   `firebase functions:secrets:set STRAVA_CLIENT_SECRET`
   and also `firebase functions:secrets:set STRAVA_CLIENT_ID` (same ID again —
   the function needs it for the token exchange).

### 2. Whoop
1. Create an app at https://developer.whoop.com (App Console).
2. Add the app's redirect URI (same origin as above).
3. `.env` → `EXPO_PUBLIC_WHOOP_CLIENT_ID`, then
   `firebase functions:secrets:set WHOOP_CLIENT_ID` and
   `firebase functions:secrets:set WHOOP_CLIENT_SECRET`.

### 3. Deploy the functions
```bash
npm install -g firebase-tools   # once
firebase login                  # once
cd functions && npm install && cd ..
firebase deploy --only functions
```

### 4. Apple Health / Health Connect
These read on-device via HealthKit / Health Connect, which **requires the real
iOS/Android builds** (EAS dev build or store build) — they cannot work in a web
preview. The Settings rows already exist and explain this to users; the
on-device read hooks get wired up as part of the store-release build work.

### Garmin / Fitbit
Listed as "coming soon" in Settings. Garmin requires a partner program; Fitbit
can reuse the same OAuth pattern later.

## How syncing behaves
- **De-duplication:** each synced activity carries the platform's own id —
  re-syncing never duplicates.
- **Steps/sleep merge:** a platform's number only ever *raises* a day's value,
  it never overwrites a higher manual log.
- **Token refresh:** access tokens are refreshed automatically ~5 minutes
  before expiry during a sync.
- **Auto + manual:** sync runs once on app launch; users can force it with
  Sync now (Settings → Connected apps, or Workout → History).
