import { Activity, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, ScrollView, Animated, Easing } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar as ExpoStatusBar } from 'expo-status-bar'
import '../global.css'
import { WebPreviewFrame, IS_WEB } from './components/WebFrame'
import { ErrorBoundary } from './components/ErrorBoundary'
import { BottomNav } from './components/BottomNav'
import { SwipeNav } from './components/SwipeNav'
import { StoreProvider, useStore, useStoreMeta, useStoreSelector } from './store/store'
import type { AppState } from './store/types'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { isEntitled } from './store/selectors'
import { todayKey } from './lib/date'
import { CloudSync } from './store/CloudSync'
import { BillingSync } from './store/BillingSync'
import { Paywall } from './screens/Paywall'
import { IntegrationsAutoSync } from './components/Integrations'
import { PushRegistration, NotificationsSync } from './components/PushRegistration'
import { CompletionQueueSync } from './components/CompletionQueueSync'
import { CoachWorkspaceSync } from './components/CoachWorkspaceSync'
import { DeepLinkHandler } from './components/DeepLinkHandler'
import { ToastProvider } from './components/Toast'
import { NavProvider, type Overlay } from './nav'
import { themeVars, useThemeName, cssVars } from './theme'
import { setSoundEnabled } from './lib/sound'
import { setHapticsEnabled } from './lib/haptics'
import { setReducedMotionPreference } from './lib/a11y'
import { initBudgetMeals } from './data/recipes'
import { initExerciseInfo } from './data/exerciseInfo'
import { initQuickWorkouts } from './data/quickWorkouts'
import { Skeleton, SkeletonLines } from './components/Skeleton'
import { installGlobalErrorHooks } from './lib/reportError'
import { installRemoteErrorReporter } from './lib/remoteErrorReporter'
import { OfflineBanner } from './components/OfflineBanner'
import Dashboard from './screens/Dashboard'
import Workout from './screens/Workout'
import Nutrition from './screens/Nutrition'
import Progress from './screens/Progress'
import Community from './screens/Community'
import Onboarding from './screens/Onboarding'
import ActiveWorkout from './screens/ActiveWorkout'
import { LogProgressSheet } from './screens/LogProgressSheet'
import { CoachScreen } from './coach/CoachScreen'
import {
  AddFoodSheet,
  ProfileSheet,
  NotificationsSheet,
  SettingsSheet,
  MenuDrawer,
  LogWeightSheet,
  QuickWorkoutsSheet,
  BadgesSheet,
  CoachSheet,
  CoachChatSheet,
  BeginnerSheet,
  BudgetEatsSheet,
  ExerciseDetailSheet,
  PRCelebrationSheet,
  LogActivitySheet,
  CustomizeSheet,
  CreateSessionSheet,
} from './overlays'
import { PlanAroundLifeSheet } from './overlays/planAroundLife'
import { TrainingProfileSheet } from './overlays/trainingProfile'

export type TabKey = 'dashboard' | 'workout' | 'coach' | 'nutrition' | 'progress' | 'community'

// Coach is a first-class tab too, but it owns its full layout (composer above the nav, keyboard
// handling) so it's mounted separately from these outer-scrolled screens. `progress` keeps its
// screen and stays reachable (dashboard "Progress overview", coach proposals) even though it's no
// longer one of the five nav slots.
const screens: Record<Exclude<TabKey, 'coach'>, React.ComponentType> = {
  dashboard: Dashboard,
  workout: Workout,
  nutrition: Nutrition,
  progress: Progress,
  community: Community,
}
const TAB_KEYS = Object.keys(screens) as Exclude<TabKey, 'coach'>[]
const selectSoundEnabled = (state: AppState) => state.settings.soundEnabled ?? true
const selectHapticsEnabled = (state: AppState) => state.settings.hapticsEnabled ?? true
const selectReducedMotion = (state: AppState) => state.settings.reducedMotion ?? 'system'
const selectOnboarded = (state: AppState) => state.profile.onboarded

/**
 * Fades + slides each screen up by 10px when the active tab changes, mirroring
 * the web build's `animate-screen-in` (0.45s, cubic-bezier(0.22,1,0.36,1)).
 * Re-runs whenever `tabKey` changes.
 */
function ScreenFade({ tabKey, children }: { tabKey: string; children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    anim.setValue(0)
    Animated.timing(anim, {
      toValue: 1,
      duration: 450,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: !IS_WEB,
    }).start()
  }, [tabKey, anim])
  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  )
}

function Shell() {
  const { hydrated, persistenceError } = useStoreMeta()
  const onboarded = useStoreSelector(selectOnboarded)
  const insets = useSafeAreaInsets()
  const [tab, setTab] = useState<TabKey>('dashboard')
  const [visitedTabs, setVisitedTabs] = useState<Set<TabKey>>(() => new Set(['dashboard']))
  // While the Coach composer's keyboard is open we auto-hide the bottom nav (CLAUDE.md).
  const [coachKeyboardOpen, setCoachKeyboardOpen] = useState(false)
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  const [params, setParams] = useState<Record<string, unknown>>({})
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuStack, setMenuStack] = useState(false)

  const selectTab = useCallback((next: TabKey) => {
    setVisitedTabs((visited) => {
      if (visited.has(next)) return visited
      const updated = new Set(visited)
      updated.add(next)
      return updated
    })
    setTab(next)
  }, [])

  const nav = useMemo(() => ({
    open: (o: Overlay, p: Record<string, unknown> = {}) => {
      setParams(p)
      setMenuStack(false)
      setOverlay(o)
    },
    // Close the active overlay. When it was a menu detail, `menuStack` clears and
    // the still-mounted menu is revealed (back navigation).
    close: () => {
      setOverlay(null)
      setMenuStack(false)
    },
    goTab: (t: TabKey) => {
      setOverlay(null)
      setMenuStack(false)
      setMenuOpen(false)
      selectTab(t)
    },
    menuOpen,
    openMenu: () => setMenuOpen(true),
    closeMenu: () => setMenuOpen(false),
    menuStack,
    // Open an overlay as a menu detail: keep the menu mounted underneath so its
    // sheet slides in from the right and `back` returns to the menu.
    openInMenu: (o: Overlay, p: Record<string, unknown> = {}) => {
      setParams(p)
      setMenuStack(true)
      setOverlay(o)
    },
    // Top-right ✕ on a detail: dismiss the detail AND the menu, back to dashboard.
    closeToDashboard: () => {
      setOverlay(null)
      setMenuStack(false)
      setMenuOpen(false)
      selectTab('dashboard')
    },
  }), [menuOpen, menuStack, selectTab])

  if (!hydrated) {
    // A dashboard-shaped skeleton reads as "almost ready" rather than a lonely
    // spinner on a blank screen.
    return (
      <View className="flex-1 bg-ink-900 px-5" style={{ paddingTop: insets.top + 12 }}>
        <View className="flex-row items-center justify-between">
          <Skeleton width={40} height={40} radius={12} />
          <Skeleton width={96} height={20} radius={6} />
          <Skeleton width={40} height={40} radius={12} />
        </View>
        <View className="mt-6 items-center gap-3">
          <Skeleton width={200} height={20} radius={6} />
          <Skeleton width={228} height={116} radius={16} />
          <Skeleton width={240} height={14} radius={6} />
        </View>
        <View className="mt-6 flex-row justify-between">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} width={30} height={54} radius={12} />
          ))}
        </View>
        <View className="mt-8 gap-3">
          <Skeleton width="100%" height={150} radius={16} />
          <View className="mt-2"><SkeletonLines count={3} /></View>
        </View>
      </View>
    )
  }

  if (!onboarded) {
    return (
      <NavProvider value={nav}>
        <View className="flex-1 bg-ink-900" style={{ paddingTop: insets.top }}>
          <Onboarding />
        </View>
      </NavProvider>
    )
  }

  const renderTab = (tabKey: Exclude<TabKey, 'coach'>) => {
    const Screen = screens[tabKey]
    // Nutrition and Workout own their scrolling (section scrollers, sticky
    // controls, and virtualised lists); the remaining screens keep a dedicated
    // outer scroller.
    const content = tabKey === 'nutrition' || tabKey === 'workout' ? (
      <Screen />
    ) : (
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 112 }}
        showsVerticalScrollIndicator={false}
      >
        <Screen />
      </ScrollView>
    )
    return tabKey === 'dashboard' ? (
      <SwipeNav onOpenMenu={nav.openMenu}>
        {content}
      </SwipeNav>
    ) : content
  }

  // ActiveWorkout remains mounted so an in-progress timer survives temporarily
  // closing its sheet. Every other overlay is instantiated only while active.
  const overlayContent = (() => {
    switch (overlay) {
      case 'notifications': return <NotificationsSheet open onClose={nav.close} />
      case 'settings': return <SettingsSheet open onClose={nav.close} />
      case 'addFood': return <AddFoodSheet open onClose={nav.close} params={params} />
      case 'profile': return <ProfileSheet open onClose={nav.close} />
      case 'trainingProfile': return <TrainingProfileSheet open onClose={nav.close} />
      case 'logWeight': return <LogWeightSheet open onClose={nav.close} />
      case 'logProgress': return <LogProgressSheet open onClose={nav.close} />
      case 'quick': return <QuickWorkoutsSheet open onClose={nav.close} />
      case 'badges': return <BadgesSheet open onClose={nav.close} />
      case 'examMode': return <PlanAroundLifeSheet open onClose={nav.close} />
      case 'coach': return <CoachSheet open onClose={nav.close} />
      case 'coachChat': return <CoachChatSheet open onClose={nav.close} />
      case 'beginner': return <BeginnerSheet open onClose={nav.close} />
      case 'budgetEats': return <BudgetEatsSheet open onClose={nav.close} />
      case 'exerciseDetail': return <ExerciseDetailSheet open onClose={nav.close} params={params} />
      case 'prCelebration': return <PRCelebrationSheet open onClose={nav.close} params={params} />
      case 'logActivity': return <LogActivitySheet open onClose={nav.close} />
      case 'customize': return <CustomizeSheet open onClose={nav.close} params={params} />
      case 'createSession': return <CreateSessionSheet open onClose={nav.close} params={params} />
      default: return null
    }
  })()

  return (
    <NavProvider value={nav}>
      {/* Push taps / strengthhub:// links route to allowlisted destinations (F-020). */}
      <DeepLinkHandler />
      <View className="flex-1 bg-ink-900" style={{ paddingTop: insets.top }}>
        {persistenceError && onboarded && (
          <View
            accessibilityRole="alert"
            className="border-b border-red-400/20 bg-red-500/10 px-5 py-2.5"
          >
            <Text className="text-center text-[12px] leading-4 text-red-100">
              Saved data could not be loaded. It has not been overwritten; avoid resetting the app and contact support.
            </Text>
          </View>
        )}
        <View className="flex-1">
          {TAB_KEYS.map((tabKey) => visitedTabs.has(tabKey) && (
            <Activity key={tabKey} name={`tab-${tabKey}`} mode={tab === tabKey ? 'visible' : 'hidden'}>
              <ScreenFade tabKey={tabKey}>{renderTab(tabKey)}</ScreenFade>
            </Activity>
          ))}
          {/* Coach owns its own layout (composer above the nav + keyboard handling), so it's mounted
              on its own. Staying mounted preserves the conversation, draft and scroll across tabs. */}
          {visitedTabs.has('coach') && (
            <Activity key="coach" name="tab-coach" mode={tab === 'coach' ? 'visible' : 'hidden'}>
              <ScreenFade tabKey="coach">
                <CoachScreen chrome="tab" active={tab === 'coach'} onKeyboardVisibleChange={setCoachKeyboardOpen} />
              </ScreenFade>
            </Activity>
          )}
        </View>
        <BottomNav active={tab} onChange={selectTab} hidden={tab === 'coach' && coachKeyboardOpen} />
      </View>

      {/* Overlays */}
      <ActiveWorkout open={overlay === 'activeWorkout'} onClose={nav.close} onComplete={() => nav.goTab('dashboard')} params={params} />
      <MenuDrawer open={menuOpen} onClose={nav.closeMenu} />
      {overlayContent}
    </NavProvider>
  )
}

function ThemedRoot() {
  const name = useThemeName()
  const soundOn = useStoreSelector(selectSoundEnabled)
  const hapticsOn = useStoreSelector(selectHapticsEnabled)
  const reducedMotion = useStoreSelector(selectReducedMotion)

  // Keep the (asset-free) sound engine in sync with Settings → "Sounds & cues".
  useEffect(() => {
    setSoundEnabled(soundOn)
  }, [soundOn])

  // Apply the haptics + reduced-motion preferences to their lib singletons
  // (audit SA-013/SA-017) so a user's Settings choice takes effect app-wide,
  // independent of sound and the OS setting.
  useEffect(() => {
    setHapticsEnabled(hapticsOn !== false)
  }, [hapticsOn])
  useEffect(() => {
    setReducedMotionPreference(reducedMotion ?? 'system')
  }, [reducedMotion])

  // Load the recipe catalogue once: bundled seed shows instantly, then the
  // Firestore `recipes` overlay (edited via the spreadsheet) is applied. No-op
  // in demo mode / offline (see src/data/recipes.ts).
  useEffect(() => {
    void initBudgetMeals()
    void initExerciseInfo()
    void initQuickWorkouts()
  }, [])

  // On web, RN-Web modals (menu, sheets, full-screen views) portal to <body>,
  // outside this themed subtree, so they wouldn't see the `vars()` applied
  // below. Mirror the same CSS variables onto the document root so those
  // overlays inherit the theme instead of rendering unstyled/white.
  useEffect(() => {
    if (!IS_WEB || typeof document === 'undefined') return
    const root = document.documentElement
    const map = cssVars[name]
    for (const key in map) root.style.setProperty(key, map[key])
  }, [name])

  return (
    <View style={[{ flex: 1 }, themeVars[name]]} className="bg-ink-900">
      <ExpoStatusBar style={name === 'light' ? 'dark' : 'light'} />
      <ToastProvider>
        <AuthGate />
      </ToastProvider>
      {/* App-wide ambient offline indicator, above content and overlays. */}
      <OfflineBanner />
    </View>
  )
}

/**
 * Routes between the onboarding front door, the paywall and the app.
 *
 * The onboarding screen is the single signed-out front door: it owns its own
 * Welcome (Get Started / Log In), the question flow, real sign-up (at the
 * "Save your personalised experience" step) and real log-in. So a signed-out
 * real user, or anyone not yet onboarded, lands there.
 *
 * Once onboarded and signed in, the paywall gates the app until a trial or
 * subscription is active (`isEntitled`). When Firebase isn't configured
 * (`enabled` false — demo / preview) `isEntitled` is always true and there's no
 * user, so it flows straight to the app, untouched.
 *
 * The signed-in cloud services (sync + entitlement listener) mount whenever a
 * real session exists, independent of which screen shows — so entitlement keeps
 * syncing while the user is on the paywall.
 */
/**
 * Central "today's session" materialiser. The generated program's loggable session for TODAY is
 * created lazily from the matching weekday instance (`START_PROGRAM_DAY`). This used to happen ONLY
 * on the Workout screen's mount, so a user who landed on the Dashboard first saw "Rest day" until
 * they opened the Workout tab — the two surfaces disagreed even though both read `todaySession`.
 * Running it here, once the user is in the app and regardless of which tab shows, guarantees the
 * Dashboard's today card and the Workout card are ALWAYS the same and always reflect the program.
 * Idempotent: `START_PROGRAM_DAY` is a no-op if the session already exists, if there are no
 * instances, or if today is a rest day (no matching weekday instance), so it never clobbers a
 * logged session and correctly leaves a genuine rest day empty on both surfaces.
 */
function ProgramDayMaterialiser(): null {
  const { state, dispatch } = useStore()
  const gateOpen = state.programStatus?.ok === true
  const hasInstances = (state.workoutInstances?.length ?? 0) > 0
  useEffect(() => {
    if (gateOpen && hasInstances) dispatch({ type: 'START_PROGRAM_DAY', dateKey: todayKey })
  }, [gateOpen, hasInstances, dispatch])
  return null
}

function AuthGate() {
  const { enabled, loading, user } = useAuth()
  const { state, hydrated } = useStore()
  const insets = useSafeAreaInsets()

  if (enabled && loading) {
    // Branded bootstrap skeleton (audit F-037): the same dashboard-shaped
    // placeholder Shell uses, so a cold start reads as "almost ready" instead
    // of a generic full-screen spinner.
    return (
      <View className="flex-1 bg-ink-900 px-5" style={{ paddingTop: insets.top + 12 }}>
        <View className="flex-row items-center justify-between">
          <Skeleton width={40} height={40} radius={12} />
          <Skeleton width={96} height={20} radius={6} />
          <Skeleton width={40} height={40} radius={12} />
        </View>
        <View className="mt-6 items-center gap-3">
          <Skeleton width={200} height={20} radius={6} />
          <Skeleton width={228} height={116} radius={16} />
          <Skeleton width={240} height={14} radius={6} />
        </View>
        <View className="mt-8 gap-3">
          <Skeleton width="100%" height={150} radius={16} />
          <View className="mt-2"><SkeletonLines count={3} /></View>
        </View>
      </View>
    )
  }

  // Defer to Shell's dashboard-shaped skeleton until the local store hydrates.
  if (!hydrated) return <Shell />

  const services = user ? (
    <>
      <CloudSync />
      <IntegrationsAutoSync />
      <PushRegistration />
      <NotificationsSync />
      <BillingSync />
      <CompletionQueueSync />
      <CoachWorkspaceSync />
    </>
  ) : null

  // Front door: signed-out real users, and anyone not yet onboarded.
  const needsOnboarding = (enabled && !user) || !state.profile.onboarded
  if (needsOnboarding) {
    return (
      <>
        {services}
        <View className="flex-1 bg-ink-900" style={{ paddingTop: insets.top }}>
          <Onboarding />
        </View>
      </>
    )
  }

  // Onboarded + signed in (or demo): gate on entitlement, then the app.
  if (!isEntitled(state, enabled)) {
    return (
      <>
        {services}
        <Paywall />
      </>
    )
  }

  return (
    <>
      {services}
      <ProgramDayMaterialiser />
      <Shell />
    </>
  )
}

/**
 * DEV-ONLY safety-holdout validation harness. Guarded two ways so it can NEVER ship:
 *   1. `__DEV__` — false in any release/App-Store build; Metro's minifier constant-folds this
 *      branch away, so the `require` (and the entire src/dev tree) is dropped from production bundles.
 *   2. `EXPO_PUBLIC_SAFETY_HARNESS === '1'` — off unless explicitly set, so it never appears in a
 *      normal dev session either.
 * It measures the classifier only; it does not enable the coach or change the gate.
 */
function DevSafetyHarnessGate(): React.ReactElement | null {
  if (!__DEV__ || process.env.EXPO_PUBLIC_SAFETY_HARNESS !== '1') return null
  const { SafetyHarnessScreen } = require('./dev/SafetyHarnessScreen')
  return <SafetyHarnessScreen />
}

// Catch uncaught JS errors + unhandled rejections app-wide (audit F-034) —
// they flow through the reportError seam into the redacted local diagnostics
// buffer (and any crash service registered later via setErrorReporter).
installGlobalErrorHooks()
// Wire the reportError seam to the trusted backend (audit SA-014): production
// crashes now emit an alertable, redacted remote signal (throttled, best-effort),
// not just a local buffer. No-op when Firebase isn't configured.
installRemoteErrorReporter()

export default function App() {
  const devHarness = DevSafetyHarnessGate()
  if (devHarness) return devHarness

  return (
    // GestureHandlerRootView must wrap the whole app for react-native-gesture-handler.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <WebPreviewFrame>
        <SafeAreaProvider>
          <ErrorBoundary>
            <StoreProvider>
              <AuthProvider>
                <ThemedRoot />
              </AuthProvider>
            </StoreProvider>
          </ErrorBoundary>
        </SafeAreaProvider>
      </WebPreviewFrame>
    </GestureHandlerRootView>
  )
}
