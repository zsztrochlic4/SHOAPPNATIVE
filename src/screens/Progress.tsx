import { useState } from 'react'
import { View, Text, Pressable, Image, ScrollView, useWindowDimensions } from 'react-native'
import { SlidersHorizontal, ChevronDown, ArrowRight, Trophy, Flame, Plus, Camera } from 'lucide-react-native'
import { default as Svg, Path, Line, Circle, Rect, G, Text as SvgText } from 'react-native-svg'
import { Icon } from '../components/Icon'
import { ProgressRing, ProgressBar, ScreenHeader, SectionHeader } from '../components/ui'
import { useStore } from '../store/store'
import { useNav } from '../nav'
import { dayKey, weekday } from '../lib/date'
import { fmtWeight, fmtWeightNum, weightUnit, weightVal } from '../lib/format'
import {
  weightStats, strengthProgress, habitConsistency7d, streakStats,
  workoutsInRange, volumeByWeek,
} from '../store/selectors'
import { CHART_METRICS, buildChartData, progressMetricId } from '../lib/metrics'
import { brand, useColors } from '../theme'

export default function Progress() {
  const { state, dispatch } = useStore()
  const nav = useNav()
  const colors = useColors()
  const units = state.settings.units
  const p = state.profile
  const [range, setRange] = useState<'4 Weeks' | '12 Weeks'>('4 Weeks')

  const w = weightStats(state)
  const sp = strengthProgress(state)
  const strengthAvg = sp.length ? Math.round(sp.reduce((a, s) => a + s.pct, 0) / sp.length) : 0
  const maxPct = Math.max(1, ...sp.map((s) => s.pct))
  const hc = habitConsistency7d(state)
  const streak = streakStats(state)
  const workouts4w = workoutsInRange(state, 28)

  // Main chart: whichever metric the user picked (weight, a lift, or steps)
  const days = range === '4 Weeks' ? 28 : 84
  const metricId = progressMetricId(state)
  const cd = buildChartData(state, metricId, days, units)

  // Weight goal bar (only shown when the chart is body weight)
  const goalKg = p.goalWeightKg
  const losing = goalKg <= w.start
  const span = Math.abs(w.start - goalKg) || 1
  const moved = losing ? w.start - w.current : w.current - w.start
  const goalPct = Math.max(0, Math.min(100, (moved / span) * 100))
  const reachedGoal = losing ? w.current <= goalKg : w.current >= goalKg
  const toGo = Math.max(0, Math.abs(w.current - goalKg))

  // Last 7 days of steps (custom weekly bars), oldest to today
  const todayK = dayKey(0)
  const week = Array.from({ length: 7 }, (_, i) => dayKey(6 - i)).map((k) => {
    const h = state.habits.find((x) => x.dateKey === k)
    const steps = h?.steps ?? 0
    return { k, label: weekday(k).slice(0, 1), steps, hit: steps >= p.stepTarget, today: k === todayK }
  })
  const maxStep = Math.max(p.stepTarget, ...week.map((d) => d.steps), 1)
  const stepGoalPct = (p.stepTarget / maxStep) * 100
  const daysHit = week.filter((d) => d.hit).length
  const stepDays = week.filter((d) => d.steps > 0)
  const avgSteps = stepDays.length ? Math.round(stepDays.reduce((a, d) => a + d.steps, 0) / stepDays.length) : 0

  // 8-week training volume
  const volWeeks = volumeByWeek(state, 8).map((v) => ({ label: v.label, volume: Math.round(weightVal(v.volume, units)) }))

  const tiles = [
    { icon: 'trending', label: 'Strength', value: `+${strengthAvg}%`, sub: 'last 4 weeks' },
    { icon: 'footprints', label: 'Workouts', value: String(workouts4w), sub: 'last 4 weeks' },
    { icon: 'footprints', label: 'Steps', value: hc.avgSteps ? hc.avgSteps.toLocaleString() : '--', sub: 'avg / day' },
    { icon: 'bed', label: 'Sleep', value: hc.avgSleep ? `${hc.avgSleep.toFixed(1)}h` : '--', sub: 'avg last 7 days' },
  ]

  const rings = [
    { label: 'Workouts', value: `${hc.workouts}/${hc.total}`, pct: hc.total ? (hc.workouts / hc.total) * 100 : 0 },
    { label: 'Steps', value: `${hc.steps}/${hc.total}`, pct: hc.total ? (hc.steps / hc.total) * 100 : 0 },
    { label: 'Sleep', value: `${hc.sleep}/${hc.total}`, pct: hc.total ? (hc.sleep / hc.total) * 100 : 0 },
    { label: 'Nutrition', value: `${hc.nutrition}/${hc.total}`, pct: hc.total ? (hc.nutrition / hc.total) * 100 : 0 },
  ]

  return (
    <View className="px-5 pt-2">
      <ScreenHeader
        title="Progress"
        trailing={
          <Pressable onPress={() => nav.open('customize')} className="h-10 w-10 items-center justify-center rounded-xl active:opacity-70">
            <SlidersHorizontal size={22} color={brand[400]} />
          </Pressable>
        }
      />

      {/* ---------------- Main chart (customisable metric) ---------------- */}
      <View className="card p-4">
        <View className="mb-1 flex-row items-start justify-between">
          <View className="min-w-0 flex-1">
            <Text numberOfLines={1} className="section-title">{cd.title}</Text>
            <View className="mt-0.5 flex-row items-baseline gap-2">
              <View className="flex-row items-baseline">
                <Text className="text-3xl font-extrabold leading-none text-white">{cd.currentLabel}</Text>
                <Text className="ml-1 text-sm font-semibold text-white/45">{cd.unit}</Text>
              </View>
              {cd.points.length >= 2 ? (
                <Text className={`text-[12px] font-semibold ${cd.deltaGood ? 'text-brand-400' : 'text-white/50'}`}>{cd.deltaText}</Text>
              ) : null}
            </View>
          </View>
          <Pressable onPress={() => setRange((r) => (r === '4 Weeks' ? '12 Weeks' : '4 Weeks'))} className="ml-2 flex-row shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-ink-700 px-2.5 py-1 active:opacity-80">
            <Text className="text-xs font-semibold text-white/70">{range}</Text>
            <ChevronDown size={14} color="rgba(255,255,255,0.7)" />
          </Pressable>
        </View>

        {/* Metric picker */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-3 mt-2"
          contentContainerStyle={{ gap: 8, paddingRight: 4 }}
        >
          {CHART_METRICS.map((m) => {
            const active = m.id === metricId
            return (
              <Pressable
                key={m.id}
                onPress={() => dispatch({ type: 'SET_SETTINGS', patch: { progressMetric: m.id } })}
                className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 active:opacity-80 ${active ? 'border-brand-400 bg-brand-400/15' : 'border-white/10 bg-ink-700'}`}
              >
                <Icon name={m.icon} size={14} color={active ? brand[400] : 'rgba(255,255,255,0.5)'} />
                <Text className={`text-xs font-semibold ${active ? 'text-brand-400' : 'text-white/60'}`}>{m.label}</Text>
              </Pressable>
            )
          })}
        </ScrollView>

        {cd.points.length >= 2 ? (
          <MetricChart points={cd.points} domain={cd.domain} grid={colors.grid} tick={colors.tick} />
        ) : (
          <View className="h-40 w-full items-center justify-center">
            <Text className="text-sm font-semibold text-white/55">Not enough data yet</Text>
            <Text className="mt-1 text-[12px] text-white/35">Log a few more to see this trend.</Text>
          </View>
        )}

        {/* Goal progress bar (body weight only) */}
        {cd.isWeight && (
          <View className="mt-3 border-t border-white/5 pt-3.5">
            <View className="mb-2 flex-row items-end justify-between">
              <View>
                <Text className="text-[12px] text-white/40">Start</Text>
                <Text className="text-[12px] font-bold text-white">{fmtWeightNum(w.start, units, 1)}</Text>
              </View>
              <View className="items-center">
                <Text className="text-[12px] text-white/40">Current</Text>
                <Text className="text-[12px] font-bold text-brand-400">{fmtWeightNum(w.current, units, 1)}</Text>
              </View>
              <View className="items-end">
                <Text className="text-[12px] text-white/40">Target</Text>
                <Text className="text-[12px] font-bold text-white">{fmtWeightNum(goalKg, units, 1)}</Text>
              </View>
            </View>
            <ProgressBar value={goalPct} height={8} />
            <View className="mt-2.5 flex-row items-center justify-between">
              <Text className="text-[12px] text-white/50">{reachedGoal ? 'Target reached' : `${fmtWeight(toGo, units, 1)} to go`}</Text>
              <Pressable onPress={() => nav.open('logWeight')} className="flex-row items-center gap-1 rounded-lg bg-brand-400/15 px-3 py-1.5 active:opacity-80">
                <Plus size={13} color={brand[400]} />
                <Text className="text-xs font-bold text-brand-400">Add weight</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* ---------------- Snapshot tiles ---------------- */}
      <View className="mt-3 flex-row flex-wrap gap-3">
        {tiles.map((t) => (
          <View key={t.label} className="card p-4" style={{ width: '47.5%' }}>
            <View className="mb-2 flex-row items-center gap-1.5">
              <Icon name={t.icon} size={15} color={brand[400]} />
              <Text className="text-[12.5px] font-medium text-white/60">{t.label}</Text>
            </View>
            <Text className="text-2xl font-extrabold leading-none text-white">{t.value}</Text>
            <Text className="mt-1.5 text-[11.5px] text-white/40">{t.sub}</Text>
          </View>
        ))}
      </View>

      {/* ---------------- Last 7 days: steps weekly bars + ring ---------------- */}
      <SectionHeader title="Last 7 days" />
      <View className="card p-4">
        <View className="flex-row items-start justify-between">
          <View>
            <Text className="text-[13px] font-medium text-white/60">Daily steps</Text>
            <Text className="text-[12px] text-white/40">Goal {p.stepTarget.toLocaleString()} / day</Text>
          </View>
          <ProgressRing value={(daysHit / 7) * 100} size={50} stroke={5} color={brand[400]}>
            <Text className="text-[12px] font-extrabold text-white">{daysHit}/7</Text>
          </ProgressRing>
        </View>

        <View className="relative mt-4 h-28 flex-row items-end justify-between gap-2">
          {/* goal reference line */}
          <View
            pointerEvents="none"
            className="absolute inset-x-0 border-t border-dashed border-white/15"
            style={{ bottom: `${stepGoalPct}%` }}
          />
          {week.map((d) => {
            const h = d.steps > 0 ? Math.max(6, (d.steps / maxStep) * 100) : 0
            return (
              <View key={d.k} className="h-full flex-1 flex-col items-center justify-end gap-1.5">
                <View className="relative w-full max-w-[18px] flex-1 flex-row items-end overflow-hidden rounded-full bg-white/[0.06]">
                  <View
                    className="w-full rounded-full"
                    style={{ height: `${h}%`, backgroundColor: d.hit ? brand[400] : 'rgba(255,255,255,0.28)' }}
                  />
                </View>
                <Text className={`text-[10px] ${d.today ? 'font-bold text-brand-400' : 'text-white/40'}`}>{d.label}</Text>
              </View>
            )
          })}
        </View>

        <View className="mt-3 flex-row items-center justify-between border-t border-white/5 pt-3">
          <Text className="text-[12.5px] text-white/50">Daily average</Text>
          <Text className="text-[12.5px] font-bold text-white">{avgSteps.toLocaleString()} steps</Text>
        </View>
      </View>

      {/* ---------------- Strength: ranked gain bars ---------------- */}
      {sp.length > 0 && (
        <>
          <SectionHeader title="Strength progress" />
          <View className="card gap-3.5 p-4">
            {sp.map((s) => (
              <View key={s.id} className="flex-row items-center gap-3">
                <Image source={{ uri: s.image }} resizeMode="cover" className="h-11 w-11 shrink-0 rounded-xl" />
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-baseline justify-between gap-2">
                    <Text numberOfLines={1} className="flex-1 text-[14px] font-bold leading-tight text-white">{s.name}</Text>
                    <Text className="shrink-0 text-[13px] font-bold text-brand-400">↑{s.pct}%</Text>
                  </View>
                  <View className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <View className="h-full rounded-full" style={{ width: `${(s.pct / maxPct) * 100}%`, backgroundColor: brand[400] }} />
                  </View>
                  <View className="mt-1 flex-row items-center gap-1.5">
                    <Text className="text-[11px] text-white/45">{fmtWeightNum(s.from, units, 0)}{weightUnit(units)}</Text>
                    <ArrowRight size={11} color="rgba(255,255,255,0.3)" />
                    <Text className="text-[11px] font-semibold text-white/70">{fmtWeightNum(s.to, units, 0)}{weightUnit(units)}</Text>
                    <Text className="ml-auto text-[11px] text-white/45">est. 1RM</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      {/* ---------------- Training volume: 8-week bars ---------------- */}
      <SectionHeader title="Training volume" />
      <View className="card p-4">
        <Text className="mb-2 text-[12px] text-white/45">Total weight lifted per week ({weightUnit(units)})</Text>
        <VolumeChart data={volWeeks} unit={weightUnit(units)} grid={colors.grid} tick={colors.tick} />
      </View>

      {/* ---------------- Consistency rings + streak ---------------- */}
      <SectionHeader title="Consistency" />
      <View className="flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-4">
        <View className="flex-1 flex-row justify-between">
          {rings.map((h) => (
            <View key={h.label} className="items-center">
              <ProgressRing value={h.pct} size={52} stroke={4} color={brand[400]}>
                <Text className="text-[12px] font-bold text-white">{h.value}</Text>
              </ProgressRing>
              <Text className="mt-1.5 text-[11px] font-semibold text-white">{h.label}</Text>
            </View>
          ))}
        </View>
        <View className="ml-1 items-center border-l border-white/10 pl-4">
          <Text className="text-[11px] text-white/45">Streak</Text>
          <View className="flex-row items-center justify-center gap-1">
            <Text className="text-2xl font-extrabold text-white">{streak.current}</Text>
            <Flame size={20} color={brand[400]} />
          </View>
          <Text className="text-[11px] text-white/40">Best: {streak.best}d</Text>
        </View>
      </View>

      {/* ---------------- Photos + recap ---------------- */}
      <Pressable onPress={() => nav.open('photos')} className="mt-4 w-full flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-4 active:opacity-90">
        <View className="h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-400/15">
          <Camera size={20} color={brand[400]} />
        </View>
        <View className="flex-1">
          <Text className="font-bold text-white">Progress photos</Text>
          <Text className="text-[13px] text-white/55">{state.photos.length} photos · see your transformation</Text>
        </View>
        <ArrowRight size={18} color="rgba(255,255,255,0.3)" />
      </Pressable>

      <Pressable onPress={() => nav.open('recap')} className="mt-4 w-full flex-row items-center gap-3 rounded-2xl border border-brand-400/20 bg-brand-400/10 p-4 active:opacity-90">
        <Trophy size={28} color={brand[400]} />
        <View className="flex-1">
          <Text className="font-bold text-white">You're in the top 20% of users</Text>
          <Text className="text-[13px] text-white/55">Keep showing up. The results will follow.</Text>
        </View>
        <View className="btn-primary px-4 py-2">
          <Text className="text-sm font-semibold text-black">Recap</Text>
        </View>
      </Pressable>
      <View className="h-2" />
    </View>
  )
}

/* ------------------------------------------------------------------ */
/*  MetricChart — area/line chart rebuilt with react-native-svg        */
/*  Renders whatever metric buildChartData returns (weight/lift/steps) */
/*  (replaces the Recharts <AreaChart>)                                */
/* ------------------------------------------------------------------ */
function MetricChart({
  points, domain, grid, tick,
}: {
  points: { date: string; value: number }[]
  domain?: [number, number]
  grid: string
  tick: string
}) {
  const { width: screenW } = useWindowDimensions()
  // Screen padding px-5 (20) each side, plus card padding p-4 (16) each side.
  const W = Math.max(1, screenW - 40 - 32)
  const H = 160 // h-40

  // Margins: room for Y tick labels on the left and X labels at the bottom.
  const ML = 40
  const MR = 6
  const MT = 10
  const MB = 22
  const plotW = Math.max(1, W - ML - MR)
  const plotH = Math.max(1, H - MT - MB)

  const vals = points.map((c) => c.value)
  const yMin = domain ? domain[0] : Math.floor(Math.min(...vals))
  const yMax = domain ? domain[1] : Math.ceil(Math.max(...vals))
  const span = yMax - yMin || 1
  const n = points.length

  const xFor = (i: number) => (n <= 1 ? ML + plotW / 2 : ML + (i / (n - 1)) * plotW)
  const yFor = (v: number) => MT + plotH - ((v - yMin) / span) * plotH

  // Y gridlines / ticks (4 segments), formatted like the web tickFormatter (1k etc.)
  const fmtTick = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${Math.round(v * 10) / 10}`)
  const yTicks = Array.from({ length: 5 }, (_, i) => yMin + (span * i) / 4)

  // Line + area paths
  const linePts = points.map((c, i) => `${xFor(i)},${yFor(c.value)}`)
  const linePath = linePts.length ? `M ${linePts.join(' L ')}` : ''
  const areaPath = linePts.length
    ? `M ${xFor(0)},${MT + plotH} L ${linePts.join(' L ')} L ${xFor(n - 1)},${MT + plotH} Z`
    : ''

  // X tick labels — first & last (preserveStartEnd) plus a middle one.
  const xLabelIdx = n <= 1 ? [0] : n === 2 ? [0, 1] : [0, Math.floor((n - 1) / 2), n - 1]

  return (
    <View className="h-40 w-full">
      <Svg width={W} height={H}>
        {/* horizontal gridlines + Y tick labels */}
        {yTicks.map((t, i) => {
          const y = yFor(t)
          return (
            <G key={`y${i}`}>
              <Line x1={ML} y1={y} x2={ML + plotW} y2={y} stroke={grid} strokeWidth={1} strokeDasharray="3 3" />
              <SvgText x={ML - 6} y={y + 3} fill={tick} fontSize={11} textAnchor="end">{fmtTick(t)}</SvgText>
            </G>
          )
        })}

        {/* area fill */}
        {areaPath ? <Path d={areaPath} fill={brand[400]} fillOpacity={0.18} /> : null}
        {/* line */}
        {linePath ? <Path d={linePath} fill="none" stroke={brand[400]} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" /> : null}
        {/* dots */}
        {points.map((c, i) => (
          <Circle key={`d${i}`} cx={xFor(i)} cy={yFor(c.value)} r={2} fill={brand[400]} />
        ))}

        {/* X tick labels */}
        {xLabelIdx.map((i) => (
          <SvgText
            key={`x${i}`}
            x={xFor(i)}
            y={H - 6}
            fill={tick}
            fontSize={11}
            textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
          >
            {points[i].date}
          </SvgText>
        ))}
      </Svg>
    </View>
  )
}

/* ------------------------------------------------------------------ */
/*  VolumeChart — bar chart rebuilt with react-native-svg              */
/*  (replaces the Recharts <BarChart>)                                 */
/* ------------------------------------------------------------------ */
function VolumeChart({
  data, unit, grid, tick,
}: {
  data: { label: string; volume: number }[]
  unit: string
  grid: string
  tick: string
}) {
  const { width: screenW } = useWindowDimensions()
  const W = Math.max(1, screenW - 40 - 32)
  const H = 160 // h-40

  const ML = 38
  const MR = 6
  const MT = 6
  const MB = 22
  const plotW = Math.max(1, W - ML - MR)
  const plotH = Math.max(1, H - MT - MB)

  const n = data.length
  const yMax = Math.max(1, ...data.map((d) => d.volume))

  // Y ticks (4 segments), formatted like the web tickFormatter (1k etc.)
  const fmtTick = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)
  const yTicks = Array.from({ length: 5 }, (_, i) => Math.round((yMax * i) / 4))

  const yFor = (v: number) => MT + plotH - (v / yMax) * plotH
  const slot = plotW / Math.max(1, n)
  const barW = Math.min(slot * 0.6, 28)

  if (n === 0) {
    return (
      <View className="h-40 w-full items-center justify-center">
        <Text className="text-[12px] text-white/40">No volume data yet</Text>
      </View>
    )
  }

  return (
    <View className="h-40 w-full">
      <Svg width={W} height={H}>
        {/* horizontal gridlines + Y tick labels */}
        {yTicks.map((t, i) => {
          const y = yFor(t)
          return (
            <G key={`y${i}`}>
              <Line x1={ML} y1={y} x2={ML + plotW} y2={y} stroke={grid} strokeWidth={1} strokeDasharray="3 3" />
              <SvgText x={ML - 6} y={y + 3} fill={tick} fontSize={11} textAnchor="end">{fmtTick(t)}</SvgText>
            </G>
          )
        })}

        {/* bars + X tick labels */}
        {data.map((d, i) => {
          const cx = ML + slot * i + slot / 2
          const y = yFor(d.volume)
          const h = MT + plotH - y
          return (
            <G key={`b${i}`}>
              <Rect x={cx - barW / 2} y={y} width={barW} height={Math.max(0, h)} rx={4} fill={brand[400]} />
              <SvgText x={cx} y={H - 6} fill={tick} fontSize={11} textAnchor="middle">{d.label}</SvgText>
            </G>
          )
        })}
      </Svg>
    </View>
  )
}
