import { Platform } from 'react-native'
import * as Haptics from 'expo-haptics'

/**
 * Tiny haptic helpers for the premium-feel interactions (dials, rulers).
 * On iOS/Android this is a real vibration tick; on web most browsers ignore
 * vibration, so we try navigator.vibrate and otherwise no-op — never throws.
 */
export function tick() {
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
