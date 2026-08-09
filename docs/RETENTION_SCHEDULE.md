# Data Retention Schedule — StrengthHub Online

**Status:** DRAFT for legal sign-off (audit #13). **Prepared:** 2026-08-09.
**Owner to confirm each duration; lawyer to approve against `docs/PRIVACY.md`.**

This schedule names the concrete retention period for every data category, so the
Privacy Policy's general "as long as reasonably needed" language is backed by a
recorded, reviewable duration. Where a category is governed by code, the code
reference is given; those are the authoritative values.

| # | Data category | Retention | Trigger / mechanism | Source of truth |
|---|---|---|---|---|
| 1 | **Account & profile** (auth, DOB, sex, height/weight, goals, injuries) | Life of the account | Deleted on account deletion (server-authoritative) | `functions/src/account.ts` |
| 2 | **Workout logs & app content** | Life of the account | Deleted on account deletion | `functions/src/account.ts` (`RECURSIVE_DOCS`) |
| 3 | **Meal photos** | **Not retained by StrengthHub.** Sent to Gemini for analysis, estimate returned, image not written to account storage | Per-request; not stored | `functions/src/meal*`; provider processing per Gemini terms |
| 4 | **Community per-day scoring** (`scoreDays`, `scoreEvents`) | **490 days** (460-day scoring window + 30-day buffer), then auto-pruned daily | Scheduled prune below the cutoff | `functions/src/community.ts` (`MAX_HISTORY_DAYS=460`, `RETENTION_DAYS=490`) — **DORMANT** (`COMMUNITY_BACKEND=false`) |
| 5 | **Community moderation / appeal notes** | Life of the account (kept with the community profile; in data export) | Deleted on account deletion | `functions/src/account.ts` (`communityReviews`) — dormant with community |
| 6 | **Rate-limit / abuse buckets** | **2 days** (Firestore TTL), or immediately on deletion | TTL policy on `rateLimits.expiresAt` | `functions/src/lib/rateLimit.ts` (`ttlDays=2`) |
| 7 | **Deletion audit record** (tombstone: uid + timestamps + phase only, no personal content) | Retained after deletion for security/compliance/evidence — **owner to set a fixed cap (proposed: 24 months), then prune** | `deletionJobs/{uid}` | `functions/src/account.ts` |
| 8 | **Push-notification tokens** | Until token invalidated or account deleted | Deleted on account deletion | account subtree |
| 9 | **Billing / subscription** (email, Stripe customer id, plan, status, dates) in StrengthHub | Life of the account; erased at deletion (Stripe customer deleted) | Stripe customer + subs cancelled and deleted on account deletion | `functions/src/billing.ts` (`purgeStripeForUser`) |
| 10 | **Stripe invoices / tax records** | **Stripe-controlled**, retained as legally required (typically up to 7 yrs) even after customer deletion — documented exception in `PRIVACY.md` | Stripe's own retention | Stripe |
| 11 | **Backups / PITR** (Firebase) | Point-in-time recovery + daily backups per Firebase config; deletion propagates within the backup cycle | Firebase backup rotation | Firebase project `strengthhub-2ab33` |
| 12 | **AI Coach messages & memories** | N/A — **Coach DISABLED**, nothing collected today; when enabled, retention to be set before launch | — | Coach gate OFF (`COACH_ENABLED=false`) |
| 13 | **Website enquiry leads** (contact form: name, email, phone, goals) | **Not an active server flow** (form config unset); before enabling, set a retention period (proposed: 24 months from last contact) | Website backend (not yet live) | website — see audit #11 |

## Owner decisions still required (before lawyer sign-off)

- **#7 Deletion audit record** — confirm the fixed retention cap (proposed 24 months) and add a prune, or record why it is kept indefinitely.
- **#13 Website leads** — confirm a lead-retention period before the contact form is switched on.
- **#11 Backups** — record the actual PITR window and daily-backup retention count from the Firebase console.
- **#4/#5 Community** — durations are set in code but the backend is dormant; confirm they apply at community launch.

## Consistency check against the Privacy Policy

`docs/PRIVACY.md` §9 and the in-app mirror (`src/content/legal.ts`) describe deletion
and the retained-records exceptions in general terms. That wording is **consistent**
with this schedule (it does not contradict any duration here). If the lawyer prefers
specific durations in the public policy, lift rows 4, 6 and 7 into §9.
