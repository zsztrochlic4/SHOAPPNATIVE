# Owner runbook — sending push notifications

The remote push **sender** (`sendNotification`, Cloud Functions v2) is deployed.
This is the owner's guide to authorizing yourself and sending. It honours each
user's category prefs + quiet hours server-side, fans out via the Expo Push API
in batches, prunes dead tokens, and records an idempotent audit
(`notificationSends`). See `functions/src/lib/send.ts`.

> All commands run from the repo root in **PowerShell**. PowerShell sets env vars
> with `$env:NAME = "value"` (there is no `export`).

## 0. Prerequisites you still need for a push to actually land

- A **development build** of the app installed on a real device (reanimated +
  NetInfo are native, so Expo Go won't do — `eas build --profile development`).
- The app opened once on that device with notifications enabled, so a token is
  registered under `users/{uid}/pushTokens/{token}`.
- **Expo push credentials** configured via EAS: an **APNs key** (iOS) and/or
  **FCM** (Android). Without these, Expo accepts the request but can't deliver.

Until a token exists, every send reports `recipients: 0` — the pipeline is
working, there's just no one to reach yet.

## 1. Point at your admin credentials (once per terminal)

Use your Firebase **service-account key** (Firebase Console → Project Settings →
Service accounts → Generate new private key). It's stored in Downloads, e.g.:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\Users\zsztr\Downloads\strengthhub-2ab33-firebase-adminsdk-fbsvc-93b98daa4e.json"
```

> Treat this file like a password — never commit it or put it in the repo.

## 2. Grant yourself the owner claim (one-time)

Required only for the in-app / callable path (the CLI in step 3 runs as admin and
skips this).

```powershell
node functions/scripts/set-owner-claim.mjs --email zsztrochlic4@gmail.com
```

Then **sign out and back in** on the app so your ID token carries `owner: true`.
Revoke with `--revoke` if ever needed.

## 3. Send from the CLI (the current admin tool)

Build first (compiles the sender), then send. **Dry-run by default** — it reports
who *would* receive without sending. Add `--send` to actually deliver.

```powershell
npm --prefix functions run build
```

```powershell
# Preview a broadcast (sends nothing):
node functions/scripts/send.mjs --all --title "Test" --body "Hello from SHO"

# Send to one user:
node functions/scripts/send.mjs --uid <THEIR_UID> --title "Welcome" --body "..." --send

# Broadcast for real:
node functions/scripts/send.mjs --all --title "New feature" --body "..." --send
```

Options: `--uid <id>` | `--all`, `--title`, `--body`, `--deepLink <url>`,
`--category general|workout|streak` (workout/streak respect that category's
opt-out), `--override` (ignore quiet hours), `--send` (commit; omit for dry-run).

A run prints a JSON result: `recipients` (deliverable after filtering), `skipped`
(quiet hours / opted out / notifications off), `sent`, `errors`, `pruned`
(dead tokens removed).

## Notes

- **Quiet hours** are honoured per device using the `utcOffsetMinutes` captured
  at token registration, so 10pm–7am local is respected across time zones.
- **Idempotency:** each committed send has a `sendId`; re-running the exact same
  committed send won't double-deliver.
- **Deferred** (not built yet): an in-app admin screen, Cloud Scheduler/Tasks for
  scheduled or very large sends, saved audience segments, and Expo receipt polling.
