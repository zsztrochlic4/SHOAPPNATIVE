# In-App Purchases (Apple / Google) via RevenueCat — setup runbook

**Status:** SCAFFOLD only. Nothing is live. This is packet item **L1**.
`IAP_ENABLED = false` (`src/lib/iap.ts`) and the server webhook (`functions/src/iap.ts`) is
**not exported** from `functions/src/index.ts`, so it does not deploy.

## Why this can't be "just turned on"
Native store billing needs your developer accounts, products configured in each store console,
a native build (NOT Expo Go), on-device testing, and — ultimately — store review. No one can
guarantee "won't be rejected" in advance; these steps are what make approval likely.

## What's already in the repo (the scaffold)
- `src/lib/iap.ts` — client module + `IAP_ENABLED` flag + the exact RevenueCat calls to drop in.
- `functions/src/iap.ts` — RevenueCat → `entitlements/{uid}` webhook, written to the SAME shape as
  the Stripe path, so the paywall/entitlement logic is billing-rail-agnostic.
- Stripe stays the default paywall until you flip `IAP_ENABLED`.

## Steps to go live

1. **Developer accounts** — Apple Developer Program ($99/yr) and Google Play Console ($25 one-off).
2. **Create the subscription product in BOTH stores** — id `sho_weekly_299` (see `IAP_PRODUCTS`):
   AUD $2.99 / week with a 4-week free trial. (Match the Stripe offer exactly.)
3. **RevenueCat** — create a project (<https://www.revenuecat.com>), connect the App Store and
   Play Store apps, create an **entitlement** called `premium`, and an **offering** containing the
   weekly package. Set the app to send `app_user_id = <Firebase UID>`.
4. **Install the SDK + config plugin** and rebuild natively (Expo Go can't run it):
   ```bash
   npx expo install react-native-purchases
   ```
   Add the config plugin per RevenueCat's Expo guide, then `eas build --profile development`.
5. **Wire the client** — in `src/lib/iap.ts`, replace the stub bodies with the RevenueCat calls in
   the file's comment block; set the iOS/Android API keys (via EAS env, not committed). Point the
   Paywall's purchase button at `iap.purchaseWeekly()` and its restore link at `iap.restore()` when
   `IAP_ENABLED` is true (fall back to the Stripe path otherwise).
6. **Deploy the webhook** —
   ```bash
   firebase functions:secrets:set REVENUECAT_WEBHOOK_AUTH   # any strong random string
   ```
   add `export { revenueCatWebhook } from './iap'` to `functions/src/index.ts`, deploy, then set
   RevenueCat's webhook URL + Authorization header to match the secret.
   (Note the Cloud Run CPU quota — this adds one function; see the deploy notes.)
7. **Test every state on a real device** (sandbox): purchase, trial→paid conversion, renewal,
   cancellation (access-until-expiry), expiration, billing-issue, and restore. Confirm
   `entitlements/{uid}` and `users/{uid}.profile.premium` update correctly for each.
8. **Flip `IAP_ENABLED = true`**, submit builds, and keep Stripe only for the web/PWA surface (Apple
   and Google generally require their billing for the native apps — see packet L1).

## Reference
- Apple guidelines: <https://developer.apple.com/app-store/review/guidelines/>
- Google Play payments: <https://support.google.com/googleplay/android-developer/answer/9858738>
- RevenueCat + Expo: <https://www.revenuecat.com/docs/getting-started/installation/expo>
