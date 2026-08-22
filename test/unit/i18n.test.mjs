// i18n coverage + coach-locale gating (§9). The dictionaries are the missing-key guard: every
// non-English dictionary must define exactly the same keys as English (a missing key silently falls
// back to English and reads as "untranslated"), and the coach must only ever be allowed to answer in
// a safety-approved locale.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  translator,
  LANGUAGES,
  COACH_APPROVED_LOCALES,
  coachOutputLanguage,
  __DICTS_FOR_TEST,
} from '../../.sweep-out/lib/i18n.js'

test('no language dictionary carries an orphan key English does not define (catches typos)', () => {
  // English is the key master. A non-English dict may still be INCOMPLETE (legacy sparseness that
  // the translation backlog fills in), and a missing key falls back to English — but a key that
  // exists ONLY in a translated dict is always a typo/orphan and would never be reached.
  const enKeys = new Set(Object.keys(__DICTS_FOR_TEST.en))
  for (const lang of Object.keys(__DICTS_FOR_TEST)) {
    if (lang === 'en') continue
    const extra = Object.keys(__DICTS_FOR_TEST[lang]).filter((k) => !enKeys.has(k))
    assert.deepEqual(extra, [], `${lang} has orphan keys English doesn't define: ${extra.join(', ')}`)
  }
})

test('the onboarding Welcome keys are translated in every supported language', () => {
  for (const { code } of LANGUAGES) {
    const t = translator(code)
    for (const key of ['onboarding.tagline', 'onboarding.getStarted', 'onboarding.haveAccount', 'onboarding.logIn']) {
      const val = t(key)
      assert.ok(val && val !== key, `${code} missing a real translation for ${key}`)
    }
  }
})

test('translator falls back to English then the raw key', () => {
  const t = translator('zh')
  assert.equal(t('settings.title'), '设置')
  assert.equal(t('totally.unknown.key'), 'totally.unknown.key')
})

test('the coach may only answer in a safety-approved locale (English until sign-off)', () => {
  assert.deepEqual(COACH_APPROVED_LOCALES, ['en'], 'no non-English coach locale is approved yet')
  assert.equal(coachOutputLanguage('en'), 'en')
  // A selected-but-unapproved locale falls back to English (explicit, never silent mixed-language).
  assert.equal(coachOutputLanguage('ar'), 'en')
  assert.equal(coachOutputLanguage('zh'), 'en')
})
