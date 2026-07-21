import { useEffect, useRef, useState, type ReactNode } from 'react'
import { View, Text, Pressable, ScrollView, Animated, Easing, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { X, ChevronLeft } from 'lucide-react-native'
import { useColors } from '../theme'
import { useNav } from '../nav'
import { useHorizontalSwipe } from '../lib/useHorizontalSwipe'
import { AppModal, IS_WEB, WEB_SCREEN } from './WebFrame'

// Menu → detail transition: 280ms ease-out, both directions — a short slide
// crossfaded with opacity (see MenuDetailPanel), calm enough to read as a clean,
// natural reveal rather than an abrupt full-width sweep.
const DETAIL_MS = 280
const DETAIL_EASE = Easing.out(Easing.cubic)

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
    return (
      <AppModal visible={open} transparent animationType="slide" onRequestClose={onClose}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <View className="bg-ink-900" style={{ height }}>
            {children}
          </View>
        </View>
      </AppModal>
    )
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
    <AppModal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityLabel="Close"
          onPress={onClose}
          style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)' }}
        />
        <View
          className={full ? 'bg-ink-900' : 'rounded-t-3xl border-t border-white/10 bg-ink-900'}
          // `full` = a genuine full-screen surface (chat, builders): fill the device
          // screen edge-to-edge. Otherwise a bottom sheet capped at 88%.
          style={{ height: full ? height : undefined, maxHeight: full ? height : height * 0.88 }}
        >
          <View className="px-5 pb-2 pt-4">
            {!full && (
              <View
                style={{ position: 'absolute', left: '50%', top: 8, marginLeft: -20, height: 4, width: 40, borderRadius: 999 }}
                className="bg-white/20"
              />
            )}
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-bold text-white">{title}</Text>
              <Pressable
                onPress={onClose}
                hitSlop={8}
                className="h-8 w-8 items-center justify-center rounded-full bg-white/10"
              >
                <X size={18} color={colors.fg} />
              </Pressable>
            </View>
          </View>
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
        </View>
      </View>
    </AppModal>
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
  const progress = useRef(new Animated.Value(0)).current
  useEffect(() => {
    // Identical duration + easing in BOTH directions, so opening a detail and
    // closing it are exact mirror animations at the same speed.
    if (open) {
      setRender(true)
      Animated.timing(progress, { toValue: 1, duration: DETAIL_MS, easing: DETAIL_EASE, useNativeDriver: !IS_WEB }).start()
    } else if (render) {
      Animated.timing(progress, { toValue: 0, duration: DETAIL_MS, easing: DETAIL_EASE, useNativeDriver: !IS_WEB }).start(({ finished }) => {
        if (finished) setRender(false)
      })
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Clean "rise into place": a short left-anchored slide (a fraction of the
  // width, not a full-screen sweep) crossfaded with opacity, so the detail
  // materialises from the menu's side rather than wiping across a dark backdrop.
  // Swipe-back is a leftward drag toward that same exit edge.
  const { panHandlers, dragX } = useHorizontalSwipe({ width, onSwipeLeft: onBack })
  const base = progress.interpolate({ inputRange: [0, 1], outputRange: [-Math.round(width * 0.22), 0] })
  const translateX = Animated.add(base, dragX)
  const opacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] })

  return (
    <AppModal visible={render} animationType="none" onRequestClose={onBack}>
      <Animated.View
        {...panHandlers}
        className="flex-1 bg-ink-900"
        style={{ paddingTop: insets.top, opacity, transform: [{ translateX }], ...(IS_WEB ? { flex: 1, minHeight: 0 } : null) }}
      >
        <View className="flex-row items-center gap-1 px-3 py-2.5">
          <Pressable onPress={onBack} hitSlop={8} accessibilityLabel="Back to menu" className="h-9 w-9 items-center justify-center rounded-full active:opacity-70">
            <ChevronLeft size={24} color={colors.fg} />
          </Pressable>
          <Text numberOfLines={1} className="flex-1 text-[17px] font-bold text-white">{title}</Text>
          <Pressable onPress={onDashboard} hitSlop={8} accessibilityLabel="Close to dashboard" className="h-9 w-9 items-center justify-center rounded-full bg-white/10 active:opacity-70">
            <X size={18} color={colors.fg} />
          </Pressable>
        </View>
        <ScrollView
          className="flex-1 px-5"
          style={IS_WEB ? { maxHeight: height - 56, minHeight: 0 } : undefined}
          contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </Animated.View>
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
