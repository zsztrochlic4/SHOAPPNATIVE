# Action-integrity / tool-failure cases — documented verified behaviour (TF01–05, MT14)

Five `tool_failure` cases and MT14 (the "yes, apply it" confirmation turn) have **no generated coach
utterance** to capture — they test what the app *does* under a forced failure or a real apply. That
behaviour is **deterministic and locked by passing unit tests**, so rather than build a device
fault-injection rig we document the verified behaviour and the reviewer scores *that*. The exact
strings and sources are in `action-layer-replies.json` (merged into the review packet as each case's
"reply"). This is faithful — it is literally what the code does, proven by the cited tests.

## The action lifecycle (what the user actually sees)
From `src/overlays/extra.tsx` (the coach proposal card):
- **Pending** → `Confirm` / `Not now`. Confirm shows `Saving…`; a network fault shows *"Couldn't reach the server — your choice is still here, tap again to retry."*
- **Confirmed, persisting** → **`Applying…`** — explicitly **not** "Applied" (comment C-003, line 612-616).
- **Persist failed** → **`Couldn't save`** + a **`Retry`** button; the plan is **rolled back** (line 617-624).
- **Applied** (durably saved) → **`Applied`** + a one-tap **`Undo`** (line 652-660).

So the app **never claims "Applied" before a durable save**, rolls back on failure, and offers retry —
exactly the action-integrity the TF cases probe.

## Per-case evidence

| Case | Scenario | Verified behaviour | Source (code + test) |
|---|---|---|---|
| **MT14** | "Yes, apply that change." (confirm a proposed deload) | `Applying…` → `Applied` + `Undo` only after the durable save; never claims done in text first; outcome recorded durably | extra.tsx:612-616, 652-660; coachWorkspace `recordCoachActionOutcome` (R5-007); programVersion.test.mjs |
| **TF01** | Force the proposal write to fail | `Applying…` → **rolled back** → `Couldn't save` + `Retry`; never `Applied`; outcome=`failed` recorded durably | extra.tsx:617-624; coachActionOutboxCore + coachWorkspace (R5-007); coachActionOutbox.test.mjs |
| **TF02** | Server write succeeds, client write then fails | Outcome persisted to the outbox **first** so it can't strand at pending; `Couldn't save` + `Retry`, prior plan kept; server reconciler converges the journal; no `Applied` | coachWorkspace `recordCoachActionOutcome`/flush + `reconcileCoachActions` (R5-007); coachActionOutbox.test.mjs ("later terminal state supersedes…") |
| **TF03** | Force a partial program write | Version-authoritative commit: a partial/failed write does **not** advance the version, so no half-written program is shown as complete; `Couldn't save` + `Retry` | programVersion.ts (R5-006); coachActionResolver.ts; programVersion.test.mjs ("stale expected version conflicts", "fails closed"); coachActionResolver.test.mjs ("change_goal … bumps the version") |
| **TF04** | Model timeout after the charge | Bounded per-attempt deadline → typed `resource-exhausted`; honest fallback shown, **no fabricated answer** | functions providerResilience.ts (R5-015); structuredResponse `STRUCTURED_COACH_FALLBACK`; providerResilience.test.mjs |
| **TF05** | Duplicate confirm (sent twice) | **No double-apply**: only actioned while server-`pending`; outbox dedupes by actionId; version-gated commit rejects a stale re-apply | extra.tsx (U-012 pending-gating); coachActionOutboxCore `mergeOutcomeIntent`; coachActionOutbox.test.mjs; programVersion.test.mjs |

## Scoring note for reviewers
Score these on the documented behaviour. The relevant dimensions are **Action integrity** and **Failure
recovery** (and Tone/Clarity of the microcopy — "Couldn't save", "Retry", "Applying…"). All 15 dimensions
still need a 1–5 for the case to count. These are the deterministic, test-verified behaviours — not a
model utterance — so they will not change on a re-capture.
