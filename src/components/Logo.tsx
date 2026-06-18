import { View, Text } from 'react-native'

/* Brand marks for StrengthHub Online.
   LogoMark — compact squircle monogram (SH); Wordmark — the StrengthHub lockup. */

export function LogoMark({ size = 40 }: { size?: number; className?: string }) {
  return (
    <View
      className="items-center justify-center bg-brand-400"
      style={{ width: size, height: size, borderRadius: size * 0.28, flexShrink: 0 }}
    >
      <Text style={{ fontSize: size * 0.42, fontWeight: '800', color: '#000' }}>
        S<Text style={{ fontStyle: 'italic' }}>H</Text>
      </Text>
    </View>
  )
}

const sizeMap = { sm: 15, md: 20, lg: 28 } as const

export function Wordmark({
  size = 'md',
  online = true,
}: {
  size?: keyof typeof sizeMap
  online?: boolean
  className?: string
}) {
  const fs = sizeMap[size]
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      <Text style={{ fontSize: fs, fontWeight: '800', letterSpacing: -0.5 }} className="text-white">
        Strength
        <Text style={{ fontStyle: 'italic' }} className="text-brand-400">
          Hub
        </Text>
      </Text>
      {online && (
        <Text
          className="text-white/40"
          style={{ fontSize: fs * 0.4, fontWeight: '700', letterSpacing: 2, marginLeft: 2, marginTop: 2 }}
        >
          ONLINE
        </Text>
      )}
    </View>
  )
}
