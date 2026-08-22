/**
 * First-run "Meet your coach" feature-grid. Shown once before the empty
 * first-time chat; "Continue with coach" dismisses it into the greeting + chips.
 * Press feedback but NO haptic (entering the coach is navigation, not a confirm).
 */
import { View, Text, ScrollView } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import {
  ShieldCheck, MessageCircle, SlidersHorizontal, Leaf, TrendingUp, Utensils, ClipboardCheck, type LucideIcon,
} from 'lucide-react-native'
import { PressableScale } from '../components/PressableScale'
import { useColors } from '../theme'
import { withAlpha } from '../lib/color'
import { useT } from '../lib/useT'

const FEATURES: { Icon: LucideIcon; label: string }[] = [
  { Icon: MessageCircle, label: 'Answers your questions' },
  { Icon: SlidersHorizontal, label: 'Adjusts your program & exercises' },
  { Icon: Leaf, label: 'Guides nutrition & recovery' },
  { Icon: TrendingUp, label: 'Tracks your progress' },
  { Icon: Utensils, label: 'Reviews your food choices' },
  { Icon: ClipboardCheck, label: 'Keeps you accountable' },
]

export function CoachWelcome({ onContinue, bottomInset = 0 }: { onContinue: () => void; bottomInset?: number }) {
  const c = useColors()
  const t = useT()
  return (
    <View style={{ flex: 1, backgroundColor: c.ink900 }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 22, paddingBottom: 16, alignItems: 'center' }} showsVerticalScrollIndicator={false} contentInsetAdjustmentBehavior="automatic">
        <View
          style={{
            width: 64, height: 64, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
            backgroundColor: withAlpha(c.brand400, 0.14),
            borderWidth: 1, borderColor: withAlpha(c.brand400, 0.22),
          }}
        >
          <ShieldCheck size={30} color={c.brand300} strokeWidth={1.8} />
        </View>
        <Text style={{ marginTop: 20, fontSize: 27, lineHeight: 31, fontWeight: '800', letterSpacing: -0.5, color: c.fg, textAlign: 'center' }}>{t('Meet your coach')}</Text>
        <Text style={{ marginTop: 11, maxWidth: 300, fontSize: 14, lineHeight: 21, color: withAlpha(c.fg, 0.6), textAlign: 'center' }}>{t('Training guidance grounded in your StrengthHub program.')}</Text>

        <View style={{ marginTop: 26, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {FEATURES.map(({ Icon, label }) => (
            <View
              key={label}
              style={{
                width: '47.5%', flexGrow: 1, padding: 16,
                backgroundColor: c.ink800, borderWidth: 1, borderColor: withAlpha(c.fg, 0.05), borderRadius: 16,
              }}
            >
              <Icon size={22} color={c.brand300} strokeWidth={1.7} />
              <Text style={{ marginTop: 12, fontSize: 14, fontWeight: '600', lineHeight: 18, color: c.fg }}>{t(label)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <LinearGradient colors={[withAlpha(c.ink900, 0), c.ink900]} style={{ paddingHorizontal: 22, paddingTop: 22, paddingBottom: 20 + bottomInset }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 14 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.brand400 }} />
          <Text style={{ fontSize: 12, color: withAlpha(c.fg, 0.4) }}>{t('Powered by {brand}', { brand: 'Google Gemini' })}</Text>
        </View>
        <PressableScale
          haptic={false}
          onPress={onContinue}
          accessibilityRole="button"
          accessibilityLabel="Continue with coach"
          containerStyle={{ width: '100%' }}
          style={{ minHeight: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: c.brand400 }}
        >
          <Text style={{ fontSize: 16, fontWeight: '800', letterSpacing: -0.2, color: c.ink900 }}>{t('Continue with coach')}</Text>
        </PressableScale>
      </LinearGradient>
    </View>
  )
}
