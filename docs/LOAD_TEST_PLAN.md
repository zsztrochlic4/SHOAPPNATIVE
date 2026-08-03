# Load & capacity test plan (audit §9 — scalability)

Validates the backend against the audit's scale scenarios before real growth. The
first constraints are client hydration, network fan-out and the callables — not raw
Firestore throughput — so we load the **callables** and simulate the **read model**.

## Scenarios (from the audit)

| Tier | DAU / concurrent | Core reads/day | Core writes/day | Coach turns/day |
|---|---|---|---|---|
| Pilot | 250 / 25 | 25k–450k | 6k–20k | 200 |
| Growth | 2,500 / 250 | 250k–4.5M | 62k–200k | 2,000 |
| Scale | 10,000 / 1,000 | 1M–18M | 250k–800k | 8,000 |

Run in a **staging** Firebase project (never production), with test accounts.

## What to measure

- p50 / p95 / p99 latency and error rate for each callable
  (`analyzeMeal`, `coachMessage` when enabled, `deleteAccount`, `reportClientError`).
- Cold-start hydration time for a large account (root + windowed collections).
- Firestore read/write counts vs the estimates above (billing sanity).
- That the **cost controls hold** (SA-011): per-user daily cap, **burst** cap, and
  the **global daily** cap all trip as designed under a spike; `maxInstances` bounds
  fan-out. Confirm a burst returns `resource-exhausted`, not unbounded model spend.
- Kill-switch drill: flip `config/coach.killSwitch` under load and confirm the coach
  stops serving within the cache TTL.

## Tooling

`scripts/load/coach-load.js` is a **k6** skeleton for the coach callable (idempotency
key per iteration, ramping VUs). Install k6, then:

```bash
BASE_URL="https://<region>-<project>.cloudfunctions.net" ID_TOKEN="<staging user token>" \
  k6 run scripts/load/coach-load.js
```

Adjust `stages` to hit each tier's concurrency. For Firestore read-model load, drive
the SDK from a Node harness against staging (or replay windowed-collection reads),
measuring cold-start hydration for accounts of increasing size.

## Exit criteria

- p95 latency within target and error rate < 1% at the **pilot** tier (the audit's
  recommended first production ceiling).
- Cost controls demonstrably cap a spike; global budget cannot be blown by one user.
- Kill switch verified. Document results before moving past ~250 DAU.
