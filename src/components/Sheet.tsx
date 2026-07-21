import type { ReactNode } from 'react'
import { View, Text, Pressable, ScrollView, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { X } from 'lucide-react-native'
import { useColors } from '../theme'
import { AppModal, IS_WEB, WEB_SCREEN } from './WebFrame'

/** Bottom sheet / modal used for logging flows and the active workout. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  full = false,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  full?: boolean
}) {
  const win = useWindowDimensions()
  // On web the sheet lives inside the phone mockup, so measure against the
  // device screen — not the full browser window — to keep it in proportion.
  const height = IS_WEB ? WEB_SCREEN.height : win.height
  const insets = useSafeAreaInsets()
  const colors = useColors()

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

export function EmptyState({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <View className="items-center justify-center rounded-2xl border border-dashed border-white/15 px-6 py-12">
      <View className="mb-3 opacity-30">{icon}</View>
      <Text className="font-bold text-white">{title}</Text>
      <Text className="mt-1 max-w-[220px] text-center text-[13px] text-white/45">{body}</Text>
    </View>
  )
}
