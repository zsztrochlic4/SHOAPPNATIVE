/**
 * Reactive translation hook. Derives the translate function from the user's selected language in
 * the store, so ANY screen that calls `useT()` re-renders and re-localises the moment the language
 * changes in Settings or onboarding — no extra plumbing. This is the app-wide entry point that the
 * (previously Settings-only) i18n layer was missing; screens adopt it in place of hardcoded English.
 */
import { useStoreSelector } from '../store/store'
import { translator, type Language } from './i18n'
import type { AppState } from '../store/types'

const selectLang = (s: AppState): Language => s.settings.language ?? 'en'

/** The current translate function, reactive to the selected language. */
export function useT() {
  return translator(useStoreSelector(selectLang))
}

/** The currently selected language code, reactive. */
export function useLanguage(): Language {
  return useStoreSelector(selectLang)
}
