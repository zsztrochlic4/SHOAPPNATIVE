import { useEffect, useRef, useState, type ReactNode } from 'react'
import { View, Pressable, Animated, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native'
import { AppModal, IS_WEB, WEB_SCREEN } from './WebFrame'
import { SHEET, useReducedMotion } from '../lib/motion'

/**
 * The one canonical bottom-sheet shell: a dark scrim (tap to dismiss) plus a
 * panel that rises from the bottom, kept mounted through the exit so the
 * slide-out actually plays. Every bottom sheet in the app (the shared `Sheet`,
 * Customise, the Progress loggers, the dashboard update sheets) routes its motion
 * through this, so they open and close with the SAME timing + easing — the thing
 * that makes them read as one product. Honours "reduce motion": the slide
 * collapses to an instant cross-fade for people who asked the UI to hold still.
 *
 * It owns ONLY the modal, scrim and the animated container. The caller styles
 * the panel surface (background, radius, padding) via `panelClassName` /
 * `panelStyle` and supplies all its content as children, so this shell stays
 * layout-agnostic.
 */
export function BottomSheet({
  open,
  onClose,
  children,
  maxHeightFrac = 0.88,
  panelClassName,
  panelStyle,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** Cap the panel to this fraction of the device screen height. */
  maxHeightFrac?: number
  /** Tailwind classes for the panel surface (bg, radius, border). */
  panelClassName?: string
  /** Extra inline style for the panel (e.g. a fixed full-screen height). */
  panelStyle?: StyleProp<ViewStyle>
}) {
  const win = useWindowDimensions()
  // On web the sheet lives inside the phone mockup, so measure against the device
  // screen — not the whole browser window — to keep it in proportion.
  const screenH = IS_WEB ? WEB_SCREEN.height : win.height
  const reduced = useReducedMotion()

  const [render, setRender] = useState(open)
  const [panelH, setPanelH] = useState(SHEET.fallbackTravel)
  const progress = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (open) {
      setRender(true)
      Animated.timing(progress, {
        toValue: 1,
        duration: reduced ? 0 : SHEET.inMs,
        easing: SHEET.ease,
        useNativeDriver: !IS_WEB,
      }).start()
    } else if (render) {
      Animated.timing(progress, {
        toValue: 0,
        duration: reduced ? 0 : SHEET.outMs,
        easing: SHEET.ease,
        useNativeDriver: !IS_WEB,
      }).start(({ finished }) => {
        if (finished) setRender(false)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reduced])

  // Reduce motion → no vertical travel; the scrim/opacity cross-fade alone reads
  // the state change without anything sliding.
  const translateY = reduced ? 0 : progress.interpolate({ inputRange: [0, 1], outputRange: [panelH, 0] })

  return (
    <AppModal visible={render} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', opacity: progress }}>
          <Pressable accessibilityLabel="Close" onPress={onClose} style={{ flex: 1 }} />
        </Animated.View>
        <Animated.View
          onLayout={(e) => setPanelH(e.nativeEvent.layout.height)}
          className={panelClassName}
          style={[{ maxHeight: screenH * maxHeightFrac, transform: [{ translateY }] }, panelStyle]}
        >
          {children}
        </Animated.View>
      </View>
    </AppModal>
  )
}
