import { useState } from 'react'
import { View, ActivityIndicator, ScrollView } from 'react-native'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar as ExpoStatusBar } from 'expo-status-bar'
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
  ProfileSheet,
  AddFoodSheet,
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

  const nav = {
    open: (o: Overlay, p: Record<string, unknown> = {}) => {
      setParams(p)
      setOverlay(o)
    },
    close: () => setOverlay(null),
    goTab: (t: TabKey) => {
      setOverlay(null)
      setTab(t)
    },
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
      <ProfileSheet open={overlay === 'profile'} onClose={nav.close} />
      <AddFoodSheet open={overlay === 'addFood'} onClose={nav.close} params={params} />
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

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <ThemedRoot />
      </StoreProvider>
    </SafeAreaProvider>
  )
}
