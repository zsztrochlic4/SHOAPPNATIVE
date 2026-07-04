import { useState } from 'react'
import { View, Text, ActivityIndicator, ScrollView, Platform, type ViewStyle, type TextStyle } from 'react-native'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar as ExpoStatusBar } from 'expo-status-bar'
import { Wifi, BatteryFull, SignalHigh } from 'lucide-react-native'
import '../global.css'
import { BottomNav } from './components/BottomNav'
import { StoreProvider, useStore } from './store/store'
import { ToastProvider } from './components/Toast'
import { NavProvider, type Overlay } from './nav'
import { themeVars, useThemeName, brand } from './theme'
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
 * On the web preview, present the app inside a centered phone mockup so it reads
 * as the mobile app it is, instead of stretching across the whole browser. On
 * native this is a no-op — the app fills the device as usual.
 */
function WebPreviewFrame({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>
  return (
    <View style={webFrame.page}>
      <View style={webFrame.device}>
        <FauxStatusBar />
        <View style={{ flex: 1 }}>{children}</View>
      </View>
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

const webFrame: { page: ViewStyle; device: ViewStyle; statusBar: ViewStyle; statusTime: TextStyle } = {
  page: {
    flex: 1,
    minHeight: '100%',
    backgroundColor: '#0a0a0b',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  device: {
    width: 402,
    height: 874,
    maxWidth: '100%',
    maxHeight: '100%',
    borderRadius: 48,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 12,
    borderColor: '#0d0d0f',
    // react-native-web maps these shadow props to a CSS box-shadow.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 40 },
    shadowOpacity: 0.55,
    shadowRadius: 80,
  },
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
