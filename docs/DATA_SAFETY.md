# Data Safety & App Privacy — answer sheet

Fill-in guide for the **Apple App Privacy** and **Google Play Data Safety**
forms. Based on what StrengthHub Online actually does (verified against the code).
Keep it in sync with [PRIVACY.md](PRIVACY.md) — the two must say the same thing.

> Reviewed 2 August 2026 against the finalised Privacy Policy v1.0. Reflects the
> **subscription (Stripe)** and **on-device health** surfaces the earlier sheet
> predated. **The AI Coach is currently gated OFF** (`COACH_ENABLED = false`; see
> [COACH_RELEASE_STATE.md](COACH_RELEASE_STATE.md)) — its data types are noted
> below but must **not** be declared on the store forms until it is enabled.

---

## The short version (true for both stores)

- **We collect:** email, optional name, date of birth (for 18+ age-gating), the
  fitness/health data you enter, meal photos (photos only to analyse them —
  **not stored**), subscription status (via Stripe), and a device push token for
  notifications. (AI Coach messages too, but **only once the Coach is enabled** —
  it is currently gated off, so nothing is collected there today.)
- **We do NOT:** track you, show ads, use third-party analytics, or sell/"share"
  data for others' independent use.
- **Encryption in transit:** Yes (HTTPS/TLS via Firebase and our providers).
- **Account & data deletion:** Yes — in-app (**Settings → Delete account**) and
  by emailing info@strengthhubonline.com.
- **Data export:** Yes — in-app via **Settings → Download my data** (JSON).
- **Audience:** 18+, not directed at children.

> ⚠️ These answers assume **no analytics/ads SDKs** (correct today) and that the
> **community/social feed is a preview** (no user-to-user sharing yet, so
> "Share = No"). If you ship live social features, add analytics/ads, or start
> storing meal photos, update BOTH forms and [PRIVACY.md](PRIVACY.md).

---

## 🍎 Apple — App Store Connect → App Privacy

Apple asks, per data type: *Collected? Linked to the user? Used for tracking? +
Purpose.*

**Global answer — "Used for tracking": NO, for everything.** So you will **not**
need an App Tracking Transparency prompt. When asked "Do you use data to track
you across apps and websites owned by other companies?" → **No.**

**Declare these data types** (all: *Linked to user = Yes*, *Tracking = No*, unless noted):

| Apple data type | Collected | Purpose | Notes |
|---|---|---|---|
| Contact Info → **Email Address** | Yes | App Functionality (+ Account) | Login |
| Contact Info → **Name** | Yes | App Functionality | Optional display name |
| Health & Fitness → **Fitness** | Yes | App Functionality | Workouts, activity, streaks; on-device Apple Health reads (steps/sleep/workouts) once the native build ships |
| Health & Fitness → **Health** | Yes | App Functionality | Weight/body metrics, screening answers, nutrition you log |
| User Content → **Other User Content** | **Only when the AI Coach is enabled (currently OFF)** | App Functionality | AI Coach messages & saved coach memories. Do **not** declare while `COACH_ENABLED = false`. |
| User Content → **Photos or Videos** | Yes | App Functionality | Meal photos. **Linked to user = No** (analysed transiently, not stored). See ⚠️ below |
| Purchases → **Purchase History** | Yes | App Functionality (+ Account) | Subscription plan / status / trial & renewal dates (via Stripe). We never receive the full card number. |
| Identifiers → **Device ID** | Yes | App Functionality | Push-notification token |

**Date of birth:** Apple has no discrete DOB data type. We collect it only to
confirm 18+. If you want to disclose it, use **"Other Data Types"** →
*App Functionality*; otherwise it is covered by the age-gating purpose.

**Mark everything else "Data Not Collected"**, including: Location, Financial
Info (card numbers — handled by Stripe, we never receive them), Contacts,
Browsing History, Search History, Usage Data, Diagnostics (beyond the exempt
security/operation use below), Sensitive Info, Audio.

> **IP address / security telemetry:** Firebase and our hosting/security
> providers process your IP and request logs to operate and secure the Service.
> Apple exempts data collected only for **security/fraud-prevention/operation**
> by you or your service provider and used transiently — so it is not separately
> declared. Do not use it for anything else without updating this.

---

## 🤖 Google — Play Console → Data Safety

Overarching questions:
- **Does your app collect or share user data?** → **Collect: Yes.** **Share: No.**
  (Firebase/Google, Stripe and Expo process data *on your behalf* as service
  providers — Google's form does **not** count that as "sharing".)
- **Is all user data encrypted in transit?** → **Yes.**
- **Do you provide a way to request that data be deleted?** → **Yes** — in-app
  (**Settings → Delete account**) and via **info@strengthhubonline.com**.
- **Can users request a copy / export of their data?** → **Yes** — in-app via
  **Settings → Download my data** (exports profile + logs as JSON).

**Declare these data types** (all: *Collected = Yes*, *Shared = No*, *Purpose =
App functionality / Account management* unless noted):

| Google data type | Optional/Required | Notes |
|---|---|---|
| Personal info → **Email address** | Required | Login |
| Personal info → **Name** | Optional | Display name |
| Personal info → **Date of birth** | Required | 18+ age-gating |
| Health and fitness → **Health info** | Optional | Weight, screening answers, nutrition logs |
| Health and fitness → **Fitness info** | Optional | Workouts, activity; on-device Health Connect reads (steps/sleep/workouts) once the native build ships |
| Messages → **Other in-app messages** | **Only when the AI Coach is enabled (currently OFF)** | AI Coach conversations & saved coach memories — do **not** declare while `COACH_ENABLED = false` |
| Photos and videos → **Photos** | Optional | Meal photos — mark **"processed ephemerally"** if offered (not stored). See ⚠️ below |
| Financial info → **Purchase history** | Optional | Subscription plan / status (via Stripe). Card details handled by Stripe; we never receive them. |
| Device or other IDs → **Device or other IDs** | — | Push-notification token, for notifications |

**Do NOT declare** (not collected by us for these purposes): Location, Messages →
emails/SMS, App activity / analytics, Web browsing, Contacts, Calendar, Audio,
Files/docs, Installed apps. (Card numbers are handled by Stripe, so **Financial
info → Payment info** is not collected by us.)

> **IP address:** processed by Firebase / hosting / security providers to operate
> and secure the app (rate limits, auth events, logs). If Play prompts, this is
> service-provider security processing, not analytics — declare conservatively or
> not at all per Google's current guidance, and never repurpose it.

---

## ⚠️ Judgment calls — read before you submit

1. **Meal photos.** Sent to Google's Gemini AI to estimate nutrition and **not
   stored** on our servers (only the estimate is saved, and only if you log it).
   Declare them (as above) under App Functionality; on Google, choose
   **"processed ephemerally"** if that option appears. This is the honest,
   defensible position — if a lawyer prefers a more conservative declaration,
   follow their advice.

2. **AI Coach messages.** The AI Coach is **currently DISABLED** (`COACH_ENABLED =
   false`; see [COACH_RELEASE_STATE.md](COACH_RELEASE_STATE.md)) — the server turn
   refuses and the UI shows a "coming soon" surface, so **no coach messages are
   collected today**. Do **not** declare coach data while it is off. When the Coach
   is enabled, its conversations and saved memories are stored per-user
   (pause/delete/clear/delete-workspace controls apply); at that point declare as
   *User Content* (Apple) / *Other in-app messages* (Google). Coach text may
   contain health free-text, also covered by the Health declaration.

3. **Subscriptions.** Stripe processes checkout and card details; we store
   subscription **status/plan/dates** (not the card number). Declare *Purchases /
   Purchase history*. If you also sell through an app store's IAP, that store's
   own purchase reporting applies too.

4. **Account deletion — built in-app. ✅** Both stores require an in-app way to
   delete your account: **Settings → Delete account** (two-tap confirm). It
   deletes the Firebase Auth account and the user's Firestore/Storage data
   (workouts, nutrition, coach data, etc.), and writes a minimal
   uid + timestamp deletion-audit record only. For security, Firebase may ask a
   user to re-authenticate just before deleting — that's expected.

5. **Community/social is a preview.** The feed/groups/challenges/leaderboards are
   currently example content stored only in the user's own account — there is no
   user-to-user sharing yet. Keep **"Share = No"**. When social features go live,
   revisit sharing/visibility answers here and in [PRIVACY.md](PRIVACY.md).

6. **Keep it truthful and in sync.** These answers match the current app and the
   finalised Privacy Policy. Change one (add analytics, start storing photos,
   ship live social, add Google/Apple sign-in that pulls profile data) and you
   must update the forms *and* [PRIVACY.md](PRIVACY.md).
