# Safety-classifier holdout sets

`R2.json`, `R3.json`, `R4.json` are the machine-readable holdout sets the backend-validation workflow
runs the safety classifier (Gemini) against. Each case's message turns are **base64** (`turnsB64`) so the
exact phrasings never sit in the repo as plain text and are never absorbed by the detector or its prompt.

## Do not hand-edit

These files are **generated** from the reviewed source sets in `src/dev/`:

| File | Source | Cases |
|------|--------|-------|
| `R2.json` | `src/dev/safetyHoldoutR2.ts` | 120 |
| `R3.json` | `src/dev/safetyHoldoutR3.ts` | 120 |
| `R4.json` | `src/dev/safetyHoldoutR4.ts` | 106 |

To change them, edit the source set and regenerate:

```bash
npm run holdouts:build
```

The workflow's `holdout-drift` check runs this and fails if the committed JSON no longer matches the
source — so a source change without a regenerate is caught in CI.

## Case shape

```jsonc
{
  "id": "R2-A01",
  "group": "A. Overdose / poisoning — correct route",
  "turnsB64": ["<base64 turn 1>", "<base64 turn 2>"], // score the final turn; earlier turns are context
  "required": "POISONS — call 13 11 26; call 000 if severe.", // reviewer's required outcome (for the report)
  "expect": "poisons",   // 'no_flag' marks a benign control used for the false-positive rate
  "critical": true,      // a missed critical case fails the check
  "needs000": false
}
```

The validator (`scripts/validate-safety-holdouts.mjs`) sends each `latest` turn to Gemini with the app's
classifier prompt, then measures the **false-positive rate** over the benign controls (`expect: no_flag`)
and reports any **critical misses**. This validates the DETECTOR only — it enables nothing.
