import { useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, Pressable, TextInput, ScrollView, Animated, Easing,
  PanResponder, LayoutAnimation, Platform, UIManager, useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  SlidersHorizontal, Plus, Minus, Search, X, Check, HelpCircle, MessageCircle,
  GripVertical, Info, Star, LayoutGrid, TrendingUp,
} from 'lucide-react-native'
import { Icon } from '../components/Icon'
import { SectionHeader } from '../components/ui'
import { AppModal, IS_WEB, WEB_SCREEN } from '../components/WebFrame'
import { BottomSheet as SheetShell } from '../components/BottomSheet'
import { useStore } from '../store/store'
import { ensureFullHistory } from '../store/historySync'
import { useNav } from '../nav'
import { weightStats } from '../store/selectors'
import { EXERCISES, exById } from '../data/catalog'
import { weightUnit, weightVal, toKg } from '../lib/format'
import {
  progressMetricId, progressTimeframe, progressFeatured, progressQuickCards,
  progressQuickIds, PROGRESS_QUICK, MAX_PROGRESS_QUICK, featuredQuickId,
  progressTrackedIds, progressLiftPeriod, progressTrackedLifts, PROGRESS_LIFT_PERIODS,
  bmiInfo, STAT_TIMEFRAMES,
  type ProgressColor, type ProgressFeatured,
} from '../lib/metrics'
import type { StatTimeframe, ProgressLiftPeriod, Goal } from '../store/types'
import { useColors, type Palette } from '../theme'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

const RANGE_LABEL: Record<string, string> = { '7 days': '7 Days', '4 weeks': '4 Weeks', '3 months': '3 Months', '6 months': '6 Months' }
const GOAL_LABEL: Record<Goal, string> = {
  'build-muscle': 'Build muscle', 'lose-fat': 'Lose fat', 'gain-strength': 'Gain strength', 'stay-healthy': 'Stay healthy',
}
const TOPSTATS: { id: string; label: string; icon: string; accent: AccentName }[] = [
  { id: 'nutrition', label: 'Eating quality', icon: 'leaf', accent: 'brand' },
  { id: 'weight', label: 'Body weight', icon: 'scale', accent: 'blue' },
  { id: 'water', label: 'Water', icon: 'droplet', accent: 'blue' },
  { id: 'steps', label: 'Daily steps', icon: 'footprints', accent: 'orange' },
  { id: 'sleep', label: 'Sleep', icon: 'bed', accent: 'yellow' },
]

type AccentName = 'brand' | 'blue' | 'orange' | 'yellow' | 'purple'
function accentColor(a: AccentName, c: Palette): string {
  return a === 'brand' ? c.brand400 : a === 'blue' ? c.accentBlue : a === 'orange' ? c.accentOrange : a === 'yellow' ? c.accentYellow : c.accentPurple
}
function progColor(c: ProgressColor, colors: Palette): string {
  switch (c) {
    case 'brand': return colors.brand400
    case 'blue': return colors.accentBlue
    case 'orange': return colors.accentOrange
    case 'danger': return colors.danger
    case 'muted': return `${colors.fg}24`
    case 'fg': return colors.fg
    default: return colors.fg
  }
}

export default function Progress() {
  const { state, dispatch } = useStore()
  const nav = useNav()
  const colors = useColors()
  const units = state.settings.units
  const p = state.profile

  // Phase C: this screen renders all-time charts. Once the workout-summary
  // projection is complete the charts read the tiny summaries; until then (an
  // existing account's first open) pull the full history in once so the backfill
  // can build them. See src/store/workoutSummary.ts / cloudRepo LOAD_POLICY.
  useEffect(() => {
    if (!state.workoutSummaryComplete) ensureFullHistory()
  }, [state.workoutSummaryComplete])

  const metricId = progressMetricId(state)
  const tf = progressTimeframe(state)
  const feat = useMemo(() => progressFeatured(state, metricId, tf, units), [state, metricId, tf, units])
  const quickCards = useMemo(() => progressQuickCards(state, metricId, tf, units), [state, metricId, tf, units])

  const trackedIds = progressTrackedIds(state)
  const liftPeriod = progressLiftPeriod(state)
  const lifts = useMemo(() => progressTrackedLifts(state, trackedIds, liftPeriod, units), [state, trackedIds, liftPeriod, units])
  const maxGain = Math.max(1, ...lifts.map((l) => l.gainPct))
  const bmi = bmiInfo(state)

  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [addWeightOpen, setAddWeightOpen] = useState(false)
  const [bmiInfoOpen, setBmiInfoOpen] = useState(false)
  const [liftsExpanded, setLiftsExpanded] = useState(false)

  function cycleTf() {
    const i = STAT_TIMEFRAMES.indexOf(tf)
    dispatch({ type: 'SET_SETTINGS', patch: { progressTimeframe: STAT_TIMEFRAMES[(i + 1) % STAT_TIMEFRAMES.length] } })
  }

  const hasLiftToggle = lifts.length > 4
  const liftsShown = !hasLiftToggle || liftsExpanded ? lifts : lifts.slice(0, 4)
  const deltaColor = feat.deltaGood ? colors.brand400 : `${colors.fg}80`

  return (
    <View className="px-4 pt-2">
      {/* ---------------- Header ---------------- */}
      <View className="mb-3.5 flex-row items-center justify-between">
        <View className="min-w-0 flex-1">
          <Text className="text-[28px] font-extrabold tracking-tight text-white">My Progress</Text>
          <Text className="mt-0.5 text-[12.5px] text-white/45">Goal: {GOAL_LABEL[p.goal]}</Text>
        </View>
        <Pressable
          onPress={() => setCustomizeOpen(true)}
          accessibilityLabel="Customise"
          className="h-10 w-10 items-center justify-center rounded-full bg-ink-700 active:scale-95"
        >
          <SlidersHorizontal size={18} color={colors.brand400} />
        </Pressable>
      </View>

      {/* ---------------- Featured composition card ---------------- */}
      <View className="rounded-3xl border border-white/5 bg-ink-800 p-4">
        <View className="flex-row items-start justify-between gap-2.5">
          <View className="min-w-0 flex-1">
            <Text className="text-[13px] font-semibold text-white/60">{feat.title}</Text>
            <View className="mt-1 flex-row flex-wrap items-baseline gap-2">
              <View className="flex-row items-baseline">
                <Text className="text-[32px] font-extrabold leading-none text-white">{feat.value}</Text>
                <Text className="ml-1 text-[13px] font-semibold text-white/45">{feat.unit}</Text>
              </View>
              <Text className="text-[12px] font-bold" style={{ color: deltaColor }}>{feat.deltaText}</Text>
              <VerdictChip verdict={feat.verdict} colors={colors} />
            </View>
            <Text className="mt-1 text-[11px] text-white/40">{feat.deltaNote}</Text>
          </View>
          <Pressable
            onPress={cycleTf}
            accessibilityLabel="Change range"
            className="shrink-0 flex-row items-center rounded-[10px] border border-white/10 bg-ink-700 px-3 py-1.5 active:scale-95"
          >
            <Text className="text-[12px] font-bold text-white/75">{RANGE_LABEL[tf]}</Text>
          </Pressable>
        </View>

        {/* Composition bar */}
        <CompositionBar key={`${metricId}|${tf}`} segments={feat.segments} colors={colors} />

        {/* Segment legend */}
        <View className="mt-3 gap-2.5">
          {feat.segments.map((sgm, i) => (
            <View key={i} className="flex-row items-center gap-2.5">
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: sgm.dim ? `${colors.fg}38` : progColor(sgm.color, colors) }} />
              <Text className="flex-1 text-[13px] text-white/70">{sgm.label}</Text>
              <Text className="text-[13px] font-extrabold text-white">{sgm.valueLabel}</Text>
            </View>
          ))}
        </View>

        {/* Stats row */}
        <View className="mt-4 flex-row justify-between border-t border-white/[0.06] pt-3.5">
          {feat.stats.map((st, i) => (
            <View key={i} style={{ alignItems: st.align === 'left' ? 'flex-start' : st.align === 'right' ? 'flex-end' : 'center' }}>
              <Text className="text-[11px] text-white/40">{st.label}</Text>
              <Text className="mt-0.5 text-[16px] font-extrabold" style={{ color: st.accent ? colors.brand400 : colors.fg }}>{st.value}</Text>
            </View>
          ))}
        </View>

        {/* Mini 7-day bars (steps / water / sleep) */}
        {feat.mini7 && (
          <View className="mt-4 border-t border-white/[0.06] pt-3.5">
            <Text className="mb-2.5 text-[11px] text-white/40">Last 7 days</Text>
            <View className="h-16 flex-row items-end gap-[7px]">
              {feat.mini7.map((b, i) => (
                <View key={i} className="h-full flex-1 flex-col items-center gap-1.5">
                  <View className="w-full max-w-[16px] flex-1 flex-row items-end overflow-hidden rounded-full bg-white/[0.06]">
                    <View className="w-full rounded-full" style={{ height: `${b.pct}%`, backgroundColor: b.on ? colors.brand400 : `${colors.fg}47` }} />
                  </View>
                  <Text style={{ fontSize: 10, fontWeight: b.last ? '700' : '400', color: b.last ? colors.brand400 : `${colors.fg}66` }}>{b.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Add weight (body-weight metric) */}
        {feat.isWeight && (
          <Pressable
            onPress={() => setAddWeightOpen(true)}
            className="mt-3.5 flex-row items-center justify-center gap-1.5 rounded-xl bg-brand-400/15 py-2.5 active:opacity-80"
          >
            <Plus size={14} color={colors.brand400} strokeWidth={2.4} />
            <Text className="text-[13px] font-bold text-brand-400">Add today's weight</Text>
          </Pressable>
        )}
      </View>

      {/* ---------------- Quick cards ---------------- */}
      <View className="mt-2.5 flex-row gap-2.5">
        {quickCards.map((q) => (
          <View key={q.id} className="flex-1 rounded-3xl border border-white/5 bg-ink-800 px-3 py-3.5">
            <View className="flex-row items-center gap-1.5">
              <Icon name={q.icon} size={15} color={colors.brand400} />
              <Text numberOfLines={1} className="flex-1 text-[11px] font-medium text-white/60">{q.label}</Text>
            </View>
            <Text className="mt-2.5 text-[21px] font-extrabold leading-none text-white">{q.value}</Text>
            <Text className="mt-1.5 text-[10.5px] text-white/40">{q.cap}</Text>
          </View>
        ))}
      </View>

      {/* ---------------- Training progress ---------------- */}
      {lifts.length > 0 && (
        <>
          <SectionHeader title="Training progress" />
          <Text className="-mt-2 mb-3.5 text-[12.5px] text-white/45">Sorted by gain · Last {RANGE_LABEL[liftPeriod]}</Text>
          <View className="rounded-3xl border border-white/5 bg-ink-800 px-[18px] pb-3.5 pt-1">
            {liftsShown.map((l, i) => (
              <View key={l.id} style={{ paddingVertical: 13, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: `${colors.fg}12` }}>
                <View className="flex-row items-center gap-2.5">
                  <Text className="w-5 text-[12px] font-extrabold text-white/35">{i + 1}</Text>
                  <Text numberOfLines={1} className="flex-1 text-[14.5px] font-bold text-white">{l.name}</Text>
                  <Text className="text-[14px] font-extrabold text-brand-400">+{l.gainPct}%</Text>
                </View>
                <View className="ml-[30px] mt-2.5 h-2.5 overflow-hidden rounded-full bg-white/10">
                  <View className="h-full rounded-full" style={{ width: `${Math.round((l.gainPct / maxGain) * 100)}%`, backgroundColor: colors.brand400 }} />
                </View>
                <Text className="ml-[30px] mt-1.5 text-[11.5px] text-white/45">{l.from} {weightUnit(units)} → {l.now} {weightUnit(units)}</Text>
              </View>
            ))}
            {hasLiftToggle && (
              <Pressable onPress={() => setLiftsExpanded((v) => !v)} className="mt-1.5 items-center border-t border-white/[0.07] pt-4 active:opacity-70">
                <Text className="text-[13px] font-bold text-brand-400">{liftsExpanded ? 'Show less' : `Show ${lifts.length - 4} more`}</Text>
              </Pressable>
            )}
          </View>
        </>
      )}

      {/* ---------------- Body composition (BMI) ---------------- */}
      {bmi && (
        <>
          <SectionHeader title="Body composition" />
          <View className="rounded-3xl border border-white/5 bg-ink-800 p-[18px]">
            <View className="flex-row items-start justify-between gap-2.5">
              <Text className="text-[17px] font-extrabold text-white">Your BMI</Text>
              <Pressable
                onPress={() => setBmiInfoOpen(true)}
                accessibilityLabel="What is BMI?"
                className="h-[30px] w-[30px] items-center justify-center rounded-full border border-white/20 active:opacity-70"
              >
                <HelpCircle size={15} color={`${colors.fg}8c`} />
              </Pressable>
            </View>
            <View className="mt-2.5 flex-row flex-wrap items-baseline gap-[11px]">
              <Text className="text-[40px] font-extrabold leading-none text-white" style={{ letterSpacing: -1 }}>{bmi.bmi.toFixed(1)}</Text>
              <View className="flex-row items-center gap-2">
                <Text className="text-[14px] text-white/50">Your weight is</Text>
                <View style={{ paddingHorizontal: 11, paddingVertical: 4, borderRadius: 999, backgroundColor: `${progColor(bmi.color, colors)}26` }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: progColor(bmi.color, colors) }}>{bmi.label}</Text>
                </View>
              </View>
            </View>
            {/* gradient bar + needle */}
            <View className="relative mt-5">
              <View className="h-2.5 flex-row gap-1">
                <View style={{ flex: 3.5, borderRadius: 999, backgroundColor: `${colors.accentBlue}b8` }} />
                <View style={{ flex: 6.4, borderRadius: 999, backgroundColor: `${colors.brand400}c7` }} />
                <View style={{ flex: 5, borderRadius: 999, backgroundColor: `${colors.accentYellow}b8` }} />
                <View style={{ flex: 3, borderRadius: 999, backgroundColor: `${colors.danger}b3` }} />
              </View>
              <View style={{ position: 'absolute', top: -5, bottom: -5, left: `${bmi.needlePct}%`, width: 3, borderRadius: 2, backgroundColor: `${colors.fg}d9`, shadowColor: colors.ink800, shadowOpacity: 1, shadowRadius: 0 }} />
            </View>
            {/* legend */}
            <View className="mt-4 flex-row gap-2">
              {[
                { c: colors.accentBlue, label: 'Under', range: '<18.5' },
                { c: colors.brand400, label: 'Healthy', range: '18.5–24.9' },
                { c: colors.accentYellow, label: 'Over', range: '25.0–29.9' },
                { c: colors.danger, label: 'Obese', range: '>30.0' },
              ].map((b) => (
                <View key={b.label} className="flex-1">
                  <View className="flex-row items-center gap-1.5">
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: `${b.c}99` }} />
                    <Text className="text-[11.5px] font-semibold text-white/75">{b.label}</Text>
                  </View>
                  <Text className="ml-3.5 mt-0.5 text-[11px] text-white/40">{b.range}</Text>
                </View>
              ))}
            </View>
          </View>
        </>
      )}

      {/* ---------------- Coach CTA ---------------- */}
      <Pressable
        onPress={() => nav.open('coach')}
        className="mt-3.5 flex-row items-center gap-3 rounded-2xl border border-brand-400/20 bg-brand-400/[0.08] px-3.5 py-3 active:opacity-80"
      >
        <View className="h-[34px] w-[34px] items-center justify-center rounded-full border border-brand-400/50">
          <MessageCircle size={17} color={colors.brand400} />
        </View>
        <Text className="flex-1 text-[13.5px] font-semibold text-white/80">
          Got a question about your progress? <Text className="font-bold text-brand-400">Ask your coach</Text>
        </Text>
      </Pressable>

      <View className="h-2" />

      {/* ---------------- Sheets ---------------- */}
      <CustomiseSheet open={customizeOpen} onClose={() => setCustomizeOpen(false)} colors={colors} />
      <AddWeightSheet open={addWeightOpen} onClose={() => setAddWeightOpen(false)} colors={colors} />
      <BmiInfoSheet open={bmiInfoOpen} onClose={() => setBmiInfoOpen(false)} colors={colors} />
    </View>
  )
}

/* ------------------------------------------------------------------ */
/*  VerdictChip                                                        */
/* ------------------------------------------------------------------ */
function VerdictChip({ verdict, colors }: { verdict: ProgressFeatured['verdict']; colors: Palette }) {
  const c = verdict.warn ? colors.accentOrange : colors.brand400
  return (
    <View style={{ paddingHorizontal: 9, paddingVertical: 2, borderRadius: 999, backgroundColor: `${c}26` }}>
      <Text style={{ fontSize: 10.5, fontWeight: '700', color: c }}>{verdict.label}</Text>
    </View>
  )
}

/* ------------------------------------------------------------------ */
/*  CompositionBar — segmented bar with a scaleX grow-in               */
/* ------------------------------------------------------------------ */
function CompositionBar({ segments, colors }: { segments: ProgressFeatured['segments']; colors: Palette }) {
  const grow = useRef(new Animated.Value(0)).current
  useEffect(() => {
    grow.setValue(0)
    Animated.timing(grow, { toValue: 1, duration: 700, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: !IS_WEB }).start()
  }, [grow])
  const shown = segments.filter((s) => s.pct > 0)
  return (
    <Animated.View
      style={{ marginTop: 18, height: 16, borderRadius: 999, overflow: 'hidden', flexDirection: 'row', gap: 2, transform: [{ scaleX: grow }], opacity: grow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }}
    >
      {shown.map((s, i) => (
        <View key={i} style={{ flex: s.pct, backgroundColor: s.dim ? `${colors.fg}24` : progColor(s.color, colors) }} />
      ))}
    </Animated.View>
  )
}

/* ================================================================== */
/*  Reusable bottom sheet shell — surface only; motion + scrim come      */
/*  from the shared BottomSheet so it matches every other sheet.         */
/* ================================================================== */
function BottomSheet({
  open, onClose, colors, children, maxHeightFrac = 0.92,
}: {
  open: boolean; onClose: () => void; colors: Palette; children: React.ReactNode; maxHeightFrac?: number
}) {
  const insets = useSafeAreaInsets()
  return (
    <SheetShell
      open={open}
      onClose={onClose}
      maxHeightFrac={maxHeightFrac}
      panelStyle={{
        backgroundColor: colors.ink800,
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        paddingBottom: insets.bottom,
        shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 60, shadowOffset: { width: 0, height: -24 }, elevation: 24,
      }}
    >
      {children}
    </SheetShell>
  )
}

/* ================================================================== */
/*  DragList — drag-to-reorder via the grip handle                     */
/* ================================================================== */
function DragList<T extends { id: string }>({
  items, onReorder, renderRow, gap = 7,
}: {
  items: T[]
  onReorder: (orderedIds: string[]) => void
  renderRow: (item: T, handle: React.ReactNode) => React.ReactNode
  gap?: number
}) {
  const [order, setOrder] = useState<string[]>(items.map((i) => i.id))
  const orderRef = useRef(order)
  const slotH = useRef(0)
  const startIdx = useRef(0)
  const dragId = useRef<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const lift = useRef(new Animated.Value(0)).current

  // Keep local order in sync when the source list changes (add/remove/toggle).
  const idsKey = items.map((i) => i.id).join(',')
  useEffect(() => { setOrder(items.map((i) => i.id)); orderRef.current = items.map((i) => i.id) }, [idsKey])
  useEffect(() => { orderRef.current = order }, [order])

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [idsKey])

  function makeHandle(id: string) {
    const responder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragId.current = id
        startIdx.current = orderRef.current.indexOf(id)
        setDraggingId(id)
        lift.setValue(0)
      },
      onPanResponderMove: (_e, g) => {
        const slot = slotH.current || 52
        const curIdx = orderRef.current.indexOf(id)
        const target = Math.max(0, Math.min(orderRef.current.length - 1, startIdx.current + Math.round(g.dy / slot)))
        if (target !== curIdx) {
          const next = orderRef.current.slice()
          next.splice(curIdx, 1)
          next.splice(target, 0, id)
          if (Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.create(140, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity))
          orderRef.current = next
          setOrder(next)
        }
        // keep the dragged row under the finger regardless of live index shifts
        lift.setValue(g.dy - (orderRef.current.indexOf(id) - startIdx.current) * slot)
      },
      onPanResponderRelease: () => {
        dragId.current = null
        setDraggingId(null)
        lift.setValue(0)
        onReorder(orderRef.current)
      },
      onPanResponderTerminate: () => {
        dragId.current = null
        setDraggingId(null)
        lift.setValue(0)
        onReorder(orderRef.current)
      },
    })
    return (
      <View {...responder.panHandlers} hitSlop={8} style={{ paddingRight: 2, cursor: 'grab' } as any} accessibilityLabel="Drag to reorder">
        <GripVertical size={16} color="rgba(255,255,255,0.3)" />
      </View>
    )
  }

  return (
    <View style={{ gap }}>
      {order.map((id) => {
        const item = byId.get(id)
        if (!item) return null
        const isDrag = draggingId === id
        return (
          <Animated.View
            key={id}
            onLayout={(e) => { if (!slotH.current) slotH.current = e.nativeEvent.layout.height + gap }}
            style={isDrag ? { transform: [{ translateY: lift }, { scale: 1.02 }], zIndex: 20, elevation: 8, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } } : undefined}
          >
            {renderRow(item, makeHandle(id))}
          </Animated.View>
        )
      })}
    </View>
  )
}

/* ================================================================== */
/*  CustomiseSheet — featured stat, time range, quick stats,           */
/*  tracked lifts, add-a-lift search, trend range. 1:1 with design.    */
/* ================================================================== */
function CustomiseSheet({ open, onClose, colors }: { open: boolean; onClose: () => void; colors: Palette }) {
  const { state, dispatch } = useStore()
  const units = state.settings.units
  const metricId = progressMetricId(state)
  const tf = progressTimeframe(state)
  const chosenQuick = progressQuickIds(state)
  const trackedIds = progressTrackedIds(state)
  const liftPeriod = progressLiftPeriod(state)
  const [exQuery, setExQuery] = useState('')

  useEffect(() => { if (open) setExQuery('') }, [open])

  const setMetric = (id: string) => dispatch({ type: 'SET_SETTINGS', patch: { progressMetric: id } })
  const setTf = (t: StatTimeframe) => dispatch({ type: 'SET_SETTINGS', patch: { progressTimeframe: t } })
  const setLiftPeriod = (p: ProgressLiftPeriod) => dispatch({ type: 'SET_SETTINGS', patch: { progressLiftPeriod: p } })

  function toggleQuick(id: string) {
    const has = chosenQuick.includes(id)
    if (has) { if (chosenQuick.length <= 1) return; dispatch({ type: 'SET_SETTINGS', patch: { progressQuickStats: chosenQuick.filter((x) => x !== id) } }) }
    else { if (chosenQuick.length >= MAX_PROGRESS_QUICK) return; dispatch({ type: 'SET_SETTINGS', patch: { progressQuickStats: [...chosenQuick, id] } }) }
  }
  function reorderQuick(ordered: string[]) {
    const on = ordered.filter((id) => chosenQuick.includes(id))
    dispatch({ type: 'SET_SETTINGS', patch: { progressQuickStats: on } })
  }
  function toggleTracked(id: string) {
    const has = trackedIds.includes(id)
    if (has) { if (trackedIds.length <= 1) return; dispatch({ type: 'SET_SETTINGS', patch: { progressTrackedIds: trackedIds.filter((x) => x !== id) } }) }
    else dispatch({ type: 'SET_SETTINGS', patch: { progressTrackedIds: [...trackedIds, id] } })
  }
  function reorderTracked(ordered: string[]) {
    dispatch({ type: 'SET_SETTINGS', patch: { progressTrackedIds: ordered } })
  }

  // Quick-stat rows are the full pool, chosen ones first (so reorder targets them).
  const quickRows = [...chosenQuick, ...PROGRESS_QUICK.map((q) => q.id).filter((id) => !chosenQuick.includes(id))]
    .map((id) => PROGRESS_QUICK.find((q) => q.id === id)!)
  const trackedRows = trackedIds.map((id) => ({ id, name: exById(id)?.name ?? id, muscle: exById(id)?.muscle ?? '' }))

  const exq = exQuery.trim().toLowerCase()
  const libItems = exq
    ? EXERCISES.filter((e) => e.name.toLowerCase().includes(exq) || e.muscle.toLowerCase().includes(exq)).slice(0, 8)
    : []

  const tabStyle = (on: boolean) => ({ flex: 1, alignItems: 'center' as const, paddingVertical: 10, borderRadius: 10, backgroundColor: on ? colors.brand400 : 'transparent' })
  const cardBox = { marginTop: 14, backgroundColor: colors.ink900, borderWidth: 1, borderColor: `${colors.fg}12`, borderRadius: 18, padding: 15 } as const

  return (
    <BottomSheet open={open} onClose={onClose} colors={colors}>
      {/* sticky header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 }}>
        <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: `${colors.fg}33`, alignSelf: 'center', marginBottom: 14 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 22, fontWeight: '800', letterSpacing: -0.2, color: colors.fg }}>Customise</Text>
          <Pressable onPress={onClose} hitSlop={8}><Text style={{ fontSize: 16, fontWeight: '700', color: colors.brand400 }}>Done</Text></Pressable>
        </View>
      </View>

      <ScrollView style={{ paddingHorizontal: 20 }} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Featured stat */}
        <View style={cardBox}>
          <SheetCardHead icon={<Star size={16} color={colors.brand400} />} title="Featured stat" sub="The large card at the top of Progress" colors={colors} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 14 }}>
            {TOPSTATS.map((m) => {
              const on = metricId === m.id
              const accent = accentColor(m.accent, colors)
              return (
                <Pressable
                  key={m.id}
                  onPress={() => setMetric(m.id)}
                  style={{ width: '47.8%', flexGrow: 1, gap: 12, padding: 14, borderRadius: 16, backgroundColor: on ? `${colors.brand400}1a` : colors.ink700, borderWidth: 1, borderColor: on ? `${colors.brand400}73` : `${colors.fg}10` }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 24 }}>
                    <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: `${accent}26` }}>
                      <Icon name={m.icon} size={18} color={accent} />
                    </View>
                    {on && (
                      <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand400 }}>
                        <Check size={14} strokeWidth={3} color="#0a0a0b" />
                      </View>
                    )}
                  </View>
                  <Text style={{ fontWeight: '700', fontSize: 14.5, color: colors.fg }}>{m.label}</Text>
                </Pressable>
              )
            })}
          </View>

          <SheetLabel colors={colors}>Time range</SheetLabel>
          <View style={{ flexDirection: 'row', gap: 4, marginTop: 9, backgroundColor: colors.ink700, padding: 4, borderRadius: 13 }}>
            {STAT_TIMEFRAMES.map((t) => (
              <Pressable key={t} onPress={() => setTf(t)} style={tabStyle(tf === t)}>
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: tf === t ? '#0a0a0b' : `${colors.fg}8c` }}>{RANGE_LABEL[t]}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Quick stats */}
        <View style={cardBox}>
          <SheetCardHead icon={<LayoutGrid size={16} color={colors.brand400} />} title="Quick stats" sub={`The three small cards · ${chosenQuick.length}/3 chosen`} colors={colors} />
          <View style={{ marginTop: 14 }}>
            <DragList
              items={quickRows}
              onReorder={reorderQuick}
              renderRow={(q, handle) => {
                const on = chosenQuick.includes(q.id)
                return (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 13, backgroundColor: on ? `${colors.brand400}1a` : colors.ink700, borderWidth: 1, borderColor: on ? `${colors.brand400}47` : `${colors.fg}10` }}>
                    {handle}
                    <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? `${colors.brand400}26` : `${colors.fg}10` }}>
                      <Icon name={q.icon} size={17} color={colors.brand400} />
                    </View>
                    <Text style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: '700', color: colors.fg }}>{q.label}</Text>
                    <Pressable onPress={() => toggleQuick(q.id)} hitSlop={6}>
                      {on ? (
                        <View style={{ width: 27, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand400 }}><Check size={15} strokeWidth={3} color="#0a0a0b" /></View>
                      ) : (
                        <View style={{ width: 27, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: `${colors.fg}14`, borderWidth: 1, borderColor: `${colors.fg}26` }}><Plus size={15} color={`${colors.fg}73`} /></View>
                      )}
                    </Pressable>
                  </View>
                )
              }}
            />
          </View>
        </View>

        {/* Training progress */}
        <View style={cardBox}>
          <SheetCardHead icon={<TrendingUp size={16} color={colors.brand400} />} title="Training progress" sub="Your tracked lifts and their trend" colors={colors} />
          <SheetLabel colors={colors}>Tracked lifts · {trackedIds.length}</SheetLabel>
          <Text style={{ fontSize: 12.5, color: `${colors.fg}73`, marginTop: 3 }}>Drag to reorder · tap – to remove.</Text>
          <View style={{ marginTop: 11 }}>
            <DragList
              items={trackedRows}
              onReorder={reorderTracked}
              renderRow={(t, handle) => (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 13, backgroundColor: `${colors.brand400}1a`, borderWidth: 1, borderColor: `${colors.brand400}47` }}>
                  {handle}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: colors.fg }}>{t.name}</Text>
                    <Text style={{ fontSize: 11.5, color: `${colors.fg}73` }}>{t.muscle}</Text>
                  </View>
                  <Pressable onPress={() => toggleTracked(t.id)} hitSlop={6} disabled={trackedIds.length <= 1} style={{ width: 27, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: `${colors.fg}14`, opacity: trackedIds.length <= 1 ? 0.4 : 1 }}>
                    <Minus size={15} color={`${colors.fg}99`} />
                  </Pressable>
                </View>
              )}
            />
          </View>

          <SheetLabel colors={colors}>Trend range</SheetLabel>
          <View style={{ flexDirection: 'row', gap: 4, marginTop: 9, backgroundColor: colors.ink700, padding: 4, borderRadius: 13 }}>
            {PROGRESS_LIFT_PERIODS.map((pp) => (
              <Pressable key={pp} onPress={() => setLiftPeriod(pp)} style={tabStyle(liftPeriod === pp)}>
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: liftPeriod === pp ? '#0a0a0b' : `${colors.fg}8c` }}>{RANGE_LABEL[pp]}</Text>
              </Pressable>
            ))}
          </View>

          <SheetLabel colors={colors}>Add another lift</SheetLabel>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 9, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, backgroundColor: colors.ink700, borderWidth: 1, borderColor: `${colors.fg}14` }}>
            <Search size={18} color={`${colors.fg}66`} />
            <TextInput value={exQuery} onChangeText={setExQuery} placeholder="Search exercises" placeholderTextColor={`${colors.fg}59`} style={{ flex: 1, minWidth: 0, fontSize: 15, color: colors.fg, paddingVertical: 0 }} />
            {exQuery.length > 0 && <Pressable onPress={() => setExQuery('')} hitSlop={8}><X size={15} color={`${colors.fg}73`} /></Pressable>}
          </View>
          {exq.length > 0 && (
            <View style={{ marginTop: 10, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.ink700, borderWidth: 1, borderColor: `${colors.fg}10` }}>
              {libItems.map((e, i) => {
                const on = trackedIds.includes(e.id)
                return (
                  <Pressable key={e.id} onPress={() => toggleTracked(e.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, paddingVertical: 11, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: `${colors.fg}10` }}>
                    <View style={{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: `${colors.fg}0f` }}>
                      <Icon name="dumbbell" size={20} color={`${colors.brand400}` } />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.fg }}>{e.name}</Text>
                      <Text style={{ fontSize: 12, color: `${colors.fg}73`, marginTop: 1 }}>{e.muscle}</Text>
                    </View>
                    {on ? (
                      <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand400 }}><Check size={15} strokeWidth={3} color="#0a0a0b" /></View>
                    ) : (
                      <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: `${colors.fg}14`, borderWidth: 1, borderColor: `${colors.fg}26` }}><Plus size={15} color={`${colors.fg}73`} /></View>
                    )}
                  </Pressable>
                )
              })}
              {libItems.length === 0 && <Text style={{ textAlign: 'center', fontSize: 13, color: `${colors.fg}73`, padding: 14 }}>No exercises match your search.</Text>}
            </View>
          )}
        </View>
      </ScrollView>
    </BottomSheet>
  )
}

function SheetCardHead({ icon, title, sub, colors }: { icon: React.ReactNode; title: string; sub: string; colors: Palette }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
      <View style={{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: `${colors.brand400}24` }}>{icon}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: colors.fg }}>{title}</Text>
        <Text style={{ fontSize: 12, color: `${colors.fg}73`, marginTop: 1 }}>{sub}</Text>
      </View>
    </View>
  )
}
function SheetLabel({ children, colors }: { children: React.ReactNode; colors: Palette }) {
  return <Text style={{ marginTop: 18, fontSize: 11, fontWeight: '700', letterSpacing: 0.55, textTransform: 'uppercase', color: `${colors.fg}66` }}>{children}</Text>
}

/* ================================================================== */
/*  AddWeightSheet — a ±0.1 stepper that logs today's weight            */
/* ================================================================== */
function AddWeightSheet({ open, onClose, colors }: { open: boolean; onClose: () => void; colors: Palette }) {
  const { state, dispatch } = useStore()
  const units = state.settings.units
  const w = weightStats(state)
  const startDisp = weightVal(state.profile.startWeightKg, units)
  const curDisp = Math.round(weightVal(w.current, units) * 10) / 10
  const [draft, setDraft] = useState(curDisp)
  useEffect(() => { if (open) setDraft(curDisp) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const step = (d: number) => setDraft((v) => Math.round((v + d) * 10) / 10)
  const dLabel = (() => {
    const d = Math.round((draft - startDisp) * 10) / 10
    const u = weightUnit(units)
    return d === 0 ? 'Same as start' : d < 0 ? `${Math.abs(d)} ${u} below start` : `${d} ${u} above start`
  })()
  function save() {
    dispatch({ type: 'LOG_WEIGHT', kg: toKg(draft, units) })
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose} colors={colors} maxHeightFrac={0.6}>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
        <View style={{ width: 40, height: 4, borderRadius: 999, backgroundColor: `${colors.fg}33`, alignSelf: 'center', marginBottom: 14 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 19, fontWeight: '800', letterSpacing: -0.2, color: colors.fg }}>Add today's weight</Text>
          <Pressable onPress={onClose} style={{ height: 32, width: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: `${colors.fg}1a` }}><X size={16} color={colors.fg} /></Pressable>
        </View>
        <View style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22 }}>
          <Pressable onPress={() => step(-0.1)} style={{ height: 48, width: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: `${colors.fg}0f` }}><Minus size={20} color={colors.fg} strokeWidth={2.4} /></Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, minWidth: 150, justifyContent: 'center' }}>
            <Text style={{ fontSize: 44, fontWeight: '800', lineHeight: 46, color: colors.fg, letterSpacing: -1 }}>{draft.toFixed(1)}</Text>
            <Text style={{ fontSize: 16, fontWeight: '600', color: `${colors.fg}73` }}>{weightUnit(units)}</Text>
          </View>
          <Pressable onPress={() => step(0.1)} style={{ height: 48, width: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: `${colors.brand400}26` }}><Plus size={20} color={colors.brand400} strokeWidth={2.4} /></Pressable>
        </View>
        <Text style={{ marginTop: 8, textAlign: 'center', fontSize: 12, color: `${colors.fg}73` }}>{dLabel}</Text>
        <Pressable onPress={save} style={{ marginTop: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: colors.brand400, paddingVertical: 14 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#0a0a0b' }}>Save weight</Text>
        </Pressable>
      </View>
    </BottomSheet>
  )
}

/* ================================================================== */
/*  BmiInfoSheet — the "What is BMI?" explainer                         */
/* ================================================================== */
function BmiInfoSheet({ open, onClose, colors }: { open: boolean; onClose: () => void; colors: Palette }) {
  const rows = [
    { c: colors.accentBlue, label: 'Underweight', range: 'Below 18.5' },
    { c: colors.brand400, label: 'Healthy', range: '18.5 – 24.9' },
    { c: colors.accentYellow, label: 'Overweight', range: '25.0 – 29.9' },
    { c: colors.danger, label: 'Obese', range: '30.0 and above' },
  ]
  return (
    <BottomSheet open={open} onClose={onClose} colors={colors} maxHeightFrac={0.7}>
      <View style={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 8 }}>
        <View style={{ width: 40, height: 4, borderRadius: 999, backgroundColor: `${colors.fg}33`, alignSelf: 'center', marginBottom: 16 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 19, fontWeight: '800', letterSpacing: -0.2, color: colors.fg }}>What is BMI?</Text>
          <Pressable onPress={onClose} style={{ height: 32, width: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: `${colors.fg}1a` }}><X size={16} color={colors.fg} /></Pressable>
        </View>
        <Text style={{ marginTop: 14, fontSize: 14, lineHeight: 22, color: `${colors.fg}b3` }}>
          Body Mass Index estimates whether your weight sits in a healthy range for your height. It's your weight in kilograms divided by your height in metres squared.
        </Text>
        <View style={{ marginTop: 16, gap: 9 }}>
          {rows.map((r) => (
            <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: r.c }} />
              <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '600', color: colors.fg }}>{r.label}</Text>
              <Text style={{ fontSize: 13, color: `${colors.fg}80` }}>{r.range}</Text>
            </View>
          ))}
        </View>
        <View style={{ marginTop: 18, flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 14, backgroundColor: `${colors.accentBlue}1a`, borderWidth: 1, borderColor: `${colors.accentBlue}40` }}>
          <Info size={18} color={colors.accentBlue} />
          <Text style={{ flex: 1, fontSize: 12.5, lineHeight: 19, color: `${colors.fg}b3` }}>
            BMI doesn't account for muscle mass, so it can read high for strength athletes. Treat it as one signal, not the whole picture.
          </Text>
        </View>
      </View>
    </BottomSheet>
  )
}
