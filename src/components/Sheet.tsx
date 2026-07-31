import { useEffect, useRef, useState, type ReactNode } from 'react'
import { View, Text, Pressable, ScrollView, Animated, Easing, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { X, ChevronLeft } from 'lucide-react-native'
import { useColors } from '../theme'
import { useNav } from '../nav'
import { useHorizontalSwipe } from '../lib/useHorizontalSwipe'
import { GestureDetector } from 'react-native-gesture-handler'
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  runOnJS,
  Easing as ReEasing,
} from 'react-native-reanimated'
import { AppModal, IS_WEB, WEB_SCREEN } from './WebFrame'
import { BottomSheet } from './BottomSheet'
import { SheetHeader } from './SheetHeader'

// Menu → detail transition: 280ms ease-out, both directions — a short slide
// crossfaded with opacity (see MenuDetailPanel), calm enough to read as a clean,
// natural reveal rather than an abrupt full-width sweep.
const DETAIL_MS = 280

/** Bottom sheet / modal used for logging flows and the active workout. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  full = false,
  bare = false,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  full?: boolean
  /**
   * Full-screen surface with NO built-in header or scroll view — the child owns
   * the whole layout. For screens that need a fixed header and a bottom-pinned
   * bar (e.g. the coach chat), where a single wrapping ScrollView is wrong.
   */
  bare?: boolean
}) {
  const win = useWindowDimensions()
  // On web the sheet lives inside the phone mockup, so measure against the
  // device screen — not the full browser window — to keep it in proportion.
  const height = IS_WEB ? WEB_SCREEN.height : win.height
  const insets = useSafeAreaInsets()
  const colors = useColors()
  const nav = useNav()

  if (bare) {
    return <BarePanel open={open} onClose={onClose}>{children}</BarePanel>
  }

  // Latch the presentation the moment the menu pushes this overlay, SYNCHRONOUSLY
  // during render (the "adjust state when a prop changes" pattern) — a post-render
  // effect would commit one frame of the bottom-sheet slide-up before switching to
  // the right-slide panel, making the open feel different from the close. Latching
  // (vs reading `menuStack` live) keeps the exit in detail mode after `close`
  // clears the flag, so the slide-out plays in the same mode it slid in.
  const [menuMode, setMenuMode] = useState(false)
  const wasOpen = useRef(false)
  if (open && !wasOpen.current && menuMode !== nav.menuStack) setMenuMode(nav.menuStack)
  wasOpen.current = open

  if (menuMode) {
    return (
      <MenuDetailPanel open={open} title={title} onBack={nav.close} onDashboard={nav.closeToDashboard}>
        {children}
      </MenuDetailPanel>
    )
  }

  return (
    // `full` = a genuine full-screen surface (chat, builders): fill the device
    // screen edge-to-edge. Otherwise a bottom sheet capped at 88%. Motion,
    // scrim and dismiss are owned by the shared BottomSheet shell so every sheet
    // opens/closes with the same feel (and honours reduce-motion).
    <BottomSheet
      open={open}
      onClose={onClose}
      maxHeightFrac={full ? 1 : 0.88}
      panelClassName={full ? 'bg-ink-900' : 'rounded-t-3xl border-t border-white/10 bg-ink-900'}
      panelStyle={full ? { height } : undefined}
    >
      <SheetHeader title={title} onClose={onClose} handle={!full} />
      <ScrollView
        className="flex-1 px-5"
        // On web the modal's flex chain leaves this unbounded, so it grows to
        // its content and won't scroll. Cap it to the card's inner height
        // (sheet height minus the ~56px header) so overflow scrolls. Native
        // keeps flex-1.
        style={IS_WEB ? { maxHeight: (full ? height : height * 0.88) - 56 } : undefined}
        contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </BottomSheet>
  )
}

/**
 * A menu detail presented as a full-screen pane that slides in from the right
 * over the still-mounted menu. The top-left chevron returns to the menu
 * (`onBack`); the top-right ✕ dismisses everything to the dashboard
 * (`onDashboard`). A leftward swipe-back mirrors the chevron. Kept mounted
 * through the slide-out so the exit animation plays (no hard cut).
 */
function MenuDetailPanel({
  open,
  title,
  children,
  onBack,
  onDashboard,
}: {
  open: boolean
  title?: string
  children: ReactNode
  onBack: () => void
  onDashboard: () => void
}) {
  const win = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const colors = useColors()
  const width = IS_WEB ? WEB_SCREEN.width : win.width
  const height = IS_WEB ? WEB_SCREEN.height : win.height

  const [render, setRender] = useState(open)
  const progress = useSharedValue(0)
  // Clean "rise into place": a short left-anchored slide (a fraction of the
  // width, not a full-screen sweep) crossfaded with opacity, so the detail
  // materialises from the menu's side rather than wiping across a dark backdrop.
  // Swipe-back is a leftward drag toward that same exit edge.
  const { gesture, dragX } = useHorizontalSwipe({ width, onSwipeLeft: onBack })
  useEffect(() => {
    // Identical duration + easing in BOTH directions, so opening a detail and
    // closing it are exact mirror animations at the same speed.
    if (open) {
      setRender(true)
      progress.value = withTiming(1, { duration: DETAIL_MS, easing: ReEasing.out(ReEasing.cubic) })
    } else {
      progress.value = withTiming(0, { duration: DETAIL_MS, easing: ReEasing.out(ReEasing.cubic) }, (finished) => {
        if (finished) runOnJS(setRender)(false)
      })
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const animStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    // The open/close slide plus the live finger drag toward the exit edge.
    transform: [{ translateX: interpolate(progress.value, [0, 1], [-Math.round(width * 0.22), 0]) + dragX.value }],
  }))

  return (
    <AppModal visible={render} animationType="none" onRequestClose={onBack}>
      <GestureDetector gesture={gesture}>
      <Reanimated.View
        className="flex-1 bg-ink-900"
        style={[{ paddingTop: insets.top }, animStyle, IS_WEB ? { flex: 1, minHeight: 0 } : null]}
      >
        <SheetHeader title={title} onBack={onBack} onClose={onDashboard} closeLabel="Close to dashboard" />
        <ScrollView
          className="flex-1 px-5"
          style={IS_WEB ? { maxHeight: height - 56, minHeight: 0 } : undefined}
          contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </Reanimated.View>
      </GestureDetector>
    </AppModal>
  )
}

/**
 * Full-screen surface that slides in from the RIGHT (right → left) — used by the
 * coach messenger opened from the dashboard, so it feels like the coach is pulled
 * in from the edge rather than rising from the bottom. The child owns its whole
 * layout and its own safe-area padding; an absolute fill (not a fixed height)
 * makes it match the device frame exactly, clear of the iPhone top bar. Kept
 * mounted through the slide-out so the exit plays.
 */
function BarePanel({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const win = useWindowDimensions()
  const colors = useColors()
  const width = IS_WEB ? WEB_SCREEN.width : win.width
  const [render, setRender] = useState(open)
  const progress = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (open) {
      setRender(true)
      Animated.timing(progress, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: !IS_WEB }).start()
    } else if (render) {
      // Ease-IN on the way out: opacity holds, then drops fast at the end, so the
      // panel leaves crisply instead of lingering as a faint ghost near zero.
      Animated.timing(progress, { toValue: 0, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: !IS_WEB }).start(({ finished }) => {
        if (finished) setRender(false)
      })
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  // A short slide in from the right, crossfaded with opacity — a clean reveal
  // rather than a full-width sweep across the screen.
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [Math.round(width * 0.22), 0] })
  const opacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] })
  return (
    <AppModal visible={render} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        {/* Opaque surface set inline, not just via `bg-ink-900`: on web the class
         *  doesn't paint a background on an Animated.View, leaving the panel
         *  see-through over the dashboard. */}
        <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: colors.ink900, opacity, transform: [{ translateX }] }}>
          {children}
        </Animated.View>
      </View>
    </AppModal>
  )
}

export function EmptyState({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <View className="items-center justify-center rounded-2xl border border-dashed border-white/15 px-6 py-12">
      <View className="mb-3 opacity-30">{icon}</View>
      <Text className="font-bold text-white">{title}</Text>
      <Text className="mt-1 max-w-[220px] text-center text-[13px] text-white/45">{body}</Text>
    </View>
  )
}
