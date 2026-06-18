import { View, Text } from 'react-native'

const avatarColors = ['#7ED957', '#3B82F6', '#8B5CF6', '#F5A524', '#EC4899', '#06B6D4']

function hash(str: string) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i)
  return Math.abs(h)
}

export function Avatar({
  name,
  size = 40,
  ring = false,
}: {
  name: string
  size?: number
  ring?: boolean
}) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const color = avatarColors[hash(name) % avatarColors.length]

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        ...(ring ? { borderWidth: 2, borderColor: '#000' } : null),
      }}
    >
      <Text style={{ color: '#000', fontWeight: '700', fontSize: size * 0.4 }}>{initials}</Text>
    </View>
  )
}

export function AvatarStack({ names, size = 28 }: { names: string[]; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {names.map((n, i) => (
        <View key={n + i} style={{ marginLeft: i === 0 ? 0 : -size * 0.35 }}>
          <Avatar name={n} size={size} ring />
        </View>
      ))}
    </View>
  )
}
