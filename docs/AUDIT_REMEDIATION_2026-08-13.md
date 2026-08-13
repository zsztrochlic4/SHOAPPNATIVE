# AI Coach audit remediation — 2026-08-13

## Outcome

The code-level remediation is complete on branch `codex/coach-audit-remediation`. Production stays
**disabled and fail-closed**. Internal builds may opt in. No deployment or public release was made.

## Closed findings

- Added deterministic proposals for clear bounded actions and neutralised completion language when
  no valid proposal exists.
- Coach target and planned-period actions now wait for a durable Firestore write before reporting
  success. Transient failures retain the previous state and present Retry. Undo is durability-first.
- Unsupported automatic shift/fold/replan catch-up modes are no longer offered as confirmable
  actions; the supported no-penalty rest and training-day reschedule alternatives remain.
- Corrected home/bodyweight equipment projection and verified generated programs across 109 profile
  combinations with no safety-floor breach or empty required slot.
- Limited persistent injury blocking to relevant training/loading requests, added genuine stale-state
  correction, prevented acute crisis state from contaminating new conversations, and retained durable
  restrictions with expiry.
- Reworked Coach welcome copy, safe-area/nav clearance, compact layout, accessibility coverage, and
  first-run persistence. Removed capability-overclaim copy.
- Added explicit web App Check activation, Firestore long-polling compatibility, a machine-readable
  production release manifest, and CI validation that production cannot accidentally enable Coach.
- Activated Android Maestro CI, updated stale native flows, pinned Firebase CLI, and repaired browser
  CI so a passing suite exits cleanly.
- Reduced Functions production dependencies to zero known advisories. Remaining Metro/image parser
  risk is documented with owner and expiry in `docs/DEPENDENCY_RISK_2026-08-13.md`.

## Verification evidence

| Gate | Result |
|---|---:|
| Complete application gate (`npm test`) | PASS |
| Domain checks | 221/221 |
| Generator profile sweep | 109 profiles, 0 breaches |
| Safety tests | 124/124 |
| Unit tests | 367/367 |
| Functions orchestration | 59/59 |
| Production safety assertions | 218/218 |
| Firestore/Storage emulator rules | 47/47 |
| Browser E2E | 14/14 |
| Functions production dependency audit | 0 vulnerabilities |
| Root production dependency audit | 0 critical, 0 moderate, 15 high (documented toolchain exception) |

## External release gates that code cannot self-approve

These are not unfinished engineering changes; they require independent authority or real production
evidence. Production remains disabled until every gate is recorded in `config/coach-release.json`:

1. Independent accredited clinical/professional sign-off.
2. App Check attestation monitoring proves the agreed genuine-client threshold, followed by owner
   authorization to enforce it.
3. A production kill-switch drill with owner/date/evidence.
4. Final holdout evaluation bound to the exact shipping commit and model.
5. Privacy/store declarations approved for the exact release.
6. Native Android/iOS device accessibility and interruption testing; Android automation is now in CI,
   while iOS/device evidence still requires the relevant hardware/runner.

## Release verdict

**Internal testing only.** The engineering defects addressed in this remediation are covered by green
automated gates, but the Coach must not be released to production until the external gates above are
independently satisfied and the release manifest is deliberately changed in review.
