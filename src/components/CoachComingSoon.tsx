import { View, Text } from 'react-native'
import { Sparkles } from 'lucide-react-native'
import { brand } from '../theme'

/**
 * Shown in place of any coach surface (workout coach chat, check-ins, or the
 * nutrition food coach) while the coach is gated OFF pre-review. See
 * src/backend/coach/coachGate.ts.
 */
export function CoachComingSoon() {
  return (
    <View className="items-center rounded-3xl border border-white/8 bg-ink-800 px-6 py-10">
      <View className="h-16 w-16 items-center justify-center rounded-2xl bg-brand-400/10"><Sparkles size={28} color={brand[400]} /></View>
      <Text className="mt-5 text-center text-xl font-extrabold text-white">Coach is coming soon</Text>
      <Text className="mt-2.5 max-w-[300px] text-center text-[14px] leading-6 text-white/60">Your coach is being reviewed by a qualified professional before it goes live. We’ll switch it on here once it’s ready.</Text>
    </View>
  )
}
