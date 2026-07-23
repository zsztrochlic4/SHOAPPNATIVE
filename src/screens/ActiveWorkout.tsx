import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, ScrollView, Image, Animated, Easing, Platform, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle, Path } from 'react-native-svg'
import {
  Check, Plus, Minus, Flag, Info, ChevronDown, Bell, BookOpen, Play, Target,
  ChevronLeft, Timer, ListChecks, HelpCircle, X, Dumbbell, Star,
} from 'lucide-react-native'
import { AppModal } from '../components/WebFrame'
import { PressableScale } from '../components/PressableScale'
import { tick, thud } from '../lib/haptics'
import { beep, restTick, successChime } from '../lib/sound'
import { TechniqueClip } from '../components/TechniqueClip'
import { useStore } from '../store/store'
import { todaySession, sessionProgress, streakStats } from '../store/selectors'
import { examState, examTrim, nextSetRecommendation } from '../store/training'
import { prForSession, type PR } from '../store/coach'
import { exerciseDetail, workoutGoalLine } from '../data/catalog'
import { exerciseView } from '../store/programSession'
import { logCompletedProgramSession } from '../backend/repo/setLogRepo'
import type { LoggedSetInput } from '../backend/runtime/logging'
import { fmtWeightNum, weightUnit, fmtVolume, fmtWeight, toKg } from '../lib/format'
import { palette } from '../theme'
import type { Units, WorkoutSession } from '../store/types'

/* This follow-along flow is a dark, full-immersion surface (like the design's
 * dark default and the previous implementation), so it pins the dark palette
 * regardless of the app-wide light/dark setting. */
const C = palette.dark

/* ============================================================================
 *  Active Workout — 1:1 port of the "Active Workout Flow Redesign" design
 *  (Active Workout.dc.html). Five screens share one full-screen surface:
 *  list / work / rest / go, plus a finish bottom-sheet that overlays the list.
 *  All the store, logging, progression, PR and haptic/sound wiring is kept.
 * ==========================================================================*/

const USE_NATIVE = Platform.OS !== 'web'
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && (window as any).matchMedia?.('(prefers-reduced-motion: reduce)').matches

/* Compound lifts rest longer than isolation work. No rest field exists in the
 * data model, so derive a sensible default from the exercise id. */
const COMPOUND_LIFTS = ['bench', 'squat', 'deadlift', 'ohp', 'row', 'pulldown', 'legpress', 'rdl', 'incline', 'shoulder']
const ISOLATION_LIFTS = ['cablefly', 'tricep', 'curl', 'lateral']
function restSecondsFor(defId: string): number {
  if (COMPOUND_LIFTS.includes(defId)) return 120
  if (ISOLATION_LIFTS.includes(defId)) return 60
  return 90
}

/** Technique copy for a set — resolves demo ids and generated-program backend
 *  ids (via the Exercise Database), falling back to the catalogue cue card. */
function detailFor(defId: string) {
  return exerciseView(defId)?.detail ?? exerciseDetail(defId)
}
function muscleFor(defId: string, fallback: string): string {
  return exerciseView(defId)?.muscle ?? fallback
}

type Mode = 'list' | 'work' | 'rest' | 'go' | 'finish'
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
  const m = Math.floor(Math.max(0, total) / 60)
  const s = String(Math.max(0, total) % 60).padStart(2, '0')
  return `${m}:${s}`
}

/** Rest ring colour: brand green at full → amber → soft red near zero,
 *  matching the design's `hsl(96*frac, 62%, 55%)`. */
function restColor(frac: number): string {
  const f = Math.max(0, Math.min(1, frac))
  return `hsl(${Math.round(96 * f)}, 62%, 55%)`
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedPath = Animated.createAnimatedComponent(Path)

/** Live session totals recomputed from the set log (mirrors the design VM). */
function stats(session: WorkoutSession) {
  let total = 0, done = 0, vol = 0
  for (const e of session.exercises) {
    for (const s of e.sets) {
      total++
      if (s.done) { done++; vol += s.weightKg * s.reps }
    }
  }
  return { total, done, vol, pct: total ? Math.round((done / total) * 100) : 0, remaining: total - done }
}

/** Gentle screen entrance (design `.screen-in`): fade + rise + subtle scale. */
function ScreenIn({ children, style }: { children: React.ReactNode; style?: any }) {
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: USE_NATIVE }).start()
  }, [v])
  return (
    <Animated.View
      style={[
        { flex: 1, opacity: v, transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
          { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) },
        ] },
        style,
      ]}
    >
      {children}
    </Animated.View>
  )
}

export default function ActiveWorkout({ open, onClose, params }: { open: boolean; onClose: () => void; params?: Record<string, unknown> }) {
  const { state, dispatch } = useStore()
  const c = C
  const units = state.settings.units

  // A custom / template-launched session is opened by explicit id; everything
  // else falls back to today's prescribed session.
  const sessionId = params?.sessionId as string | undefined
  const session = (sessionId ? state.sessions.find((s) => s.id === sessionId) : undefined) ?? todaySession(state)

  const [mode, setMode] = useState<Mode>('list')
  const [cursor, setCursor] = useState<Cursor>({ exIdx: 0, setIdx: 0 })
  const [started, setStarted] = useState(false)
  const [totalElapsed, setTotalElapsed] = useState(0)
  const [workElapsed, setWorkElapsed] = useState(0)
  const [restRemaining, setRestRemaining] = useState(0)
  const [restTotal, setRestTotal] = useState(120)
  const [goalOpen, setGoalOpen] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [showHow, setShowHow] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)

  const finishStatsRef = useRef<{ time: number; volume: number; sets: number } | null>(null)
  const finishPRRef = useRef<PR | null>(null)
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const listScrollRef = useRef<ScrollView>(null)

  // Fresh guided state every time the surface opens.
  useEffect(() => {
    if (!open) return
    setMode('list'); setCursor({ exIdx: 0, setIdx: 0 }); setStarted(false)
    setTotalElapsed(0); setWorkElapsed(0); setRestRemaining(0)
    setGoalOpen(false); setExpanded(null); setShowHow(false); setConfirmEnd(false)
    finishPRRef.current = null; finishStatsRef.current = null
    // Opening the workout counts as starting it for today's dashboard tick.
    if (session) dispatch({ type: 'MARK_WORKOUT_STARTED' })
    return () => { if (finishTimer.current) clearTimeout(finishTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Session clock — runs once the workout has actually started.
  useEffect(() => {
    if (!open || !started) return
    const t = setInterval(() => setTotalElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [open, started])

  // Work clock — counts up while performing a set.
  useEffect(() => {
    if (!open || mode !== 'work') return
    const t = setInterval(() => setWorkElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [open, mode, cursor])

  // Rest clock — counts down; a rising tick in the final 3s, a beep + GO at zero.
  useEffect(() => {
    if (mode !== 'rest') return
    if (restRemaining <= 0) {
      thud()
      if (!prefersReducedMotion()) (typeof navigator !== 'undefined' ? (navigator as any) : undefined)?.vibrate?.([200, 100, 200])
      beep()
      setMode('go')
      return
    }
    if (restRemaining <= 3) restTick()
    const t = setTimeout(() => setRestRemaining((r) => r - 1), 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, restRemaining])

  const exam = examState(state)
  const trim = useMemo(() => (session ? examTrim(session, state) : null), [session, state])

  // Cursor-derived values + the progression-aware recommended weight. Computed
  // before the early return so the hook order never changes with `session`.
  const cursorEx = session?.exercises[cursor.exIdx]
  const cursorSet = cursorEx?.sets[cursor.setIdx]
  const recWeightKg = useMemo(
    () => (cursorEx && cursorSet ? nextSetRecommendation(state, cursorEx.defId, cursorEx.targetReps, cursorSet.weightKg).suggestedWeightKg : 0),
    [cursorEx, cursorSet, state],
  )

  if (!session) return null

  /* ---------------------------------------------------------------- store */
  function patch(next: WorkoutSession) { dispatch({ type: 'SAVE_SESSION', session: next }) }

  function setField(exIdx: number, setIdx: number, field: 'weightKg' | 'reps', value: number) {
    const exercises = session!.exercises.map((ex, i) =>
      i !== exIdx ? ex : { ...ex, sets: ex.sets.map((s, j) => (j === setIdx ? { ...s, [field]: Math.max(0, value) } : s)) },
    )
    patch({ ...session!, exercises })
  }
  function adjWeight(exIdx: number, setIdx: number, dir: 1 | -1) {
    const step = units === 'imperial' ? 5 : 2.5
    const cur = parseFloat(fmtWeightNum(session!.exercises[exIdx].sets[setIdx].weightKg, units, units === 'imperial' ? 0 : 1)) || 0
    setField(exIdx, setIdx, 'weightKg', toKg(Math.max(0, cur + dir * step), units))
  }
  function adjReps(exIdx: number, setIdx: number, dir: 1 | -1) {
    setField(exIdx, setIdx, 'reps', Math.max(0, session!.exercises[exIdx].sets[setIdx].reps + dir))
  }
  function toggleSet(exIdx: number, setIdx: number) {
    const nowDone = !session!.exercises[exIdx].sets[setIdx].done
    if (nowDone) thud(); else tick()
    const exercises = session!.exercises.map((ex, i) =>
      i !== exIdx ? ex : { ...ex, sets: ex.sets.map((s, j) => (j === setIdx ? { ...s, done: !s.done } : s)) },
    )
    patch({ ...session!, exercises })
  }

  /* ------------------------------------------------------------- flow ctl */
  function start() {
    const cur = nextUndoneCursor(session!, 0)
    if (!cur) { finish(); return }
    setStarted(true); setCursor(cur); setWorkElapsed(0); setMode('work')
  }
  function startAt(exIdx: number) {
    const found = session!.exercises[exIdx].sets.findIndex((s) => !s.done)
    setStarted(true); setExpanded(null)
    setCursor({ exIdx, setIdx: found >= 0 ? found : 0 }); setWorkElapsed(0); setMode('work')
  }
  // Finish the current set → log it, then rest before the next (or back to list).
  function logSet() {
    thud()
    const { exIdx } = cursor
    const exercises = session!.exercises.map((ex, i) =>
      i !== exIdx ? ex : { ...ex, sets: ex.sets.map((s, j) => (j === cursor.setIdx ? { ...s, done: true } : s)) },
    )
    const next = { ...session!, exercises }
    patch(next)
    const upcoming = nextUndoneCursor(next, exIdx)
    if (!upcoming) { setMode('list'); return }
    const secs = restSecondsFor(session!.exercises[exIdx].defId)
    setCursor(upcoming); setRestTotal(secs); setRestRemaining(secs); setWorkElapsed(0); setMode('rest')
  }
  function skipRest() { setWorkElapsed(0); setMode('work') }
  function addRest() { setRestTotal((t) => t + 15); setRestRemaining((r) => r + 15) }
  function subRest() { setRestRemaining((r) => Math.max(0, r - 15)) }

  function finish() {
    if (mode === 'finish') return
    const s = stats(session!)
    finishStatsRef.current = { time: totalElapsed, volume: s.vol || session!.volumeKg, sets: s.done }
    finishPRRef.current = prForSession(state, session!)
    dispatch({ type: 'COMPLETE_WORKOUT', id: session!.id })
    // Materialised from a generated program day? Persist the completed set logs
    // (keyed by backend exercise_id) and feed the Progression Engine, which
    // re-clamps the next prescription through the Safety Rules. No-op in demo /
    // without Firebase — the pure logging maths is covered by the profile sweep.
    if (session!.instanceId && state.backendUser) {
      const instance = (state.workoutInstances ?? []).find((i) => i.instance_id === session!.instanceId)
      if (instance) {
        const logged: Record<string, LoggedSetInput[]> = {}
        for (const ex of session!.exercises) logged[ex.defId] = ex.sets.map((st) => ({ weightKg: st.weightKg, reps: st.reps, done: st.done }))
        void logCompletedProgramSession(state.backendUser.uid, state.backendUser, instance, logged).catch(() => { /* retried opportunistically */ })
      }
    }
    thud()
    if (!prefersReducedMotion()) (typeof navigator !== 'undefined' ? (navigator as any) : undefined)?.vibrate?.([0, 55, 45, 120])
    successChime()
    setShowHow(false); setStarted(false); setMode('finish')
    if (finishTimer.current) clearTimeout(finishTimer.current)
    finishTimer.current = setTimeout(() => onClose(), 3600)
  }
  function onFinishTap() {
    if (allDone) { finish(); return }
    if (!confirmEnd) { tick(); setConfirmEnd(true); return }
    finish()
  }
  function toggleExpand(i: number) {
    setExpanded((cur) => (cur === i ? null : i))
  }

  /* ------------------------------------------------------------- derived */
  const s = stats(session)
  const allDone = s.total > 0 && s.remaining === 0
  const activeIdx = session.exercises.findIndex((ex) => !(ex.sets.length > 0 && ex.sets.every((x) => x.done)))
  const prog = sessionProgress(session)

  // Global rail — one segment per set across the whole session.
  let curGlobal = 0
  for (let i = 0; i < cursor.exIdx; i++) curGlobal += session.exercises[i].sets.length
  curGlobal += cursor.setIdx
  const rail: string[] = []
  {
    let g = 0
    for (const e of session.exercises) for (const st of e.sets) {
      rail.push(st.done ? c.brand400 : g === curGlobal ? 'rgba(126,217,87,0.55)' : 'rgba(255,255,255,0.12)')
      g++
    }
  }

  const streak = streakStats(state)
  const streakStr = streak.current > 0 ? `Day ${streak.current} streak` : "another one in the bank"

  return (
    <AppModal visible={open} transparent={false} animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: mode === 'go' ? c.brand400 : c.ink900 }} edges={['top', 'bottom']}>
        {(mode === 'list' || mode === 'finish') && (
          <ListScreen
            key="list"
            session={session}
            units={units}
            colors={c}
            exam={exam}
            trim={trim}
            statsV={s}
            allDone={allDone}
            activeIdx={activeIdx}
            resumed={prog.done > 0}
            goalText={workoutGoalLine(session.name, session.focus, state.profile.goal)}
            goalOpen={goalOpen}
            onToggleGoal={() => setGoalOpen((o) => !o)}
            timeStr={mmss(totalElapsed)}
            expanded={expanded}
            onToggleExpand={toggleExpand}
            scrollRef={listScrollRef}
            confirmEnd={confirmEnd}
            onCta={allDone ? finish : start}
            onStartAt={startAt}
            onAdjWeight={adjWeight}
            onAdjReps={adjReps}
            onToggleSet={toggleSet}
            onFinishTap={onFinishTap}
            onCancelEnd={() => setConfirmEnd(false)}
            onClose={onClose}
          />
        )}

        {mode === 'work' && cursorEx && cursorSet && (
          <WorkScreen
            key="work"
            colors={c}
            ex={cursorEx}
            cursor={cursor}
            exTotal={session.exercises.length}
            rail={rail}
            elapsedStr={mmss(workElapsed)}
            sessionStr={mmss(totalElapsed)}
            recWeight={fmtWeight(recWeightKg, units, units === 'imperial' ? 0 : 1)}
            reps={cursorSet.reps}
            remaining={s.remaining}
            detail={detailFor(cursorEx.defId)}
            showHow={showHow}
            onOpenHow={() => setShowHow(true)}
            onCloseHow={() => setShowHow(false)}
            onDecReps={() => setField(cursor.exIdx, cursor.setIdx, 'reps', Math.max(0, cursorSet.reps - 1))}
            onIncReps={() => setField(cursor.exIdx, cursor.setIdx, 'reps', cursorSet.reps + 1)}
            onBack={() => setMode('list')}
            onLogSet={logSet}
          />
        )}

        {mode === 'rest' && cursorEx && cursorSet && (
          <RestScreen
            key="rest"
            colors={c}
            units={units}
            remaining={restRemaining}
            total={restTotal}
            rail={rail}
            nextEx={cursorEx}
            nextCursor={cursor}
            nextSet={cursorSet}
            onBack={() => setMode('list')}
            onSkip={skipRest}
            onAdd={addRest}
            onSub={subRest}
          />
        )}

        {mode === 'go' && cursorEx && cursorSet && (
          <GoScreen
            key="go"
            colors={c}
            units={units}
            nextEx={cursorEx}
            nextCursor={cursor}
            nextSet={cursorSet}
            onStart={skipRest}
          />
        )}

        {mode === 'finish' && (
          <FinishSheet
            colors={c}
            units={units}
            name={session.name}
            streakStr={streakStr}
            stats={finishStatsRef.current}
            pr={finishPRRef.current}
            onDone={onClose}
          />
        )}
      </SafeAreaView>
    </AppModal>
  )
}

/* ============================ small pieces ============================ */

/** Top-of-screen rail: one dash per set, filled as you advance. */
function Rail({ rail }: { rail: string[] }) {
  return (
    <View style={{ flexDirection: 'row', gap: 3, paddingHorizontal: 18, paddingTop: 8 }}>
      {(rail.length ? rail : ['rgba(255,255,255,0.12)']).map((bg, i) => (
        <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: bg }} />
      ))}
    </View>
  )
}

type Dot = { bg: string; border: string }
function Dots({ dots, size = 13 }: { dots: Dot[]; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size >= 13 ? 6 : 7 }}>
      {dots.map((d, i) => (
        <View key={i} style={{ width: size, height: size, borderRadius: size, backgroundColor: d.bg, borderWidth: 2, borderColor: d.border }} />
      ))}
    </View>
  )
}

/* ============================ List / overview ============================ */
function ListScreen(props: any) {
  const {
    session, units, colors: c, exam, trim, statsV, allDone, activeIdx, resumed, goalText, goalOpen, onToggleGoal,
    timeStr, expanded, onToggleExpand, scrollRef, confirmEnd, onCta, onStartAt, onAdjWeight, onAdjReps, onToggleSet,
    onFinishTap, onCancelEnd, onClose,
  } = props
  const dim = (o: number) => `rgba(255,255,255,${o})`

  return (
    <ScreenIn>
      {/* Persistent progress header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: dim(0.06) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <PressableScale onPress={onClose} scaleTo={0.9} className="items-center justify-center rounded-full" style={{ width: 34, height: 34, backgroundColor: dim(0.08) }}>
            <X size={17} strokeWidth={2.4} color={dim(0.8)} />
          </PressableScale>
          <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', color: dim(0.4) }}>Active Workout</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 23, fontWeight: '700', letterSpacing: -0.4, color: c.fg }}>{session.name}</Text>
            <Text style={{ marginTop: 3, fontSize: 12.5, fontWeight: '600', color: dim(0.45) }}>{session.focus}</Text>
          </View>
          <View style={{ borderRadius: 999, backgroundColor: 'rgba(126,217,87,0.15)', paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: c.brand300 }}>{session.exercises.length} ex</Text>
          </View>
        </View>
        <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1, height: 9, borderRadius: 999, backgroundColor: dim(0.1), overflow: 'hidden' }}>
            <View style={{ height: '100%', borderRadius: 999, width: `${statsV.pct}%`, backgroundColor: c.brand400 }} />
          </View>
          <Text style={{ fontSize: 12.5, fontWeight: '700', color: c.brand400, minWidth: 44, textAlign: 'right' }}>{statsV.pct}%</Text>
        </View>
        <View style={{ marginTop: 10, flexDirection: 'row', gap: 16 }}>
          <HeaderStat value={`${statsV.done} / ${statsV.total}`} label="sets" c={c} />
          <HeaderStat value={timeStr} label="elapsed" c={c} />
          <HeaderStat value={fmtVolume(statsV.vol, units)} label="volume" c={c} />
        </View>
      </View>

      {/* Scrollable body */}
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingTop: 16, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        {/* Primary CTA */}
        <PressableScale onPress={onCta} scaleTo={0.97} className="w-full flex-row items-center justify-center rounded-2xl" style={{ gap: 9, padding: 16, backgroundColor: c.brand400 }}>
          {allDone ? <Flag size={17} color="#0a0a0b" /> : <Play size={17} color="#0a0a0b" fill="#0a0a0b" />}
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#0a0a0b' }}>{allDone ? 'Finish & log workout' : resumed ? 'Resume workout' : 'Start workout'}</Text>
        </PressableScale>

        {/* Exam-mode retention (safety feature, styled to the design language) */}
        {exam?.active && (
          <View style={{ marginTop: 14, flexDirection: 'row', gap: 10, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(139,92,246,0.25)', backgroundColor: 'rgba(139,92,246,0.1)', padding: 13 }}>
            <Info size={17} color={c.accentPurple} style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, fontSize: 12.5, lineHeight: 18, color: dim(0.72) }}>
              Exam mode is on. Your {trim?.keptCount} key lifts are all you need today — the rest are optional.
            </Text>
          </View>
        )}

        {/* Goal collapsible */}
        <View style={{ marginTop: 14, borderWidth: 1, borderColor: dim(0.07), backgroundColor: dim(0.03), borderRadius: 16, overflow: 'hidden' }}>
          <Pressable onPress={onToggleGoal} className="active:opacity-80" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, paddingHorizontal: 14 }}>
            <Target size={14} color={c.brand400} />
            <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.6, textTransform: 'uppercase', color: c.brand400 }}>Today's goal</Text>
            <View style={{ marginLeft: 'auto', transform: [{ rotate: goalOpen ? '180deg' : '0deg' }] }}>
              <ChevronDown size={16} color={dim(0.4)} />
            </View>
          </Pressable>
          {goalOpen && <Text style={{ paddingHorizontal: 14, paddingBottom: 13, fontSize: 13, lineHeight: 19.5, color: dim(0.7) }}>{goalText}</Text>}
        </View>

        <Text style={{ marginTop: 18, marginBottom: 11, marginHorizontal: 2, fontSize: 11.5, fontWeight: '700', letterSpacing: 1.8, textTransform: 'uppercase', color: dim(0.35) }}>{session.exercises.length} exercises</Text>

        {/* Exercise cards */}
        <View style={{ gap: 12 }}>
          {session.exercises.map((ex: WorkoutSession['exercises'][number], i: number) => (
            <ExerciseCard
              key={ex.defId + i}
              ex={ex}
              idx={i}
              c={c}
              units={units}
              isActive={i === activeIdx}
              isOptional={!!trim?.optionalIds?.has(ex.defId)}
              expanded={expanded === i}
              onToggleExpand={() => onToggleExpand(i)}
              onStart={() => onStartAt(i)}
              onAdjWeight={onAdjWeight}
              onAdjReps={onAdjReps}
              onToggleSet={onToggleSet}
            />
          ))}
        </View>

        {/* Finish workout secondary */}
        <FinishButton c={c} pct={statsV.pct} remaining={statsV.remaining} allDone={allDone} confirmEnd={confirmEnd} onPress={onFinishTap} />
        {confirmEnd && (
          <Text style={{ marginTop: 9, textAlign: 'center', fontSize: 12.5, color: dim(0.5) }}>
            {statsV.remaining} {statsV.remaining === 1 ? 'set still to go' : 'sets still to go'} · <Text onPress={onCancelEnd} style={{ color: c.brand400, fontWeight: '700' }}>Keep going</Text>
          </Text>
        )}
      </ScrollView>
    </ScreenIn>
  )
}

function HeaderStat({ value, label, c }: { value: string; label: string; c: any }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: c.fg }}>{value}</Text>
      <Text style={{ fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.4)' }}>{label}</Text>
    </View>
  )
}

function FinishButton({ c, pct, remaining, allDone, confirmEnd, onPress }: { c: any; pct: number; remaining: number; allDone: boolean; confirmEnd: boolean; onPress: () => void }) {
  const bg = confirmEnd ? 'rgba(245,165,36,0.15)' : 'rgba(126,217,87,0.14)'
  const border = confirmEnd ? 'rgba(245,165,36,0.5)' : 'rgba(126,217,87,0.3)'
  const fg = confirmEnd ? c.accentOrange : c.brand400
  const hint = confirmEnd ? '' : allDone ? '· all done' : `· ${remaining} ${remaining === 1 ? 'set left' : 'sets left'}`
  return (
    <PressableScale onPress={onPress} haptic={false} scaleTo={0.98} className="w-full flex-row items-center justify-center overflow-hidden rounded-2xl" style={{ position: 'relative', marginTop: 20, padding: 14, backgroundColor: bg, borderWidth: 1, borderColor: border }}>
      {!confirmEnd && <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, backgroundColor: 'rgba(126,217,87,0.1)' }} />}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
        <Flag size={16} color={fg} />
        <Text style={{ fontSize: 14.5, fontWeight: '700', color: fg }}>{confirmEnd ? 'End workout early' : 'Finish workout'}</Text>
        {!!hint && <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(126,217,87,0.6)' }}>{hint}</Text>}
      </View>
    </PressableScale>
  )
}

function ExerciseCard({ ex, idx, c, units, isActive, isOptional, expanded, onToggleExpand, onStart, onAdjWeight, onAdjReps, onToggleSet }: any) {
  const dim = (o: number) => `rgba(255,255,255,${o})`
  const doneCount = ex.sets.filter((x: any) => x.done).length
  const isDone = ex.sets.length > 0 && doneCount === ex.sets.length
  const firstUndone = ex.sets.findIndex((x: any) => !x.done)
  const muscle = muscleFor(ex.defId, ex.name)
  const detail = detailFor(ex.defId)
  const weights = ex.sets.map((x: any) => x.weightKg)
  const same = weights.length > 0 && weights.every((w: number) => w === weights[0])
  const u = weightUnit(units)
  const lastLine = ex.sets.length === 0 ? '—' : same
    ? `${fmtWeightNum(weights[0], units, units === 'imperial' ? 0 : 1)} ${u} × ${ex.sets.map((x: any) => x.reps).join(', ')}`
    : ex.sets.map((x: any) => `${fmtWeightNum(x.weightKg, units, units === 'imperial' ? 0 : 1)}${u}×${x.reps}`).join(', ')

  const cardBorder = isActive ? 'rgba(126,217,87,0.5)' : dim(0.05)
  const cardBg = isActive ? 'rgba(126,217,87,0.05)' : c.ink800
  const dots: Dot[] = ex.sets.map((st: any, j: number) => ({
    bg: st.done ? c.brand400 : 'transparent',
    border: st.done ? 'transparent' : isActive && j === firstUndone ? c.brand400 : dim(0.25),
  }))

  return (
    <View style={[{ borderWidth: 1, borderColor: cardBorder, backgroundColor: cardBg, borderRadius: 20, overflow: 'hidden', opacity: isOptional ? 0.7 : 1 }, isActive ? { boxShadow: '0 0 24px -8px rgba(126,217,87,0.55)' } : { boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }]}>
      <View style={{ flexDirection: 'row', gap: 13, padding: 13 }}>
        <View style={{ position: 'relative' }}>
          <View style={{ width: 82, height: 82, borderRadius: 15, overflow: 'hidden', backgroundColor: c.ink700, borderWidth: 1, borderColor: dim(0.08), alignItems: 'center', justifyContent: 'center' }}>
            {ex.image ? <Image source={{ uri: ex.image }} resizeMode="cover" style={{ width: '100%', height: '100%' }} /> : <Dumbbell size={34} color="rgba(255,255,255,0.32)" />}
          </View>
          {isDone && (
            <>
              <View style={{ position: 'absolute', inset: 0, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.35)' }} />
              <View style={{ position: 'absolute', top: -6, right: -6, width: 23, height: 23, borderRadius: 999, backgroundColor: c.brand400, borderWidth: 2.5, borderColor: c.ink800, alignItems: 'center', justifyContent: 'center' }}>
                <Check size={12} strokeWidth={3.6} color="#0a0a0b" />
              </View>
            </>
          )}
        </View>

        <View style={{ minWidth: 0, flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 16.5, fontWeight: '700', lineHeight: 19, color: c.fg }}>{ex.name}</Text>
            {isActive && (
              <View style={{ backgroundColor: 'rgba(126,217,87,0.16)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: c.brand300 }}>Now</Text>
              </View>
            )}
            {!isActive && isOptional && (
              <View style={{ backgroundColor: dim(0.1), paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                <Text style={{ fontSize: 10, fontWeight: '600', color: dim(0.55) }}>Optional</Text>
              </View>
            )}
          </View>
          <Text style={{ marginTop: 3, fontSize: 12, fontWeight: '500', color: dim(0.45) }}>{muscle} · {ex.targetSets} sets · {ex.targetReps} reps</Text>
          <Text style={{ marginTop: 5, fontSize: 12, lineHeight: 16.8 }}>
            <Text style={{ color: dim(0.35) }}>Last: </Text>
            <Text style={{ color: dim(0.7), fontWeight: '500' }}>{lastLine}</Text>
          </Text>
          <View style={{ marginTop: 9, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Dots dots={dots} />
            <Text style={{ marginLeft: 4, fontSize: 11.5, fontWeight: '700', color: dim(0.4) }}>{doneCount}/{ex.sets.length} sets</Text>
          </View>

          <View style={{ marginTop: 11, flexDirection: 'row', gap: 8 }}>
            <PressableScale haptic={false} scaleTo={0.97} containerStyle={{ flex: 1 }} onPress={onToggleExpand} className="flex-row items-center justify-center rounded-xl" style={{ gap: 6, paddingVertical: 9, backgroundColor: dim(0.09) }}>
              <BookOpen size={14} color={dim(0.85)} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: dim(0.85) }}>Form</Text>
            </PressableScale>
            <PressableScale scaleTo={0.97} containerStyle={{ flex: 1 }} onPress={onStart} className="flex-row items-center justify-center rounded-xl" style={{ gap: 6, paddingVertical: 9, backgroundColor: isActive ? c.brand400 : dim(0.09) }}>
              <Play size={12} color={isActive ? '#000' : dim(0.85)} fill={isActive ? '#000' : dim(0.85)} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: isActive ? '#000' : dim(0.85) }}>{isDone ? 'Redo' : 'Start'}</Text>
            </PressableScale>
          </View>
        </View>
      </View>

      {expanded && (
        <ExpandedForm ex={ex} idx={idx} c={c} units={units} detail={detail} onAdjWeight={onAdjWeight} onAdjReps={onAdjReps} onToggleSet={onToggleSet} />
      )}
    </View>
  )
}

/** Design `.form-reveal` — the expanded form + manual log, revealed with a
 *  fade + slide instead of the web clip-path (not expressible in RN). */
function ExpandedForm({ ex, idx, c, units, detail, onAdjWeight, onAdjReps, onToggleSet }: any) {
  const dim = (o: number) => `rgba(255,255,255,${o})`
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: USE_NATIVE }).start()
  }, [v])
  const u = weightUnit(units)
  return (
    <Animated.View style={{ borderTopWidth: 1, borderTopColor: dim(0.06), padding: 14, opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }}>
      <TechniqueClip exerciseId={ex.defId} poster={ex.image} label="Form clip · coming soon" />
      <Text style={{ marginTop: 12, fontSize: 13, lineHeight: 19.5, color: dim(0.72) }}>{detail.desc}</Text>
      <View style={{ marginTop: 12, gap: 9 }}>
        {detail.cues.map((cue: string, k: number) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <View style={{ width: 20, height: 20, borderRadius: 999, backgroundColor: 'rgba(126,217,87,0.16)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: c.brand400 }}>{k + 1}</Text>
            </View>
            <Text style={{ flex: 1, fontSize: 13, lineHeight: 18.2, color: dim(0.78) }}>{cue}</Text>
          </View>
        ))}
      </View>
      <View style={{ marginTop: 12, borderWidth: 1, borderColor: 'rgba(245,165,36,0.25)', backgroundColor: 'rgba(245,165,36,0.09)', borderRadius: 12, padding: 11 }}>
        <Text style={{ fontSize: 12, lineHeight: 17.4, color: dim(0.7) }}><Text style={{ color: c.accentOrange, fontWeight: '700' }}>Avoid · </Text>{detail.commonMistake}</Text>
      </View>

      <Text style={{ marginTop: 15, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: dim(0.35) }}>Log manually</Text>
      <View style={{ marginTop: 9, gap: 8 }}>
        {ex.sets.map((st: any, j: number) => (
          <View key={j} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
            <Text style={{ width: 16, fontSize: 12, fontWeight: '700', color: dim(0.4) }}>{j + 1}</Text>
            <Stepper c={c} value={`${fmtWeightNum(st.weightKg, units, units === 'imperial' ? 0 : 1)}`} unit={u} onDown={() => onAdjWeight(idx, j, -1)} onUp={() => onAdjWeight(idx, j, 1)} />
            <Stepper c={c} value={`${st.reps}`} unit="reps" onDown={() => onAdjReps(idx, j, -1)} onUp={() => onAdjReps(idx, j, 1)} />
            <PressableScale haptic={false} scaleTo={0.9} onPress={() => onToggleSet(idx, j)} className="items-center justify-center" style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: st.done ? c.brand400 : 'transparent', borderWidth: 2, borderColor: st.done ? c.brand400 : dim(0.2) }}>
              {st.done && <Check size={15} strokeWidth={3.4} color="#0a0a0b" />}
            </PressableScale>
          </View>
        ))}
      </View>
    </Animated.View>
  )
}

function Stepper({ c, value, unit, onDown, onUp }: { c: any; value: string; unit: string; onDown: () => void; onUp: () => void }) {
  const dim = (o: number) => `rgba(255,255,255,${o})`
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, backgroundColor: c.ink700, borderWidth: 1, borderColor: dim(0.08), borderRadius: 11, paddingHorizontal: 8, paddingVertical: 5 }}>
      <PressableScale haptic={false} scaleTo={0.85} onPress={onDown} className="items-center justify-center rounded-lg" style={{ width: 26, height: 26, backgroundColor: dim(0.08) }}>
        <Minus size={14} color={c.fg} />
      </PressableScale>
      <Text style={{ fontSize: 13, fontWeight: '700', color: c.fg }}>{value}<Text style={{ fontSize: 10, fontWeight: '600', color: dim(0.4) }}> {unit}</Text></Text>
      <PressableScale haptic={false} scaleTo={0.85} onPress={onUp} className="items-center justify-center rounded-lg" style={{ width: 26, height: 26, backgroundColor: dim(0.08) }}>
        <Plus size={14} color={c.fg} />
      </PressableScale>
    </View>
  )
}

/* ============================ Work ============================ */
function WorkScreen({ colors: c, ex, cursor, exTotal, rail, elapsedStr, sessionStr, recWeight, reps, remaining, detail, showHow, onOpenHow, onCloseHow, onDecReps, onIncReps, onBack, onLogSet }: any) {
  const dim = (o: number) => `rgba(255,255,255,${o})`
  const dots: Dot[] = ex.sets.map((st: any, j: number) => ({
    bg: st.done ? c.brand400 : j === cursor.setIdx ? 'transparent' : dim(0.12),
    border: st.done ? 'transparent' : j === cursor.setIdx ? c.brand400 : 'transparent',
  }))
  const doneLabel = remaining <= 1 ? 'Done, finish set' : 'Done, start rest'

  return (
    <ScreenIn>
      {/* top bar */}
      <View style={{ paddingHorizontal: 18, paddingTop: 6, paddingBottom: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <PressableScale onPress={onBack} haptic={false} className="flex-row items-center rounded-full" style={{ gap: 7, paddingVertical: 8, paddingLeft: 11, paddingRight: 14, backgroundColor: dim(0.07) }}>
          <ListChecks size={15} color={dim(0.85)} />
          <Text style={{ fontSize: 12.5, fontWeight: '700', color: dim(0.85) }}>All exercises</Text>
        </PressableScale>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Timer size={14} color={dim(0.45)} />
          <Text style={{ fontSize: 12.5, fontWeight: '700', color: dim(0.45) }}>{sessionStr}</Text>
        </View>
      </View>

      <Rail rail={rail} />

      {/* context */}
      <View style={{ paddingHorizontal: 24, paddingTop: 16, alignItems: 'center' }}>
        <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase', color: c.brand400, textAlign: 'center' }}>
          Exercise {cursor.exIdx + 1} of {exTotal} · Set {cursor.setIdx + 1} of {ex.sets.length}
        </Text>
        <Text style={{ marginTop: 5, fontSize: 25, fontWeight: '800', letterSpacing: -0.5, lineHeight: 27.5, color: c.fg, textAlign: 'center' }}>{ex.name}</Text>
        <View style={{ marginTop: 9 }}><Dots dots={dots} size={9} /></View>
        <PressableScale onPress={onOpenHow} haptic={false} className="flex-row items-center rounded-full" style={{ marginTop: 12, gap: 6, paddingVertical: 7, paddingHorizontal: 13, borderWidth: 1, borderColor: dim(0.12), backgroundColor: dim(0.05) }}>
          <HelpCircle size={14} color={dim(0.75)} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: dim(0.75) }}>Not sure how? Show me</Text>
        </PressableScale>
      </View>

      {/* big dashed work ring */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 }}>
        <View style={{ width: 262, height: 262, alignItems: 'center', justifyContent: 'center' }}>
          <Svg viewBox="0 0 100 100" width={262} height={262} style={StyleSheet.absoluteFill}>
            <Circle cx="50" cy="50" r="46" fill="none" stroke={c.brand400} strokeWidth={2} strokeLinecap="round" strokeDasharray="3.4 3.6" />
          </Svg>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: '800', letterSpacing: 4, textTransform: 'uppercase', color: c.brand400 }}>Work</Text>
            <Text style={{ marginTop: 6, fontSize: 62, fontWeight: '800', letterSpacing: -1, lineHeight: 62, color: c.fg, fontVariant: ['tabular-nums'] }}>{elapsedStr}</Text>
            <Text style={{ marginTop: 8, fontSize: 13, fontWeight: '600', color: dim(0.4) }}>Aim for {ex.targetReps} reps</Text>
          </View>
        </View>
      </View>

      {/* recommended weight + reps stepper */}
      <View style={{ paddingHorizontal: 20, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: dim(0.06), borderWidth: 1, borderColor: dim(0.08), borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 }}>
          <Text style={{ fontSize: 12.5, fontWeight: '600', color: dim(0.55) }}>Recommended</Text>
          <Text style={{ fontSize: 12.5, fontWeight: '800', color: c.brand400 }}>{recWeight}</Text>
        </View>
        <Text style={{ marginTop: 18, fontSize: 11, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: dim(0.4) }}>Reps done</Text>
        <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 26 }}>
          <PressableScale onPress={onDecReps} scaleTo={0.9} className="items-center justify-center rounded-full" style={{ width: 52, height: 52, backgroundColor: dim(0.08) }}>
            <Minus size={22} color={c.fg} />
          </PressableScale>
          <Text style={{ minWidth: 64, textAlign: 'center', fontSize: 46, fontWeight: '800', color: c.fg, fontVariant: ['tabular-nums'], lineHeight: 48 }}>{reps}</Text>
          <PressableScale onPress={onIncReps} scaleTo={0.9} className="items-center justify-center rounded-full" style={{ width: 52, height: 52, backgroundColor: c.brand400 }}>
            <Plus size={22} color="#0a0a0b" />
          </PressableScale>
        </View>
      </View>

      {/* done / start rest CTA */}
      <View style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 26 }}>
        <PressableScale onPress={onLogSet} haptic={false} scaleTo={0.97} className="w-full flex-row items-center justify-center rounded-full" style={{ gap: 10, padding: 19, backgroundColor: c.brand400 }}>
          <Check size={20} strokeWidth={3} color="#0a0a0b" />
          <Text style={{ fontSize: 16, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', color: '#0a0a0b' }}>{doneLabel}</Text>
        </PressableScale>
      </View>

      {showHow && <HowToDialog c={c} ex={ex} detail={detail} onClose={onCloseHow} />}
    </ScreenIn>
  )
}

function HowToDialog({ c, ex, detail, onClose }: any) {
  const dim = (o: number) => `rgba(255,255,255,${o})`
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.spring(v, { toValue: 1, useNativeDriver: USE_NATIVE, speed: 14, bounciness: 8 }).start()
  }, [v])
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 20, backgroundColor: 'rgba(0,0,0,0.78)', alignItems: 'center', justifyContent: 'center', padding: 16, opacity: v }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View style={{ width: '100%', maxHeight: '100%', backgroundColor: c.ink800, borderWidth: 1, borderColor: dim(0.1), borderRadius: 24, overflow: 'hidden', transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.93, 1] }) }] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingBottom: 10 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: c.fg }}>How to · {ex.name}</Text>
          <Pressable onPress={onClose} className="items-center justify-center rounded-full active:opacity-80" style={{ width: 32, height: 32, backgroundColor: dim(0.1) }}><X size={17} strokeWidth={2.4} color={dim(0.7)} /></Pressable>
        </View>
        <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 18 }} showsVerticalScrollIndicator={false}>
          <TechniqueClip exerciseId={ex.defId} poster={ex.image} label="Form clip · coming soon" />
          <Text style={{ marginTop: 14, fontSize: 14, lineHeight: 21, color: dim(0.78) }}>{detail.desc}</Text>
          <Text style={{ marginTop: 18, marginBottom: 10, fontSize: 11.5, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: dim(0.4) }}>Step by step</Text>
          <View style={{ gap: 11 }}>
            {detail.cues.map((cue: string, k: number) => (
              <View key={k} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 11 }}>
                <View style={{ width: 24, height: 24, borderRadius: 999, backgroundColor: 'rgba(126,217,87,0.16)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: c.brand400 }}>{k + 1}</Text>
                </View>
                <Text style={{ flex: 1, fontSize: 14, lineHeight: 20.3, color: dim(0.8) }}>{cue}</Text>
              </View>
            ))}
          </View>
          <View style={{ marginTop: 16, borderWidth: 1, borderColor: 'rgba(245,165,36,0.25)', backgroundColor: 'rgba(245,165,36,0.09)', borderRadius: 14, padding: 13 }}>
            <Text style={{ fontSize: 13, lineHeight: 18.85, color: dim(0.72) }}><Text style={{ color: c.accentOrange, fontWeight: '700' }}>Avoid · </Text>{detail.commonMistake}</Text>
          </View>
          <PressableScale onPress={onClose} className="w-full items-center rounded-2xl" style={{ marginTop: 18, padding: 15, backgroundColor: c.brand400 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#000' }}>Got it</Text>
          </PressableScale>
        </ScrollView>
      </Animated.View>
    </Animated.View>
  )
}

/* ============================ Rest ============================ */
function RestScreen({ colors: c, units, remaining, total, rail, nextEx, nextCursor, nextSet, onBack, onSkip, onAdd, onSub }: any) {
  const dim = (o: number) => `rgba(255,255,255,${o})`
  const frac = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0
  const color = restColor(frac)
  const endTime = new Date(Date.now() + remaining * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  const stroke = 4
  const radius = 54
  const circ = 2 * Math.PI * radius
  const offset = circ * (1 - frac)

  // Glide the ring toward each new second so it reads as a continuous sweep.
  const animOffset = useRef(new Animated.Value(offset)).current
  useEffect(() => {
    Animated.timing(animOffset, { toValue: offset, duration: 950, easing: Easing.linear, useNativeDriver: false }).start()
  }, [offset, animOffset])

  // Final 3 seconds: a gentle heartbeat pulls the eye back up before GO.
  const pulse = useRef(new Animated.Value(1)).current
  useEffect(() => {
    if (remaining > 3 || remaining <= 0) return
    pulse.setValue(1)
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1.06, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: USE_NATIVE }),
      Animated.spring(pulse, { toValue: 1, speed: 18, bounciness: 10, useNativeDriver: USE_NATIVE }),
    ]).start()
  }, [remaining, pulse])

  const u = weightUnit(units)
  return (
    <ScreenIn>
      <View style={{ paddingHorizontal: 18, paddingTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <PressableScale onPress={onBack} haptic={false} className="flex-row items-center rounded-full" style={{ gap: 4, paddingVertical: 8, paddingLeft: 9, paddingRight: 13, backgroundColor: dim(0.07) }}>
          <ChevronLeft size={16} color={dim(0.85)} />
          <Text style={{ fontSize: 12.5, fontWeight: '700', color: dim(0.85) }}>List</Text>
        </PressableScale>
        <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 2.8, textTransform: 'uppercase', color }}>Rest</Text>
        <PressableScale onPress={onSkip} haptic={false} className="rounded-full" style={{ paddingVertical: 8, paddingHorizontal: 15, backgroundColor: dim(0.07) }}>
          <Text style={{ fontSize: 12.5, fontWeight: '700', color: dim(0.85) }}>Skip</Text>
        </PressableScale>
      </View>
      <View style={{ marginTop: 10 }}><Rail rail={rail} /></View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 26 }}>
        <PressableScale onPress={() => { thud(); onSkip() }} haptic={false} scaleTo={0.97} className="items-center justify-center" style={{ width: 290, height: 290 }}>
          <Animated.View style={{ width: 290, height: 290, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pulse }] }}>
            <Svg viewBox="0 0 120 120" width={290} height={290} style={[StyleSheet.absoluteFill, { transform: [{ rotate: '-90deg' }] }]}>
              <Circle cx="60" cy="60" r={radius} fill="none" stroke={dim(0.08)} strokeWidth={stroke} />
              <AnimatedCircle cx="60" cy="60" r={radius} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={animOffset} />
            </Svg>
            <View style={{ alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Bell size={13} color={dim(0.4)} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: dim(0.4) }}>{endTime}</Text>
              </View>
              <Text style={{ marginTop: 8, fontSize: 70, fontWeight: '800', letterSpacing: -1.4, lineHeight: 70, color, fontVariant: ['tabular-nums'] }}>{mmss(remaining)}</Text>
              <Text style={{ marginTop: 6, fontSize: 11.5, fontWeight: '700', letterSpacing: 1.6, textTransform: 'uppercase', color: dim(0.35) }}>until next set</Text>
            </View>
          </Animated.View>
        </PressableScale>
      </View>

      {/* up next */}
      <View style={{ paddingHorizontal: 22, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: dim(0.1), backgroundColor: dim(0.04), borderRadius: 16, paddingVertical: 11, paddingLeft: 11, paddingRight: 15 }}>
          <View style={{ width: 42, height: 42, borderRadius: 11, overflow: 'hidden', backgroundColor: c.ink700, alignItems: 'center', justifyContent: 'center' }}>
            {nextEx.image ? <Image source={{ uri: nextEx.image }} resizeMode="cover" style={{ width: '100%', height: '100%' }} /> : <Dumbbell size={20} color="rgba(255,255,255,0.4)" />}
          </View>
          <View>
            <Text style={{ fontSize: 10.5, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: dim(0.4) }}>Up next · Set {nextCursor.setIdx + 1} of {nextEx.sets.length}</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', lineHeight: 17.25, color: c.fg }}>{nextEx.name}</Text>
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: c.brand400 }}>{fmtWeightNum(nextSet.weightKg, units, units === 'imperial' ? 0 : 1)} {u} × {nextSet.reps}</Text>
          </View>
        </View>
      </View>

      {/* controls */}
      <View style={{ paddingHorizontal: 22, paddingTop: 22, paddingBottom: 26 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <PressableScale onPress={onSub} className="items-center justify-center rounded-full" style={{ width: 62, height: 62, backgroundColor: dim(0.08) }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: c.fg }}>−15s</Text>
          </PressableScale>
          <PressableScale onPress={() => { thud(); onSkip() }} haptic={false} className="items-center justify-center rounded-full" style={{ width: 78, height: 78, backgroundColor: c.brand400, shadowColor: c.brand400, shadowOpacity: 0.7, shadowRadius: 22, shadowOffset: { width: 0, height: 8 }, elevation: 10 }}>
            <Play size={24} color="#000" fill="#000" />
          </PressableScale>
          <PressableScale onPress={onAdd} className="items-center justify-center rounded-full" style={{ width: 62, height: 62, backgroundColor: dim(0.08) }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: c.fg }}>+15s</Text>
          </PressableScale>
        </View>
        <Text style={{ marginTop: 12, textAlign: 'center', fontSize: 12, fontWeight: '600', color: dim(0.35) }}>Tap the centre to start now</Text>
      </View>
    </ScreenIn>
  )
}

/* ============================ Go ============================ */
function GoScreen({ colors: c, units, nextEx, nextCursor, nextSet, onStart }: any) {
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: USE_NATIVE }).start()
  }, [v])
  const ink = c.ink900
  const u = weightUnit(units)
  return (
    <Animated.View style={{ flex: 1, opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }}>
      <Pressable onPress={() => { thud(); onStart() }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.brand400 }}>
        <Text style={{ fontSize: 92, fontWeight: '800', letterSpacing: -3, lineHeight: 83, color: ink }}>GO</Text>
        <Text style={{ marginTop: 14, fontSize: 24, fontWeight: '800', color: ink }}>{fmtWeightNum(nextSet.weightKg, units, units === 'imperial' ? 0 : 1)} {u} × {nextSet.reps}</Text>
        <Text style={{ marginTop: 4, fontSize: 13, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', color: 'rgba(10,10,11,0.62)' }}>{nextEx.name} · Set {nextCursor.setIdx + 1}</Text>
        <Text style={{ position: 'absolute', bottom: 56, fontSize: 13, fontWeight: '700', color: 'rgba(10,10,11,0.5)' }}>Tap to begin</Text>
      </Pressable>
    </Animated.View>
  )
}

/* ============================ Finish (bottom sheet) ============================ */
function FinishSheet({ colors: c, units, name, streakStr, stats, pr, onDone }: any) {
  const dim = (o: number) => `rgba(255,255,255,${o})`
  const scrim = useRef(new Animated.Value(0)).current
  const sheet = useRef(new Animated.Value(1)).current // 1 = off-screen (down)
  const pop = useRef(new Animated.Value(0)).current
  const halo = useRef(new Animated.Value(0)).current
  const draw = useRef(new Animated.Value(40)).current
  const rise = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(scrim, { toValue: 1, duration: 200, useNativeDriver: USE_NATIVE }).start()
    Animated.timing(sheet, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: USE_NATIVE }).start()
    Animated.spring(pop, { toValue: 1, delay: 120, speed: 12, bounciness: 14, useNativeDriver: USE_NATIVE }).start()
    Animated.timing(halo, { toValue: 1, delay: 250, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: USE_NATIVE }).start()
    Animated.timing(draw, { toValue: 0, delay: 350, duration: 450, easing: Easing.bezier(0.6, 0, 0.4, 1), useNativeDriver: false }).start()
    Animated.timing(rise, { toValue: 1, delay: 260, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: USE_NATIVE }).start()
  }, [scrim, sheet, pop, halo, draw, rise])

  const riseStyle = { opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 30, justifyContent: 'flex-end' }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)', opacity: scrim }]} />
      <Animated.View style={{ height: '56%', backgroundColor: c.ink800, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderTopColor: dim(0.1), overflow: 'hidden', transform: [{ translateY: sheet.interpolate({ inputRange: [0, 1], outputRange: [0, 600] }) }] }}>
        <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 2 }}>
          <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: dim(0.2) }} />
        </View>
        <ScrollView contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 26, paddingTop: 6, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          {/* check ring */}
          <View style={{ marginTop: 4, width: 96, height: 96, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={{ position: 'absolute', width: 96, height: 96, borderRadius: 999, backgroundColor: 'rgba(126,217,87,0.25)', opacity: halo.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }), transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.5] }) }] }} />
            <Animated.View style={{ position: 'absolute', width: 96, height: 96, borderRadius: 999, borderWidth: 2, borderColor: 'rgba(126,217,87,0.5)', opacity: pop, transform: [{ scale: pop }] }} />
            <Animated.View style={{ width: 76, height: 76, borderRadius: 999, backgroundColor: c.brand400, alignItems: 'center', justifyContent: 'center', opacity: pop, transform: [{ scale: pop }] }}>
              <Svg width={46} height={46} viewBox="0 0 24 24" fill="none">
                <AnimatedPath d="M20 6 9 17l-5-5" stroke="#0a0a0b" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={40} strokeDashoffset={draw} />
              </Svg>
            </Animated.View>
          </View>

          <Animated.View style={[{ marginTop: 16, alignItems: 'center' }, riseStyle]}>
            <Text style={{ fontSize: 23, fontWeight: '800', letterSpacing: -0.4, color: c.fg }}>Workout complete</Text>
            <Text style={{ marginTop: 3, fontSize: 13, color: dim(0.55) }}>{name} · {streakStr}</Text>
          </Animated.View>

          {pr && (
            <Animated.View style={[{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: 'rgba(245,197,24,0.35)', backgroundColor: 'rgba(245,197,24,0.12)', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 15 }, riseStyle]}>
              <Star size={16} color={c.accentYellow} fill={c.accentYellow} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: c.fg }}>New PR · {pr.name} · {fmtWeight(pr.weightKg, units, units === 'imperial' ? 0 : 1)} × {pr.reps}</Text>
            </Animated.View>
          )}

          <Animated.View style={[{ marginTop: 18, flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center' }, riseStyle]}>
            <FinishStat value={stats ? mmss(stats.time) : '0:00'} label="Time" c={c} />
            <View style={{ width: 1, height: 30, backgroundColor: dim(0.1) }} />
            <FinishStat value={stats ? fmtVolume(stats.volume, units) : '0'} label="Volume" c={c} />
            <View style={{ width: 1, height: 30, backgroundColor: dim(0.1) }} />
            <FinishStat value={stats ? String(stats.sets) : '0'} label="Sets" c={c} />
          </Animated.View>

          <PressableScale onPress={onDone} className="w-full items-center rounded-2xl" style={{ marginTop: 22, padding: 15, backgroundColor: c.brand400 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: c.ink900 }}>Done</Text>
          </PressableScale>
          <Animated.View style={[{ marginTop: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, riseStyle]}>
            <Spinner color={dim(0.4)} />
            <Text style={{ fontSize: 12.5, fontWeight: '600', color: dim(0.45) }}>Returning to your workout…</Text>
          </Animated.View>
        </ScrollView>
      </Animated.View>
    </View>
  )
}

function FinishStat({ value, label, c }: { value: string; label: string; c: any }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: 21, fontWeight: '800', color: c.fg }}>{value}</Text>
      <Text style={{ marginTop: 3, fontSize: 10, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>{label}</Text>
    </View>
  )
}

/** A quiet spinning ring — the auto-return indicator on the finish sheet. */
function Spinner({ color }: { color: string }) {
  const spin = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: USE_NATIVE }))
    loop.start()
    return () => loop.stop()
  }, [spin])
  return (
    <Animated.View style={{ width: 14, height: 14, transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeDasharray="44" strokeDashoffset={12} />
      </Svg>
    </Animated.View>
  )
}
