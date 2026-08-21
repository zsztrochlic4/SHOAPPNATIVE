/**
 * DEV-ONLY live preview of the real side Menu (the full-screen `MenuDrawer`).
 *
 * The menu only mounts in the running app once a user is onboarded, signed in
 * and entitled, then taps the "Open menu" button on the Dashboard (see
 * App.tsx / Shell). That makes it awkward to reach for a quick look. This
 * harness mounts the REAL `MenuDrawer` from `src/overlays` — same theme tokens,
 * haptics, slide animation and row layout — inside the same provider stack the
 * app uses, with the drawer forced open, so what you see is pixel-faithful to
 * production.
 *
 * Rendered ONLY behind the `__DEV__` + `EXPO_PUBLIC_MENU_PREVIEW === '1'`
 * guard in App.tsx, so it is never imported by, or bundled into, a release
 * build. It does not touch the entitlement gate or any real navigation on
 * mount; the rows behave exactly as they do in the app.
 */

import { useEffect, useState } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Platform, View } from 'react-native'
import { StatusBar as ExpoStatusBar } from 'expo-status-bar'
import '../../global.css'
import { StoreProvider } from '../store/store'
import { AuthProvider } from '../auth/AuthProvider'
import { ToastProvider } from '../components/Toast'
import { WebPreviewFrame } from '../components/WebFrame'
import { NavProvider, type NavCtx } from '../nav'
import { cssVars, themeVars, useThemeName } from '../theme'
import { MenuDrawer } from '../overlays'

/**
 * A no-op nav context so the menu's row presses resolve without a real overlay
 * stack. The drawer only reads `openInMenu` (via its `go` helper) on press, so
 * the stubs never fire on mount — the preview simply renders the open drawer.
 */
const previewNav: NavCtx = {
  open: () => {},
  close: () => {},
  goTab: () => {},
  menuOpen: true,
  openMenu: () => {},
  closeMenu: () => {},
  menuStack: false,
  openInMenu: () => {},
  closeToDashboard: () => {},
}

/** Applies the current theme tokens, then renders the real menu drawer, open. */
function ThemedMenu() {
  const name = useThemeName()
  // Keep the drawer open: re-open it if a close ever fires so the preview never
  // dismisses to an empty screen.
  const [open, setOpen] = useState(true)

  // The menu is an RN-Web Modal, which portals to <body> — outside this themed
  // subtree — so it wouldn't see the `themeVars` applied below and would render
  // with unstyled (black) text. Mirror the same CSS variables onto the document
  // root so the drawer inherits the theme, exactly as App.tsx's ThemedRoot does.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return
    const root = document.documentElement
    const map = cssVars[name]
    for (const key in map) root.style.setProperty(key, map[key])
  }, [name])

  return (
    <View style={[{ flex: 1 }, themeVars[name]]} className="bg-ink-900">
      <ExpoStatusBar style={name === 'light' ? 'dark' : 'light'} />
      <ToastProvider>
        <NavProvider value={previewNav}>
          <MenuDrawer open={open} onClose={() => setOpen(true)} />
        </NavProvider>
      </ToastProvider>
    </View>
  )
}

export function MenuPreviewScreen() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* WebPreviewFrame centres a phone-width column on desktop web, matching how
          the real app (App.tsx) frames the menu. */}
      <WebPreviewFrame>
        <SafeAreaProvider>
          <StoreProvider>
            <AuthProvider>
              <ThemedMenu />
            </AuthProvider>
          </StoreProvider>
        </SafeAreaProvider>
      </WebPreviewFrame>
    </GestureHandlerRootView>
  )
}
