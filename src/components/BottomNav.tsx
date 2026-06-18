import { View, Text, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LayoutGrid, Dumbbell, Apple, ChartBar as BarChart3, Users, type LucideIcon } from 'lucide-react-native'
import type { TabKey } from '../App'
import { brand } from '../theme'

const items: { key: TabKey; label: string; Icon: LucideIcon }[] = [
  { key: 'dashboard', label: 'Dashboard', Icon: LayoutGrid },
  { key: 'workout', label: 'Workout', Icon: Dumbbell },
  { key: 'nutrition', label: 'Nutrition', Icon: Apple },
  { key: 'progress', label: 'Progress', Icon: BarChart3 },
  { key: 'community', label: 'Community', Icon: Users },
]

export function BottomNav({ active, onChange }: { active: TabKey; onChange: (t: TabKey) => void }) {
  const insets = useSafeAreaInsets()
  const inactive = 'rgba(148,148,148,0.75)'
  return (
    <View
      className="absolute inset-x-0 bottom-0 z-20 border-t border-white/10 bg-ink-900"
      style={{ paddingBottom: Math.max(insets.bottom, 12), paddingTop: 10, paddingHorizontal: 8 }}
    >
      <View className="flex-row items-center justify-around">
        {items.map(({ key, label, Icon }) => {
          const isActive = key === active
          return (
            <Pressable
              key={key}
              onPress={() => onChange(key)}
              className="flex-1 items-center gap-1 py-1"
            >
              <Icon size={24} strokeWidth={isActive ? 2.6 : 2} color={isActive ? brand[400] : inactive} />
              <Text
                style={{ color: isActive ? brand[400] : inactive }}
                className="text-[11px] font-semibold"
              >
                {label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
