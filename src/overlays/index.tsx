import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { View, Text, Pressable, TextInput, Image, ScrollView, Animated, Easing } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { LinearGradient } from 'expo-linear-gradient'
import {
  Bell, Moon, Sun, GraduationCap, Wallet, RotateCcw, Trash2, Camera, Trophy,
  Flame, Search, ScanLine, Plus, Check, Share2, ChevronRight, ChevronLeft, User, Sparkles, Dumbbell,
  Droplet, Footprints, BedDouble, Leaf, Clock, Play, Award, BellRing,
  HeartPulse, Activity, Zap, Minus, X, LogOut, Volume2,
} from 'lucide-react-native'
import { Sheet, EmptyState } from '../components/Sheet'
import { AppModal, DEVICE, IS_WEB } from '../components/WebFrame'
import { IntegrationsSection } from '../components/Integrations'
import { Avatar } from '../components/Avatar'
import { LogoMark } from '../components/Logo'
import { Icon } from '../components/Icon'
import { Chip } from '../components/ui'
import { useStore } from '../store/store'
import { useAuth } from '../auth/AuthProvider'
import { useToast } from '../components/Toast'
import { useNav } from '../nav'
import { FOODS, QUICK_WORKOUTS } from '../data/catalog'
import { pick, makeRng } from '../lib/rng'
import { requestPushPermission, resolveNotifPrefs } from '../lib/notifications'
import { todayKey, relativeLabel, shortDate, fromKey, toKey, addDays, longDate } from '../lib/date'
import {
  fmtWeight, fmtWeightNum, toKg, weightUnit, fmtFluid,
  weightVal,
} from '../lib/format'
import {
  weightStats, workoutsThisWeek, totalVolumeRange, streakStats, todayHabit,
  habitConsistencyWeek, leaderboardSorted, strengthProgress, activitiesInRange,
} from '../store/selectors'
import { ActivityIcon } from '../components/ActivityIcon'
import { examState, dailyTargets } from '../store/training'
import { translator, LANGUAGES, type Language } from '../lib/i18n'
import { shareText } from '../lib/share'
import type { MealName, Units, Theme, NotificationPrefs } from '../store/types'
import { brand, accent } from '../theme'

type Props = { open: boolean; onClose: () => void; params?: Record<string, unknown> }

// New feature sheets live in a sibling file and are surfaced through here.
export * from './extra'

/* ============================ Notifications ============================ */
export function NotificationsSheet({ open, onClose }: Props) {
  const { state, dispatch } = useStore()
  const iconFor: Record<string, ReactNode> = {
    workout: <Dumbbell size={18} color={brand[400]} />,
    nutrition: <Leaf size={18} color={brand[400]} />,
    streak: <Flame size={18} color={brand[400]} />,
    social: <User size={18} color={brand[400]} />,
    challenge: <Trophy size={18} color={brand[400]} />,
    system: <Award size={18} color={brand[400]} />,
  }
  return (
    <Sheet open={open} onClose={onClose} title="Notifications">
      <Pressable onPress={() => dispatch({ type: 'MARK_ALL_READ' })} className="active:opacity-80">
        <Text className="mb-3 text-sm font-semibold text-brand-400">Mark all as read</Text>
      </Pressable>
      <View className="gap-2.5">
        {state.notifications.map((n) => (
          <Pressable
            key={n.id}
            onPress={() => dispatch({ type: 'MARK_NOTIF_READ', id: n.id })}
            className={`w-full flex-row items-start gap-3 rounded-2xl border p-3.5 active:opacity-80 ${n.read ? 'border-white/5 bg-ink-800' : 'border-brand-400/25 bg-brand-400/5'}`}
          >
            <View className="h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5">{iconFor[n.type]}</View>
            <View className="flex-1">
              <View className="flex-row items-center justify-between">
                <Text className="font-bold leading-tight text-white">{n.title}</Text>
                {!n.read && <View className="ml-2 h-2 w-2 shrink-0 rounded-full bg-brand-400" />}
              </View>
              <Text className="text-[13px] text-white/55">{n.body}</Text>
              <Text className="mt-1 text-[11px] text-white/35">{n.time}</Text>
            </View>
          </Pressable>
        ))}
        {state.notifications.length === 0 && (
          <EmptyState icon={<Bell size={32} color="#fff" />} title="All caught up" body="New activity will show up here." />
        )}
      </View>
    </Sheet>
  )
}

/* ============================ Settings ============================ */
/**
 * Every Settings control, with no surface of its own — rendered both inside the
 * SettingsSheet modal and inline in the side menu, so the settings are reachable
 * straight from the menu without a second tap. `visible` drives the
 * reset-on-hide of transient state; `onDone` dismisses the host after a data
 * reset (which drops back to onboarding / the fresh demo).
 */
export function SettingsBody({ visible, onDone }: { visible: boolean; onDone?: () => void }) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const { notificationsEnabled } = state.settings
  const soundEnabled = state.settings.soundEnabled ?? true
  const lang = state.settings.language ?? 'en'
  const t = translator(lang)
  // Two-step inline confirm for the destructive wipe — works on web and native
  // (RN's Alert is a no-op on react-native-web, so a dialog would never show).
  const [confirmingClear, setConfirmingClear] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  useEffect(() => { if (!visible) { setConfirmingClear(false); setLangOpen(false) } }, [visible])
  const currentLang = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0]

  function toggleNotifs() {
    const next = !notificationsEnabled
    dispatch({ type: 'SET_SETTINGS', patch: { notificationsEnabled: next } })
    // Enable → ask permission now (the moment it's relevant) + PushRegistration
    // registers the token. Scheduling/cancelling local reminders is reconciled
    // centrally by <NotificationsSync/>, which reacts to this settings change.
    if (next) void requestPushPermission()
    toast(next ? t('toast.notifsOn') : t('toast.notifsOff'))
  }

  function toggleSound() {
    const next = !soundEnabled
    dispatch({ type: 'SET_SETTINGS', patch: { soundEnabled: next } })
    toast(next ? t('toast.soundOn') : t('toast.soundOff'))
  }

  function setLang(code: Language) {
    dispatch({ type: 'SET_SETTINGS', patch: { language: code } })
    toast(translator(code)('toast.langSet'))
  }

  return (
    <>
      <Group label={t('settings.language')}>
        {/* Collapsed disclosure row (iOS Settings pattern) — opens the full
         *  picker on tap instead of a long always-open grid. */}
        <Pressable
          onPress={() => setLangOpen((v) => !v)}
          className="w-full flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-4 active:opacity-90"
        >
          <View className="min-w-0 flex-1">
            <Text numberOfLines={1} className="font-bold leading-tight text-white" style={currentLang.rtl ? { writingDirection: 'rtl' } : undefined}>{currentLang.native}</Text>
            <Text className="text-[12px] text-white/45">{currentLang.english}</Text>
          </View>
          <ChevronRight size={18} color="rgba(255,255,255,0.4)" style={{ transform: [{ rotate: langOpen ? '90deg' : '0deg' }] }} />
        </Pressable>
        {langOpen && (
          <View className="mt-2 flex-row flex-wrap gap-2">
            {LANGUAGES.map((l) => {
              const active = l.code === lang
              return (
                <Pressable
                  key={l.code}
                  onPress={() => { setLang(l.code); setLangOpen(false) }}
                  className={`flex-row items-center justify-between rounded-2xl border p-3 active:opacity-90 ${active ? 'border-brand-400 bg-brand-400/10' : 'border-white/8 bg-ink-800'}`}
                  style={{ width: '48%' }}
                >
                  <View className="min-w-0 flex-1">
                    <Text numberOfLines={1} className="font-bold leading-tight text-white" style={l.rtl ? { writingDirection: 'rtl' } : undefined}>{l.native}</Text>
                    <Text className="text-[11px] text-white/45">{l.english}</Text>
                  </View>
                  {active && <Check size={16} strokeWidth={3} color={brand[400]} />}
                </Pressable>
              )
            })}
          </View>
        )}
      </Group>

      {/* Connected apps / integrations */}
      <Group label={t('settings.connected')}>
        <IntegrationsSection />
      </Group>

      <Group label={t('settings.preferences')}>
        <Row icon={<BellRing size={18} color={brand[400]} />} title={t('settings.pushNotifs')} sub={t('settings.pushNotifsSub')}>
          <Toggle on={notificationsEnabled} onPress={toggleNotifs} />
        </Row>
        {notificationsEnabled && <NotificationPrefsPanel t={t} />}
        <Row icon={<Volume2 size={18} color={brand[400]} />} title={t('settings.sound')} sub={t('settings.soundSub')}>
          <Toggle on={soundEnabled} onPress={toggleSound} />
        </Row>
      </Group>

      <Group label={t('settings.data')}>
        <Pressable onPress={() => { dispatch({ type: 'RESET_DEMO' }); toast('Demo data restored'); onDone?.() }} className="w-full flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-4 active:opacity-90">
          <RotateCcw size={18} color={brand[400]} />
          <View className="flex-1">
            <Text className="font-bold text-white">{t('settings.resetDemo')}</Text>
            <Text className="text-[12px] text-white/50">{t('settings.resetDemoSub')}</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => {
            if (!confirmingClear) { setConfirmingClear(true); return }
            // Wipe to an empty, un-onboarded state → the app drops straight back
            // into onboarding (Shell renders <Onboarding/> when !profile.onboarded).
            dispatch({ type: 'RESET_EMPTY' })
            setConfirmingClear(false)
            onDone?.()
          }}
          className={`w-full flex-row items-center gap-3 rounded-2xl border p-4 active:opacity-90 ${confirmingClear ? 'border-red-500/60 bg-red-500/15' : 'border-red-500/20 bg-red-500/5'}`}
        >
          <Trash2 size={18} color="#f87171" />
          <View className="flex-1">
            <Text className="font-bold text-red-300">{confirmingClear ? 'Tap again to wipe everything' : t('settings.clear')}</Text>
            <Text className="text-[12px] text-white/50">{confirmingClear ? 'Erases your data and restarts onboarding' : t('settings.clearSub')}</Text>
          </View>
        </Pressable>
      </Group>

      <View className="mt-7 items-center gap-2">
        <LogoMark size={34} />
        <Text className="text-[12px] text-white/30">StrengthHub Online · v1.0</Text>
      </View>
    </>
  )
}

/**
 * Units + appearance — the two quick display toggles, pulled out so they can sit
 * at the very top of the menu for fast access (and reused in the Settings sheet).
 */
export function DisplaySettings() {
  const { state, dispatch } = useStore()
  const { units, theme } = state.settings
  const t = translator(state.settings.language ?? 'en')
  return (
    <>
      <Group label={t('settings.units')}>
        <Segmented<Units>
          value={units}
          options={[{ v: 'metric', l: t('settings.metric') }, { v: 'imperial', l: t('settings.imperial') }]}
          onChange={(v) => dispatch({ type: 'SET_SETTINGS', patch: { units: v } })}
        />
      </Group>

      <Group label={t('settings.appearance')}>
        <Segmented<Theme>
          value={theme}
          options={[{ v: 'dark', l: t('settings.dark'), icon: <Moon size={15} color={theme === 'dark' ? '#000' : 'rgba(255,255,255,0.6)'} /> }, { v: 'light', l: t('settings.light'), icon: <Sun size={15} color={theme === 'light' ? '#000' : 'rgba(255,255,255,0.6)'} /> }]}
          onChange={(v) => dispatch({ type: 'SET_SETTINGS', patch: { theme: v } })}
        />
      </Group>
    </>
  )
}

export function SettingsSheet({ open, onClose }: Props) {
  const { state } = useStore()
  const t = translator(state.settings.language ?? 'en')
  return (
    <Sheet open={open} onClose={onClose} title={t('settings.title')}>
      <DisplaySettings />
      <SettingsBody visible={open} onDone={onClose} />
    </Sheet>
  )
}

/* ============================ Profile ============================ */
/* ===================== Menu (full-screen drawer) ================= */
export function MenuDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state } = useStore()
  const { enabled: authEnabled, signOut } = useAuth()
  const nav = useNav()
  const insets = useSafeAreaInsets()
  const p = state.profile
  const unread = state.notifications.filter((n) => !n.read).length
  const goalLabel: Record<string, string> = { 'build-muscle': 'Build Muscle', 'lose-fat': 'Lose Fat', 'gain-strength': 'Get Stronger', 'stay-healthy': 'Stay Healthy' }
  const joined = fromKey(p.createdAtKey).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  // Push the target as a detail: it slides in from the right over the menu, and
  // its back arrow returns here (see Sheet's menu-detail mode).
  const go = (o: Parameters<typeof nav.open>[0]) => () => nav.openInMenu(o)
  // Close the drawer, then sign out — the auth listener swaps back to the
  // welcome/login flow automatically once the session ends.
  const logout = () => { onClose(); void signOut() }

  // Left-edge drawer: slide the panel in from the left (translateX -width -> 0),
  // matching the web app's `drawer-in`/`drawer-out` animation. Keep the modal
  // mounted through the slide-out so the exit animation can play.
  const [render, setRender] = useState(open)
  const [width, setWidth] = useState<number>(DEVICE.width)
  const progress = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (open) {
      setRender(true)
      Animated.timing(progress, {
        toValue: 1,
        duration: 280,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: !IS_WEB,
      }).start()
    } else if (render) {
      Animated.timing(progress, {
        toValue: 0,
        duration: 240,
        easing: Easing.bezier(0.4, 0, 1, 1),
        useNativeDriver: !IS_WEB,
      }).start(({ finished }) => {
        if (finished) setRender(false)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-width, 0] })

  return (
    <AppModal visible={render} animationType="none" onRequestClose={onClose}>
      <Animated.View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        className="flex-1 bg-ink-900"
        // A flex child defaults to `min-height: auto`, so on web the inner
        // ScrollView grew to its content height and never scrolled — the last
        // rows (Settings / Log out) ended up clipped below the device frame.
        // `minHeight: 0` lets this column shrink to the real (clamped) device
        // height so the ScrollView is bounded and scrolls. Native keeps flex-1.
        style={{ paddingTop: insets.top, transform: [{ translateX }], ...(IS_WEB ? { flex: 1, minHeight: 0 } : null) }}
      >
        <View className="flex-row items-center gap-2 px-3 py-2.5">
          <Pressable onPress={onClose} hitSlop={8} className="h-9 w-9 items-center justify-center rounded-full active:opacity-70">
            <X size={22} color="rgba(255,255,255,0.7)" />
          </Pressable>
          <Text className="text-[17px] font-bold text-white">Menu</Text>
        </View>

        <ScrollView className="flex-1 px-4" style={IS_WEB ? { minHeight: 0 } : undefined} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
          <View className="flex-row items-center gap-4 pt-1">
            <Avatar name={`${p.name} M`} size={64} />
            <View className="min-w-0 flex-1">
              <Text numberOfLines={1} className="text-xl font-extrabold text-white">{p.name} Morgan</Text>
              <Text numberOfLines={1} className="mt-0.5 text-[13px] text-white/50">{p.university} · Age {p.age}</Text>
              <View className="mt-2 flex-row flex-wrap items-center gap-2">
                <View className="rounded-full bg-brand-400/15 px-2.5 py-1"><Text className="text-[11px] font-bold text-brand-400">{goalLabel[p.goal]}</Text></View>
                <Text className="text-[12px] text-white/40">Member since {joined}</Text>
              </View>
            </View>
          </View>

          {/* Quick display toggles up top for fast access. */}
          <View className="mt-6">
            <DisplaySettings />
          </View>

          <MenuSection title="Coaching">
            <MenuRow icon={<Sparkles size={17} color={brand[400]} />} title="Your coach" sub="Daily check-ins and milestones" onPress={go('coach')} first />
            {p.newToGym && <MenuRow icon={<Leaf size={17} color={brand[400]} />} title="New to the gym" sub="Your first 90 days" onPress={go('beginner')} />}
          </MenuSection>

          <MenuSection title="Activity">
            <MenuRow icon={<Sparkles size={17} color={brand[400]} />} title="Weekly recap" sub="Your week in numbers" onPress={go('recap')} first />
            <MenuRow
              icon={<Bell size={17} color={brand[400]} />}
              title="Notifications"
              sub="Reminders, streaks & social"
              onPress={go('notifications')}
              badge={unread > 0 ? <View className="h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-400 px-1.5"><Text className="text-[11px] font-bold text-black">{unread}</Text></View> : undefined}
            />
          </MenuSection>

          {/* Settings opened out inline — no header, so it reads as one continuous
              menu rather than a section you tap into. Each control's own Group
              label carries the structure. */}
          <View className="mt-5">
            <SettingsBody visible={open} onDone={onClose} />
          </View>

          {authEnabled && (
            <Pressable
              onPress={logout}
              className="mt-5 flex-row items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-3.5 active:opacity-80"
            >
              <LogOut size={18} color="#f87171" />
              <Text className="font-semibold text-red-400">Log out</Text>
            </Pressable>
          )}
        </ScrollView>
      </Animated.View>
    </AppModal>
  )
}

function MenuSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="mt-5">
      <Text className="mb-2 px-1 text-[12px] font-bold uppercase tracking-wide text-white/40">{title}</Text>
      <View className="overflow-hidden rounded-2xl border border-white/5 bg-ink-800">{children}</View>
    </View>
  )
}

function MenuRow({ icon, title, sub, onPress, badge, first }: { icon: ReactNode; title: string; sub?: string; onPress: () => void; badge?: ReactNode; first?: boolean }) {
  return (
    <Pressable onPress={onPress} className={`flex-row items-center gap-3 p-3.5 active:opacity-80 ${first ? '' : 'border-t border-white/5'}`}>
      <View className="h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-400/10">{icon}</View>
      <View className="min-w-0 flex-1">
        <Text className="font-semibold text-white">{title}</Text>
        {sub && <Text numberOfLines={1} className="mt-0.5 text-[12px] text-white/45">{sub}</Text>}
      </View>
      {badge}
      <ChevronRight size={18} color="rgba(255,255,255,0.25)" />
    </Pressable>
  )
}

export function ProfileSheet({ open, onClose }: Props) {
  const { state } = useStore()
  const nav = useNav()
  const units = state.settings.units
  const w = weightStats(state)
  const streak = streakStats(state)
  const totalWorkouts = state.sessions.filter((s) => s.completed).length
  const earned = state.badges.filter((b) => b.earned).length
  const goalLabel: Record<string, string> = { 'build-muscle': 'Build Muscle', 'lose-fat': 'Lose Fat', 'gain-strength': 'Get Stronger', 'stay-healthy': 'Stay Healthy' }

  return (
    <Sheet open={open} onClose={onClose} title="Profile">
      <View className="flex-row items-center gap-4">
        <Avatar name={`${state.profile.name} M`} size={64} />
        <View>
          <Text className="text-xl font-extrabold text-white">{state.profile.name} Morgan</Text>
          <Text className="text-[13px] text-white/50">{state.profile.age} · {state.profile.university}</Text>
          <View className="mt-1 flex-row">
            <Chip color="green">{goalLabel[state.profile.goal]}</Chip>
          </View>
        </View>
      </View>

      <Text className="mt-3 text-[13px] text-white/45">{state.profile.dorm} · {state.profile.cohort}</Text>

      <View className="mt-4 flex-row gap-3">
        <Stat label="Workouts" value={String(totalWorkouts)} />
        <Stat label="Day streak" value={`${streak.current}`} />
        <Stat label="Weight" value={fmtWeight(w.current, units, 1)} />
      </View>

      <View className="mt-4 gap-2.5">
        <LinkRow icon={<Sparkles size={18} color={brand[400]} />} title="Your coach" sub="Daily check ins and milestones" onPress={() => nav.open('coach')} />
        <LinkRow icon={<Bell size={18} color={brand[400]} />} title="Notifications" sub="Reminders, streaks & social" onPress={() => nav.open('notifications')} />
        <LinkRow icon={<Award size={18} color={brand[400]} />} title="Badges" sub={`${earned} earned`} onPress={() => nav.open('badges')} />
        <LinkRow icon={<Camera size={18} color={brand[400]} />} title="Progress photos" sub={`${state.photos.length} photos`} onPress={() => nav.open('photos')} />
        <LinkRow icon={<Trophy size={18} color={brand[400]} />} title="Campus leaderboard" sub={state.profile.university} onPress={() => nav.open('leaderboard')} />
        <LinkRow icon={<Sparkles size={18} color={brand[400]} />} title="Weekly recap" sub="Your week in numbers" onPress={() => nav.open('recap')} />
        <LinkRow icon={<GraduationCap size={18} color={brand[400]} />} title="Exam Survival Protocol" sub={state.profile.examMode ? 'On' : 'Off'} onPress={() => nav.open('examMode')} />
        {state.profile.newToGym && <LinkRow icon={<Leaf size={18} color={brand[400]} />} title="New to the gym" sub="Your first 90 days" onPress={() => nav.open('beginner')} />}
        <LinkRow icon={<User size={18} color="rgba(255,255,255,0.7)" />} title="Settings" sub="Units, theme and data" onPress={() => nav.open('settings')} />
      </View>
    </Sheet>
  )
}

/* ============================ Add Food ============================ */
export function AddFoodSheet({ open, onClose, params }: Props) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const [meal, setMeal] = useState<MealName>((params?.meal as MealName) || 'Snack')
  const [q, setQ] = useState('')
  const [budgetOnly, setBudgetOnly] = useState(state.profile.budgetMode)
  const [scanned, setScanned] = useState<string | null>(null)

  const results = useMemo(() => {
    return FOODS.filter((f) => f.name.toLowerCase().includes(q.toLowerCase())).filter((f) => (budgetOnly ? f.budget : true))
  }, [q, budgetOnly])

  function add(foodId: string) {
    const f = FOODS.find((x) => x.id === foodId)!
    dispatch({ type: 'ADD_MEAL', meal: { meal, name: f.name, qty: 1, kcal: f.kcal, p: f.p, c: f.c, f: f.f } })
    toast(`Added to ${meal}`)
    onClose()
  }

  function scan() {
    // simulate a barcode scan resolving to a product
    const f = pick(makeRng(Date.now() % 100000), FOODS.filter((x) => x.barcode))
    setScanned(f.id)
    setQ('')
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add food">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1 mb-3" contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
        {(['Breakfast', 'Lunch', 'Snack', 'Dinner'] as MealName[]).map((m) => (
          <Pressable key={m} onPress={() => setMeal(m)} className={`shrink-0 rounded-full px-4 py-1.5 active:opacity-90 ${meal === m ? 'bg-brand-400' : 'bg-ink-700'}`}>
            <Text className={`text-sm font-semibold ${meal === m ? 'text-black' : 'text-white/60'}`}>{m}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View className="mb-3 flex-row gap-2">
        <View className="flex-1 flex-row items-center gap-2 rounded-xl border border-white/8 bg-ink-800 px-3">
          <Search size={18} color="rgba(255,255,255,0.4)" />
          <TextInput
            value={q}
            onChangeText={(v) => { setQ(v); setScanned(null) }}
            placeholder="Search foods…"
            placeholderTextColor="rgba(148,148,148,0.6)"
            className="flex-1 bg-transparent py-3 text-sm text-white"
          />
        </View>
        <Pressable onPress={scan} className="h-[46px] w-[46px] items-center justify-center rounded-xl bg-brand-400 active:opacity-90">
          <ScanLine size={20} color="#000" />
        </Pressable>
      </View>

      <View className="mb-3 flex-row">
        <Pressable onPress={() => setBudgetOnly((b) => !b)} className={`flex-row items-center gap-1.5 rounded-full px-3 py-1.5 active:opacity-90 ${budgetOnly ? 'bg-brand-400/20' : 'bg-ink-700'}`}>
          <Wallet size={13} color={budgetOnly ? brand[400] : 'rgba(255,255,255,0.55)'} />
          <Text className={`text-xs font-semibold ${budgetOnly ? 'text-brand-400' : 'text-white/55'}`}>Budget meals {budgetOnly ? 'on' : 'off'}</Text>
        </Pressable>
      </View>

      {scanned && (
        <View className="mb-3 rounded-2xl border border-brand-400/30 bg-brand-400/10 p-3">
          <Text className="mb-1 text-[12px] font-semibold text-brand-400">✓ Barcode matched</Text>
          <FoodRow id={scanned} onAdd={add} />
        </View>
      )}

      <View className="gap-2">
        {results.map((f) => (
          <FoodRow key={f.id} id={f.id} onAdd={add} />
        ))}
        {results.length === 0 && <Text className="py-6 text-center text-sm text-white/40">No foods found.</Text>}
      </View>
    </Sheet>
  )
}

function FoodRow({ id, onAdd }: { id: string; onAdd: (id: string) => void }) {
  const f = FOODS.find((x) => x.id === id)!
  return (
    <Pressable onPress={() => onAdd(id)} className="w-full flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-3 active:opacity-90">
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="font-bold leading-tight text-white">{f.name}</Text>
        <Text className="text-[12px] text-white/45">{f.serving} · {f.kcal} kcal · {f.p}P {f.c}C {f.f}F</Text>
      </View>
      {f.budget && <Wallet size={14} color={brand[400]} />}
      <View className="h-7 w-7 items-center justify-center rounded-full bg-brand-400"><Plus size={16} strokeWidth={3} color="#000" /></View>
    </Pressable>
  )
}

/* ============================ Log Weight ============================ */
export function LogWeightSheet({ open, onClose }: Props) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const units = state.settings.units
  const current = weightStats(state).current
  const [val, setVal] = useState(() => fmtWeightNum(current, units, 1))

  function save() {
    const kg = toKg(parseFloat(val) || current, units)
    dispatch({ type: 'LOG_WEIGHT', kg: Math.round(kg * 10) / 10 })
    toast('Weight logged')
    onClose()
  }

  const num = weightVal(current, units)
  return (
    <Sheet open={open} onClose={onClose} title="Log weight">
      <Text className="text-[13px] text-white/50">Today · {relativeLabel(todayKey)}</Text>
      <View className="mt-6 flex-row items-end justify-center gap-2">
        <TextInput
          autoFocus
          keyboardType="decimal-pad"
          value={val}
          onChangeText={(v) => setVal(v.replace(/[^\d.]/g, ''))}
          className="w-40 border-b-2 border-brand-400 bg-transparent pb-2 text-center text-5xl font-extrabold text-white"
        />
        <Text className="pb-3 text-xl font-bold text-white/50">{weightUnit(units)}</Text>
      </View>
      <View className="mt-4 flex-row justify-center gap-2">
        {[-0.5, -0.1, 0.1, 0.5].map((d) => (
          <Pressable key={d} onPress={() => setVal((v) => (Math.round(((parseFloat(v) || num) + d) * 10) / 10).toFixed(1))} className="rounded-full bg-ink-700 px-3 py-1.5 active:opacity-80">
            <Text className="text-sm font-semibold text-white">{d > 0 ? `+${d}` : d}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={save} className="btn-primary mt-8 w-full active:opacity-90">
        <Text className="font-semibold text-black">Save</Text>
      </Pressable>
    </Sheet>
  )
}

/* ============================ Log Habit ============================ */
export function LogHabitSheet({ open, onClose }: Props) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const units = state.settings.units
  const h = todayHabit(state)
  const [steps, setSteps] = useState(h.steps)
  const [sleepH, setSleepH] = useState(h.sleepH)
  const [mindset, setMindset] = useState(h.mindsetMin)

  // Resync to today's values whenever the sheet opens.
  useEffect(() => {
    if (open) { setSteps(h.steps); setSleepH(h.sleepH); setMindset(h.mindsetMin) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function save() {
    dispatch({ type: 'PATCH_TODAY_HABIT', patch: { steps, sleepH, mindsetMin: mindset } })
    toast('Nice work, habits logged 🙌')
    onClose()
  }

  const waterStep = units === 'imperial' ? 8 / 33.814 : 0.25
  return (
    <Sheet open={open} onClose={onClose} title="Log habits">
      <Text className="mb-3 text-[13px] text-white/50">Adjust and log. Done in seconds.</Text>

      <View className="gap-3.5">
        {/* Water: fast tap logger */}
        <View className="rounded-2xl border border-white/5 bg-ink-800 p-4">
          <View className="flex-row items-center gap-2">
            <Droplet size={18} color={brand[400]} />
            <Text className="flex-1 font-bold text-white">Water</Text>
            <Text className="text-2xl font-extrabold text-brand-400">{fmtFluid(h.waterL, units)}</Text>
          </View>
          <View className="mt-3 flex-row gap-2">
            <Pressable onPress={() => dispatch({ type: 'ADJUST_WATER', deltaL: -waterStep })} className="flex-1 items-center rounded-xl bg-ink-700 py-2.5 active:opacity-80">
              <Text className="text-lg font-bold text-white">−</Text>
            </Pressable>
            <Pressable onPress={() => dispatch({ type: 'ADJUST_WATER', deltaL: waterStep })} className="flex-[2] items-center rounded-xl bg-brand-400/20 py-2.5 active:opacity-80">
              <Text className="font-bold text-brand-400">+ {units === 'imperial' ? '8 oz' : '250 ml'}</Text>
            </Pressable>
          </View>
          <Text className="mt-2 text-center text-[12px] text-white/40">Goal {fmtFluid(state.profile.waterTargetL, units)}</Text>
        </View>

        {/* Steps: stepper */}
        <HabitStepper
          icon={<Footprints size={18} color={brand[400]} />} label="Steps"
          value={steps} min={0} max={20000} step={250} onChange={setSteps}
          display={steps.toLocaleString()} minLabel="0" maxLabel="20k"
          goalLabel={`${(state.profile.stepTarget / 1000).toFixed(0)}k`}
        />

        {/* Sleep: stepper */}
        <HabitStepper
          icon={<BedDouble size={18} color={brand[400]} />} label="Sleep"
          value={sleepH} min={0} max={12} step={0.5} onChange={setSleepH}
          display={`${sleepH}`} unit="h" minLabel="0h" maxLabel="12h"
          goalLabel={`${state.profile.sleepTargetH}h`}
        />

        {/* Mindset: quick chips */}
        <View className="rounded-2xl border border-white/5 bg-ink-800 p-4">
          <View className="flex-row items-center gap-2">
            <Leaf size={18} color={brand[400]} />
            <Text className="flex-1 font-bold text-white">Mindset</Text>
            <Text className="text-2xl font-extrabold text-brand-400">{mindset}<Text className="text-[13px] font-semibold text-white/40"> min</Text></Text>
          </View>
          <View className="mt-3 flex-row flex-wrap gap-2">
            {[0, 5, 10, 15, 20, 30, 45].map((m) => (
              <Pressable key={m} onPress={() => setMindset(m)} className={`items-center rounded-xl px-3 py-2 active:opacity-90 ${mindset === m ? 'bg-brand-400' : 'bg-ink-700'}`} style={{ minWidth: 44 }}>
                <Text className={`text-sm font-bold ${mindset === m ? 'text-black' : 'text-white/60'}`}>{m === 0 ? 'None' : m}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <Pressable onPress={save} className="btn-primary mt-6 w-full active:opacity-90">
        <Text className="font-semibold text-black">Save habits</Text>
      </Pressable>
    </Sheet>
  )
}

/* RN has no range input — emulate the web ruler slider with a labelled
 * +/- stepper that keeps the same value/min/max/step contract. */
function HabitStepper({ icon, label, value, min, max, step, onChange, display, unit, minLabel, maxLabel, goalLabel }: {
  icon: ReactNode; label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void
  display: string; unit?: string; minLabel: string; maxLabel: string; goalLabel?: string
}) {
  const round = (n: number) => Math.round(n / step) * step
  const dec = (s: number) => onChange(Math.max(min, round(value - s)))
  const inc = (s: number) => onChange(Math.min(max, round(value + s)))
  return (
    <View className="rounded-2xl border border-white/5 bg-ink-800 p-4">
      <View className="flex-row items-center gap-2">
        {icon}
        <Text className="flex-1 font-bold text-white">{label}</Text>
        <Text className="text-2xl font-extrabold text-brand-400">{display}{unit && <Text className="text-[13px] font-semibold text-white/40"> {unit}</Text>}</Text>
      </View>
      <View className="mt-3 flex-row items-center gap-2">
        <Pressable onPress={() => dec(step)} className="h-11 w-11 items-center justify-center rounded-xl bg-ink-700 active:opacity-80">
          <Minus size={18} color="#fff" />
        </Pressable>
        <Pressable onPress={() => dec(step * 4)} className="flex-1 items-center rounded-xl bg-ink-700 py-3 active:opacity-80">
          <Text className="text-sm font-bold text-white/60">− {step * 4 >= 1000 ? `${step * 4 / 1000}k` : step * 4}</Text>
        </Pressable>
        <Pressable onPress={() => inc(step * 4)} className="flex-1 items-center rounded-xl bg-brand-400/20 py-3 active:opacity-80">
          <Text className="text-sm font-bold text-brand-400">+ {step * 4 >= 1000 ? `${step * 4 / 1000}k` : step * 4}</Text>
        </Pressable>
        <Pressable onPress={() => inc(step)} className="h-11 w-11 items-center justify-center rounded-xl bg-brand-400/20 active:opacity-80">
          <Plus size={18} color={brand[400]} />
        </Pressable>
      </View>
      <View className="mt-1.5 flex-row items-center justify-between">
        <Text className="text-[11px] text-white/35">{minLabel}</Text>
        {goalLabel && <Text className="text-[11px] font-semibold text-brand-400/80">Goal {goalLabel}</Text>}
        <Text className="text-[11px] text-white/35">{maxLabel}</Text>
      </View>
    </View>
  )
}

/* ============================ Create Post ============================ */
export function CreatePostSheet({ open, onClose }: Props) {
  const { dispatch } = useStore()
  const toast = useToast()
  const [text, setText] = useState('')
  const [image, setImage] = useState<string | undefined>()

  async function pickImage() {
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.6 })
    if (!res.canceled) setImage(res.assets[0].uri)
  }

  function post() {
    if (!text.trim()) return
    dispatch({ type: 'ADD_POST', text: text.trim(), image })
    toast('Posted to your campus feed')
    setText(''); setImage(undefined)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Create a post">
      <TextInput
        autoFocus
        multiline
        value={text}
        onChangeText={setText}
        placeholder="Share a win, a PR, a meal, or some motivation…"
        placeholderTextColor="rgba(148,148,148,0.6)"
        className="w-full rounded-2xl border border-white/8 bg-ink-800 p-4 text-[15px] text-white"
        style={{ minHeight: 112, textAlignVertical: 'top' }}
      />
      {image && <Image source={{ uri: image }} resizeMode="cover" className="mt-3 h-48 w-full rounded-2xl" />}
      <View className="mt-3 flex-row items-center gap-2">
        <Pressable onPress={pickImage} className="flex-row items-center gap-2 rounded-full bg-ink-700 px-4 py-2 active:opacity-80">
          <Camera size={16} color="#fff" />
          <Text className="text-sm font-semibold text-white">{image ? 'Change photo' : 'Add photo'}</Text>
        </Pressable>
      </View>
      <Pressable onPress={post} disabled={!text.trim()} className={`btn-primary mt-6 w-full active:opacity-90 ${!text.trim() ? 'opacity-40' : ''}`}>
        <Text className="font-semibold text-black">Post</Text>
      </Pressable>
    </Sheet>
  )
}

/* ============================ Weekly Recap ============================ */
export function WeeklyRecapSheet({ open, onClose }: Props) {
  const { state } = useStore()
  const toast = useToast()
  const units = state.settings.units
  const workouts = workoutsThisWeek(state)
  const vol = totalVolumeRange(state, 7)
  const streak = streakStats(state)
  const hc = habitConsistencyWeek(state)
  const w = weightStats(state)
  const top = strengthProgress(state)[0]
  const acts = activitiesInRange(state, 7)

  async function share() {
    const msg = `My week on StrengthHub 💪 ${workouts} workouts, a ${streak.current}-day streak, ${Math.round(weightVal(vol, units)).toLocaleString()} ${weightUnit(units)} lifted.`
    const r = await shareText(msg, 'My week on StrengthHub')
    toast(r === 'copied' ? 'Recap copied to clipboard' : r === 'shared' ? 'Recap shared' : 'Sharing not available')
  }

  return (
    <Sheet open={open} onClose={onClose} title="Your week">
      <LinearGradient colors={['#5cba36', brand[400]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 24, padding: 20 }}>
        <Text className="text-sm font-bold text-black/80">THIS WEEK</Text>
        <Text className="mt-1 text-4xl font-extrabold text-black">{workouts} workouts</Text>
        <Text className="font-semibold text-black/80">{streak.current}-day streak · top 20% of users</Text>
        <View className="mt-4 flex-row flex-wrap gap-3">
          <RecapStat label="Volume lifted" value={`${Math.round(weightVal(vol, units)).toLocaleString()} ${weightUnit(units)}`} />
          <RecapStat label="Avg sleep" value={`${hc.avgSleep.toFixed(1)} h`} />
          <RecapStat label="Avg steps" value={hc.avgSteps.toLocaleString()} />
          <RecapStat label="Weight change" value={fmtWeight(Math.abs(w.delta), units, 1)} />
        </View>
      </LinearGradient>

      {top && (
        <View className="mt-4 flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-4">
          <Sparkles size={22} color={brand[400]} />
          <Text className="flex-1 text-[14px] text-white">
            Biggest gain: <Text className="font-bold">{top.name}</Text> up{' '}
            <Text className="font-bold text-brand-400">{top.pct}%</Text> in 4 weeks.
          </Text>
        </View>
      )}

      {acts.length > 0 && (
        <View className="mt-3 rounded-2xl border border-white/5 bg-ink-800 p-4">
          <Text className="mb-2.5 text-[12px] font-bold uppercase tracking-wide text-white/40">Other activities · {acts.length}</Text>
          <View className="gap-2">
            {acts.slice(0, 6).map((a) => (
              <View key={a.id} className="flex-row items-center gap-2.5">
                <ActivityIcon name={a.icon} size={16} color={brand[400]} />
                <Text className="flex-1 text-[13px] text-white/75">{a.name}</Text>
                {a.weekly && <View className="rounded-full bg-brand-400/15 px-1.5 py-0.5"><Text className="text-[10px] font-bold text-brand-300">Weekly</Text></View>}
                <Text className="text-[12px] text-white/45">{a.minutes} min</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <Pressable onPress={share} className="btn-primary mt-5 w-full flex-row items-center justify-center gap-2 active:opacity-90">
        <Share2 size={16} color="#000" />
        <Text className="font-semibold text-black">Share recap</Text>
      </Pressable>
    </Sheet>
  )
}

function RecapStat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-2xl bg-black/10 p-3" style={{ minWidth: '45%' }}>
      <Text className="text-[12px] font-semibold text-black/70">{label}</Text>
      <Text className="text-lg font-extrabold text-black">{value}</Text>
    </View>
  )
}

/* ============================ Leaderboard ============================ */
export function LeaderboardSheet({ open, onClose }: Props) {
  const { state } = useStore()
  const toast = useToast()
  const rows = leaderboardSorted(state)
  return (
    <Sheet open={open} onClose={onClose} title="Friends leaderboard">
      <Text className="mb-3 text-[13px] text-white/50">This month · {state.profile.university}</Text>
      <View className="gap-2">
        {rows.map((u, i) => (
          <View key={u.id} className={`flex-row items-center gap-3 rounded-2xl border p-3 ${u.isYou ? 'border-brand-400/40 bg-brand-400/10' : 'border-white/5 bg-ink-800'}`}>
            <Text className={`w-6 text-center text-sm font-extrabold ${i < 3 ? 'text-brand-400' : 'text-white/40'}`}>{i + 1}</Text>
            <Avatar name={u.name} size={38} />
            <View className="flex-1">
              <Text className="font-bold leading-tight text-white">{u.name}</Text>
              <Text className="text-[12px] text-white/45">{u.workouts} workouts · {u.streak} day streak</Text>
            </View>
            <Text className="font-extrabold text-brand-400">{u.points.toLocaleString()}</Text>
          </View>
        ))}
      </View>
      <Pressable
        onPress={async () => {
          const r = await shareText('Join me on StrengthHub — train together and climb the campus leaderboard.', 'StrengthHub')
          toast(r === 'copied' ? 'Invite copied to clipboard' : r === 'shared' ? 'Invite shared' : 'Sharing not available')
        }}
        className="btn-primary mt-5 w-full flex-row items-center justify-center gap-2 active:opacity-90"
      >
        <Plus size={16} color="#000" />
        <Text className="font-semibold text-black">Invite friends</Text>
      </Pressable>
    </Sheet>
  )
}

/* ============================ Progress Photos ============================ */
export function PhotosSheet({ open, onClose }: Props) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const photos = [...state.photos].sort((a, b) => b.dateKey.localeCompare(a.dateKey))

  async function addPhoto() {
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.6 })
    if (!res.canceled) { dispatch({ type: 'ADD_PHOTO', dataUrl: res.assets[0].uri }); toast('Photo added') }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Progress photos">
      <Pressable onPress={addPhoto} className="btn-primary mb-4 w-full flex-row items-center justify-center gap-2 active:opacity-90">
        <Camera size={16} color="#000" />
        <Text className="font-semibold text-black">Add today's photo</Text>
      </Pressable>
      {photos.length === 0 ? (
        <EmptyState icon={<Camera size={32} color="#fff" />} title="No photos yet" body="Snap a photo to track your visual progress over time." />
      ) : (
        <>
          {photos.length >= 2 && (
            <View className="mb-5">
              <Text className="mb-2 text-[12px] font-bold uppercase tracking-wide text-white/40">Before &amp; after</Text>
              <CompareSlider before={photos[photos.length - 1]} after={photos[0]} />
            </View>
          )}
          <Text className="mb-2 text-[12px] font-bold uppercase tracking-wide text-white/40">All photos</Text>
          <View className="flex-row flex-wrap gap-3">
            {photos.map((p) => (
              <View key={p.id} className="overflow-hidden rounded-2xl border border-white/5 bg-ink-800" style={{ width: '47%' }}>
                <Image source={{ uri: p.dataUrl }} resizeMode="cover" style={{ width: '100%', aspectRatio: 3 / 4 }} />
                <View className="p-2.5">
                  <Text className="text-[12px] font-bold text-white">{shortDate(p.dateKey)}</Text>
                  {p.note && <Text className="text-[11px] text-white/45">{p.note}</Text>}
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </Sheet>
  )
}

/* Web uses an <input type=range> with clipPath to wipe between two photos.
 * RN has no range input, so we drive the reveal with a +/- stepper that
 * clips the "after" image by width over the same 0–100% range. */
function CompareSlider({ before, after }: { before: { dataUrl: string; dateKey: string }; after: { dataUrl: string; dateKey: string } }) {
  const [pct, setPct] = useState(50)
  const [w, setW] = useState(0)
  return (
    <View>
      <View
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        className="relative overflow-hidden rounded-2xl border border-white/5"
        style={{ width: '100%', aspectRatio: 3 / 4 }}
      >
        <Image source={{ uri: before.dataUrl }} resizeMode="cover" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
        <View style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${pct}%`, overflow: 'hidden' }}>
          <Image source={{ uri: after.dataUrl }} resizeMode="cover" style={{ width: w, height: '100%' }} />
        </View>
        {w > 0 && <View style={{ position: 'absolute', top: 0, bottom: 0, width: 2, left: (pct / 100) * w, backgroundColor: 'rgba(255,255,255,0.8)' }} />}
        <View className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5"><Text className="text-[10px] font-bold text-white">After · {shortDate(after.dateKey)}</Text></View>
        <View className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5"><Text className="text-[10px] font-bold text-white">Before · {shortDate(before.dateKey)}</Text></View>
      </View>
      <View className="mt-3 flex-row items-center gap-2">
        <Pressable onPress={() => setPct((p) => Math.max(0, p - 10))} className="h-10 w-10 items-center justify-center rounded-xl bg-ink-700 active:opacity-80">
          <Minus size={18} color="#fff" />
        </Pressable>
        <View className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
          <View className="h-full rounded-full bg-brand-400" style={{ width: `${pct}%` }} />
        </View>
        <Pressable onPress={() => setPct((p) => Math.min(100, p + 10))} className="h-10 w-10 items-center justify-center rounded-xl bg-ink-700 active:opacity-80">
          <Plus size={18} color="#fff" />
        </Pressable>
      </View>
    </View>
  )
}

/* ============================ Quick Workouts ============================ */
export function QuickWorkoutsSheet({ open, onClose }: Props) {
  const toast = useToast()
  return (
    <Sheet open={open} onClose={onClose} title="Got 15 minutes?">
      <Text className="mb-3 text-[13px] text-white/50">Express sessions for between lectures. No gym needed.</Text>
      <View className="gap-3">
        {QUICK_WORKOUTS.map((q) => (
          <View key={q.id} className="rounded-2xl border border-white/5 bg-ink-800 p-4">
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-xl bg-brand-400/15"><Clock size={20} color={brand[400]} /></View>
              <View className="flex-1">
                <Text className="font-bold leading-tight text-white">{q.name}</Text>
                <Text className="text-[12px] text-white/45">{q.minutes} min · {q.focus}</Text>
              </View>
              <Pressable onPress={() => { toast(`Started: ${q.name}`); onClose() }} className="flex-row items-center gap-1 rounded-full bg-brand-400 px-3.5 py-1.5 active:opacity-90">
                <Play size={14} color="#000" fill="#000" />
                <Text className="text-sm font-bold text-black">Start</Text>
              </Pressable>
            </View>
            <View className="mt-3 flex-row flex-wrap gap-1.5">
              {q.exercises.map((e) => (
                <View key={e} className="rounded-full bg-white/5 px-2.5 py-1">
                  <Text className="text-[11px] text-white/55">{e}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </Sheet>
  )
}

/* ============================ Badges ============================ */
export function BadgesSheet({ open, onClose }: Props) {
  const { state } = useStore()
  const earned = state.badges.filter((b) => b.earned).length
  return (
    <Sheet open={open} onClose={onClose} title={`Badges · ${earned}/${state.badges.length}`}>
      <View className="flex-row flex-wrap gap-3">
        {state.badges.map((b) => (
          <View key={b.id} className={`items-center rounded-2xl border p-3 ${b.earned ? 'border-brand-400/30 bg-brand-400/8' : 'border-white/5 bg-ink-800 opacity-50'}`} style={{ width: '30%' }}>
            <View className={`h-12 w-12 items-center justify-center rounded-full ${b.earned ? 'bg-brand-400/20' : 'bg-white/5'}`}>
              <Icon name={b.icon} size={22} color={b.earned ? '#7ED957' : '#888'} />
            </View>
            <Text className="mt-2 text-center text-[12px] font-bold leading-tight text-white">{b.name}</Text>
            <Text className="mt-0.5 text-center text-[10px] text-white/45">{b.desc}</Text>
            {b.earned && b.earnedDateKey && <Text className="mt-1 text-[9px] font-semibold text-brand-400">{shortDate(b.earnedDateKey)}</Text>}
          </View>
        ))}
      </View>
    </Sheet>
  )
}

/* ============================ Exam Mode ============================ */
export function ExamModeSheet({ open, onClose }: Props) {
  const { state, dispatch } = useStore()
  const t = dailyTargets(state)
  const p = state.profile
  const ex = examState(state)

  // Live, sorted list of exam dates. Legacy single-window users are expanded to
  // individual days once, so nothing is lost the first time they edit.
  const dates = useMemo(() => {
    if (p.examDates && p.examDates.length) return [...p.examDates].sort()
    if (p.examStartKey && p.examEndKey) return rangeKeys(p.examStartKey, p.examEndKey)
    return []
  }, [p.examDates, p.examStartKey, p.examEndKey])
  const on = dates.length > 0

  // Every edit persists immediately (SET_EXAM_DATES_LIST keeps start/end in sync).
  const commit = (next: string[]) => dispatch({ type: 'SET_EXAM_DATES_LIST', dateKeys: next })
  const toggle = (key: string) => commit(dates.includes(key) ? dates.filter((k) => k !== key) : [...dates, key])
  const remove = (key: string) => commit(dates.filter((k) => k !== key))

  const phaseLabel: Record<string, string> = {
    none: 'Not in your exam window yet',
    approaching: ex.daysUntil ? `Exams start in ${ex.daysUntil} days` : 'Exams approaching',
    during: ex.daysLeft != null ? `${ex.daysLeft} days of exams left` : 'In your exam window',
    recovering: 'Exams done, ramping back up',
  }

  return (
    <Sheet open={open} onClose={onClose} title="Exam Survival Protocol">
      <View className="rounded-3xl border border-accent-purple/25 bg-accent-purple/10 p-5">
        <GraduationCap size={30} color={accent.purple} />
        <Text className="mt-2 text-xl font-extrabold tracking-tight text-white">Train through exam season</Text>
        <Text className="mt-1 text-[14px] leading-snug text-white/60">Tap the days you have exams. I'll quietly adjust your plan so training supports your studying instead of competing with it.</Text>
      </View>

      <Text className="mb-2 mt-5 text-[12px] font-bold uppercase tracking-wide text-white/40">Pick your exam dates</Text>
      <MonthCalendar selected={dates} onToggle={toggle} minKey={todayKey} />

      <Text className="mb-2 mt-5 text-[12px] font-bold uppercase tracking-wide text-white/40">
        {on ? `Your exam dates · ${dates.length}` : 'Your exam dates'}
      </Text>
      {on ? (
        <View className="gap-2">
          {dates.map((k) => {
            const until = Math.round((fromKey(k).getTime() - fromKey(todayKey).getTime()) / 86400000)
            const when = until <= 0 ? 'Today' : until === 1 ? 'Tomorrow' : `in ${until} days`
            return (
              <View key={k} className="flex-row items-center gap-3 rounded-2xl border border-white/8 bg-ink-800 p-3.5">
                <View className="h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-purple/15"><GraduationCap size={17} color={accent.purple} /></View>
                <View className="flex-1">
                  <Text className="font-semibold text-white">{longDate(k)}</Text>
                  <Text className="text-[12px] text-white/45">{when}</Text>
                </View>
                <Pressable onPress={() => remove(k)} hitSlop={8} accessibilityLabel={`Remove ${longDate(k)}`} className="h-8 w-8 items-center justify-center rounded-full bg-white/8 active:opacity-70">
                  <X size={16} color="rgba(255,255,255,0.6)" />
                </Pressable>
              </View>
            )
          })}
        </View>
      ) : (
        <View className="items-center rounded-2xl border border-dashed border-white/12 px-5 py-6">
          <Text className="text-center text-[13px] text-white/45">No exam dates yet. Tap the days above to add them.</Text>
        </View>
      )}

      {on && <Text className="mt-3 text-center text-[13px] font-semibold text-accent-purple">{phaseLabel[ex.phase]}</Text>}

      <Text className="mb-2 mt-5 text-[12px] font-bold uppercase tracking-wide text-white/40">While exams are on</Text>
      <View className="gap-2.5">
        <AdaptRow label="Sessions" value="Trimmed to your 3 key lifts" />
        <AdaptRow label="Calories" value={`${t.adjusted ? t.calorie.toLocaleString() : (p.calorieTarget + (p.goal === 'build-muscle' ? -250 : 0)).toLocaleString()} kcal, toward maintenance`} />
        <AdaptRow label="Sleep target" value={`${Math.min(9, p.sleepTargetH + 0.5)} hours, prioritised`} />
        <AdaptRow label="Step target" value={`${Math.round(p.stepTarget * 0.7).toLocaleString()}, eased off`} />
      </View>

      {on && (
        <Pressable onPress={() => { commit([]); onClose() }} className="mt-5 w-full flex-row items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 py-3.5 active:opacity-80">
          <Trash2 size={17} color="#f87171" />
          <Text className="text-sm font-semibold text-red-400">Clear all exam dates</Text>
        </Pressable>
      )}
    </Sheet>
  )
}

/** All date keys from start to end inclusive (used to migrate a legacy window). */
function rangeKeys(startKey: string, endKey: string): string[] {
  const out: string[] = []
  let d = fromKey(startKey)
  const end = fromKey(endKey)
  while (d.getTime() <= end.getTime()) { out.push(toKey(d)); d = addDays(d, 1) }
  return out
}

const CAL_WD = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

/** A tap-to-toggle month calendar. Past days are disabled; selected days fill purple. */
function MonthCalendar({ selected, onToggle, minKey }: { selected: string[]; onToggle: (key: string) => void; minKey: string }) {
  const today = fromKey(todayKey)
  const [ym, setYm] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const sel = new Set(selected)
  const first = new Date(ym.y, ym.m, 1)
  const startDow = (first.getDay() + 6) % 7 // Monday = 0
  const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate()
  const cells: (string | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(toKey(new Date(ym.y, ym.m, d)))
  while (cells.length % 7 !== 0) cells.push(null)
  const monthLabel = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  // Don't let the user page back before the current month (all past days anyway).
  const atFirst = ym.y === today.getFullYear() && ym.m === today.getMonth()
  const prev = () => { if (!atFirst) setYm((a) => (a.m === 0 ? { y: a.y - 1, m: 11 } : { y: a.y, m: a.m - 1 })) }
  const next = () => setYm((a) => (a.m === 11 ? { y: a.y + 1, m: 0 } : { y: a.y, m: a.m + 1 }))

  return (
    <View className="rounded-2xl border border-white/8 bg-ink-800 p-3">
      <View className="mb-2 flex-row items-center justify-between px-1">
        <Pressable onPress={prev} disabled={atFirst} hitSlop={8} className={`h-8 w-8 items-center justify-center rounded-full ${atFirst ? 'opacity-25' : 'active:opacity-60'}`}>
          <ChevronLeft size={20} color="rgba(255,255,255,0.7)" />
        </Pressable>
        <Text className="text-[15px] font-bold text-white">{monthLabel}</Text>
        <Pressable onPress={next} hitSlop={8} className="h-8 w-8 items-center justify-center rounded-full active:opacity-60">
          <ChevronRight size={20} color="rgba(255,255,255,0.7)" />
        </Pressable>
      </View>
      <View className="flex-row">
        {CAL_WD.map((w) => (
          <View key={w} style={{ width: `${100 / 7}%` }} className="items-center py-1"><Text className="text-[11px] font-bold text-white/35">{w}</Text></View>
        ))}
      </View>
      <View className="flex-row flex-wrap">
        {cells.map((key, i) => {
          if (!key) return <View key={i} style={{ width: `${100 / 7}%`, height: 42 }} />
          const past = key < minKey
          const isSel = sel.has(key)
          const isToday = key === todayKey
          return (
            <View key={i} style={{ width: `${100 / 7}%`, height: 42, padding: 3 }}>
              <Pressable
                onPress={() => onToggle(key)}
                disabled={past}
                className={`flex-1 items-center justify-center rounded-xl ${isSel ? 'bg-accent-purple' : isToday ? 'border border-accent-purple/50' : ''} ${past ? 'opacity-20' : 'active:opacity-60'}`}
              >
                <Text className={`text-[13px] ${isSel ? 'font-bold text-white' : 'font-semibold text-white/80'}`}>{fromKey(key).getDate()}</Text>
              </Pressable>
            </View>
          )
        })}
      </View>
    </View>
  )
}

function AdaptRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center gap-2.5 rounded-xl border border-white/5 bg-ink-800 p-3">
      <Check size={16} color={brand[400]} />
      <Text className="text-[14px] text-white/55">{label}</Text>
      <Text className="ml-auto text-right text-[14px] font-semibold text-white">{value}</Text>
    </View>
  )
}

/* ============================ shared bits ============================ */
function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="mb-5">
      <Text className="mb-2 text-[12px] font-bold uppercase tracking-wide text-white/40">{label}</Text>
      <View className="gap-2.5">{children}</View>
    </View>
  )
}

function Row({ icon, title, sub, children }: { icon: ReactNode; title: string; sub: string; children: ReactNode }) {
  return (
    <View className="flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-4">
      <View className="h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5">{icon}</View>
      <View className="flex-1">
        <Text className="font-bold leading-tight text-white">{title}</Text>
        <Text className="text-[12px] text-white/50">{sub}</Text>
      </View>
      {children}
    </View>
  )
}

function LinkRow({ icon, title, sub, onPress }: { icon: ReactNode; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="w-full flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-4 active:opacity-90">
      <View className="h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5">{icon}</View>
      <View className="flex-1">
        <Text className="font-bold leading-tight text-white">{title}</Text>
        <Text className="text-[12px] text-white/50">{sub}</Text>
      </View>
      <ChevronRight size={18} color="rgba(255,255,255,0.3)" />
    </Pressable>
  )
}

function Toggle({ on, onPress }: { on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className={`relative h-7 w-12 rounded-full active:opacity-90 ${on ? 'bg-brand-400' : 'bg-white/15'}`}>
      <View className="absolute top-0.5 h-6 w-6 rounded-full bg-white" style={{ left: on ? 22 : 2 }} />
    </Pressable>
  )
}

/* 12-hour label for an hour-of-day (times aren't localised — numerals read fine). */
function fmtHour(h: number): string {
  const hr = h % 12 === 0 ? 12 : h % 12
  return `${hr} ${h < 12 ? 'AM' : 'PM'}`
}

/** Notification categories, reminder time and quiet hours (#1 Phase 0/1). */
function NotificationPrefsPanel({ t }: { t: (k: string) => string }) {
  const { state, dispatch } = useStore()
  const prefs = resolveNotifPrefs(state.settings.notificationPrefs)
  const set = (patch: Partial<NotificationPrefs>) =>
    dispatch({ type: 'SET_SETTINGS', patch: { notificationPrefs: { ...prefs, ...patch } } })
  const TIME_PRESETS = [7, 12, 17, 20]

  return (
    <View className="gap-2.5 rounded-2xl border border-white/5 bg-ink-800/60 p-3.5">
      <Text className="text-[11px] font-bold uppercase tracking-wide text-white/40">{t('notif.deliver')}</Text>
      <Row icon={<Dumbbell size={18} color={brand[400]} />} title={t('notif.workout')} sub={t('notif.workoutSub')}>
        <Toggle on={prefs.workoutReminder} onPress={() => set({ workoutReminder: !prefs.workoutReminder })} />
      </Row>
      <Row icon={<Flame size={18} color={brand[400]} />} title={t('notif.streak')} sub={t('notif.streakSub')}>
        <Toggle on={prefs.streakReminder} onPress={() => set({ streakReminder: !prefs.streakReminder })} />
      </Row>

      <Text className="mt-1 text-[11px] font-bold uppercase tracking-wide text-white/40">{t('notif.time')}</Text>
      <View className="flex-row gap-2">
        {TIME_PRESETS.map((h) => {
          const on = prefs.reminderHour === h
          return (
            <Pressable key={h} onPress={() => set({ reminderHour: h })} className={`flex-1 items-center rounded-xl py-2.5 active:opacity-90 ${on ? 'bg-brand-400' : 'bg-ink-700'}`}>
              <Text className={`text-[13px] font-bold ${on ? 'text-black' : 'text-white/60'}`}>{fmtHour(h)}</Text>
            </Pressable>
          )
        })}
      </View>

      <View className="mt-1">
        <Row icon={<Moon size={18} color={accent.purple} />} title={t('notif.quiet')} sub={t('notif.quietSub')}>
          <Toggle on={prefs.quiet} onPress={() => set({ quiet: !prefs.quiet })} />
        </Row>
      </View>
      {prefs.quiet && (
        <View className="flex-row gap-2.5">
          <HourStepper label={t('notif.from')} value={prefs.quietStartHour} onChange={(v) => set({ quietStartHour: v })} />
          <HourStepper label={t('notif.to')} value={prefs.quietEndHour} onChange={(v) => set({ quietEndHour: v })} />
        </View>
      )}
    </View>
  )
}

function HourStepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <View className="flex-1 rounded-xl border border-white/8 bg-ink-900 p-2.5">
      <Text className="mb-1.5 text-[11px] font-semibold text-white/45">{label}</Text>
      <View className="flex-row items-center justify-between">
        <Pressable onPress={() => onChange((value + 23) % 24)} className="h-8 w-8 items-center justify-center rounded-lg bg-ink-700 active:opacity-80"><Minus size={15} color="#fff" /></Pressable>
        <Text className="text-[14px] font-extrabold text-white">{fmtHour(value)}</Text>
        <Pressable onPress={() => onChange((value + 1) % 24)} className="h-8 w-8 items-center justify-center rounded-lg bg-brand-400/20 active:opacity-80"><Plus size={15} color={brand[400]} /></Pressable>
      </View>
    </View>
  )
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { v: T; l: string; icon?: ReactNode }[]; onChange: (v: T) => void }) {
  const n = options.length
  const idx = Math.max(0, options.findIndex((o) => o.v === value))
  const [w, setW] = useState(0)
  // Slide the highlight pill between options instead of hard-swapping the
  // background, so switching units/theme reads as one smooth motion.
  const anim = useRef(new Animated.Value(idx)).current
  useEffect(() => {
    Animated.timing(anim, { toValue: idx, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: !IS_WEB }).start()
  }, [idx, anim])

  const PAD = 4, GAP = 4
  const itemW = w > 0 ? (w - PAD * 2 - GAP * (n - 1)) / n : 0
  const translateX = anim.interpolate({
    inputRange: options.map((_, i) => i),
    outputRange: options.map((_, i) => PAD + i * (itemW + GAP)),
  })

  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} className="relative flex-row gap-1 rounded-xl bg-ink-700 p-1">
      {itemW > 0 && (
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', top: PAD, bottom: PAD, left: 0, width: itemW, borderRadius: 8, backgroundColor: brand[400], transform: [{ translateX }] }}
        />
      )}
      {options.map((o) => (
        <Pressable key={o.v} onPress={() => onChange(o.v)} className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg py-2.5 active:opacity-90">
          {o.icon}
          <Text className={`text-sm font-semibold ${value === o.v ? 'text-black' : 'text-white/60'}`}>{o.l}</Text>
        </Pressable>
      ))}
    </View>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-2xl border border-white/5 bg-ink-800 p-3">
      <Text className="text-lg font-extrabold text-white">{value}</Text>
      <Text className="text-[11px] text-white/45">{label}</Text>
    </View>
  )
}
