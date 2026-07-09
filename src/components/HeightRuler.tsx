import { useMemo, useRef } from 'react'
import { View, Text, PanResponder } from 'react-native'
import { useColors } from '../theme'
import { tick } from '../lib/haptics'

const PX_PER_UNIT = 7
const HEIGHT = 240

/**
 * Vertical measuring-tape control. Drag up/down anywhere on the ruler to set a
 * value (e.g. height in cm); the tape slides under a fixed centre indicator and
 * the phone ticks as each unit passes — like sliding a real stadiometer.
 */
export function HeightRuler({
  value,
  onChange,
  min = 140,
  max = 210,
  unit = 'cm',
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  unit?: string
}) {
  const colors = useColors()
  const startValue = useRef(value)
  const valueRef = useRef(value)
  valueRef.current = value

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          startValue.current = valueRef.current
        },
        onPanResponderMove: (_e, g) => {
          // Dragging down moves the tape down = smaller height; up = taller.
          const next = Math.max(min, Math.min(max, Math.round(startValue.current + g.dy / PX_PER_UNIT)))
          if (next !== valueRef.current) {
            onChange(next)
            tick()
          }
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [min, max],
  )

  const center = HEIGHT / 2
  const marks: { v: number; y: number; major: boolean }[] = []
  for (let v = min; v <= max; v++) {
    const y = center - (v - value) * PX_PER_UNIT
    if (y < -12 || y > HEIGHT + 12) continue
    marks.push({ v, y, major: v % 5 === 0 })
  }

  return (
    <View className="flex-row items-center justify-center gap-5">
      {/* live readout */}
      <View className="items-end">
        <Text className="text-5xl font-extrabold tracking-tight text-white">
          {value}
          <Text className="text-xl font-bold text-white/40"> {unit}</Text>
        </Text>
        <Text className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-brand-400">drag the ruler</Text>
      </View>

      {/* the tape */}
      <View
        {...pan.panHandlers}
        className="overflow-hidden rounded-2xl border border-white/10 bg-ink-800"
        style={{ width: 96, height: HEIGHT }}
      >
        {marks.map(({ v, y, major }) => (
          <View key={v} style={{ position: 'absolute', top: y, right: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {major && <Text className="text-[11px] font-semibold text-white/40">{v}</Text>}
            <View
              style={{
                width: major ? 30 : 16,
                height: major ? 2 : 1,
                backgroundColor: major ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.14)',
              }}
            />
          </View>
        ))}
        {/* fixed centre indicator */}
        <View style={{ position: 'absolute', top: center - 1.5, left: 0, right: 0, height: 3, backgroundColor: colors.brand400 }} />
        <View
          style={{
            position: 'absolute', top: center - 5, right: -2, width: 10, height: 10,
            borderRadius: 5, backgroundColor: colors.brand400,
          }}
        />
      </View>
    </View>
  )
}
