/**
 * DEV-ONLY live preview of the real Paywall screen.
 *
 * The paywall only mounts in the running app when a user is onboarded, signed in
 * and NOT yet entitled (see AuthGate in App.tsx). In demo / web-preview mode
 * `isEntitled` is always true, so the paywall is otherwise unreachable for a
 * quick look. This harness mounts the REAL `src/screens/Paywall.tsx` — same
 * theme tokens, haptics, animations and legal modals — inside the same provider
 * stack the app uses, so what you see is pixel-faithful to production.
 *
 * Rendered ONLY behind the `__DEV__` + `EXPO_PUBLIC_PAYWALL_PREVIEW === '1'`
 * guard in App.tsx, so it is never imported by, or bundled into, a release
 * build. It does not touch the entitlement gate or start any real checkout on
 * mount; the buttons behave exactly as they do in the app.
 */

import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { View } from 'react-native'
import { StatusBar as ExpoStatusBar } from 'expo-status-bar'
import '../../global.css'
import { StoreProvider } from '../store/store'
import { ToastProvider } from '../components/Toast'
import { WebPreviewFrame } from '../components/WebFrame'
import { themeVars, useThemeName } from '../theme'
import { Paywall } from '../screens/Paywall'

/** Applies the current theme tokens, then renders the real paywall. */
function ThemedPaywall() {
  const name = useThemeName()
  return (
    <View style={[{ flex: 1 }, themeVars[name]]} className="bg-ink-900">
      <ExpoStatusBar style={name === 'light' ? 'dark' : 'light'} />
      <ToastProvider>
        <Paywall />
      </ToastProvider>
    </View>
  )
}

export function PaywallPreviewScreen() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* WebPreviewFrame centres a phone-width column on desktop web, matching how
          the real app (App.tsx) frames the paywall. */}
      <WebPreviewFrame>
        <SafeAreaProvider>
          <StoreProvider>
            <ThemedPaywall />
          </StoreProvider>
        </SafeAreaProvider>
      </WebPreviewFrame>
    </GestureHandlerRootView>
  )
}
