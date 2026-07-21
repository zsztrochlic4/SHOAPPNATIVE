import { useState, type ReactNode } from 'react'
import { View, Text, Animated, StyleSheet } from 'react-native'
import { Menu, MessageCircle } from 'lucide-react-native'
import { useColors } from '../theme'
import { useHorizontalSwipe } from '../lib/useHorizontalSwipe'
import { IS_WEB, WEB_SCREEN } from './WebFrame'

/**
 * Wraps the dashboard so a horizontal swipe reveals the adjacent surface:
 *   • drag left → right  → the side menu
 *   • drag right → left  → the coach chat
 *
 * The content tracks the finger (`dragX`) and an edge affordance grows in from
 * the revealed side, so the gesture is discoverable and reads as direct
 * manipulation. On commit the real menu / coach surface opens and covers the
 * spring-back. See [[useHorizontalSwipe]] for the thresholds and haptics.
 */
export function SwipeNav({
  children,
  onOpenMenu,
  onOpenCoach,
}: {
  children: ReactNode
  onOpenMenu: () => void
  onOpenCoach: () => void
}) {
  const colors = useColors()
  const [width, setWidth] = useState(IS_WEB ? WEB_SCREEN.width : 0)
  const { panHandlers, dragX } = useHorizontalSwipe({
    width: width || 402,
    onSwipeRight: onOpenMenu,
    onSwipeLeft: onOpenCoach,
  })

  const commit = (width || 402) * 0.32
  // Left pill fades / slides in as the content is pulled right.
  const leftOpacity = dragX.interpolate({ inputRange: [0, commit], outputRange: [0, 1], extrapolate: 'clamp' })
  const leftShift = dragX.interpolate({ inputRange: [0, commit], outputRange: [-28, 0], extrapolate: 'clamp' })
  const leftScale = dragX.interpolate({ inputRange: [0, commit], outputRange: [0.85, 1], extrapolate: 'clamp' })
  // Right pill mirrors it for a leftward drag.
  const rightOpacity = dragX.interpolate({ inputRange: [-commit, 0], outputRange: [1, 0], extrapolate: 'clamp' })
  const rightShift = dragX.interpolate({ inputRange: [-commit, 0], outputRange: [0, 28], extrapolate: 'clamp' })
  const rightScale = dragX.interpolate({ inputRange: [-commit, 0], outputRange: [1, 0.85], extrapolate: 'clamp' })

  return (
    <View style={{ flex: 1 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {/* Edge affordances sit behind the content and are revealed as it slides. */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { justifyContent: 'center' }]}>
        <Animated.View
          style={[
            styles.pill,
            { left: 14, backgroundColor: colors.ink700, opacity: leftOpacity, transform: [{ translateX: leftShift }, { scale: leftScale }] },
          ]}
        >
          <Menu size={18} color={colors.brand400} />
          <Text style={[styles.pillText, { color: colors.fg }]}>Menu</Text>
        </Animated.View>
        <Animated.View
          style={[
            styles.pill,
            { right: 14, backgroundColor: colors.ink700, opacity: rightOpacity, transform: [{ translateX: rightShift }, { scale: rightScale }] },
          ]}
        >
          <MessageCircle size={18} color={colors.brand400} />
          <Text style={[styles.pillText, { color: colors.fg }]}>Coach</Text>
        </Animated.View>
      </View>

      <Animated.View style={{ flex: 1, transform: [{ translateX: dragX }] }} {...panHandlers}>
        {children}
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  pillText: { fontSize: 14, fontWeight: '700' },
})
