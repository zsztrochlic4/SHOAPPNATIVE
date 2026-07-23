import { useEffect, useRef, useState, type ReactNode } from 'react'
import { View, Text, Pressable, Image, Animated, Easing, Platform, ScrollView, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, G } from 'react-native-svg'
import { Menu, MessageCircle, Clock, Play, GraduationCap, ChevronRight, Leaf, Check, Flame, ChevronDown, Info, ArrowRight, X } from 'lucide-react-native'
import { Icon } from '../components/Icon'
import { ActivityIcon } from '../components/ActivityIcon'
import { Card, ProgressRing } from '../components/ui'
import { AppModal, IS_WEB, WEB_SCREEN } from '../components/WebFrame'
import { PressableScale } from '../components/PressableScale'
import { Hero } from '../components/Hero'
import { IndexGauge } from '../components/IndexGauge'
import { useStore } from '../store/store'
import { useNav } from '../nav'
import { currentWeekKeys, todayKey, longDate, shortDate, fromKey, currentHour } from '../lib/date'
import { fmtFluid, fmtWeightNum, weightUnit, fmtVolume } from '../lib/format'
import {
  todayHabit, habitForDay, todaySession, sessionForDay, activitiesForDay,
  unreadChat, streakStats, foodReviewForDay, weeklyIndex, nutritionTagsForDay,
  workoutStartedForDay,
} from '../store/selectors'
import { tagById, type TagTone } from '../data/nutrition'
import { dashboardStatIds, statById } from '../lib/metrics'
import { dailyTargets, examState } from '../store/training'
import { Wordmark } from '../components/Logo'
import { brand, accent, useColors } from '../theme'

const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const FULL_WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function greetingFor(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

// Tone → real colour (RN can't use the web's inline CSS variables).
function toneColor(tone: TagTone, c: ReturnType<typeof useColors>): string {
  if (tone === 'good') return c.brand400
  if (tone === 'neutral') return c.accentOrange
  return c.danger
}

/**
 * A single row in the "Today's progress" checklist. `measure` goals (steps,
 * sleep, water) carry a target + a store patch, so the update sheet can nudge
 * them with a stepper and the row can read "7,632 / 10,000". `auto` goals
 * (nutrition check-in, workout) are derived from what the user did elsewhere in
 * the app — they can't be ticked here, only jumped to.
 */
type Goal = {
  id: string
  icon: string
  tile: string // tint colour for the icon tile (and its 15% background)
  label: string
  done: boolean
} & (
  | { kind: 'measure'; value: number; target: number; step: number; fmt: (v: number) => string; patch: (v: number) => void }
  | { kind: 'auto'; sub: string; sheetValue: string; cta: string; onOpen: () => void }
)

/** Card row subtitle: measurable goals read "value / target", auto goals carry theirs. */
function goalSub(g: Goal): string {
  return g.kind === 'measure' ? `${g.fmt(g.value)} / ${g.fmt(g.target)}` : g.sub
}

/** How far a measurable goal has come, 0-100. */
function goalPct(g: Extract<Goal, { kind: 'measure' }>): number {
  return g.target > 0 ? Math.min(100, (g.value / g.target) * 100) : 0
}

/** Sheet row value line: "7,632 · 76%" for measurables, a status word for auto goals. */
function goalSheetValue(g: Goal): string {
  return g.kind === 'measure' ? `${g.fmt(g.value)} · ${Math.round(goalPct(g))}%` : g.sheetValue
}

export default function Dashboard() {
  const { state, dispatch } = useStore()
  const nav = useNav()
  const colors = useColors()
  const units = state.settings.units
  const habit = todayHabit(state)
  const session = todaySession(state)
  const unread = unreadChat(state)
  const t = dailyTargets(state)
  const exam = examState(state)
  const streak = streakStats(state)
  const idx = weeklyIndex(state)
  const weightLoggedToday = state.weights.some((x) => x.dateKey === todayKey)
  // The streak is "at risk" until the user logs something today — the nudge that
  // drives the daily loop (Duolingo's whole retention engine).
  const loggedSomethingToday =
    workoutStartedForDay(state, todayKey) || habit.steps > 0 || habit.waterL > 0 || habit.sleepH > 0 || weightLoggedToday
  const streakAtRisk = streak.current > 0 && !loggedSomethingToday

  const greeting = greetingFor(currentHour())
  const weekKeys = currentWeekKeys()

  // Tap the readiness gauge to reveal what's driving the number (Whoop/Oura's
  // whole value is the "why", not the score).
  const [showWhy, setShowWhy] = useState(false)

  // The week strip selects which day's data fills the progress section below.
  const [selDate, setSelDate] = useState(todayKey)
  const isToday = selDate === todayKey
  const selHabit = habitForDay(state, selDate)
  const selSession = sessionForDay(state, selDate)
  const selActivities = activitiesForDay(state, selDate)
  const selTags = nutritionTagsForDay(state, selDate)
  const selWeekday = FULL_WD[fromKey(selDate).getDay()]
  const selTitle = isToday ? "Today's progress" : `${selWeekday}'s progress`

  // The five rings and the old "To-do today" list were two views of the same day,
  // stacked. They're now one checklist, built for whichever day the week strip has
  // selected. Today's is live (rows open the update sheet); past days render the
  // same rows read-only, since there's nothing left to log against them.
  // The nutrition check-in and the workout are "auto": they tick themselves off
  // when the user logs elsewhere in the app, so the row can't be ticked here.
  const selFoodReview = foodReviewForDay(state, selDate)
  const selCheckedIn = selTags.length > 0 || !!selFoodReview
  const isRestDay = !selSession
  const selWorkoutDone = isRestDay || workoutStartedForDay(state, selDate) || (selSession?.completed ?? false)

  // Fixed order, matching the design — done rows stay in place, struck through.
  const goals: Goal[] = [
    { id: 'steps', kind: 'measure', icon: 'footprints', tile: colors.brand400, label: 'Steps', done: selHabit.steps >= t.steps, value: selHabit.steps, target: t.steps, step: 500, fmt: (v) => Math.round(v).toLocaleString(), patch: (v) => dispatch({ type: 'PATCH_TODAY_HABIT', patch: { steps: v } }) },
    { id: 'sleep', kind: 'measure', icon: 'moon', tile: colors.accentPurple, label: 'Sleep', done: selHabit.sleepH >= t.sleepH, value: selHabit.sleepH, target: t.sleepH, step: 0.5, fmt: (v) => `${Math.round(v * 10) / 10} hrs`, patch: (v) => dispatch({ type: 'PATCH_TODAY_HABIT', patch: { sleepH: v } }) },
    { id: 'water', kind: 'measure', icon: 'droplet', tile: colors.accentBlue, label: 'Water', done: selHabit.waterL >= t.waterL, value: selHabit.waterL, target: t.waterL, step: 0.2, fmt: (v) => fmtFluid(v, units), patch: (v) => dispatch({ type: 'PATCH_TODAY_HABIT', patch: { waterL: v } }) },
    { id: 'nutrition', kind: 'auto', icon: 'leaf', tile: colors.accentOrange, label: isToday ? "Today's nutrition choices" : 'Nutrition choices', done: selCheckedIn, sub: selCheckedIn ? 'Checked in · auto' : isToday ? 'Not checked in yet' : 'No check-in', sheetValue: selCheckedIn ? 'Checked in' : 'Not checked in yet', cta: 'Log', onOpen: () => nav.goTab('nutrition') },
    { id: 'workout', kind: 'auto', icon: 'dumbbell', tile: colors.brand400, label: 'Workout', done: selWorkoutDone, sub: isRestDay ? 'Rest day · auto' : `${selSession.name} · ${selWorkoutDone ? 'auto' : 'not started'}`, sheetValue: isRestDay ? 'Rest day' : selWorkoutDone ? 'Completed' : 'Not yet', cta: 'Start', onOpen: () => (selSession ? nav.open('activeWorkout') : nav.goTab('workout')) },
  ]
  const goalsDone = goals.filter((g) => g.done).length

  const [sheetOpen, setSheetOpen] = useState(false)
  const openSheet = () => setSheetOpen(true)

  const chevron = 'rgba(148,148,148,0.55)'

  return (
    <View className="px-5 pt-2">
      <View className="mb-4 flex-row items-center justify-between">
        <Pressable accessibilityLabel="Open menu" onPress={() => nav.openMenu()} className="h-10 w-10 items-center justify-center rounded-xl active:opacity-70">
          <Menu size={24} color={colors.fg} />
        </Pressable>
        <Wordmark size="sm" />
        <Pressable onPress={() => nav.open('coachChat')} className="relative h-10 w-10 items-center justify-center rounded-xl active:opacity-70">
          <MessageCircle size={23} color={colors.fg} />
          {unread > 0 && <View className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand-400" style={{ borderWidth: 2, borderColor: colors.ink900 }} />}
        </Pressable>
      </View>

      {/* Weekly performance index */}
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-[20px] font-extrabold tracking-tight text-white">{greeting}, {state.profile.name}</Text>
          <Text className="mt-0.5 text-[13px] text-white/45">{longDate(todayKey)}</Text>
        </View>
        {streak.current > 0 && <StreakChip days={streak.current} atRisk={streakAtRisk} onPress={() => nav.open('logHabit')} />}
      </View>

      {/* Keep-the-streak nudge — only when today isn't logged yet. */}
      {streakAtRisk && (
        <Pressable onPress={() => nav.open('logHabit')} className="mt-3 flex-row items-center gap-2 rounded-2xl border border-accent-orange/25 bg-accent-orange/10 px-3.5 py-2.5 active:opacity-80">
          <Flame size={16} color={accent.orange} />
          <Text className="flex-1 text-[13px] font-semibold text-white/80">Log anything today to keep your {streak.current}-day streak alive.</Text>
          <ChevronRight size={16} color={accent.orange} />
        </Pressable>
      )}

      <Pressable onPress={() => setShowWhy((v) => !v)} accessibilityRole="button" accessibilityLabel="Explain your readiness score" className="active:opacity-90">
        <View className="mt-2"><IndexGauge index={idx} /></View>
        <Text className="mt-2 text-center text-[13px] leading-snug text-white/55">{idx.blurb}</Text>
        <View className="mt-1.5 flex-row items-center justify-center gap-1">
          <Info size={12} color="rgba(148,148,148,0.7)" />
          <Text className="text-[12px] font-semibold text-white/45">{showWhy ? 'Hide the breakdown' : 'What moves this score?'}</Text>
          <ChevronDown size={13} color="rgba(148,148,148,0.7)" style={{ transform: [{ rotate: showWhy ? '180deg' : '0deg' }] }} />
        </View>
      </Pressable>

      {/* What's driving the needle, colour-coded by area. Values show under each
       *  bar so the row isn't just abstract colour; tap the gauge for the why. */}
      <View className="mt-4 flex-row justify-between gap-2">
        {idx.parts.map((p) => {
          const good = p.pct >= 85, mid = p.pct >= 55
          const bar = good ? colors.brand400 : mid ? colors.accentOrange : colors.danger
          return (
            <View key={p.label} className="flex-1 items-center gap-1">
              <View className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <View className="h-full rounded-full" style={{ width: `${Math.min(100, p.pct)}%`, backgroundColor: bar }} />
              </View>
              <Text className="text-[10px] font-semibold" style={{ color: bar }}>{p.label}</Text>
              <Text className="text-[10px] font-bold text-white/70">{p.pct}%</Text>
            </View>
          )
        })}
      </View>

      {/* Expanded explainer — how the score is built, per habit. */}
      {showWhy && (
        <Card className="mt-3 p-4">
          <Text className="text-[13px] font-bold text-white">How your readiness works</Text>
          <Text className="mt-1 text-[12px] leading-snug text-white/55">
            It blends your last 7 days across five habits versus your targets. <Text className="font-semibold text-white/75">50 means on track</Text> — higher means you're beating your goals. Hit your targets and each bar fills toward 100%.
          </Text>
          <View className="mt-3 gap-2.5">
            {idx.parts.map((p) => {
              const good = p.pct >= 85, mid = p.pct >= 55
              const bar = good ? colors.brand400 : mid ? colors.accentOrange : colors.danger
              const note = good ? 'On target' : mid ? 'A little under' : 'Needs attention'
              return (
                <View key={p.label} className="flex-row items-center gap-3">
                  <Text className="w-20 text-[12px] font-semibold text-white/70">{p.label}</Text>
                  <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <View className="h-full rounded-full" style={{ width: `${Math.min(100, p.pct)}%`, backgroundColor: bar }} />
                  </View>
                  <Text className="w-24 text-right text-[11px] font-semibold" style={{ color: bar }}>{p.pct}% · {note}</Text>
                </View>
              )
            })}
          </View>
        </Card>
      )}

      {/* Week strip: tap a day to load its progress below */}
      <View className="mt-5 flex-row justify-between">
        {weekKeys.map((k, i) => {
          const today = k === todayKey
          const selected = k === selDate
          const future = k > todayKey
          const trained = state.sessions.some((s) => s.dateKey === k && s.completed) || (state.activities ?? []).some((a) => a.dateKey === k)
          const logged = state.habits.some((h) => h.dateKey === k)
          const date = parseInt(k.slice(-2))
          return (
            <Pressable key={k} disabled={future} onPress={() => setSelDate(k)} className={`w-10 items-center gap-1.5 rounded-xl py-1.5 ${future ? 'opacity-30' : 'active:opacity-70'}`}>
              <Text className={`text-[10px] font-semibold uppercase tracking-wide ${today ? 'text-brand-400' : 'text-white/35'}`}>{WD[i]}</Text>
              {/* "Today" is always a ring; the *selected* day is always a fill —
               *  so when today is selected you see a filled disc inside its ring
               *  and the two states never read as the same thing. */}
              <View className={`h-8 w-8 items-center justify-center rounded-full ${today ? 'border-2 border-brand-400' : 'border-2 border-transparent'}`}>
                <View className={`h-6 w-6 items-center justify-center rounded-full ${selected ? 'bg-brand-400' : ''}`}>
                  <Text className={`text-[14px] font-bold ${selected ? 'text-black' : today ? 'text-brand-400' : 'text-white/75'}`}>{date}</Text>
                </View>
              </View>
              <View className={`h-1.5 w-1.5 rounded-full ${trained ? 'bg-brand-400' : logged ? 'bg-white/30' : future ? 'bg-transparent' : 'bg-white/10'}`} />
            </Pressable>
          )
        })}
      </View>

      {/* Plan / workout: follows the selected day */}
      <Section title={isToday ? 'Your plan' : `${selWeekday}'s workout`} />
      <Hero image={selSession?.image ?? session?.image} rounded={16}>
        <View className="flex-row items-center gap-2">
          <Text className="text-sm font-semibold text-brand-400">{isToday ? "Today's plan" : selSession ? (selSession.completed ? 'Completed' : 'Logged') : 'Rest day'}</Text>
          {exam.active && isToday && <View className="rounded-full bg-accent-purple/20 px-2 py-0.5"><Text className="text-[10px] font-bold text-accent-purple">Exam mode</Text></View>}
        </View>
        <Text className="mt-1 text-2xl font-extrabold tracking-tight text-white">{selSession?.name ?? 'Rest day'}</Text>
        <View className="mt-2 flex-row items-center gap-1.5">
          <Clock size={15} color="rgba(255,255,255,0.6)" />
          <Text className="text-sm text-white/60">
            {selSession
              ? isToday
                ? `${selSession.exercises.length} exercises, about ${exam.active ? 30 : 50} min`
                : `${selSession.exercises.length} exercises · ${selSession.durationMin} min · ${fmtVolume(selSession.volumeKg, units)}`
              : 'Recovery and mobility'}
          </Text>
        </View>
        {isToday && selSession && (
          <Pressable onPress={() => nav.open('activeWorkout')} className="btn-primary mt-4 self-start active:opacity-90">
            <Play size={16} color="#000" fill="#000" />
            <Text className="ml-2 font-semibold text-black">{selSession.completed ? 'View workout' : 'Start workout'}</Text>
          </Pressable>
        )}
      </Hero>

      {/* Past day: read-only list of what was done */}
      {!isToday && selSession && (
        <View className="mt-3 gap-2">
          {selSession.exercises.map((ex) => {
            const doneSets = ex.sets.filter((s) => s.done)
            const top = doneSets.length ? Math.max(...doneSets.map((s) => s.weightKg)) : 0
            return (
              <View key={ex.defId} className="flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-3">
                <Image source={{ uri: ex.image }} resizeMode="cover" className="h-10 w-10 rounded-xl" />
                <Text numberOfLines={1} className="flex-1 font-semibold text-white">{ex.name}</Text>
                <Text className="text-[12px] text-white/55">{doneSets.length || ex.sets.length} × {fmtWeightNum(top, units, units === 'imperial' ? 0 : 1)} {weightUnit(units)}</Text>
              </View>
            )
          })}
        </View>
      )}

      {/* Activities logged that day */}
      {selActivities.length > 0 && (
        <View className="mt-3 gap-2">
          {selActivities.map((a) => (
            <View key={a.id} className="flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-3">
              <View className="h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-400/15"><ActivityIcon name={a.icon} size={18} color={brand[400]} /></View>
              <View className="min-w-0 flex-1">
                <Text numberOfLines={1} className="font-semibold text-white">{a.name}</Text>
                <Text className="text-[12px] capitalize text-white/50">{a.minutes} min · {a.intensity}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {!isToday && !selSession && selActivities.length === 0 && (
        <Text className="mt-3 rounded-2xl border border-dashed border-white/15 py-4 text-center text-[13px] text-white/40">No workout or activity logged on {shortDate(selDate)}.</Text>
      )}

      {/* Progress — the merged checklist for whichever day is selected. Today's
       *  rows open the update sheet; past days are a read-only record. */}
      <Section title={selTitle} tight />
      {isToday && t.adjusted && <Text className="-mt-1 mb-3 text-[12px] text-accent-purple">Targets eased for exam season</Text>}
      <DayProgressCard
        goals={goals}
        doneCount={goalsDone}
        total={goals.length}
        onUpdate={isToday ? openSheet : undefined}
        stamp={isToday ? undefined : shortDate(selDate)}
        tags={selTags}
        onTag={isToday ? () => nav.goTab('nutrition') : undefined}
        colors={colors}
      />

      {/* Progress overview */}
      <Section title="Progress overview" right={<Pressable onPress={() => nav.open('customize')} hitSlop={8}><Text className="see-all">Customise</Text></Pressable>} />
      <View className="flex-row gap-3">
        {dashboardStatIds(state).map((id, i) => {
          const m = statById(id)
          if (!m) return null
          const r = m.compute(state, units)
          return <OverviewCard key={`${id}-${i}`} icon={r.icon} label={r.label} value={r.value} unit={r.unit} sub={r.sub} delta={r.delta} />
        })}
      </View>

      {/* More tools */}
      <Section title="More" tight />
      <View className="gap-3">
        {state.profile.newToGym && (
          <Pressable onPress={() => nav.open('beginner')} className="flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-3.5 active:opacity-90">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-brand-400/15"><Leaf size={20} color={brand[400]} /></View>
            <View className="flex-1">
              <Text className="font-bold text-white">New to the gym</Text>
              <Text className="text-[12px] text-white/50">Your first 90 days, step by step</Text>
            </View>
            <ChevronRight size={18} color={chevron} />
          </Pressable>
        )}
        <Pressable onPress={() => nav.open('examMode')} className="flex-row items-center gap-3 rounded-2xl border border-accent-purple/30 bg-accent-purple/10 p-4 active:opacity-90">
          <View className="h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-purple/20"><GraduationCap size={22} color={accent.purple} /></View>
          <View className="flex-1">
            <Text className="font-bold text-white">Exam Survival Protocol</Text>
            <Text className="text-[13px] text-white/55">
              {(() => {
                if (!state.profile.examMode) return 'Add your exam dates and I will adapt your plan.'
                const ds = state.profile.examDates ?? []
                if (ds.length === 0) return 'On. Shorter sessions, more recovery.'
                const upcoming = ds.filter((k) => k >= todayKey)
                if (upcoming.length === 0) return `${ds.length} exam date${ds.length === 1 ? '' : 's'} · all done`
                const until = Math.round((fromKey(upcoming[0]).getTime() - fromKey(todayKey).getTime()) / 86400000)
                const nextLabel = until === 0 ? 'today' : until === 1 ? 'tomorrow' : `in ${until} days`
                return `${ds.length} date${ds.length === 1 ? '' : 's'} set · next ${nextLabel}`
              })()}
            </Text>
          </View>
          <ChevronRight size={20} color={accent.purple} />
        </Pressable>
      </View>
      <View className="h-2" />

      {isToday && (
        <UpdateTodaySheet open={sheetOpen} onClose={() => setSheetOpen(false)} goals={goals} doneCount={goalsDone} total={goals.length} colors={colors} />
      )}
    </View>
  )
}

/* Streak chip with a gently flickering flame — the core-loop badge, so it should
 * feel alive rather than static. Pressable to jump straight to logging. */
function StreakChip({ days, atRisk, onPress }: { days: number; atRisk: boolean; onPress: () => void }) {
  const flicker = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flicker, { toValue: 1, duration: 620, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 0, duration: 720, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [flicker])
  const scale = flicker.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] })
  const opacity = flicker.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] })
  return (
    <Pressable onPress={onPress} accessibilityLabel={`${days} day streak`} className="shrink-0 flex-row items-center gap-1.5 rounded-full bg-accent-orange/12 px-3 py-1.5 active:opacity-80">
      <Animated.View style={{ transform: [{ scale }], opacity }}>
        <Flame size={15} color={accent.orange} />
      </Animated.View>
      <Text className="text-[13px] font-bold text-accent-orange">{days} day{days === 1 ? '' : 's'}</Text>
      {atRisk && <View className="h-1.5 w-1.5 rounded-full bg-accent-orange" />}
    </Pressable>
  )
}

/* ---- Today's progress: the merged goal checklist (design "Goals Card" 8B) ---- */

type ThemeColors = ReturnType<typeof useColors>

/**
 * The tinted icon tile shared by the checklist rows and the update sheet. The
 * goal keeps its own icon and colour once done; a green check badge pops into
 * the corner to mark it off (and pops again whenever the goal flips to done).
 */
function GoalTile({ goal, colors, size = 44, badgeDelay = 0 }: { goal: Goal; colors: ThemeColors; size?: number; badgeDelay?: number }) {
  const badge = Math.round(size * 0.46)
  const pop = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!goal.done) return
    pop.setValue(0)
    Animated.timing(pop, {
      toValue: 1,
      duration: 340,
      delay: badgeDelay,
      easing: Easing.bezier(0.34, 1.56, 0.64, 1),
      useNativeDriver: Platform.OS !== 'web',
    }).start()
  }, [goal.done]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={{ position: 'relative' }}>
      <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: `${goal.tile}26`, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={goal.icon} size={Math.round(size * 0.45)} color={goal.tile} />
      </View>
      {goal.done && (
        <Animated.View style={{ position: 'absolute', right: -4, bottom: -4, width: badge, height: badge, borderRadius: badge / 2, backgroundColor: colors.brand400, borderWidth: 2.5, borderColor: colors.ink800, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pop }] }}>
          <Check size={Math.round(badge * 0.55)} strokeWidth={4} color="#000" />
        </Animated.View>
      )}
    </View>
  )
}

// One checklist row, with the design's "soft pop" entrance — each row fades and
// springs up from 0.92 with a short back-eased overshoot, staggered by index.
// Without `onPress` the row is a read-only record of a past day.
function GoalRow({ goal, index, onPress, colors }: { goal: Goal; index: number; onPress?: () => void; colors: ThemeColors }) {
  const enter = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 460,
      delay: index * 70,
      easing: Easing.bezier(0.34, 1.56, 0.64, 1),
      useNativeDriver: Platform.OS !== 'web',
    }).start()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const scale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] })
  // The badge lands just after its row has settled.
  const body = (
    <>
      <GoalTile goal={goal} colors={colors} badgeDelay={index * 70 + 250} />
      <View className="min-w-0 flex-1">
        {/* textDecorationLine via style — the NativeWind `line-through` class
            doesn't make it through to RN's Text on every platform. */}
        <Text numberOfLines={1} className={`text-[15px] font-bold ${goal.done ? 'text-white/40' : 'text-white'}`} style={{ textDecorationLine: goal.done ? 'line-through' : 'none' }}>{goal.label}</Text>
        <Text numberOfLines={1} className={`mt-0.5 text-[12.5px] ${goal.done ? 'text-white/35' : 'text-white/45'}`}>{goalSub(goal)}</Text>
      </View>
      {!goal.done && onPress && <ChevronRight size={18} color="rgba(148,148,148,0.45)" />}
    </>
  )
  return (
    <Animated.View style={{ opacity: enter, transform: [{ scale }] }}>
      {onPress ? (
        <Pressable onPress={onPress} className="flex-row items-center gap-3.5 border-t border-white/5 py-3.5 active:opacity-70">{body}</Pressable>
      ) : (
        <View className="flex-row items-center gap-3.5 border-t border-white/5 py-3.5">{body}</View>
      )}
    </Animated.View>
  )
}

/**
 * The merged goal checklist. `onUpdate` makes it live (today); pass `stamp`
 * instead for a past day, which renders the same rows as a read-only record.
 */
function DayProgressCard({ goals, doneCount, total, onUpdate, stamp, tags, onTag, colors }: { goals: Goal[]; doneCount: number; total: number; onUpdate?: () => void; stamp?: string; tags: string[]; onTag?: () => void; colors: ThemeColors }) {
  const target = total ? (doneCount / total) * 100 : 0
  // Bar eases to the new fraction whenever a goal flips done — a small reward.
  const w = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(w, { toValue: target, duration: 640, delay: 120, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: false }).start()
  }, [target, w])
  const width = w.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] })
  // The count pops whenever it changes — the design's `bumpEl`.
  const bump = useRef(new Animated.Value(1)).current
  const prevCount = useRef(doneCount)
  useEffect(() => {
    if (prevCount.current !== doneCount) {
      Animated.sequence([
        Animated.timing(bump, { toValue: 1.2, duration: 130, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(bump, { toValue: 1, duration: 190, easing: Easing.bezier(0.34, 1.56, 0.64, 1), useNativeDriver: Platform.OS !== 'web' }),
      ]).start()
    }
    prevCount.current = doneCount
  }, [doneCount, bump])
  return (
    <Card className="px-4 pb-1.5 pt-4">
      <View className="flex-row items-baseline gap-1.5 px-0.5">
        <Animated.View style={{ transform: [{ scale: bump }] }}>
          <Text className="text-[16px] font-extrabold" style={{ color: colors.brand400 }}>{doneCount}</Text>
        </Animated.View>
        <Text className="text-[13px] font-semibold text-white/55">of {total} done</Text>
        {onUpdate ? (
          <Pressable onPress={onUpdate} hitSlop={8} className="ml-auto active:opacity-60">
            <Text className="text-[12.5px] font-bold" style={{ color: colors.brand400 }}>Update →</Text>
          </Pressable>
        ) : (
          <Text className="ml-auto text-[12.5px] text-white/30">{stamp}</Text>
        )}
      </View>
      <View className="mx-0.5 mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <Animated.View style={{ height: '100%', borderRadius: 999, width, backgroundColor: colors.brand400 }} />
      </View>
      {goals.map((g, i) => (
        <GoalRow key={g.id} goal={g} index={i} onPress={onUpdate} colors={colors} />
      ))}
      {/* Food check-in lives inside the card, behind a full-bleed divider. */}
      <View className="-mx-4 mt-1.5 border-t border-white/[0.08] px-4 pb-1 pt-4">
        <FoodCheckIn tags={tags} colors={colors} onTag={onTag} />
      </View>
    </Card>
  )
}

function FoodCheckIn({ tags, colors, onTag }: { tags: string[]; colors: ThemeColors; onTag?: () => void }) {
  return (
    <View>
      <View className="mb-3 flex-row items-center gap-2">
        <Leaf size={14} color={colors.brand400} />
        <Text className="text-[12px] font-bold uppercase tracking-wide text-white/40">Food check-in</Text>
        <Text className="ml-auto text-[11px] text-white/30">from your nutrition log</Text>
      </View>
      {tags.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {tags.map((id) => {
            const tag = tagById(id)
            if (!tag) return null
            const col = toneColor(tag.tone, colors)
            return (
              <View key={id} className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5" style={{ backgroundColor: `${col}1f`, borderWidth: 1, borderColor: `${col}4d` }}>
                <Text style={{ color: col }}>{tag.emoji}</Text>
                <Text className="text-[12.5px] font-semibold" style={{ color: col }}>{tag.label}</Text>
              </View>
            )
          })}
        </View>
      ) : onTag ? (
        <Pressable onPress={onTag} className="active:opacity-70">
          <Text className="text-[13px] font-semibold" style={{ color: colors.brand400 }}>Tag how your eating went →</Text>
        </Pressable>
      ) : (
        <Text className="text-[13px] text-white/35">No food tags for this day</Text>
      )}
    </View>
  )
}

/* ---- The "Update today" sheet, 1:1 with the design ------------------------
   A goal reads as a progress ring + "value · pct%". Measurable goals get a
   "+" that expands a stepper and a "Mark done" that jumps straight to target;
   once done the pill flips to "Done" and tapping it undoes. The nutrition and
   workout rows are locked — they're owned by other screens. ---------------- */

const SHEET_EASE = Easing.bezier(0.22, 1, 0.36, 1)
const BACK_EASE = Easing.bezier(0.34, 1.56, 0.64, 1)
const STEPPER_H = 56 // 14px top padding + the 42px control row
const USE_NATIVE = Platform.OS !== 'web'

// Exact values come from the design as inline styles: NativeWind's arbitrary
// utilities (px-[15px] and friends) silently compile to nothing here.
const S = {
  row: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  label: { fontSize: 14, fontWeight: '600', color: '#fff' },
  value: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 1 },
  expandBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  markDone: { paddingHorizontal: 15, paddingVertical: 9, borderRadius: 999 },
  markDoneText: { fontSize: 13, fontWeight: '700', color: '#000' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  pillText: { fontSize: 13, fontWeight: '700' },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, paddingTop: 14 },
  stepBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  stepGlyph: { fontSize: 24, lineHeight: 28 },
  stepValue: { minWidth: 90, textAlign: 'center', fontSize: 19, fontWeight: '800', color: '#fff' },
} as const

/** A ring whose fill eases to its new value, as the design's rings do. */
const AnimCircle = Animated.createAnimatedComponent(Circle)
function AnimatedRing({ pct, size, stroke, color, track, children }: { pct: number; size: number; stroke: number; color: string; track: string; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const v = useRef(new Animated.Value(pct)).current
  useEffect(() => {
    Animated.timing(v, { toValue: pct, duration: 750, easing: SHEET_EASE, useNativeDriver: false }).start()
  }, [pct, v])
  const offset = v.interpolate({ inputRange: [0, 100], outputRange: [circ, 0], extrapolate: 'clamp' })
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <G transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
          <AnimCircle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} />
        </G>
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>{children}</View>
    </View>
  )
}

/** The design's completion burst: a glow ring pushing outward plus confetti. */
function Celebrate({ burst, colors, size }: { burst: number; colors: ThemeColors; size: number }) {
  const p = useRef(new Animated.Value(0)).current
  const [dots] = useState(() =>
    Array.from({ length: 16 }, (_, k) => {
      const ang = Math.random() * Math.PI * 2
      const dist = 26 + Math.random() * 32
      return { k, x: Math.cos(ang) * dist, y: Math.sin(ang) * dist, rot: Math.floor(Math.random() * 360) }
    }),
  )
  // Dots are torn down once they've flown out, rather than lingering invisibly.
  const [alive, setAlive] = useState(false)
  useEffect(() => {
    if (!burst) return
    setAlive(true)
    p.setValue(0)
    Animated.timing(p, { toValue: 1, duration: 760, easing: Easing.bezier(0.2, 0.7, 0.3, 1), useNativeDriver: USE_NATIVE }).start(({ finished }) => {
      if (finished) setAlive(false)
    })
  }, [burst, p])
  if (!alive) return null
  const cols = [colors.brand400, colors.accentOrange, colors.accentBlue, colors.accentPurple, colors.accentYellow]
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute', left: -3, top: -3, right: -3, bottom: -3,
          borderRadius: (size + 6) / 2, borderWidth: 3, borderColor: colors.brand400,
          opacity: p.interpolate({ inputRange: [0, 1], outputRange: [0.85, 0] }),
          transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, 1.85] }) }],
        }}
      />
      {dots.map((d) => (
        <Animated.View
          key={d.k}
          style={{
            position: 'absolute', width: 7, height: 7, borderRadius: 2, backgroundColor: cols[d.k % cols.length],
            opacity: p.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 0.5, 0] }),
            transform: [
              { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, d.x] }) },
              { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [0, d.y] }) },
              { rotate: p.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${d.rot}deg`] }) },
              { scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] }) },
            ],
          }}
        />
      ))}
    </View>
  )
}

/** The expanding −/value/+ row under a measurable goal. */
function GoalStepper({ goal, open, colors }: { goal: Extract<Goal, { kind: 'measure' }>; open: boolean; colors: ThemeColors }) {
  const grow = useRef(new Animated.Value(open ? 1 : 0)).current
  useEffect(() => {
    Animated.timing(grow, { toValue: open ? 1 : 0, duration: 340, easing: SHEET_EASE, useNativeDriver: false }).start()
  }, [open, grow])
  const bump = (dir: 1 | -1) => {
    let v = goal.value + dir * goal.step
    v = Math.max(0, Math.min(goal.target * 1.5, Math.round(v * 100) / 100))
    goal.patch(v)
  }
  return (
    <Animated.View style={{ height: grow.interpolate({ inputRange: [0, 1], outputRange: [0, STEPPER_H] }), opacity: grow, overflow: 'hidden' }}>
      <View style={S.stepRow}>
        <PressableScale onPress={() => bump(-1)} scaleTo={0.9}>
          <View style={[S.stepBtn, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
            <Text style={[S.stepGlyph, { color: colors.fg }]}>−</Text>
          </View>
        </PressableScale>
        <Text style={S.stepValue}>{goal.fmt(goal.value)} / {goal.fmt(goal.target)}</Text>
        <PressableScale onPress={() => bump(1)} scaleTo={0.9}>
          <View style={[S.stepBtn, { backgroundColor: `${colors.brand400}2e` }]}>
            <Text style={[S.stepGlyph, { color: colors.brand400 }]}>+</Text>
          </View>
        </PressableScale>
      </View>
    </Animated.View>
  )
}

function SheetGoalRow({ goal, colors, expanded, onExpand, onMarkDone, onUndo, onClose }: {
  goal: Goal
  colors: ThemeColors
  expanded: boolean
  onExpand: () => void
  onMarkDone: () => void
  onUndo: () => void
  onClose: () => void
}) {
  // The ring keeps the goal's own icon rather than swapping to a tick, so a row
  // stays recognisable at a glance once it's complete.
  const ringPct = goal.kind === 'measure' ? goalPct(goal) : goal.done ? 100 : 0
  const iconColor = goal.done ? colors.brand400 : goal.kind === 'auto' ? 'rgba(255,255,255,0.4)' : colors.brand400

  // Completing a goal pops the ring and throws confetti — the design's celebrate.
  const [burst, setBurst] = useState(0)
  const pop = useRef(new Animated.Value(1)).current
  const wasDone = useRef(goal.done)
  useEffect(() => {
    if (goal.done && !wasDone.current) {
      setBurst((b) => b + 1)
      Animated.sequence([
        Animated.timing(pop, { toValue: 1.22, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: USE_NATIVE }),
        Animated.timing(pop, { toValue: 1, duration: 320, easing: BACK_EASE, useNativeDriver: USE_NATIVE }),
      ]).start()
    }
    wasDone.current = goal.done
  }, [goal.done, pop])

  return (
    <View style={S.row}>
      <View style={S.rowMain}>
        <Animated.View style={{ transform: [{ scale: pop }] }}>
          <AnimatedRing pct={ringPct} size={38} stroke={4} color={colors.brand400} track={colors.ringTrack}>
            <Icon name={goal.icon} size={14} color={iconColor} />
          </AnimatedRing>
          <Celebrate burst={burst} colors={colors} size={38} />
        </Animated.View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={S.label}>{goal.label}</Text>
          <Text numberOfLines={1} style={S.value}>{goalSheetValue(goal)}</Text>
        </View>

        {goal.kind === 'measure' ? (
          goal.done ? (
            // A measurable goal can be taken back; the auto rows are locked.
            <DonePill colors={colors} onPress={onUndo} />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <PressableScale onPress={onExpand} scaleTo={0.9}>
                <View style={S.expandBtn}>
                  <Text style={{ fontSize: 19, lineHeight: 22, color: 'rgba(255,255,255,0.7)' }}>+</Text>
                </View>
              </PressableScale>
              <PressableScale onPress={onMarkDone} scaleTo={0.96}>
                <View style={[S.markDone, { backgroundColor: colors.brand400 }]}>
                  <Text style={S.markDoneText}>Mark done</Text>
                </View>
              </PressableScale>
            </View>
          )
        ) : goal.done ? (
          <DonePill colors={colors} />
        ) : (
          <PressableScale onPress={() => { onClose(); goal.onOpen() }} scaleTo={0.96}>
            <View style={[S.pill, { backgroundColor: `${colors.brand400}26` }]}>
              <Text style={[S.pillText, { color: colors.brand400 }]}>{goal.cta}</Text>
              <ArrowRight size={14} strokeWidth={2.6} color={colors.brand400} />
            </View>
          </PressableScale>
        )}
      </View>

      {goal.kind === 'measure' && !goal.done && <GoalStepper goal={goal} open={expanded} colors={colors} />}
    </View>
  )
}

function DonePill({ colors, onPress }: { colors: ThemeColors; onPress?: () => void }) {
  const body = (
    <View style={[S.pill, { backgroundColor: `${colors.brand400}26` }]}>
      <Check size={14} strokeWidth={3} color={colors.brand400} />
      <Text style={[S.pillText, { color: colors.brand400 }]}>Done</Text>
    </View>
  )
  if (!onPress) return body
  return <PressableScale onPress={onPress} scaleTo={0.96} accessibilityLabel="Tap to undo">{body}</PressableScale>
}

function UpdateTodaySheet({ open, onClose, goals, doneCount, total, colors }: { open: boolean; onClose: () => void; goals: Goal[]; doneCount: number; total: number; colors: ThemeColors }) {
  const win = useWindowDimensions()
  const screenH = IS_WEB ? WEB_SCREEN.height : win.height
  const insets = useSafeAreaInsets()
  const [render, setRender] = useState(open)
  const [panelH, setPanelH] = useState(520)
  const [expanded, setExpanded] = useState<string | null>(null)
  // Remembers where a goal was before "Mark done", so undo can put it back.
  const prev = useRef<Record<string, number>>({})
  const progress = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (open) {
      setRender(true)
      Animated.timing(progress, { toValue: 1, duration: 440, easing: SHEET_EASE, useNativeDriver: Platform.OS !== 'web' }).start()
    } else if (render) {
      Animated.timing(progress, { toValue: 0, duration: 320, easing: SHEET_EASE, useNativeDriver: Platform.OS !== 'web' }).start(({ finished }) => {
        if (finished) { setRender(false); setExpanded(null) }
      })
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const markDone = (g: Goal) => {
    if (g.kind !== 'measure') return
    if (g.value < g.target) prev.current[g.id] = g.value
    g.patch(g.target)
    setExpanded(null)
  }
  const undo = (g: Goal) => {
    if (g.kind !== 'measure') return
    let v = prev.current[g.id]
    if (v === undefined || v >= g.target) v = Math.max(0, Math.round((g.target * 0.75) / g.step) * g.step)
    g.patch(Math.round(v * 100) / 100)
    setExpanded(null)
  }

  return (
    <AppModal visible={render} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        {/* Dim backdrop — the dashboard stays visible behind the sheet. */}
        <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', opacity: progress }}>
          <Pressable accessibilityLabel="Close" onPress={onClose} style={{ flex: 1 }} />
        </Animated.View>

        <Animated.View
          onLayout={(e) => setPanelH(e.nativeEvent.layout.height)}
          style={{
            maxHeight: screenH * 0.84,
            backgroundColor: colors.ink800,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            shadowColor: '#000',
            shadowOpacity: 0.55,
            shadowRadius: 40,
            shadowOffset: { width: 0, height: -12 },
            elevation: 24,
            transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [panelH, 0] }) }],
          }}
        >
          <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6 }}>
            <View style={{ width: 38, height: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 12 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>Update today</Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{doneCount} of {total} on track</Text>
              </View>
              <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close" style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' }}>
                <X size={14} color="rgba(255,255,255,0.5)" strokeWidth={2.5} />
              </Pressable>
            </View>
          </View>

          <ScrollView style={{ paddingHorizontal: 20 }} contentContainerStyle={{ paddingTop: 2, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
            {goals.map((g) => (
              <SheetGoalRow
                key={g.id}
                goal={g}
                colors={colors}
                expanded={expanded === g.id}
                onExpand={() => setExpanded((cur) => (cur === g.id ? null : g.id))}
                onMarkDone={() => markDone(g)}
                onUndo={() => undo(g)}
                onClose={onClose}
              />
            ))}
          </ScrollView>

          <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 22 + insets.bottom }}>
            <PressableScale onPress={onClose} scaleTo={0.98}>
              <View style={{ alignItems: 'center', borderRadius: 999, paddingVertical: 14, backgroundColor: colors.brand400 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#000' }}>Done</Text>
              </View>
            </PressableScale>
          </View>
        </Animated.View>
      </View>
    </AppModal>
  )
}

function Section({ title, right, tight }: { title: string; right?: ReactNode; tight?: boolean }) {
  return (
    <View className={`mb-2.5 flex-row items-center justify-between ${tight ? 'mt-5' : 'mt-7'}`}>
      <Text className="section-title">{title}</Text>
      {right}
    </View>
  )
}

function OverviewCard({ icon, label, value, unit, sub, delta }: { icon: string; label: string; value: string; unit?: string; sub: string; delta: string }) {
  return (
    <Card className="flex-1 p-3.5">
      <View className="mb-2 flex-row items-center gap-1.5">
        <Icon name={icon} size={15} color="rgba(148,148,148,0.7)" />
        <Text numberOfLines={1} className="text-xs font-medium text-white/55">{label}</Text>
      </View>
      <View className="flex-row items-baseline gap-1">
        <Text className="text-2xl font-extrabold tracking-tight text-white">{value}</Text>
        {unit && <Text className="text-xs text-white/50">{unit}</Text>}
      </View>
      <View className="mt-1.5 flex-row items-center justify-between">
        {sub ? <Text className="text-[11px] text-white/40">{sub}</Text> : <View />}
        <Text className="text-[11px] font-semibold text-brand-400">{delta}</Text>
      </View>
    </Card>
  )
}
