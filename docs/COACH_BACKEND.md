# Server-side AI coach

The AI coach runs on the trusted Firebase backend. Its current architecture,
data model, privacy boundary and operations are documented in
[COACH_IMPLEMENTATION.md](./COACH_IMPLEMENTATION.md).

## Shared safety code

`src/backend/**` is the source of truth. `functions/scripts/sync-shared.mjs`
copies the coach contracts, operating rules, structured-response validator and
safety modules into the backend's generated `_shared` tree before builds and
tests. Never hand-edit generated shared files.

## `coachMessage` turn order

1. Verify the signed-in user, enable gate and remote kill switch.
2. Load consent, verified age, app context, memory, conversation history and
   safety continuity state from Firestore. Client-supplied copies are ignored.
3. Run the deterministic safety floor and server-side Gemini classifier.
4. Enforce the authoritative daily limit.
5. Generate a strict JSON reply with Gemini.
6. Validate structure and approved sources, run outgoing safety validation,
   persist the authoritative turn, and save only exact-quote memories.

A blocked message never reaches the answer model. Classifier failure fails safe.
Backend failure does not fall back to a local coaching answer.

## User controls

The coach profile provides explicit consent, independent long-term memory
control, inspect/delete/clear memory, proactive-check-in preference and coaching
style. Any navigation proposal requires explicit confirmation and is audited.

## Release operations

- Remote off-switch: `config/coach.killSwitch`.
- Secret: `GEMINI_API_KEY`.
- App Check enforcement follows the app-wide `APP_CHECK_ENFORCED` setting.
- Run the root app tests, functions tests and Firestore-rules emulator tests
  before deploying through the normal owner release process.
