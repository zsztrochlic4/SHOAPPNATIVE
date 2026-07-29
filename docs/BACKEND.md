# Backend — status

> **The legacy Claude / Anthropic coach backend documented here has been retired.**
> `api/coach.ts` and the `ANTHROPIC_API_KEY` / `EXPO_PUBLIC_COACH_API` wiring are
> no longer used. Do not deploy the old Anthropic HTTPS function.

## Where the coach runs today

The in-app coach uses **`firebase/ai` (Gemini)** and currently runs **client-side**,
**gated off** (`COACH_ENABLED=false`) and **unvalidated** (last holdout failed).

## What the plan requires next (Production Readiness — The Ultimate Plan)

- **§3 / Blocker #3 — trusted application backend:** stand up Cloud Functions v2 /
  Cloud Run as the single App Check enforcement point and the host for coach
  orchestration, meal analysis, the notification sender, and account deletion.
- **§4.4 — move the coach server-side:** the Gemini call must not run on the
  client, so the deterministic safety floor cannot be bypassed by a modified app.
- **§4.3 / Blocker #4 — App Check (Option B, recommended):** keep the JS SDK on
  the client and verify Play Integrity / App Attest server-side in that backend.
- **Coach release gate (§ Phase 6):** stays closed until a fresh independent
  holdout passes with zero critical misses and the required sign-offs are in.

See `StrengthHub_Production_Readiness_ULTIMATE.docx` for the full roadmap.
