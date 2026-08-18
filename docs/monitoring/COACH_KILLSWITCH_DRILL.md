# Coach kill-switch rollback drill — runbook

Satisfies **Condition 4** of `docs/COACH_RELEASE_STATE.md`: a *live* demonstration that the coach can
be disabled in production **without a redeploy**, then restored.

## What the switch is

`config/coach.killSwitch` (a boolean field on the Firestore doc `config/coach`). When `true`,
`fetchCoachKillSwitch()` → `coachKillSwitch.engaged()` returns `true`, and the coach callable rejects
with `coach_unavailable` (`functions/src/coach.ts:165`). It can only ever **add a reason to be off** —
it never enables the coach. Fail-safe: a Firestore read error keeps the last known value and never
engages the switch on its own; plan-mutating actions additionally fail **closed** on a stale cache.

## Mechanism check (run anytime, no Firestore)

```bash
npm run drill:killswitch
```

Exercises the real reviewed-layer switch and proves the contract (toggle on → engaged, toggle off →
clear, throwing source → fails safe). Writes `eval-out/killswitch-drill-record.json`. This proves the
*logic*; it is **not** the live production drill.

## The live drill (the part Condition 4 requires)

Perform against **production** (or a staging project wired like production). Two ways:

### A. Automated toggle + record

```bash
# Uses Application Default Credentials for the prod project (needs firebase-admin + datastore access).
GCLOUD_PROJECT=strengthhub-2ab33 DRILL_OPERATOR="<your name>" DRILL_TIMESTAMP="<ISO time>" \
  node scripts/coach-killswitch-drill.mjs --live
```

It reads the current value, sets `killSwitch=true`, verifies, and restores the prior value — recording
each step, the operator, and the timestamp into `eval-out/killswitch-drill-record.json`.

### B. Manual (Firebase console) — do this if you'd rather not script prod writes

1. **Note** the current `config/coach.killSwitch` value (create the doc/field as `false` if absent).
2. In a client/emulator with the coach enabled on an internal build, confirm the coach **answers**.
3. Set `config/coach.killSwitch = true` in the Firestore console. **Do not redeploy.**
4. Within the cache TTL (~30 s), confirm the coach callable now rejects with `coach_unavailable`
   (the app shows the unavailable surface). ← this is the rollback being demonstrated.
5. Set `config/coach.killSwitch` back to its prior value; confirm the coach answers again.
6. Record the drill below.

## Drill record (fill in and commit)

| Field | Value |
|---|---|
| Performed by | ________________________ |
| Date / time (with TZ) | ________________________ |
| Target project | `strengthhub-2ab33` (prod) / staging |
| Coach answered before toggle? | ☐ yes |
| `killSwitch=true` → coach refused **without redeploy**? | ☐ yes |
| Time from toggle to refusal | ________ s |
| Restored to prior value → coach answered again? | ☐ yes |
| Artifact | `eval-out/killswitch-drill-record.json` |
| Notes | |

> Until section "Drill record" is filled from a real production run, Condition 4 is **PREPARED, NOT
> PERFORMED**. The mechanism check passing does not satisfy it.
