# Data Retention Schedule — StrengthHub Online

**Status:** DRAFT for legal sign-off. **Prepared:** 2026-08-09 (rev. 2 — accuracy re-review).
**Owner to confirm each open duration; Victorian privacy/health counsel to classify the
service and reconcile against `docs/PRIVACY.md`.**

This schedule names a retention period for each data category, so the Privacy Policy's
general "as long as reasonably needed" language is backed by a recorded, reviewable
duration. Where a category is governed by code, the code reference is the authoritative
value. **Two cross-cutting rules apply and may override "deleted on account deletion" below:**

- **Victorian health records (Health Records Act 2001 / HPPs).** If StrengthHub is a
  "health service provider" and a category is "health information," the HRA generally
  requires retention until **7 years after the health service was last provided** (a
  different age-based minimum applies to records collected about a person under 18).
  This is **unresolved pending counsel's classification** (see below) and, if it applies,
  overrides the immediate-deletion promise for rows 1–2.
- **Legal/financial retention.** Records that must be retained for tax, dispute, fraud or
  legal-claim reasons are kept for the required period even after account deletion.

| # | Data category | Retention | Trigger / mechanism | Source of truth |
|---|---|---|---|---|
| 1 | **Account & profile** (auth, DOB, sex, height/weight, goals, injuries, screening incl. pregnancy/postpartum) | Life of the account; deleted on account deletion — **EXCEPT** health information subject to an HRA minimum period where that Act applies (see cross-cutting rule) | Deleted on account deletion (server-authoritative), subject to legal-retention exceptions | `functions/src/account.ts` |
| 2 | **Workout logs & app content** | Life of the account; deleted on account deletion — health-related records may be subject to the HRA minimum where it applies | Deleted on account deletion | `functions/src/account.ts` (`RECURSIVE_DOCS`) |
| 3 | **Meal photos** | **Not retained in the StrengthHub account.** Sent to Gemini for analysis, estimate returned, image not written to account storage. Provider-side (Gemini) processing/retention is **governed by Google's terms and is unverified** (see row 19) | Per-request; not stored by us | `functions/src/meal*` |
| 4 | **Community per-day scoring** (`scoreDays`, `scoreEvents`) | **490 days** (460-day scoring window + 30-day buffer), then auto-pruned daily | Scheduled prune below the cutoff | `functions/src/community.ts` (`MAX_HISTORY_DAYS=460`, `RETENTION_DAYS=490`) — **DORMANT** (`COMMUNITY_BACKEND=false`) |
| 5 | **Community moderation / appeal notes** | Life of the account (kept with the community profile; in data export) | Deleted on account deletion | `functions/src/account.ts` (`communityReviews`) — dormant with community |
| 6 | **Rate-limit / abuse buckets** | **2 days** (Firestore TTL), or immediately on deletion | TTL policy on `rateLimits.expiresAt` | `functions/src/lib/rateLimit.ts` (`ttlDays=2`) |
| 7 | **Deletion audit record** (tombstone: uid + timestamps + phase only, no personal content) | Retained after deletion for security/compliance/evidence — **owner to set a fixed cap (proposed: 24 months), then prune** | `deletionJobs/{uid}` | `functions/src/account.ts` |
| 8 | **Push-notification tokens** | Until token invalidated or account deleted | Deleted on account deletion; invalid tokens pruned on send | account subtree; `functions/src/notifications.ts` |
| 9 | **Billing / subscription record in StrengthHub** (email, Stripe customer id, plan, status, dates) | Life of the account; the StrengthHub-side entitlement record is deleted on account deletion. **Account deletion does NOT cancel the Stripe subscription** — cancellation is user-initiated via the in-app billing portal, or by emailing support after deletion. There is **no** server-side auto-cancel | Deleted on account deletion; subscription cancellation is user-initiated | `functions/src/account.ts` (`entitlements`) — **no `purgeStripeForUser`** |
| 10 | **Stripe invoices / tax records** | **Stripe-controlled**, retained as legally required (typically up to 7 yrs) even after account deletion — documented exception in `PRIVACY.md` §9 | Stripe's own retention | Stripe |
| 11 | **Backups / PITR** (Firebase) | **Owner to record the actual window:** Firestore PITR window + daily-backup retention count from the Firebase console. Deletion propagates within that cycle; document the deletion-after-restore procedure | Firebase backup rotation | Firebase project `strengthhub-2ab33` — **owner to fill in** |
| 12 | **AI Coach messages & memories** | N/A — **Coach DISABLED**, nothing collected today; when enabled, a retention period must be set before launch | — | Coach gate OFF (`COACH_ENABLED=false`) |
| 13 | **Website enquiry leads** (contact form: name, email, phone, goals) | **Not an active server flow** (form config unset); before enabling, set a period (proposed: 24 months from last contact) | Website backend (not yet live) | website |
| 14 | **Auth / request / IP / diagnostic / error logs** (Firebase, Cloud Logging, hosting/security providers) | Kept for security, operation and abuse-prevention for a limited period — **owner to record the actual Cloud Logging / provider retention (proposed: 30–90 days)** | Provider log rotation / retention policy | Firebase / Google Cloud Logging config — **owner to fill in** |
| 15 | **Consent & policy-version acceptance records** (which policy/consent version accepted, when) | Life of the account + a period after (proposed: 24 months) as evidence of consent | Retained with account; owner to confirm post-deletion evidence period | app/store records — **owner to confirm** |
| 16 | **Privacy / support complaints & correspondence** | Retained for dispute-resolution and compliance evidence (proposed: 7 years for complaint records; owner/counsel to confirm) | Support mailbox / records | info@strengthhubonline.com — **owner/counsel to confirm** |
| 17 | **App-store transaction / entitlement records** (Apple/Google, if store billing is adopted) | Store-controlled per Apple/Google; our entitlement mirror deleted on account deletion | Store retention + our entitlement record | Apple/Google + `entitlements` |
| 18 | **Push-delivery logs & invalid-token handling** (Expo / provider) | Short retention (proposed: 30 days); invalid tokens pruned on delivery failure | Provider log rotation | Expo / push provider — **owner to confirm** |
| 19 | **Provider-side Gemini retention** (prompts/responses that Google may log for abuse monitoring) | **Google-controlled** per the Gemini terms; depends on the surface (Developer API / Vertex AI / Firebase AI Logic), paid/free status, region and zero-data-retention eligibility — **unverified** | Google's retention | Gemini terms / DPA — **owner to verify** |
| 20 | **Legal-claim / incident records** | Retained as needed for the claim plus the applicable limitation period | Case-by-case legal hold | legal/records — **owner/counsel** |
| 21 | **Generated data exports** ("Download my data") | Produced on request; not retained server-side beyond delivering the export | Per-request | `src/overlays` export path |

## Owner / counsel determinations still required (before sign-off)

- **Victorian health-record classification (rows 1–2).** Have counsel decide whether StrengthHub
  is a "health service provider" and which categories are "health information." If the HRA applies,
  **the immediate-deletion and "right-to-erasure" language in the Privacy Policy must be reconciled**
  with the HRA minimum, and the deletion UI + Google Play deletion disclosure updated. Do NOT simply
  retain everything for 7 years without this analysis.
- **Row 7** deletion tombstone cap (proposed 24 months) — confirm and add a prune.
- **Row 11** backups — record the actual PITR window + daily-backup retention from the console.
- **Rows 14, 15, 16, 18** — confirm the actual log/consent/complaint/push-log retention periods.
- **Row 19** — verify the Gemini surface, paid/free status, region, logging, abuse-monitoring
  retention, DPA and ZDR eligibility.
- **Row 13** website leads — confirm a period before enabling the contact form.

## Consistency check against the Privacy Policy

- **Deletion vs billing (resolved).** Row 9 now matches the Terms/Privacy/UI: deleting the account
  does **not** cancel the Stripe subscription (no server-side auto-cancel; the earlier
  `purgeStripeForUser` design was reverted). Cancellation is user-initiated via the billing portal
  or by contacting support.
- **Immediate deletion vs Victorian health law (open).** The Privacy Policy now states the HRA
  applies. Rows 1–2 promise deletion on account close; if the HRA minimum applies, that promise and
  the erasure language conflict and must be reconciled by counsel before sign-off.
