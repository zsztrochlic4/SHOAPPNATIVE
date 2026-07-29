# StrengthHub Online — Development & Improvement Plan

A grounded, prioritised roadmap for continuing to build the app, based on a
review of the actual codebase and Firebase project (29 July 2026). It reflects
work already shipped this cycle and focuses on what to do next.

---

## 1. Architecture as it stands today

**It's a client-only app talking directly to Firebase's managed services.** There
is no server of our own.

```
Expo / React Native app  ──(Firebase JS SDK v12)──►  Firebase (Google-managed)
  • Auth (email/pw + web Google)                        • Authentication
  • CloudSync: full-history load + diff-save            • Firestore (AU region)
  • Storage reads (exercise media)                      • Storage
  • AI calls ON THE DEVICE (coach, meal scan) ──────►   • AI Logic → Gemini
  • Local notifications                                 • (Hosting — privacy page)
```

**What's healthy**
- Security rules are hardened, deployed, and covered by CI (per-collection
  allowlist, owner checks, server-only entitlements, default-deny).
- Auth lifecycle is solid: sign-up/in, Google (web), and now working password reset.
- Data is split into a small root doc + per-entry subcollections (scales past the
  1 MB doc limit).
- AU data residency, PITR + daily backups, Blaze billing, a spend alert.
- In-app account deletion, a real (client-side) AI meal scan, and reanimated
  gestures all shipped this cycle.

**The structural gaps (everything below flows from these)**
1. **No trusted backend.** AI calls, the notification sender, complete account
   deletion, and any authoritative writes have nowhere server-side to live.
2. **App Check isn't enforced.** The Firebase config + AI endpoints are reachable
   from a modified client; only a *web* app is registered, so native can't attest.
3. **Sign-in loads all history** and there are no Firestore indexes — fine now,
   degrades for your most engaged users over time.
4. **AI runs on the client** — a security and cost-control weakness, and the
   coach/meal features can't be made "launch-grade" from there.

---

## 2. The one pivotal decision: build a trusted backend

Almost every remaining improvement depends on having **our own server tier**. It
is the single highest-leverage thing to build next.

**Recommendation: Cloud Functions v2 (or Cloud Run) in the same Firebase project.**
- Same ecosystem, scales to zero, cheap, no new infra to learn.
- Becomes the home for: server-side AI orchestration, the App Check enforcement
  point, the notification sender, complete account deletion, and any
  server-authoritative data (coach messages, summaries, audit records).

Once it exists, it unlocks App Check "Option B" (verify Play Integrity / App
Attest server-side while keeping the JS SDK on the client) — the recommended path
that avoids a disruptive `@react-native-firebase` migration.

---

## 3. Phased roadmap (dependency-ordered)

### Phase A — Finish launch prep + quick wins *(no backend needed; do now)*
- **Store submission:** privacy policy is live; fill Apple/Google data-safety
  forms from `docs/DATA_SAFETY.md`; complete store metadata, screenshots,
  age rating, camera/notification permission copy.
- **Branded auth emails:** set sender name + (optional) custom domain in Firebase
  Auth templates.
- **Testing/CI hardening:** add a lint/format gate; broaden the pure-domain tests
  (goal changes, nutrition calc, migrations); gate EAS preview builds on PRs.
- **Offline resilience review:** the RN JS SDK has weak Firestore offline caching;
  confirm the AsyncStorage-persisted store covers a cold offline open, and add a
  clear offline indicator.
- **EAS Update channels:** finish `eas update:configure` + dev/preview/prod
  channels so JS fixes can ship without a store review.

### Phase B — Stand up the trusted backend *(the linchpin)*
- Cloud Functions v2 base: verify Auth + App Check on every call; rate limits,
  idempotency, structured logging, audit records.
- **Move AI server-side:** coach + meal-scan orchestration behind the backend so
  the Gemini calls can be attested and rate-limited (removes the client exposure).
- **App Check Option B:** enforce "only our backend may call Gemini / write
  authoritative fields."
- **Complete account deletion:** an Admin-SDK path that also removes the root doc
  and any Storage objects (client version already covers subcollections + login).

### Phase C — Data model for scale
- Bounded reads: 7-day / cursor query contract instead of load-all-history.
- Daily + weekly summary projections for fast dashboards/progress.
- Add the composite indexes those queries need (`firestore.indexes.json` is empty).

### Phase D — Notifications end-to-end
- Backend sender: Cloud Scheduler + Tasks → Expo Push / FCM / APNs, sharded and
  idempotent (never a full user-base scan), with receipts + opt-out honoured
  server-side. (Local reminders + permission handling already done.)
- A small MFA-protected admin portal for test/segment/schedule/audit sends.

### Phase E — Coach: release or keep gated
- Keep `COACH_ENABLED=false` until: coach is server-side (Phase B), a fresh
  independent holdout passes with zero critical misses, the required sign-offs are
  in, and the kill switch + staged rollout are proven.

### Phase F — Meal scan: make it launch-grade
- Server-side pipeline + food/non-food gate (done client-side) + an **AUS nutrition
  DB (FSANZ/NUTTAB)** for grounded numbers + a dietitian review. Until then it stays
  an honest, disclaimed estimate.

### Phase G — Scale, observability, polish
- Crash reporting (Sentry) and a decision on privacy-preserving analytics.
- Firebase usage/error monitoring beyond the budget alert.
- Performance pass (virtualised lists, cold-start, reduced-motion, a11y).
- Beta: internal → TestFlight/closed → canary, with runbooks and rollback.

---

## 4. Quick wins that are code-shaped (can be picked up next, no backend)
- Lint/format CI gate + more pure-domain tests.
- Offline indicator + verify cold-offline open.
- EAS Update channel setup.
- Native Google sign-in (expo-auth-session) — optional for v1.
- Draft the Cloud Functions scaffold (project structure, App Check middleware)
  so Phase B has a running start.

## 5. Decisions needed from the owner
- **Build the backend now?** (Recommended — it unblocks most of the above.)
- **Coach in v1?** (Recommended: no, until Phase B + validation.)
- **Meal scan in v1?** (Ships now as an honest estimate; "launch-grade" needs Phase F.)
- **Analytics posture** and **crash tooling** (Sentry) — pick before scale.
- **Nutrition DB licensing** (FSANZ/NUTTAB vs USDA fallback).

---

## 6. Suggested next step
If the goal is to keep momentum: **do Phase A quick wins now** (they need no
backend and finish the store story), then **commit to building the Cloud Functions
backend (Phase B)** — it's the gate that turns "a good client app" into "a
secure, scalable product."
