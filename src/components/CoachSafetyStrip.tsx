import { View, Text, Pressable, Alert, Linking } from 'react-native'
import { Info } from 'lucide-react-native'

/**
 * Quiet, always-present coach disclaimer + on-demand support (Option B).
 *
 * DELIBERATELY LOW-KEY: a fitness coach must not signal crisis at every benign turn — someone asking
 * about squats should not be shown suicide-line numbers. So this is a subtle "training coach — not a
 * medical or crisis service" note plus a discreet "Get support" link that reveals help ONLY when tapped.
 * Help is therefore always one tap away (detection-independent), without making ordinary chat feel like
 * a crisis intervention. Prominent tap-to-call numbers still appear via SafetyContactButtons on an
 * actual safety response, where they belong.
 */
function dial(num: string) {
  const url = `tel:${num}`
  Linking.canOpenURL(url)
    .then((can) => (can ? Linking.openURL(url) : undefined))
    .catch(() => {
      /* ignore — no dialer available */
    })
}

function openSupport(isAustralia: boolean) {
  if (isAustralia) {
    Alert.alert('Support', 'You can reach these any time — you don’t have to be in crisis to call.', [
      { text: 'Call Lifeline 13 11 14', onPress: () => dial('131114') },
      { text: 'Call 000 (emergency)', onPress: () => dial('000') },
      { text: 'Close', style: 'cancel' },
    ])
  } else {
    Alert.alert(
      'Support',
      'In an emergency, contact your local emergency services. A local crisis or support line can also help.',
      [{ text: 'Close', style: 'cancel' }],
    )
  }
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
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 7,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(128,128,128,0.15)',
      }}
    >
      <Info size={12} color={fg} style={{ opacity: 0.4 }} />
      <Text style={{ flex: 1, fontSize: 11, color: fg, opacity: 0.45 }}>
        Training coach — not a medical or crisis service.
      </Text>
      <Pressable onPress={() => openSupport(isAustralia)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Get support options">
        <Text style={{ fontSize: 11, fontWeight: '700', color: brand }}>Get support</Text>
      </Pressable>
    </View>
  )
}
