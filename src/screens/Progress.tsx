import { useState } from 'react'
import { View, Text, Pressable, Image, useWindowDimensions } from 'react-native'
import { SlidersHorizontal, ChevronDown, ArrowRight, Trophy, Flame, Plus, Camera } from 'lucide-react-native'
import { default as Svg, Path, Line, Circle, Rect, G, Text as SvgText } from 'react-native-svg'
import { Icon } from '../components/Icon'
import { ProgressRing, ScreenHeader, SectionHeader } from '../components/ui'
import { useStore } from '../store/store'
import { useNav } from '../nav'
import { dayKey, shortDate } from '../lib/date'
import { fmtWeight, fmtWeightNum, weightUnit, weightVal } from '../lib/format'
import { exById } from '../data/catalog'
import {
  weightStats, strengthProgress, habitConsistencyWeek, streakStats,
  workoutsInRange, nutritionForDay, volumeByWeek, bestLiftId, oneRMSeries,
} from '../store/selectors'
import { brand, useColors } from '../theme'

export default function Progress() {
  const { state } = useStore()
  const nav = useNav()
  const colors = useColors()
  const units = state.settings.units
  const [range, setRange] = useState<'4 Weeks' | '12 Weeks'>('4 Weeks')

  const w = weightStats(state)
  const sp = strengthProgress(state)
  const strengthAvg = sp.length ? Math.round(sp.reduce((a, s) => a + s.pct, 0) / sp.length) : 0
  const hc = habitConsistencyWeek(state)
  const streak = streakStats(state)
  const workouts4w = workoutsInRange(state, 28)

  // avg calories over last 28 days
  const calDays = Array.from({ length: 28 }, (_, d) => nutritionForDay(state, dayKey(d)).kcal).filter((x) => x > 0)
  const avgCals = calDays.length ? Math.round(calDays.reduce((a, b) => a + b, 0) / calDays.length) : 0

  const days = range === '4 Weeks' ? 28 : 84
  const cutoff = dayKey(days)
  const chart = w.series.filter((p) => p.dateKey >= cutoff).map((p) => ({ date: shortDate(p.dateKey), weight: Math.round(weightVal(p.kg, units) * 10) / 10 }))
  const vals = chart.map((c) => c.weight)
  const yMin = Math.floor(Math.min(...vals) - 1)
  const yMax = Math.ceil(Math.max(...vals) + 1)

  const volWeeks = volumeByWeek(state, 8).map((v) => ({ label: v.label, volume: Math.round(weightVal(v.volume, units)) }))
  const liftId = bestLiftId(state)
  const strengthSeries = liftId ? oneRMSeries(state, liftId).map((p) => ({ date: shortDate(p.dateKey), kg: Math.round(weightVal(p.kg, units)) })) : []
  const liftName = liftId ? exById(liftId)?.name ?? 'Strength' : ''

  const cards = [
    { icon: 'scale', label: 'Weight', value: fmtWeightNum(w.current, units), unit: weightUnit(units), delta: `${w.delta <= 0 ? '↓' : '↑'} ${fmtWeight(Math.abs(w.delta), units, 1)}`, color: '#7ED957', onClick: () => nav.open('logWeight') },
    { icon: 'trending', label: 'Strength', value: `+${strengthAvg}%`, unit: '', delta: '↑ 4 wks', color: '#9AA0A6' },
    { icon: 'footprints', label: 'Workouts', value: String(workouts4w), unit: '', delta: 'last 4 wks', color: '#9AA0A6' },
    { icon: 'flame', label: 'Calories', value: avgCals.toLocaleString(), unit: '', delta: 'avg / day', color: '#9AA0A6' },
  ]

  const habitRings = [
    { label: 'Workouts', value: `${hc.workouts}/${hc.total}`, sub: 'This week', pct: hc.total ? (hc.workouts / hc.total) * 100 : 0, color: '#7ED957' },
    { label: 'Steps', value: `${hc.steps}/${hc.total}`, sub: `Avg ${hc.avgSteps.toLocaleString()}`, pct: hc.total ? (hc.steps / hc.total) * 100 : 0, color: '#7ED957' },
    { label: 'Sleep', value: `${hc.sleep}/${hc.total}`, sub: `Avg ${hc.avgSleep.toFixed(1)}h`, pct: hc.total ? (hc.sleep / hc.total) * 100 : 0, color: '#7ED957' },
    { label: 'Nutrition', value: `${hc.nutrition}/${hc.total}`, sub: 'On Track', pct: hc.total ? (hc.nutrition / hc.total) * 100 : 0, color: '#7ED957' },
  ]

  return (
    <View className="px-5 pt-2">
      <ScreenHeader
        title="Progress"
        trailing={
          <Pressable onPress={() => nav.open('recap')} className="h-10 w-10 items-center justify-center rounded-xl active:opacity-70">
            <SlidersHorizontal size={22} color={brand[400]} />
          </Pressable>
        }
      />

      <View className="overflow-hidden rounded-2xl border border-white/5">
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=800&q=70' }}
          resizeMode="cover"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}
        />
        <View className="p-5">
          <Text className="max-w-[260px] text-xl font-extrabold leading-tight text-white">
            Discipline today, <Text className="text-brand-400">freedom</Text> tomorrow.
          </Text>
          <Text className="mt-2 max-w-[230px] text-[13px] leading-snug text-white/60">
            You don't rise to the level of your goals, you fall to the level of your systems.
          </Text>
          <View className="mt-3 h-0.5 w-10 rounded-full bg-brand-400" />
        </View>
      </View>

      <SectionHeader title="Overview" />
      <View className="flex-row flex-wrap gap-3">
        {cards.map((c) => (
          <Pressable key={c.label} onPress={c.onClick} className="card p-4 active:opacity-90" style={{ width: '47.5%' }}>
            <View className="mb-2 flex-row items-center gap-1.5">
              <Icon name={c.icon} size={16} color={c.color} />
              <Text className="text-[13px] font-medium text-white/60">{c.label}</Text>
            </View>
            <View className="flex-row items-baseline gap-1">
              <Text className="text-2xl font-extrabold text-white">{c.value}</Text>
              {c.unit ? <Text className="text-sm text-white/50">{c.unit}</Text> : null}
            </View>
            <Text className="mt-1 text-[12px] font-semibold text-brand-400">{c.delta}</Text>
          </Pressable>
        ))}
      </View>

      {/* Weight Trend */}
      <View className="mt-6 rounded-2xl border border-white/5 bg-ink-800 p-4">
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="section-title">Weight Trend</Text>
          <View className="flex-row items-center gap-2">
            <Pressable onPress={() => nav.open('logWeight')} className="flex-row items-center gap-1 rounded-lg bg-brand-400/15 px-2.5 py-1 active:opacity-80">
              <Plus size={13} color={brand[400]} />
              <Text className="text-xs font-semibold text-brand-400">Log</Text>
            </Pressable>
            <Pressable onPress={() => setRange((r) => (r === '4 Weeks' ? '12 Weeks' : '4 Weeks'))} className="flex-row items-center gap-1 rounded-lg border border-white/10 bg-ink-700 px-2.5 py-1 active:opacity-80">
              <Text className="text-xs font-semibold text-white/70">{range}</Text>
              <ChevronDown size={14} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </View>
        </View>
        <WeightChart chart={chart} yMin={yMin} yMax={yMax} grid={colors.grid} tick={colors.tick} />
      </View>

      {/* Training volume */}
      <View className="mt-4 rounded-2xl border border-white/5 bg-ink-800 p-4">
        <Text className="section-title mb-2">Training volume</Text>
        <Text className="mb-2 text-[12px] text-white/45">Total weight lifted per week ({weightUnit(units)})</Text>
        <VolumeChart data={volWeeks} unit={weightUnit(units)} grid={colors.grid} tick={colors.tick} />
      </View>

      {/* Strength over time */}
      {strengthSeries.length >= 2 && (
        <View className="mt-4 rounded-2xl border border-white/5 bg-ink-800 p-4">
          <Text className="section-title mb-2">Strength over time</Text>
          <Text className="mb-2 text-[12px] text-white/45">{liftName} · estimated 1RM ({weightUnit(units)})</Text>
          <StrengthChart data={strengthSeries} grid={colors.grid} tick={colors.tick} />
        </View>
      )}

      {/* Strength Progress */}
      <SectionHeader title="Strength Progress" />
      <View className="gap-3 rounded-2xl border border-white/5 bg-ink-800 p-3">
        {sp.map((s) => (
          <View key={s.id} className="flex-row items-center gap-3">
            <Image source={{ uri: s.image }} resizeMode="cover" className="h-11 w-11 rounded-xl" />
            <View className="min-w-0 flex-1">
              <Text numberOfLines={1} className="font-bold leading-tight text-white">{s.name}</Text>
              <Text className="text-[12px] text-white/40">est. 1RM</Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <View className="items-end">
                <Text className="text-sm text-white/50">{fmtWeightNum(s.from, units, 0)}</Text>
                <Text className="text-[10px] text-white/35">4 wks ago</Text>
              </View>
              <ArrowRight size={14} color="rgba(255,255,255,0.3)" />
              <View className="items-end">
                <Text className="text-sm font-bold text-brand-400">{fmtWeightNum(s.to, units, 0)}</Text>
                <Text className="text-[10px] text-white/35">Today</Text>
              </View>
            </View>
            <Text className="ml-1 text-sm font-semibold text-brand-400">↑{s.pct}%</Text>
          </View>
        ))}
      </View>

      {/* Habit Consistency */}
      <SectionHeader title="Habit Consistency" />
      <View className="flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-4">
        <View className="flex-1 flex-row justify-between">
          {habitRings.map((h) => (
            <View key={h.label} className="items-center">
              <ProgressRing value={h.pct} size={52} stroke={4} color={h.color}>
                <Text className="text-[12px] font-bold text-white">{h.value}</Text>
              </ProgressRing>
              <Text className="mt-1.5 text-[11px] font-semibold text-white">{h.label}</Text>
              <Text className="text-[10px] text-white/40">{h.sub}</Text>
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

      {/* Progress photos */}
      <Pressable onPress={() => nav.open('photos')} className="mt-4 w-full flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-4 active:opacity-90">
        <View className="h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-400/15">
          <Camera size={20} color={brand[400]} />
        </View>
        <View className="flex-1">
          <Text className="font-bold text-white">Progress photos</Text>
          <Text className="text-[13px] text-white/55">{state.photos.length} photos · see your transformation</Text>
        </View>
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
/*  WeightChart — area/line chart rebuilt with react-native-svg        */
/*  (replaces the Recharts <AreaChart>)                                */
/* ------------------------------------------------------------------ */
function WeightChart({
  chart, yMin, yMax, grid, tick,
}: {
  chart: { date: string; weight: number }[]
  yMin: number
  yMax: number
  grid: string
  tick: string
}) {
  const { width: screenW } = useWindowDimensions()
  // Screen padding px-5 (20) each side, plus card padding p-4 (16) each side.
  const W = Math.max(1, screenW - 40 - 32)
  const H = 176 // h-44

  // Margins: room for Y tick labels on the left and X labels at the bottom.
  const ML = 34
  const MR = 6
  const MT = 10
  const MB = 22
  const plotW = Math.max(1, W - ML - MR)
  const plotH = Math.max(1, H - MT - MB)

  const span = yMax - yMin || 1
  const n = chart.length

  const xFor = (i: number) => (n <= 1 ? ML + plotW / 2 : ML + (i / (n - 1)) * plotW)
  const yFor = (v: number) => MT + plotH - ((v - yMin) / span) * plotH

  // Y gridlines / ticks (4 segments)
  const yTicks = Array.from({ length: 5 }, (_, i) => Math.round((yMin + (span * i) / 4) * 10) / 10)

  // Line + area paths
  const linePts = chart.map((c, i) => `${xFor(i)},${yFor(c.weight)}`)
  const linePath = linePts.length ? `M ${linePts.join(' L ')}` : ''
  const areaPath = linePts.length
    ? `M ${xFor(0)},${MT + plotH} L ${linePts.join(' L ')} L ${xFor(n - 1)},${MT + plotH} Z`
    : ''

  // X tick labels — first & last (preserveStartEnd) plus a middle one.
  const xLabelIdx = n <= 1 ? [0] : n === 2 ? [0, 1] : [0, Math.floor((n - 1) / 2), n - 1]

  if (n === 0) {
    return (
      <View className="h-44 w-full items-center justify-center">
        <Text className="text-[12px] text-white/40">No weight data yet</Text>
      </View>
    )
  }

  return (
    <View className="h-44 w-full">
      <Svg width={W} height={H}>
        {/* horizontal gridlines + Y tick labels */}
        {yTicks.map((t, i) => {
          const y = yFor(t)
          return (
            <G key={`y${i}`}>
              <Line x1={ML} y1={y} x2={ML + plotW} y2={y} stroke={grid} strokeWidth={1} strokeDasharray="3 3" />
              <SvgText x={ML - 6} y={y + 3} fill={tick} fontSize={11} textAnchor="end">{String(t)}</SvgText>
            </G>
          )
        })}

        {/* area fill */}
        {areaPath ? <Path d={areaPath} fill={brand[400]} fillOpacity={0.18} /> : null}
        {/* line */}
        {linePath ? <Path d={linePath} fill="none" stroke={brand[400]} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" /> : null}
        {/* dots */}
        {chart.map((c, i) => (
          <Circle key={`d${i}`} cx={xFor(i)} cy={yFor(c.weight)} r={2} fill={brand[400]} />
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
            {chart[i].date}
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

/* ------------------------------------------------------------------ */
/*  StrengthChart — line chart rebuilt with react-native-svg           */
/*  (replaces the Recharts <LineChart>)                                */
/* ------------------------------------------------------------------ */
function StrengthChart({
  data, grid, tick,
}: {
  data: { date: string; kg: number }[]
  grid: string
  tick: string
}) {
  const { width: screenW } = useWindowDimensions()
  const W = Math.max(1, screenW - 40 - 32)
  const H = 160 // h-40

  const ML = 34
  const MR = 8
  const MT = 6
  const MB = 22
  const plotW = Math.max(1, W - ML - MR)
  const plotH = Math.max(1, H - MT - MB)

  const n = data.length
  const vals = data.map((d) => d.kg)
  // Matches the web domain ['dataMin - 5', 'dataMax + 5'].
  const yMin = Math.min(...vals) - 5
  const yMax = Math.max(...vals) + 5
  const span = yMax - yMin || 1

  const yTicks = Array.from({ length: 5 }, (_, i) => Math.round(yMin + (span * i) / 4))

  const xFor = (i: number) => (n <= 1 ? ML + plotW / 2 : ML + (i / (n - 1)) * plotW)
  const yFor = (v: number) => MT + plotH - ((v - yMin) / span) * plotH

  const linePts = data.map((d, i) => `${xFor(i)},${yFor(d.kg)}`)
  const linePath = linePts.length ? `M ${linePts.join(' L ')}` : ''

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
              <SvgText x={ML - 6} y={y + 3} fill={tick} fontSize={11} textAnchor="end">{String(t)}</SvgText>
            </G>
          )
        })}

        {/* line */}
        {linePath ? <Path d={linePath} fill="none" stroke={brand[400]} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" /> : null}
        {/* dots */}
        {data.map((d, i) => (
          <Circle key={`d${i}`} cx={xFor(i)} cy={yFor(d.kg)} r={2} fill={brand[400]} />
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
            {data[i].date}
          </SvgText>
        ))}
      </Svg>
    </View>
  )
}
