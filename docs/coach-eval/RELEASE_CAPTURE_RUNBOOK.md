# Coach response-eval — release-capture runbook (C-017 provenance)

Two independent reviewers have scored the current build and it **passes the thresholds** (overall 4.70,
every critical dim ≥ 4.0, 0 auto-fails, inter-rater agreement 0.96 — see `COACH_RESPONSE_EVAL.md`,
"Two independent reviewers scored the fixed packet — 2026-08-16"). What is still **not** satisfied is
the **release-run provenance** (`MODE=score` → `pass: false`): the scores must be cryptographically
bound to the exact shipping release.

This runbook is the exact procedure to produce a **valid** release run. It is deliberately NOT run to
green off an offline dev-branch capture — that would attest a shipping-build capture that did not happen.

## What the gate checks (from `scripts/run-coach-response-eval.mjs`)

`MODE=score` requires, in addition to the score thresholds:

1. `replyCount === 60` and a real `repliesHash` — every case has a non-empty captured reply.
2. `corpusHash` matches the hash recomputed from `responseQualityCorpus.ts`.
3. `promptHash` matches the hash of the prompt file that produced the replies.
4. `releaseSha` in the manifest === the expected release SHA (`EXPECTED_SHA`, or HEAD).
5. `model` in the manifest === `EXPECTED_MODEL`.
6. Two distinct reviewers, agreement ≥ 0.75, every critical dim ≥ 4.0, 0 auto-fails.

## Prerequisites (the parts only the owner/release can supply)

- **A capture on the exact shipping build.** The replies must come from the build that ships — ideally
  the deployed `coachMessage` endpoint (or a build-bound capture), NOT the offline harness. The offline
  harness (`eval:replies*`) reproduces the shipped prompt + model + safety router, but it is not the
  deployed endpoint and does not exercise the server-turn guards for every case (AD07/AD09 were
  verified separately on the server path — see the AD09 fix note).
- **The release commit/tag** — the SHA the app actually ships from.
- **The model id** — the model the shipping build calls (currently `gemini-2.5-flash-lite`).
- **The canonical prompt artifact** — provided: `docs/coach-eval/coach-system-prompt.canonical.txt`
  (dumped from `buildCoachSystemPrompt({ allowWorkoutActions: true })`). Regenerate it if the operating
  rules change, in the same change that captures replies.

## Procedure

```bash
# 0. From the SHIPPING build commit, with the reviewers' two filled sheets parsed to JSON:
#    node scripts/parse-review-packet.mjs <r1.docx> "Reviewer 1" eval-out/rev1.json
#    node scripts/parse-review-packet.mjs <r2.docx> "Reviewer 2" eval-out/rev2.json

# 1. Capture the 60 replies on the shipping build → eval-out/replies.json (60 non-empty).
#    Prefer a deployed-endpoint capture; the offline harness is the fallback:
#    GEMINI_API_KEY=... npm run eval:replies && npm run eval:replies:safety && \
#      node scripts/capture-coach-staged-replies.mjs   # then merge TF01-05 documented behaviours

# 2. Emit the manifest BOUND to that release (real hashes, release SHA, model, prompt):
RELEASE_SHA="$(git rev-parse HEAD)" \
MODEL="gemini-2.5-flash-lite" \
PROMPT_FILE="docs/coach-eval/coach-system-prompt.canonical.txt" \
REPLIES="eval-out/replies.json" \
OUT="eval-out" \
  npm run eval:response          # writes eval-out/response-eval-manifest.json (replyCount 60 + hashes)

# 3. Score with the SAME binding — the scorer recomputes the hashes and compares:
MODE=score \
SHEETS="eval-out/rev1.json,eval-out/rev2.json" \
MANIFEST="eval-out/response-eval-manifest.json" \
REPLIES="eval-out/replies.json" \
PROMPT_FILE="docs/coach-eval/coach-system-prompt.canonical.txt" \
EXPECTED_SHA="$(git rev-parse HEAD)" \
EXPECTED_MODEL="gemini-2.5-flash-lite" \
  node scripts/run-coach-response-eval.mjs        # pass: true only when everything binds
```

A `pass: true` here means: these exact two reviewers scored these exact 60 replies, from this corpus,
produced by this prompt + model, at this release SHA — tamper-evident. Record the resulting
`eval-out/two-reviewer-score-<date>.json` and the manifest alongside the release.

## Honest status

- **Scoring + agreement:** MET on the current build (2 reviewers, 4.70, 0.96, 0 auto-fails).
- **Release binding:** open — run the procedure above **on the shipping build** with a shipping-build
  capture. Binding it to the offline dev capture would make the check pass mechanically but would not be
  a truthful shipping-build attestation, so it is left for the real release.
- This closes only the response-eval provenance. The **kill-switch drill**, **App Check enforcement**,
  and the **§23 clinical review** (waived on owner accepted-risk) remain, and `COACH_ENABLED` stays
  fail-closed until the owner deliberately flips it.
