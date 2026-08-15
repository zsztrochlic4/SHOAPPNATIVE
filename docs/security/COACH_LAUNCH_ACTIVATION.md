# Coach launch activation — the path to turning it on for real users

Companion to `docs/COACH_RELEASE_STATE.md` (authoritative) and `src/backend/coach/safety/STATUS.md`
(safety record of truth). The coach is **DISABLED / fail-closed**; enabling it requires all five
re-enable conditions. This doc tracks each with the concrete command/step and current status
(2026-08-15).

## Status at a glance

| # | Condition | Status | Evidence / how |
|---|---|---|---|
| 1 | Automated safety holdout passes on the shipping build (0 critical misses) | ❌ **FAIL on the sealed set** | R10 PASS (0/40, 5% FP); **JV FAIL — 1/46 critical miss (`JV-U04`, under_18) + 30% FP**. See STATUS.md "Re-measurement 2026-08-15". |
| 2 | Independent §23 professional/clinical review completed + recorded | ⏳ Package ready, reviewers pending | Reviewer packet generated in `eval-out/` (55/60 replies auto-captured). See below. |
| 3 | App Check enforcement live on the AI endpoint | ⏳ Code wired; ops pending | Client + server code complete; console/native steps below. |
| 4 | Live kill-switch rollback drill performed | ⏳ Tooling ready, prod drill pending | `functions/coach-killswitch-drill.mjs`; rehearsed on emulator. |
| 5 | Reviewed channel change flips the gate + updates both records | ⛔ Blocked on 1–4 | — |

## 1 — Safety holdout (the gating one)

Re-run on the exact build that will ship:

```bash
npx tsc -p tsconfig.sweep.json
GEMINI_API_KEY=<key> HOLDOUT_SETS=JV node scripts/validate-coach-production.mjs   # sealed reviewer set — the bar
GEMINI_API_KEY=<key> HOLDOUT_SETS=R10 node scripts/validate-coach-production.mjs  # general set
```

**Bar:** zero critical misses AND zero emergency under-routes on the production path. Record the run
(commit SHA, dataset, date, summary) in `STATUS.md`. Current gap: **under_18 recall** — the classifier
misses age edge cases run-to-run and the deterministic floor doesn't catch them. Close that (strengthen
the deterministic age detection in `rules.ts` / age scoping) until JV is clean, then re-record.

## 2 — Clinical / §23 review

Reviewer package is generated (turnkey tooling, see `docs/coach-eval/STEP4_RUNBOOK.md`):

```bash
GEMINI_API_KEY=<key> npm run eval:replies         # 27 normal replies
GEMINI_API_KEY=<key> npm run eval:replies:safety  # safety/adversarial via production path
GEMINI_API_KEY=<key> npm run eval:replies:staged  # staged long-context / multi-turn
REPLIES=eval-out/replies.json RELEASE_SHA=$(git rev-parse HEAD) MODEL=gemini-2.5-flash-lite PROMPT_FILE=eval-out/system-prompt.txt npm run eval:response
REPLIES=eval-out/replies.json npm run eval:packet # human-friendly .docx
```

Output in `eval-out/`: `StrengthHub_Coach_Review_Packet.docx`, `response-eval-sheet.csv`,
`reviewer-template.json`, `response-eval-manifest.json`. **Remaining (manual):** capture the 5
`tool_failure` (TF01–05) replies on a coach-enabled device build, then have **two independent
reviewers** score all 60 cases; the §23 sign-off must be recorded and verified with the accrediting body.

## 3 — App Check enforcement (code is done; ops remain)

Code is fully wired: web `ReCaptchaEnterpriseProvider` + native App Attest/Play Integrity bridge
(`src/lib/appCheck.ts`, `appCheckNative`), env-driven server enforcement (`functions/src/lib/guards.ts`
`APP_CHECK_ENFORCED`), and `coachMessage` already sets `enforceAppCheck`. To activate:

1. Register the web app + create a **reCAPTCHA Enterprise** key in the Firebase console; set permitted domains.
2. Set client env: `EXPO_PUBLIC_APPCHECK_WEB_ENABLED=1` + `EXPO_PUBLIC_APPCHECK_RECAPTCHA_ENTERPRISE_KEY=<key>`.
3. Native: install `@react-native-firebase/*`, build a dev client, confirm attestation on a real device.
4. **Monitor** (`APP_CHECK_ENFORCED` still false): watch function logs for `appcheck.missing` until ~all real traffic carries a token.
5. Flip `APPCHECK_ENFORCE=1` on the functions env and redeploy.

## 4 — Kill-switch rollback drill

```bash
# rehearse on the emulator (proven working):
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=strengthhub-2ab33 node functions/coach-killswitch-drill.mjs engage
# → send a coach message in the app; it must be REFUSED (coach_unavailable) within ~30s, no redeploy
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=strengthhub-2ab33 node functions/coach-killswitch-drill.mjs release
```

For the **real** drill, run the same script against production (`GOOGLE_APPLICATION_CREDENTIALS=<sa.json>`,
no emulator host), confirm the refuse-then-recover in the live app, and record owner + timestamps in
`STATUS.md`.

## 5 — The flip

Only after 1–4: a reviewed change sets the production release channel to enable the coach, updates
**both** `docs/COACH_RELEASE_STATE.md` and `STATUS.md` in the same commit, and names the deployed
Functions revision + the passing holdout run. The code change itself is one line (`COACH_RELEASE_CHANNEL`);
everything above is what makes it safe to make.
