import { useEffect, useRef, useState, type ReactNode } from 'react'
import { View, Text, Pressable, Image, Animated, Easing, Platform, ScrollView, StyleSheet, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, G, Defs, RadialGradient, Stop, Rect } from 'react-native-svg'
import { LinearGradient } from 'expo-linear-gradient'
import { Menu, MessageCircle, Clock, GraduationCap, ChevronRight, Leaf, Check, Flame, ChevronDown, Info, ArrowRight, X, SlidersHorizontal } from 'lucide-react-native'
import { Icon } from '../components/Icon'
import { ActivityIcon } from '../components/ActivityIcon'
import { Card } from '../components/ui'
import { MuscleMapCard, MuscleFigures } from '../components/MuscleMapCard'
import { AppModal, IS_WEB, WEB_SCREEN } from '../components/WebFrame'
import { PressableScale } from '../components/PressableScale'
import { IndexGauge } from '../components/IndexGauge'
import { useStore } from '../store/store'
import { useNav } from '../nav'
import { currentWeekKeys, todayKey, longDate, shortDate, fromKey, currentHour } from '../lib/date'
import { fmtFluid, fmtWeightNum, weightUnit, fmtVolume } from '../lib/format'
import { prefersReducedMotion } from '../lib/a11y'
import {
  todayHabit, habitForDay, todaySession, sessionForDay, activitiesForDay,
  unreadChat, streakStats, foodReviewForDay, weeklyIndex, nutritionTagsForDay,
  workoutStartedForDay, sessionProgress,
} from '../store/selectors'
import { tagById, NUTRITION_TAGS, type TagTone } from '../data/nutrition'
import { dashboardStatIds, dashboardTimeframe, statById, timeframeLabel, type StatResult } from '../lib/metrics'
import { dailyTargets, examState } from '../store/training'
import { activePeriod, upcomingPeriods, daysLabel, daysUntil, fmtPeriodDate, nextDayKey } from '../store/periods'
import { Wordmark } from '../components/Logo'
import { brand, accent, accentFor, useColors, type AccentKey } from '../theme'

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
  const selSession = sessionForDay(state, selDate)
  const selActivities = activitiesForDay(state, selDate)
  const selTags = nutritionTagsForDay(state, selDate)
  const selWeekday = FULL_WD[fromKey(selDate).getDay()]
  const selTitle = isToday ? "Today's progress" : `${selWeekday}'s progress`

  // The five rings and the old "To-do today" list were two views of the same day,
  // stacked. They're now one checklist, built for whichever day the week strip has
  // selected. The goal list itself is built by useDayGoals (shared with the
  // standalone log-progress overlay).
  const isRestDay = !selSession
  const selWorkoutDone = isRestDay || workoutStartedForDay(state, selDate) || (selSession?.completed ?? false)

  // CTA for the muscle-map plan card, driven by today's tick progress (mirrors the Workout tab).
  const selProg = selSession ? sessionProgress(selSession) : null
  const todayPlanCta =
    selProg && selProg.total > 0 && selProg.done === selProg.total ? 'Completed'
    : selProg && selProg.done > 0 ? 'Continue Workout'
    : 'Start Workout'

  const { goals, goalsDone } = useDayGoals(selDate)

  const [sheetOpen, setSheetOpen] = useState(false)
  const openSheet = () => setSheetOpen(true)
  // Editor for retro-logging a past day (opened from the summary card's "Update").
  const [pastEditorOpen, setPastEditorOpen] = useState(false)

  // Progress overview: the picked stats, computed over the picked window.
  const timeframe = dashboardTimeframe(state)
  const overviewStats = dashboardStatIds(state)
    .map((id) => {
      const metric = statById(id)
      return metric ? { id, metric, result: metric.compute(state, units, timeframe) } : null
    })
    .filter(Boolean) as { id: string; metric: NonNullable<ReturnType<typeof statById>>; result: StatResult }[]

  const chevron = 'rgba(148,148,148,0.55)'

  return (
    <View className="px-5 pt-2">
      <View className="mb-4 flex-row items-center justify-between">
        <Pressable accessibilityRole="button" accessibilityLabel="Open menu" onPress={() => nav.openMenu()} className="h-10 w-10 items-center justify-center rounded-xl active:opacity-70">
          <Menu size={24} color={colors.fg} />
        </Pressable>
        <Wordmark size="sm" />
        <Pressable onPress={() => nav.open('coachChat')} accessibilityRole="button" accessibilityLabel={unread > 0 ? `Open coach, ${unread} unread` : 'Open coach'} className="relative h-10 w-10 items-center justify-center rounded-xl active:opacity-70">
          <MessageCircle size={23} color={colors.fg} />
          {unread > 0 && <View className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand-400" style={{ borderWidth: 2, borderColor: colors.ink900 }} />}
        </Pressable>
      </View>

      {/* Weekly performance index */}
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-[20px] font-extrabold tracking-tight text-white">{greeting}, {state.profile.name}</Text>
          <Text className="mt-0.5 text-[13px] text-secondary">{longDate(todayKey)}</Text>
        </View>
        {streak.current > 0 && <StreakChip days={streak.current} atRisk={streakAtRisk} onPress={() => nav.open('logProgress')} />}
      </View>

      {/* Keep-the-streak nudge — only when today isn't logged yet. Opens the
          shared log-progress editor (the same overlay the coach routes to). */}
      {streakAtRisk && (
        <Pressable onPress={() => nav.open('logProgress')} className="mt-3 flex-row items-center gap-2 rounded-2xl border border-accent-orange/25 bg-accent-orange/10 px-3.5 py-2.5 active:opacity-80">
          <Flame size={16} color={accent.orange} />
          <Text className="flex-1 text-[13px] font-semibold text-white/80">Log anything today to keep your {streak.current}-day streak alive.</Text>
          <ChevronRight size={16} color={accent.orange} />
        </Pressable>
      )}

      <Pressable onPress={() => setShowWhy((v) => !v)} accessibilityRole="button" accessibilityLabel="Explain your readiness score" className="active:opacity-90">
        <View className="mt-2"><IndexGauge index={idx} /></View>
        <Text className="mt-2 text-center text-[13px] leading-snug text-secondary">{idx.blurb}</Text>
        <View className="mt-1.5 flex-row items-center justify-center gap-1">
          <Info size={12} color="rgba(148,148,148,0.7)" />
          <Text className="text-[12px] font-semibold text-secondary">{showWhy ? 'Hide the breakdown' : 'What moves this score?'}</Text>
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
          <Text className="mt-1 text-[12px] leading-snug text-secondary">
            It blends your last 14 days across five habits versus your targets. <Text className="font-semibold text-white/75">50 means on track</Text>. Higher means you're beating your goals. Hit your targets and each bar fills toward 100%.
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
          // A day is green only when everything is logged: steps, sleep, water, a
          // nutrition check-in, and the workout (or a rest day). If even one is
          // missing the dot is orange, so nothing slips through unlogged.
          const dayHabit = habitForDay(state, k)
          const sess = sessionForDay(state, k)
          const workoutLogged = !sess || workoutStartedForDay(state, k) || sess.completed || (state.activities ?? []).some((a) => a.dateKey === k)
          const fullyLogged =
            dayHabit.steps > 0 && dayHabit.sleepH > 0 && dayHabit.waterL > 0 &&
            (nutritionTagsForDay(state, k).length > 0 || !!foodReviewForDay(state, k)) &&
            workoutLogged
          const date = parseInt(k.slice(-2))
          return (
            <Pressable key={k} disabled={future} onPress={() => { setSelDate(k); setPastEditorOpen(false) }} className={`w-10 items-center gap-1.5 rounded-xl py-1.5 ${future ? 'opacity-30' : 'active:opacity-70'}`}>
              <Text className={`text-[10px] font-semibold uppercase tracking-wide ${today ? 'text-brand-400' : 'text-tertiary'}`}>{WD[i]}</Text>
              {/* Selected day = a filled disc with a ring around it (a small gap
               *  between). Today keeps a ring even when it isn't the selected day so
               *  it stays marked. */}
              <View className={`h-8 w-8 items-center justify-center rounded-full ${selected || today ? 'border-2 border-brand-400' : 'border-2 border-transparent'}`}>
                <View className={`h-6 w-6 items-center justify-center rounded-full ${selected ? 'bg-brand-400' : ''}`}>
                  <Text className={`text-[14px] font-bold ${selected ? 'text-black' : today ? 'text-brand-400' : 'text-white/75'}`}>{date}</Text>
                </View>
              </View>
              <View className={`h-1.5 w-1.5 rounded-full ${future ? 'bg-transparent' : fullyLogged ? 'bg-brand-400' : 'bg-accent-orange'}`} />
            </Pressable>
          )
        })}
      </View>

      {/* Plan / workout: follows the selected day */}
      <Section title={isToday ? "Today's plan" : `${selWeekday}'s workout`} />
      {selSession ? (
        isToday ? (
          <MuscleMapCard
            session={selSession}
            sex={state.profile.sex}
            ctaLabel={todayPlanCta}
            onPress={() => nav.open('activeWorkout')}
          />
        ) : (
          // Past day: the muscle map (that day's trained groups), kept at the
          // compact height the photo card used, with a read-only exercise list below.
          <View style={{ position: 'relative', overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: `${colors.fg}0d`, backgroundColor: colors.ink800 }}>
            <View style={{ position: 'absolute', top: 6, bottom: 6, right: 4, width: 150 }} pointerEvents="none">
              <MuscleFigures session={selSession} sex={state.profile.sex} c={colors} />
            </View>
            <LinearGradient colors={[colors.ink800, `${colors.ink800}99`, `${colors.ink800}00`]} locations={[0.25, 0.47, 0.74]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <View className="p-5">
              <Text className="text-sm font-semibold text-brand-400">{selSession.completed ? 'Completed' : 'Logged'}</Text>
              <Text className="mt-1 text-2xl font-extrabold tracking-tight text-white">{selSession.name}</Text>
              <View className="mt-2 flex-row items-center gap-1.5">
                <Clock size={15} color="rgba(255,255,255,0.6)" />
                <Text className="text-sm text-secondary">{selSession.exercises.length} exercises · {selSession.durationMin} min · {fmtVolume(selSession.volumeKg, units)}</Text>
              </View>
            </View>
          </View>
        )
      ) : (
        // Rest day: same card, muscle figures shown but nothing highlighted.
        <View style={{ position: 'relative', overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: `${colors.fg}0d`, backgroundColor: colors.ink800 }}>
          <View style={{ position: 'absolute', top: 6, bottom: 6, right: 4, width: 150 }} pointerEvents="none">
            <MuscleFigures sex={state.profile.sex} c={colors} />
          </View>
          <LinearGradient colors={[colors.ink800, `${colors.ink800}99`, `${colors.ink800}00`]} locations={[0.25, 0.47, 0.74]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
          <View className="p-5">
            <View className="flex-row items-center gap-2">
              <Text className="text-sm font-semibold text-brand-400">{isToday ? "Today's plan" : 'Rest day'}</Text>
              {exam.active && isToday && <View className="rounded-full bg-accent-purple/20 px-2 py-0.5"><Text className="text-[10px] font-bold text-accent-purple">Exam mode</Text></View>}
            </View>
            <Text className="mt-1 text-2xl font-extrabold tracking-tight text-white">Rest day</Text>
            <View className="mt-2 flex-row items-center gap-1.5">
              <Clock size={15} color="rgba(255,255,255,0.6)" />
              <Text className="text-sm text-secondary">Recovery and mobility</Text>
            </View>
          </View>
        </View>
      )}

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
                <Text className="text-[12px] text-secondary">{doneSets.length || ex.sets.length} × {fmtWeightNum(top, units, units === 'imperial' ? 0 : 1)} {weightUnit(units)}</Text>
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
                <Text className="text-[12px] capitalize text-secondary">{a.minutes} min · {a.intensity}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {!isToday && !selSession && selActivities.length === 0 && (
        <Text className="mt-3 rounded-2xl border border-dashed border-white/15 py-4 text-center text-[13px] text-tertiary">No workout or activity logged on {shortDate(selDate)}.</Text>
      )}

      {/* Progress — the merged checklist for today (opens the update sheet), or an
       *  editable "catch-up" log for a past day so nothing gets missed. */}
      <Section title={selTitle} tight />
      {isToday && t.adjusted && <Text className="-mt-1 mb-3 text-[12px] text-accent-purple">Targets eased for exam season</Text>}
      <DayProgressCard
        goals={goals}
        doneCount={goalsDone}
        total={goals.length}
        onUpdate={isToday ? openSheet : () => setPastEditorOpen(true)}
        tags={selTags}
        onTag={isToday ? () => nav.goTab('nutrition') : () => setPastEditorOpen(true)}
        colors={colors}
      />

      {/* Progress overview — the stats and the window they're measured over both
       *  live behind "Customise". */}
      <View className="mt-7 flex-row items-end justify-between" style={{ marginBottom: 12 }}>
        <View className="min-w-0 flex-1">
          <Text className="text-[19px] font-extrabold text-white" style={{ letterSpacing: -0.19 }}>Progress overview</Text>
          <Text className="mt-[3px] text-[12px] font-semibold text-secondary">{timeframeLabel(timeframe)}</Text>
        </View>
        <Pressable onPress={() => nav.open('customize')} hitSlop={8} className="ml-3 flex-row items-center gap-[5px] active:opacity-70">
          <SlidersHorizontal size={16} color={colors.brand400} strokeWidth={1.8} />
          <Text className="text-[14px] font-bold" style={{ color: colors.brand400 }}>Customise</Text>
        </Pressable>
      </View>
      <View className="flex-row" style={{ gap: 10 }}>
        {overviewStats.map(({ id, metric, result }) => (
          <OverviewCard key={id} accent={accentFor(metric.accent, colors)} result={result} colors={colors} single={overviewStats.length === 1} />
        ))}
      </View>

      {/* When is your busy period? — exams, travel, moving house. */}
      <Text className="text-[19px] font-extrabold text-white" style={{ marginTop: 26, marginBottom: 17 }}>When is your busy period?</Text>
      <BusyPeriodCard colors={colors} onPress={() => nav.open('examMode')} />

      {/* More tools */}
      {state.profile.newToGym && (
        <>
          <Section title="More" tight />
          <Pressable onPress={() => nav.open('beginner')} className="flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-3.5 active:opacity-90">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-brand-400/15"><Leaf size={20} color={brand[400]} /></View>
            <View className="flex-1">
              <Text className="font-bold text-white">New to the gym</Text>
              <Text className="text-[12px] text-secondary">Your first 90 days, step by step</Text>
            </View>
            <ChevronRight size={18} color={chevron} />
          </Pressable>
        </>
      )}
      <View className="h-2" />

      {isToday && (
        <UpdateTodaySheet open={sheetOpen} onClose={() => setSheetOpen(false)} goals={goals} doneCount={goalsDone} total={goals.length} colors={colors} />
      )}
      {!isToday && (
        <DayEditorSheet
          open={pastEditorOpen}
          onClose={() => setPastEditorOpen(false)}
          dateKey={selDate}
          dayLabel={selWeekday}
          goals={goals}
          tags={selTags}
          workoutDone={selWorkoutDone}
          isRestDay={isRestDay}
          colors={colors}
          dispatch={dispatch}
        />
      )}
    </View>
  )
}

/* Streak chip with a gently flickering flame — the core-loop badge, so it should
 * feel alive rather than static. Pressable to jump straight to logging. */
function StreakChip({ days, atRisk, onPress }: { days: number; atRisk: boolean; onPress: () => void }) {
  const flicker = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (prefersReducedMotion()) return // hold the flame still for reduce-motion users
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
        <Text numberOfLines={1} className={`text-[15px] font-bold ${goal.done ? 'text-tertiary' : 'text-white'}`} style={{ textDecorationLine: goal.done ? 'line-through' : 'none' }}>{goal.label}</Text>
        <Text numberOfLines={1} className={`mt-0.5 text-[12.5px] ${goal.done ? 'text-tertiary' : 'text-secondary'}`}>{goalSub(goal)}</Text>
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
        <Text className="text-[13px] font-semibold text-secondary">of {total} done</Text>
        {onUpdate ? (
          <Pressable onPress={onUpdate} hitSlop={8} className="ml-auto active:opacity-60">
            <Text className="text-[12.5px] font-bold" style={{ color: colors.brand400 }}>Update →</Text>
          </Pressable>
        ) : (
          <Text className="ml-auto text-[12.5px] text-tertiary">{stamp}</Text>
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
        <Text className="text-[12px] font-bold uppercase tracking-wide text-tertiary">Food check-in</Text>
        <Text className="ml-auto text-[11px] text-tertiary">from your nutrition log</Text>
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
        <Text className="text-[13px] text-tertiary">No food tags for this day</Text>
      )}
    </View>
  )
}

/* ---- Day editor -------------------------------------------------------------
   One sheet for logging any day. Both today and a past catch-up open it from the
   summary card's "Update", so a user who forgot can still fill the day in:
   steppers for the measurable goals, a workout completed toggle, and the same 16
   "how did your eating go" tags. Every write targets the selected day. -------- */

function PastStepper({ onDec, onInc, colors }: { onDec: () => void; onInc: () => void; colors: ThemeColors }) {
  return (
    <View className="flex-row items-center" style={{ gap: 8 }}>
      <PressableScale onPress={onDec} scaleTo={0.9} hitSlop={8} accessibilityRole="button" accessibilityLabel="Decrease">
        <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' }}>
          <Text style={{ fontSize: 20, lineHeight: 23, color: colors.fg }}>−</Text>
        </View>
      </PressableScale>
      <PressableScale onPress={onInc} scaleTo={0.9} hitSlop={8} accessibilityRole="button" accessibilityLabel="Increase">
        <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: `${colors.brand400}2e` }}>
          <Text style={{ fontSize: 20, lineHeight: 23, color: colors.brand400 }}>+</Text>
        </View>
      </PressableScale>
    </View>
  )
}

function DayEditorSheet({ open, onClose, dateKey, dayLabel, goals, tags, workoutDone, isRestDay, colors, dispatch }: {
  open: boolean
  onClose: () => void
  dateKey: string
  dayLabel: string
  goals: Goal[]
  tags: string[]
  workoutDone: boolean
  isRestDay: boolean
  colors: ThemeColors
  dispatch: (action: any) => void
}) {
  const win = useWindowDimensions()
  const screenH = IS_WEB ? WEB_SCREEN.height : win.height
  const insets = useSafeAreaInsets()
  const [render, setRender] = useState(open)
  const [panelH, setPanelH] = useState(560)
  const progress = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (open) {
      setRender(true)
      Animated.timing(progress, { toValue: 1, duration: 440, easing: SHEET_EASE, useNativeDriver: Platform.OS !== 'web' }).start()
    } else if (render) {
      Animated.timing(progress, { toValue: 0, duration: 320, easing: SHEET_EASE, useNativeDriver: Platform.OS !== 'web' }).start(({ finished }) => { if (finished) setRender(false) })
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const round = (v: number) => Math.round(v * 100) / 100
  const measures = goals.filter((g): g is Extract<Goal, { kind: 'measure' }> => g.kind === 'measure')

  return (
    <AppModal visible={render} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', opacity: progress }}>
          <Pressable accessibilityLabel="Close" onPress={onClose} style={{ flex: 1 }} />
        </Animated.View>

        <Animated.View
          onLayout={(e) => setPanelH(e.nativeEvent.layout.height)}
          style={{
            maxHeight: screenH * 0.86, backgroundColor: colors.ink800,
            borderTopLeftRadius: 28, borderTopRightRadius: 28,
            shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 40, shadowOffset: { width: 0, height: -12 }, elevation: 24,
            transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [panelH, 0] }) }],
          }}
        >
          <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6 }}>
            <View style={{ width: 38, height: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 12 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>Update {dayLabel}</Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>Fill in what you did. It still counts.</Text>
              </View>
              <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close" style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' }}>
                <X size={14} color="rgba(255,255,255,0.5)" strokeWidth={2.5} />
              </Pressable>
            </View>
          </View>

          <ScrollView style={{ paddingHorizontal: 20 }} contentContainerStyle={{ paddingTop: 2, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
            {measures.map((g, i) => (
              <View key={g.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: 'rgba(255,255,255,0.06)' }}>
                <GoalTile goal={g} colors={colors} size={38} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>{g.label}</Text>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>{g.fmt(g.value)} / {g.fmt(g.target)}</Text>
                </View>
                <PastStepper onDec={() => g.patch(Math.max(0, round(g.value - g.step)))} onInc={() => g.patch(round(g.value + g.step))} colors={colors} />
              </View>
            ))}

            {/* Workout completed toggle */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: `${colors.brand400}26` }}>
                <Icon name="dumbbell" size={18} color={colors.brand400} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Workout</Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>{isRestDay ? 'Rest day' : workoutDone ? 'Marked complete' : 'Not completed'}</Text>
              </View>
              {!isRestDay && (
                <PressableScale onPress={() => dispatch({ type: 'SET_WORKOUT_DONE', dateKey, done: !workoutDone })} scaleTo={0.96}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: workoutDone ? colors.brand400 : 'rgba(255,255,255,0.08)' }}>
                    {workoutDone && <Check size={14} strokeWidth={3} color="#000" />}
                    <Text style={{ fontSize: 13, fontWeight: '700', color: workoutDone ? '#000' : 'rgba(255,255,255,0.7)' }}>{workoutDone ? 'Completed' : 'Mark done'}</Text>
                  </View>
                </PressableScale>
              )}
            </View>

            {/* How did your eating go? — the 16 tags, toggled for this day */}
            <View style={{ marginTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 16 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff' }}>How did your eating go?</Text>
              <Text style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.45)', marginTop: 2, marginBottom: 12 }}>Tap any that fit. These show on your dashboard.</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {NUTRITION_TAGS.map((tg) => {
                  const on = tags.includes(tg.id)
                  const tint = toneColor(tg.tone, colors)
                  return (
                    <Pressable
                      key={tg.id}
                      onPress={() => dispatch({ type: 'TOGGLE_NUTRITION_TAG', tag: tg.id, dateKey })}
                      style={{ width: '48%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, paddingHorizontal: 11, borderRadius: 13, backgroundColor: on ? `${tint}29` : 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: on ? `${tint}80` : 'transparent' }}
                      className="active:opacity-80"
                    >
                      <Text style={{ fontSize: 17, lineHeight: 20 }}>{tg.emoji}</Text>
                      <Text numberOfLines={2} style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: '600', lineHeight: 15, color: on ? tint : 'rgba(255,255,255,0.75)' }}>{tg.label}</Text>
                      {on && <Check size={13} strokeWidth={3.4} color={tint} />}
                    </Pressable>
                  )
                })}
              </View>
            </View>
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

/* ---- Shared day view-model ------------------------------------------------
   The goal checklist for a given day, built once here so the dashboard AND the
   standalone "log progress" overlay (LogProgressSheet, below) render the exact
   same rows. Every write targets `dateKey`. -------------------------------- */
export function useDayGoals(dateKey: string): {
  goals: Goal[]
  goalsDone: number
  tags: string[]
  workoutDone: boolean
  isRestDay: boolean
  dayLabel: string
} {
  const { state, dispatch } = useStore()
  const nav = useNav()
  const colors = useColors()
  const units = state.settings.units
  const t = dailyTargets(state)
  const isToday = dateKey === todayKey
  const habit = habitForDay(state, dateKey)
  const session = sessionForDay(state, dateKey)
  const tags = nutritionTagsForDay(state, dateKey)
  const foodReview = foodReviewForDay(state, dateKey)
  const checkedIn = tags.length > 0 || !!foodReview
  const isRestDay = !session
  const workoutDone = isRestDay || workoutStartedForDay(state, dateKey) || (session?.completed ?? false)
  const dayLabel = FULL_WD[fromKey(dateKey).getDay()]

  const goals: Goal[] = [
    { id: 'steps', kind: 'measure', icon: 'footprints', tile: colors.brand400, label: 'Steps', done: habit.steps >= t.steps, value: habit.steps, target: t.steps, step: 500, fmt: (v) => Math.round(v).toLocaleString(), patch: (v) => dispatch({ type: 'PATCH_HABIT', dateKey, patch: { steps: v } }) },
    { id: 'sleep', kind: 'measure', icon: 'moon', tile: colors.accentPurple, label: 'Sleep', done: habit.sleepH >= t.sleepH, value: habit.sleepH, target: t.sleepH, step: 0.5, fmt: (v) => `${Math.round(v * 10) / 10} hrs`, patch: (v) => dispatch({ type: 'PATCH_HABIT', dateKey, patch: { sleepH: v } }) },
    { id: 'water', kind: 'measure', icon: 'droplet', tile: colors.accentBlue, label: 'Water', done: habit.waterL >= t.waterL, value: habit.waterL, target: t.waterL, step: 0.2, fmt: (v) => fmtFluid(v, units), patch: (v) => dispatch({ type: 'PATCH_HABIT', dateKey, patch: { waterL: v } }) },
    { id: 'nutrition', kind: 'auto', icon: 'leaf', tile: colors.accentOrange, label: isToday ? "Today's nutrition choices" : 'Nutrition choices', done: checkedIn, sub: checkedIn ? 'Checked in · auto' : isToday ? 'Not checked in yet' : 'No check-in', sheetValue: checkedIn ? 'Checked in' : 'Not checked in yet', cta: 'Log', onOpen: () => nav.goTab('nutrition') },
    { id: 'workout', kind: 'auto', icon: 'dumbbell', tile: colors.brand400, label: 'Workout', done: workoutDone, sub: isRestDay ? 'Rest day · auto' : `${session!.name} · ${workoutDone ? 'auto' : 'not started'}`, sheetValue: isRestDay ? 'Rest day' : workoutDone ? 'Completed' : 'Not yet', cta: 'Start', onOpen: () => (session ? nav.open('activeWorkout') : nav.goTab('workout')) },
  ]
  const goalsDone = goals.filter((g) => g.done).length
  return { goals, goalsDone, tags, workoutDone, isRestDay, dayLabel }
}

/** The "log progress" day editor as a standalone overlay (nav 'logProgress') so
 *  the coach and the streak nudge can open it from anywhere — always today. */
export function LogProgressSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dispatch } = useStore()
  const colors = useColors()
  const { goals, tags, workoutDone, isRestDay, dayLabel } = useDayGoals(todayKey)
  return (
    <DayEditorSheet
      open={open}
      onClose={onClose}
      dateKey={todayKey}
      dayLabel={dayLabel}
      goals={goals}
      tags={tags}
      workoutDone={workoutDone}
      isRestDay={isRestDay}
      colors={colors}
      dispatch={dispatch}
    />
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
        <PressableScale onPress={() => bump(-1)} scaleTo={0.9} accessibilityLabel={`Decrease ${goal.label}`}>
          <View style={[S.stepBtn, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
            <Text style={[S.stepGlyph, { color: colors.fg }]}>−</Text>
          </View>
        </PressableScale>
        <Text style={S.stepValue}>{goal.fmt(goal.value)} / {goal.fmt(goal.target)}</Text>
        <PressableScale onPress={() => bump(1)} scaleTo={0.9} accessibilityLabel={`Increase ${goal.label}`}>
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

/* ---- Progress overview + "When is your busy period?" (design 1:1) -------- */

/**
 * One stat tile. The delta pill is the whole point of the card: it's green when
 * the number moved the way this metric wants (which for body weight is *down*),
 * red when it moved against, and neutral grey when nothing changed.
 */
function OverviewCard({ accent, result, colors, single = false }: { accent: string; result: StatResult; colors: ThemeColors; single?: boolean }) {
  const flat = result.dir === 'flat'
  const pillColor = flat ? `${colors.fg}66` : result.good ? colors.brand400 : colors.danger
  const pillBg = flat ? `${colors.fg}12` : `${result.good ? colors.brand400 : colors.danger}24`
  const arrow = result.dir === 'down' ? '↓' : '↑'
  const pill = (
    <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: pillBg }}>
      <Text numberOfLines={1} style={{ fontSize: single ? 12 : 11, fontWeight: '700', color: pillColor }}>
        {result.arrow ? `${arrow} ${result.delta}` : result.delta}
      </Text>
    </View>
  )
  const cardShadow = { shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3 } as const

  // A lone stat has the whole row to itself — centre it as a small hero rather
  // than leaving the number stranded in the top-left of a wide, empty card.
  if (single) {
    return (
      <LinearGradient
        colors={[colors.ink700, colors.ink800]}
        style={{ flex: 1, minWidth: 0, borderRadius: 18, paddingVertical: 22, paddingHorizontal: 16, alignItems: 'center', borderWidth: 1, borderColor: `${colors.fg}0f`, ...cardShadow }}
      >
        <View style={{ width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: `${accent}26` }}>
          <Icon name={result.icon} size={20} color={accent} />
        </View>
        <Text numberOfLines={1} className="mt-3 text-[12.5px] font-semibold text-secondary" style={{ textAlign: 'center' }}>{result.label}</Text>
        <View className="mt-1.5 flex-row items-baseline justify-center" style={{ gap: 3 }}>
          <Text className="font-extrabold text-white" style={{ fontSize: 34, letterSpacing: -1 }}>{result.value}</Text>
          {!!result.unit && <Text className="text-[14px] text-secondary">{result.unit}</Text>}
        </View>
        <View className="mt-2.5">{pill}</View>
      </LinearGradient>
    )
  }

  return (
    <LinearGradient
      colors={[colors.ink700, colors.ink800]}
      style={{
        flex: 1, minWidth: 0, borderRadius: 18, paddingHorizontal: 13, paddingTop: 13, paddingBottom: 12,
        borderWidth: 1, borderColor: `${colors.fg}0f`, ...cardShadow,
      }}
    >
      <View style={{ width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: `${accent}26` }}>
        <Icon name={result.icon} size={15} color={accent} />
      </View>
      <Text numberOfLines={1} className="mt-2.5 text-[11.5px] font-semibold text-secondary">{result.label}</Text>
      <View className="mt-[5px] flex-row items-baseline" style={{ gap: 2 }}>
        <Text className="text-[24px] font-extrabold text-white" style={{ letterSpacing: -0.7 }}>{result.value}</Text>
        {!!result.unit && <Text className="text-[12px] text-secondary">{result.unit}</Text>}
      </View>
      <View className="mt-[9px] flex-row">{pill}</View>
    </LinearGradient>
  )
}

/**
 * The entry point to Plan Around Your Life. Its chip and subtitle are the whole
 * status at a glance: mid-period it says when normal training returns, with
 * something scheduled it counts down to the next one, and with nothing set it
 * explains what the feature is for rather than showing an empty state.
 */
function BusyPeriodCard({ colors, onPress }: { colors: ThemeColors; onPress: () => void }) {
  const { state } = useStore()
  const active = activePeriod(state)
  const upcoming = upcomingPeriods(state)

  let chipLabel: string
  let chipAccent: AccentKey
  let subtitle: string
  if (active) {
    chipLabel = 'Active now'
    chipAccent = 'brand'
    subtitle = `Active now · returns ${fmtPeriodDate(nextDayKey(active.end))}`
  } else if (upcoming.length === 0) {
    chipLabel = 'Set up'
    chipAccent = 'fg'
    subtitle = "Add exams, travel or other busy dates and we'll adapt your training."
  } else {
    chipLabel = 'Scheduled'
    chipAccent = 'purple'
    const next = Math.min(...upcoming.map((p) => daysUntil(p.start)))
    subtitle = `${upcoming.length} period${upcoming.length > 1 ? 's' : ''} set · next ${daysLabel(next)}`
  }
  const chipCol = accentFor(chipAccent, colors)
  const neutralChip = chipAccent === 'fg'

  return (
    <PressableScale onPress={onPress} scaleTo={0.99} accessibilityLabel="Plan Around Your Life">
      {/* The design's radial purple wash: a glow anchored at the left-middle
       *  (behind the icon, at 0% 45%) that fades out to the page colour. An SVG
       *  radial gives the real thing on web and native alike — expo-linear-gradient
       *  can only ramp in a straight line. The shadow sits on the outer view so the
       *  inner overflow:hidden can clip the gradient to the rounded corners. */}
      <View
        style={{
          borderRadius: 22, backgroundColor: colors.ink900,
          shadowColor: '#000', shadowOpacity: 0.32, shadowRadius: 22, shadowOffset: { width: 0, height: 8 }, elevation: 4,
        }}
      >
        <View style={{ borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: `${colors.accentPurple}33`, padding: 16 }}>
          <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
            <Defs>
              <RadialGradient id="busyGlow" cx="0" cy="45" r="130" gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={colors.accentPurple} stopOpacity={0.32} />
                <Stop offset="0.42" stopColor={colors.accentPurple} stopOpacity={0.1} />
                <Stop offset="0.8" stopColor={colors.ink900} stopOpacity={1} />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100" height="100" fill="url(#busyGlow)" />
          </Svg>
          <View className="flex-row items-center" style={{ gap: 14 }}>
            <View
              style={{
                width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
                backgroundColor: `${colors.accentPurple}52`,
                shadowColor: colors.accentPurple, shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
              }}
            >
              <GraduationCap size={22} color={colors.accentPurple} strokeWidth={1.8} />
            </View>
            <View className="min-w-0 flex-1">
              <View className="flex-row items-start" style={{ gap: 8 }}>
                <Text className="text-[16px] font-bold text-white">Plan Around Your Life</Text>
                <View style={{ borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: `${chipCol}${neutralChip ? '1a' : '26'}` }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: neutralChip ? `${colors.fg}b3` : chipCol }}>{chipLabel}</Text>
                </View>
              </View>
              <Text className="mt-[3px] text-[13px] text-secondary">{subtitle}</Text>
            </View>
            <ChevronRight size={20} color={`${colors.fg}66`} />
          </View>
        </View>
      </View>
    </PressableScale>
  )
}
