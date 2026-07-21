import { useEffect, useRef, useState } from 'react'
import { View, ActivityIndicator, ScrollView, Animated, Easing } from 'react-native'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar as ExpoStatusBar } from 'expo-status-bar'
import '../global.css'
import { WebPreviewFrame, IS_WEB } from './components/WebFrame'
import { BottomNav } from './components/BottomNav'
import { StoreProvider, useStore } from './store/store'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { AuthScreen } from './auth/AuthScreen'
import { WelcomeScreen } from './screens/Welcome'
import { CloudSync } from './store/CloudSync'
import { IntegrationsAutoSync } from './components/Integrations'
import { PushRegistration, NotificationsSync } from './components/PushRegistration'
import { ToastProvider } from './components/Toast'
import { NavProvider, type Overlay } from './nav'
import { themeVars, useThemeName, brand, cssVars } from './theme'
import { setSoundEnabled } from './lib/sound'
import { Skeleton, SkeletonLines } from './components/Skeleton'
import Dashboard from './screens/Dashboard'
import Workout from './screens/Workout'
import Nutrition from './screens/Nutrition'
import Progress from './screens/Progress'
import Community from './screens/Community'
import Onboarding from './screens/Onboarding'
import ActiveWorkout from './screens/ActiveWorkout'
import {
  NotificationsSheet,
  SettingsSheet,
  MenuDrawer,
  LogWeightSheet,
  LogHabitSheet,
  CreatePostSheet,
  WeeklyRecapSheet,
  LeaderboardSheet,
  PhotosSheet,
  QuickWorkoutsSheet,
  BadgesSheet,
  ExamModeSheet,
  CoachSheet,
  CoachChatSheet,
  BeginnerSheet,
  BudgetEatsSheet,
  ExerciseDetailSheet,
  PartnerMatchSheet,
  PRCelebrationSheet,
  LogActivitySheet,
  PostDetailSheet,
  ChallengeDetailSheet,
  CustomizeSheet,
  CreateSessionSheet,
} from './overlays'

export type TabKey = 'dashboard' | 'workout' | 'nutrition' | 'progress' | 'community'

const screens: Record<TabKey, React.ComponentType> = {
  dashboard: Dashboard,
  workout: Workout,
  nutrition: Nutrition,
  progress: Progress,
  community: Community,
}

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
  const { state, hydrated } = useStore()
  const insets = useSafeAreaInsets()
  const [tab, setTab] = useState<TabKey>('dashboard')
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  const [params, setParams] = useState<Record<string, unknown>>({})
  const [menuOpen, setMenuOpen] = useState(false)

  const nav = {
    open: (o: Overlay, p: Record<string, unknown> = {}) => {
      setParams(p)
      setOverlay(o)
    },
    close: () => setOverlay(null),
    goTab: (t: TabKey) => {
      setOverlay(null)
      setMenuOpen(false)
      setTab(t)
    },
    menuOpen,
    openMenu: () => setMenuOpen(true),
    closeMenu: () => setMenuOpen(false),
  }

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

  if (!state.profile.onboarded) {
    return (
      <NavProvider value={nav}>
        <View className="flex-1 bg-ink-900" style={{ paddingTop: insets.top }}>
          <Onboarding />
        </View>
      </NavProvider>
    )
  }

  const Screen = screens[tab]

  return (
    <NavProvider value={nav}>
      <View className="flex-1 bg-ink-900" style={{ paddingTop: insets.top }}>
        <ScreenFade tabKey={tab}>
          <ScrollView
            key={tab}
            className="flex-1"
            contentContainerStyle={{ paddingBottom: insets.bottom + 112 }}
            showsVerticalScrollIndicator={false}
          >
            <Screen />
          </ScrollView>
        </ScreenFade>
        <BottomNav active={tab} onChange={setTab} />
      </View>

      {/* Overlays */}
      <ActiveWorkout open={overlay === 'activeWorkout'} onClose={nav.close} params={params} />
      <NotificationsSheet open={overlay === 'notifications'} onClose={nav.close} />
      <SettingsSheet open={overlay === 'settings'} onClose={nav.close} />
      <MenuDrawer open={menuOpen} onClose={nav.closeMenu} />
      <LogWeightSheet open={overlay === 'logWeight'} onClose={nav.close} />
      <LogHabitSheet open={overlay === 'logHabit'} onClose={nav.close} params={params} />
      <CreatePostSheet open={overlay === 'createPost'} onClose={nav.close} />
      <WeeklyRecapSheet open={overlay === 'recap'} onClose={nav.close} />
      <LeaderboardSheet open={overlay === 'leaderboard'} onClose={nav.close} />
      <PhotosSheet open={overlay === 'photos'} onClose={nav.close} />
      <QuickWorkoutsSheet open={overlay === 'quick'} onClose={nav.close} />
      <BadgesSheet open={overlay === 'badges'} onClose={nav.close} />
      <ExamModeSheet open={overlay === 'examMode'} onClose={nav.close} />
      <CoachSheet open={overlay === 'coach'} onClose={nav.close} />
      <CoachChatSheet open={overlay === 'coachChat'} onClose={nav.close} />
      <BeginnerSheet open={overlay === 'beginner'} onClose={nav.close} />
      <BudgetEatsSheet open={overlay === 'budgetEats'} onClose={nav.close} />
      <ExerciseDetailSheet open={overlay === 'exerciseDetail'} onClose={nav.close} params={params} />
      <PartnerMatchSheet open={overlay === 'partnerMatch'} onClose={nav.close} />
      <PRCelebrationSheet open={overlay === 'prCelebration'} onClose={nav.close} params={params} />
      <LogActivitySheet open={overlay === 'logActivity'} onClose={nav.close} />
      <PostDetailSheet open={overlay === 'postDetail'} onClose={nav.close} params={params} />
      <ChallengeDetailSheet open={overlay === 'challengeDetail'} onClose={nav.close} params={params} />
      <CustomizeSheet open={overlay === 'customize'} onClose={nav.close} />
      <CreateSessionSheet open={overlay === 'createSession'} onClose={nav.close} params={params} />
    </NavProvider>
  )
}

function ThemedRoot() {
  const name = useThemeName()
  const { state } = useStore()

  // Keep the (asset-free) sound engine in sync with Settings → "Sounds & cues".
  const soundOn = state.settings.soundEnabled ?? true
  useEffect(() => {
    setSoundEnabled(soundOn)
  }, [soundOn])

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
    </View>
  )
}

/**
 * Decides between the welcome/login flow and the app. When Firebase isn't
 * configured (`enabled` false) this always falls through to the app, so the
 * preview and demo mode are untouched. When it is configured, signed-out users
 * land on the premium Welcome carousel, then sign up / log in; signed-in users
 * get the app plus the cloud-sync bridge.
 */
function AuthGate() {
  const { enabled, loading, user } = useAuth()
  const insets = useSafeAreaInsets()
  const [entry, setEntry] = useState<'welcome' | 'signup' | 'signin'>('welcome')

  if (enabled && loading) {
    return (
      <View className="flex-1 items-center justify-center bg-ink-900" style={{ paddingTop: insets.top }}>
        <ActivityIndicator color={brand[400]} size="large" />
      </View>
    )
  }
  if (enabled && !user) {
    if (entry === 'welcome') {
      return <WelcomeScreen onSignUp={() => setEntry('signup')} onLogIn={() => setEntry('signin')} />
    }
    return <AuthScreen initialMode={entry} onBack={() => setEntry('welcome')} />
  }

  return (
    <>
      <CloudSync />
      <IntegrationsAutoSync />
      <PushRegistration />
      <NotificationsSync />
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

export default function App() {
  const devHarness = DevSafetyHarnessGate()
  if (devHarness) return devHarness

  return (
    <WebPreviewFrame>
      <SafeAreaProvider>
        <StoreProvider>
          <AuthProvider>
            <ThemedRoot />
          </AuthProvider>
        </StoreProvider>
      </SafeAreaProvider>
    </WebPreviewFrame>
  )
}
