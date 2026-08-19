# In-App Purchases (Apple / Google) via RevenueCat — setup runbook

**Status:** CODE IMPLEMENTED, GATED OFF. This is packet item **L1**. The client, the Paywall
routing and the server webhook are written; `IAP_ENABLED = false` (`src/lib/iap.ts`) until it is
tested on a real device. It **cannot be verified in this repo** — it needs your developer accounts,
store products, a native EAS build and on-device testing before you flip the flag and submit.

## Why this can't be "just turned on"
Native store billing needs your developer accounts, products configured in each store console,
a native build (NOT Expo Go), on-device testing, and — ultimately — store review. No one can
guarantee "won't be rejected" in advance; these steps are what make approval likely.

## What's already implemented in the repo
- **`react-native-purchases` is installed** (RevenueCat SDK, v10).
- `src/lib/iap.ts` — real RevenueCat client: `initIap`, `purchasePlan`, `restorePurchases`,
  `iapIsEntitled`, `iapActive()`. The native module is imported **lazily**, so the Expo Go / web
  build still loads today; `IAP_ENABLED = false` keeps it inert. Entitlement id `premium`, product
  ids `sho_weekly_200` (weekly) and `sho_annual_9000` (annual) — see `IAP_PRODUCTS` in `src/lib/plans.ts`.
- `src/screens/Paywall.tsx` — the purchase + restore buttons **already route**: native → RevenueCat,
  web (and while gated) → Stripe.
- `src/store/BillingSync.tsx` — calls `initIap(uid)` on sign-in (no-op until enabled).
- `functions/src/iap.ts` — RevenueCat → `entitlements/{uid}` webhook, SAME shape as the Stripe path,
  so the app's gate is billing-rail-agnostic. **Not exported** from `index.ts` yet (so it doesn't
  deploy) — one line to enable, step 5.
- Stripe stays the paywall for web and until you flip `IAP_ENABLED`.

## Steps to go live (what only you can do)

1. **Developer accounts** — Apple Developer Program ($99/yr) and Google Play Console ($25 one-off).
2. **Create the subscription products in BOTH stores** — ids **`sho_weekly_200`** and
   **`sho_annual_9000`** (see `IAP_PRODUCTS`):
   - `sho_weekly_200` — AUD $2.00 / week with a 4-week free trial.
   - `sho_annual_9000` — AUD $90.00 / year, no trial.
   (Match the Stripe offer exactly.)
3. **RevenueCat** — create a project (<https://www.revenuecat.com>), connect the App Store and
   Play Store apps, create an **entitlement** named **`premium`**, and an **offering** containing
   both the weekly and annual packages. Set `app_user_id = <Firebase UID>` (the client already passes it).
4. **Native build + keys** — add the RevenueCat config plugin per their Expo guide if required, set
   `EXPO_PUBLIC_RC_IOS_KEY` / `EXPO_PUBLIC_RC_ANDROID_KEY` via **EAS env** (never commit real keys),
   then `eas build --profile development`. (Expo Go cannot run store billing.)
5. **Deploy the webhook** —
   ```bash
   firebase functions:secrets:set REVENUECAT_WEBHOOK_AUTH   # any strong random string
   ```
   add `export { revenueCatWebhook } from './iap'` to `functions/src/index.ts`, deploy, then set
   RevenueCat's webhook URL + Authorization header to match the secret.
   (Note the Cloud Run CPU quota — this adds one function; see the deploy notes.)
6. **Test every state on a real device** (sandbox): purchase, trial→paid conversion, renewal,
   cancellation (access-until-expiry), expiration, billing-issue, and restore. Confirm
   `entitlements/{uid}` and `users/{uid}.profile.premium` update correctly for each.
7. **Flip `IAP_ENABLED = true`** (`src/lib/iap.ts`), submit builds, and keep Stripe only for the
   web/PWA surface (Apple and Google generally require their billing for the native apps — packet L1).

## Reference
- Apple guidelines: <https://developer.apple.com/app-store/review/guidelines/>
- Google Play payments: <https://support.google.com/googleplay/android-developer/answer/9858738>
- RevenueCat + Expo: <https://www.revenuecat.com/docs/getting-started/installation/expo>
