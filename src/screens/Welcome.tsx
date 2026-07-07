import { useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, Image, Animated } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { LogoMark, Wordmark } from '../components/Logo'
import { img } from '../data/catalog'
import { brand } from '../theme'

const SLIDES = [
  {
    image: img.heroWorkout,
    title: 'Train smarter',
    sub: 'Programs built around your goals, your schedule and your gym.',
  },
  {
    image: img.legDay,
    title: 'Progress you can see',
    sub: 'Every set, rep and habit tracked toward the body you want.',
  },
  {
    image: img.community,
    title: 'Never train alone',
    sub: 'Your campus is training with you. Streaks, challenges, leaderboards.',
  },
]

const INTERVAL = 4200

/**
 * Premium landing screen shown before sign-in: full-bleed hero imagery that
 * slowly crossfades, brand mark up top, and the two entry actions pinned to the
 * bottom. First impressions retain users — this is the doorway.
 */
export function WelcomeScreen({ onSignUp, onLogIn }: { onSignUp: () => void; onLogIn: () => void }) {
  const insets = useSafeAreaInsets()
  const [active, setActive] = useState(0)
  const fades = useRef(SLIDES.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current

  useEffect(() => {
    const id = setInterval(() => {
      setActive((cur) => {
        const next = (cur + 1) % SLIDES.length
        Animated.parallel(
          fades.map((f, i) =>
            Animated.timing(f, { toValue: i === next ? 1 : 0, duration: 900, useNativeDriver: true }),
          ),
        ).start()
        return next
      })
    }, INTERVAL)
    return () => clearInterval(id)
  }, [fades])

  return (
    <View className="flex-1 bg-black">
      {/* crossfading hero slides (image + caption fade together) */}
      {SLIDES.map((s, i) => (
        <Animated.View key={i} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: fades[i] }}>
          <Image source={{ uri: s.image }} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
          <LinearGradient
            colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.45)', 'rgba(10,10,11,0.96)']}
            locations={[0, 0.35, 0.62, 1]}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <View style={{ position: 'absolute', left: 28, right: 28, bottom: 208 }}>
            <Text className="text-center text-4xl font-black tracking-tight text-white">{s.title}</Text>
            <Text className="mt-2.5 text-center text-[14.5px] leading-snug text-white/70">{s.sub}</Text>
          </View>
        </Animated.View>
      ))}

      {/* static chrome on top */}
      <View style={{ flex: 1, paddingTop: insets.top + 18, paddingBottom: insets.bottom + 24 }}>
        <View className="items-center">
          <View className="flex-row items-center gap-2.5">
            <LogoMark size={30} />
            <Wordmark size="sm" />
          </View>
        </View>

        <View className="flex-1" />

        {/* dots */}
        <View className="mb-6 flex-row items-center justify-center gap-2">
          {SLIDES.map((_, i) => (
            <View
              key={i}
              className="h-1.5 rounded-full"
              style={{ width: i === active ? 22 : 6, backgroundColor: i === active ? brand[400] : 'rgba(255,255,255,0.25)' }}
            />
          ))}
        </View>

        {/* entry actions */}
        <View className="px-7">
          <Pressable onPress={onSignUp} className="btn-primary w-full py-4 active:opacity-90">
            <Text className="text-[16px] font-bold text-black">Get started</Text>
          </Pressable>
          <Pressable onPress={onLogIn} className="mt-4 items-center py-2 active:opacity-70">
            <Text className="text-[14px] text-white/60">
              Already have an account? <Text className="font-bold text-brand-400">Log in</Text>
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}
