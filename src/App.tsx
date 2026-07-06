import { useEffect, useState } from 'react'
import { View, ActivityIndicator, ScrollView } from 'react-native'
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
import { ToastProvider } from './components/Toast'
import { NavProvider, type Overlay } from './nav'
import { themeVars, useThemeName, brand, cssVars } from './theme'
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
  SessionDetailSheet,
} from './overlays'

export type TabKey = 'dashboard' | 'workout' | 'nutrition' | 'progress' | 'community'

const screens: Record<TabKey, React.ComponentType> = {
  dashboard: Dashboard,
  workout: Workout,
  nutrition: Nutrition,
  progress: Progress,
  community: Community,
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
    return (
      <View className="flex-1 items-center justify-center bg-ink-900">
        <ActivityIndicator color={brand[400]} size="large" />
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
        <ScrollView
          key={tab}
          className="flex-1"
          contentContainerStyle={{ paddingBottom: insets.bottom + 112 }}
          showsVerticalScrollIndicator={false}
        >
          <Screen />
        </ScrollView>
        <BottomNav active={tab} onChange={setTab} />
      </View>

      {/* Overlays */}
      <ActiveWorkout open={overlay === 'activeWorkout'} onClose={nav.close} />
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
      <SessionDetailSheet open={overlay === 'sessionDetail'} onClose={nav.close} params={params} />
    </NavProvider>
  )
}

function ThemedRoot() {
  const name = useThemeName()

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
      <Shell />
    </>
  )
}

export default function App() {
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
