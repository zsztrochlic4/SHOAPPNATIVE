import { Platform } from 'react-native'
import * as Haptics from 'expo-haptics'

/**
 * Tiny haptic helpers for the premium-feel interactions (dials, rulers).
 * On iOS/Android this is a real vibration tick; on web most browsers ignore
 * vibration, so we try navigator.vibrate and otherwise no-op — never throws.
 *
 * Honours the user's haptics preference (audit SA-017): Settings sets it via
 * `setHapticsEnabled`, so a user who turns haptics off gets none — independent
 * of the sound toggle. Defaults on.
 */
let hapticsEnabled = true

/** Apply the user's haptics preference (called from Settings + on hydrate). */
export function setHapticsEnabled(enabled: boolean): void {
  hapticsEnabled = enabled
}

export function tick() {
  if (!hapticsEnabled) return
  try {
    if (Platform.OS === 'web') {
      ;(globalThis.navigator as Navigator | undefined)?.vibrate?.(8)
      return
    }
    Haptics.selectionAsync()
  } catch {
    /* haptics unavailable — fine */
  }
}

/** Slightly stronger pulse for confirmations (finishing a step, snapping). */
export function thud() {
  if (!hapticsEnabled) return
  try {
    if (Platform.OS === 'web') {
      ;(globalThis.navigator as Navigator | undefined)?.vibrate?.(20)
      return
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  } catch {
    /* haptics unavailable — fine */
  }
}
