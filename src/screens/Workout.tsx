import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, Image, TextInput, StyleSheet, ScrollView, FlatList, type ListRenderItemInfo } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path, Circle } from 'react-native-svg'
import {
  Clock, Play, ChevronRight, ChevronDown, Check, Plus, Trash2, Activity, Repeat, RefreshCw,
  Dumbbell, X, Search, Pencil, Leaf,
} from 'lucide-react-native'
import { Icon } from '../components/Icon'
import { ActivityIcon } from '../components/ActivityIcon'
import { ProgressBar, SegmentedTabs, ScreenHeader, Chip } from '../components/ui'
import { MuscleMapCard, RestDayCard } from '../components/MuscleMapCard'
import { useStore } from '../store/store'
import { useNav } from '../nav'
import { ACTIVE_EXERCISES } from '../backend/data'
import { BEGINNER_LESSONS } from '../data/catalog'
import { fmtVolume, fmtWeight } from '../lib/format'
import { relativeLabel, todayKey } from '../lib/date'
import { todaySession, sessionProgress, completedSessions, activitiesForDay } from '../store/selectors'
import { buildCustomSession, exerciseView, imageForMuscle } from '../store/programSession'
import { posterOverrideUrl } from '../lib/media'
import { brand, useColors } from '../theme'
import { useToast } from '../components/Toast'
import { syncAll } from '../lib/integrations'
import { useAuth } from '../auth/AuthProvider'
import { flushCompletionQueue, subscribePending } from '../backend/repo/completionQueue'
import { ProgramHolding, GeneratedProgramView } from './GeneratedProgramView'

const TABS = ['Today', 'Program', 'Exercises', 'History']

export default function Workout() {
  const [tab, setTab] = useState('Today')
  const insets = useSafeAreaInsets()
  const contentStyle = useMemo(() => ({ paddingBottom: insets.bottom + 112 }), [insets.bottom])
  return (
    <View className="flex-1 pt-2">
      <View className="px-5">
        <ScreenHeader title="Workout" />
        <SegmentedTabs tabs={TABS} active={tab} onChange={setTab} />
      </View>
      {tab === 'Exercises' ? (
        <ExercisesTab bottomInset={insets.bottom + 112} />
      ) : tab === 'History' ? (
        <HistoryTab bottomInset={insets.bottom + 112} />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={contentStyle}
          showsVerticalScrollIndicator={false}
        >
          <View className="px-5 pt-5">
            {tab === 'Today' && <TodayTab />}
            {tab === 'Program' && <ProgramTab />}
          </View>
        </ScrollView>
      )}
    </View>
  )
}

/* ------------------------------------------------------------------ */
/*  Small 40px exercise tile with a muscle-group fallback behind it.   */
/* ------------------------------------------------------------------ */
function RowThumb({ uri }: { uri: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <View className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-ink-700">
      <View style={StyleSheet.absoluteFill} className="items-center justify-center">
        <Dumbbell size={19} color="rgba(126,217,87,0.35)" />
      </View>
      {!failed && (
        <Image source={{ uri }} resizeMode="cover" style={StyleSheet.absoluteFill} onError={() => setFailed(true)} />
      )}
    </View>
  )
}

/**
 * Honest sync status for canonical workout-completion writes (audit F-011):
 * shows how many finished workouts are still waiting to reach the cloud, with
 * a one-tap retry. Hidden when everything is synced.
 */
function PendingSyncChip() {
  const { user } = useAuth()
  const [pending, setPending] = useState(0)
  const [retrying, setRetrying] = useState(false)
  useEffect(() => subscribePending(setPending), [])
  if (!user || pending === 0) return null
  return (
    <Pressable
      onPress={async () => {
        if (retrying) return
        setRetrying(true)
        try { await flushCompletionQueue(user.uid) } finally { setRetrying(false) }
      }}
      accessibilityRole="button"
      accessibilityLabel={`${pending} ${pending === 1 ? 'workout' : 'workouts'} waiting to sync. Retry now.`}
      className="mb-4 flex-row items-center justify-between rounded-[16px] border border-amber-400/25 bg-amber-400/10 px-4 py-3 active:opacity-80"
    >
      <Text className="text-[12.5px] font-semibold text-amber-200">
        {pending} {pending === 1 ? 'workout' : 'workouts'} waiting to sync — progress is safe on this device
      </Text>
      <Text className="text-[12.5px] font-extrabold text-amber-300">{retrying ? 'Retrying…' : 'Retry'}</Text>
    </Pressable>
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
        <PendingSyncChip />
        <ProgramHolding status={state.programStatus} />
        <OtherActivities />
      </>
    )
  }

  // Driven by the visible tick progress: none ticked → Start, some → Continue, all → Completed.
  const ctaLabel = prog.total > 0 && prog.done === prog.total ? 'Completed' : prog.done > 0 ? 'Continue Workout' : 'Start Workout'

  return (
    <>
      <PendingSyncChip />
      {session ? (
        <>
          {/* Today's plan — anatomical muscle map (design handoff) */}
          <MuscleMapCard session={session} sex={state.profile.sex} ctaLabel={ctaLabel} onPress={() => nav.open('activeWorkout')} />

          {/* Today's Progress */}
          <View className="mt-6">
            <Text className="section-title mb-2">Today's Progress</Text>
            <View className="mb-[7px] flex-row items-center justify-between">
              <Text className="text-[12.5px] text-secondary">{prog.done}/{prog.total} exercises completed</Text>
              <Text className="text-[12.5px] font-semibold text-white">{prog.pct}%</Text>
            </View>
            <ProgressBar value={prog.pct} />
          </View>

          {/* Exercises */}
          <View className="mt-[26px]">
            <Text className="section-title mb-3">Exercises</Text>
            <View className="gap-2.5">
              {session.exercises.map((e) => {
                const done = e.sets.length > 0 && e.sets.every((s) => s.done)
                const topWeight = e.sets.length ? Math.max(...e.sets.map((s) => s.weightKg)) : 0
                return (
                  <Pressable
                    key={e.defId}
                    onPress={() => nav.open('exerciseDetail', { defId: e.defId })}
                    className="flex-row items-center gap-[11px] rounded-[18px] border border-white/5 bg-ink-800 px-[11px] py-[9px] active:opacity-90"
                  >
                    <Pressable
                      onPress={() => dispatch({ type: 'TOGGLE_EXERCISE_DONE', defId: e.defId })}
                      hitSlop={6}
                      className={`h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full ${done ? 'bg-brand-400' : 'border-2 border-white/20'}`}
                    >
                      {done && <Check size={15} strokeWidth={3.4} color="#000" />}
                    </Pressable>
                    <RowThumb uri={e.image} />
                    <View className="min-w-0 flex-1">
                      <Text numberOfLines={1} className="text-[14px] font-bold leading-tight text-white">{e.name}</Text>
                      <Text numberOfLines={1} className="mt-[1px] text-[11.5px] text-secondary">{e.targetSets} sets · {e.targetReps} reps</Text>
                    </View>
                    <View className={`shrink-0 rounded-full px-2 py-0.5 ${done ? 'bg-brand-400/15' : 'bg-white/10'}`}>
                      <Text className={`text-[11px] font-medium ${done ? 'text-brand-300' : 'text-white/70'}`}>{fmtWeight(topWeight, units, units === 'imperial' ? 0 : 1)}</Text>
                    </View>
                    <ChevronRight size={17} color="rgba(255,255,255,0.3)" />
                  </Pressable>
                )
              })}
            </View>
          </View>
        </>
      ) : (
        <RestDayCard sex={state.profile.sex} />
      )}

      <MyWorkouts />

      <OtherActivities />

      {/* 12-Minute Bodyweight Exercises — express, no-equipment sessions */}
      <Pressable onPress={() => nav.open('quick')} className="mt-7 w-full flex-row items-center gap-3 rounded-[20px] border border-accent-blue/30 bg-accent-blue/[0.09] p-3.5 active:opacity-90">
        <View className="h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-accent-blue/[0.18]"><Clock size={20} color="#3B82F6" /></View>
        <View className="min-w-0 flex-1">
          <Text className="text-[14.5px] font-bold leading-tight text-white">12-Minute Bodyweight Exercises</Text>
          <Text className="mt-0.5 text-[12px] text-secondary">Quick, no-equipment workouts when you're short on time</Text>
        </View>
        <ChevronRight size={17} color="rgba(59,130,246,0.55)" />
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
    <View className="mt-7">
      <View className="mb-3 flex-row items-start justify-between">
        <View>
          <Text className="section-title">Other activities</Text>
          <Text className="mt-0.5 text-[12px] text-secondary">Log anything else you did today</Text>
        </View>
        <Pressable onPress={() => nav.open('logActivity')} className="flex-row items-center gap-1 px-1 active:opacity-70">
          <Text className="see-all">Log</Text>
          <Plus size={15} color={brand[400]} strokeWidth={2.6} />
        </Pressable>
      </View>

      {acts.length === 0 ? (
        <Pressable onPress={() => nav.open('logActivity')} className="w-full flex-row items-center gap-3 rounded-[20px] border border-dashed border-white/15 p-4 active:opacity-90">
          <View className="h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-brand-400/15"><Activity size={20} color={brand[400]} /></View>
          <View className="min-w-0 flex-1">
            <Text className="text-[14.5px] font-bold leading-tight text-white">Log a workout, sport or activity</Text>
            <Text className="mt-0.5 text-[12px] text-secondary">Swim, run, football, pickleball, anything counts</Text>
          </View>
          <ChevronRight size={17} color="rgba(255,255,255,0.3)" />
        </Pressable>
      ) : (
        <View className="gap-2.5">
          {acts.map((a) => (
            <View key={a.id} className="flex-row items-center gap-3 rounded-[20px] border border-white/5 bg-ink-800 p-3">
              <View className="h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px] bg-brand-400/15"><ActivityIcon name={a.icon} size={20} color={brand[400]} /></View>
              <View className="min-w-0 flex-1">
                <View className="flex-row items-center gap-1.5">
                  <Text numberOfLines={1} className="text-[14.5px] font-bold leading-tight text-white">{a.name}</Text>
                  {a.weekly && (
                    <View className="flex-row shrink-0 items-center gap-1 rounded-full bg-brand-400/15 px-1.5 py-0.5">
                      <Repeat size={10} color={brand[300]} />
                      <Text className="text-[10px] font-bold text-brand-300">Weekly</Text>
                    </View>
                  )}
                </View>
                <Text className="mt-0.5 text-[12px] capitalize text-secondary">{a.minutes} min · {a.intensity}</Text>
                {a.note && <Text numberOfLines={1} className="text-[12px] text-tertiary">{a.note}</Text>}
              </View>
              <Pressable onPress={() => dispatch({ type: 'TOGGLE_ACTIVITY_WEEKLY', id: a.id })} className={`h-8 w-8 shrink-0 items-center justify-center rounded-full active:opacity-80 ${a.weekly ? 'bg-brand-400/20' : 'bg-white/5'}`}><Repeat size={15} color={a.weekly ? brand[400] : 'rgba(255,255,255,0.4)'} /></Pressable>
              <Pressable onPress={() => dispatch({ type: 'REMOVE_ACTIVITY', id: a.id })} className="h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 active:opacity-80"><Trash2 size={15} color="rgba(255,255,255,0.4)" /></Pressable>
            </View>
          ))}
          <Pressable onPress={() => nav.open('logActivity')} className="w-full items-center rounded-[20px] border border-dashed border-white/15 py-3 active:opacity-80">
            <Text className="text-[13.5px] font-semibold text-secondary">+ Log another activity</Text>
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
    <View className="mt-7">
      <View className="mb-3">
        <Text className="section-title">Your workouts</Text>
        <Text className="mt-0.5 text-[12px] text-secondary">Build your own session, your exercises, your way</Text>
      </View>

      <Pressable onPress={() => nav.open('createSession')} className="w-full flex-row items-center gap-3 rounded-[20px] border border-brand-400/25 bg-brand-400/[0.06] p-3.5 active:opacity-90">
        <View className="h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-brand-400/15"><Plus size={20} color={brand[400]} strokeWidth={2.4} /></View>
        <View className="min-w-0 flex-1">
          <Text className="text-[14.5px] font-bold leading-tight text-white">New workout</Text>
          <Text className="mt-0.5 text-[12px] text-secondary">Pick exercises, set sets & reps, then start</Text>
        </View>
        <ChevronRight size={17} color="rgba(255,255,255,0.3)" />
      </Pressable>

      {templates.length > 0 && (
        <View className="mt-2.5 gap-2.5">
          {templates.map((t) => {
            const sets = t.exercises.reduce((a, e) => a + e.targetSets, 0)
            return (
              <View key={t.id} className="flex-row items-center gap-[11px] rounded-[18px] border border-white/5 bg-ink-800 px-[11px] py-2.5">
                <Pressable onPress={() => nav.open('createSession', { templateId: t.id })} className="min-w-0 flex-1 flex-row items-center gap-[11px] active:opacity-80">
                  <View className="h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[13px] bg-brand-400/[0.12]"><Dumbbell size={19} color={brand[400]} /></View>
                  <View className="min-w-0 flex-1">
                    <View className="flex-row items-center gap-1.5">
                      <Text numberOfLines={1} className="text-[14px] font-bold leading-tight text-white">{t.name}</Text>
                      <Pencil size={12} color="rgba(255,255,255,0.35)" />
                    </View>
                    <Text numberOfLines={1} className="mt-0.5 text-[11.5px] text-secondary">{t.exercises.length} exercise{t.exercises.length === 1 ? '' : 's'} · {sets} sets</Text>
                  </View>
                </Pressable>
                <Pressable onPress={() => startTemplate(t.id)} className="flex-row items-center gap-1 rounded-full bg-brand-400 px-3.5 py-1.5 active:opacity-90">
                  <Play size={12} color="#000" fill="#000" />
                  <Text className="text-[13px] font-bold text-black">Start</Text>
                </Pressable>
                <Pressable onPress={() => { dispatch({ type: 'REMOVE_TEMPLATE', id: t.id }); toast('Workout removed') }} hitSlop={6} className="h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 active:opacity-80">
                  <Trash2 size={15} color="rgba(255,255,255,0.45)" />
                </Pressable>
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}

/* ------------------------------------------------------------------ */
/*  Program tab — the recommended plan, or the safety holding state.   */
/* ------------------------------------------------------------------ */
function ProgramTab() {
  const { state } = useStore()
  // Once a user has been through the safety-gated backend, their program comes from the
  // generator (or a holding state when the gate is closed). The legacy static split is only
  // the fallback for demo/seed sessions that never ran the backend.
  if (state.programStatus && !state.programStatus.ok) return <ProgramHolding status={state.programStatus} />
  if (state.generatedProgram) return <GeneratedProgramView program={state.generatedProgram} />
  return <LegacyProgram />
}

function LegacyProgram() {
  const { state } = useStore()
  const [openDay, setOpenDay] = useState<string | null>(state.program[0]?.day ?? null)
  return (
    <View className="gap-2.5">
      <View className="rounded-[20px] border border-brand-400/20 bg-brand-400/[0.06] p-4">
        <Text className="text-[14px] font-bold text-white">Your weekly split · {state.profile.daysPerWeek}-day program</Text>
        <Text className="mt-1.5 text-[12.5px] leading-5 text-secondary">Built around your week. Weights adapt as you log each session.</Text>
      </View>
      {state.program.map((d) => {
        const open = openDay === d.day && !d.rest && d.exerciseIds.length > 0
        return (
          <View key={d.id} className="overflow-hidden rounded-[20px] border border-white/5 bg-ink-800">
            <Pressable onPress={() => setOpenDay(open ? null : d.day)} className="flex-row items-center gap-3 p-4 active:opacity-90">
              <View className="w-[34px] shrink-0"><Text className="text-[11px] font-bold uppercase tracking-wider text-tertiary">{d.day}</Text></View>
              <View className="min-w-0 flex-1">
                <Text className="text-[14.5px] font-bold text-white">{d.name}</Text>
                <Text className="mt-0.5 text-[12px] text-secondary">{d.focus}</Text>
              </View>
              {d.rest ? <Chip color="gray">Rest</Chip> : <Chip color="green">{d.exerciseIds.length} ex</Chip>}
              {!d.rest && d.exerciseIds.length > 0 && (
                <ChevronDown size={17} color="rgba(255,255,255,0.3)" style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
              )}
            </Pressable>
            {open && (
              <View className="px-4 pb-4">
                <View className="mb-1 h-px bg-white/5" />
                <View className="mt-2 gap-2.5">
                  {d.exerciseIds.map((id) => {
                    const v = exerciseView(id)
                    return (
                      <View key={id} className="flex-row items-center justify-between gap-3">
                        <View className="min-w-0 flex-1">
                          <Text className="text-[13.5px] font-semibold text-white">{v?.name ?? id}</Text>
                          <Text className="mt-px text-[11.5px] text-secondary">{v?.muscle ?? ''}</Text>
                        </View>
                      </View>
                    )
                  })}
                </View>
              </View>
            )}
          </View>
        )
      })}
    </View>
  )
}

// Preset muscle-group filters, in a natural push→pull→legs order (only those present are shown).
const MUSCLE_ORDER = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Core', 'Quads', 'Hamstrings & Glutes', 'Calves', 'Full Body & Conditioning']

type ExerciseLibraryItem = { id: string; name: string; muscle: string; image: string }

const exerciseKey = (item: ExerciseLibraryItem) => item.id

function ExercisesTab({ bottomInset }: { bottomInset: number }) {
  const nav = useNav()
  const { state } = useStore()
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState<string | null>(null)

  const beginnerDone = (state.beginnerProgress?.length ?? 0) >= BEGINNER_LESSONS.length

  // The full canonical exercise database (workbook source of truth, 113), adapted for display
  // through the same `exerciseView` used everywhere else so imagery/muscle stay consistent.
  const all = useMemo(
    () =>
      ACTIVE_EXERCISES.map((e) => {
        const v = exerciseView(e.id)
        return { id: e.id, name: v?.name ?? e.name, muscle: v?.muscle ?? e.muscleGroup, image: posterOverrideUrl(e.id) ?? v?.image ?? imageForMuscle(e.muscleGroup) }
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

  const openExercise = useCallback((id: string) => {
    nav.open('exerciseDetail', { defId: id, library: true })
  }, [nav])
  const renderExercise = useCallback(
    ({ item }: ListRenderItemInfo<ExerciseLibraryItem>) => (
      <ExerciseLibraryCard exercise={item} onOpen={openExercise} />
    ),
    [openExercise],
  )
  const clearFilters = useCallback(() => {
    setQ('')
    setMuscle(null)
  }, [])
  const listContentStyle = useMemo(
    () => ({ paddingHorizontal: 20, paddingTop: 20, paddingBottom: bottomInset, gap: 12 }),
    [bottomInset],
  )

  const header = (
    <View>
      {/* Beginner guide — full card until finished, then a compact "revisit" row. */}
      {beginnerDone ? (
        <Pressable onPress={() => nav.open('beginner')} className="mb-3.5 flex-row items-center gap-2.5 rounded-[14px] bg-white/[0.03] px-3 py-2.5 active:opacity-90">
          <Check size={13} strokeWidth={3} color="rgba(126,217,87,0.8)" />
          <Text className="flex-1 text-[12.5px] font-semibold text-secondary">Beginner guide finished</Text>
          <Text className="text-[12px] font-semibold text-tertiary">Revisit</Text>
          <ChevronRight size={14} color="rgba(255,255,255,0.25)" />
        </Pressable>
      ) : (
        <Pressable onPress={() => nav.open('beginner')} className="mb-3.5 w-full flex-row items-center gap-3 rounded-[20px] border border-brand-400/20 bg-brand-400/[0.06] p-3.5 active:opacity-90">
          <View className="h-[38px] w-[38px] items-center justify-center rounded-[14px] bg-brand-400/15"><Leaf size={18} color={brand[400]} /></View>
          <View className="min-w-0 flex-1">
            <Text className="text-[14px] font-bold leading-tight text-white">New here?</Text>
            <Text className="mt-0.5 text-[12px] text-secondary">Start the beginner guide, no experience needed</Text>
          </View>
          <ChevronRight size={16} color="rgba(255,255,255,0.3)" />
        </Pressable>
      )}

      {/* Search */}
      <View className="relative mb-3">
        <View className="absolute left-3.5 top-3 z-10"><Search size={17} color="rgba(255,255,255,0.4)" /></View>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search exercises or muscle…"
          placeholderTextColor="rgba(255,255,255,0.35)"
          className="w-full rounded-2xl border border-white/10 bg-ink-800 py-3 pl-10 pr-10 text-[13.5px] text-white"
        />
        {q.length > 0 && (
          <Pressable onPress={() => setQ('')} className="absolute right-2.5 top-2.5 h-[26px] w-[26px] items-center justify-center rounded-full bg-white/[0.08] active:opacity-80">
            <X size={13} strokeWidth={2.8} color="rgba(255,255,255,0.6)" />
          </Pressable>
        )}
      </View>

      {/* Muscle-group filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5 mb-3" contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
        {muscles.map((m) => {
          const on = muscle === m
          return (
            <Pressable
              key={m}
              onPress={() => setMuscle(on ? null : m)}
              className={`flex-row items-center gap-1.5 rounded-full px-3.5 py-2 active:opacity-80 ${on ? 'bg-brand-400' : 'border border-white/10 bg-ink-800'}`}
            >
              <Text className={`text-[12.5px] font-semibold ${on ? 'text-black' : 'text-white/70'}`}>{m}</Text>
              {on && <X size={12} strokeWidth={3} color="#000" />}
            </Pressable>
          )
        })}
      </ScrollView>

      {/* Filter title + result count */}
      <View className="mb-3 flex-row items-center justify-between px-0.5">
        <Text className="text-[12px] font-bold uppercase tracking-wider text-tertiary">{muscle ?? 'All exercises'}</Text>
        <Text className="text-[12px] text-tertiary">{filtered.length} of {all.length}</Text>
      </View>

    </View>
  )

  return (
    <FlatList
      className="flex-1"
      data={filtered}
      renderItem={renderExercise}
      keyExtractor={exerciseKey}
      numColumns={2}
      columnWrapperStyle={workoutListStyles.exerciseColumns}
      contentContainerStyle={listContentStyle}
      ListHeaderComponent={header}
      ListEmptyComponent={(
        <View className="items-center px-5 py-9">
          <Search size={24} color="rgba(255,255,255,0.35)" />
          <Text className="mt-3 text-center text-[14px] font-semibold text-white">No matching exercises</Text>
          <Text className="mt-1 text-center text-[13px] leading-5 text-secondary">Try another muscle group or clear your search.</Text>
          <Pressable onPress={clearFilters} className="mt-4 min-h-11 items-center justify-center rounded-full bg-brand-400 px-5 active:opacity-90">
            <Text className="text-[13px] font-bold text-black">Clear filters</Text>
          </Pressable>
        </View>
      )}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={7}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
    />
  )
}

const ExerciseLibraryCard = memo(function ExerciseLibraryCard({
  exercise,
  onOpen,
}: {
  exercise: ExerciseLibraryItem
  onOpen: (id: string) => void
}) {
  const handleOpen = useCallback(() => onOpen(exercise.id), [exercise.id, onOpen])
  return (
    <Pressable
      onPress={handleOpen}
      accessibilityRole="button"
      accessibilityLabel={`${exercise.name}, ${exercise.muscle}`}
      className="flex-1 overflow-hidden rounded-[20px] border border-white/5 bg-ink-800 active:opacity-90"
      style={workoutListStyles.exerciseCard}
    >
      <ExerciseThumb uri={exercise.image} />
      <View className="p-3">
        <Text numberOfLines={1} className="text-[13px] font-bold text-white">{exercise.name}</Text>
        <Text className="mt-0.5 text-[11.5px] text-secondary">{exercise.muscle}</Text>
      </View>
    </Pressable>
  )
})

/* Exercise thumbnail with a consistent muscle-group fallback behind it, so a
 * slow or failed image reads as an intentional tile, never an empty grey box. */
function ExerciseThumb({ uri }: { uri: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <View className="h-[92px] w-full bg-ink-700">
      <View style={StyleSheet.absoluteFill} className="items-center justify-center">
        <Dumbbell size={26} color="rgba(126,217,87,0.35)" />
      </View>
      {!failed && (
        <Image
          source={{ uri }}
          resizeMode="cover"
          className="h-[92px] w-full"
          onError={() => setFailed(true)}
        />
      )}
    </View>
  )
}

/* Tiny volume-trend sparkline — Strava-style glanceable context on each session
 * row, showing where that session sits in your recent volume trend. */
const workoutListStyles = StyleSheet.create({
  exerciseColumns: { gap: 12 },
  exerciseCard: { maxWidth: '48.5%' },
})

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
  | { kind: 'session'; id: string; dateKey: string; name: string; volumeKg: number; durationMin: number; exercises: import('../store/types').LoggedExercise[] }
  | { kind: 'activity'; id: string; dateKey: string; name: string; icon: string; minutes: number; calories: number; intensity: string; weekly?: boolean }

const historyKey = (item: HistoryItem) => `${item.kind}:${item.id}`

function HistoryTab({ bottomInset }: { bottomInset: number }) {
  const { state, dispatch } = useStore()
  const nav = useNav()
  const toast = useToast()
  const units = state.settings.units
  const [syncing, setSyncing] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  // Two-tap inline delete confirmation (RN Alert is a no-op on web).
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const anyConnected = useMemo(
    () => Object.values(state.integrations ?? {}).some((i) => i.connected),
    [state.integrations],
  )

  const refresh = useCallback(async () => {
    if (syncing) return
    setSyncing(true)
    try {
      toast(await syncAll(state, dispatch))
    } finally {
      setSyncing(false)
    }
  }, [dispatch, state, syncing, toast])
  // Chronological volume series for the per-row sparkline, plus a lookup so each
  // session row can highlight its own point in the trend.
  const { history, volSeries, volIndex } = useMemo(() => {
    const completed = completedSessions(state)
    const chron = completed.slice().sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    const volumes = chron.map((s) => s.volumeKg)
    const indexes = new Map(chron.map((s, i) => [s.id, i]))
    const sessions: HistoryItem[] = completed.map((s) => ({ kind: 'session', id: s.id, dateKey: s.dateKey, name: s.name, volumeKg: s.volumeKg, durationMin: s.durationMin, exercises: s.exercises }))
    const acts: HistoryItem[] = (state.activities ?? []).map((a) => ({ kind: 'activity', id: a.id, dateKey: a.dateKey, name: a.name, icon: a.icon, minutes: a.minutes, calories: a.calories, intensity: a.intensity, weekly: a.weekly }))
    return {
      history: [...sessions, ...acts].sort((a, b) => b.dateKey.localeCompare(a.dateKey)),
      volSeries: volumes,
      volIndex: indexes,
    }
  }, [state])
  const listContentStyle = useMemo(
    () => ({ paddingHorizontal: 20, paddingTop: 20, paddingBottom: bottomInset, gap: 10 }),
    [bottomInset],
  )

  return (
    <FlatList
      className="flex-1"
      data={history}
      keyExtractor={historyKey}
      contentContainerStyle={listContentStyle}
      showsVerticalScrollIndicator={false}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={7}
      ListHeaderComponent={anyConnected ? (
        <Pressable
          onPress={refresh}
          disabled={syncing}
          className={`flex-row items-center justify-center gap-2 rounded-[20px] border border-brand-400/20 bg-brand-400/5 py-2.5 active:opacity-80 ${syncing ? 'opacity-60' : ''}`}
        >
          <RefreshCw size={14} color={brand[400]} />
          <Text className="text-[13px] font-semibold text-brand-400">{syncing ? 'Syncing…' : 'Sync connected apps'}</Text>
        </Pressable>
      ) : null}
      ListEmptyComponent={(
        <View className="items-center px-5 py-10">
          <Dumbbell size={28} color="rgba(126,217,87,0.55)" />
          <Text className="mt-3 text-center text-[15px] font-bold text-white">No workouts logged yet</Text>
          <Text className="mt-1 max-w-[260px] text-center text-[13px] leading-5 text-secondary">Your first one is the hardest. Start with a session or add an activity you have already completed.</Text>
          <Pressable onPress={() => nav.open('logActivity')} className="mt-4 min-h-11 items-center justify-center rounded-full bg-brand-400 px-5 active:opacity-90">
            <Text className="text-[13px] font-bold text-black">Log an activity</Text>
          </Pressable>
        </View>
      )}
      renderItem={({ item: h }) => {
        const open = openId === h.id
        return (
          <View key={h.id} className="overflow-hidden rounded-[20px] border border-white/5 bg-ink-800">
            <Pressable onPress={() => { setOpenId(open ? null : h.id); setConfirmDeleteId(null) }} className="flex-row items-center gap-3 p-3.5 active:opacity-90">
              <View className="h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px] bg-brand-400/15">
                {h.kind === 'session' ? <Icon name="dumbbell" size={20} color={brand[400]} /> : <ActivityIcon name={h.icon} size={20} color={brand[400]} />}
              </View>
              <View className="min-w-0 flex-1">
                <View className="flex-row items-center gap-1.5">
                  <Text numberOfLines={1} className="text-[14.5px] font-bold text-white">{h.name}</Text>
                  {h.kind === 'activity' && h.weekly && (
                    <View className="rounded-full bg-brand-400/15 px-1.5 py-0.5">
                      <Text className="text-[10px] font-bold text-brand-300">Weekly</Text>
                    </View>
                  )}
                </View>
                <Text className="mt-0.5 text-[12px] text-secondary">{relativeLabel(h.dateKey)}{h.kind === 'activity' ? ' · activity' : ''}</Text>
              </View>
              {h.kind === 'session' && volSeries.length >= 2 && (
                <View className="mr-1 shrink-0"><Sparkline values={volSeries} activeIndex={volIndex.get(h.id) ?? -1} color={brand[400]} /></View>
              )}
              <View className="items-end">
                {h.kind === 'session' ? (
                  <>
                    <Text className="text-[13.5px] font-bold text-white">{fmtVolume(h.volumeKg, units)}</Text>
                    <Text className="mt-px text-[12px] text-secondary">{h.durationMin} min</Text>
                  </>
                ) : (
                  <>
                    <Text className="text-[13.5px] font-bold text-white">{h.minutes} min</Text>
                    <Text className="mt-px text-[12px] capitalize text-secondary">activity</Text>
                  </>
                )}
              </View>
              <ChevronDown size={16} color="rgba(255,255,255,0.3)" style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
            </Pressable>

            {open && (
              <View className="px-3.5 pb-3.5">
                <View className="mb-3 h-px bg-white/5" />
                <View className="mb-2 flex-row items-center justify-between">
                  <Text className="text-[10.5px] font-bold uppercase tracking-wider text-tertiary">{h.kind === 'session' ? 'What you lifted' : 'Effort'}</Text>
                  <Text className="text-[11.5px] text-tertiary">
                    {h.kind === 'session' ? `${h.exercises.length} exercises · ${h.durationMin} min` : `${h.intensity} · ${h.minutes} min`}
                  </Text>
                </View>
                <View className="gap-2.5">
                  {h.kind === 'session' ? (
                    h.exercises.map((x) => {
                      const doneSets = x.sets.filter((s) => s.done)
                      const top = doneSets.length ? Math.max(...doneSets.map((s) => s.weightKg)) : 0
                      const vol = doneSets.reduce((a, s) => a + s.weightKg * s.reps, 0)
                      return (
                        <View key={x.defId} className="flex-row items-center justify-between gap-3">
                          <View className="min-w-0 flex-1">
                            <Text numberOfLines={1} className="text-[13px] font-semibold text-white">{x.name}</Text>
                            <Text className="mt-px text-[11.5px] text-secondary">{x.sets.length} sets × {x.targetReps} reps</Text>
                          </View>
                          <View className="items-end">
                            <Text className="text-[13px] font-bold text-brand-300">{fmtWeight(top, units, units === 'imperial' ? 0 : 1)}</Text>
                            <Text className="mt-px text-[11px] text-tertiary">{fmtVolume(vol, units)}</Text>
                          </View>
                        </View>
                      )
                    })
                  ) : (
                    <View className="flex-row items-center justify-between gap-3">
                      <View className="min-w-0 flex-1">
                        <Text className="text-[13px] font-semibold text-white">Estimated burn</Text>
                        <Text className="mt-px text-[11.5px] capitalize text-secondary">{h.minutes} min at {h.intensity} effort</Text>
                      </View>
                      <Text className="text-[13px] font-bold text-brand-300">{h.calories} kcal</Text>
                    </View>
                  )}
                </View>

                {/* Correct or remove this record (audit F-012): edits reuse the
                    set-logging surface; deletion is two-tap confirmed and
                    reconciles charts, streaks and habit flags in the reducer. */}
                <View className="mt-3 flex-row gap-2">
                  {h.kind === 'session' && (
                    <Pressable
                      onPress={() => nav.open('activeWorkout', { sessionId: h.id })}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${h.name}`}
                      className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-white/[0.06] py-2.5 active:opacity-80"
                    >
                      <Pencil size={13} color="rgba(255,255,255,0.7)" />
                      <Text className="text-[12.5px] font-bold text-white/80">Edit sets</Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => {
                      if (confirmDeleteId !== h.id) { setConfirmDeleteId(h.id); return }
                      setConfirmDeleteId(null)
                      setOpenId(null)
                      if (h.kind === 'session') dispatch({ type: 'REMOVE_SESSION', id: h.id })
                      else dispatch({ type: 'REMOVE_ACTIVITY', id: h.id })
                      toast(h.kind === 'session' ? 'Workout deleted — charts and streaks updated' : 'Activity deleted')
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={confirmDeleteId === h.id ? `Confirm delete ${h.name}` : `Delete ${h.name}`}
                    className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2.5 active:opacity-80 ${confirmDeleteId === h.id ? 'bg-red-500/20' : 'bg-white/[0.06]'}`}
                  >
                    <Trash2 size={13} color={confirmDeleteId === h.id ? '#f87171' : 'rgba(255,255,255,0.7)'} />
                    <Text className={`text-[12.5px] font-bold ${confirmDeleteId === h.id ? 'text-red-400' : 'text-white/80'}`}>
                      {confirmDeleteId === h.id ? 'Tap again to delete' : 'Delete'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        )
      }}
    />
  )
}
