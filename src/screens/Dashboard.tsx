import { useEffect, useRef, useState, type ReactNode } from 'react'
import { View, Text, Pressable, Image, Animated, Easing, Platform } from 'react-native'
import { Menu, MessageCircle, Clock, Play, GraduationCap, ChevronRight, Leaf, Check, Flame, ChevronDown, Info, Plus, Minus, ArrowRight } from 'lucide-react-native'
import { Icon } from '../components/Icon'
import { ActivityIcon } from '../components/ActivityIcon'
import { Card } from '../components/ui'
import { Sheet } from '../components/Sheet'
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
 * A single row in the merged "Today's progress" checklist. Measurable goals
 * (water, steps) carry a target + a store patch so the update sheet can nudge
 * them with a stepper; action goals (workout, food, weigh) jump to their own
 * logging surface instead.
 */
type Goal = {
  id: string
  icon: string
  tile: string // tint colour for the icon tile (and its 15% background)
  label: string
  sub: string
  done: boolean
} & (
  | { kind: 'measure'; value: number; target: number; step: number; fmt: (v: number) => string; patch: (v: number) => void }
  | { kind: 'action'; cta: string; onOpen: () => void }
)

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
  const selFoodReview = foodReviewForDay(state, selDate)
  const selWeightLogged = state.weights.some((w) => w.dateKey === selDate)
  const selWorkoutDone = workoutStartedForDay(state, selDate) || (selSession?.completed ?? false)

  const goalsBase: Goal[] = []
  if (selSession) {
    goalsBase.push({ id: 'workout', kind: 'action', icon: 'dumbbell', tile: colors.brand400, label: selWorkoutDone ? 'Workout complete' : isToday ? "Today's workout" : 'Workout not logged', sub: selSession.name, done: selWorkoutDone, cta: selWorkoutDone ? 'View' : 'Start', onOpen: () => nav.open('activeWorkout') })
  }
  goalsBase.push({ id: 'water', kind: 'measure', icon: 'droplet', tile: colors.accentBlue, label: `Drink ${fmtFluid(t.waterL, units)} of water`, sub: `${fmtFluid(selHabit.waterL, units)} ${isToday ? 'so far' : 'logged'}`, done: selHabit.waterL >= t.waterL, value: selHabit.waterL, target: t.waterL, step: 0.2, fmt: (v) => fmtFluid(v, units), patch: (v) => dispatch({ type: 'PATCH_TODAY_HABIT', patch: { waterL: v } }) })
  goalsBase.push({ id: 'meals', kind: 'action', icon: 'utensils', tile: colors.accentOrange, label: 'Review your food', sub: selFoodReview ? `Reviewed · ${selFoodReview.score}/10` : isToday ? 'Get coach feedback on today' : 'No review logged', done: !!selFoodReview, cta: 'Open', onOpen: () => nav.goTab('nutrition') })
  goalsBase.push({ id: 'steps', kind: 'measure', icon: 'footprints', tile: colors.brand400, label: `Reach ${t.steps.toLocaleString()} steps`, sub: `${selHabit.steps.toLocaleString()} ${isToday ? 'today' : 'logged'}`, done: selHabit.steps >= t.steps, value: selHabit.steps, target: t.steps, step: 500, fmt: (v) => Math.round(v).toLocaleString(), patch: (v) => dispatch({ type: 'PATCH_TODAY_HABIT', patch: { steps: v } }) })
  goalsBase.push({ id: 'weight', kind: 'action', icon: 'scale', tile: colors.accentYellow, label: 'Weigh yourself', sub: selWeightLogged ? (isToday ? 'Logged today' : 'Logged') : isToday ? 'Keep your trend honest' : 'Not logged', done: selWeightLogged, cta: 'Log', onOpen: () => nav.open('logWeight') })
  // Finished goals settle to the bottom of the card (the sheet keeps a stable order).
  const goals = [...goalsBase].sort((a, b) => Number(a.done) - Number(b.done))
  const goalsDone = goalsBase.filter((g) => g.done).length

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
        total={goalsBase.length}
        onUpdate={isToday ? openSheet : undefined}
        stamp={isToday ? undefined : shortDate(selDate)}
        colors={colors}
      />
      <FoodCheckIn tags={selTags} colors={colors} onTag={isToday ? () => nav.goTab('nutrition') : undefined} />

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
        <UpdateTodaySheet open={sheetOpen} onClose={() => setSheetOpen(false)} goals={goalsBase} doneCount={goalsDone} total={goalsBase.length} colors={colors} />
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
 * The tinted icon tile shared by the checklist rows and the update sheet. Once a
 * goal is done it grows a small green check badge in the corner (design 8B — the
 * goal keeps its identity rather than being struck through).
 */
function GoalTile({ goal, colors, size = 44 }: { goal: Goal; colors: ThemeColors; size?: number }) {
  const badge = Math.round(size * 0.46)
  return (
    <View style={{ position: 'relative' }}>
      <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: `${goal.tile}26`, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={goal.icon} size={Math.round(size * 0.45)} color={goal.tile} />
      </View>
      {goal.done && (
        <View style={{ position: 'absolute', right: -4, bottom: -4, width: badge, height: badge, borderRadius: badge / 2, backgroundColor: colors.brand400, borderWidth: 2.5, borderColor: colors.ink800, alignItems: 'center', justifyContent: 'center' }}>
          <Check size={Math.round(badge * 0.55)} strokeWidth={4} color="#000" />
        </View>
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
  const body = (
    <>
      <GoalTile goal={goal} colors={colors} />
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className={`text-[15px] font-bold ${onPress || goal.done ? 'text-white' : 'text-white/70'}`}>{goal.label}</Text>
        <Text numberOfLines={1} className="mt-0.5 text-[12.5px] text-white/45">{goal.sub}</Text>
      </View>
      {goal.done ? (
        <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: `${colors.brand400}26` }}>
          <Text className="text-[12px] font-bold" style={{ color: colors.brand400 }}>Done</Text>
        </View>
      ) : onPress ? (
        <ChevronRight size={18} color="rgba(148,148,148,0.45)" />
      ) : null}
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
function DayProgressCard({ goals, doneCount, total, onUpdate, stamp, colors }: { goals: Goal[]; doneCount: number; total: number; onUpdate?: () => void; stamp?: string; colors: ThemeColors }) {
  const target = total ? (doneCount / total) * 100 : 0
  // Bar eases to the new fraction whenever a goal flips done — a small reward.
  const w = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(w, { toValue: target, duration: 640, delay: 120, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: false }).start()
  }, [target, w])
  const width = w.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] })
  return (
    <Card className="px-4 pb-1.5 pt-4">
      <View className="flex-row items-baseline gap-1.5 px-0.5">
        <Text className="text-[16px] font-extrabold" style={{ color: colors.brand400 }}>{doneCount}</Text>
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
    </Card>
  )
}

function FoodCheckIn({ tags, colors, onTag }: { tags: string[]; colors: ThemeColors; onTag?: () => void }) {
  return (
    <View className="mt-5">
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

/* ---- The "Update today" sheet: steppers for measurable goals, quick jumps
   for the rest. Everything writes straight to today's habit store. ---- */

function StepButton({ variant, onPress, colors }: { variant: 'plus' | 'minus'; onPress: () => void; colors: ThemeColors }) {
  const plus = variant === 'plus'
  return (
    <PressableScale onPress={onPress} scaleTo={0.9}>
      <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: plus ? `${colors.brand400}2e` : 'rgba(255,255,255,0.06)' }}>
        {plus ? <Plus size={18} strokeWidth={2.6} color={colors.brand400} /> : <Minus size={18} strokeWidth={2.6} color={colors.fg} />}
      </View>
    </PressableScale>
  )
}

function SheetGoalRow({ goal, first, colors, onClose }: { goal: Goal; first: boolean; colors: ThemeColors; onClose: () => void }) {
  const subLine = goal.kind === 'measure' ? `${goal.fmt(goal.value)} / ${goal.fmt(goal.target)}` : goal.sub
  const bump = (dir: 1 | -1) => {
    if (goal.kind !== 'measure') return
    let v = goal.value + dir * goal.step
    v = Math.max(0, Math.min(goal.target * 1.5, Math.round(v * 100) / 100))
    goal.patch(v)
  }
  return (
    <View className={`py-3.5 ${first ? '' : 'border-t border-white/5'}`}>
      <View className="flex-row items-center gap-3">
        <GoalTile goal={goal} colors={colors} size={40} />
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="text-[14px] font-semibold text-white">{goal.label}</Text>
          <Text numberOfLines={1} className="mt-0.5 text-[12px]" style={{ color: goal.done ? colors.brand400 : 'rgba(255,255,255,0.45)' }}>{subLine}</Text>
        </View>
        {goal.kind === 'measure' ? (
          <View className="flex-row items-center gap-2.5">
            <StepButton variant="minus" onPress={() => bump(-1)} colors={colors} />
            <StepButton variant="plus" onPress={() => bump(1)} colors={colors} />
          </View>
        ) : goal.done ? (
          <View className="flex-row items-center gap-1.5 rounded-full px-3 py-2" style={{ backgroundColor: `${colors.brand400}26` }}>
            <Check size={14} strokeWidth={3} color={colors.brand400} />
            <Text className="text-[13px] font-bold" style={{ color: colors.brand400 }}>Done</Text>
          </View>
        ) : (
          <PressableScale onPress={() => { onClose(); goal.onOpen() }} scaleTo={0.96}>
            <View className="flex-row items-center gap-1 rounded-full px-3.5 py-2" style={{ backgroundColor: colors.brand400 }}>
              <Text className="text-[13px] font-extrabold text-black">{goal.cta}</Text>
              <ArrowRight size={14} strokeWidth={2.6} color="#000" />
            </View>
          </PressableScale>
        )}
      </View>
    </View>
  )
}

function UpdateTodaySheet({ open, onClose, goals, doneCount, total, colors }: { open: boolean; onClose: () => void; goals: Goal[]; doneCount: number; total: number; colors: ThemeColors }) {
  return (
    <Sheet open={open} onClose={onClose} title="Update today">
      <Text className="-mt-1 text-[13px] text-white/50">{doneCount} of {total} on track</Text>
      <View className="mt-3">
        {goals.map((g, i) => (
          <SheetGoalRow key={g.id} goal={g} first={i === 0} colors={colors} onClose={onClose} />
        ))}
      </View>
      <PressableScale onPress={onClose} containerStyle={{ marginTop: 22 }} scaleTo={0.98}>
        <View className="items-center rounded-full py-3.5" style={{ backgroundColor: colors.brand400 }}>
          <Text className="text-[15px] font-extrabold text-black">Done</Text>
        </View>
      </PressableScale>
    </Sheet>
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
