import { useEffect, useRef, useState } from 'react'
import { View, Text } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { WifiOff, Wifi } from 'lucide-react-native'
import { useConnectivity } from '../lib/useConnectivity'
import { useColors } from '../theme'

/**
 * A calm, persistent offline indicator (premium-feel §5 "ugly states" / offline).
 *
 * SHO is local-first: the store is hydrated from AsyncStorage and CloudSync
 * diff-saves on every change, retrying on the next change after a failed write —
 * so reads stay available and writes effectively queue and sync on reconnect.
 * This bar just tells the user that calmly. It is an ambient slice at the very
 * top (never a blocking modal), and it briefly confirms "Back online" before
 * sliding away so a reconnect feels acknowledged rather than silent.
 *
 * Non-interactive (pointerEvents none) so it never eats a tap on the content
 * beneath it. Motion runs on the UI thread; nothing polls.
 */
const BAR_H = 30

export function OfflineBanner() {
  const online = useConnectivity()
  const insets = useSafeAreaInsets()
  const c = useColors()

  // After a real drop, show a short "Back online" confirmation, then hide.
  const wasOffline = useRef(false)
  const [confirmOnline, setConfirmOnline] = useState(false)
  useEffect(() => {
    if (!online) {
      wasOffline.current = true
      setConfirmOnline(false)
    } else if (wasOffline.current) {
      wasOffline.current = false
      setConfirmOnline(true)
      const t = setTimeout(() => setConfirmOnline(false), 2400)
      return () => clearTimeout(t)
    }
  }, [online])

  const visible = !online || confirmOnline
  const hiddenY = -(BAR_H + insets.top + 16)
  const ty = useSharedValue(hiddenY)
  useEffect(() => {
    // System-initiated → short eased curve. Entrance a touch slower than exit.
    ty.value = withTiming(visible ? 0 : hiddenY, {
      duration: visible ? 220 : 160,
      easing: Easing.out(Easing.cubic),
    })
  }, [visible, hiddenY, ty])

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }))

  const label = online
    ? 'Back online'
    : "You're offline — changes are saved on this device and sync when you reconnect."

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 70, paddingTop: insets.top }, style]}
    >
      <View className="mx-3 flex-row items-center gap-2 rounded-b-2xl border border-t-0 border-white/10 bg-ink-700 px-3.5 py-2 shadow-lg">
        {online ? <Wifi size={14} color={c.brand400} /> : <WifiOff size={14} color={c.accentOrange} />}
        <View
          style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: online ? c.brand400 : c.accentOrange }}
        />
        <Text numberOfLines={1} className="flex-1 text-[12px] font-semibold text-white/90">
          {label}
        </Text>
      </View>
    </Animated.View>
  )
}
