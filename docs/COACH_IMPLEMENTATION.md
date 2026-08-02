# AI coach implementation

This is the implementation record for the persistent, data-aware StrengthHub
coach completed on 2 August 2026. It supersedes older notes that describe a
client-side model call, client-supplied safety context, or an on-device answer
fallback.

## Product behaviour

- The coach answers bounded health, fitness and wellbeing questions, including
  established general education beyond features already in the app.
- Personalised claims are made only from server-built StrengthHub context.
- Clearly off-topic requests are declined and redirected to the app's purpose.
- Medical diagnosis/treatment, crisis support and other high-risk areas remain
  governed by deterministic safety routes and fixed responses.
- Users must be verified adults and explicitly consent before context is sent to
  Gemini.
- Users can withdraw consent and erase the coach workspace and safety state
  without deleting their main account.
- The UI labels general, personalised and app-help answers and shows approved
  knowledge sources when returned.
- The coach cannot silently change the app. A bounded navigation proposal
  expires after 24 hours, requires explicit confirmation and creates an audit
  record.

## Trusted turn flow

1. Firebase Authentication, the enable gate and remote kill switch run.
2. The backend loads canonical profile/DOB, relevant recent app data, coach
   preferences, confirmed memories, authoritative conversation history and
   minimal cross-session safety state.
3. Missing consent/data and unverified or under-18 age fail closed.
4. Shared rules and the safety classifier run before the answer model. Blocked
   content never reaches the answer model.
5. A server-authoritative daily limit is enforced.
6. Gemini receives minimized server context and returns a strict schema.
7. The server validates the schema and sources, runs the outgoing safety guard,
   verifies memory evidence against the current user message, and persists the
   authoritative turn.
8. Backend failure produces a neutral unavailable message, never a local AI
   answer fallback.

## Firestore layout

```text
coachUsers/{uid}                         consent + preferences
coachUsers/{uid}/turns/{turnId}          conversation turns
coachUsers/{uid}/memories/{memoryId}     user-visible memories
coachUsers/{uid}/proposals/{proposalId}  expiring proposals
coachUsers/{uid}/actions/{actionId}      decision audit records
coachUsers/{uid}/conversationSummaries/* reserved summaries
coachUsers/{uid}/insights/*              reserved insights
coachUsers/{uid}/proactiveState/*        reserved proactive state
coachSafety/{uid}                        minimal server-only safety state
```

The owner can read ordinary coach data but cannot write it directly. Mutations
go through verified callable functions. `coachSafety` is denied to every client.
Account deletion recursively deletes the user, coach workspace and safety state.
The account export includes ordinary coach workspace data but excludes the
server-only safety-control document.

## Operations

- Emergency off-switch: `config/coach.killSwitch`.
- The Gemini API key remains a Cloud Functions secret.
- App Check follows the app-wide enforcement setting; do not claim production
  enforcement until attestation is enabled across the app.
- Run app, functions, safety, unit and Firestore-rules tests before release.
- Deployment remains part of the owner's normal release process.
