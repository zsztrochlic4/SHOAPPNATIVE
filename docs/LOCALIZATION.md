# Localizing the rest of the app + right-to-left (RTL)

**Status today:** the i18n framework is in place and reactive. What's left is *content* (translating
each screen's strings) and enabling RTL layout — both are ongoing work rather than a single code fix.

## How the framework works (already built)
- Dictionaries + `translator()` live in [`src/lib/i18n.ts`](../src/lib/i18n.ts) (5 languages:
  `en, zh, hi, ar, vi`).
- **`useT()`** ([`src/lib/useT.ts`](../src/lib/useT.ts)) is the reactive hook: `const t = useT()`
  then `t('some.key')`. It re-renders the screen the moment the language changes. Settings and the
  onboarding Welcome screen already use it.
- Missing keys fall back to English, so wiring a screen never crashes — it just shows English for any
  key you haven't translated yet. The test `test/unit/i18n.test.mjs` guards against orphan keys.

## Localizing a screen (repeat per screen)
1. In the component: `import { useT } from '../lib/useT'` and `const t = useT()`.
2. Replace each hardcoded string literal in JSX with `t('screen.key')` (e.g. `t('dashboard.goodMorning')`).
3. Add that key to **all five** dictionaries in `src/lib/i18n.ts` (English first — it's the key master).
4. Run `npm run test:unit` — the i18n test catches keys that exist only in a translated dict.

Priority order (highest visibility first): onboarding flow (question/option text), Dashboard,
Paywall, Settings remainder, Workout, Nutrition, Community.

## Getting real translations (don't ship machine output for safety-adjacent copy)
The five dictionaries are sparse and partly machine-drafted. For a quality release, export the keys to
a translation-management tool and have native speakers review, then import back. Any of these work
with a flat key/value JSON like the dictionaries:
- **Crowdin**, **Lokalise**, or **Locize** — upload the English keys, invite translators, download per-language files.
Consider extracting each `Dict` to a `src/locales/<lang>.json` file so translators never touch code.

Formatting (numbers, dates, units) should use the built-in `Intl` API, or `expo-localization`'s
locale info, rather than hardcoded formats.

## Right-to-left (Arabic)
RTL is scaffolded in [`src/lib/rtl.ts`](../src/lib/rtl.ts) and wired to the language switch, but full
layout mirroring is **gated off** behind `EXPO_PUBLIC_RTL_LAYOUT` (default off) for a real reason:

- `I18nManager.forceRTL()` only re-lays-out the app on the **next launch** (the util returns
  `changed` so the UI can prompt a restart), and
- Mirroring only looks right once styles use **logical edges** (`start`/`end`, `marginStart`,
  `textAlign: 'start'`) instead of physical `left`/`right`. This app still uses physical edges in
  many places, so flipping RTL today would half-mirror Arabic — worse than LTR.

**To finish RTL:** (1) migrate styles to logical edges screen by screen; (2) set
`EXPO_PUBLIC_RTL_LAYOUT=1`; (3) selecting Arabic then flips direction and prompts a restart; (4) also
set `supportsRTL`/`forcesRTL` on the `expo-localization` config plugin if you adopt it. Until then,
Arabic UI text stays legible on the LTR layout, and the coach stays English (see
`docs/COACH_LOCALE_ENABLEMENT.md`).

## Links
- Expo — Localization guide: https://docs.expo.dev/guides/localization/
- React Native — I18nManager (RTL API): https://reactnative.dev/docs/i18nmanager
- MDN — `Intl` (number/date/unit formatting): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl
- Crowdin: https://crowdin.com/  ·  Lokalise: https://lokalise.com/  ·  Locize: https://locize.com/
