import type { ReactNode } from 'react'
import { View, Text, Pressable } from 'react-native'
import { Menu, MessageCircle, Clock, Play, GraduationCap, ChevronRight, Sparkles, Leaf, Check, Flame } from 'lucide-react-native'
import { Icon } from '../components/Icon'
import { Card, ProgressRing } from '../components/ui'
import { Hero } from '../components/Hero'
import { useStore } from '../store/store'
import { useNav } from '../nav'
import { currentWeekKeys, todayKey, longDate, TODAY } from '../lib/date'
import { fmtFluid, fmtWeightNum, weightUnit, pct } from '../lib/format'
import {
  todayHabit, todaySession, weightStats, workoutsThisWeek, workoutsInRange,
  strengthProgress, unreadChat, streakStats, foodReviewForDay,
} from '../store/selectors'
import { coachDaily } from '../store/coach'
import { dailyTargets, examState } from '../store/training'
import { Wordmark } from '../components/Logo'
import { brand, accent, useColors } from '../theme'

const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function greetingFor(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
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
  const w = weightStats(state)
  const thisWeek = workoutsThisWeek(state)
  const lastWeek = workoutsInRange(state, 14) - thisWeek
  const sp = strengthProgress(state)
  const strengthAvg = sp.length ? Math.round(sp.reduce((a, s) => a + s.pct, 0) / sp.length) : 0
  const unread = unreadChat(state)
  const coach = coachDaily(state)
  const t = dailyTargets(state)
  const exam = examState(state)
  const streak = streakStats(state)
  const foodReview = foodReviewForDay(state)
  const weightLoggedToday = state.weights.some((x) => x.dateKey === todayKey)

  const greeting = greetingFor(TODAY.getHours())
  const weekKeys = currentWeekKeys()

  const habitRings = [
    { icon: 'footprints', label: 'Steps', value: habit.steps.toLocaleString(), pct: pct(habit.steps, t.steps), color: brand[400] },
    { icon: 'bed', label: 'Sleep', value: `${habit.sleepH} hrs`, pct: pct(habit.sleepH, t.sleepH), color: brand[400] },
    { icon: 'droplet', label: 'Water', value: fmtFluid(habit.waterL, units), pct: pct(habit.waterL, t.waterL), color: brand[400] },
    { icon: 'utensils', label: 'Nutrition', value: `${habit.nutritionScore}/10`, pct: habit.nutritionScore * 10, color: brand[400] },
    { icon: 'leaf', label: 'Mindset', value: `${habit.mindsetMin} min`, pct: pct(habit.mindsetMin, 10), color: brand[400] },
  ]
  const ringsOnTrack = habitRings.filter((h) => h.pct >= 100).length

  const tasks: Task[] = []
  if (session) {
    tasks.push({
      id: 'workout', icon: 'dumbbell',
      label: session.completed ? 'Workout complete' : "Today's workout",
      hint: session.name, done: session.completed,
      onPress: () => nav.open('activeWorkout'),
    })
  }
  tasks.push({
    id: 'water', icon: 'droplet',
    label: `Drink ${fmtFluid(t.waterL, units)} of water`,
    hint: `${fmtFluid(habit.waterL, units)} so far`,
    done: habit.waterL >= t.waterL,
    onPress: () => nav.open('logHabit'),
  })
  tasks.push({
    id: 'weight', icon: 'scale',
    label: 'Weigh yourself',
    hint: weightLoggedToday ? 'Logged today' : 'Keep your trend honest',
    done: weightLoggedToday,
    onPress: () => nav.open('logWeight'),
  })
  tasks.push({
    id: 'meals', icon: 'utensils',
    label: 'Review your food',
    hint: foodReview ? `Reviewed · ${foodReview.score}/10` : 'Get coach feedback on today',
    done: !!foodReview,
    onPress: () => nav.goTab('nutrition'),
  })
  tasks.push({
    id: 'steps', icon: 'footprints',
    label: `Reach ${t.steps.toLocaleString()} steps`,
    hint: `${habit.steps.toLocaleString()} today`,
    done: habit.steps >= t.steps,
    onPress: () => nav.open('logHabit'),
  })
  const sortedTasks = [...tasks].sort((a, b) => Number(a.done) - Number(b.done))
  const remaining = tasks.filter((x) => !x.done).length

  return (
    <View className="px-5 pt-2">
      <View className="mb-4 flex-row items-center justify-between">
        <Pressable onPress={() => nav.open('profile')} className="h-10 w-10 items-center justify-center rounded-xl active:opacity-70">
          <Menu size={24} color={colors.fg} />
        </Pressable>
        <Wordmark size="sm" />
        <Pressable onPress={() => nav.open('coachChat')} className="relative h-10 w-10 items-center justify-center rounded-xl active:opacity-70">
          <MessageCircle size={23} color={colors.fg} />
          {unread > 0 && <View className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand-400" style={{ borderWidth: 2, borderColor: colors.ink900 }} />}
        </Pressable>
      </View>

      {/* Greeting + date + streak */}
      <View className="flex-row items-end justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-[26px] font-extrabold tracking-tight text-white">{greeting}, {state.profile.name}</Text>
          <Text className="mt-1 text-[14px] text-white/45">{longDate(todayKey)}</Text>
        </View>
        {streak.current > 0 && (
          <View className="flex-row shrink-0 items-center gap-1.5 rounded-full bg-accent-orange/15 px-3 py-1.5">
            <Flame size={15} color={accent.orange} />
            <Text className="text-[13px] font-bold text-accent-orange">{streak.current} day{streak.current === 1 ? '' : 's'}</Text>
          </View>
        )}
      </View>

      {/* Week selector */}
      <View className="mt-5 flex-row justify-between">
        {weekKeys.map((k, i) => {
          const active = k === todayKey
          const trained = state.sessions.some((s) => s.dateKey === k && s.completed)
          const logged = state.habits.some((h) => h.dateKey === k)
          const date = parseInt(k.slice(-2))
          return (
            <View key={k} className={`w-11 items-center gap-2 rounded-2xl py-2.5 ${active ? 'bg-brand-400' : ''}`}>
              <Text className={`text-[11px] font-semibold uppercase tracking-wide ${active ? 'text-black/55' : 'text-white/35'}`}>{WD[i]}</Text>
              <Text className={`text-[17px] font-bold ${active ? 'text-black' : 'text-white/70'}`}>{date}</Text>
              <View className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-black/60' : trained || logged ? 'bg-brand-400' : 'bg-transparent'}`} />
            </View>
          )
        })}
      </View>

      {/* Today's plan */}
      <Section title="Your plan" action="Workouts" onAction={() => nav.goTab('workout')} />
      <Hero image={session?.image} rounded={16}>
        <View className="flex-row items-center gap-2">
          <Text className="text-sm font-semibold text-brand-400">Today's plan</Text>
          {exam.active && (
            <View className="rounded-full bg-accent-purple/20 px-2 py-0.5">
              <Text className="text-[10px] font-bold text-accent-purple">Exam mode</Text>
            </View>
          )}
        </View>
        <Text className="mt-1 text-2xl font-extrabold tracking-tight text-white">{session?.name ?? 'Rest day'}</Text>
        <View className="mt-2 flex-row items-center gap-1.5">
          <Clock size={15} color="rgba(255,255,255,0.6)" />
          <Text className="text-sm text-white/60">{session ? `${session.exercises.length} exercises, about ${exam.active ? 30 : 50} min` : 'Recovery and mobility'}</Text>
        </View>
        {session && (
          <Pressable onPress={() => nav.open('activeWorkout')} className="btn-primary mt-4 self-start active:opacity-90">
            <Play size={16} color="#000" fill="#000" />
            <Text className="ml-2 font-semibold text-black">{session.completed ? 'View workout' : 'Start workout'}</Text>
          </Pressable>
        )}
      </Hero>

      {/* Quick workouts */}
      <Pressable onPress={() => nav.open('quick')} className="mt-3 flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-3.5 active:opacity-90">
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-brand-400/15"><Clock size={20} color={brand[400]} /></View>
        <View className="flex-1">
          <Text className="font-bold text-white">Got 15 minutes?</Text>
          <Text className="text-[12px] text-white/50">Express workouts between lectures</Text>
        </View>
        <ChevronRight size={18} color="rgba(148,148,148,0.6)" />
      </Pressable>

      {/* Today's habits */}
      <Section title="Today's progress" action="Log" onAction={() => nav.open('logHabit')} tight />
      {t.adjusted && <Text className="-mt-1 mb-3 text-[12px] text-accent-purple">Targets eased for exam season</Text>}
      <Card className="p-4">
        <View className="mb-4 flex-row items-center gap-2">
          <Text className="text-[13px] font-semibold text-white/55">{ringsOnTrack} of {habitRings.length} goals on track</Text>
          <Text className="ml-auto text-[13px] text-white/30">Tap to update</Text>
        </View>
        <Pressable onPress={() => nav.open('logHabit')} className="flex-row justify-between active:opacity-80">
          {habitRings.map((h) => (
            <View key={h.label} className="items-center gap-1.5">
              <ProgressRing value={h.pct} size={54} stroke={4} color={h.color}><Icon name={h.icon} size={19} color={h.color} /></ProgressRing>
              <Text className="text-[11px] font-semibold text-white/80">{h.label}</Text>
              <Text className="text-[11px] font-bold text-white">{h.value}</Text>
            </View>
          ))}
        </Pressable>
      </Card>

      {/* To-do today */}
      <Section
        title="To-do today"
        right={<Text className={`text-sm font-semibold ${remaining === 0 ? 'text-brand-400' : 'text-white/45'}`}>{remaining === 0 ? 'All done 🎉' : `${remaining} left`}</Text>}
      />
      <Card className="px-4">
        {sortedTasks.map((task, i) => <TaskRow key={task.id} task={task} first={i === 0} />)}
      </Card>

      {/* Coach presence */}
      <Pressable onPress={() => nav.open('coach')} className="mt-7 overflow-hidden rounded-2xl border border-brand-400/20 bg-brand-400/5 p-4 active:opacity-90">
        <View className="flex-row items-center gap-2.5">
          <View className="h-7 w-7 items-center justify-center rounded-full bg-brand-400"><Sparkles size={15} color="#000" /></View>
          <Text className="text-[13px] font-bold text-brand-400">Coach</Text>
          <ChevronRight size={16} color="rgba(148,148,148,0.6)" style={{ marginLeft: 'auto' }} />
        </View>
        <Text className="mt-2 font-bold text-white">{coach.title}</Text>
        <Text className="mt-0.5 text-[14px] text-white/65">{coach.body}</Text>
        {coach.cta && (
          <Pressable
            onPress={() => nav.open(coach.cta!.overlay as Parameters<typeof nav.open>[0])}
            className="mt-3 flex-row items-center gap-1 self-start rounded-full bg-brand-400 px-3.5 py-1.5 active:opacity-90"
          >
            <Text className="text-sm font-bold text-black">{coach.cta.label}</Text>
            <ChevronRight size={15} color="#000" />
          </Pressable>
        )}
      </Pressable>

      {/* Progress overview */}
      <Section title="Progress overview" action="See all" onAction={() => nav.goTab('progress')} />
      <View className="flex-row gap-3">
        <OverviewCard icon="dumbbell" label="Workouts" value={String(thisWeek)} sub="This week" delta={`${thisWeek >= lastWeek ? '↑' : '↓'} ${Math.abs(thisWeek - lastWeek)}`} />
        <OverviewCard icon="trending" label="Strength" value={`+${strengthAvg}%`} sub="4 weeks" delta="↑" />
        <OverviewCard icon="scale" label="Body weight" value={fmtWeightNum(w.current, units)} unit={weightUnit(units)} sub="" delta={`${w.delta <= 0 ? '↓' : '↑'} ${Math.abs(w.delta).toFixed(1)}`} />
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
            <ChevronRight size={18} color="rgba(148,148,148,0.6)" />
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

function TaskRow({ task, first }: { task: Task; first: boolean }) {
  return (
    <Pressable onPress={task.onPress} className={`flex-row items-center gap-3 py-3 active:opacity-80 ${first ? '' : 'border-t border-white/5'}`}>
      <View className={`h-9 w-9 shrink-0 items-center justify-center rounded-xl ${task.done ? 'bg-brand-400' : 'bg-brand-400/15'}`}>
        {task.done ? <Check size={18} strokeWidth={3} color="#000" /> : <Icon name={task.icon} size={17} color={brand[400]} />}
      </View>
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className={`text-[14px] font-semibold ${task.done ? 'text-white/40 line-through' : 'text-white'}`}>{task.label}</Text>
        <Text numberOfLines={1} className="text-[12px] text-white/45">{task.hint}</Text>
      </View>
      {!task.done && <ChevronRight size={18} color="rgba(148,148,148,0.5)" />}
    </Pressable>
  )
}

function Section({ title, action, onAction, right, tight }: { title: string; action?: string; onAction?: () => void; right?: ReactNode; tight?: boolean }) {
  return (
    <View className={`mb-3 flex-row items-center justify-between ${tight ? 'mt-7' : 'mt-9'}`}>
      <Text className="section-title">{title}</Text>
      {right ? right : action ? <Pressable onPress={onAction} hitSlop={8}><Text className="see-all">{action}</Text></Pressable> : null}
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
