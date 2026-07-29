# StrengthHub Online — Test Report (29 July 2026)

## Method & honest scope

- **Automated:** full unit + safety suite (`test/unit`, `test/safety`).
- **Functional:** live click-through of the running app (web build) across all
  five tabs and the workout builder, watching the console for errors.
- **Code/architecture review** for the things that genuinely can't be live-tested
  here and why:
  - The preview runs in **demo mode** (no live Firebase), so real accounts, cloud
    sync across devices, and the real AI meal scan couldn't be exercised — and I
    don't create real accounts. Assessed the auth/sync code instead.
  - **Load ("many users at once")** needs a real load-testing rig; assessed from
    the data model + Firebase behaviour.
  - The **AI coach is gated OFF by design**, so I traced what a user actually gets.

## Automated results

**84 / 84 passing** (sanitisation, response-schema, quiet-hours, dates/DST,
nutrition calc, meal-scan parser, under-18 + refer-by-default safety). Full
typecheck clean.

## Feature-by-feature

| Area | Result | Notes |
|---|---|---|
| **Dashboard** | ✅ Works well | Readiness score, week strip, today's plan, progress cards render cleanly |
| **Workout — today/program/history** | ✅ Works well | Plan, per-exercise sets/reps/weights, progress % |
| **Workout builder ("New workout")** | ✅ Works well | Opens, name field accepts input, **full 113-exercise DB** with categories |
| **Progress** | ✅ Works well | Body-weight trend, per-lift 1RM estimates, steps, sleep, volume |
| **Nutrition — meal scan** | ✅ Works (honest) | Shows a calorie **range + confidence + "estimate, not a label" disclaimer**; graceful "log manually" when AI unavailable |
| **Nutrition — day tags / Q&A** | ✅ Works | Rules-based food Q&A + day-review scoring |
| **Community** | ⚠️ Renders, but **seeded** | Feed/groups/challenges show demo content; no live social backend |
| **Console errors** | ✅ None | Zero errors across all tabs + builder |
| **Stability** | ✅ Solid | No crashes, no broken screens |

## ⭐ The coach & meal-plan review — the honest answer

**Question:** *if a user asks the coach to review their meal plan, does it give an
accurate review?*

**Answer: No — not currently.** Here's exactly what happens:
- The in-app coach ([coachChat.ts](../src/lib/coachChat.ts)) is a **rules-based
  keyword responder**, not an AI. It does **not read the user's actual logged
  meals or meal plan.**
- "Review my meal plan" matches the food keyword → it returns a **canned nutrition
  tip** from a fixed Q&A list, or a generic *"I don't have a set answer for
  that…"* fallback. It is **not** a personalised or accurate review of their plan.
- The **real AI coach** (Gemini), which *could* read context and review, is
  **hard-gated off** (`COACH_ENABLED=false`, unvalidated) by design.
- There is a genuine **day-review** feature (`nutritionCoach.reviewDay`) that
  scores a single day of food you type in — but it's heuristic (rules-based), it
  reviews free text, not your plan, and the chat coach doesn't route to it.

**To make "review my meal plan" real and accurate you need:** the AI coach moved
server-side (plan Phase B) + given the user's real meal data as context + a
nutrition DB for grounded numbers + the safety validation gate cleared.

## Many users at once — load assessment (from code)

**What scales fine:**
- Data is **isolated per user** (`users/{uid}` with owner-scoped rules) — no shared
  mutable documents, so no cross-user contention or race conditions. Firestore
  scales horizontally for this pattern.
- Writes are **debounced + batched** (<400/commit), per-user — no hot-spotting.

**What bites under load (all already in the plan):**
1. **Sign-in loads a user's *entire* history** → read cost and latency grow with
   account age; many simultaneous sign-ins = large read bursts. Scales, but costs,
   and lags your most engaged users. → *needs the 7-day/cursor + summaries refactor.*
2. **AI runs on the client with no server-side rate limiting** → many users
   scanning meals = uncontrolled Gemini calls (quota + cost exposure). The budget
   alert *detects* this; it doesn't *prevent* it. → *needs server-side AI + limits.*
3. **App Check isn't enforced** → the public config can be abused at scale
   (cost/abuse). → *needs the backend + App Check (Option B).*

## Priority fixes surfaced by testing

1. **Set expectations on the coach** — either clearly scope it as a rules-based
   helper (not "reviews your plan"), or build the real server-side AI coach. Today
   a user asking for a plan review gets a generic answer, which will disappoint.
2. **Community**: hide or clearly label as "coming soon" until it's backed by real
   data — seeded social can read as fake.
3. **Verify the "Target reached" logic** for weight-*loss* goals (demo showed a
   current weight below target still reading "Target reached").
4. Everything under "load" → the backend + data-model work (plan Phases B & C).

## Bottom line

The **client app is stable and the core loop works well** — dashboard, workout
creation with a real exercise DB, logging, progress, and an honest meal scan all
functioned with zero errors. The **gaps are exactly where the plan says they are**:
the coach can't truly review a meal plan (gated AI), community is seeded, and the
"many users" story depends on the trusted backend + data-model work that hasn't
been built yet.
