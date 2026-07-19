import { View, Text, Pressable, Linking } from 'react-native'
import { Phone, MessageSquare } from 'lucide-react-native'
import type { ContactButton } from '../lib/coachSafety'

/**
 * Renders the tap-to-call / tap-to-text buttons carried by a fixed safety response (spec §20),
 * so a user in distress can reach help in one tap. Used under coach messages that carry buttons.
 * Only shown for Australian responses — non-AU safety responses carry no buttons (see coach/safety
 * responses), pointing to local services in text instead.
 */
function openContact(b: ContactButton) {
  if (!b.value) return
  const url = `${b.action === 'call' ? 'tel:' : 'sms:'}${b.value}`
  Linking.canOpenURL(url).then((can) => { if (can) return Linking.openURL(url) }).catch(() => { /* ignore */ })
}

export function SafetyContactButtons({ buttons }: { buttons?: ContactButton[] }) {
  if (!buttons || buttons.length === 0) return null
  return (
    <View className="mt-2 flex-row flex-wrap gap-2">
      {buttons.map((b, i) => (
        <Pressable
          key={`${b.value}-${i}`}
          onPress={() => openContact(b)}
          accessibilityRole="button"
          accessibilityLabel={b.label}
          className="flex-row items-center gap-1.5 rounded-full bg-brand-400 px-3 py-1.5 active:opacity-90"
        >
          {b.action === 'call' ? <Phone size={13} color="#000" /> : <MessageSquare size={13} color="#000" />}
          <Text className="text-[12px] font-bold text-black">{b.label}</Text>
        </Pressable>
      ))}
    </View>
  )
}
