import { useMemo } from 'react'
import { Gesture } from 'react-native-gesture-handler'
import { useSharedValue, withSpring, runOnJS, type SharedValue } from 'react-native-reanimated'
import { tick, thud } from './haptics'

export type HorizontalSwipeConfig = {
  /** Reference width used for the commit distance and rubber-band cap. */
  width: number
  /** Finger travelled left → right (dx > 0). e.g. reveal the menu. */
  onSwipeRight?: () => void
  /** Finger travelled right → left (dx < 0). e.g. reveal the coach. */
  onSwipeLeft?: () => void
  /** Turn the whole gesture off (e.g. when not on the dashboard tab). */
  enabled?: boolean
  /** Fraction of `width` the finger must travel to commit. Default 0.32. */
  distanceRatio?: number
  /** Fling velocity (pts/ms) that commits regardless of distance. Default 0.4. */
  velocity?: number
}

export type HorizontalSwipe = {
  /** Pass to a <GestureDetector>. */
  gesture: ReturnType<typeof Gesture.Pan>
  /** Shared value tracking the finger (drive a useAnimatedStyle transform). */
  dragX: SharedValue<number>
}

/**
 * A finger-tracking horizontal swipe built on react-native-gesture-handler +
 * reanimated. The gesture runs on the UI thread, so tracking stays smooth even
 * while JS is busy (a step up from the previous PanResponder + Animated version).
 *
 * It only claims the gesture when the movement is clearly horizontal
 * (`activeOffsetX` / `failOffsetY`), so a vertical ScrollView underneath keeps
 * scrolling. `dragX` tracks the finger 1:1 up to the commit point, then
 * rubber-bands so the trigger has a felt edge. On release it decides by distance
 * OR velocity, fires the matching callback with a confirm haptic, and springs
 * back to rest. A directional callback left undefined disables (and damps) that side.
 */
export function useHorizontalSwipe(cfg: HorizontalSwipeConfig): HorizontalSwipe {
  const dragX = useSharedValue(0)
  // Whether we've buzzed for crossing the commit line on the current drag.
  const crossed = useSharedValue(false)

  const { width, onSwipeRight, onSwipeLeft, enabled = true, distanceRatio = 0.32, velocity = 0.4 } = cfg

  const gesture = useMemo(() => {
    const commit = width * distanceRatio
    const hasRight = !!onSwipeRight
    const hasLeft = !!onSwipeLeft
    return Gesture.Pan()
      .enabled(enabled !== false)
      // Claim only clearly-horizontal drags; yield vertical movement to scrollers.
      .activeOffsetX([-8, 8])
      .failOffsetY([-12, 12])
      .onBegin(() => {
        'worklet'
        crossed.value = false
      })
      .onUpdate((e) => {
        'worklet'
        let dx = e.translationX
        // Damp a direction that has no handler so it barely gives.
        if (dx > 0 && !hasRight) dx *= 0.12
        if (dx < 0 && !hasLeft) dx *= 0.12
        const mag = Math.abs(dx)
        // 1:1 until the commit line, then rubber-band at 35% past it.
        const shown = mag <= commit ? mag : commit + (mag - commit) * 0.35
        dragX.value = Math.sign(dx) * shown
        const past = mag >= commit
        if (past && !crossed.value) {
          crossed.value = true
          runOnJS(tick)()
        } else if (!past && crossed.value) {
          crossed.value = false
        }
      })
      .onEnd((e) => {
        'worklet'
        // gesture-handler velocity is px/s; the threshold is pts/ms, so /1000.
        const vx = e.velocityX / 1000
        const right = e.translationX > 0 && (e.translationX >= commit || vx >= velocity)
        const left = e.translationX < 0 && (-e.translationX >= commit || -vx >= velocity)
        if (right && hasRight && onSwipeRight) {
          runOnJS(thud)()
          runOnJS(onSwipeRight)()
        } else if (left && hasLeft && onSwipeLeft) {
          runOnJS(thud)()
          runOnJS(onSwipeLeft)()
        }
      })
      .onFinalize((e) => {
        'worklet'
        // Always settle back to rest (covers both a normal release and an
        // interrupted/terminated gesture), carrying the fling velocity through.
        dragX.value = withSpring(0, { velocity: e.velocityX, stiffness: 120, damping: 14 })
        crossed.value = false
      })
  }, [width, distanceRatio, velocity, enabled, onSwipeRight, onSwipeLeft, dragX, crossed])

  return { gesture, dragX }
}
