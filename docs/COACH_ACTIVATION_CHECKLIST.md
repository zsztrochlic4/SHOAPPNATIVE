# Coach Activation Checklist — current, exact "these items → flip"

_Created 2026-08-20. Companion to `docs/COACH_RELEASE_STATE.md` (the authoritative release-state
record) and `src/backend/coach/safety/STATUS.md` (the safety record of truth). Where this file and
those disagree, they win — this is the operational how-to, not the source of the decision._

## Where we are now

- **Safety testing is DONE and cleared.** Across three independent reviewer holdout sets
  (IRH-2026-08-18 A/B/C) the critical-safety bar was met every time — **0 critical misses, 0
  emergency under-routes**, stable across 3 generations. The only residual was an over-cautious
  benign false-positive rate, which the reviewer (Jack Dov) has **accepted as low-severity
  protective over-referral**. **Jack has given the all-clear** (owner-relayed 2026-08-20).
- **§23 clinical sign-off** was **waived by the owner** on 2026-08-16 (recorded risk-acceptance,
  `docs/COACH_RELEASE_STATE.md`). Not outstanding.
- **Therefore the remaining blockers are NON-testing / operational.** They are listed below.

The coach is still **fail-closed** in code (`COACH_ENABLED=false`; `config/coach.releaseEnabled`
absent/false). Nothing in this document enables it — the flip is an explicit owner action once the
conditions below are met.

## The gate architecture (verified 2026-08-20)

Three independent gates; the coach serves a turn only when **all** are open. Verified in
`functions/src/coach.ts` (`runCoachTurn`) and `src/lib/coachSafety.ts`:

| Gate | Where | Default | How it opens |
|---|---|---|---|
| **Build channel** `COACH_ENABLED` | `src/backend/coach/coachGate.ts` | `disabled` | env `COACH_RELEASE_CHANNEL=internal` (server) + `EXPO_PUBLIC_COACH_RELEASE_CHANNEL=internal` (client build) |
| **Server release flag** `config/coach.releaseEnabled` | Firestore, read by `coachReleaseGate` (`functions/src/killSwitchRemote.ts`) | **closed, fail-closed** | set the Firestore doc `config/coach` field `releaseEnabled: true` (live, no redeploy) |
| **Remote kill switch** `config/coach.killSwitch` | Firestore, read by `coachKillSwitch` | not engaged (fail-safe) | must remain **false** to serve; set `true` to instantly disable |

Server turn logic (`runCoachTurn`): `COACH_ENABLED` → `releaseEnabledFresh()` (fail-closed) →
kill-switch → serve. Client (`coachOperational()`): `COACH_ENABLED && !killSwitchEngaged`.
`coachMessage` also enforces **App Check** (`enforceAppCheck: APP_CHECK_ENFORCED`) + a verified
signed-in user (`requireVerifiedUser`). Gate-logic unit tests pass (`coach-release-gate.test.mjs`,
`killSwitch.test.mjs` — 11/11 logic assertions).

## Remaining conditions — ALL required before the flip

### 1. App Check enforcement  _(owner / Firebase console)_
The code is ready: `APP_CHECK_ENFORCED = process.env.APPCHECK_ENFORCE === '1'`
(`functions/src/lib/guards.ts`), `coachMessage` already uses `enforceAppCheck: APP_CHECK_ENFORCED`,
and the **native attestation bridge is wired** (`src/lib/appCheckNative.native.ts` — App Attest /
Play Integrity; web no-op split via `appCheckNative.ts`). Outstanding **console/ops** work:
- [ ] Register the **native app(s)** in Firebase App Check (only a web app exists today).
- [ ] Configure the provider (App Attest for iOS, Play Integrity for Android; reCAPTCHA Enterprise
      for web) and permitted domains — see `docs/APP_CHECK.md` §Native, `docs/APP_CHECK_ENFORCEMENT_CHECKLIST.md`.
- [ ] Run **monitor mode** first: deploy with the `auditAppCheck` warning and confirm essentially
      all real traffic carries a token (watch `appcheck.missing` logs).
- [ ] Then set `APPCHECK_ENFORCE=1` on the functions and redeploy → `enforceAppCheck` flips to enforce.
- **Verify:** an unattested call to `coachMessage` is rejected; the real app's calls succeed.

### 2. Deploy the reviewed build + name operational owners  _(owner)_
- [ ] Deploy the **exact reviewed commit** (record commit + model + prompt-ver + rule-ver in
      `config/coach-release.json` → `production.exactCommit` / `holdoutDigest`).
- [ ] Record the **named humans** for: safety monitoring · incident review · rollback authorization
      · kill-switch operation (Jack's R8 activation condition; put them in `COACH_RELEASE_STATE.md`).
- **Verify:** deployed function digest == reviewed commit; owners recorded.

### 3. Live kill-switch drill  _(owner — runbook below)_
- [ ] Perform the drill on the **deployed** function and record the timestamp in
      `config/coach-release.json` → `production.killSwitchDrillAt`.

### 4. On-device fault capture (TF01–TF05)  _(owner / real device)_
- [ ] Run the TF01–TF05 fault-injection cases on a real iOS + Android build (network loss mid-turn,
      model timeout, malformed response, App Check reject, kill-switch mid-session) and confirm each
      fails safe (no crash, no unsafe content, graceful UI). Record pass/fail.

### 5. Align store & privacy declarations  _(owner / legal)_
- [ ] `docs/DATA_SAFETY.md` and `docs/APP_STORE.md` currently describe the coach as **disabled**.
      Update them to match "coach ships" **only** when 1–4 are done, and confirm the privacy /
      disclaimer copy (already drafted + wired into onboarding consent) is published.

## Activation sequence (the actual flip — owner, in order)

Only after 1–5 above are done and recorded:

1. **Merge + deploy** the reviewed build with the server env `COACH_RELEASE_CHANNEL=internal` and
   `APPCHECK_ENFORCE=1`. (This sets `COACH_ENABLED=true` server-side but the coach stays closed —
   the Firestore flag is still false.)
2. **Ship the client build** with `EXPO_PUBLIC_COACH_RELEASE_CHANNEL=internal` (reveals the UI;
   removes the "coming soon" screen). Do NOT set `EXPO_PUBLIC_COACH_PREVIEW` (that is dev-scripted).
3. **Confirm the kill switch is not engaged:** `config/coach.killSwitch` = `false` (or absent).
4. **Open the live gate:** set Firestore `config/coach` → `releaseEnabled: true`. **This is the
   moment the coach goes live**, with no redeploy, and can be revoked the same way.
5. **Smoke test** 5 real messages (incl. one crisis-adjacent) end-to-end; confirm the persistent
   Lifeline/000 strip renders and emergency routing fires.
6. Persist the intended default into `config/coach-release.json` (`production.availability` etc.) so
   the record matches production.

## Kill-switch drill runbook (condition 3)

Goal: prove the coach can be disabled **live, in seconds, without a redeploy**.

1. With the coach serving (test cohort), set Firestore `config/coach` → `killSwitch: true`.
2. Within the cache TTL (**≤30 s**, `makeRemoteKillSwitch`), send a coach message →
   expect `unavailable` / `coach_unavailable`; the client shows the unavailable state.
3. Set `killSwitch: false` again → within ≤30 s the coach serves normally.
4. Record the drill timestamp in `config/coach-release.json` → `production.killSwitchDrillAt`.

Reference: the emulator equivalent is covered by `functions/test/killSwitch.test.mjs` and the
release-gate drill in `functions/test/coach-release-gate.test.mjs` (both pass). This runbook is the
**live** version of that test.

## Rollback

- **Instant:** set `config/coach.killSwitch = true` (≤30 s, no redeploy) — the fastest off-switch.
- **Or:** set `config/coach.releaseEnabled = false` — closes the release gate (fail-closed) live.
- **Full:** redeploy without `COACH_RELEASE_CHANNEL=internal` → `COACH_ENABLED=false` everywhere.

## Store & privacy declaration flips — APPLY AT ACTIVATION (condition 5)

**Do NOT apply these while the coach is off.** Store/privacy declarations must describe the *shipping*
build; flipping them early recreates the 2026-08-09 "declarations contradict the build" audit finding.
Apply them **in the same change that flips the coach on**, and have the privacy reviewer confirm the
exact Apple App Privacy / Google Data Safety answers. These are the exact, pre-specified edits — the
docs were written with the "when the Coach is enabled" branch already spelled out.

**When the coach ships, the coach collects:** conversation messages + saved coach memories (per-user,
with pause/delete/clear/delete-workspace controls), processed by **Google Gemini via Firebase AI
Logic** to generate replies; coach text may contain **health free-text** (also covered by the Health
declaration). Not used for third-party ads; not sold.

### `docs/DATA_SAFETY.md`
- **Banner (top):** change "**The AI Coach is currently gated OFF**" → "The AI Coach is **enabled** as
  of `YYYY-MM-DD` (see `COACH_RELEASE_STATE.md`)"; update the "only once the Coach is enabled" aside.
- **Data-type table — User Content → Other User Content:** change the condition cell from "**Only when
  the AI Coach is enabled (currently OFF)** … Do **not** declare while `COACH_ENABLED = false`" →
  "**Yes** — AI Coach messages & saved coach memories."
- **Data-type table — Messages → Other in-app messages:** same flip, condition → "**Yes** — AI Coach
  conversations & saved coach memories."
- **Notes item 2 (AI Coach messages):** change "**currently DISABLED** … **no coach messages are
  collected today** … Do **not** declare coach data while it is off" → the enabled wording it already
  describes: coach conversations + memories stored per-user, declared as *User Content* (Apple) /
  *Other in-app messages* (Google), health free-text covered by the Health declaration.
- Confirm **Health & Fitness** already = Yes (unchanged); confirm **Photos = No** (meal scanner removed
  — unchanged).

### `docs/APP_STORE.md`
- **Tech-stack line:** "**Google Gemini** for the AI Coach (currently disabled; …)" → "…(enabled `YYYY-MM-DD`)".
- **"AI Coach is DISABLED" block:** replace with the enabled state — the coach UI is live (no "coming
  soon"), user messages reach Gemini via Firebase AI Logic, and the store privacy answers now describe
  the **enabled** coach. Reference `COACH_RELEASE_STATE.md` for the activation record + named owners.

### `docs/PRIVACY.md`
- Change "**The AI Coach is currently disabled and there is no other AI feature active.**" → a sentence
  stating the AI Coach is active and uses Google's Gemini to generate replies, with the retention /
  pause-delete controls and the "not an emergency or confidential clinical service" disclaimer (already
  present at lines ~103–109) unchanged.
- Verify the third-party-processor disclosure names **Google (Gemini via Firebase AI Logic)** as an AI
  sub-processor for coach messages.
- Bump the "last updated" date and re-publish the live Privacy Policy in step.

> After applying, set `config/coach-release.json` → `production.privacyDeclarationApproved` and
> `storeDeclarationApproved` to `true` (with the reviewer's name/date), so the machine-readable record
> matches the published forms.

## What is NOT a blocker (so we stop citing it)

- The safety **holdout / detection / false-positive testing** — done and cleared (see top).
- The **§23 clinical sign-off** — waived by owner 2026-08-16.
- The **workout `PROFESSIONAL_SIGNOFF`** — a separate gate; unrelated to the coach.
