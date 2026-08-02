# Health integrations — Apple Health & Health Connect

The app can read **steps, sleep and workouts** from the phone's own health store
and feed them into the habit tracker and Workout history (which drive the 14-day
on-track gauge). Users manage this in **Settings → Connected apps**.

> **Current state:** the integration is **on-device only** and lands with the
> native app builds. The Settings rows exist and show status, but nothing is
> connectable in the web preview or in Expo Go — HealthKit / Health Connect need
> the real iOS/Android build. See "Status" below.

## Providers

Only two providers exist, both reading **on-device** (no OAuth, no server, no
tokens):

| Provider | Platform | Reads |
|---|---|---|
| **Apple Health** (HealthKit) | iOS app | Steps, sleep & workouts |
| **Health Connect** | Android app | Steps, sleep & workouts |

Source of truth: `src/lib/integrations.ts` (`ProviderId = 'appleHealth' | 'healthConnect'`,
`PROVIDERS`) and the UI in `src/components/Integrations.tsx`.

> **Removed:** the former **Strava / Whoop OAuth** path — and its
> `oauthToken` / `providerFetch` Cloud Functions — plus the **Garmin / Fitbit**
> "coming soon" placeholders were removed in favour of the native Apple Health /
> Health Connect direction. If those are ever revived they need their own OAuth
> design, client-secret handling and privacy-policy disclosure.

## Architecture

```
Settings → Connected apps
  └─ Apple Health (iOS)  ──→ HealthKit permission prompt   (native build only)
  └─ Health Connect (Android) ──→ Health Connect permission (native build only)
       └─ on-device read → steps / sleep / workouts → local state
```

- No OAuth consent pages, no Cloud Functions, no client secrets, and **no access
  or refresh tokens are stored** (the store/sanitiser layer rejects integration
  credentials).
- Reads happen on-device against the OS health store; only the categories the
  user approves in the OS permission prompt are read.

## Status — why nothing connects yet

`providerAvailable()` returns `{ ok: false }` in the current builds:

- On **web / preview**, both rows show but explain they connect on the native
  iOS/Android app.
- On a **native build**, the platform-appropriate row shows but reports that the
  on-device read hooks "come with the store release" — the HealthKit /
  Health Connect read code is wired up as part of the store-release build work.
- `syncAll()` is currently a no-op summary (`'Up to date'` / `'No connected apps
  yet'`); real on-device sync (and the **Sync now** button behaviour) lands with
  that same store-release work.

## How syncing is intended to behave (once the native reads ship)

- **Steps/sleep merge:** an imported number only ever *raises* a day's value, it
  never overwrites a higher manual log.
- **Auto + manual:** sync on app launch, plus a **Sync now** action in
  Settings → Connected apps.
- **Disconnect:** tapping a connected provider disconnects it and stops new
  reads; data already imported into the app stays until you delete it (see the
  Privacy Policy).
