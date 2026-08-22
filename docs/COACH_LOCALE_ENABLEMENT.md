# Enabling a non-English coach language (safety gate)

**Status today:** the coach replies **English-only**. The user's selected language is plumbed
end-to-end (client → server → system prompt), but it is gated: `COACH_APPROVED_LOCALES = ['en']` in
[`src/lib/i18n.ts`](../src/lib/i18n.ts), and `coachOutputLanguage()` falls any unapproved locale back
to English. `buildCoachSystemPrompt` only emits a language directive for a non-`en` locale, so every
English turn is byte-identical (the coach-release check and safety holdouts stay green).

**Why this is gated and not just a translation toggle:** the crisis-detection and escalation logic is
written and validated in English. Switching only the *output* language while the safety logic stays
English can reduce crisis recall or produce unsafe wording in exactly the language you're adding. The
repo already flags this: localized crisis responses are machine-generated pending review
(`src/backend/coach/safety/responsesLocalized.ts`), and the indirect-distress classifier is disabled
(`src/backend/coach/safety/llmClassifier.ts`). So each language is a **separate safety release**.

## Gate to open before adding a locale to `COACH_APPROVED_LOCALES`
Per locale (e.g. `zh`, `hi`, `ar`, `vi`), gather evidence — this is human review, not code:
1. **Native-speaker review** of every localized safety string and the coach's general replies.
2. **Appropriate clinical / accredited review** of the localized crisis + escalation flow (the app's
   existing model is an accredited exercise professional for training and a clinical reviewer for the
   crisis pathway — see `docs/coach-eval/` and `src/backend/coach/signOff.ts`).
3. **Crisis + indirect-distress holdouts run in that language** with zero critical misses, on the
   exact release SHA / model / prompt (mirror the English harness in
   `src/backend/coach/safety/runCoachSafetyTests.ts`).
4. **Localized crisis resources** — the right in-country helpline(s) for that language's users, not a
   translated Australian number. Wire them into the locale routing
   (`src/backend/coach/safety/responsesLocalized.ts`, `index.ts`).
5. **Action-integrity + app-help tests** pass in that language.
6. A **locale-specific kill switch** so the language can be turned off instantly if a problem appears.

## Turning it on
Only after the above is on file: add the locale to `COACH_APPROVED_LOCALES`. `coachOutputLanguage()`
then returns it, the client sends it, and `buildCoachSystemPrompt` adds the "reply in <language>"
directive. **Re-run** `npm run validate:coach-release` and `npm run test:safety` — the prompt for that
locale now differs, so update any canonical snapshot deliberately as part of the signed release.

Until a locale passes, a user who selects it still gets a coherent experience: the app UI localizes
(see `docs/LOCALIZATION.md`) and the coach clearly stays English — never silent mixed-language.

## Links
- 2026 ACSM position stands (training claims): https://www.acsm.org/education-resources/trending-topics-resources/position-stands
- Find a Helpline (international crisis lines, for localized resources): https://findahelpline.com/
- IASP crisis centre directory: https://www.iasp.info/resources/Crisis_Centres/
- Apple App Review Guidelines (Safety / Medical, §1.4 & §5.1): https://developer.apple.com/app-store/review/guidelines/#safety
- Google Play — Health content and services policy center: https://support.google.com/googleplay/android-developer/topic/9877766
