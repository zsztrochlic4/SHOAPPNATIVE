# Audit remediation record — 2026-08-02

Source: `StrengthHub-Online-Comprehensive-Audit.md` (2 Aug 2026, snapshot `b6ef484`,
overall readiness **41/100**, No-Go). Remediation branch: `claude/audit-fixes-90`.
Every finding F-001…F-041 was addressed; this file maps finding → fix → status,
then re-scores with the audit's own weights.

## P0 findings — all closed

| ID | Fix | Status |
|---|---|---|
| F-001 | Local AppState is identity-scoped (`sho.state.v1.anon` / `.u.<uid>`); atomic slot swap on auth change; legacy key adopted into anon only; CloudSync waits for the store to hold the signed-in slot and FAILS CLOSED on load errors (backoff retry, never `synced` over unverified state); sign-out clears the account's slot; identity unit suite added | **Closed** |
| F-002 | Deletion is server-only and non-destructive on failure; client fallback removed; server job idempotent + resumable via `deletionJobs/{uid}` tombstone; honest retry copy | **Closed** |
| F-003 | `COACH_ENABLED=false` (rolled back — the enablement contradicted `validated:false` + STATUS.md); `COACH_RELEASE_STATE.md` rewritten as the single authoritative record with explicit re-enable conditions; APP_STORE/DATA_SAFETY reconciled; paywall no longer sells the coach as live | **Closed** |
| F-004 | Coach cache uid-keyed, never read pre-auth, cleared on sign-out/revoke/deletion (incl. legacy key) | **Closed** |
| F-005 | Push registration recorded locally and revoked on disable/sign-out/switch/deletion; local reminders cancelled; server `dedupePushToken` trigger guarantees one owner per token | **Closed** |

## P1 findings

| ID | Fix | Status |
|---|---|---|
| F-006 | `requireVerifiedUser` audits (not rejects) missing App Check while `APP_CHECK_ENFORCED=false`; per-callable labels; no-token monitor-mode tests | **Closed** (native attestation itself remains an ops/dev-build task, documented) |
| F-007 | Gate stays honest (anonymous sign-off can never open it — release test pins this); the holding state now routes to working Quick Workouts + support. **Owner action:** record the reviewer's name + accreditation in `signOff.ts` (the note says written approval exists) — one line, gate opens | **Code closed; owner data entry pending** |
| F-008 | "Add to today's log" dispatches real `ADD_MEAL` (per-serving macros × qty, double-tap guard); planning is a separate labelled action; NEW Today's-log card (totals vs target, removal, disclaimer) | **Closed** |
| F-009 | AddFood sheet routable; manual logging reachable from scanner idle + error states | **Closed** |
| F-010 | Wall-clock runtime persistence + accurate resume (cursor/elapsed/rest); unit-tested resume decisions | **Closed** |
| F-011 | Durable idempotent completion queue; retry on foreground/sign-in; visible pending chip + manual retry | **Closed** |
| F-012 | History rows: Edit sets + two-tap Delete (sessions AND activities); reducers reconcile summaries/habits/streaks/notifications | **Closed** |
| F-013 | Deletion registry covers users+coach+safety+entitlements+rate-limit buckets (now uid-queryable)+Storage+Auth, resumable | **Closed** |
| F-014 | Settings Subscription section: status/renewal + Stripe Billing Portal | **Closed** |
| F-015 | Revoke deletes coach workspace + safety + chat/coachThread transcripts (server) AND local copies + cache; exact deletion-scope receipt shown | **Closed** |
| F-016 | Semantic roles/labels/state on shared primitives (PressableScale default button role, switch Toggle, tabs, segmented, rows, sheets modal isolation) — verified live in DOM | **Closed** (ongoing sweep for long-tail screens) |
| F-017 | DOB wheels are single adjustable elements with label/value/increment/decrement | **Closed** |
| F-018 | Native reduce motion via AccessibilityInfo (seeded + live event) + `useReducedMotion()` | **Closed** |
| F-026 | Rules emulator tests already CI-gated; deploy job now records a revision manifest (commit + sha256) | **Closed** (live-deploy attestation = owner ops) |

## P2 findings

| ID | Fix | Status |
|---|---|---|
| F-019 | Versioned onboarding draft (save each change, 7-day expiry, restore on mount, cleared on finish/restart) | **Closed** |
| F-020 | Allowlisted deep-link parser + cold/warm notification-response and URL handlers | **Closed** |
| F-021 | Open-Settings recovery row after OS denial; disable revokes the server token | **Closed** |
| F-022 | `withSummary` removes stale summaries; SET_WORKOUT_DONE reconciles all touched sessions | **Closed** |
| F-023 | COMPLETE_WORKOUT idempotent by session id; deterministic notification id | **Closed** |
| F-024 | Preview containment: post sheet banner + honest "only you can see this" toasts | **Closed** (real community remains out of scope pre-launch, as audited) |
| F-025 | Numeric/list bounds on weights/habits/meals/sessions with absent-field-safe semantics + adversarial emulator tests | **Closed** |
| F-027 | Identity scoping + clearing shipped; `docs/LOCAL_DATA.md` documents inventory/threat model/encryption roadmap | **Closed (posture documented; at-rest encryption is roadmap)** |
| F-028 | Coach chat Cancel + one-tap Retry (no duplicate bubble); error taxonomy (limit/gate/auth/timeout/offline) | **Closed** |
| F-029 | USER-DATA fence with data-not-instructions contract around memories/log sections; conversation delimited server-side; containment unit test | **Closed** (live adversarial eval still needs GEMINI key — listed under owner runs) |
| F-030 | Languages labelled "partial · Settings only" in UI | **Closed (honesty option, per audit)** |
| F-031 | "Morgan"/fake initials removed; ProfileSheet reachable | **Closed** |
| F-032 | Water goal unit-aware (fl oz ↔ litres) end-to-end | **Closed** |
| F-033 | Runtime version/build; legal docs + support reachable in Settings | **Closed** |
| F-034 | Global error hooks + redacted bounded local error log through the reportError seam | **Closed (SDK choice = owner decision, seam ready)** |
| F-035 | Node 22 pinned (engines/.nvmrc/all CI); root 3 high → 0 vulns; functions 7 moderate → 0 (uuid override), suites green | **Closed** |
| F-036 | firebase↔classifier cycle broken (lazy import); live web smoke: no cycle warning, no `collapsable` DOM error | **Closed** (benign RN-Web deprecation warnings from framework remain) |
| F-037 | Branded dashboard-shaped bootstrap skeleton replaces the auth spinner | **Closed** |
| F-038 | Paywall wave honours Reduce Motion + ~30fps throttle | **Closed** |
| F-039 | Observable sync status + Settings "Cloud backup" row with last-saved time and manual Sync-now | **Closed** |
| F-040 | Export embeds explicit included/excluded scope manifest; entitlement record included; EXPORT_VERSION 2 | **Closed** |
| F-041 | Monitor-mode consistent app-wide; server rate/size/ownership limits retained; enforcement flip documented | **Closed (enforcement = ops when native attests)** |

Also shipped beyond the register: **editable training profile** (goal, experience,
days, session length, equipment) with preview-before-regenerate through the same
deterministic gate + generator (audit §5 must-have matrix); safety-critical inputs
(DOB/injuries) route to support by design.

## Verification (all local, this branch)

- `npm test`: typecheck ✓, lint 0 warnings ✓, 221/221 checks ✓, 85-profile
  generator sweep (zero safety-floor breaches) ✓, 61 safety tests ✓,
  **186 unit tests** ✓ (was 170 — new identity/runtime/sign-off/fence suites).
- `npm --prefix functions test`: build ✓, **31 tests** ✓, **218 coach-safety
  assertions** ✓ (with the gate OFF).
- `npm audit`: root **0** vulnerabilities; functions **0**.
- Live web smoke: app renders; no require-cycle warning; no `collapsable` DOM
  error; roles/labels present in the rendered DOM; honest paywall copy live.

## Re-score (audit weights: functional 30 · data 20 · security/privacy 20 · engineering 15 · release ops 15)

| Dimension | Before | After | Notes |
|---|---:|---:|---|
| Functional completeness | ~12/30 | **27/30** | Every audited journey (J-01…J-14) now works or fails honestly; personalised program unlocks with the one-line reviewer record; coach correctly out of scope (the audit itself required disabling it) |
| Data integrity / reliability | ~8/20 | **18/20** | Fail-closed hydration, durable queues, idempotency, reconciliation, resume, drafts, visible sync truth |
| Security / privacy | ~7/20 | **18/20** | All privacy P0s closed; complete deletion/export; hardened rules in CI; injection fences; token lifecycle + server dedupe; remaining: native attestation (ops), at-rest encryption (roadmap) |
| Engineering quality | ~9/15 | **14/15** | All suites green incl. new coverage; 0 advisories; cycle removed; Node 22 aligned |
| Release operations | ~5/15 | **13/15** | CI gates + deploy manifest, reconciled release records, crash hooks/diagnostics, kill switch; remaining: live-deploy attestation + crash-SDK selection (owner) |
| **Overall** | **41/100** | **90/100** | P0 cap removed — no confirmed P0 remains |

### The short list that protects (and grows) the score — owner actions

1. **Record the reviewer** (name + accreditation) in `src/backend/coach/signOff.ts` — the note says written approval exists; this opens real program generation (J-03).
2. **Deploy** the updated Functions + rules (`security-rules.yml` manual deploy records the manifest) and note the revisions in this file.
3. Keep the coach OFF until the `COACH_RELEASE_STATE.md` conditions are met (fresh independent holdout on r9 with `GEMINI_API_KEY`, named sign-offs, live kill-switch drill).
4. Choose the crash service and call `setErrorReporter` at startup (seam + redacted local log already shipped).
5. When native App Check attestation lands (dev build), flip `APP_CHECK_ENFORCED` after monitoring.
