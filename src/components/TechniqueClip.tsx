import { useState, createElement } from 'react'
import { View, Text, Image } from 'react-native'
import { Play } from 'lucide-react-native'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useEvent } from 'expo'
import { exerciseVideo, exercisePoster } from '../lib/media'
import { IS_WEB } from './WebFrame'

/**
 * A plain HTML5 <video> for the web preview. expo-video's web player sets `crossOrigin`, which
 * Firebase Storage rejects (it sends no CORS headers), so the clip errors on web even though a
 * bare <video> plays it fine. This bypasses that. On native we keep expo-video (VideoView).
 */
function WebVideo({ src, onError }: { src: string; onError: () => void }) {
  return createElement('video', {
    src, muted: true, loop: true, autoPlay: true, playsInline: true, onError,
    style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  })
}

/**
 * Exercise form clip. Plays the looping video uploaded to Cloud Storage as `exercises/{id}.mp4`,
 * over its poster. If a clip hasn't been uploaded yet (or fails to load) it gracefully shows the
 * poster with a play badge, so nothing ever breaks. `poster` is a fallback image.
 */
export function TechniqueClip({ exerciseId, poster, label }: { exerciseId?: string; poster?: string; label: string }) {
  const videoUrl = exerciseId ? exerciseVideo(exerciseId) : undefined
  const uploadedPoster = exerciseId ? exercisePoster(exerciseId) : undefined
  const [posterFailed, setPosterFailed] = useState(false)
  const [webVideoFailed, setWebVideoFailed] = useState(false)
  const shownPoster = !uploadedPoster || posterFailed ? poster : uploadedPoster

  // Native uses expo-video; on web we render a bare <video> below, so don't feed the player a URL
  // on web (it would just error on the crossOrigin/CORS mismatch).
  const player = useVideoPlayer(!IS_WEB ? (videoUrl ?? null) : null, (p) => {
    if (!videoUrl || IS_WEB) return
    p.loop = true
    p.muted = true
    p.play()
  })
  const { status } = useEvent(player, 'statusChange', { status: player.status })
  const videoOk = !!videoUrl && (IS_WEB ? !webVideoFailed : status !== 'error')

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
      {videoOk &&
        (IS_WEB ? (
          <WebVideo src={videoUrl!} onError={() => setWebVideoFailed(true)} />
        ) : (
          <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="cover" nativeControls={false} />
        ))}
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
