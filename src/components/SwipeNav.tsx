import { useState, type ReactNode } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated'
import { Menu, MessageCircle } from 'lucide-react-native'
import { useColors } from '../theme'
import { useT } from '../lib/useT'
import { useHorizontalSwipe, SWIPE_COMMIT_RATIO } from '../lib/useHorizontalSwipe'
import { IS_WEB, WEB_SCREEN } from './WebFrame'

/**
 * Wraps the dashboard so a horizontal swipe reveals the adjacent surface:
 *   • drag left → right  → the side menu
 *   • drag right → left  → the coach chat (only when `onOpenCoach` is provided)
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
  coachLabel = 'Coach',
}: {
  children: ReactNode
  onOpenMenu: () => void
  /** Optional: when omitted, the swipe-to-coach side is disabled and its affordance hidden. */
  onOpenCoach?: () => void
  /** The user's chosen coach name (or "Coach"), shown on the swipe-to-coach affordance. */
  coachLabel?: string
}) {
  const colors = useColors()
  const t = useT()
  const [width, setWidth] = useState(IS_WEB ? WEB_SCREEN.width : 0)
  const { gesture, dragX } = useHorizontalSwipe({
    width: width || 402,
    onSwipeRight: onOpenMenu,
    onSwipeLeft: onOpenCoach,
  })

  const commit = (width || 402) * SWIPE_COMMIT_RATIO
  // Left pill fades / slides in as the content is pulled right.
  const leftStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dragX.value, [0, commit], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateX: interpolate(dragX.value, [0, commit], [-28, 0], Extrapolation.CLAMP) },
      { scale: interpolate(dragX.value, [0, commit], [0.85, 1], Extrapolation.CLAMP) },
    ],
  }))
  // Right pill mirrors it for a leftward drag.
  const rightStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dragX.value, [-commit, 0], [1, 0], Extrapolation.CLAMP),
    transform: [
      { translateX: interpolate(dragX.value, [-commit, 0], [0, 28], Extrapolation.CLAMP) },
      { scale: interpolate(dragX.value, [-commit, 0], [1, 0.85], Extrapolation.CLAMP) },
    ],
  }))
  const contentStyle = useAnimatedStyle(() => ({ transform: [{ translateX: dragX.value }] }))

  return (
    <View style={{ flex: 1 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {/* Edge affordances sit behind the content and are revealed as it slides. */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { justifyContent: 'center' }]}>
        <Animated.View
          style={[styles.pill, { left: 14, backgroundColor: colors.ink700 }, leftStyle]}
        >
          <Menu size={18} color={colors.brand400} />
          <Text style={[styles.pillText, { color: colors.fg }]}>{t('Menu')}</Text>
        </Animated.View>
        {onOpenCoach && (
          <Animated.View
            style={[styles.pill, { right: 14, backgroundColor: colors.ink700 }, rightStyle]}
          >
            <MessageCircle size={18} color={colors.brand400} />
            <Text style={[styles.pillText, { color: colors.fg }]} numberOfLines={1}>{coachLabel}</Text>
          </Animated.View>
        )}
      </View>

      <GestureDetector gesture={gesture}>
        <Animated.View style={[{ flex: 1 }, contentStyle]}>{children}</Animated.View>
      </GestureDetector>
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
