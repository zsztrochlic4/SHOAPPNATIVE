# Data Safety & App Privacy — answer sheet

Fill-in guide for the **Apple App Privacy** and **Google Play Data Safety**
forms. Based on what StrengthHub Online actually does (verified against the code).
Keep it in sync with [PRIVACY.md](PRIVACY.md) — the two must say the same thing.

---

## The short version (true for both stores)

- **We collect:** email, name (optional), the fitness/health data you enter,
  meal photos (only to analyse them — **not stored**), and a device push token
  for notifications.
- **We do NOT:** track you, show ads, use third-party analytics, or sell data.
- **Encryption in transit:** Yes (HTTPS/TLS via Firebase).
- **Account & data deletion:** Yes — in-app and by emailing info@strengthhubonline.com.
- **Audience:** 18+, not directed at children.

> ⚠️ These answers assume **no analytics/ads SDKs** (correct today). If you ever
> add one, BOTH forms must be updated or the store can pull the app.

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
| Health & Fitness → **Fitness** | Yes | App Functionality | Workouts, activity, streaks |
| Health & Fitness → **Health** | Yes | App Functionality | Weight/body metrics + nutrition you log |
| User Content → **Photos or Videos** | Yes | App Functionality | Meal photos. **Linked to user = No** (analysed transiently, not stored). See ⚠️ below |
| Identifiers → **Device ID** | Yes | App Functionality | Push-notification token |

**Mark everything else "Data Not Collected"**, including: Location, Financial
Info, Purchases, Contacts, Browsing History, Search History, Usage Data,
Diagnostics, Sensitive Info, Messages, Audio.

---

## 🤖 Google — Play Console → Data Safety

Overarching questions:
- **Does your app collect or share user data?** → **Collect: Yes.** **Share: No.**
  (Firebase/Google process data *on your behalf* as service providers — Google's
  form does **not** count that as "sharing".)
- **Is all user data encrypted in transit?** → **Yes.**
- **Do you provide a way to request that data be deleted?** → **Yes** — in-app
  and via **info@strengthhubonline.com**. (Provide that in the form.)
- **Can users request a copy / export of their data?** → **Yes** — in-app via
  **Settings → Download my data** (exports profile + logs as JSON).

**Declare these data types** (all: *Collected = Yes*, *Shared = No*, *Purpose =
App functionality / Account management*):

| Google data type | Optional/Required | Notes |
|---|---|---|
| Personal info → **Email address** | Required | Login |
| Personal info → **Name** | Optional | Display name |
| Health and fitness → **Fitness info** | Optional | Workouts, activity |
| Health and fitness → **Health info** | Optional | Weight, nutrition logs |
| Photos and videos → **Photos** | Optional | Meal photos — mark **"processed ephemerally"** if offered (not stored). See ⚠️ below |
| Device or other IDs → **Device or other IDs** | — | Push-notification token, for notifications |

**Do NOT declare** (not collected): Location, Financial info, Messages, App
activity / analytics, Web browsing, Contacts, Calendar, Audio, Files/docs,
Installed apps.

---

## ⚠️ Three judgment calls — read before you submit

1. **Meal photos.** They're sent to Google's Gemini AI to estimate nutrition and
   are **not stored** on our servers. Declare them (as above) under App
   Functionality; on Google, choose **"processed ephemerally"** if that option
   appears. This is the honest, defensible position — if a lawyer prefers a more
   conservative declaration, follow their advice.

2. **Account deletion — now built in-app. ✅** Both stores require an in-app way
   to delete your account. This now exists: **Settings → Delete account** (two-tap
   confirm). It deletes the user's login and all their app data (workouts,
   nutrition, chat, etc.); the root profile record is scrubbed and finished off by
   the future backend cleanup. So you can answer **"Yes, users can request that
   their data be deleted"** and point to that in-app control (plus the email
   route). Note: for security, Firebase may ask a user to log in again just before
   deleting — that's expected.

3. **Keep it truthful and in sync.** These answers match your current app and
   your privacy policy exactly. Change one (e.g. add analytics, start storing
   photos, add Google sign-in that pulls profile data) and you must update the
   forms *and* [PRIVACY.md](PRIVACY.md).
