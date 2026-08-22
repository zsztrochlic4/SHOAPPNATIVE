# Enabling & testing native in-app purchases (iOS / Android)

**Status today:** native store billing is implemented but **gated off** — `IAP_ENABLED = false`
in [`src/lib/iap.ts`](../src/lib/iap.ts). Web uses Stripe hosted checkout (`src/lib/billing.ts`);
native currently has **no store-billing path**, which blocks App Store / Play submission of a paid
app. This runbook is the owner-side work to turn it on. It needs a **real device**, paid developer
accounts, and store-console configuration — none of which can be done from the codebase alone.

Price is a single source of truth in [`src/lib/plans.ts`](../src/lib/plans.ts) (`BILLING_OFFER`,
`IAP_PRODUCTS`). The store product ids **must** match what you create in the consoles below:
`sho_weekly_200` (AUD $2.00/week, 4-week free trial) and `sho_annual_9000` (AUD $90 / 52 weeks).

## 1. Prerequisites
- Apple Developer Program membership + App Store Connect access; Google Play Console access.
- A **development build** (not Expo Go) via EAS — Expo Go can't run real purchases:
  `npx expo install react-native-purchases react-native-purchases-ui` then `eas build --profile development`.

## 2. Create the products in each store (ids must match `IAP_PRODUCTS`)
- **App Store Connect** → your app → *Subscriptions*: create an auto-renewable subscription group,
  add `sho_weekly_200` (weekly, with a 4-week free introductory offer) and `sho_annual_9000` (yearly).
- **Play Console** → *Monetize → Products → Subscriptions*: create the same two product ids with a
  weekly and yearly base plan; add a 4-week free trial offer on the weekly plan.

## 3. Wire RevenueCat (the app already expects it)
`src/lib/iap.ts` reads `EXPO_PUBLIC_RC_IOS_KEY` / `EXPO_PUBLIC_RC_ANDROID_KEY`. In the RevenueCat
dashboard, connect both stores, map the two products to entitlements, and paste the public SDK keys
into your EAS env. The Stripe/RevenueCat webhook remains the entitlement source of truth
(`entitlements/{uid}`), so no client change grants access.

## 4. Flip the switch and build
Set `IAP_ENABLED = true` in `src/lib/iap.ts` (or make it read an env flag) and produce a device build.

## 5. Test on a real device (the part that can't be skipped)
- **iOS sandbox:** create a Sandbox Apple ID in App Store Connect → *Users and Access → Sandbox*,
  sign into it on the device under *Settings → App Store → Sandbox Account*, then run the dev build.
  You can also use the Xcode StoreKit configuration file for local testing before sandbox.
- **Android:** add your tester Google accounts under *Play Console → Setup → License testing*,
  publish the build to an internal test track, and buy with a license-test account (no real charge).
- **Verify the full lifecycle on each platform:** purchase, 4-week trial start, cancellation,
  expiry, **restore purchases**, manage-subscription deep link, and entitlement recovery on a fresh
  reinstall. Confirm the paywall's "Sign out" escape and that a paid user never sees the paywall flash.

## 6. Submit
Only submit native builds once every lifecycle step passes on-device, and the store listing price
matches `BILLING_OFFER` exactly (App Store and Play both reject price/offer mismatches).

## Links
- RevenueCat — Expo install: https://www.revenuecat.com/docs/getting-started/installation/expo
- Expo — Using in-app purchases: https://docs.expo.dev/guides/in-app-purchases/
- Apple — Testing in-app purchases with Sandbox: https://developer.apple.com/documentation/storekit/testing-in-app-purchases-with-sandbox
- Apple — StoreKit testing in Xcode: https://developer.apple.com/documentation/xcode/setting-up-storekit-testing-in-xcode
- Apple — App Review Guidelines (In-App Purchase, §3.1): https://developer.apple.com/app-store/review/guidelines/#in-app-purchase
- Google Play — Test your Billing Library integration: https://developer.android.com/google/play/billing/test
- Google Play — License testing: https://support.google.com/googleplay/android-developer/answer/6062777
