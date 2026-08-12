import { useMemo, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { SectionHeader } from './ui'
import { useStore } from '../store/store'
import { dashboardTrackedIds, dashboardLiftPeriod, progressTrackedLifts } from '../lib/metrics'
import { exById } from '../data/catalog'
import { weightUnit } from '../lib/format'
import { useColors } from '../theme'

const RANGE_LABEL: Record<string, string> = {
  '7 days': '7 Days', '4 weeks': '4 Weeks', '3 months': '3 Months', '6 months': '6 Months',
}

/**
 * Training progress — the tracked lifts ranked by gain, with a growth bar and
 * from → now per lift. Mirrors the Progress screen's "Training progress" card,
 * but reads its OWN settings (`dashboardTrackedIds` / `dashboardLiftPeriod`),
 * configured from the dashboard Customise sheet independently of Progress.
 * When no tracked lift has logged history yet it shows an empty state listing
 * the tracked lifts, so the card is always visible on the dashboard.
 */
export function TrainingProgressCard() {
  const { state } = useStore()
  const colors = useColors()
  const units = state.settings.units

  const trackedIds = dashboardTrackedIds(state)
  const liftPeriod = dashboardLiftPeriod(state)
  const lifts = useMemo(() => progressTrackedLifts(state, trackedIds, liftPeriod, units), [state, trackedIds, liftPeriod, units])
  const maxGain = Math.max(1, ...lifts.map((l) => l.gainPct))

  const [expanded, setExpanded] = useState(false)
  const hasToggle = lifts.length > 4
  const shown = !hasToggle || expanded ? lifts : lifts.slice(0, 4)

  // Empty state — lifts are tracked but none have logged sets to trend yet. Show
  // the tracked lifts with a prompt rather than hiding the card entirely.
  if (lifts.length === 0) {
    const names = trackedIds.map((id) => exById(id)?.name ?? id)
    if (names.length === 0) return null
    return (
      <>
        <SectionHeader title="Training progress" />
        <Text className="-mt-2 mb-3.5 text-[12.5px] text-secondary">Your tracked lifts · Last {RANGE_LABEL[liftPeriod]}</Text>
        <View className="rounded-3xl border border-white/5 bg-ink-800 px-[18px] pb-4 pt-1">
          {names.map((name, i) => (
            <View key={i} className="flex-row items-center justify-between" style={{ paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: `${colors.fg}12` }}>
              <Text numberOfLines={1} className="flex-1 text-[14.5px] font-bold text-white">{name}</Text>
              <Text className="ml-2 text-[12px] font-semibold text-tertiary">No data yet</Text>
            </View>
          ))}
          <Text className="mt-3 text-[11.5px] leading-4 text-tertiary">
            Log a workout with these lifts and your strength gains will rank here.
          </Text>
        </View>
      </>
    )
  }

  return (
    <>
      <SectionHeader title="Training progress" />
      <Text className="-mt-2 mb-3.5 text-[12.5px] text-secondary">Sorted by gain · Last {RANGE_LABEL[liftPeriod]}</Text>
      <View className="rounded-3xl border border-white/5 bg-ink-800 px-[18px] pb-3.5 pt-1">
        {shown.map((l, i) => (
          <View key={l.id} style={{ paddingVertical: 13, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: `${colors.fg}12` }}>
            <View className="flex-row items-center gap-2.5">
              <Text className="w-5 text-[12px] font-extrabold text-tertiary">{i + 1}</Text>
              <Text numberOfLines={1} className="flex-1 text-[14.5px] font-bold text-white">{l.name}</Text>
              <Text className="text-[14px] font-extrabold text-brand-400">+{l.gainPct}%</Text>
            </View>
            <View className="ml-[30px] mt-2.5 h-2.5 overflow-hidden rounded-full bg-white/10">
              <View className="h-full rounded-full" style={{ width: `${Math.round((l.gainPct / maxGain) * 100)}%`, backgroundColor: colors.brand400 }} />
            </View>
            <Text className="ml-[30px] mt-1.5 text-[11.5px] text-secondary">{l.from} {weightUnit(units)} → {l.now} {weightUnit(units)}</Text>
          </View>
        ))}
        {hasToggle && (
          <Pressable onPress={() => setExpanded((v) => !v)} className="mt-1.5 items-center border-t border-white/[0.07] pt-4 active:opacity-70">
            <Text className="text-[13px] font-bold text-brand-400">{expanded ? 'Show less' : `Show ${lifts.length - 4} more`}</Text>
          </Pressable>
        )}
      </View>
    </>
  )
}
