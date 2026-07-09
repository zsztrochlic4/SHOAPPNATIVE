import { useState } from 'react'
import { View, Text, Image } from 'react-native'
import { Play } from 'lucide-react-native'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useEvent } from 'expo'
import { exerciseVideo, exercisePoster } from '../lib/media'

/**
 * Exercise form clip. Plays the looping 6-second video uploaded to Cloud Storage
 * as `exercises/{id}.mp4`, over its poster `exercises/{id}.jpg`. If a clip hasn't
 * been uploaded yet (or fails to load) it gracefully shows the poster with a play
 * badge, so nothing ever breaks. `poster` is a fallback image shown until/if the
 * uploaded poster is available.
 */
export function TechniqueClip({ exerciseId, poster, label }: { exerciseId?: string; poster?: string; label: string }) {
  const videoUrl = exerciseId ? exerciseVideo(exerciseId) : undefined
  const uploadedPoster = exerciseId ? exercisePoster(exerciseId) : undefined
  const [posterFailed, setPosterFailed] = useState(false)
  const shownPoster = !uploadedPoster || posterFailed ? poster : uploadedPoster

  const player = useVideoPlayer(videoUrl ?? null, (p) => {
    if (!videoUrl) return
    p.loop = true
    p.muted = true
    p.play()
  })
  const { status } = useEvent(player, 'statusChange', { status: player.status })
  const videoOk = !!videoUrl && status !== 'error'

  return (
    <View className="w-full overflow-hidden rounded-2xl border border-white/10" style={{ aspectRatio: 16 / 9 }}>
      {!!shownPoster && (
        <Image
          source={{ uri: shownPoster }}
          onError={() => setPosterFailed(true)}
          resizeMode="cover"
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: videoOk ? 1 : 0.4 }}
        />
      )}
      {videoOk && (
        <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="cover" nativeControls={false} />
      )}
      {!videoOk && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <View className="h-12 w-12 items-center justify-center rounded-full bg-brand-400">
            <Play size={20} color="#000" fill="#000" />
          </View>
          <Text className="mt-2 text-[12px] font-semibold text-white/70">{label}</Text>
        </View>
      )}
    </View>
  )
}
