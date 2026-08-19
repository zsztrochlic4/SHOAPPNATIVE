# Stripe paywall setup

The paywall sells **two plans** via **Stripe Checkout** (hosted redirect):

- **Weekly** — 4-week free trial, then **$2.00/week AUD**.
- **Annual** — **$90 AUD upfront** for 52 weeks (~$1.73/week), charged today (no trial).

Backed by three Cloud Functions in `functions/src/billing.ts`:

| Function | Type | Purpose |
|---|---|---|
| `createCheckoutSession` | callable | Returns a hosted Checkout URL for the chosen plan (`plan: 'weekly' \| 'annual'`). |
| `createBillingPortalSession` | callable | Returns a Billing Portal URL (Restore / manage / cancel). |
| `stripeWebhook` | HTTPS | The **only** writer of `entitlements/{uid}` — the authoritative paid record the app reads. |

Entitlement lives in Firestore `entitlements/{uid}` (Zone B in `firestore.rules`:
owner-readable, all client writes denied). The client mirrors it into the store
via `src/store/BillingSync.tsx`; the paywall gate is `isEntitled` in
`src/store/selectors.ts`. Nothing here changes demo mode — with Firebase off,
`isEntitled` is always true and the paywall never shows.

## 1. Create the product & prices (Stripe Dashboard, **Test mode** first)

1. Dashboard → **Products** → **Add product**: name it e.g. "StrengthHub Online".
2. Add **two recurring prices** on that product:
   - **AUD 2.00 / week** → its price id is `STRIPE_PRICE_ID` (weekly).
   - **AUD 90.00 / year** → its price id is `STRIPE_PRICE_ID_ANNUAL` (annual).
3. Copy both **price ids** (`price_…`).
   (The 28-day free trial for the weekly plan is applied in code via
   `trial_period_days`, not on the price — so you don't configure the trial in
   the Dashboard. The annual plan is charged today, with no trial.)

## 2. Set the backend secrets

The secret key, webhook secret and both price ids are **Function secrets** —
never in `.env`, never committed:

```bash
firebase functions:secrets:set STRIPE_SECRET_KEY         # sk_test_… (then sk_live_… for prod)
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET     # whsec_… (from step 4)
firebase functions:secrets:set STRIPE_PRICE_ID           # price_… weekly (from step 1)
firebase functions:secrets:set STRIPE_PRICE_ID_ANNUAL    # price_… annual (from step 1)
```

## 3. Set the client publishable key

In `.env` (or your EAS build env):

```
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…
```

This is public and safe to ship. (Checkout is hosted, so the client never needs
the secret key.)

## 4. Deploy the functions, then register the webhook

```bash
cd functions && npm install && npm run build
firebase deploy --only functions:createCheckoutSession,functions:createBillingPortalSession,functions:stripeWebhook
```

The webhook URL (region `australia-southeast2`) is:

```
https://australia-southeast2-<your-project-id>.cloudfunctions.net/stripeWebhook
```

In Stripe Dashboard → **Developers → Webhooks → Add endpoint**, paste that URL
and subscribe to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Copy the endpoint's **Signing secret** (`whsec_…`) into `STRIPE_WEBHOOK_SECRET`
(step 2), then redeploy `stripeWebhook` once so it picks up the secret.

## 5. Enable the Billing Portal (for Restore / cancel)

Stripe Dashboard → **Settings → Billing → Customer portal** → activate, and allow
cancellations. Otherwise `createBillingPortalSession` returns a configuration error.

## 6. Test the flow

1. Run the app with Firebase **on** (`EXPO_PUBLIC_DEMO_MODE=0`) and the keys above.
2. Get Started → complete onboarding → **Create Account** (real Firebase signup).
3. On the paywall, tap **Start my 4-week free trial** → Stripe Checkout opens.
4. Pay with test card `4242 4242 4242 4242`, any future expiry / CVC / postcode.
5. On return, the webhook writes `entitlements/{uid}` (`status: "trialing"`),
   BillingSync flips the gate, and the app lands on the **dashboard**.

Verify the record: Firebase console → Firestore → `entitlements/{uid}`, or the
Stripe Dashboard → Customers.

## Going live

Repeat with **live-mode** keys (`sk_live_…`, `pk_live_…`), a live price id, and a
live webhook endpoint + signing secret. Keep test and live secrets separate.

## Notes / follow-ups

- **App Check**: the callables use `APP_CHECK_ENFORCED` (currently `false`, in
  `functions/src/lib/guards.ts`) like the rest of the backend — flip it on once
  the client attests. The webhook is intentionally exempt (Stripe signs it).
- **Apple/Google Pay**: appear automatically on the hosted Checkout page for
  eligible devices/browsers — no extra native config. The in-app "Continue with
  Apple" button on the account screen is a separate Sign-in-with-Apple feature and
  is still stubbed ("coming soon").
- **Native return**: Checkout returns to the app via the `strengthhub://checkout`
  scheme (already set in `app.json`); web returns to the site origin.
