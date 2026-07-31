# Server-side AI coach (`coachMessage`)

The AI coach now runs on the **trusted backend**, not the client, so the
deterministic safety floor cannot be bypassed by a modified app (DEVELOPMENT_PLAN
§4.4). **It is still gated OFF** — `coachMessage` returns
`failed-precondition / coach_disabled` until `COACH_ENABLED` is flipped, which is a
separate, human-signed-off decision (see `src/backend/coach/safety/STATUS.md` and
the coach-safety memory). This doc describes what's built and what enabling needs.

## How the safety code is shared — one source, no drift

The guardrails the server runs are the **exact same code** the app runs. The
single source of truth is `src/backend/**`. `functions/scripts/sync-shared.mjs`
copies the transitive closure of the coach entry points (safety layer + engine
bridge) **verbatim** into `functions/src/_shared/` as a **generated, gitignored**
tree, as a prebuild step (`functions` `build`/`typecheck`/`test`). It follows only
relative imports, so it can never pull an app-only module (the sole
Firebase-client dependency in `src/backend` is `repo/**`, which the coach path
never touches — the sync throws if a client-Firebase import is ever reached).

Proof of parity: the app's full **218-assertion §18 safety suite** runs against the
synced copy in the functions test gate — `Coach-safety suite PASSED … on the
production build`. Never hand-edit `functions/src/_shared/`; edit `src/backend/**`
and rebuild.

## What `coachMessage` does (per turn)

`functions/src/coach.ts` → `runCoachTurn` → `coachTurnCore`:

1. **Gate** — `if (!COACH_ENABLED) throw coach_disabled` (the flip point) + remote kill switch.
2. **Auth + App Check** — `requireVerifiedUser` (App Check enforced).
3. **Server-trusted context** — reads the caller's **date of birth** from the
   canonical user doc so the 18+ age gate can't be spoofed; takes `isAustralia` /
   `recent` / injury context from the request.
4. **`coachPrecheckAsync`** (the app's shared entry) — crisis/red-flag precheck
   with the LLM classifier (server-side Gemini transport, temp 0) over the rules
   floor. A **block never calls the model**; a classifier error **fails safe**
   (service-unavailable + crisis options, never a silent allow).
5. **Allowed** → server hard daily cap (`enforceDailyLimit`), then Gemini with
   `buildCoachSystemPrompt()`, then **`guardOutgoing`** (post-response validator).

The client (`src/lib/coachServer.ts`, wired in the coach chat) calls this when the
coach is enabled and falls back to the on-device rules engine on any error. While
the gate is off, that path is never reached (the chat shows "coming soon").

## Enabling — owner / clinical only (unchanged)

`COACH_ENABLED` stays `false` until ALL of:
- **Independent clinical validation** of the classifier against a **fresh** holdout
  the builder never saw (Jack §4): zero critical misses + agreed thresholds.
- The **§19 privacy/consent** foundation (gates the dormant safety-state/analytics stores).
- **App Check** configured + enforced (`docs/APP_CHECK.md`).
- The four independent **§23** reviews (clinical / privacy / safety / security).

## Deploy note (owner)
`firebase deploy --only functions:coachMessage` — a full deploy also redeploys
`analyzeMeal`, which needs the `GEMINI_API_KEY` secret set. `coachMessage` uses the
same secret. Server-side kill-switch wiring (reading `config/coach`) and passing
conversation history to the reply model are small follow-ups.
