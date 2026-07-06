import { useState } from 'react'
import { View, Text, Image } from 'react-native'
import { Play } from 'lucide-react-native'
import { exerciseVideo, exercisePoster } from '../lib/media'

/**
 * Web build of the exercise form clip. Uses a plain HTML5 <video> instead of
 * expo-video — the browser plays it natively, and crucially the web/Bolt bundle
 * never imports the native video module (which can destabilise Bolt's in-browser
 * dev server). Same behaviour: autoplay/muted/loop over the poster, with a
 * graceful poster + play-badge fallback when a clip isn't uploaded or fails.
 */
export function TechniqueClip({ exerciseId, poster, label }: { exerciseId?: string; poster?: string; label: string }) {
  const videoUrl = exerciseId ? exerciseVideo(exerciseId) : undefined
  const uploadedPoster = exerciseId ? exercisePoster(exerciseId) : undefined
  const [videoFailed, setVideoFailed] = useState(false)
  const [posterFailed, setPosterFailed] = useState(false)
  const shownPoster = !uploadedPoster || posterFailed ? poster : uploadedPoster
  const showVideo = !!videoUrl && !videoFailed

  return (
    <View className="w-full overflow-hidden rounded-2xl border border-white/10" style={{ aspectRatio: 16 / 9 }}>
      {!!shownPoster && (
        <Image
          source={{ uri: shownPoster }}
          onError={() => setPosterFailed(true)}
          resizeMode="cover"
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: showVideo ? 0 : 0.4 }}
        />
      )}
      {showVideo && (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <video
          src={videoUrl}
          poster={shownPoster}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onError={() => setVideoFailed(true)}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' } as object}
        />
      )}
      {!showVideo && (
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
