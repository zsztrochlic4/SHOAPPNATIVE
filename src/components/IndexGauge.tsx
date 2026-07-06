import { useEffect, useRef } from 'react'
import { Animated, View, Text } from 'react-native'
import Svg, { Path, G, Polygon, Circle, Defs, LinearGradient, Stop } from 'react-native-svg'
import type { WeeklyIndex } from '../store/selectors'
import { useColors } from '../theme'

const AnimatedG = Animated.createAnimatedComponent(G)

/**
 * Compact semicircular performance gauge. The needle sits in the middle when
 * the user is on track, swings right when ahead and left when behind, and
 * animates from the far left up to the score on mount. Rebuilt from the web
 * SVG version with react-native-svg + Animated.
 */
export function IndexGauge({ index }: { index: WeeklyIndex }) {
  const colors = useColors()
  const W = 220, H = 116
  const cx = W / 2, cy = 104, r = 90, stroke = 13

  const bandColor: Record<WeeklyIndex['band'], string> = {
    off: colors.danger,
    behind: colors.accentOrange,
    ontrack: colors.brand500,
    ahead: colors.brand500,
    crushing: colors.brand500,
  }
  const color = bandColor[index.band]

  const segs = 48
  const pt = (t: number) => [cx + r * Math.cos(t), cy - r * Math.sin(t)] as const
  let d = ''
  for (let i = 0; i <= segs; i++) {
    const [x, y] = pt(Math.PI * (1 - i / segs))
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`
  }

  const targetDeg = ((Math.max(0, Math.min(100, index.score)) - 50) / 50) * 90
  const anim = useRef(new Animated.Value(-90)).current
  useEffect(() => {
    const a = Animated.timing(anim, { toValue: targetDeg, duration: 950, useNativeDriver: true })
    a.start()
    return () => a.stop()
  }, [targetDeg, anim])

  const rN = r - 16
  const baseW = 7

  return (
    <View className="items-center">
      <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ maxWidth: 228 }}>
        <Defs>
          <LinearGradient id="gaugeArc" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor={colors.danger} />
            <Stop offset="38%" stopColor={colors.accentOrange} />
            <Stop offset="62%" stopColor={colors.brand300} />
            <Stop offset="100%" stopColor={colors.brand400} />
          </LinearGradient>
        </Defs>
        <Path d={d} fill="none" stroke="rgba(130,130,130,0.18)" strokeWidth={stroke + 5} strokeLinecap="round" />
        <Path d={d} fill="none" stroke="url(#gaugeArc)" strokeWidth={stroke} strokeLinecap="round" />
        <AnimatedG
          originX={cx}
          originY={cy}
          rotation={anim as unknown as number}
        >
          <Polygon points={`${cx - baseW},${cy} ${cx},${cy - rN} ${cx + baseW},${cy}`} fill={colors.needle} />
        </AnimatedG>
        <Circle cx={cx} cy={cy} r={9} fill={colors.needle} />
        <Circle cx={cx} cy={cy} r={4} fill={colors.ink900} />
      </Svg>

      {/* readable anchors under the arc */}
      <View className="mt-1.5 w-full max-w-[236px] flex-row items-center justify-between">
        <Text className="text-[10px] font-bold uppercase tracking-wide text-white/45">Behind</Text>
        <Text className="text-[10px] font-bold uppercase tracking-wide text-white/45">Ahead</Text>
      </View>

      <Text className="mt-1.5 text-[18px] font-black tracking-tight" style={{ color }}>{index.label}</Text>
      <Text className="text-[12px] text-white/45">
        <Text className="font-bold" style={{ color }}>{index.score}</Text>/100 · last 14 days
      </Text>
    </View>
  )
}
