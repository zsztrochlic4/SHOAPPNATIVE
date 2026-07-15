import { useEffect, useRef } from 'react'
import { Animated, Easing, View, type DimensionValue } from 'react-native'
import { IS_WEB } from './WebFrame'

/**
 * A single shimmering placeholder block. Loading states use these arranged to
 * match the real layout, so first paint reads as "almost ready" instead of a
 * lonely spinner. The shimmer is a slow opacity breathe — cheap, runs on the
 * native driver off-web, and stops cleanly on unmount.
 */
export function Skeleton({
  width = '100%',
  height = 14,
  radius = 8,
  style,
}: {
  width?: DimensionValue
  height?: number
  radius?: number
  style?: object
}) {
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: !IS_WEB }),
        Animated.timing(v, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: !IS_WEB }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [v])

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: 'rgba(255,255,255,0.08)', opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.9] }) },
        style,
      ]}
    />
  )
}

/** A tidy stack of skeleton lines — handy for card bodies and list rows. */
export function SkeletonLines({ count = 3, gap = 8 }: { count?: number; gap?: number }) {
  return (
    <View style={{ gap }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height={12} width={i === count - 1 ? '60%' : '100%'} />
      ))}
    </View>
  )
}
