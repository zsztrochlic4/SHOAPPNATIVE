import { View, Text, Pressable } from 'react-native'
import { X, ChevronLeft } from 'lucide-react-native'
import { useColors } from '../theme'

/**
 * The one canonical sheet header, so every sheet's title, back affordance and
 * close ✕ sit in the SAME place at the SAME size (the audit found the ✕ drifting
 * left/right and between h-8/h-9 across sheets). The ✕ is always top-right in an
 * `h-8 w-8` circle; an optional back chevron sits top-left. A drag handle can be
 * shown above the row for bottom sheets.
 */
export function SheetHeader({
  title,
  onClose,
  onBack,
  handle = false,
  closeLabel = 'Close',
}: {
  title?: string
  onClose: () => void
  /** When set, a left chevron is shown (menu-detail / pushed panels). */
  onBack?: () => void
  /** Show the bottom-sheet drag grabber above the title row. */
  handle?: boolean
  closeLabel?: string
}) {
  const colors = useColors()
  return (
    <View className="px-5 pb-2 pt-4">
      {handle && (
        <View
          style={{ position: 'absolute', left: '50%', top: 8, marginLeft: -20, height: 4, width: 40, borderRadius: 999 }}
          className="bg-white/20"
        />
      )}
      <View className="flex-row items-center gap-2">
        {onBack && (
          <Pressable onPress={onBack} hitSlop={8} accessibilityLabel="Back" className="-ml-1 h-8 w-8 items-center justify-center rounded-full active:opacity-70">
            <ChevronLeft size={22} color={colors.fg} />
          </Pressable>
        )}
        <Text numberOfLines={1} className="flex-1 text-lg font-bold text-white">{title}</Text>
        <Pressable
          onPress={onClose}
          hitSlop={8}
          accessibilityLabel={closeLabel}
          className="h-8 w-8 items-center justify-center rounded-full bg-white/10 active:opacity-70"
        >
          <X size={18} color={colors.fg} />
        </Pressable>
      </View>
    </View>
  )
}
