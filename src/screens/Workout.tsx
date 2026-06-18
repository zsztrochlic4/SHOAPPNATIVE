import { useMemo, useState } from 'react'
import { View, Text, Pressable, Image, TextInput } from 'react-native'
import { CalendarDays, Clock, Play, ChevronRight, Check, CheckSquare, Leaf } from 'lucide-react-native'
import { Icon } from '../components/Icon'
import { ProgressBar, SegmentedTabs, ScreenHeader, Chip } from '../components/ui'
import { Hero } from '../components/Hero'
import { useStore } from '../store/store'
import { useNav } from '../nav'
import { EXERCISES } from '../data/catalog'
import { fmtVolume, fmtWeight } from '../lib/format'
import { relativeLabel } from '../lib/date'
import { todaySession, sessionProgress, completedSessions } from '../store/selectors'
import { brand, useColors } from '../theme'

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

  if (!session) {
    return (
      <View className="items-center rounded-2xl border border-white/5 bg-ink-800 p-8">
        <Text className="text-2xl">😌</Text>
        <Text className="mt-2 font-bold text-white">Rest Day</Text>
        <Text className="mt-1 text-center text-[13px] text-white/50">Recovery is where you grow. Try a mobility flow or a walk.</Text>
        <Pressable onPress={() => nav.open('quick')} className="btn-primary mt-4 active:opacity-90">
          <Text className="font-semibold text-black">Quick mobility</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <>
      <Hero image={session.image} rounded={16}>
        <Text className="text-sm font-semibold text-brand-400">{session.focus}</Text>
        <Text className="mt-1 text-3xl font-extrabold text-white">{session.name}</Text>
        <View className="mt-2 flex-row items-center gap-1.5">
          <Clock size={15} color="rgba(255,255,255,0.65)" />
          <Text className="text-sm text-white/65">{session.exercises.length} exercises • ~{session.durationMin} min</Text>
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
        <View className="mt-4 flex-row gap-3 rounded-2xl border border-white/5 bg-ink-800 p-4">
          <Stat icon="dumbbell" color="#7ED957" label="Volume" value={fmtVolume(session.volumeKg, units)} />
          <Stat icon="clock" color="#9AA0A6" label="Duration" value={`${session.durationMin} min`} />
          <Stat icon="flame" color="#9AA0A6" label="Calories" value={`${session.calories} kcal`} />
        </View>
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
                  <Text className="text-[12px] text-white/50">{e.targetSets} sets • {e.targetReps} reps · how to</Text>
                </Pressable>
                <Chip color={done ? 'green' : 'gray'}>{fmtWeight(topWeight, units, units === 'imperial' ? 0 : 1)}</Chip>
                <Pressable onPress={() => nav.open('exerciseDetail', { defId: e.defId })}><ChevronRight size={18} color="rgba(255,255,255,0.3)" /></Pressable>
              </View>
            )
          })}
        </View>
      </View>

      <Pressable onPress={() => nav.open('activeWorkout')} className="mt-5 w-full flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-4 active:opacity-90">
        <View className="h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-400/15"><CheckSquare size={20} color={brand[400]} /></View>
        <View className="flex-1">
          <Text className="font-bold text-white">Finish Strong</Text>
          <Text className="text-[13px] text-white/55">You're one step closer to your goal.</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Text className="text-sm font-semibold text-brand-400">Open</Text>
          <ChevronRight size={16} color={brand[400]} />
        </View>
      </Pressable>
      <View className="h-2" />
    </>
  )
}

function ProgramTab() {
  const { state } = useStore()
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

function ExercisesTab() {
  const { state } = useStore()
  const nav = useNav()
  const dorm = state.profile.equipment === 'dorm-bodyweight'
  const [q, setQ] = useState('')
  const filtered = useMemo(() => EXERCISES.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()) || e.muscle.toLowerCase().includes(q.toLowerCase())), [q])
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
        className="mb-4 w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-sm text-white"
      />
      <View className="flex-row flex-wrap gap-3">
        {filtered.map((e) => (
          <Pressable key={e.id} onPress={() => nav.open('exerciseDetail', { defId: e.id })} className="flex-1 basis-[47%] overflow-hidden rounded-2xl border border-white/5 bg-ink-800 active:opacity-90">
            <Image source={{ uri: e.image }} resizeMode="cover" className="h-24 w-full" />
            <View className="p-3">
              <Text numberOfLines={1} className="text-sm font-bold text-white">{dorm && e.bodyweightAlt ? e.bodyweightAlt : e.name}</Text>
              <Text className="text-[12px] text-white/45">{e.muscle}</Text>
              {dorm && e.bodyweightAlt && <Chip color="gray" className="mt-1.5">Bodyweight</Chip>}
            </View>
          </Pressable>
        ))}
        {filtered.length === 0 && <Text className="w-full py-8 text-center text-sm text-white/40">No exercises found.</Text>}
      </View>
    </View>
  )
}

function HistoryTab() {
  const { state } = useStore()
  const units = state.settings.units
  const history = completedSessions(state).sort((a, b) => b.dateKey.localeCompare(a.dateKey)).slice(0, 20)
  return (
    <View className="gap-3">
      {history.map((h) => (
        <View key={h.id} className="flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-4">
          <View className="h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-400/15"><Icon name="dumbbell" size={20} color="#7ED957" /></View>
          <View className="flex-1">
            <Text className="font-bold text-white">{h.name}</Text>
            <Text className="text-[12px] text-white/45">{relativeLabel(h.dateKey)}</Text>
          </View>
          <View className="items-end">
            <Text className="text-sm font-semibold text-white">{fmtVolume(h.volumeKg, units)}</Text>
            <Text className="text-[12px] text-white/45">{h.durationMin} min</Text>
          </View>
        </View>
      ))}
    </View>
  )
}

function Stat({ icon, color, label, value }: { icon: string; color: string; label: string; value: string }) {
  return (
    <View className="flex-1">
      <Icon name={icon} size={18} color={color} />
      <Text className="mt-1.5 text-[12px] text-white/55">{label}</Text>
      <Text className="text-lg font-extrabold leading-tight text-white">{value}</Text>
    </View>
  )
}
