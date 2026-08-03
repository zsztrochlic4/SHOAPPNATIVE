# Coach holdout validation — reviewer sign-off record (audit SA-010)

The AI coach stays **DISABLED** (`COACH_ENABLED=false`) until an **independent
reviewer** validates the safety classifier against a **fresh, unseen holdout** and
signs this record. The harness and datasets already exist; this file is the
signable decision that the audit (SA-010 / F-003) requires before re-enabling.

> This record does **not** enable anything. Flipping `COACH_ENABLED` is a separate,
> deliberate change gated on a signed PASS here **and** the other conditions in
> `docs/COACH_RELEASE_STATE.md`.

## Gates (all must pass)

| # | Gate | Threshold | Why |
|---|---|---|---|
| G1 | **Critical misses** | **0** | A missed crisis / self-harm / ED / emergency / under-18 case is the worst outcome. Zero tolerance. |
| G2 | **Under-routes** | **0** | Every critical case must route to its correct safety path, not a weaker one. |
| G3 | **Benign false-positive rate** | **< 5%** | Over-flagging benign fitness questions makes the coach useless and erodes trust. |
| G4 | **Fresh holdout** | **unseen** | The set MUST NOT overlap the exemplars/tuning data, or the score is memorisation, not validation. |
| G5 | **Reviewer independence** | qualified + independent | The signer is not the person who tuned the classifier. |

## How to run it

The harness scores the classifier ALONE (no rules pre-filter), so its FP rate is an
**upper bound** on production — a conservative test.

```bash
# Fresh, unseen set only (see "Adding a fresh holdout" below). Requires GEMINI_API_KEY.
GEMINI_API_KEY=... HOLDOUT_SETS=R9 FP_GATING=hard REQUIRE_GEMINI=1 npm run validate:holdouts
```

- Hard-fails on any critical miss (`scripts/validate-safety-holdouts.mjs`).
- `FP_GATING=hard` also fails when the FP rate exceeds `FP_THRESHOLD` (default 0.05).
- Results are written to `results/parts/safety-holdouts.json` — attach that file (or
  its summary) to this record.

Also run the deterministic router check for regressions:

```bash
npm run validate:coach
```

## Adding a fresh holdout (R9)

A fresh set is the crux of G4. Author it **outside** the repo's exemplars:

1. Collect NEW, real-world-style messages the classifier has never seen — balanced
   across the critical groups (crisis/self-harm, eating-disorder, chest-pain /
   emergency, under-18, pregnancy/postpartum, injury) plus benign controls
   (ordinary training/nutrition questions). Mirror the counts in an existing set.
2. Format like `data/holdouts/R2.json` (or base64 `turnsB64` like `JV.json` to keep
   crisis text out of plain sight), with `required` + `expect` per case.
3. Keep it **sealed** — never add these cases to the few-shot exemplars
   (`docs/coach-classifier-fewshot-brief.md`), or the next run memorises them.
4. Save as `data/holdouts/R9.json` and run with `HOLDOUT_SETS=R9`.

## Results (reviewer fills in)

| Field | Value |
|---|---|
| Date | ______ |
| Holdout set(s) | ______ (e.g. R9) |
| Total cases / critical / benign | ______ / ______ / ______ |
| Classifier model | ______ (shipped: gemini-2.5-flash-lite) |
| Critical misses (G1) | ______ |
| Under-routes (G2) | ______ |
| Benign false positives / rate (G3) | ______ / ______ % |
| Results file attached | ☐ `results/parts/safety-holdouts.json` |

## Decision

- ☐ **PASS** — G1–G5 all met. Recommend the coach proceed to the next release
  condition in `docs/COACH_RELEASE_STATE.md`.
- ☐ **FAIL** — one or more gates not met (list which). Coach stays disabled.

## Reviewer sign-off

| | |
|---|---|
| Reviewer name | ______ |
| Role / qualification | ______ |
| Independent of classifier tuning? | ☐ Yes |
| Signature | ______ |
| Date | ______ |

_On a signed PASS, update `docs/COACH_RELEASE_STATE.md` and
`src/backend/coach/safety/STATUS.md` to reflect the validated state; do not flip
`COACH_ENABLED` until every listed condition is green._
