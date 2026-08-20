/**
 * First-run Welcome tour — the four cards a paid user sees the very first time they
 * land in the app, sitting over a dimmed dashboard (the dashboard renders behind).
 *
 * It walks a new user through Welcome → Train → Nutrition → Community. Advance with
 * the primary button, a left swipe, or the Right arrow (web); go back with a right
 * swipe or the Left arrow; leave early via "Skip tour" or Escape. Completing or
 * skipping persists `settings.welcomeTourSeen`, so it shows exactly once per account
 * (settings sync across devices). See the design handoff (Welcome tour) for the spec.
 *
 * The card is a fixed 281×252 box on every step — only its base colour, accent and
 * content change — so the cross-fades stay rock steady. The card is intrinsically a
 * dark, saturated surface (a per-step colour under a constant dark radial overlay),
 * so its foreground is always near-white regardless of the app's light/dark theme.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, Platform, type TextInput } from 'react-native'
import { GestureDetector, Gesture } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Path, Rect, Circle, Text as SvgText, TSpan, Defs, RadialGradient, Stop } from 'react-native-svg'
import { useStore } from '../store/store'
import { buildWelcomeSteps } from './welcomeTourContent'
import { PressableScale } from '../components/PressableScale'
import { motionDuration, focusRef } from '../lib/a11y'
import { tick, thud } from '../lib/haptics'
import { IS_WEB } from '../components/WebFrame'

/* ------------------------------- content ------------------------------- */

/** Foreground is always near-white on the card (a dark colored surface), independent of app theme. */
const FG = '255, 255, 255'
const fg = (a = 1) => `rgba(${FG}, ${a})`

/** Per-step base fill (the bright corner) and its readable accent tint. */
const BASE = ['rgb(99,165,71)', 'rgb(52,116,214)', 'rgb(84,64,138)', 'rgb(181,112,30)']
const ACCENT = ['rgb(178,235,140)', 'rgb(125,190,255)', 'rgb(190,170,250)', 'rgb(245,195,130)']

/* -------------------------------- icons -------------------------------- */

/** The per-step glyph, stroked in that step's accent. Paths mirror the handoff icon set exactly. */
function StepGlyph({ step, accent }: { step: number; accent: string }) {
  const common = { stroke: accent, strokeWidth: 1.9, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (step === 0) {
    // "SH" monogram (S upright, H italic), derived from the app favicon.
    return (
      <Svg width={20} height={20} viewBox="0 0 24 24">
        <SvgText x={12} y={17} textAnchor="middle" fontSize={15} fontWeight="800" fill={accent} letterSpacing={-0.5}>
          S<TSpan fontStyle="italic">H</TSpan>
        </SvgText>
      </Svg>
    )
  }
  if (step === 1) {
    // Dumbbell, rotated -45° and scaled up, stroke 1.7.
    return (
      <Svg width={20} height={20} viewBox="0 0 24 24">
        <Path {...common} strokeWidth={1.7} transform="rotate(-45 12 12) scale(1.18) translate(-1.85 -1.85)" d="M9 12h6" />
        <Rect {...common} strokeWidth={1.7} transform="rotate(-45 12 12) scale(1.18) translate(-1.85 -1.85)" x={6.6} y={7.8} width={2.6} height={8.4} rx={1.3} />
        <Rect {...common} strokeWidth={1.7} transform="rotate(-45 12 12) scale(1.18) translate(-1.85 -1.85)" x={14.8} y={7.8} width={2.6} height={8.4} rx={1.3} />
        <Rect {...common} strokeWidth={1.7} transform="rotate(-45 12 12) scale(1.18) translate(-1.85 -1.85)" x={3.9} y={9.4} width={2.4} height={5.2} rx={1.2} />
        <Rect {...common} strokeWidth={1.7} transform="rotate(-45 12 12) scale(1.18) translate(-1.85 -1.85)" x={17.7} y={9.4} width={2.4} height={5.2} rx={1.2} />
      </Svg>
    )
  }
  if (step === 2) {
    // Apple.
    return (
      <Svg width={20} height={20} viewBox="0 0 24 24">
        <Path {...common} d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z" />
        <Path {...common} d="M10 2c1 .5 2 2 2 5" />
      </Svg>
    )
  }
  // Two-person group.
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path {...common} d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <Circle {...common} cx={9} cy={7} r={4} />
      <Path {...common} d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <Path {...common} d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  )
}

/* --------------------------------- dot --------------------------------- */

/** One progress dot: a 6px pip that grows to a 22px accent pill while it's the active step. */
function Dot({ active, accent }: { active: boolean; accent: string }) {
  const p = useSharedValue(active ? 1 : 0)
  useEffect(() => {
    p.value = withTiming(active ? 1 : 0, { duration: motionDuration(220), easing: Easing.out(Easing.ease) })
  }, [active, p])
  const style = useAnimatedStyle(() => ({
    width: interpolate(p.value, [0, 1], [6, 22]),
    backgroundColor: interpolateColor(p.value, [0, 1], [fg(0.2), accent]),
  }))
  return <Animated.View style={[{ height: 6, borderRadius: 3 }, style]} />
}

/* -------------------------------- tour --------------------------------- */

export function WelcomeTour({ onFinish }: { onFinish: () => void }) {
  const { state } = useStore()
  const [steps] = useState(() =>
    buildWelcomeSteps({
      name: state.profile.name,
      goal: state.profile.goal,
      daysPerWeek: state.profile.daysPerWeek,
    }),
  )
  const [step, setStep] = useState(0)
  const last = step === steps.length - 1
  const titleRef = useRef<TextInput | null>(null)
  const exitingRef = useRef(false)

  // Entrance (card rises + scales in), per-step content fade, card colour cross-fade, exit, and drag.
  const enter = useSharedValue(0)
  const exit = useSharedValue(0)
  const bgP = useSharedValue(0)
  const contentT = useSharedValue(1)
  const dragX = useSharedValue(0)

  useEffect(() => {
    enter.value = withTiming(1, { duration: motionDuration(350), easing: Easing.bezier(0.2, 0.9, 0.3, 1) })
  }, [enter])

  // Cross-fade the base colour and fade the content in on every step change.
  useEffect(() => {
    bgP.value = withTiming(step, { duration: motionDuration(340), easing: Easing.inOut(Easing.ease) })
    contentT.value = 0
    contentT.value = withTiming(1, { duration: motionDuration(220), easing: Easing.out(Easing.ease) })
    // Announce the new step to screen readers by moving focus to its title.
    const t = setTimeout(() => focusRef(titleRef), 80)
    return () => clearTimeout(t)
  }, [step, bgP, contentT])

  const finish = useCallback(() => {
    if (exitingRef.current) return
    exitingRef.current = true
    thud()
    // Play the exit (card + scrim fade out), then dismiss. Dismissal is driven from a JS timer so it
    // never depends on the animation's completion callback firing — the overlay must always clear.
    const d = motionDuration(240)
    exit.value = withTiming(1, { duration: d, easing: Easing.in(Easing.ease) })
    setTimeout(onFinish, d)
  }, [exit, onFinish])

  const goNext = useCallback(() => {
    if (exitingRef.current) return
    if (last) { finish(); return }
    tick()
    setStep((s) => Math.min(s + 1, steps.length - 1))
  }, [last, finish, steps.length])

  const goBack = useCallback(() => {
    if (exitingRef.current || step === 0) return
    tick()
    setStep((s) => Math.max(s - 1, 0))
  }, [step])

  // Physical-keyboard navigation on web (Left/Right arrows, Escape) — no-op on native.
  useEffect(() => {
    if (!IS_WEB || typeof document === 'undefined') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goBack() }
      else if (e.key === 'Escape') { e.preventDefault(); finish() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [goNext, goBack, finish])

  // Horizontal swipe: left → advance, right → go back. Commits past 45px of clearly-horizontal travel.
  const swipe = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      'worklet'
      // The card trails the finger at half speed so the drag reads as direct but stays contained.
      dragX.value = e.translationX * 0.5
    })
    .onEnd((e) => {
      'worklet'
      const dx = e.translationX
      if (Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(e.translationY)) {
        if (dx < 0) runOnJS(goNext)()
        else runOnJS(goBack)()
      }
    })
    .onFinalize(() => {
      'worklet'
      dragX.value = withSpring(0, { stiffness: 150, damping: 16 })
    })

  const scrimStyle = useAnimatedStyle(() => ({ opacity: enter.value * (1 - exit.value) }))
  const cardStyle = useAnimatedStyle(() => {
    const enterScale = interpolate(enter.value, [0, 1], [0.98, 1])
    const exitScale = interpolate(exit.value, [0, 1], [1, 0.96])
    return {
      opacity: enter.value * (1 - exit.value),
      transform: [
        { translateX: dragX.value },
        { translateY: interpolate(enter.value, [0, 1], [24, 0]) + exit.value * 10 },
        { scale: enterScale * exitScale },
      ],
    }
  })
  const bgStyle = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(bgP.value, [0, 1, 2, 3], BASE) }))
  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentT.value,
    transform: [{ translateY: interpolate(contentT.value, [0, 1], [6, 0]) }],
  }))

  const s = steps[step]
  const accent = ACCENT[step]

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Dimmed scrim over the dashboard. Tapping it does nothing (dismiss via Skip / finish only). */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} />

      <View style={styles.center} pointerEvents="box-none">
        <GestureDetector gesture={swipe}>
          <Animated.View
            accessibilityRole={Platform.OS === 'web' ? undefined : 'none'}
            accessibilityViewIsModal
            style={[styles.card, cardStyle]}
          >
            {/* Base colour animates between steps… */}
            <Animated.View style={[StyleSheet.absoluteFill, bgStyle]} />
            {/* …under a constant dark radial overlay so text stays legible toward the bottom-right. */}
            <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
              <Defs>
                <RadialGradient id="tourOverlay" cx="0.18" cy="-0.08" rx="1.35" ry="0.95" gradientUnits="objectBoundingBox">
                  <Stop offset="0" stopColor="rgb(0,0,0)" stopOpacity={0} />
                  <Stop offset="0.42" stopColor="rgb(0,0,0)" stopOpacity={0.35} />
                  <Stop offset="0.88" stopColor="rgb(6,6,9)" stopOpacity={0.86} />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#tourOverlay)" />
            </Svg>

            {/* Header: icon badge + kicker. */}
            <View style={styles.header}>
              <View style={[styles.badge, { backgroundColor: accentAlpha(accent, 0.14) }]}>
                <StepGlyph step={step} accent={accent} />
              </View>
              <Text style={[styles.kicker, { color: accent }]}>{s.kicker}</Text>
            </View>

            {/* Content (fades in on each step). Absorbs slack so the footer stays anchored. */}
            <Animated.View style={[styles.content, contentStyle]}>
              <Text
                ref={titleRef as never}
                accessibilityRole="header"
                style={styles.title}
              >
                {s.title}
              </Text>
              <Text style={styles.lead}>{s.lead}</Text>
              {s.secondary ? <Text style={styles.secondary}>{s.secondary}</Text> : null}
            </Animated.View>

            {/* Progress dots. */}
            <View
              style={styles.dots}
              accessibilityRole={Platform.OS === 'web' ? undefined : 'progressbar'}
              accessibilityLabel={`Step ${step + 1} of ${steps.length}`}
            >
              {steps.map((_, i) => (
                <Dot key={i} active={i === step} accent={ACCENT[i]} />
              ))}
            </View>

            {/* Footer: Skip (left) + primary (right). */}
            <View style={styles.footer}>
              <PressableScale
                haptic={false}
                scaleTo={0.97}
                onPress={finish}
                accessibilityRole="button"
                accessibilityLabel="Skip tour"
                style={styles.skip}
              >
                <Text style={styles.skipText}>Skip tour</Text>
              </PressableScale>
              <PressableScale
                haptic={false}
                scaleTo={0.97}
                onPress={goNext}
                accessibilityRole="button"
                accessibilityLabel={last ? "Let's get started" : 'Next'}
                style={[styles.primary, { backgroundColor: accent }]}
              >
                <Text style={styles.primaryText}>{last ? "Let's get started" : 'Next'}</Text>
              </PressableScale>
            </View>
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  )
}

/** Tint an `rgb(r,g,b)` accent string at a given alpha (accents are authored as rgb() literals). */
function accentAlpha(rgb: string, a: number): string {
  const m = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (!m) return rgb
  return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${a})`
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(0,0,0,0.55)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  card: {
    width: '100%',
    maxWidth: 252,
    height: 281,
    borderRadius: 24,
    paddingTop: 16,
    paddingLeft: 18,
    paddingRight: 18,
    paddingBottom: 24,
    overflow: 'hidden',
    // 0 24px 60px rgba(0,0,0,0.65) + a subtle top inner highlight (approximated with elevation on Android).
    shadowColor: '#000',
    shadowOpacity: 0.65,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 24 },
    elevation: 24,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontSize: 9, fontWeight: '700', letterSpacing: 1.08, textTransform: 'uppercase' },
  content: { flex: 1 },
  title: { marginTop: 12, fontSize: 18, fontWeight: '800', letterSpacing: -0.18, lineHeight: 22, color: fg(1) },
  lead: { marginTop: 8, fontSize: 13.5, lineHeight: 19.6, fontWeight: '600', color: fg(0.92) },
  secondary: { marginTop: 11, fontSize: 12.5, lineHeight: 18.1, fontWeight: '400', color: fg(0.82) },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 6 },
  footer: { marginTop: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skip: { minHeight: 44, justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 8, marginLeft: -4, borderRadius: 12 },
  skipText: { fontSize: 13, fontWeight: '600', color: fg(0.72) },
  primary: { minHeight: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 26 },
  primaryText: { fontSize: 14, fontWeight: '700', color: 'rgb(10,10,11)' },
})
