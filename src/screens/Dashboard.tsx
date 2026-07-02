import { useState, type ReactNode } from 'react'
import { View, Text, Pressable, Image } from 'react-native'
import { Menu, MessageCircle, Clock, Play, GraduationCap, ChevronRight, Leaf, Check, Flame } from 'lucide-react-native'
import { Icon } from '../components/Icon'
import { ActivityIcon } from '../components/ActivityIcon'
import { Card, ProgressRing } from '../components/ui'
import { Hero } from '../components/Hero'
import { IndexGauge } from '../components/IndexGauge'
import { useStore } from '../store/store'
import { useNav } from '../nav'
import { currentWeekKeys, todayKey, longDate, shortDate, fromKey, TODAY } from '../lib/date'
import { fmtFluid, fmtWeightNum, weightUnit, fmtVolume, pct } from '../lib/format'
import {
  todayHabit, habitForDay, todaySession, sessionForDay, activitiesForDay,
  unreadChat, streakStats, foodReviewForDay, weeklyIndex, nutritionTagsForDay,
  nutritionAskedForDay, workoutStartedForDay,
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

type Task = {
  id: string
  icon: string
  label: string
  hint: string
  done: boolean
  onPress: () => void
}

export default function Dashboard() {
  const { state } = useStore()
  const nav = useNav()
  const colors = useColors()
  const units = state.settings.units
  const habit = todayHabit(state)
  const session = todaySession(state)
  const unread = unreadChat(state)
  const t = dailyTargets(state)
  const exam = examState(state)
  const streak = streakStats(state)
  const foodReview = foodReviewForDay(state)
  const idx = weeklyIndex(state)
  const weightLoggedToday = state.weights.some((x) => x.dateKey === todayKey)

  const greeting = greetingFor(TODAY.getHours())
  const weekKeys = currentWeekKeys()

  // The week strip selects which day's data fills the progress section below.
  const [selDate, setSelDate] = useState(todayKey)
  const isToday = selDate === todayKey
  const selHabit = habitForDay(state, selDate)
  const selSession = sessionForDay(state, selDate)
  const selActivities = activitiesForDay(state, selDate)
  const selTags = nutritionTagsForDay(state, selDate)
  const selWeekday = FULL_WD[fromKey(selDate).getDay()]
  const selTitle = isToday ? "Today's progress" : `${selWeekday}'s progress`

  // Two of the goals are simple done/not-done ticks rather than progress rings.
  const asked = nutritionAskedForDay(state, selDate)
  const isRestDay = !selSession
  const workoutDone = isRestDay || workoutStartedForDay(state, selDate) || (selSession?.completed ?? false)

  type Ring =
    | { kind: 'progress'; icon: string; label: string; value: string; pct: number; onPress: () => void }
    | { kind: 'tick'; icon: string; label: string; value: string; done: boolean; onPress: () => void }
  const habitRings: Ring[] = [
    { kind: 'progress', icon: 'footprints', label: 'Steps', value: selHabit.steps.toLocaleString(), pct: pct(selHabit.steps, t.steps), onPress: () => nav.open('logHabit') },
    { kind: 'progress', icon: 'bed', label: 'Sleep', value: `${selHabit.sleepH} hrs`, pct: pct(selHabit.sleepH, t.sleepH), onPress: () => nav.open('logHabit') },
    { kind: 'progress', icon: 'droplet', label: 'Water', value: fmtFluid(selHabit.waterL, units), pct: pct(selHabit.waterL, t.waterL), onPress: () => nav.open('logHabit') },
    { kind: 'tick', icon: 'utensils', label: 'Ask a Q', value: asked ? 'Asked' : 'Ask', done: asked, onPress: () => nav.goTab('nutrition') },
    { kind: 'tick', icon: 'dumbbell', label: 'Workout', value: workoutDone ? (isRestDay && !workoutStartedForDay(state, selDate) ? 'Rest' : 'Done') : 'Start', done: workoutDone, onPress: () => (selSession ? nav.open('activeWorkout') : nav.goTab('workout')) },
  ]
  const ringsOnTrack = habitRings.filter((h) => (h.kind === 'tick' ? h.done : h.pct >= 100)).length

  const tasks: Task[] = []
  if (session) {
    tasks.push({ id: 'workout', icon: 'dumbbell', label: session.completed ? 'Workout complete' : "Today's workout", hint: session.name, done: session.completed, onPress: () => nav.open('activeWorkout') })
  }
  tasks.push({ id: 'water', icon: 'droplet', label: `Drink ${fmtFluid(t.waterL, units)} of water`, hint: `${fmtFluid(habit.waterL, units)} so far`, done: habit.waterL >= t.waterL, onPress: () => nav.open('logHabit') })
  tasks.push({ id: 'weight', icon: 'scale', label: 'Weigh yourself', hint: weightLoggedToday ? 'Logged today' : 'Keep your trend honest', done: weightLoggedToday, onPress: () => nav.open('logWeight') })
  tasks.push({ id: 'meals', icon: 'utensils', label: 'Review your food', hint: foodReview ? `Reviewed · ${foodReview.score}/10` : 'Get coach feedback on today', done: !!foodReview, onPress: () => nav.goTab('nutrition') })
  tasks.push({ id: 'steps', icon: 'footprints', label: `Reach ${t.steps.toLocaleString()} steps`, hint: `${habit.steps.toLocaleString()} today`, done: habit.steps >= t.steps, onPress: () => nav.open('logHabit') })
  const sortedTasks = [...tasks].sort((a, b) => Number(a.done) - Number(b.done))
  const remaining = tasks.filter((x) => !x.done).length

  const chevron = 'rgba(148,148,148,0.55)'

  return (
    <View className="px-5 pt-2">
      <View className="mb-4 flex-row items-center justify-between">
        <Pressable onPress={() => nav.openMenu()} className="h-10 w-10 items-center justify-center rounded-xl active:opacity-70">
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
        {streak.current > 0 && (
          <View className="flex-row shrink-0 items-center gap-1.5 rounded-full bg-accent-orange/15 px-3 py-1.5">
            <Flame size={15} color={accent.orange} />
            <Text className="text-[13px] font-bold text-accent-orange">{streak.current} day{streak.current === 1 ? '' : 's'}</Text>
          </View>
        )}
      </View>

      <View className="mt-2"><IndexGauge index={idx} /></View>
      <Text className="mt-2 text-center text-[13px] leading-snug text-white/55">{idx.blurb}</Text>

      {/* What's driving the needle, colour-coded by area */}
      <View className="mt-4 flex-row justify-between gap-2">
        {idx.parts.map((p) => {
          const good = p.pct >= 85, mid = p.pct >= 55
          const bar = good ? colors.brand400 : mid ? colors.accentOrange : colors.danger
          return (
            <View key={p.label} className="flex-1 items-center gap-1.5">
              <View className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <View className="h-full rounded-full" style={{ width: `${Math.min(100, p.pct)}%`, backgroundColor: bar }} />
              </View>
              <Text className="text-[10px] font-semibold" style={{ color: bar }}>{p.label}</Text>
            </View>
          )
        })}
      </View>

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
              <View className={`h-7 w-7 items-center justify-center rounded-full ${selected ? 'bg-brand-400' : today ? 'border border-brand-400/50' : ''}`}>
                <Text className={`text-[15px] font-bold ${selected ? 'text-black' : today ? 'text-brand-400' : 'text-white/75'}`}>{date}</Text>
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

      {/* Per-day progress */}
      <Section title={selTitle} tight />
      {isToday && t.adjusted && <Text className="-mt-1 mb-3 text-[12px] text-accent-purple">Targets eased for exam season</Text>}
      <Card className="p-4">
        <View className="mb-4 flex-row items-center gap-2">
          <Text className="text-[13px] font-semibold text-white/55">{ringsOnTrack} of {habitRings.length} goals on track</Text>
          <Text className="ml-auto text-[13px] text-white/30">{isToday ? 'Tap to update' : shortDate(selDate)}</Text>
        </View>
        <View className="flex-row justify-between">
          {habitRings.map((h) => {
            const filled = h.kind === 'tick' ? (h.done ? 100 : 0) : h.pct
            const showTick = h.kind === 'tick' && h.done
            return (
              <Pressable key={h.label} onPress={isToday ? h.onPress : undefined} className={`items-center gap-1.5 ${isToday ? 'active:opacity-80' : ''}`}>
                <ProgressRing value={filled} size={54} stroke={4} color={brand[400]}>
                  {showTick
                    ? <Check size={20} strokeWidth={3} color={brand[400]} />
                    : <Icon name={h.icon} size={19} color={h.kind === 'tick' ? 'rgba(148,148,148,0.5)' : brand[400]} />}
                </ProgressRing>
                <Text className="text-[11px] font-semibold text-white/80">{h.label}</Text>
                <Text className={`text-[11px] font-bold ${showTick ? 'text-brand-400' : 'text-white'}`}>{h.value}</Text>
              </Pressable>
            )
          })}
        </View>

        {/* Nutrition day tags */}
        <View className="mt-4 border-t border-white/5 pt-3.5">
          <View className="mb-2 flex-row items-center gap-2">
            <Leaf size={14} color={brand[400]} />
            <Text className="text-[12px] font-bold uppercase tracking-wide text-white/40">Food check-in</Text>
          </View>
          {selTags.length > 0 ? (
            <View className="flex-row flex-wrap gap-1.5">
              {selTags.map((id) => {
                const tag = tagById(id)
                if (!tag) return null
                const col = toneColor(tag.tone, colors)
                return (
                  <View key={id} className="flex-row items-center gap-1 rounded-full px-2.5 py-1" style={{ backgroundColor: `${col}24` }}>
                    <Text style={{ color: col }}>{tag.emoji}</Text>
                    <Text className="text-[12px] font-semibold" style={{ color: col }}>{tag.label}</Text>
                  </View>
                )
              })}
            </View>
          ) : isToday ? (
            <Pressable onPress={() => nav.goTab('nutrition')} className="active:opacity-70">
              <Text className="text-[13px] font-semibold text-brand-400">Tag how your eating went →</Text>
            </Pressable>
          ) : (
            <Text className="text-[13px] text-white/35">No food tags for this day</Text>
          )}
        </View>
      </Card>

      {/* To-do today */}
      <Section title="To-do today" right={<Text className={`text-sm font-semibold ${remaining === 0 ? 'text-brand-400' : 'text-white/45'}`}>{remaining === 0 ? 'All done 🎉' : `${remaining} left`}</Text>} />
      <Card className="px-4">
        {sortedTasks.map((task, i) => <TaskRow key={task.id} task={task} first={i === 0} chevron={chevron} />)}
      </Card>

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
            <Text className="text-[13px] text-white/55">{exam.active ? 'On. Shorter sessions, more recovery.' : 'Add your exam dates and I will adapt your plan.'}</Text>
          </View>
          <ChevronRight size={20} color={accent.purple} />
        </Pressable>
      </View>
      <View className="h-2" />
    </View>
  )
}

function TaskRow({ task, first, chevron }: { task: Task; first: boolean; chevron: string }) {
  return (
    <Pressable onPress={task.onPress} className={`flex-row items-center gap-3 py-3 active:opacity-80 ${first ? '' : 'border-t border-white/5'}`}>
      <View className={`h-9 w-9 shrink-0 items-center justify-center rounded-xl ${task.done ? 'bg-brand-400' : 'bg-brand-400/15'}`}>
        {task.done ? <Check size={18} strokeWidth={3} color="#000" /> : <Icon name={task.icon} size={17} color={brand[400]} />}
      </View>
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className={`text-[14px] font-semibold ${task.done ? 'text-white/40 line-through' : 'text-white'}`}>{task.label}</Text>
        <Text numberOfLines={1} className="text-[12px] text-white/45">{task.hint}</Text>
      </View>
      {!task.done && <ChevronRight size={18} color={chevron} />}
    </Pressable>
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
