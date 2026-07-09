import { useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, PanResponder } from 'react-native'
import Svg, { Path, Circle, Line } from 'react-native-svg'
import { Minus, Plus } from 'lucide-react-native'
import { useColors } from '../theme'
import { tick } from '../lib/haptics'

/**
 * Semicircular "scale" dial. Drag the knob (or anywhere on the arc) left/right
 * to set a value; the phone gives a tiny haptic tick as the number changes, so
 * it feels like sliding a real weight scale. −/+ buttons allow fine adjustment.
 */
export function WeightDial({
  value,
  onChange,
  min = 40,
  max = 150,
  step = 0.5,
  unit = 'kg',
  label,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  unit?: string
  label?: string
}) {
  const colors = useColors()
  const [width, setWidth] = useState(0)
  const lastTicked = useRef(Math.round(value))
  // Keep the latest value in a ref so the PanResponder (created once) never
  // works from a stale closure.
  const valueRef = useRef(value)
  valueRef.current = value

  const W = width || 320
  const R = W / 2 - 26
  const cx = W / 2
  const cy = R + 30
  const H = cy + 14

  const frac = Math.max(0, Math.min(1, (value - min) / (max - min)))

  const pointAt = (t: number) => {
    const theta = Math.PI - t * Math.PI
    return { x: cx + R * Math.cos(theta), y: cy - R * Math.sin(theta) }
  }
  const knob = pointAt(frac)

  const setFromTouch = (x: number, y: number) => {
    const dx = x - cx
    const dy = cy - y
    let angle = Math.atan2(Math.max(dy, 0), dx) // 0 (right) .. π (left)
    angle = Math.max(0, Math.min(Math.PI, angle))
    const t = 1 - angle / Math.PI
    const raw = min + t * (max - min)
    const snapped = Math.round(raw / step) * step
    const next = Math.max(min, Math.min(max, Math.round(snapped * 10) / 10))
    if (next !== valueRef.current) {
      onChange(next)
      const whole = Math.round(next)
      if (whole !== lastTicked.current) {
        lastTicked.current = whole
        tick()
      }
    }
  }

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => setFromTouch(e.nativeEvent.locationX, e.nativeEvent.locationY),
        onPanResponderMove: (e) => setFromTouch(e.nativeEvent.locationX, e.nativeEvent.locationY),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [W],
  )

  const nudge = (d: number) => {
    const next = Math.max(min, Math.min(max, Math.round((valueRef.current + d) * 10) / 10))
    if (next !== valueRef.current) {
      onChange(next)
      tick()
    }
  }

  // Tick marks every 10 units, skipping the very ends so they don't collide
  // with the min/max labels.
  const ticks = useMemo(() => {
    const out: { t: number; major: boolean }[] = []
    for (let v = Math.ceil(min / 5) * 5; v <= max; v += 5) {
      out.push({ t: (v - min) / (max - min), major: v % 10 === 0 })
    }
    return out
  }, [min, max])

  const arcTo = (t: number) => {
    const p = pointAt(t)
    return `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${p.x.toFixed(2)} ${p.y.toFixed(2)}`
  }

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} className="items-center">
      {label && <Text className="mb-1 text-sm font-semibold text-white/70">{label}</Text>}
      <View {...pan.panHandlers} style={{ width: W, height: H }}>
        <Svg width={W} height={H}>
          {/* track + ticks */}
          <Path d={arcTo(1)} stroke={colors.ringTrack} strokeWidth={10} strokeLinecap="round" fill="none" />
          {ticks.map(({ t, major }, i) => {
            const outer = pointAt(t)
            const innerR = R - (major ? 16 : 10)
            const theta = Math.PI - t * Math.PI
            const inner = { x: cx + innerR * Math.cos(theta), y: cy - innerR * Math.sin(theta) }
            return (
              <Line
                key={i}
                x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y}
                stroke={major ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.12)'}
                strokeWidth={major ? 2 : 1}
              />
            )
          })}
          {/* progress + knob */}
          <Path d={arcTo(frac)} stroke={colors.brand400} strokeWidth={10} strokeLinecap="round" fill="none" />
          <Circle cx={knob.x} cy={knob.y} r={16} fill={colors.brand400} opacity={0.25} />
          <Circle cx={knob.x} cy={knob.y} r={10} fill={colors.brand400} stroke="#000" strokeWidth={2} />
        </Svg>
        {/* readout inside the arc */}
        <View style={{ position: 'absolute', left: 0, right: 0, top: cy - 74, alignItems: 'center' }} pointerEvents="none">
          <Text className="text-5xl font-extrabold tracking-tight text-white">
            {step < 1 ? value.toFixed(1).replace(/\.0$/, '') : Math.round(value)}
            <Text className="text-xl font-bold text-white/40"> {unit}</Text>
          </Text>
          <Text className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-brand-400">slide to adjust</Text>
        </View>
      </View>
      <View className="mt-1 w-full flex-row items-center justify-between px-1">
        <Text className="text-[11px] text-white/30">{min}</Text>
        <View className="flex-row gap-2">
          <Pressable onPress={() => nudge(-step)} hitSlop={8} className="h-9 w-9 items-center justify-center rounded-full bg-ink-700 active:opacity-80">
            <Minus size={16} color="rgba(255,255,255,0.8)" />
          </Pressable>
          <Pressable onPress={() => nudge(step)} hitSlop={8} className="h-9 w-9 items-center justify-center rounded-full bg-brand-400/20 active:opacity-80">
            <Plus size={16} color={colors.brand400} />
          </Pressable>
        </View>
        <Text className="text-[11px] text-white/30">{max}</Text>
      </View>
    </View>
  )
}
