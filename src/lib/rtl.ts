/**
 * Right-to-left layout direction for the in-app language switch.
 *
 * React Native mirrors layout via `I18nManager`. Two important constraints shape this module:
 *   1. `I18nManager.forceRTL()` does NOT re-lay-out a running app — the change only takes effect on
 *      the NEXT app launch, so the caller must ask the user to restart.
 *   2. Full mirroring only looks right once the UI uses *logical* edges (`start`/`end`,
 *      `marginStart`, `paddingEnd`, `textAlign: 'left'` → `'start'`) instead of physical `left`/
 *      `right`. This app still uses physical edges in many places, so force-flipping the whole app
 *      to RTL today would half-mirror Arabic — worse than LTR text on an LTR layout.
 *
 * Therefore full RTL layout is GATED behind `EXPO_PUBLIC_RTL_LAYOUT` (default off). Turn it on only
 * after the styles have been migrated to logical edges (see docs/LOCALIZATION.md). Until then this
 * still does the safe part: text runs still get their writing direction from `isRTL(lang)` at the
 * render sites that opt in, and Arabic text stays legible on the existing LTR layout.
 */
import { I18nManager } from 'react-native'
import { isRTL, type Language } from './i18n'

/** Whether full RTL LAYOUT mirroring is enabled. Off until the logical-edge migration lands. */
export const RTL_LAYOUT_ENABLED = process.env.EXPO_PUBLIC_RTL_LAYOUT === '1'

/**
 * Align the native layout direction to the selected language. Returns whether the direction changed
 * (so the caller can prompt for the restart RN needs to apply it). A no-op that returns false when
 * full RTL layout is gated off, or when the direction already matches.
 */
export function syncLayoutDirection(lang: Language): { changed: boolean } {
  // allowRTL is harmless on its own (it only permits mirroring; it doesn't force it) and is required
  // before forceRTL has any effect.
  try {
    I18nManager.allowRTL(RTL_LAYOUT_ENABLED)
  } catch {
    return { changed: false }
  }
  if (!RTL_LAYOUT_ENABLED) return { changed: false }
  const wantRTL = isRTL(lang)
  if (I18nManager.isRTL === wantRTL) return { changed: false }
  try {
    I18nManager.forceRTL(wantRTL)
    return { changed: true }
  } catch {
    return { changed: false }
  }
}
