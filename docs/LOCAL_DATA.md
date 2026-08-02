# On-device data: scoping, retention and protection (audit F-027)

_Updated 2026-08-02 as part of the audit remediation._

## What is stored locally, and under which key

| Data | Key | Scope | Cleared when |
|---|---|---|---|
| App state (profile, logs, chat) | `sho.state.v1.anon` / `sho.state.v1.u.<uid>` | Per identity (F-001) | Sign-out, account deletion (uid slot); explicit reset (anon) |
| Coach workspace cache | `sho.coach.workspace.v1.u.<uid>` | Per uid, never read pre-auth | Sign-out, consent revoke, account deletion |
| Push registration record | `sho.push.registration.v1` | Device (uid+token pair) | Disable, sign-out, account switch, deletion |
| Workout completion queue | `sho.completionQueue.v1.u.<uid>` | Per uid | Flushed on sync; dies with app data |
| Active-workout runtime | `sho.activeWorkout.runtime.v1` | Device (timers/cursor only, no set data) | Finish; 12h expiry |
| Onboarding draft | `sho.onboarding.draft.v1` | Anonymous (pre-auth) | Completion, restart, 7-day expiry |
| Redacted error log | `sho.errorlog.v1` | Device (no user content, 50 entries) | Rolling |

## Threat model & current posture

- **Cross-user exposure on a shared device** — CLOSED (audit F-001/F-004/F-005):
  every sensitive store is identity-scoped, prior-account slots are removed on
  sign-out, and caches are never read before the account is known.
- **Device compromise / forensic access to AsyncStorage** — PARTIALLY OPEN:
  AsyncStorage contents are plain JSON inside the app sandbox. Both OSes
  encrypt the filesystem at rest when the device has a passcode, and app
  sandboxing prevents other apps reading these files on non-jailbroken/
  non-rooted devices.
- **OS backups** — follow platform defaults (encrypted iCloud/Android backups
  where the user enables them).

## Roadmap (before any claim of at-rest encryption is made)

1. Generate a per-install key held in the platform keystore (expo-secure-store)
   and encrypt the app-state and coach-cache payloads with it.
2. Keep encrypted payload versioning inside the existing migration gate so an
   older build never destroys a newer encrypted blob.
3. Only then update PRIVACY.md/DATA_SAFETY.md wording — never claim encryption
   the code does not do (the current documents do not claim it).
