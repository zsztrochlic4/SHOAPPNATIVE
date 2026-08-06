# Legal review packet — Privacy / Terms / Health-safety

**Purpose:** give a lawyer everything needed to review and formally sign off the
user-facing legal documents before launch. These documents are currently
**AI-drafted** and have **not** been reviewed by a qualified lawyer. They must not
be presented to users as legally reviewed until the sign-off record below is
completed by a real, named legal professional.

## Documents to review
| Document | File | Rendered in-app via |
|---|---|---|
| Privacy Policy | `docs/PRIVACY.md` | `src/content/legal.ts` → `LegalDocModal` |
| Terms of Service | `docs/TERMS.md` | same |
| Health & Safety | `docs/HEALTH_SAFETY.md` | same |
| Data safety declaration | `docs/DATA_SAFETY.md` | store listing |

> Note: the in-app copies in `src/content/legal.ts` are a mirror of the `docs/*.md`
> sources. Any edit from legal review must be applied to **both** (or re-mirrored),
> and the app's legal-version stamp bumped so returning users re-consent.

## App / data context the reviewer needs
- **App:** StrengthHub Online — fitness/strength coaching. Bundle `com.zaggy887.strengthhub`.
- **Audience:** includes young adults; there is an **18+ gate** and age routing. Confirm
  minors are handled per your jurisdiction (the app is aimed at AUS university students).
- **Backend:** Firebase (`strengthhub-2ab33`, region australia-southeast2) — Auth,
  Firestore, Storage, Cloud Functions. **AU data region.**
- **Data collected:** account/auth, self-reported profile (DOB, sex, height/weight,
  goals, injuries), workout logs, meal photos (sent to a Gemini model for analysis),
  optional integrations, push tokens. **No calorie/macro intake targets are set** (a
  deliberate product rule — nutrition guidance is qualitative).
- **Payments:** Stripe (subscription: 4-week trial → AUD $2.99/week).
- **Third parties/subprocessors:** Google Firebase/Google Cloud, Google Gemini (meal
  analysis), Stripe (billing), Expo (build/OTA), push provider.
- **Deletion:** in-app account deletion with a server-side durability sweeper
  (`functions/src/account.ts`) — a real "right to erasure" path exists.
- **Health framing:** the app gives fitness guidance, not medical advice; a coach
  feature exists behind a gate (see `docs/COACH_RELEASE_STATE.md`).

## Points to confirm
1. Privacy Policy covers every data category and subprocessor above, and AU (and any
   target-market) privacy law obligations.
2. Terms include the subscription/auto-renew disclosures required by the app stores
   and AU consumer law, and appropriate liability limits for fitness content.
3. Health & Safety carries adequate "not medical advice / consult a professional"
   language and injury/eating-disorder safeguards.
4. Minor handling and the 18+ gate are legally sufficient.
5. Consent/versioning flow (re-consent on document change) is adequate.

---

## Sign-off record — ⏳ PENDING (do not mark complete until genuinely signed)

```
Privacy Policy
  Reviewer name:        ____________________
  Firm / qualification: ____________________
  Date reviewed:        ____________________
  Outcome:              [ ] approved as-is  [ ] approved with edits  [ ] rejected
  Edits required:       ____________________

Terms of Service
  Reviewer name:        ____________________
  Firm / qualification: ____________________
  Date reviewed:        ____________________
  Outcome:              [ ] approved as-is  [ ] approved with edits  [ ] rejected

Health & Safety
  Reviewer name:        ____________________
  Firm / qualification: ____________________
  Date reviewed:        ____________________
  Outcome:              [ ] approved as-is  [ ] approved with edits  [ ] rejected
```

### Owner-accepted-without-legal-review (alternative, honest record)
If the owner chooses to publish an AI-drafted document **without** a lawyer and accept
that risk personally, record it truthfully here — this is **not** a legal sign-off:

```
Document:              ____________________
Owner acknowledgement: "I am publishing this AI-drafted document without qualified
                        legal review and accept the associated risk."
Owner name:            ____________________
Date:                  ____________________
```
