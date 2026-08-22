import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, Animated, Easing } from 'react-native'
import { IS_WEB } from './WebFrame'
import { useStore } from '../store/store'
import {
  progressFeatured, dashboardFeaturedId, dashboardTimeframe, STAT_TIMEFRAMES,
  type ProgressColor, type ProgressFeatured,
} from '../lib/metrics'
import type { StatTimeframe } from '../store/types'
import { useColors, type Palette } from '../theme'
import { useT } from '../lib/useT'

const RANGE_LABEL: Record<string, string> = {
  '7 days': '7 Days', '4 weeks': '4 Weeks', '3 months': '3 Months', '6 months': '6 Months',
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

/**
 * The featured composition card from the Progress screen, dropped onto the
 * Dashboard under "Progress overview". Which metric it shows — Eating quality,
 * Body weight, Water, Daily steps or Sleep — is chosen in the dashboard Customise
 * sheet (persisted via `settings.dashboardFeatured`). It owns its own timeframe
 * filter (the range pill) so cycling it here never disturbs the Progress screen.
 * Data is live from the same `progressFeatured` selector the Progress screen uses.
 */
export function FeaturedStatCard() {
  const { state } = useStore()
  const colors = useColors()
  const t = useT()
  const units = state.settings.units
  const metricId = dashboardFeaturedId(state)

  // Independent, self-contained filter. Seeds from the dashboard's saved window if
  // it's a real range, otherwise the 3-month default shown in the design.
  const [tf, setTf] = useState<StatTimeframe>(() => {
    const saved = dashboardTimeframe(state)
    return STAT_TIMEFRAMES.includes(saved) ? saved : '3 months'
  })

  const feat = useMemo(() => progressFeatured(state, metricId, tf, units), [state, metricId, tf, units])
  const deltaColor = feat.deltaGood ? colors.brand400 : `${colors.fg}80`

  function cycleTf() {
    const i = STAT_TIMEFRAMES.indexOf(tf)
    setTf(STAT_TIMEFRAMES[(i + 1) % STAT_TIMEFRAMES.length])
  }

  // The user chose "None" in Customise — hide the featured card entirely.
  if (metricId === 'none') return null

  return (
    <View className="rounded-3xl border border-white/5 bg-ink-800 px-4 py-3.5">
      <View className="flex-row items-start justify-between gap-2.5">
        <View className="min-w-0 flex-1">
          <Text className="text-[13px] font-semibold text-secondary">{feat.title}</Text>
          <View className="mt-1 flex-row flex-wrap items-baseline gap-2">
            <View className="flex-row items-baseline">
              <Text className="text-[32px] font-extrabold leading-none text-white">{feat.value}</Text>
              <Text className="ml-1 text-[13px] font-semibold text-secondary">{feat.unit}</Text>
            </View>
            <Text className="text-[12px] font-bold" style={{ color: deltaColor }}>{feat.deltaText}</Text>
            <VerdictChip verdict={feat.verdict} colors={colors} />
          </View>
          <Text className="mt-1 text-[11px] text-tertiary">{feat.deltaNote}</Text>
        </View>
        <Pressable
          onPress={cycleTf}
          accessibilityRole="button"
          accessibilityLabel={`Change range, currently ${RANGE_LABEL[tf]}`}
          className="shrink-0 flex-row items-center rounded-[10px] border border-white/10 bg-ink-700 px-3 py-1.5 active:scale-95"
        >
          <Text className="text-[12px] font-bold text-white/75">{t(RANGE_LABEL[tf])}</Text>
        </Pressable>
      </View>

      {/* Composition bar */}
      <CompositionBar key={`${metricId}|${tf}`} segments={feat.segments} colors={colors} />

      {/* Segment legend */}
      <View className="mt-2.5 gap-2">
        {feat.segments.map((sgm, i) => (
          <View key={i} className="flex-row items-center gap-2.5">
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: sgm.dim ? `${colors.fg}38` : progColor(sgm.color, colors) }} />
            <Text className="flex-1 text-[13px] text-white/70">{sgm.label}</Text>
            <Text className="text-[13px] font-extrabold text-white">{sgm.valueLabel}</Text>
          </View>
        ))}
      </View>

      {/* Stats row */}
      <View className="mt-3 flex-row justify-between border-t border-white/[0.06] pt-3">
        {feat.stats.map((st, i) => (
          <View key={i} style={{ alignItems: st.align === 'left' ? 'flex-start' : st.align === 'right' ? 'flex-end' : 'center' }}>
            <Text className="text-[11px] text-tertiary">{st.label}</Text>
            <Text className="mt-0.5 text-[16px] font-extrabold" style={{ color: st.accent ? colors.brand400 : colors.fg }}>{st.value}</Text>
          </View>
        ))}
      </View>

      {/* Mini 7-day bars (steps / water / sleep) */}
      {feat.mini7 && (
        <View className="mt-3 border-t border-white/[0.06] pt-3">
          <Text className="mb-2 text-[11px] text-tertiary">{t('Last 7 days')}</Text>
          <View className="h-14 flex-row items-end gap-[7px]">
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
    </View>
  )
}

function VerdictChip({ verdict, colors }: { verdict: ProgressFeatured['verdict']; colors: Palette }) {
  const c = verdict.warn ? colors.accentOrange : colors.brand400
  return (
    <View style={{ paddingHorizontal: 9, paddingVertical: 2, borderRadius: 999, backgroundColor: `${c}26` }}>
      <Text style={{ fontSize: 10.5, fontWeight: '700', color: c }}>{verdict.label}</Text>
    </View>
  )
}

function CompositionBar({ segments, colors }: { segments: ProgressFeatured['segments']; colors: Palette }) {
  const grow = useRef(new Animated.Value(0)).current
  useEffect(() => {
    grow.setValue(0)
    Animated.timing(grow, { toValue: 1, duration: 700, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: !IS_WEB }).start()
  }, [grow])
  const shown = segments.filter((s) => s.pct > 0)
  return (
    <Animated.View
      style={{ marginTop: 14, height: 13, borderRadius: 999, overflow: 'hidden', flexDirection: 'row', gap: 2, transform: [{ scaleX: grow }], opacity: grow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }}
    >
      {shown.map((s, i) => (
        <View key={i} style={{ flex: s.pct, backgroundColor: s.dim ? `${colors.fg}24` : progColor(s.color, colors) }} />
      ))}
    </Animated.View>
  )
}
