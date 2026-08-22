# StrengthHub · Analytics (admin dashboard)

The owner-only analytics dashboard deployed to the **`strengthhub-admin`** Firebase
Hosting site (`https://strengthhub-admin.web.app`). Vite + React + TypeScript +
Recharts, talking to the `strengthhub-2ab33` backend.

It shows the **Overview** tab (8 KPI cards + 4 trend charts, with a 7/28/90-day
range selector and refresh) and the **Users** tab (per-account table).

## How it gets its data

Firestore security rules deny cross-user reads, so the dashboard does **not** read
Firestore directly. It calls two owner-gated Cloud Functions that aggregate with
the Admin SDK:

- `adminAnalytics({ rangeDays })` — KPIs + daily series, from Firebase Auth
  (users / sign-ups / activity) and `entitlements` (MRR).
- `adminUsers({ limit })` — per-account rows for the Users tab.

Both are gated by the existing **`owner`** custom claim (`requireOwner`), the same
gate as the notification sender. Source: `functions/src/adminAnalytics.ts`.

## First-time setup

1. **Give your account the owner claim** (once), from the repo root:
   ```bash
   node scripts/set-owner-claim.mjs <your-firebase-uid>
   ```
   Then sign out / back in so the new token carries the claim.

2. **Make sure the site's domain is an authorized Auth domain**: Firebase console →
   Authentication → Settings → Authorized domains → add `strengthhub-admin.web.app`
   (usually already present).

## Deploy

**1 — the backend functions** (from the repo root):
```bash
cd functions && npm install && npm run build && cd ..
firebase deploy --only functions:adminAnalytics,functions:adminUsers
```

**2 — the dashboard** (from this folder):
```bash
cd admin
npm install
npm run build
firebase deploy --only hosting     # uses admin/firebase.json → site strengthhub-admin
```

`npm run deploy` does the build + hosting deploy in one step.

## Local dev

```bash
cd admin && npm install && npm run dev
```
Uses the production backend, so you'll see live data once you're signed in as the
owner. Firebase web config ships as working defaults in `src/firebase.ts`; override
via `.env` (see `.env.example`) only if needed.

## Tuning the metrics

Everything schema-dependent lives in the **SCHEMA / PRICING MAP** block at the top
of `functions/src/adminAnalytics.ts` (entitlement statuses, price, adherence field
names). Reads are defensive — a missing field degrades to a sensible default rather
than throwing. `App opens (daily)` is currently proxied from per-day last-active;
wire an events collection and swap `appOpensDaily` for exact opens when ready.
