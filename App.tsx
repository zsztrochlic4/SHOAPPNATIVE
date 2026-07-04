import { useState, useEffect } from 'react'
import { View, Text, ActivityIndicator, ScrollView, Platform, type ViewStyle, type TextStyle } from 'react-native'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar as ExpoStatusBar } from 'expo-status-bar'
import { Wifi, BatteryFull, SignalHigh } from 'lucide-react-native'
import '../global.css'
import { BottomNav } from './components/BottomNav'
import { StoreProvider, useStore } from './store/store'
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
    </NavProvider>
  )
}

function ThemedRoot() {
  const name = useThemeName()

  // On web, mirror the theme's CSS variables onto the document root so that
  // React Native Web Modals — which portal to <body>, outside this subtree —
  // inherit the theme instead of rendering unstyled. See src/theme.tsx.
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
        <Shell />
      </ToastProvider>
    </View>
  )
}

/**
 * On the web preview, top the app with an iOS-style status bar so it reads as
 * the mobile app it is. The phone shape itself (centered, rounded, shadowed,
 * with the surrounding "wall") is done in CSS on <html>/<body> — see
 * global.css — because React Native Web Modals portal to <body> and must be
 * contained by the phone box, not this React subtree. No-op on native.
 */
function WebPreviewFrame({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>
  return (
    <View style={{ flex: 1 }}>
      <FauxStatusBar />
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  )
}

/** The iOS-style status bar the mockup expects: time on the left, radios right. */
function FauxStatusBar() {
  return (
    <View style={webFrame.statusBar}>
      <Text style={webFrame.statusTime}>9:41</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <SignalHigh size={18} color="#fff" strokeWidth={2.5} />
        <Wifi size={17} color="#fff" strokeWidth={2.5} />
        <BatteryFull size={24} color="#fff" strokeWidth={2} />
      </View>
    </View>
  )
}

const webFrame: { statusBar: ViewStyle; statusTime: TextStyle } = {
  statusBar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    backgroundColor: '#000',
  },
  statusTime: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
}

export default function App() {
  return (
    <WebPreviewFrame>
      <SafeAreaProvider>
        <StoreProvider>
          <ThemedRoot />
        </StoreProvider>
      </SafeAreaProvider>
    </WebPreviewFrame>
  )
}
