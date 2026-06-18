import { View, Text, Image } from 'react-native'
import { Play } from 'lucide-react-native'

/**
 * Slot for a looping technique clip. On native we render the poster image with
 * a play affordance — a real player (expo-av) can be dropped in later by
 * swapping this component, exactly like the web <video> placeholder.
 */
export function TechniqueClip({ poster, label }: { poster: string; videoUrl?: string; label: string }) {
  return (
    <View className="w-full overflow-hidden rounded-2xl border border-white/10" style={{ aspectRatio: 16 / 9 }}>
      {!!poster && (
        <Image source={{ uri: poster }} resizeMode="cover" style={{ width: '100%', height: '100%', opacity: 0.4 }} />
      )}
      <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
        <View className="h-12 w-12 items-center justify-center rounded-full bg-brand-400">
          <Play size={20} color="#000" fill="#000" />
        </View>
        <Text className="mt-2 text-[12px] font-semibold text-white/70">{label}</Text>
      </View>
    </View>
  )
}
