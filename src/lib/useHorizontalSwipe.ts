import { useRef } from 'react'
import { Animated, PanResponder } from 'react-native'
import { IS_WEB } from '../components/WebFrame'
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

/**
 * A finger-tracking horizontal swipe built on core `Animated` + `PanResponder`
 * (this codebase has no gesture-handler / reanimated, and adding them would
 * force a native rebuild and break the web preview).
 *
 * It only claims the gesture when the movement is clearly horizontal, so a
 * vertical ScrollView underneath keeps scrolling. The returned `dragX` tracks
 * the finger 1:1 up to the commit point, then rubber-bands so the trigger has a
 * felt edge. On release it decides by distance OR velocity, fires the matching
 * callback with a confirm haptic, and springs back to rest (the opened surface
 * covers the return). A directional callback left undefined disables that side.
 */
export function useHorizontalSwipe(cfg: HorizontalSwipeConfig) {
  const dragX = useRef(new Animated.Value(0)).current
  // Keep the latest config in a ref so the PanResponder (created once) always
  // reads current callbacks/flags without being recreated on every render.
  const ref = useRef(cfg)
  ref.current = cfg
  // Whether we've buzzed for crossing the commit line on the current drag.
  const crossed = useRef(false)

  const responder = useRef(
    PanResponder.create({
      // Never steal a plain tap.
      onStartShouldSetPanResponder: () => false,
      // Claim only clearly-horizontal drags so vertical scrolling still works.
      onMoveShouldSetPanResponder: (_e, g) => {
        if (ref.current.enabled === false) return false
        const horizontal = Math.abs(g.dx) > Math.abs(g.dy) * 1.4 && Math.abs(g.dx) > 8
        if (!horizontal) return false
        // Ignore a direction with no handler.
        if (g.dx > 0 && !ref.current.onSwipeRight) return false
        if (g.dx < 0 && !ref.current.onSwipeLeft) return false
        return true
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        crossed.current = false
      },
      onPanResponderMove: (_e, g) => {
        const { width, onSwipeRight, onSwipeLeft } = ref.current
        let dx = g.dx
        // Damp a direction that has no handler so it barely gives.
        if (dx > 0 && !onSwipeRight) dx *= 0.12
        if (dx < 0 && !onSwipeLeft) dx *= 0.12
        const commit = width * (ref.current.distanceRatio ?? 0.32)
        const mag = Math.abs(dx)
        // 1:1 until the commit line, then rubber-band at 35% past it.
        const shown = mag <= commit ? mag : commit + (mag - commit) * 0.35
        dragX.setValue(Math.sign(dx) * shown)
        const past = mag >= commit
        if (past && !crossed.current) {
          crossed.current = true
          tick()
        } else if (!past && crossed.current) {
          crossed.current = false
        }
      },
      onPanResponderRelease: (_e, g) => {
        const { width, onSwipeRight, onSwipeLeft } = ref.current
        const commit = width * (ref.current.distanceRatio ?? 0.32)
        const vThresh = ref.current.velocity ?? 0.4
        const right = g.dx > 0 && (g.dx >= commit || g.vx >= vThresh)
        const left = g.dx < 0 && (-g.dx >= commit || -g.vx >= vThresh)
        if (right && onSwipeRight) {
          thud()
          onSwipeRight()
        } else if (left && onSwipeLeft) {
          thud()
          onSwipeLeft()
        }
        Animated.spring(dragX, {
          toValue: 0,
          velocity: g.vx,
          tension: 120,
          friction: 14,
          useNativeDriver: !IS_WEB,
        }).start()
        crossed.current = false
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragX, { toValue: 0, tension: 120, friction: 14, useNativeDriver: !IS_WEB }).start()
        crossed.current = false
      },
    }),
  ).current

  return { panHandlers: responder.panHandlers, dragX }
}
