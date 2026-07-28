import { View, Text, Pressable, Linking } from 'react-native'
import { Phone, HeartHandshake } from 'lucide-react-native'

/**
 * Always-on crisis affordance for the coach chat (Option B).
 *
 * Persistent and DETECTION-INDEPENDENT: it states plainly that the coach is a fitness coach — not a
 * medical or crisis service — and keeps one-tap access to real help visible at all times, so support is
 * reachable even if the safety classifier misses something. This is a deliberate architectural mitigation
 * for the fact that no classifier catches 100%: the user never has to be correctly detected to get help.
 *
 * AU numbers by default (the app's audience); non-AU users are pointed to local services in text, since
 * 000 / 13 11 14 are not universal.
 */
function dial(num: string) {
  const url = `tel:${num}`
  Linking.canOpenURL(url)
    .then((can) => (can ? Linking.openURL(url) : undefined))
    .catch(() => {
      /* ignore — no dialer available */
    })
}

export function CoachSafetyStrip({
  isAustralia = true,
  fg,
  brand,
}: {
  isAustralia?: boolean
  fg: string
  brand: string
}) {
  const Pill = ({ label, number, a11y }: { label: string; number: string; a11y: string }) => (
    <Pressable
      onPress={() => dial(number)}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderRadius: 999,
        backgroundColor: brand,
        paddingHorizontal: 9,
        paddingVertical: 4,
      }}
      className="active:opacity-80"
    >
      <Phone size={11} color="#000" strokeWidth={2.4} />
      <Text style={{ fontSize: 11, fontWeight: '700', color: '#000' }}>{label}</Text>
    </Pressable>
  )

  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        columnGap: 8,
        rowGap: 6,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: `${fg}14`,
      }}
    >
      <HeartHandshake size={13} color={fg} strokeWidth={2} style={{ opacity: 0.5 }} />
      <Text style={{ flexShrink: 1, fontSize: 11, color: fg, opacity: 0.5 }}>
        Fitness coach — not a medical or crisis service.
      </Text>
      {isAustralia ? (
        <>
          <Pill label="Lifeline 13 11 14" number="131114" a11y="Call Lifeline on 13 11 14" />
          <Pill label="000" number="000" a11y="Call emergency services on 000" />
        </>
      ) : (
        <Text style={{ fontSize: 11, color: fg, opacity: 0.5 }}>In an emergency, contact your local services.</Text>
      )}
    </View>
  )
}
