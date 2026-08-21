import { useEffect, useRef } from 'react'
import { View, Text, Pressable, Animated, Platform } from 'react-native'
import Svg, { Path, Rect, Circle, G } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { TabKey } from '../App'
import { useColors } from '../theme'
import { withAlpha } from '../lib/color'
import { coachAvailable } from '../backend/coach/coachGate'

/** The items-row height (above the home-indicator region + safe-area inset). Exported so the Coach
 *  tab can reserve the right amount of space for its composer to sit directly above the nav. */
export const NAV_CONTENT_HEIGHT = 50
/** Height of the drawn home-indicator pill region, used when there's no OS safe-area inset. */
export const NAV_HOME_REGION = 19

type IconKey = 'dashboard' | 'workout' | 'coach' | 'nutrition' | 'community'

/**
 * The five nav icons, traced from the design's exact SVG paths (not lucide look-alikes) so the
 * diagonal dumbbell, 4-square dashboard, apple, two-people and speech-bubble Coach match 1:1.
 */
function NavIcon({ name, size, color }: { name: IconKey; size: number; color: string }) {
  const common = { fill: 'none', stroke: color, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (name) {
    case 'dashboard':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={1.9} {...common}>
          <Rect x="3.5" y="3.5" width="7" height="7" rx="1.8" />
          <Rect x="13.5" y="3.5" width="7" height="7" rx="1.8" />
          <Rect x="3.5" y="13.5" width="7" height="7" rx="1.8" />
          <Rect x="13.5" y="13.5" width="7" height="7" rx="1.8" />
        </Svg>
      )
    case 'workout':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={1.7} {...common}>
          <G transform="rotate(-45 12 12) scale(1.18) translate(-1.85 -1.85)">
            <Path d="M9 12h6" />
            <Rect x="6.6" y="7.8" width="2.6" height="8.4" rx="1.3" />
            <Rect x="14.8" y="7.8" width="2.6" height="8.4" rx="1.3" />
            <Rect x="3.9" y="9.4" width="2.4" height="5.2" rx="1.2" />
            <Rect x="17.7" y="9.4" width="2.4" height="5.2" rx="1.2" />
          </G>
        </Svg>
      )
    case 'coach':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={2.2} {...common}>
          <Path d="M4 12a8 8 0 1 1 3.7 6.75L3.5 20l1.25-3.6A7.9 7.9 0 0 1 4 12z" />
        </Svg>
      )
    case 'nutrition':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={1.9} {...common}>
          <Path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z" />
          <Path d="M10 2c1 .5 2 2 2 5" />
        </Svg>
      )
    case 'community':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={1.9} {...common}>
          <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <Circle cx="9" cy="7" r="4" />
          <Path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </Svg>
      )
  }
}

type Item = { key: TabKey; label: string; center?: boolean }

// Design "B": five tabs, Coach the raised centre control. The Coach tab is only shown while the
// coach is actually available; when it is gated off we drop the tab entirely (rather than leaving a
// prominent centre button that dead-ends on a "coming soon" screen).
const allItems: Item[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'workout', label: 'Workout' },
  { key: 'coach', label: 'Coach', center: true },
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'community', label: 'Community' },
]
const items: Item[] = coachAvailable() ? allItems : allItems.filter((i) => i.key !== 'coach')

export function BottomNav({
  active,
  onChange,
  hidden = false,
}: {
  active: TabKey
  onChange: (t: TabKey) => void
  /** Slide the whole bar out of the way (e.g. while the Coach composer's keyboard is open). */
  hidden?: boolean
}) {
  const insets = useSafeAreaInsets()
  const c = useColors()
  const inactive = withAlpha(c.fg, 0.62)

  // Standard app transition timing; the bar drops away + fades when hidden, springs back cleanly.
  const shift = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(shift, {
      toValue: hidden ? 1 : 0,
      duration: hidden ? 180 : 240,
      useNativeDriver: Platform.OS !== 'web',
    }).start()
  }, [hidden, shift])

  const travel = NAV_CONTENT_HEIGHT + insets.bottom + 24

  return (
    <Animated.View
      pointerEvents={hidden ? 'none' : 'auto'}
      // The black backing + top hairline MUST be inline, not a NativeWind className: className
      // background/border rules (like position/inset) don't reliably apply to Animated.View on web,
      // which left the bar transparent — the icons floated over the page content with no dark bar.
      // `overflow: visible` lets the raised Coach orb hang above the bar's top edge.
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 20,
        overflow: 'visible',
        backgroundColor: c.ink900,
        borderTopWidth: 1,
        borderTopColor: withAlpha(c.fg, 0.05),
        opacity: shift.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        transform: [{ translateY: shift.interpolate({ inputRange: [0, 1], outputRange: [0, travel] }) }],
      }}
    >
      {/* Items row: every tab is the SAME height (so the bar tops exactly at the marker line); the
          Coach orb is layered on top and protrudes upward, it does not stretch the row. */}
      <View className="flex-row items-end" style={{ paddingHorizontal: 12 }}>
        {items.map(({ key, label, center }) => {
          const isActive = key === active
          if (center) {
            return (
              <NavTab key={key} label={label} isActive={isActive} onPress={() => onChange(key)} scaleTo={0.92}>
                {/* Icon-slot spacer keeps the "Coach" label on the same baseline as the other labels. */}
                <View style={{ height: 24 }} />
                <Text className="text-[10.5px] font-bold" style={{ color: isActive ? c.brand400 : inactive }}>
                  {label}
                </Text>
                {/* The orb, absolutely centred and pulled up so it hangs over the bar's top edge. */}
                <View style={{ position: 'absolute', top: -13, left: 0, right: 0, alignItems: 'center' }}>
                  <View
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 999,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isActive ? c.brand400 : c.ink700,
                      // Faint inner brand ring (neutral) — the border reads identically on web + native.
                      borderWidth: isActive ? 0 : 1.6,
                      borderColor: withAlpha(c.brand400, 0.32),
                      // Drop shadow via boxShadow so the raised orb actually "floats" on web too
                      // (RN shadow* props are ignored on web). Active = brand glow; inactive = soft dark.
                      boxShadow: isActive
                        ? `0px 8px 18px -6px ${withAlpha(c.brand400, 0.7)}`
                        : '0px 5px 12px -6px rgba(0,0,0,0.7)',
                      elevation: 8,
                    }}
                  >
                    <NavIcon name="coach" size={25} color={isActive ? '#07110b' : withAlpha(c.fg, 0.72)} />
                  </View>
                </View>
              </NavTab>
            )
          }
          return (
            <NavTab key={key} label={label} isActive={isActive} onPress={() => onChange(key)}>
              {/* Green top-marker, hanging flush from the top edge of the active tab. */}
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' }}>
                <View
                  style={{
                    width: 26,
                    height: 3,
                    borderBottomLeftRadius: 3,
                    borderBottomRightRadius: 3,
                    backgroundColor: isActive ? c.brand400 : 'transparent',
                  }}
                />
              </View>
              <NavIcon name={key as IconKey} size={24} color={isActive ? c.brand400 : inactive} />
              <Text className="text-[10.5px] font-bold" style={{ color: isActive ? c.brand400 : inactive }}>
                {label}
              </Text>
            </NavTab>
          )
        })}
      </View>

      {/* Home indicator: on notch/gesture devices the OS draws it in the safe-area inset, so we just
          reserve that space; where there's no inset (older devices / web) we draw the design's pill so
          the bar reads as finished rather than clipped. */}
      {insets.bottom > 0 ? (
        <View style={{ height: insets.bottom }} />
      ) : (
        <View style={{ alignItems: 'center', paddingTop: 7, paddingBottom: 8 }}>
          <View style={{ width: 120, height: 4, borderRadius: 2, backgroundColor: withAlpha(c.fg, 0.2) }} />
        </View>
      )}
    </Animated.View>
  )
}

/** One nav slot with immediate press feedback (a subtle scale dip) and NO haptic —
 *  navigation is deliberately silent; haptics are reserved for send / confirm. */
function NavTab({
  label,
  isActive,
  onPress,
  scaleTo = 0.95,
  children,
}: {
  label: string
  isActive: boolean
  onPress: () => void
  scaleTo?: number
  children: React.ReactNode
}) {
  const scale = useRef(new Animated.Value(1)).current
  const useNative = Platform.OS !== 'web'
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: scaleTo, useNativeDriver: useNative, speed: 40, bounciness: 0 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: useNative, speed: 24, bounciness: 8 }).start()}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isActive }}
      className="flex-1"
    >
      <Animated.View
        // Alignment must live in the inline style, not a NativeWind className: className flex rules
        // don't reliably apply to Animated.View, which left the fixed-width <Svg> icons stuck at the
        // default `align-items: stretch` (left-aligned) while the labels read centred.
        style={{ minHeight: 38, paddingTop: 7, gap: 3, alignItems: 'center', justifyContent: 'flex-end', transform: [{ scale }] }}
      >
        {children}
      </Animated.View>
    </Pressable>
  )
}
