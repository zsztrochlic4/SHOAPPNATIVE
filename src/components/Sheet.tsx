import type { ReactNode } from 'react'
import { Modal, View, Text, Pressable, ScrollView, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { X } from 'lucide-react-native'
import { useColors } from '../theme'

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
  const { height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const colors = useColors()

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityLabel="Close"
          onPress={onClose}
          style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)' }}
        />
        <View
          className="rounded-t-3xl border-t border-white/10 bg-ink-900"
          style={{ height: full ? height * 0.92 : undefined, maxHeight: height * 0.88 }}
        >
          <View className="px-5 pb-2 pt-4">
            <View
              style={{ position: 'absolute', left: '50%', top: 8, marginLeft: -20, height: 4, width: 40, borderRadius: 999 }}
              className="bg-white/20"
            />
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
            contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
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
