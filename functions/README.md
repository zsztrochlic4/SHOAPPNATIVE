# StrengthHub Online — backend (Cloud Functions v2)

The trusted server tier. It exists so sensitive/costly work stops happening on
the client: it is the **App Check enforcement point** and the home for
**server-side AI, the notification sender, and complete account deletion**.
See [`docs/DEVELOPMENT_PLAN.md`](../docs/DEVELOPMENT_PLAN.md) §2 / Phase B.

> **Status: scaffold.** `ping` works. The feature callables verify Auth + App
> Check but throw `unimplemented` — they're ready to fill in.

## Layout
```
functions/
  src/
    index.ts          entry — sets region (australia-southeast2) + exports
    ping.ts           health check (App Check not enforced, for smoke tests)
    meal.ts           analyzeMeal      — server-side Gemini meal scan   [stub]
    coach.ts          coachMessage     — server-side AI coach + safety  [stub, gated]
    account.ts        deleteAccount    — admin-side full account purge  [stub]
    notifications.ts  sendNotification — owner push sender              [stub]
    lib/guards.ts     requireAuth / requireAppCheck / requireVerifiedUser
```

## Develop
```bash
cd functions
npm install
npm run build        # tsc → lib/
npm run serve        # build + Functions emulator (needs a JDK on PATH)
```

## Deploy (later — needs Blaze, which the project has)
```bash
npm run deploy       # firebase deploy --only functions
```
Nothing here is deployed yet. Deploy is a deliberate, owner-approved step.

## Conventions
- Every user-facing callable calls `requireVerifiedUser(req)` (App Check + Auth)
  and sets `{ enforceAppCheck: true }`.
- Region is pinned to `australia-southeast2` to sit next to Firestore.
- `maxInstances` is capped (budget guard) — raise deliberately as load grows.

## Next steps (Phase B, in order)
1. `analyzeMeal` — move the Gemini vision call here; reuse `mealScanParse` logic;
   add a per-user rate limit + audit. Then point the app's `mealScan.ts` at it.
2. `deleteAccount` — Admin-SDK purge of the root doc + Storage + audit record.
3. Turn on App Check enforcement (Option B: verify Play Integrity / App Attest).
4. `sendNotification` + Scheduler/Tasks (Phase D).
5. `coachMessage` — only after the safety release gate is cleared.
