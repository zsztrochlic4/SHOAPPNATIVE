import { useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, Image, TextInput, StyleSheet, ScrollView } from 'react-native'
import Svg, { Path, Circle } from 'react-native-svg'
import { CalendarDays, Clock, Play, ChevronRight, Check, Leaf, Plus, Trash2, Activity, Repeat, RefreshCw, Dumbbell, X } from 'lucide-react-native'
import { Icon } from '../components/Icon'
import { ActivityIcon } from '../components/ActivityIcon'
import { ProgressBar, SegmentedTabs, ScreenHeader, Chip } from '../components/ui'
import { Hero } from '../components/Hero'
import { useStore } from '../store/store'
import { useNav } from '../nav'
import { ACTIVE_EXERCISES } from '../backend/data'
import { fmtVolume, fmtWeight } from '../lib/format'
import { relativeLabel, todayKey } from '../lib/date'
import { todaySession, sessionProgress, completedSessions, activitiesForDay } from '../store/selectors'
import { buildCustomSession, exerciseView, imageForMuscle } from '../store/programSession'
import { brand, useColors } from '../theme'
import { useToast } from '../components/Toast'
import { syncAll } from '../lib/integrations'
import { ProgramHolding, GeneratedProgramView } from './GeneratedProgramView'

const TABS = ['Today', 'Program', 'Exercises', 'History']

export default function Workout() {
  const [tab, setTab] = useState('Today')
  const colors = useColors()
  return (
    <View className="px-5 pt-2">
      <ScreenHeader
        title="Workout"
        trailing={
          <Pressable className="h-10 w-10 items-center justify-center rounded-xl active:opacity-70">
            <CalendarDays size={22} color={colors.fg} />
          </Pressable>
        }
      />
      <SegmentedTabs tabs={TABS} active={tab} onChange={setTab} />
      <View className="mt-5">
        {tab === 'Today' && <TodayTab />}
        {tab === 'Program' && <ProgramTab />}
        {tab === 'Exercises' && <ExercisesTab />}
        {tab === 'History' && <HistoryTab />}
      </View>
    </View>
  )
}

function TodayTab() {
  const { state, dispatch } = useStore()
  const nav = useNav()
  const units = state.settings.units
  const session = todaySession(state)
  const prog = sessionProgress(session)

  // Once the generation gate is open, materialise today's loggable session from the
  // generated program's instance for this weekday (no-op if one already exists, if there's
  // no program, or if today is a rest day). This is what makes the generated plan loggable.
  const gateOpen = state.programStatus?.ok === true
  const hasInstances = (state.workoutInstances?.length ?? 0) > 0
  useEffect(() => {
    if (gateOpen && hasInstances) dispatch({ type: 'START_PROGRAM_DAY', dateKey: todayKey })
  }, [gateOpen, hasInstances, dispatch])

  // Gate closed (age / screening / waiver / professional sign-off): no program yet — show
  // the holding state instead of a misleading "rest day" empty card.
  if (state.programStatus && !state.programStatus.ok && !session) {
    return (
      <>
        <ProgramHolding status={state.programStatus} />
        <OtherActivities />
      </>
    )
  }

  return (
    <>
      {session ? (
        <>
          <Hero image={session.image} rounded={16}>
            <View className="absolute right-3 top-3 z-10 flex-row items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5">
              <Clock size={14} color="#fff" />
              <Text className="text-[13px] font-semibold text-white">~{session.durationMin} min</Text>
            </View>
            <Text className="text-sm font-semibold text-brand-400">{session.focus}</Text>
            <Text className="mt-1 text-3xl font-extrabold text-white">{session.name}</Text>
            <View className="mt-2 flex-row items-center gap-1.5">
              <Clock size={15} color="rgba(255,255,255,0.65)" />
              <Text className="text-sm text-white/65">{session.exercises.length} exercises</Text>
            </View>
            <Pressable onPress={() => nav.open('activeWorkout')} className="btn-primary mt-4 self-start active:opacity-90">
              <Text className="font-semibold text-black">{session.completed ? 'Review Workout' : prog.done > 0 ? 'Resume Workout' : 'Start Workout'}</Text>
              <Play size={16} color="#000" fill="#000" style={{ marginLeft: 8 }} />
            </Pressable>
          </Hero>

          <View className="mt-6">
            <Text className="section-title mb-2">Today's Progress</Text>
            <View className="mb-1.5 flex-row items-center justify-between">
              <Text className="text-[13px] text-white/55">{prog.done}/{prog.total} exercises completed</Text>
              <Text className="text-[13px] font-semibold text-white">{prog.pct}%</Text>
            </View>
            <ProgressBar value={prog.pct} />
          </View>

          <View className="mt-6">
            <Text className="section-title mb-3">Exercises</Text>
            <View className="gap-3">
              {session.exercises.map((e) => {
                const done = e.sets.length > 0 && e.sets.every((s) => s.done)
                const topWeight = Math.max(...e.sets.map((s) => s.weightKg))
                return (
                  <View key={e.defId} className="flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-3">
                    <Pressable onPress={() => dispatch({ type: 'TOGGLE_EXERCISE_DONE', defId: e.defId })} className={`h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${done ? 'border-brand-400 bg-brand-400' : 'border-white/25'}`}>
                      {done && <Check size={14} strokeWidth={3} color="#000" />}
                    </Pressable>
                    <Image source={{ uri: e.image }} resizeMode="cover" className="h-12 w-12 rounded-xl" />
                    <Pressable onPress={() => nav.open('exerciseDetail', { defId: e.defId })} className="min-w-0 flex-1">
                      <Text numberOfLines={1} className="font-bold leading-tight text-white">{e.name}</Text>
                      <Text numberOfLines={1} className="text-[12px] text-white/50">{e.targetSets} sets • {e.targetReps} reps · how to</Text>
                    </Pressable>
                    <Chip color={done ? 'green' : 'gray'}>{fmtWeight(topWeight, units, units === 'imperial' ? 0 : 1)}</Chip>
                    <Pressable onPress={() => nav.open('exerciseDetail', { defId: e.defId })}><ChevronRight size={18} color="rgba(255,255,255,0.3)" /></Pressable>
                  </View>
                )
              })}
            </View>
          </View>
        </>
      ) : (
        <View className="items-center rounded-2xl border border-white/5 bg-ink-800 p-8">
          <Text className="text-2xl">😌</Text>
          <Text className="mt-2 font-bold text-white">Rest Day</Text>
          <Text className="mt-1 text-center text-[13px] text-white/50">Recovery is where you grow. Try a mobility flow, a walk, or log whatever you got up to below.</Text>
          <Pressable onPress={() => nav.open('quick')} className="btn-primary mt-4 active:opacity-90">
            <Text className="font-semibold text-black">Quick mobility</Text>
          </Pressable>
        </View>
      )}

      <MyWorkouts />

      <OtherActivities />

      {/* Got 15 minutes? Express, no-equipment sessions */}
      <Pressable onPress={() => nav.open('quick')} className="mt-8 w-full flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-3.5 active:opacity-90">
        <View className="h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-400/15"><Clock size={20} color={brand[400]} /></View>
        <View className="flex-1">
          <Text className="font-bold leading-tight text-white">Got 15 minutes?</Text>
          <Text className="text-[12px] text-white/50">Express workouts between lectures</Text>
        </View>
        <ChevronRight size={18} color="rgba(255,255,255,0.3)" />
      </Pressable>
      <View className="h-2" />
    </>
  )
}

/* Self-logged activities: anything the app didn't prescribe. */
function OtherActivities() {
  const { state, dispatch } = useStore()
  const nav = useNav()
  const acts = activitiesForDay(state)
  return (
    <View className="mt-8">
      <View className="mb-3 flex-row items-center justify-between">
        <View>
          <Text className="section-title">Other activities</Text>
          <Text className="text-[12px] text-white/45">Log anything else you did today</Text>
        </View>
        <Pressable onPress={() => nav.open('logActivity')} className="flex-row items-center gap-1 active:opacity-70">
          <Text className="see-all">Log</Text>
          <Plus size={15} color={brand[400]} />
        </Pressable>
      </View>

      {acts.length === 0 ? (
        <Pressable onPress={() => nav.open('logActivity')} className="w-full flex-row items-center gap-3 rounded-2xl border border-dashed border-white/15 p-4 active:opacity-90">
          <View className="h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-400/15"><Activity size={20} color={brand[400]} /></View>
          <View className="flex-1">
            <Text className="font-bold leading-tight text-white">Log a workout, sport or activity</Text>
            <Text className="text-[12px] text-white/50">Swim, run, football, pickleball, anything counts</Text>
          </View>
          <ChevronRight size={18} color="rgba(255,255,255,0.3)" />
        </Pressable>
      ) : (
        <View className="gap-2.5">
          {acts.map((a) => (
            <View key={a.id} className="flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-3">
              <View className="h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-400/15"><ActivityIcon name={a.icon} size={20} color={brand[400]} /></View>
              <View className="min-w-0 flex-1">
                <View className="flex-row items-center gap-1.5">
                  <Text numberOfLines={1} className="font-bold leading-tight text-white">{a.name}</Text>
                  {a.weekly && (
                    <View className="flex-row shrink-0 items-center gap-1 rounded-full bg-brand-400/15 px-1.5 py-0.5">
                      <Repeat size={10} color={brand[300]} />
                      <Text className="text-[10px] font-bold text-brand-300">Weekly</Text>
                    </View>
                  )}
                </View>
                <Text className="text-[12px] capitalize text-white/50">{a.minutes} min · {a.intensity}</Text>
                {a.note && <Text numberOfLines={1} className="text-[12px] text-white/40">{a.note}</Text>}
              </View>
              <Pressable onPress={() => dispatch({ type: 'TOGGLE_ACTIVITY_WEEKLY', id: a.id })} className={`h-8 w-8 shrink-0 items-center justify-center rounded-full active:opacity-80 ${a.weekly ? 'bg-brand-400/20' : 'bg-white/5'}`}><Repeat size={15} color={a.weekly ? brand[400] : 'rgba(255,255,255,0.4)'} /></Pressable>
              <Pressable onPress={() => dispatch({ type: 'REMOVE_ACTIVITY', id: a.id })} className="h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 active:opacity-80"><Trash2 size={15} color="rgba(255,255,255,0.4)" /></Pressable>
            </View>
          ))}
          <Pressable onPress={() => nav.open('logActivity')} className="w-full items-center rounded-2xl border border-dashed border-white/15 py-3 active:opacity-80">
            <Text className="text-sm font-semibold text-white/55">+ Log another activity</Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}

/* Build-your-own sessions + saved reusable workouts (#2). */
function MyWorkouts() {
  const { state, dispatch } = useStore()
  const nav = useNav()
  const toast = useToast()
  const templates = state.templates ?? []

  function startTemplate(id: string) {
    const tpl = templates.find((t) => t.id === id)
    if (!tpl) return
    const session = buildCustomSession(tpl.name, tpl.exercises, todayKey)
    dispatch({ type: 'SAVE_SESSION', session })
    nav.open('activeWorkout', { sessionId: session.id })
  }

  return (
    <View className="mt-8">
      <View className="mb-3">
        <Text className="section-title">Your workouts</Text>
        <Text className="text-[12px] text-white/45">Build your own session — your exercises, your way</Text>
      </View>

      <Pressable onPress={() => nav.open('createSession')} className="w-full flex-row items-center gap-3 rounded-2xl border border-brand-400/25 bg-brand-400/5 p-3.5 active:opacity-90">
        <View className="h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-400/15"><Plus size={20} color={brand[400]} /></View>
        <View className="flex-1">
          <Text className="font-bold leading-tight text-white">New workout</Text>
          <Text className="text-[12px] text-white/50">Pick exercises, set sets & reps, then start</Text>
        </View>
        <ChevronRight size={18} color="rgba(255,255,255,0.3)" />
      </Pressable>

      {templates.length > 0 && (
        <View className="mt-2.5 gap-2.5">
          {templates.map((t) => (
            <View key={t.id} className="flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-3">
              <Pressable onPress={() => nav.open('createSession', { templateId: t.id })} className="min-w-0 flex-1 flex-row items-center gap-3 active:opacity-80">
                <Image source={{ uri: t.exercises[0]?.image ?? '' }} resizeMode="cover" className="h-11 w-11 rounded-xl bg-ink-700" />
                <View className="min-w-0 flex-1">
                  <Text numberOfLines={1} className="font-bold leading-tight text-white">{t.name}</Text>
                  <Text className="text-[12px] text-white/50">{t.exercises.length} exercise{t.exercises.length === 1 ? '' : 's'}</Text>
                </View>
              </Pressable>
              <Pressable onPress={() => startTemplate(t.id)} className="flex-row items-center gap-1 rounded-full bg-brand-400 px-3.5 py-1.5 active:opacity-90">
                <Play size={13} color="#000" fill="#000" />
                <Text className="text-sm font-bold text-black">Start</Text>
              </Pressable>
              <Pressable onPress={() => { dispatch({ type: 'REMOVE_TEMPLATE', id: t.id }); toast('Workout removed') }} hitSlop={6} className="h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 active:opacity-80">
                <Trash2 size={15} color="rgba(255,255,255,0.4)" />
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

function ProgramTab() {
  const { state } = useStore()
  // Once a user has been through the safety-gated backend, their program comes from the
  // generator (or a holding state when the gate is closed). The legacy static split is only
  // the fallback for demo/seed sessions that never ran the backend.
  if (state.programStatus && !state.programStatus.ok) return <ProgramHolding status={state.programStatus} />
  if (state.generatedProgram) return <GeneratedProgramView program={state.generatedProgram} />
  return (
    <View className="gap-3">
      <Text className="text-[13px] text-white/50">Your weekly split · {state.profile.daysPerWeek}-day program</Text>
      {state.program.map((d) => (
        <View key={d.id} className="flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-4">
          <View className="w-12 shrink-0"><Text className="text-[11px] font-semibold uppercase tracking-wide text-white/40">{d.day}</Text></View>
          <View className="flex-1">
            <Text className="font-bold text-white">{d.name}</Text>
            <Text className="text-[12px] text-white/50">{d.focus}</Text>
          </View>
          {d.rest ? <Chip color="gray">Rest</Chip> : <Chip color="green">{d.exerciseIds.length} ex</Chip>}
        </View>
      ))}
    </View>
  )
}

// Preset muscle-group filters, in a natural push→pull→legs order (only those present are shown).
const MUSCLE_ORDER = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Core', 'Quads', 'Hamstrings & Glutes', 'Calves', 'Full Body & Conditioning']

function ExercisesTab() {
  const nav = useNav()
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState<string | null>(null)
  // The full canonical exercise database (workbook source of truth, 113), adapted for display
  // through the same `exerciseView` used everywhere else so imagery/muscle stay consistent.
  const all = useMemo(
    () =>
      ACTIVE_EXERCISES.map((e) => {
        const v = exerciseView(e.id)
        return { id: e.id, name: v?.name ?? e.name, muscle: v?.muscle ?? e.muscleGroup, image: v?.image ?? imageForMuscle(e.muscleGroup) }
      }),
    [],
  )
  const muscles = useMemo(() => {
    const present = new Set(all.map((e) => e.muscle))
    return MUSCLE_ORDER.filter((m) => present.has(m))
  }, [all])
  const filtered = useMemo(
    () =>
      all.filter(
        (e) =>
          (!muscle || e.muscle === muscle) &&
          (e.name.toLowerCase().includes(q.toLowerCase()) || e.muscle.toLowerCase().includes(q.toLowerCase())),
      ),
    [q, muscle, all],
  )
  return (
    <View>
      <Pressable onPress={() => nav.open('beginner')} className="mb-4 w-full flex-row items-center gap-3 rounded-2xl border border-brand-400/20 bg-brand-400/5 p-3.5 active:opacity-90">
        <View className="h-9 w-9 items-center justify-center rounded-xl bg-brand-400/15"><Leaf size={18} color={brand[400]} /></View>
        <View className="flex-1"><Text className="text-sm font-bold leading-tight text-white">New here?</Text><Text className="text-[12px] text-white/50">Start the beginner guide, no experience needed</Text></View>
        <ChevronRight size={16} color="rgba(255,255,255,0.3)" />
      </Pressable>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Search exercises or muscle…"
        placeholderTextColor="rgba(255,255,255,0.35)"
        className="mb-3 w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-sm text-white"
      />
      {/* Muscle-group filter chips — tap to filter, tap again (or the ✕) to clear */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 mb-3" contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {muscles.map((m) => {
          const on = muscle === m
          return (
            <Pressable
              key={m}
              onPress={() => setMuscle(on ? null : m)}
              className={`flex-row items-center gap-1.5 rounded-full px-3.5 py-2 active:opacity-80 ${on ? 'bg-brand-400' : 'border border-white/10 bg-ink-800'}`}
            >
              <Text className={`text-[13px] font-semibold ${on ? 'text-black' : 'text-white/70'}`}>{m}</Text>
              {on && <X size={13} strokeWidth={3} color="#000" />}
            </Pressable>
          )
        })}
      </ScrollView>
      <View className="mb-3 flex-row items-center justify-between px-0.5">
        <Text className="text-[12px] font-semibold uppercase tracking-wide text-white/35">{muscle ?? 'All exercises'}</Text>
        {muscle ? (
          <Pressable onPress={() => setMuscle(null)} className="flex-row items-center gap-1 active:opacity-70" hitSlop={8}>
            <Text className="text-[12px] font-semibold text-brand-400">{filtered.length} · Clear</Text>
            <X size={12} strokeWidth={2.75} color={brand[400]} />
          </Pressable>
        ) : (
          <Text className="text-[12px] text-white/35">{filtered.length}</Text>
        )}
      </View>
      <View className="flex-row flex-wrap gap-3">
        {filtered.map((e) => (
          <Pressable key={e.id} onPress={() => nav.open('exerciseDetail', { defId: e.id })} className="flex-1 basis-[47%] overflow-hidden rounded-2xl border border-white/5 bg-ink-800 active:opacity-90">
            <ExerciseThumb uri={e.image} />
            <View className="p-3">
              <Text numberOfLines={1} className="text-sm font-bold text-white">{e.name}</Text>
              <Text className="text-[12px] text-white/45">{e.muscle}</Text>
            </View>
          </Pressable>
        ))}
        {filtered.length === 0 && <Text className="w-full py-8 text-center text-sm text-white/40">No exercises found.</Text>}
      </View>
    </View>
  )
}

/* Exercise thumbnail with a consistent muscle-group fallback behind it, so a
 * slow or failed image reads as an intentional tile, never an empty grey box. */
function ExerciseThumb({ uri }: { uri: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <View className="h-24 w-full bg-ink-700">
      <View style={StyleSheet.absoluteFill} className="items-center justify-center">
        <Dumbbell size={26} color="rgba(126,217,87,0.35)" />
      </View>
      {!failed && (
        <Image
          source={{ uri }}
          resizeMode="cover"
          className="h-24 w-full"
          onError={() => setFailed(true)}
        />
      )}
    </View>
  )
}

/* Tiny volume-trend sparkline — Strava-style glanceable context on each session
 * row, showing where that session sits in your recent volume trend. */
function Sparkline({ values, activeIndex, color }: { values: number[]; activeIndex: number; color: string }) {
  const W = 56, H = 22
  if (values.length < 2 || activeIndex < 0) return null
  const min = Math.min(...values), max = Math.max(...values)
  const span = max - min || 1
  const x = (i: number) => (i / (values.length - 1)) * W
  const y = (v: number) => H - 2 - ((v - min) / span) * (H - 4)
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  return (
    <Svg width={W} height={H}>
      <Path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.55} />
      <Circle cx={x(activeIndex)} cy={y(values[activeIndex])} r={2.6} fill={color} />
    </Svg>
  )
}

type HistoryItem =
  | { kind: 'session'; id: string; dateKey: string; name: string; volumeKg: number; durationMin: number }
  | { kind: 'activity'; id: string; dateKey: string; name: string; icon: string; minutes: number; calories: number; weekly?: boolean }

function HistoryTab() {
  const { state, dispatch } = useStore()
  const nav = useNav()
  const toast = useToast()
  const [syncing, setSyncing] = useState(false)
  const units = state.settings.units
  const anyConnected = Object.values(state.integrations ?? {}).some((i) => i.connected)

  async function refresh() {
    if (syncing) return
    setSyncing(true)
    try {
      toast(await syncAll(state, dispatch))
    } finally {
      setSyncing(false)
    }
  }
  // Chronological volume series for the per-row sparkline, plus a lookup so each
  // session row can highlight its own point in the trend.
  const chron = completedSessions(state).slice().sort((a, b) => a.dateKey.localeCompare(b.dateKey))
  const volSeries = chron.map((s) => s.volumeKg)
  const volIndex = new Map(chron.map((s, i) => [s.id, i]))
  const sessions: HistoryItem[] = completedSessions(state).map((s) => ({ kind: 'session', id: s.id, dateKey: s.dateKey, name: s.name, volumeKg: s.volumeKg, durationMin: s.durationMin }))
  const acts: HistoryItem[] = (state.activities ?? []).map((a) => ({ kind: 'activity', id: a.id, dateKey: a.dateKey, name: a.name, icon: a.icon, minutes: a.minutes, calories: a.calories, weekly: a.weekly }))
  const history = [...sessions, ...acts].sort((a, b) => b.dateKey.localeCompare(a.dateKey)).slice(0, 30)

  if (history.length === 0 && !anyConnected) {
    return <Text className="py-8 text-center text-sm text-white/40">No history yet. Complete a workout or log an activity.</Text>
  }

  return (
    <View className="gap-3">
      {anyConnected && (
        <Pressable
          onPress={refresh}
          disabled={syncing}
          className={`flex-row items-center justify-center gap-2 rounded-2xl border border-brand-400/20 bg-brand-400/5 py-2.5 active:opacity-80 ${syncing ? 'opacity-60' : ''}`}
        >
          <RefreshCw size={14} color={brand[400]} />
          <Text className="text-[13px] font-semibold text-brand-400">{syncing ? 'Syncing…' : 'Sync connected apps'}</Text>
        </Pressable>
      )}
      {history.map((h) => (
        <View key={h.id} className="flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-4">
          <View className="h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-400/15">
            {h.kind === 'session' ? <Icon name="dumbbell" size={20} color={brand[400]} /> : <ActivityIcon name={h.icon} size={20} color={brand[400]} />}
          </View>
          <View className="min-w-0 flex-1">
            <View className="flex-row items-center gap-1.5">
              <Text numberOfLines={1} className="font-bold text-white">{h.name}</Text>
              {h.kind === 'activity' && h.weekly && (
                <View className="flex-row shrink-0 items-center gap-1 rounded-full bg-brand-400/15 px-1.5 py-0.5">
                  <Repeat size={10} color={brand[300]} />
                  <Text className="text-[10px] font-bold text-brand-300">Weekly</Text>
                </View>
              )}
            </View>
            <Text className="text-[12px] text-white/45">{relativeLabel(h.dateKey)}{h.kind === 'activity' ? ' · activity' : ''}</Text>
          </View>
          {h.kind === 'session' && volSeries.length >= 2 && (
            <View className="mr-1 shrink-0"><Sparkline values={volSeries} activeIndex={volIndex.get(h.id) ?? -1} color={brand[400]} /></View>
          )}
          <View className="items-end">
            {h.kind === 'session' ? (
              <>
                <Text className="text-sm font-semibold text-white">{fmtVolume(h.volumeKg, units)}</Text>
                <Text className="text-[12px] text-white/45">{h.durationMin} min</Text>
              </>
            ) : (
              <>
                <Text className="text-sm font-semibold text-white">{h.minutes} min</Text>
                <Text className="text-[12px] capitalize text-white/45">activity</Text>
              </>
            )}
          </View>
        </View>
      ))}
    </View>
  )
}
