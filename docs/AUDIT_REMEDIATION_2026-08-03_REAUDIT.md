# Coach Re-Audit — Remediation Record

**Source:** StrengthHub Online — Updated Full Audit / Coach Reassessment After Latest Changes,
3 August 2026 (CONDITIONAL PASS, 60/100), audited at `main @ 171bb59`. This is the follow-up audit
after the first remediation (PRs #35/#36). Both former P0s stayed closed; it raised 15 new items
(U-001…U-015).
**This branch:** `claude/coach-reaudit-fixes`.

Verification gate (all green locally):
```
app:  eslint (0 warnings) ✓  tsc ✓  check 221/221 ✓  sweep 85 profiles/0 breaches ✓
      unit 282/282 ✓  safety 65/65 ✓
fns:  build ✓  tests 35/35 ✓
```

---

## Code-addressable findings (fixed)

### U-001 + U-008 — Non-atomic cloud commit / swallowed cleanup — FIXED
`src/backend/repo/programRepo.ts` adds **`commitCoachAction`**: the canonical user doc, program doc,
new instances AND the deletion of obsolete instances all land in **one Firestore `writeBatch`** —
genuinely atomic, so a signed-in user can never end up with the profile changed but the program not.
The obsolete-instance discovery query is **no longer swallowed**: if it throws, the commit aborts
(fail closed) rather than writing a set that could orphan docs. `src/overlays/extra.tsx` uses it for
both the apply and the undo path.

### U-002 — Action journal stuck at pending_apply — IMPROVED
`extra.tsx` now terminalises every reachable client early-exit: a post-confirm resolver rejection →
`failed(resolver_rejected)`; a share with no real PR → `failed(no_pr)`; an offered swap or PR draft
abandoned when the sheet closes → `failed(swap_choice_abandoned / share_abandoned)`. (A full
server-side outbox/reconciler for crash/outage terminalisation is IP-07, owner scope.)

### U-003 — Remote action switch stale-false on cold start — FIXED
`functions/src/killSwitchRemote.ts` adds **`engagedFresh(failClosed)`**: it awaits a refresh when the
cache was never populated or is stale, and for plan-mutating actions returns `true` (disabled) if
freshness still can't be confirmed. `functions/src/coach.ts` reads the action switch via
`coachActionsSwitch.engagedFresh(true)` before deciding `allowActions`, so a cold-start first request
can't serve a stale `false`.

### U-004 + U-006 — Eval gate could false-pass — FIXED
`src/backend/coach/eval/scoreResponseQuality.ts` now **fails closed**: it requires exactly two
distinct named reviewers, each scoring EXACTLY the 60 corpus case ids (no missing/extra/unknown/dup),
every dimension an integer 1–5, full overlap, a non-null inter-rater agreement — and, when a manifest
is supplied, a manifest bound to a real release/model/prompt with `includesModelReplies=true`. The
re-audit's two-one-case repro now fails with a precise reason.

### U-005 — Rubric collapsed 15 dimensions into 5 — FIXED
`responseQualityCorpus.ts` restores all **15** scored dimensions (accuracy, relevance,
personalisation, helpfulness, actionability, clarity, tone, context use, follow-up, uncertainty,
safety, consistency, units, action integrity, failure recovery) with per-dimension **critical
floors** on safety / context use / action integrity / units / failure recovery.

### U-011 — Sparse / unfilled plans could be applied — FIXED
`programInvariants.ts` adds `sparse` (a scheduled day below the minimum exercise count) and
`empty_program` hard invariants. `coachActionResolver.ts` additionally refuses a regen whose
generation audit reports an `UNFILLED required slot`, returning an honest constraint-gap message
instead of applying an impossible plan.

### U-014 — Duration under-estimated / +25% too loose — FIXED
`estimateDayMinutes` now includes whole-session warm-up + transition overhead
(`SESSION_OVERHEAD_SEC`); the target tolerance is **+10%** (`DURATION_TARGET_TOLERANCE`). The
resolver does not hard-reject on time (the generator's short-session overshoot is a separate defect,
IP-10) but surfaces `daysOverBudget` so the coach appends an **honest** caveat instead of claiming a
plan "fits" when it runs over.

### U-012 — Every proposal error shown as "expired" — FIXED
`extra.tsx` distinguishes a genuine server `failed-precondition`/`not-found` (→ expired) from a
transient transport fault (offline/timeout/unavailable), which now **keeps the proposal pending +
retryable** with an honest inline "couldn't reach the server, tap again" note.

### U-013 — Lint not in the required code gate — FIXED
`.github/workflows/sweep.yml` (the required `sweep` check) now runs `npm run lint` (eslint, zero
warnings) before typecheck.

---

## Owner-only residual (cannot be closed in code)

- **U-006 / U-015** — run the paid 60-case model evaluation against the exact release model/prompt,
  two blind reviewers, 50/100/200-turn long-context scripts; commit the scored artifact. The gate now
  refuses to pass without it.
- **U-007** — correct the Bodyweight equipment over-grant. `src/backend/data/equipmentTags.ts` is
  **generated from the workbook** (`validate:data` enforces it), so the tag fix belongs in the
  workbook/data source, not a hand-edit. The code-side safety net (U-011) already refuses the
  impossible plans the over-grant can produce.
- **U-009** — server-side `programVersion` precondition + conflict UX (needs the authoritative server
  command, IP-01).
- **U-010** — native App Check attestation + staged enforcement (native app registration + devices).
- **U-002 tail** — durable server outbox/reconciler for crash/outage terminalisation (IP-07).

These are documented as decisions in the report §14 and tracked for the owner.
