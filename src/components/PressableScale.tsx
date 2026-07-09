import { useRef } from 'react'
import { Animated, Platform, Pressable, type PressableProps, type ViewStyle } from 'react-native'
import { tick } from '../lib/haptics'

/**
 * A Pressable that gives a soft, spring-loaded "press" instead of a blunt
 * opacity flip — the whole button dips slightly and springs back, with an
 * optional haptic tick. This is what makes the primary actions feel premium
 * rather than abrupt.
 *
 * The scale lives on an outer Animated.View wrapper (so the button's background
 * scales too, and NativeWind `className` keeps working on the inner Pressable).
 * Pass `containerStyle` when the button must carry layout itself, e.g.
 * `containerStyle={{ flex: 1 }}` for a button in a flex row.
 */
export function PressableScale({
  children,
  onPressIn,
  onPressOut,
  haptic = true,
  scaleTo = 0.96,
  containerStyle,
  disabled,
  ...rest
}: PressableProps & { haptic?: boolean; scaleTo?: number; containerStyle?: ViewStyle }) {
  const scale = useRef(new Animated.Value(1)).current
  const useNative = Platform.OS !== 'web'

  return (
    <Animated.View style={[containerStyle, { transform: [{ scale }] }]}>
      <Pressable
        {...rest}
        disabled={disabled}
        onPressIn={(e) => {
          if (!disabled && haptic) tick()
          Animated.spring(scale, { toValue: scaleTo, useNativeDriver: useNative, speed: 40, bounciness: 0 }).start()
          onPressIn?.(e)
        }}
        onPressOut={(e) => {
          Animated.spring(scale, { toValue: 1, useNativeDriver: useNative, speed: 24, bounciness: 8 }).start()
          onPressOut?.(e)
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  )
}
