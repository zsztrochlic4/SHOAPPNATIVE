/**
 * Welcome modal — a centred floating card shown once, right after the user claims
 * a username from the setup gate. It orients them to the three pillars of the hub
 * (League / Streaks / Groups) and points out where to change their name.
 */
import { View, Text, Pressable } from 'react-native'
import { AtSign, X } from 'lucide-react-native'
import { AppModal } from '../components/WebFrame'

const ROWS: { color: string; title: string; body: string }[] = [
  {
    color: '#C7CDD6',
    title: 'League',
    body: 'Every week you compete in a league of lifters at your level. Your rank comes from your consistency score, not how much you lift. Finish near the top to move up a tier. The better you perform, the more prizes to win.',
  },
  {
    color: '#F5A524',
    title: 'Streaks',
    body: 'Your streak counts the days you show up. A rest day or a freeze token keeps it alive through an off day, so one skipped session never resets you.',
  },
  {
    color: '#7ED957',
    title: 'Groups',
    body: 'Start a private group and share the code, or join one with a friend. Inside, you rank each other and chase a shared weekly team goal.',
  },
]

export function WelcomeModal({ open, username, onClose }: { open: boolean; username: string | null; onClose: () => void }) {
  return (
    <AppModal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close welcome"
          onPress={onClose}
          style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.62)' }}
        />
        <View
          accessibilityViewIsModal
          className="rounded-3xl border border-white/10 bg-ink-800 p-5"
          style={{ width: '88%', maxWidth: 360, shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 30, shadowOffset: { width: 0, height: 24 }, elevation: 12 }}
        >
          <View className="mb-3.5 flex-row items-center justify-between">
            <Text className="text-[18px] font-extrabold text-white">You're all set</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close" className="h-7 w-7 items-center justify-center rounded-full bg-white/10 active:opacity-80">
              <X size={15} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </View>

          <Text className="mb-4 text-[13px] leading-snug text-secondary">
            Welcome, <Text className="font-bold text-white">@{username ?? 'you'}</Text>. Community is where you compete on staying consistent. Here's what you'll find.
          </Text>

          <View className="gap-3.5">
            {ROWS.map((r) => (
              <View key={r.title} className="flex-row gap-3">
                <View className="mt-1.5 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.color }} />
                <View className="flex-1">
                  <Text className="text-[14px] font-bold text-white">{r.title}</Text>
                  <Text className="mt-0.5 text-[12px] leading-snug text-secondary">{r.body}</Text>
                </View>
              </View>
            ))}
          </View>

          <View className="mt-4 flex-row items-center gap-2 rounded-2xl bg-white/[0.04] px-3.5 py-3">
            <AtSign size={16} color="rgba(255,255,255,0.5)" />
            <Text className="flex-1 text-[12px] leading-snug text-white/55">Change your username any time from the settings icon in the top corner.</Text>
          </View>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Explore Community"
            className="mt-4 items-center rounded-2xl py-3.5 active:opacity-90"
            style={{ backgroundColor: 'rgba(126,217,87,0.16)' }}
          >
            <Text className="text-[15px] font-bold" style={{ color: '#9fe264' }}>Explore Community</Text>
          </Pressable>
        </View>
      </View>
    </AppModal>
  )
}
