# Native In-App Purchase plan (RevenueCat) — App Store & Play billing

**Status:** plan / not yet implemented. Owner decision confirmed: add native store
billing for iOS & Android, keep Stripe for the web app.

## Why

The paywall (weekly: 4-week free trial → **$2.00/week AUD**; or annual: **$90 AUD
upfront** for 52 weeks) currently unlocks in-app features via **Stripe Checkout**.
Apple **Guideline 3.1.1** and Google Play's
Payments policy require **store billing** (Apple IAP / Google Play Billing) for
digital content consumed in-app — Stripe would be rejected on both stores. Stripe
stays valid for the **web** build.

## Design principle — one entitlement, many sources

Do **not** change the gate. `entitlements/{uid}` stays the single
server-authoritative record and `isEntitled` / `BillingSync` are unchanged. We
just add a second **server-side writer** for native purchases.

```
WEB     Paywall ─▶ Stripe Checkout ─▶ stripeWebhook ─────────┐
                                                             ▼
iOS/    Paywall ─▶ RevenueCat SDK ─▶ RevenueCat ─▶ revenueCatWebhook ─▶ entitlements/{uid}
Android    (native purchase)          (Cloud Function, NEW)             │  (unchanged shape)
                                                                        ▼
                                              BillingSync ─▶ state.subscription ─▶ isEntitled
```

Current record shape (keep identical — `src/store/BillingSync.tsx` `mapEntitlement`
already tolerates missing fields like `stripeCustomerId`):

```
entitlements/{uid} = {
  status: 'none'|'trialing'|'active'|'past_due'|'canceled'|'incomplete',
  plan:   <price/product id>,
  currentPeriodEnd: <epoch seconds>,
  trialEnd: <epoch seconds | null>,
  stripeCustomerId?: <string>,   // web only
  store?: 'stripe'|'app_store'|'play_store',  // NEW, optional, for disambiguation
  updatedAt: <epoch ms>,
}
```
`entitled = status === 'trialing' || status === 'active'` (same rule as
`functions/src/billing.ts` `writeEntitlement`).

---

## Store & RevenueCat setup (owner console tasks)

1. **App Store Connect** — create **auto-renewable subscriptions** (one group):
   product id `sho_weekly_200` at **AUD $2.00/week** with a **4-week free
   introductory offer**, and `sho_annual_9000` at **AUD $90.00/year** (no trial).
   Generate the **In-App Purchase key** / app-specific shared secret for RevenueCat.
2. **Google Play Console** — create a **subscription** with a weekly base plan
   (**4-week free-trial offer**) and an annual base plan. Create a **service
   account** for RevenueCat.
3. **RevenueCat** — one project, add the iOS and Android apps, paste the store
   credentials, define entitlement **`premium`**, and an **offering** whose
   packages map both store products to `premium`.
4. Register the **RevenueCat webhook** URL (the new Cloud Function below) with a
   shared **Authorization** secret.

> RevenueCat has a free tier under a monthly revenue threshold; above it there's a
> fee. It removes almost all receipt-validation / renewal / refund plumbing, which
> is why it's preferred over hand-rolling StoreKit 2 + Play Billing validation.

---

## Backend changes (`functions/`)

1. **Extract the writer.** Move `writeEntitlement()` out of
   `functions/src/billing.ts` into `functions/src/lib/entitlements.ts` as a shared
   helper taking a normalized shape `{ status, plan, currentPeriodEnd, trialEnd,
   store, extra? }`, writing `entitlements/{uid}` + mirroring
   `users/{uid}.profile.premium`. Stripe path calls it with `store: 'stripe'`.
2. **New `revenueCatWebhook`** (`onRequest`, mirrors `stripeWebhook`):
   - Verify the RevenueCat `Authorization` header against a Function secret
     `REVENUECAT_WEBHOOK_AUTH` (like Stripe's signature check). **Not** App Check /
     `requireAuth` — it's a server-to-server webhook, exempt like `stripeWebhook`.
   - `app_user_id` on the event **is the Firebase uid** (guaranteed by the client
     `Purchases.logIn(uid)` step below).
   - Map RC event → `SubscriptionStatus`:
     - `INITIAL_PURCHASE`, `RENEWAL`, `PRODUCT_CHANGE`, `UNCANCELLATION`,
       `NON_RENEWING_PURCHASE` → `active`, or `trialing` when
       `period_type === 'TRIAL'`.
     - `CANCELLATION` = auto-renew turned off → **stay entitled until expiry**
       (keep `active`/`trialing`; the store still grants access to period end).
     - `EXPIRATION` → `canceled`. `BILLING_ISSUE` → `past_due`.
   - `currentPeriodEnd` = `expiration_at_ms / 1000`; `trialEnd` set when in trial;
     `plan` = product id; `store` = `'app_store'` / `'play_store'` from the event.
   - **Idempotency:** dedupe on the RC event `id` (RC may retry).
3. **Leave `stripeWebhook`, `createCheckoutSession`, `createBillingPortalSession`
   as-is** (web path). Export the new function from `functions/src/index.ts`.
4. **Firestore rules** — Zone B unchanged (client read-only; both webhooks write
   with Admin privileges and bypass rules).

## Client changes (`src/`)

1. **Add `react-native-purchases`** (RevenueCat SDK) + its Expo config plugin.
   Native module → needs a dev/prod build (already have the EAS dev-build path).
   Keys via `EXPO_PUBLIC_RC_IOS_KEY` / `EXPO_PUBLIC_RC_ANDROID_KEY`.
2. **Identify the user.** On sign-in: `Purchases.configure({ apiKey })` then
   `await Purchases.logIn(firebaseUid)` so RC's `app_user_id` **equals the Firebase
   uid** (this is what lets the webhook resolve the uid). On sign-out:
   `Purchases.logOut()`. Wire alongside `AuthProvider`.
3. **New `src/lib/iap.ts`** (native-only): `getOfferings()`, `purchase()` (buys the
   `premium` package), `restore()` (`Purchases.restorePurchases()`). No-op / throws
   on web.
4. **`src/screens/Paywall.tsx`** — branch by platform:
   - Native: the "Start my 4-week free trial" CTA calls `iap.purchase()`; the
     **Restore** link calls `iap.restore()`.
   - Web: keep the existing `startCheckout()` (Stripe) and the Stripe portal for
     Restore/manage. (`src/lib/billing.ts` stays for web.)
   - After a native purchase, the gate flips when the `revenueCatWebhook` writes
     `entitlements/{uid}` and `BillingSync` sees it — same "confirming…" UX as the
     Stripe path. Optionally unlock optimistically from
     `customerInfo.entitlements.active['premium']` for instant feedback, but keep
     `entitlements/{uid}` authoritative.
5. **Manage / cancel** — native subscriptions are managed by the OS, not the
   Stripe portal. On iOS deep-link `itms-apps://apps.apple.com/account/subscriptions`;
   on Android the Play subscriptions screen; web keeps the Stripe portal. Update
   the Terms/Settings copy accordingly (Terms already say "Stripe or the applicable
   app store" — good).
6. **Required subscription disclosure** near the CTA (Apple requires it): title,
   length, **$2.00/week AUD after a 4-week free trial (or $90/year upfront),
   auto-renews until cancelled**, and links to Terms & Privacy. Add to the Paywall.

## Types

`Subscription` / `SubscriptionStatus` (`src/store/types.ts`) are unchanged.
`plan` becomes the store product id on native; `stripeCustomerId` is simply absent.
`mapEntitlement` already ignores unknown/missing fields, so adding `store` is safe.

## Trials & eligibility

Trials are configured on the **store products** (Apple introductory offer / Play
free-trial offer), not in code — RC reports `period_type: TRIAL` → `trialing`.
Note the eligibility difference vs Stripe: Apple/Google enforce **one trial per
Apple ID / Google account**, not per app account. Acceptable, but don't promise
"everyone gets a free trial" in copy.

## Testing

- iOS **sandbox** testers, Play **license** testers, RevenueCat **sandbox** mode.
- End-to-end: purchase → RC webhook → `entitlements/{uid}` flips → gate unlocks;
  restore on a fresh install; cancel (auto-renew off, still entitled to period
  end); expiry → gate closes; billing issue → `past_due`; refund.
- Demo mode unaffected (Firebase off → `isEntitled` always true).

## Sequencing

1. Store products + RevenueCat config (owner).
2. Backend: extract `writeEntitlement` → shared helper; add `revenueCatWebhook`;
   deploy; register RC webhook URL + secret.
3. Client: SDK + `iap.ts` + Paywall native branch + logIn/logOut + manage/cancel +
   disclosure copy.
4. Dev-build sandbox test end-to-end on a real device.
5. Ship native with IAP; Stripe stays on web only.

## Alternative (no RevenueCat)

Direct **StoreKit 2** + **Play Billing** with your own receipt validation and
renewal/refund handling in Cloud Functions. Fewer dependencies/cost, but
materially more code and edge cases (grace periods, billing retries, refunds,
upgrade/downgrade proration). RevenueCat is the pragmatic default; this is the
fallback if you want to avoid the dependency.

## Related

- `docs/STRIPE_SETUP.md` (web billing, unchanged) · `docs/APP_STORE.md` (payments
  blocker) · `functions/src/billing.ts` · `src/store/BillingSync.tsx` ·
  `src/store/selectors.ts` (`isEntitled`) · `src/screens/Paywall.tsx`.
