# Launch readiness — honest status

_Snapshot: 2026-08-07 · main `797dbe8`. This document states what is genuinely
**done** (code written / deployed / verified) versus what is **awaiting a real
sign-off or an owner/hardware action**. Nothing here is marked "signed off"
unless an accountable, named person has actually signed — a sign-off is a person
taking responsibility for a review that happened, not a checkbox._

## Legend
- ✅ **Done** — implemented, merged, and where relevant deployed/verified.
- 📝 **Drafted** — content/code exists but needs a qualified human review before it counts.
- ⏳ **Pending sign-off / owner action** — blocked on a person, device, console, or account only the owner controls.
- ⚠️ **Decision required** — a state that contradicts a stated intent; the owner must consciously choose.

---

## 1. Engineering (code) — ✅ effectively complete

| Area | Status | Evidence |
|---|---|---|
| Audit rerun (b7e9cf9, 66/100) — all 15 R5 findings | ✅ | merged PRs #40/#42/#43/#44/#46/#47/#48 |
| Account-deletion durability sweeper — missing `deletionJobs` index | ✅ fixed + deployed | PR #64 (`45c5616`); index `READY`; recurring prod `FAILED_PRECONDITION` cleared |
| Native App Check bridge (App Attest / Play Integrity) | ✅ wired + on-device verified | PR #63 (`cb2ad45`); app runs on real Android with native module active |
| Coach response-quality eval (R5-003) | ✅ PASSED | mean 4.25, 0 auto-fails, IRR 0.97; evidence bundle retained |
| Dev-only paywall bypass for testing | ✅ | PR #65 (`b609ea7`), `__DEV__`-guarded, cannot ship |
| Standalone real-backend Android build | ✅ built | EAS build `196cf797`, installable APK |

## 2. Awaiting a REAL sign-off — ⏳ cannot be self-checked or faked

These protect end users and/or carry legal weight. Each needs a named, qualified
reviewer. See `docs/LEGAL_REVIEW_PACKET.md` for the legal set.

| Item | Reviewer needed | Doc | Status |
|---|---|---|---|
| Privacy Policy | Lawyer (privacy/consumer) | `docs/PRIVACY.md` | 📝 AI-drafted → ⏳ legal review |
| Terms of Service | Lawyer | `docs/TERMS.md` | 📝 AI-drafted → ⏳ legal review |
| Health & Safety disclosures | Lawyer + qualified health professional | `docs/HEALTH_SAFETY.md` | 📝 AI-drafted → ⏳ review |
| Data safety declaration (store) | Owner, against real data flows | `docs/DATA_SAFETY.md` | 📝 → ⏳ verify before store submission |
| Workout program clinical sign-off | Accredited exercise professional | `docs/PROGRAM_SIGNOFF.md`, `src/backend/coach/signOff.ts` | ✅ **signed** — Yitzchak Chaim (acc. 09867896), 2026-07-17 |
| Coach safety holdout / clinical sign-off | Accredited professional + sealed holdout | `docs/COACH_HOLDOUT_SIGNOFF.md`, `docs/COACH_RELEASE_STATE.md` | ⏳ see §4 |

> The **workout** professional sign-off is genuinely on file (a real named,
> accredited reviewer) — that one is done. The **legal** and **coach** ones are not.

## 3. Owner / hardware / console — ⏳ not doable from a dev session

| Item | Blocking launch? | Why it needs you |
|---|---|---|
| App Check enforcement flip (`APPCHECK_ENFORCE=1`) | Yes | Register Android SHA-256 + Play Integrity, watch metrics go "verified", **then** flip. See `docs/APP_CHECK_ENFORCEMENT_CHECKLIST.md`. Flipping early rejects the live app's own calls. |
| iOS build (App Attest) | Yes | Needs the paid **Apple Developer account ($99)**, then `eas build --platform ios`. |
| Android SHA-256 → Firebase (Play Integrity) | Yes | `eas credentials` (interactive) + Firebase console. |
| Step 7 native E2E / a11y evidence | No (evidence) | Device/emulator lab to run `.maestro/` + manual VoiceOver/TalkBack, 200% text, contrast. |
| Stripe checkout on device | No (for now) | This build has no `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` baked in; entitlement is granted manually for testing. Bake the key via EAS env to test real purchases. |

## 4. ⚠️ Decision required — coach enablement

`src/backend/coach/coachGate.ts` currently has **`COACH_ENABLED = true`** on `main`
(set 2026-08-03 per the file comment). This contradicts the standing instruction
that the coach must stay **OFF** pending its final review. Before launch the owner
must consciously confirm the intended state:

- If the coach **ships**: its safety holdout + clinical sign-off (§2) must be genuinely
  completed and App Check enforcement (§3) in place — these are the gates that exist
  precisely for a live coach.
- If the coach **does not ship** at launch: set `COACH_ENABLED = false`.

_This document does not change that flag. It records the state and the open decision._

## 5. Bottom line

Engineering is essentially complete. Launch is gated on four things only the owner
can trigger, none of which can be truthfully shortcut:
1. A **lawyer's** review of Privacy / Terms / Health-safety.
2. The **coach decision** (§4) and, if it ships, its clinical/holdout sign-off.
3. **App Check** console registration + enforcement.
4. For iOS, the **Apple Developer account**.
