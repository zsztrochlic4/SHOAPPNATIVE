import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, ScrollView, Image, TextInput, StyleSheet, Animated, Easing, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Circle } from 'react-native-svg'
import {
  Check, Plus, Minus, Flag, Info, ChevronDown, Bell, BookOpen, Play, Target,
  ChevronLeft, Timer, ListChecks, HelpCircle, X,
} from 'lucide-react-native'
import { Sheet } from '../components/Sheet'
import { AppModal } from '../components/WebFrame'
import { PressableScale } from '../components/PressableScale'
import { tick, thud } from '../lib/haptics'
import { beep, restTick, successChime } from '../lib/sound'
import { TechniqueClip } from '../components/TechniqueClip'
import { useStore } from '../store/store'
import { useToast } from '../components/Toast'
import { useNav } from '../nav'
import { todaySession, sessionProgress } from '../store/selectors'
import { examState, examTrim } from '../store/training'
import { prForSession, type PR } from '../store/coach'
import { exerciseDetail, workoutGoalLine } from '../data/catalog'
import { fmtWeightNum, weightUnit, fmtVolume, fmtWeight, toKg } from '../lib/format'
import { brand, accent, useColors } from '../theme'
import type { Units, WorkoutSession } from '../store/types'

const brandColor = brand[400]
const accentPurple = accent.purple
const accentOrange = accent.orange

/* Compound lifts rest longer than isolation work. No rest field exists in the
 * data model, so derive a sensible default from the exercise id. */
const COMPOUND_LIFTS = ['bench', 'squat', 'deadlift', 'ohp', 'row', 'pulldown', 'legpress', 'rdl', 'incline', 'shoulder']
const ISOLATION_LIFTS = ['cablefly', 'tricep', 'curl', 'lateral']
function restSecondsFor(defId: string): number {
  if (COMPOUND_LIFTS.includes(defId)) return 120
  if (ISOLATION_LIFTS.includes(defId)) return 60
  return 90
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && (window as any).matchMedia?.('(prefers-reduced-motion: reduce)').matches

type Mode = 'overview' | 'work' | 'rest' | 'go'
type Cursor = { exIdx: number; setIdx: number }

/** First not-done set at or after fromExIdx, wrapping back to earlier exercises. */
function nextUndoneCursor(s: WorkoutSession, fromExIdx: number): Cursor | null {
  const order = [
    ...s.exercises.map((_, i) => i).filter((i) => i >= fromExIdx),
    ...s.exercises.map((_, i) => i).filter((i) => i < fromExIdx),
  ]
  for (const i of order) {
    const setIdx = s.exercises[i].sets.findIndex((set) => !set.done)
    if (setIdx >= 0) return { exIdx: i, setIdx }
  }
  return null
}

function mmss(total: number): string {
  const m = Math.floor(total / 60)
  const s = String(Math.max(0, total) % 60).padStart(2, '0')
  return `${m}:${s}`
}

/** Rest ring colour: brand green at full → muted amber → soft red near zero.
 *  Kept at the site's calmer saturation/lightness so it never looks neon. */
function restColor(frac: number): string {
  const f = Math.max(0, Math.min(1, frac))
  return `hsl(${Math.round(96 * f)}, 64%, 60%)`
}

/* SVG props can't run on the native driver, so ring animations use the JS
 * driver — that's fine here, they're low-frequency and off the gesture path. */
const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const USE_NATIVE = Platform.OS !== 'web'

/** Gentle entrance for a focus screen's content: fades and rises into place so
 *  the modal cross-fade doesn't read as a hard cut. */
function useRise(deps: unknown[] = []) {
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    v.setValue(0)
    Animated.timing(v, { toValue: 1, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: USE_NATIVE }).start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return {
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
  }
}

/** Slow breathing pulse — signals the work timer is live without distracting. */
function usePulse() {
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: USE_NATIVE }),
        Animated.timing(v, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: USE_NATIVE }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [v])
  return v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] })
}

export default function ActiveWorkout({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const nav = useNav()
  const colors = useColors()
  const units = state.settings.units
  const session = todaySession(state)

  const [mode, setMode] = useState<Mode>('overview')
  const [cursor, setCursor] = useState<Cursor | null>(null)
  const [workElapsed, setWorkElapsed] = useState(0)
  const [rest, setRest] = useState<number | null>(null)
  const [restTotal, setRestTotal] = useState(120)
  const [total, setTotal] = useState(0)
  const [howTo, setHowTo] = useState<Set<string>>(new Set())
  const [goalOpen, setGoalOpen] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [finishPR, setFinishPR] = useState<PR | null>(null)
  const finishStatsRef = useRef<{ time: number; volume: number; sets: number } | null>(null)
  const finishHandled = useRef(false)
  const startRef = useRef<number>(Date.now())

  // Fresh guided state every time the sheet opens.
  useEffect(() => {
    if (!open) return
    setMode('overview'); setCursor(null); setRest(null); setWorkElapsed(0); setTotal(0)
    setFinishing(false); setFinishPR(null); setConfirmEnd(false)
    // Opening the workout counts as starting it for today's dashboard tick.
    if (session) dispatch({ type: 'MARK_WORKOUT_STARTED' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // After the completion tick, hand off to a PR moment or close.
  useEffect(() => {
    if (!finishing) return
    const t = setTimeout(() => afterFinish(), 4500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishing])

  // Overall session clock — runs the whole time the sheet is open.
  useEffect(() => {
    if (!open) return
    startRef.current = Date.now()
    const t = setInterval(() => setTotal(Math.floor((Date.now() - startRef.current) / 1000)), 1000)
    return () => clearInterval(t)
  }, [open])

  // Work clock — counts up while performing a set.
  useEffect(() => {
    if (!open || mode !== 'work') return
    const t = setInterval(() => setWorkElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [open, mode, cursor])

  // Rest clock — counts down.
  useEffect(() => {
    if (mode !== 'rest' || rest === null || rest <= 0) return
    const t = setTimeout(() => setRest((r) => (r === null ? null : r - 1)), 1000)
    return () => clearTimeout(t)
  }, [mode, rest])

  // Final-seconds countdown tick — a quiet, rising cue in the last 3 seconds of
  // rest so you can look up from your phone and be ready before GO.
  useEffect(() => {
    if (mode === 'rest' && rest !== null && rest <= 3 && rest > 0) restTick()
  }, [mode, rest])

  // Rest reached zero → alert, then the GO cue.
  useEffect(() => {
    if (mode === 'rest' && rest === 0) {
      thud() // haptic pop the instant rest ends — the GO screen "lands"
      if (!prefersReducedMotion()) (typeof navigator !== 'undefined' ? (navigator as any) : undefined)?.vibrate?.([200, 100, 200])
      beep()
      if (typeof document !== 'undefined' && (document as any).hidden && typeof window !== 'undefined' && 'Notification' in window && (window as any).Notification.permission === 'granted') {
        try { new (window as any).Notification('Rest done. Start your next set') } catch { /* ignore */ }
      }
      setMode('go')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, rest])

  const prog = useMemo(() => sessionProgress(session), [session])
  const exam = examState(state)
  const trim = useMemo(() => (session ? examTrim(session, state) : null), [session, state])

  if (!session) return null

  function patch(next: WorkoutSession) {
    dispatch({ type: 'SAVE_SESSION', session: next })
  }

  function setSet(exIdx: number, setIdx: number, field: 'weightKg' | 'reps', value: number) {
    if (!session) return
    const exercises = session.exercises.map((ex, i) =>
      i !== exIdx ? ex : { ...ex, sets: ex.sets.map((s, j) => (j === setIdx ? { ...s, [field]: Math.max(0, value) } : s)) },
    )
    patch({ ...session, exercises })
  }

  function toggleSet(exIdx: number, setIdx: number) {
    if (!session) return
    const nowDone = !session.exercises[exIdx].sets[setIdx].done
    if (nowDone) thud(); else tick()
    const exercises = session.exercises.map((ex, i) =>
      i !== exIdx ? ex : { ...ex, sets: ex.sets.map((s, j) => (j === setIdx ? { ...s, done: !s.done } : s)) },
    )
    patch({ ...session, exercises })
  }

  function addSet(exIdx: number) {
    if (!session) return
    const exercises = session.exercises.map((ex, i) => {
      if (i !== exIdx) return ex
      const last = ex.sets.at(-1)
      return { ...ex, sets: [...ex.sets, { weightKg: last?.weightKg ?? 0, reps: last?.reps ?? 8, done: false }] }
    })
    patch({ ...session, exercises })
  }

  function toggleHowTo(defId: string) {
    setHowTo((prev) => {
      const next = new Set(prev)
      if (next.has(defId)) next.delete(defId)
      else next.add(defId)
      return next
    })
  }

  /* ---- guided flow controls ---- */
  function startGuided() {
    if (!session) return
    if (rest !== null) { setMode('rest'); return } // resume an in-progress rest
    const c = nextUndoneCursor(session, 0)
    if (!c) { toast('Every set is done. Finish when ready.'); return }
    setCursor(c); setWorkElapsed(0); setRest(null); setMode('work')
  }

  function startAt(exIdx: number) {
    if (!session) return
    const found = session.exercises[exIdx].sets.findIndex((s) => !s.done)
    setCursor({ exIdx, setIdx: found >= 0 ? found : 0 })
    setWorkElapsed(0); setRest(null); setMode('work')
  }

  // Finish the current set → log it done, then rest before the next set.
  function startRest() {
    if (!session || !cursor) return
    thud() // logging a set is a commit — give it a confident tap back
    const { exIdx } = cursor
    const exercises = session.exercises.map((ex, i) =>
      i !== exIdx ? ex : { ...ex, sets: ex.sets.map((s, j) => (j === cursor.setIdx ? { ...s, done: true } : s)) },
    )
    const next = { ...session, exercises }
    patch(next)

    const upcoming = nextUndoneCursor(next, exIdx)
    if (!upcoming) { setCursor(null); setRest(null); setMode('overview'); toast('All sets logged. Finish strong.'); return }
    setCursor(upcoming)
    const secs = restSecondsFor(session.exercises[exIdx].defId)
    setRestTotal(secs); setRest(secs); setMode('rest')
  }

  function advance() {
    setRest(null); setWorkElapsed(0); setMode('work')
  }

  function backToList() {
    setMode('overview')
  }

  function finish() {
    if (!session || finishing) return
    finishStatsRef.current = { time: total, volume: session.volumeKg, sets: sessionProgress(session).done }
    setFinishPR(prForSession(state, session))
    dispatch({ type: 'COMPLETE_WORKOUT', id: session.id })
    thud() // native haptic; the web vibrate below is a no-op on most phones
    if (!prefersReducedMotion()) (typeof navigator !== 'undefined' ? (navigator as any) : undefined)?.vibrate?.([0, 55, 45, 120])
    successChime()
    finishHandled.current = false
    setFinishing(true)
  }

  function afterFinish() {
    if (finishHandled.current) return
    finishHandled.current = true
    setFinishing(false)
    if (finishPR) {
      nav.open('prCelebration', { lift: finishPR.name, weight: fmtWeight(finishPR.weightKg, units, units === 'imperial' ? 0 : 1), reps: finishPR.reps })
    } else {
      toast('Workout logged. Streak updated.')
      onClose()
    }
  }

  const cursorEx = cursor ? session.exercises[cursor.exIdx] : null
  const cursorSet = cursor && cursorEx ? cursorEx.sets[cursor.setIdx] : null
  const allDone = prog.total > 0 && prog.done === prog.total
  // The current exercise = first one not yet fully done; only it gets highlighted.
  const activeIdx = session.exercises.findIndex((ex) => !(ex.sets.length > 0 && ex.sets.every((s) => s.done)))

  /* ============================ Guided focus screens ============================ */
  if (finishing) {
    return <FinishScreen open={open} name={session.name} stats={finishStatsRef.current} units={units} onDone={afterFinish} />
  }

  if (mode === 'work' && cursor && cursorEx && cursorSet) {
    return (
      <WorkScreen
        open={open}
        ex={cursorEx}
        cursor={cursor}
        elapsed={workElapsed}
        sessionTotal={total}
        exIndex={cursor.exIdx}
        exTotal={session.exercises.length}
        detail={exerciseDetail(cursorEx.defId)}
        reps={cursorSet.reps}
        onLogReps={(v) => setSet(cursor.exIdx, cursor.setIdx, 'reps', v)}
        onBack={backToList}
        onStartRest={startRest}
      />
    )
  }

  if ((mode === 'rest' || mode === 'go') && cursor && cursorEx && cursorSet && rest !== null) {
    return (
      <RestScreen
        open={open}
        go={mode === 'go'}
        remaining={Math.max(0, rest)}
        total={restTotal}
        nextEx={cursorEx}
        nextCursor={cursor}
        nextSet={cursorSet}
        units={units}
        onSub={() => setRest((r) => Math.max(0, (r ?? 30) - 15))}
        onAdd={() => { setRestTotal((t) => t + 15); setRest((r) => (r ?? 0) + 15) }}
        onSkip={advance}
        onGo={advance}
        onBack={backToList}
      />
    )
  }

  /* ================================ Overview ================================ */
  return (
    <Sheet open={open} onClose={onClose} title={session.name} full>
      {/* A clean, single-line CTA to launch the follow-along flow (mirrors web). */}
      {/* Primary CTA — always present. Launches the follow-along flow while the
       *  workout is in progress, and becomes "Finish workout" once every set is
       *  logged so there's always a clear green action at the top. */}
      <PressableScale
        onPress={allDone ? finish : startGuided}
        containerStyle={{ marginBottom: 16 }}
        className="w-full flex-row items-center justify-center gap-2.5 rounded-xl py-6"
        style={{ backgroundColor: brand[500] }}
      >
        {allDone ? <Flag size={17} color="#fff" /> : <Play size={17} color="#fff" fill="#fff" />}
        <Text className="text-[15px] font-bold text-white">
          {allDone ? 'Finish workout' : rest !== null ? 'Resume rest' : prog.done > 0 ? 'Resume workout' : 'Start workout'}
        </Text>
      </PressableScale>

      {exam.active && (
        <View className="mb-4 flex-row items-start gap-2.5 rounded-2xl border border-accent-purple/25 bg-accent-purple/10 p-3.5">
          <Info size={18} color={accentPurple} style={{ marginTop: 2 }} />
          <Text className="flex-1 text-[13px] leading-snug text-white/70">
            Exam mode is on. Your {trim?.keptCount} key lifts are all you need today. The rest are optional, do them only if you have time and energy.
          </Text>
        </View>
      )}

      {/* What today's session is for. Collapsed by default so the list leads. */}
      <View className="mb-4 overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.03]">
        <Pressable onPress={() => setGoalOpen((o) => !o)} className="w-full flex-row items-center gap-1.5 px-3.5 py-2.5 active:opacity-80">
          <Target size={13} color="rgba(126,217,87,0.8)" />
          <Text className="text-[11px] font-bold uppercase tracking-[1.6px] text-brand-400/90">Today's goal</Text>
          <View className="ml-auto">
            <ChevronDown size={15} color="rgba(255,255,255,0.4)" style={{ transform: [{ rotate: goalOpen ? '180deg' : '0deg' }] }} />
          </View>
        </Pressable>
        {goalOpen && (
          <Text className="px-3.5 pb-3 text-[13px] leading-snug text-white/70">
            {workoutGoalLine(session.name, session.focus, state.profile.goal)}
          </Text>
        )}
      </View>

      <Text className="mb-3 text-[12px] font-bold uppercase tracking-[1.8px] text-white/35">{session.exercises.length} exercises</Text>

      <View className="gap-3">
        {session.exercises.map((ex, exIdx) => {
          const isOptional = trim?.optionalIds.has(ex.defId)
          const exDone = ex.sets.length > 0 && ex.sets.every((s) => s.done)
          const isActive = exIdx === activeIdx
          const detail = exerciseDetail(ex.defId)
          const howToOpen = howTo.has(ex.defId)
          // Compact performance line: shared weight once, then each set's reps.
          const weights = ex.sets.map((s) => s.weightKg)
          const sameWeight = weights.length > 0 && weights.every((w) => w === weights[0])
          const lastLine = ex.sets.length === 0 ? null : sameWeight
            ? `${fmtWeightNum(weights[0], units, units === 'imperial' ? 0 : 1)}${weightUnit(units)} × ${ex.sets.map((s) => s.reps).join(', ')}`
            : ex.sets.map((s) => `${fmtWeightNum(s.weightKg, units, units === 'imperial' ? 0 : 1)}${weightUnit(units)}×${s.reps}`).join(', ')
          return (
            <View
              key={ex.defId}
              className={`overflow-hidden rounded-2xl border ${isActive ? 'border-brand-400/50 bg-brand-400/[0.05]' : 'border-white/[0.04] bg-ink-800'} ${isOptional ? 'opacity-70' : ''}`}
              style={isActive ? { boxShadow: '0 0 22px -8px rgba(126,217,87,0.55)' } : undefined}
            >
              <View className="flex-row gap-3.5 p-3.5">
                <View className="relative self-start">
                  <Image source={{ uri: ex.image }} resizeMode="cover" className="h-[88px] w-[88px] rounded-xl" style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }} />
                  {exDone && (
                    <View className="absolute inset-0 items-center justify-center rounded-xl" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
                      <View className="h-6 w-6 items-center justify-center rounded-full bg-brand-400">
                        <Check size={14} strokeWidth={3.5} color="#000" />
                      </View>
                    </View>
                  )}
                </View>
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text numberOfLines={1} className="flex-1 text-[17px] font-bold leading-tight text-white">{ex.name}</Text>
                    {isActive && (
                      <View className="rounded-full bg-brand-400/15 px-2 py-0.5">
                        <Text className="text-[10px] font-bold uppercase tracking-wide text-brand-300">Now</Text>
                      </View>
                    )}
                    {isOptional && (
                      <View className="rounded-full bg-white/10 px-2 py-0.5">
                        <Text className="text-[10px] font-semibold text-white/55">Optional</Text>
                      </View>
                    )}
                  </View>
                  <Text className="mt-1 text-[12px] font-medium text-white/45">{ex.targetSets} sets · {ex.targetReps} reps</Text>
                  {lastLine && (
                    <Text className="mt-2 text-[12px] leading-snug">
                      <Text className="text-white/35">Last: </Text>
                      <Text className="font-semibold text-white/70">{lastLine}</Text>
                    </Text>
                  )}

                  {/* Actions */}
                  <View className="mt-3.5 flex-row gap-2">
                    <PressableScale haptic={false} scaleTo={0.97} containerStyle={{ flex: 1 }} onPress={() => toggleHowTo(ex.defId)} className="flex-row items-center justify-center gap-1.5 rounded-xl bg-white/[0.09] py-2">
                      <BookOpen size={14} color="rgba(255,255,255,0.85)" />
                      <Text className="text-[12px] font-semibold text-white/85">Form & video</Text>
                    </PressableScale>
                    <PressableScale scaleTo={0.97} containerStyle={{ flex: 1 }} onPress={() => startAt(exIdx)} className={`flex-row items-center justify-center gap-1.5 rounded-xl py-2 ${isActive ? 'bg-brand-400' : 'bg-white/[0.09]'}`}>
                      <Play size={13} color={isActive ? '#000' : 'rgba(255,255,255,0.85)'} fill={isActive ? '#000' : 'rgba(255,255,255,0.85)'} />
                      <Text className={`text-[12px] font-bold ${isActive ? 'text-black' : 'text-white/85'}`}>{exDone ? 'Redo' : 'Start'}</Text>
                    </PressableScale>
                  </View>
                </View>
              </View>

              {howToOpen && (
                <View className="border-t border-white/5 px-3.5 pb-4 pt-3.5">
                  <TechniqueClip exerciseId={ex.defId} poster={ex.image} label="Form clip coming soon" />
                  <Text className="mt-3 text-[13px] leading-snug text-white/70">{detail.desc}</Text>
                  <View className="mt-3 gap-2">
                    {detail.cues.map((c, i) => (
                      <View key={i} className="flex-row items-start gap-2.5">
                        <View className="h-5 w-5 items-center justify-center rounded-full bg-brand-400/15">
                          <Text className="text-[11px] font-bold text-brand-400">{i + 1}</Text>
                        </View>
                        <Text className="flex-1 text-[13px] text-white/75">{c}</Text>
                      </View>
                    ))}
                  </View>
                  <View className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                    <Text className="text-[12px] leading-snug text-white/55">
                      <Text className="font-semibold text-white/70">Common mistake · </Text>{detail.commonMistake}
                    </Text>
                  </View>
                  <Pressable onPress={() => nav.open('exerciseDetail', { defId: ex.defId })} className="mt-3 flex-row items-center gap-1.5 active:opacity-70">
                    <BookOpen size={13} color={brandColor} />
                    <Text className="text-[12px] font-semibold text-brand-400">Open full guide</Text>
                  </Pressable>
                  {/* Manual set editor stays available for tweaks */}
                  <View className="mt-4 gap-1.5">
                    <Text className="mb-1 text-[11px] font-bold uppercase tracking-wide text-white/35">Log manually</Text>
                    {ex.sets.map((set, setIdx) => (
                      <ManualSetRow
                        key={setIdx}
                        index={setIdx}
                        set={set}
                        units={units}
                        onWeight={(v) => setSet(exIdx, setIdx, 'weightKg', toKg(v, units))}
                        onReps={(v) => setSet(exIdx, setIdx, 'reps', v)}
                        onToggle={() => toggleSet(exIdx, setIdx)}
                      />
                    ))}
                    <Pressable onPress={() => addSet(exIdx)} className="mt-1 w-full flex-row items-center justify-center gap-1 rounded-lg border border-dashed border-white/[0.12] py-1.5 active:opacity-70">
                      <Plus size={13} color="rgba(255,255,255,0.55)" />
                      <Text className="text-[12px] font-semibold text-white/55">Add set</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          )
        })}
      </View>

      {/* Secondary "finish early" affordance while in progress. Once allDone, the
       *  top green CTA is already "Finish workout", so this would just duplicate it.
       *  With sets still to go, a two-tap confirm prevents ending the session by
       *  accident — no silent finish. */}
      {!allDone && (
        <View style={{ marginTop: 20 }}>
          {confirmEnd && (
            <View className="mb-2.5 flex-row items-center gap-2.5 rounded-2xl border border-accent-orange/25 bg-accent-orange/10 p-3.5">
              <Info size={18} color={accentOrange} style={{ marginTop: 1 }} />
              <Text className="flex-1 text-[13px] leading-snug text-white/75">
                End early? {prog.total - prog.done} set{prog.total - prog.done === 1 ? '' : 's'} still to go — they won't be logged.
              </Text>
            </View>
          )}
          <PressableScale
            onPress={() => { if (!confirmEnd) { tick(); setConfirmEnd(true); return } finish() }}
            haptic={false}
            className={`w-full flex-row items-center justify-center gap-2 rounded-full border py-3.5 ${confirmEnd ? 'border-accent-orange/50 bg-accent-orange/15' : 'border-white/10 bg-white/[0.04]'}`}
          >
            <Flag size={16} color={confirmEnd ? accentOrange : '#fff'} />
            <Text className="font-bold" style={{ color: confirmEnd ? accentOrange : '#fff' }}>{confirmEnd ? 'End workout early' : 'Finish workout'}</Text>
          </PressableScale>
          {confirmEnd && (
            <Pressable onPress={() => setConfirmEnd(false)} className="mt-2 items-center py-2 active:opacity-70">
              <Text className="text-[13px] font-semibold text-white/55">Keep going</Text>
            </Pressable>
          )}
        </View>
      )}
      <View className="h-2" />
    </Sheet>
  )
}

/* Manual set editor row — uncontrolled-style commit on blur, like the web input. */
function ManualSetRow({
  index, set, units, onWeight, onReps, onToggle,
}: {
  index: number
  set: { weightKg: number; reps: number; done: boolean }
  units: Units
  onWeight: (v: number) => void
  onReps: (v: number) => void
  onToggle: () => void
}) {
  const [weightText, setWeightText] = useState(fmtWeightNum(set.weightKg, units, units === 'imperial' ? 0 : 1))
  const [repsText, setRepsText] = useState(String(set.reps))

  // Resync when the underlying value changes (mirrors the web `key` remount).
  useEffect(() => { setWeightText(fmtWeightNum(set.weightKg, units, units === 'imperial' ? 0 : 1)) }, [set.weightKg, units])
  useEffect(() => { setRepsText(String(set.reps)) }, [set.reps])

  return (
    <View className="flex-row items-center gap-2">
      <Text className="w-6 text-[12px] font-bold text-white/45">{index + 1}</Text>
      <TextInput
        value={weightText}
        onChangeText={setWeightText}
        onBlur={() => onWeight(parseFloat(weightText) || 0)}
        keyboardType="decimal-pad"
        placeholderTextColor="rgba(148,148,148,0.6)"
        className="flex-1 rounded-lg border border-white/10 bg-ink-700 px-2 py-1.5 text-center text-[13px] font-semibold text-white"
      />
      <TextInput
        value={repsText}
        onChangeText={setRepsText}
        onBlur={() => onReps(parseInt(repsText) || 0)}
        keyboardType="number-pad"
        placeholderTextColor="rgba(148,148,148,0.6)"
        className="flex-1 rounded-lg border border-white/10 bg-ink-700 px-2 py-1.5 text-center text-[13px] font-semibold text-white"
      />
      <Pressable onPress={onToggle} className={`ml-auto h-7 w-7 items-center justify-center rounded-lg active:opacity-80 ${set.done ? 'bg-brand-400' : ''}`} style={{ borderWidth: 2, borderColor: set.done ? brandColor : 'rgba(255,255,255,0.2)' }}>
        {set.done && <Check size={14} strokeWidth={3} color="#000" />}
      </Pressable>
    </View>
  )
}

/* ============================ Work screen ============================ */
function WorkScreen({
  open, ex, cursor, elapsed, sessionTotal, exIndex, exTotal, detail, reps,
  onLogReps, onBack, onStartRest,
}: {
  open: boolean
  ex: WorkoutSession['exercises'][number]
  cursor: Cursor
  elapsed: number
  sessionTotal: number
  exIndex: number
  exTotal: number
  detail: { desc: string; cues: string[]; commonMistake: string; video?: string }
  reps: number
  onLogReps: (reps: number) => void
  onBack: () => void
  onStartRest: () => void
}) {
  const [showHow, setShowHow] = useState(false)
  const lastSet = cursor.setIdx + 1 >= ex.sets.length
  const pulse = usePulse()
  const rise = useRise([])

  return (
    <FullScreen open={open} backgroundColor="#0a0a0b">
      {/* Faint exercise backdrop for context */}
      <Image source={{ uri: ex.image }} resizeMode="cover" style={[StyleSheet.absoluteFill, { opacity: 0.1 }]} />
      <LinearGradient
        colors={['rgba(10,10,11,0.4)', 'transparent', '#0a0a0b']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View className="relative">
        {/* Top bar — clear way back to the full list */}
        <View className="flex-row items-center justify-between px-5 pb-2 pt-4">
          <Pressable onPress={onBack} className="flex-row items-center gap-1.5 rounded-full bg-white/[0.06] py-2 pl-2.5 pr-3.5 active:opacity-80">
            <ListChecks size={15} color="rgba(255,255,255,0.8)" />
            <Text className="text-[13px] font-semibold text-white/80">All exercises</Text>
          </Pressable>
          <View className="flex-row items-center gap-1.5">
            <Timer size={14} color="rgba(255,255,255,0.45)" />
            <Text className="text-[13px] font-semibold text-white/45">{mmss(sessionTotal)}</Text>
          </View>
        </View>

        {/* Where am I: exercise position, name, what it is */}
        <View className="items-center px-6">
          <Text className="text-center text-[11px] font-black uppercase tracking-[2.4px] text-brand-400">
            Exercise {exIndex + 1} of {exTotal} · Set {cursor.setIdx + 1} of {ex.sets.length}
          </Text>
          <Text className="mt-1.5 text-center text-[26px] font-black leading-tight tracking-tight text-white">{ex.name}</Text>
          <SetDots sets={ex.sets} current={cursor.setIdx} />
          <Pressable
            onPress={() => setShowHow(true)}
            className="mt-3 flex-row items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.05] py-1.5 pl-3 pr-3.5 active:opacity-80"
          >
            <HelpCircle size={14} color="rgba(255,255,255,0.75)" />
            <Text className="text-[12px] font-semibold text-white/75">Not sure how? Show me</Text>
          </Pressable>
        </View>
      </View>

      {/* Big count-up timer — plain number, faint green ring that gently breathes */}
      <View className="relative flex-1 items-center justify-center">
        <Animated.View style={[{ width: 280, height: 280, alignItems: 'center', justifyContent: 'center' }, rise]}>
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: pulse }] }]} pointerEvents="none">
            <Svg viewBox="0 0 100 100" width={280} height={280} style={[StyleSheet.absoluteFill, { transform: [{ rotate: '-90deg' }] }]}>
              <Circle cx="50" cy="50" r="47.6" fill="none" stroke="rgba(126,217,87,0.14)" strokeWidth="1.6" />
              <Circle cx="50" cy="50" r="47.6" fill="none" stroke="#7ED957" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="2 7" opacity={0.7} />
            </Svg>
          </Animated.View>
          <View className="items-center">
            <Text className="text-[13px] font-black uppercase tracking-[3px] text-brand-400">Work</Text>
            <Text className="mt-2 text-[64px] font-black leading-none tracking-tight text-white">{mmss(elapsed)}</Text>
            <Text className="mt-1 text-[13px] font-semibold text-white/40">Aim for {ex.targetReps} reps</Text>
          </View>
        </Animated.View>
      </View>

      {/* Quick rep logger — tap as you go so the set records what you actually did,
       *  not just the planned number. Writes straight to the set. */}
      <View className="items-center px-6 pb-1">
        <Text className="mb-2 text-[11px] font-bold uppercase tracking-[2px] text-white/35">Reps done</Text>
        <View className="flex-row items-center gap-5">
          <PressableScale onPress={() => onLogReps(Math.max(0, reps - 1))} scaleTo={0.9} className="h-12 w-12 items-center justify-center rounded-full bg-white/[0.08]">
            <Minus size={20} color="rgba(255,255,255,0.85)" />
          </PressableScale>
          <Text className="min-w-[52px] text-center text-[40px] font-black leading-none tracking-tight text-white">{reps}</Text>
          <PressableScale onPress={() => onLogReps(reps + 1)} scaleTo={0.9} className="h-12 w-12 items-center justify-center rounded-full bg-brand-400/20">
            <Plus size={20} color={brandColor} />
          </PressableScale>
        </View>
      </View>

      {/* Primary action — a single clean CTA, mirroring web. */}
      <View className="relative px-6 pb-12 pt-5">
        <PressableScale onPress={onStartRest} haptic={false} scaleTo={0.97} className="w-full flex-row items-center justify-center gap-2.5 rounded-2xl bg-brand-400 py-5">
          <Check size={20} strokeWidth={3} color="#000" />
          <Text className="text-[18px] font-black uppercase tracking-wide text-black">{lastSet ? 'Done, finish exercise' : 'Done, start rest'}</Text>
        </PressableScale>
      </View>

      {/* On-demand "how to do this" — keeps the main screen simple */}
      {showHow && (
        <View className="absolute inset-0 z-10 bg-ink-900" style={{ opacity: 0.98 }}>
          <View className="flex-1">
            <View className="flex-row items-center justify-between px-5 pb-3 pt-4">
              <Text className="text-[15px] font-bold text-white">How to: {ex.name}</Text>
              <Pressable onPress={() => setShowHow(false)} className="h-8 w-8 items-center justify-center rounded-full bg-white/10 active:opacity-80"><X size={18} color="rgba(255,255,255,0.7)" /></Pressable>
            </View>
            <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
              <TechniqueClip exerciseId={ex.defId} poster={ex.image} label="Form clip coming soon" />
              <Text className="mt-3 text-[14px] leading-snug text-white/75">{detail.desc}</Text>
              <Text className="mb-2 mt-5 text-[12px] font-bold uppercase tracking-wide text-white/40">Step by step</Text>
              <View className="gap-2.5">
                {detail.cues.map((c, i) => (
                  <View key={i} className="flex-row items-start gap-3">
                    <View className="h-6 w-6 items-center justify-center rounded-full bg-brand-400/15">
                      <Text className="text-[12px] font-bold text-brand-400">{i + 1}</Text>
                    </View>
                    <Text className="flex-1 text-[14px] text-white/80">{c}</Text>
                  </View>
                ))}
              </View>
              <View className="mt-4 flex-row gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
                <Info size={17} color={accentOrange} style={{ marginTop: 2 }} />
                <Text className="flex-1 text-[13px] leading-snug text-white/70"><Text className="font-semibold text-white/85">Avoid: </Text>{detail.commonMistake}</Text>
              </View>
              <Pressable onPress={() => setShowHow(false)} className="btn-primary mt-5 w-full active:opacity-90">
                <Text className="font-semibold text-black">Got it</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      )}
    </FullScreen>
  )
}

/* ============================ Finish screen ============================ */
function FinishScreen({ open, name, stats, units, onDone }: {
  open: boolean
  name: string
  stats: { time: number; volume: number; sets: number } | null
  units: Units
  onDone: () => void
}) {
  // The tick springs in; the copy and stats rise a beat behind it.
  const pop = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, useNativeDriver: USE_NATIVE, speed: 12, bounciness: 12 }).start()
  }, [pop])
  const popStyle = { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }
  const rise = useRise([])

  return (
    <FullScreen open={open} backgroundColor="#0a0a0b">
      <View className="flex-1 items-center justify-center px-8">
        {/* The satisfying green tick — springs in on complete */}
        <Animated.View style={[{ alignItems: 'center', justifyContent: 'center' }, popStyle]}>
          <View className="absolute h-44 w-44 rounded-full border-2 border-brand-400/50" />
          <View className="absolute h-44 w-44 rounded-full bg-brand-400/10" />
          <View className="h-36 w-36 items-center justify-center rounded-full bg-brand-400">
            <Check size={88} strokeWidth={4} color="#0a0a0b" />
          </View>
        </Animated.View>

        <Animated.View style={[{ alignItems: 'center' }, rise]}>
        <Text className="mt-9 text-center text-[28px] font-black tracking-tight text-white">Workout complete</Text>
        <Text className="mt-1 text-center text-[15px] text-white/55">{name} · that's another one in the bank</Text>

        {stats && (
          <View className="mt-8 flex-row items-center gap-7">
            <FinishStat label="Time" value={mmss(stats.time)} />
            <View className="h-8 w-px bg-white/10" />
            <FinishStat label="Volume" value={fmtVolume(stats.volume, units)} />
            <View className="h-8 w-px bg-white/10" />
            <FinishStat label="Sets" value={String(stats.sets)} />
          </View>
        )}
        </Animated.View>

        <Pressable onPress={onDone} className="btn-primary mt-10 w-full max-w-xs active:opacity-90">
          <Text className="font-semibold text-black">Done</Text>
        </Pressable>
      </View>
    </FullScreen>
  )
}

function FinishStat({ label, value }: { label: string; value: string }) {
  return (
    <View className="items-center">
      <Text className="text-[20px] font-black leading-none text-white">{value}</Text>
      <Text className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-white/40">{label}</Text>
    </View>
  )
}

/* ============================ Rest screen ============================ */
function fmtClock(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

function RestScreen({
  open, go, remaining, total, nextEx, nextCursor, nextSet, units, onSub, onAdd, onSkip, onGo, onBack,
}: {
  open: boolean
  go: boolean
  remaining: number
  total: number
  nextEx: WorkoutSession['exercises'][number]
  nextCursor: Cursor
  nextSet: { weightKg: number; reps: number }
  units: Units
  onSub: () => void
  onAdd: () => void
  onSkip: () => void
  onGo: () => void
  onBack: () => void
}) {
  // GO flash when rest hits zero.
  if (go) {
    return (
      <FullScreen open={open} backgroundColor={brandColor}>
        <Pressable onPress={() => { thud(); onGo() }} className="flex-1 items-center justify-center">
          <Text className="text-[96px] font-black leading-none tracking-tight text-black">GO</Text>
          <View className="mt-4 items-center">
            <Text className="text-2xl font-extrabold text-black">{fmtWeightNum(nextSet.weightKg, units, units === 'imperial' ? 0 : 1)} {weightUnit(units)} × {nextSet.reps}</Text>
            <Text className="mt-1 text-sm font-black uppercase tracking-[1.4px] text-black/60">{nextEx.name} · Set {nextCursor.setIdx + 1}</Text>
          </View>
          <Text className="absolute bottom-12 text-[13px] font-semibold text-black/50">Tap to begin</Text>
        </Pressable>
      </FullScreen>
    )
  }

  const frac = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0
  const color = restColor(frac)
  const endTime = fmtClock(new Date(Date.now() + remaining * 1000))
  const stroke = 3.4
  const radius = (100 - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - frac * circumference

  // Glide the ring toward each new second (<1s so it settles before the next
  // tick), which reads as a continuous sweep instead of a per-second jump.
  const animOffset = useRef(new Animated.Value(offset)).current
  useEffect(() => {
    Animated.timing(animOffset, { toValue: offset, duration: 950, easing: Easing.linear, useNativeDriver: false }).start()
  }, [offset, animOffset])

  // Final 3 seconds: give the ring a gentle heartbeat on each tick so the eye is
  // drawn back up right before GO (pairs with the countdown sound cue).
  const pulse = useRef(new Animated.Value(1)).current
  useEffect(() => {
    if (remaining > 3 || remaining <= 0) return
    pulse.setValue(1)
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1.06, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.spring(pulse, { toValue: 1, speed: 18, bounciness: 10, useNativeDriver: false }),
    ]).start()
  }, [remaining, pulse])
  const rise = useRise([])

  return (
    <FullScreen open={open} backgroundColor="#0a0a0b">
      <View>
        <View className="flex-row items-center justify-between px-5 pb-2 pt-4">
          <Pressable onPress={onBack} className="flex-row items-center gap-1 rounded-full bg-white/[0.06] py-2 pl-2 pr-3.5 active:opacity-80">
            <ChevronLeft size={16} color="rgba(255,255,255,0.8)" />
            <Text className="text-[13px] font-semibold text-white/80">List</Text>
          </Pressable>
          <Text className="text-[11px] font-black uppercase tracking-[2.8px]" style={{ color }}>Rest</Text>
          <Pressable onPress={onSkip} className="rounded-full bg-white/[0.06] px-3.5 py-2 active:opacity-80">
            <Text className="text-[13px] font-semibold text-white/80">Skip</Text>
          </Pressable>
        </View>
      </View>

      {/* Countdown ring, green → red */}
      <Animated.View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }, rise]}>
        <Animated.View className="relative items-center justify-center" style={{ width: 320, height: 320, transform: [{ scale: pulse }] }}>
          <Svg viewBox="0 0 100 100" width={320} height={320} style={[StyleSheet.absoluteFill, { transform: [{ rotate: '-90deg' }] }]}>
            <Circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
            <AnimatedCircle
              cx="50" cy="50" r={radius} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={animOffset}
            />
          </Svg>
          <View className="items-center justify-center">
            <View className="flex-row items-center gap-1.5">
              <Bell size={13} color="rgba(255,255,255,0.4)" />
              <Text className="text-[14px] font-medium text-white/40">{endTime}</Text>
            </View>
            <Text className="mt-3 text-[72px] font-black leading-none tracking-tight" style={{ color }}>{mmss(remaining)}</Text>
            <Text className="mt-2 text-[12px] font-bold uppercase tracking-[2px] text-white/35">until next set</Text>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Up next */}
      <View className="items-center px-7">
        <View className="flex-row items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <Image source={{ uri: nextEx.image }} resizeMode="cover" className="h-10 w-10 rounded-lg" />
          <View>
            <Text className="text-[11px] font-bold uppercase tracking-wide text-white/40">Up next · Set {nextCursor.setIdx + 1} of {nextEx.sets.length}</Text>
            <Text className="text-[15px] font-extrabold leading-tight text-white">{nextEx.name}</Text>
            <Text className="text-[12px] font-semibold text-brand-400">{fmtWeightNum(nextSet.weightKg, units, units === 'imperial' ? 0 : 1)} {weightUnit(units)} × {nextSet.reps}</Text>
          </View>
        </View>
      </View>

      {/* Controls */}
      <View className="px-7 pb-12 pt-7">
        <View className="flex-row items-center justify-center gap-5">
          <PressableScale onPress={onSub} className="h-16 w-16 items-center justify-center rounded-full bg-white/[0.08]">
            <Text className="text-sm font-bold text-white">−15s</Text>
          </PressableScale>
          <PressableScale onPress={() => { thud(); onSkip() }} haptic={false} className="h-20 w-20 items-center justify-center rounded-full bg-brand-400">
            <Play size={20} color="#000" fill="#000" />
          </PressableScale>
          <PressableScale onPress={onAdd} className="h-16 w-16 items-center justify-center rounded-full bg-white/[0.08]">
            <Text className="text-sm font-bold text-white">+15s</Text>
          </PressableScale>
        </View>
        <Text className="mt-3 text-center text-[12px] font-semibold text-white/35">Tap the centre to start now</Text>
      </View>
    </FullScreen>
  )
}

/* Small set-progress segments — the active one springs wider as you advance. */
function SetDots({ sets, current }: { sets: { done: boolean }[]; current: number }) {
  return (
    <View className="mt-3 flex-row items-center justify-center gap-1.5">
      {sets.map((s, i) => (
        <SetDot key={i} done={s.done} active={i === current} />
      ))}
    </View>
  )
}

function SetDot({ done, active }: { done: boolean; active: boolean }) {
  const w = useRef(new Animated.Value(active ? 26 : 14)).current
  useEffect(() => {
    Animated.spring(w, { toValue: active ? 26 : 14, useNativeDriver: false, speed: 20, bounciness: 10 }).start()
  }, [active, w])
  const backgroundColor = done ? '#7ED957' : active ? 'rgba(126,217,87,0.55)' : 'rgba(255,255,255,0.16)'
  return <Animated.View style={{ width: w, height: 6, borderRadius: 999, backgroundColor }} />
}

/* A full-screen overlay container replacing the web `fixed inset-0` panels. */
function FullScreen({ open, backgroundColor, children }: { open: boolean; backgroundColor: string; children: React.ReactNode }) {
  return (
    <AppModal visible={open} transparent={false} animationType="fade">
      <SafeAreaView style={{ flex: 1, backgroundColor }}>
        <View className="flex-1">{children}</View>
      </SafeAreaView>
    </AppModal>
  )
}
