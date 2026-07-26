import { useRef, useState, createElement } from 'react'
import { View, Text, Image, Pressable } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Play, Pause } from 'lucide-react-native'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useEvent } from 'expo'
import { exerciseVideo, exercisePoster } from '../lib/media'
import { brand } from '../theme'
import { IS_WEB } from './WebFrame'

/** Seconds → "M:SS" (0 when unknown), for the player's time readout. */
function fmtTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

/**
 * A plain HTML5 <video> for the web preview. expo-video's web player sets `crossOrigin`, which
 * Firebase Storage rejects (it sends no CORS headers), so the clip errors on web even though a
 * bare <video> plays it fine. This bypasses that. On native we keep expo-video (VideoView).
 */
function WebVideo({
  src, videoRef, onError, onTime, onMeta, onPlay, onPause,
}: {
  src: string
  videoRef: { current: HTMLVideoElement | null }
  onError: () => void
  onTime: (e: { target: HTMLVideoElement }) => void
  onMeta: (e: { target: HTMLVideoElement }) => void
  onPlay: () => void
  onPause: () => void
}) {
  return createElement('video', {
    ref: videoRef, src, muted: true, loop: true, autoPlay: true, playsInline: true,
    onError, onTimeUpdate: onTime, onLoadedMetadata: onMeta, onPlay, onPause,
    style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  })
}

/** The play/pause control + time readout, over a bottom scrim for legibility. */
function ClipControls({ playing, current, duration, onToggle, accent }: { playing: boolean; current: number; duration: number; onToggle: () => void; accent: string }) {
  return (
    <>
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.55)']}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 72 }}
        pointerEvents="none"
      />
      <View style={{ position: 'absolute', left: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 11 }}>
        <Pressable
          onPress={onToggle}
          accessibilityLabel={playing ? 'Pause' : 'Play'}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}
        >
          {playing
            ? <Pause size={19} color="#000" fill="#000" />
            : <Play size={19} color="#000" fill="#000" style={{ marginLeft: 2 }} />}
        </Pressable>
        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 }}>
          {fmtTime(current)} / {fmtTime(duration)}
        </Text>
      </View>
    </>
  )
}

/**
 * Exercise form clip. Plays the looping video uploaded to Cloud Storage as `exercises/{id}.mp4`,
 * over its poster. If a clip hasn't been uploaded yet (or fails to load) it gracefully shows the
 * poster with a play badge, so nothing ever breaks. `poster` is a fallback image.
 */
export function TechniqueClip({ exerciseId, poster, label, accent = brand[400] }: { exerciseId?: string; poster?: string; label: string; accent?: string }) {
  const videoUrl = exerciseId ? exerciseVideo(exerciseId) : undefined
  const uploadedPoster = exerciseId ? exercisePoster(exerciseId) : undefined
  const [posterFailed, setPosterFailed] = useState(false)
  const [webVideoFailed, setWebVideoFailed] = useState(false)
  const shownPoster = !uploadedPoster || posterFailed ? poster : uploadedPoster

  // Web player state (driven by the bare <video>'s own events).
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [webPlaying, setWebPlaying] = useState(true)
  const [webCurrent, setWebCurrent] = useState(0)
  const [webDuration, setWebDuration] = useState(0)

  // Native uses expo-video; on web we render a bare <video> below, so don't feed the player a URL
  // on web (it would just error on the crossOrigin/CORS mismatch).
  const player = useVideoPlayer(!IS_WEB ? (videoUrl ?? null) : null, (p) => {
    if (!videoUrl || IS_WEB) return
    p.loop = true
    p.muted = true
    p.timeUpdateEventInterval = 0.25 // emit `timeUpdate` so the readout ticks
    p.play()
  })
  const { status } = useEvent(player, 'statusChange', { status: player.status })
  const { isPlaying: nativePlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing })
  const timeEvent = useEvent(player, 'timeUpdate', {
    currentTime: player.currentTime, currentLiveTimestamp: null, currentOffsetFromLive: null, bufferedPosition: 0,
  })
  const videoOk = !!videoUrl && (IS_WEB ? !webVideoFailed : status !== 'error')

  const playing = IS_WEB ? webPlaying : nativePlaying
  const current = IS_WEB ? webCurrent : (timeEvent?.currentTime ?? player.currentTime)
  const duration = IS_WEB ? webDuration : player.duration

  const toggle = () => {
    if (IS_WEB) {
      const v = videoRef.current
      if (!v) return
      if (v.paused) void v.play()
      else v.pause()
    } else {
      if (player.playing) player.pause()
      else player.play()
    }
  }

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
          <WebVideo
            src={videoUrl!}
            videoRef={videoRef}
            onError={() => setWebVideoFailed(true)}
            onTime={(e) => setWebCurrent(e.target.currentTime)}
            onMeta={(e) => setWebDuration(e.target.duration)}
            onPlay={() => setWebPlaying(true)}
            onPause={() => setWebPlaying(false)}
          />
        ) : (
          <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="cover" nativeControls={false} />
        ))}
      {videoOk && <ClipControls playing={playing} current={current} duration={duration} onToggle={toggle} accent={accent} />}
      {!videoOk && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <View className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: accent }}>
            <Play size={20} color="#000" fill="#000" />
          </View>
          <Text className="mt-2 text-[12px] font-semibold text-white/70">{label}</Text>
        </View>
      )}
    </View>
  )
}
