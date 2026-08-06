# App Check enforcement — copy-paste checklist

Focused, ordered steps to go from "native App Check wired" (done) to "backend
enforces attestation." Companion to `docs/APP_CHECK.md` (the fuller runbook).

**Golden rule:** do NOT flip enforcement until the App Check metrics show your real
app traffic is **verified**. Enforcing early rejects the live app's own calls
(e.g. the meal scan), because unattested clients get `failed-precondition`.

Project: `strengthhub-2ab33` · Android app `com.zaggy887.strengthhub`.

---

## 1. Register the Android SHA-256 (Play Integrity)
```bash
cd C:\Users\zsztr\OneDrive\Documents\Git
eas credentials            # Android → your build profile → copy the SHA-256 fingerprint
```
Then Firebase console → Project settings → your Android app → **Add fingerprint** →
paste the SHA-256:
https://console.firebase.google.com/project/strengthhub-2ab33/settings/general

## 2. Turn on the App Check provider (console)
App Check → Apps → register:
- **Android** = Play Integrity
- **iOS** = App Attest (after the iOS build exists)
https://console.firebase.google.com/project/strengthhub-2ab33/appcheck

## 3. Monitor (enforcement still OFF)
- Use the app on a real device so it makes backend calls (open it, run a meal scan).
- Watch **App Check → metrics** and **Functions logs**: `appcheck.missing` should stop
  for your attesting device, and the verified-request rate should climb.
- Wait until essentially all real traffic is verified. Old/un-updated builds show as
  unverified — give them time.

Check logs quickly:
```bash
firebase functions:log --only analyzeMeal --project strengthhub-2ab33
```

## 4. Confirm the deploy precondition, then enforce
```bash
cd C:\Users\zsztr\OneDrive\Documents\Git\functions
# analyzeMeal needs GEMINI_API_KEY at runtime; a functions deploy redeploys it.
# (It is currently set — analyzeMeal is deployed — but confirm before enforcing.)
firebase functions:secrets:set APPCHECK_ENFORCE   # value = 1
npm run build && firebase deploy --only functions --project strengthhub-2ab33
```
`guards.ts` reads `APP_CHECK_ENFORCED = process.env.APPCHECK_ENFORCE === '1'`, so this
flips every wired callable (analyzeMeal, deleteAccount, reportClientError,
sendNotification, coach* callables) from monitor → enforce with no code change.

> Coverage note: the **community** and **admin** callables are not yet wired to this
> switch (tracked separately). If you enforce, they stay open to unattested clients
> until that follow-up lands.

## 5. Rollback (one step)
```bash
cd C:\Users\zsztr\OneDrive\Documents\Git\functions
firebase functions:secrets:set APPCHECK_ENFORCE   # value = 0   (or unset the secret)
npm run build && firebase deploy --only functions --project strengthhub-2ab33
```
If you also enabled Firestore/Storage enforcement in the console, disable those there.

**Done when:** real devices attest, invalid clients are rejected, and no production
debug token exists.
