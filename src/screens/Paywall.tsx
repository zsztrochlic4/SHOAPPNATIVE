import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path, Rect, Line, Circle, Defs, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg'
import { LinearGradient } from 'expo-linear-gradient'
import { PressableScale } from '../components/PressableScale'
import { cssVars, useThemeName } from '../theme'
import { tick, thud } from '../lib/haptics'
import { startCheckout, openBillingPortal } from '../lib/billing'
import { LegalDocModal } from '../components/LegalDocModal'
import { type LegalDocKey } from '../content/legal'
import { useReducedMotion } from '../lib/a11y'

/**
 * Paywall — the post-account trial gate. Pixel-port of the "StrengthHub Paywall
 * 3d" design: a 4-week free trial then $2.99/week AUD, via Stripe Checkout.
 *
 * Shown by AuthGate whenever a signed-in user is onboarded but not yet entitled
 * (see isEntitled in store/selectors). The primary button opens Stripe Checkout;
 * the Stripe webhook then writes `entitlements/{uid}` and BillingSync flips the
 * gate, at which point AuthGate advances to the dashboard on its own.
 */

/** Local mirror of the onboarding token helper (`rgb('--token', alpha)`). */
function useTok() {
  const name = useThemeName()
  return useMemo(() => {
    const map = cssVars[name]
    const rgb = (t: string, a?: number) => {
      const parts = (map[t] || '0 0 0').split(' ')
      return a === undefined ? `rgb(${parts.join(',')})` : `rgba(${parts.join(',')},${a})`
    }
    return { rgb }
  }, [name])
}
type Tok = ReturnType<typeof useTok>

/* ─────────────────────────────── icons ──────────────────────────────────── */

function LockIcon({ color }: { color: string }) {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={5} y={11} width={14} height={9} rx={2} />
      <Path d="M8 11V8a4 4 0 0 1 8 0" />
    </Svg>
  )
}
function BellIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </Svg>
  )
}
function CardIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={2} y={5} width={20} height={14} rx={3} />
      <Line x1={2} y1={10} x2={22} y2={10} />
    </Svg>
  )
}
function ChevronLeft({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 5l-7 7 7 7" />
    </Svg>
  )
}
function AppleGlyph({ color }: { color: string }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill={color}>
      <Path d="M17.05 12.04c-.03-2.9 2.37-4.3 2.48-4.36-1.35-1.98-3.46-2.25-4.21-2.28-1.79-.18-3.5 1.06-4.41 1.06-.9 0-2.3-1.03-3.79-1-1.95.03-3.75 1.13-4.75 2.88-2.03 3.52-.52 8.73 1.46 11.59.97 1.4 2.12 2.97 3.63 2.91 1.46-.06 2.01-.94 3.77-.94 1.76 0 2.26.94 3.8.91 1.57-.03 2.56-1.42 3.52-2.83 1.11-1.62 1.57-3.19 1.59-3.27-.03-.01-3.05-1.17-3.08-4.65zM14.09 3.87c.8-.97 1.34-2.32 1.19-3.67-1.15.05-2.55.77-3.38 1.74-.74.86-1.39 2.24-1.22 3.56 1.29.1 2.6-.66 3.41-1.63z" />
    </Svg>
  )
}

/**
 * Live undulating wave — a 1:1 port of the design's `<sho-graph-wave>`
 * (graphs.js). A perpetually rippling area that still trends upward: a rising
 * baseline (0.72 → 0.10 of the inner height, left→right), an amplitude that
 * grows toward the right, and a phase that advances every frame. Geometry and
 * constants match the source exactly (viewBox 320×150, N=60, phase step 0.045,
 * 0.3→0 vertical gradient), scaled into the card's 120×56 slot with
 * preserveAspectRatio="none" just as the web design does.
 *
 * The design redraws the path each rAF tick; we mirror that with a per-frame
 * `d` update on this small isolated component (works identically on web and
 * native — no reliance on setNativeProps). Paused automatically when the page
 * isn't visible, since rAF doesn't fire then.
 */
const WAVE = { W: 320, H: 150, padX: 6, padTop: 14, padB: 10, N: 60 } as const
const WAVE_IW = WAVE.W - WAVE.padX * 2
const WAVE_IH = WAVE.H - WAVE.padTop - WAVE.padB

/** Sample the wave at a given phase as an SVG line + closed area path (design math). */
function wavePaths(phase: number): { line: string; area: string } {
  const { padX, padTop, H, padB, N } = WAVE
  const pts: [number, number][] = []
  for (let i = 0; i <= N; i++) {
    const f = i / N
    const x = padX + WAVE_IW * f
    const trend = WAVE_IH * (0.72 - 0.62 * f) // rising baseline
    const amp = WAVE_IH * 0.11 * (0.4 + f) // grows to the right
    const y = padTop + trend + Math.sin(f * 7 + phase) * amp
    pts.push([x, y])
  }
  let line = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 1; i <= N; i++) line += ` L ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`
  const area = `${line} L ${(padX + WAVE_IW).toFixed(1)} ${H - padB} L ${padX} ${H - padB} Z`
  return { line, area }
}

function WaveGraph({ tok }: { tok: Tok }) {
  const stroke = tok.rgb('--brand-400')
  const gradId = useRef('shoWave' + Math.random().toString(36).slice(2, 7)).current
  const [paths, setPaths] = useState(() => wavePaths(0))
  // Decorative motion policy (audit F-038): honour Reduce Motion (live, native
  // included) with a static frame, and halve the redraw rate — ~30fps is
  // indistinguishable for a 120px ambient wave but costs half the battery/CPU
  // on this conversion-critical screen. rAF stops while backgrounded.
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) {
      setPaths(wavePaths(0))
      return
    }
    let raf = 0
    let phase = 0
    let last = 0
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      if (t - last < 33) return
      last = t
      phase += 0.09
      setPaths(wavePaths(phase))
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [reduced])

  return (
    <View style={{ width: 120, height: 56 }}>
      <Svg width={120} height={56} viewBox={`0 0 ${WAVE.W} ${WAVE.H}`} preserveAspectRatio="none">
        <Defs>
          <SvgLinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={stroke} stopOpacity={0.3} />
            <Stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </SvgLinearGradient>
        </Defs>
        <Path d={paths.area} fill={`url(#${gradId})`} />
        <Path d={paths.line} fill="none" stroke={stroke} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  )
}

/* ─────────────────────────────── timeline ───────────────────────────────── */

function TimelineRow({
  tok, badge, eyebrow, eyebrowMuted, title, body,
}: {
  tok: Tok
  badge: React.ReactNode
  eyebrow: string
  eyebrowMuted?: boolean
  title: string
  body: string
}) {
  return (
    <View style={{ position: 'relative', flexDirection: 'row', gap: 15, alignItems: 'flex-start' }}>
      {badge}
      <View style={{ flex: 1, paddingTop: 1 }}>
        <Text style={{ fontSize: 11.5, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: eyebrowMuted ? tok.rgb('--fg', 0.45) : tok.rgb('--brand-300') }}>{eyebrow}</Text>
        <Text style={{ marginTop: 3, fontSize: 16, fontWeight: '700', color: tok.rgb('--fg') }}>{title}</Text>
        <Text style={{ marginTop: 4, fontSize: 13.5, lineHeight: 19, color: tok.rgb('--fg', 0.5) }}>{body}</Text>
      </View>
    </View>
  )
}

function Badge({ children, bg, border }: { children: React.ReactNode; bg: string; border?: string }) {
  return (
    <View style={{ width: 40, height: 40, borderRadius: 999, flexShrink: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: bg, borderWidth: border ? 1.5 : 0, borderColor: border, zIndex: 1 }}>
      {children}
    </View>
  )
}

function PayPill({ tok, children }: { tok: Tok; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: tok.rgb('--ink-800'), borderWidth: 1, borderColor: tok.rgb('--fg', 0.06) }}>
      {children}
    </View>
  )
}

/* ─────────────────────────────── screen ─────────────────────────────────── */

export function Paywall({ email, onBack }: { email?: string; onBack?: () => void }) {
  const tok = useTok()
  const insets = useSafeAreaInsets()
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [legalDoc, setLegalDoc] = useState<LegalDocKey | null>(null)

  async function start() {
    setError(null)
    setBusy(true)
    thud()
    try {
      const outcome = await startCheckout(email)
      // Web redirects away entirely ('opened'). Native returns here.
      if (outcome === 'success') setConfirming(true)
      else if (outcome === 'cancel' || outcome === 'dismiss') setBusy(false)
      // 'opened' (web): leave busy true; the page is navigating away.
    } catch (e) {
      setError((e as Error)?.message ?? 'Could not start checkout. Please try again.')
      setBusy(false)
    }
  }

  async function restore() {
    setError(null)
    tick()
    try {
      await openBillingPortal()
    } catch (e) {
      setError('No existing subscription found to restore.')
    }
  }

  const openDoc = (key: LegalDocKey) => { tick(); setLegalDoc(key) }

  return (
    <View style={{ flex: 1, backgroundColor: tok.rgb('--ink-900') }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* eyebrow + optional back */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36, marginLeft: -8 }}>
          {onBack ? (
            <Pressable onPress={() => { tick(); onBack() }} hitSlop={8} style={{ width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft color={tok.rgb('--fg', 0.7)} />
            </Pressable>
          ) : (
            <View style={{ width: 8 }} />
          )}
          <Text style={{ fontSize: 13, fontWeight: '600', letterSpacing: 0.65, textTransform: 'uppercase', color: tok.rgb('--brand-300') }}>Almost there</Text>
        </View>

        {/* title */}
        <View style={{ marginTop: 6 }}>
          <Text style={{ fontSize: 27, lineHeight: 32, fontWeight: '800', letterSpacing: -0.5, color: tok.rgb('--fg') }}>Your first 4 weeks are on us</Text>
          <Text style={{ marginTop: 10, fontSize: 15, lineHeight: 22, color: tok.rgb('--fg', 0.55) }}>Prove it to yourself before you pay a thing.</Text>
        </View>

        {/* due-today card */}
        <View style={{ marginTop: 22, padding: 20, borderRadius: 22, backgroundColor: tok.rgb('--ink-800'), borderWidth: 1, borderColor: tok.rgb('--fg', 0.05), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexShrink: 1, paddingRight: 8 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase', color: tok.rgb('--fg', 0.45) }}>Due today</Text>
            <Text style={{ marginTop: 4, fontSize: 46, fontWeight: '800', letterSpacing: -2, color: tok.rgb('--brand-400') }}>$0.00</Text>
            <Text style={{ marginTop: 2, fontSize: 13, color: tok.rgb('--fg', 0.5) }}>Then $2.99/week after 4 weeks</Text>
          </View>
          <WaveGraph tok={tok} />
        </View>

        {/* timeline */}
        <View style={{ position: 'relative', marginTop: 26, gap: 22 }}>
          <LinearGradient
            colors={[tok.rgb('--brand-400'), tok.rgb('--fg', 0.12)]}
            style={{ position: 'absolute', left: 19, top: 26, bottom: 26, width: 2 }}
          />
          <TimelineRow
            tok={tok}
            badge={<Badge bg={tok.rgb('--brand-400')}><LockIcon color="#08140a" /></Badge>}
            eyebrow="Today"
            title="Full access, free"
            // Honest scope (audit F-003 trust follow-through): the AI coach is
            // gated off pending clinical validation, so the paywall must not
            // sell it as live today.
            body="Your program, nutrition and every feature — all unlocked. AI coach joins as soon as it clears final review."
          />
          <TimelineRow
            tok={tok}
            badge={<Badge bg={tok.rgb('--brand-400', 0.15)} border={tok.rgb('--brand-400', 0.5)}><BellIcon color={tok.rgb('--brand-300')} /></Badge>}
            eyebrow="Day 25"
            eyebrowMuted
            title="A friendly reminder"
            body="So the trial never ends as a surprise."
          />
          <TimelineRow
            tok={tok}
            badge={<Badge bg={tok.rgb('--fg', 0.08)}><CardIcon color={tok.rgb('--fg', 0.55)} /></Badge>}
            eyebrow="Week 4"
            eyebrowMuted
            title="$2.99/week — only if you stay"
            body="Billed weekly in AUD. Cancel any time before this."
          />
        </View>

        <View style={{ flex: 1, minHeight: 18 }} />

        {error ? (
          <View style={{ marginTop: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)', backgroundColor: 'rgba(239,68,68,0.1)', padding: 12 }}>
            <Text style={{ fontSize: 13, color: 'rgb(252,165,165)' }}>{error}</Text>
          </View>
        ) : null}

        {/* CTA */}
        <PressableScale
          onPress={start}
          disabled={busy || confirming}
          haptic={false}
          containerStyle={{ marginTop: 24 }}
          style={{ height: 54, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: tok.rgb('--brand-400'), opacity: busy || confirming ? 0.7 : 1 }}
        >
          {busy || confirming ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ActivityIndicator color="#08140a" />
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#08140a' }}>{confirming ? 'Confirming your trial…' : 'Opening secure checkout…'}</Text>
            </View>
          ) : (
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#08140a' }}>Start my 4-week free trial</Text>
          )}
        </PressableScale>

        {/* payment badges */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14 }}>
          <PayPill tok={tok}>
            <AppleGlyph color={tok.rgb('--fg', 0.85)} />
            <Text style={{ fontSize: 12.5, fontWeight: '600', color: tok.rgb('--fg', 0.85) }}>Pay</Text>
          </PayPill>
          <PayPill tok={tok}>
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: tok.rgb('--fg', 0.85) }}>G</Text>
            <Text style={{ fontSize: 12.5, fontWeight: '600', color: tok.rgb('--fg', 0.85) }}>Pay</Text>
          </PayPill>
          <PayPill tok={tok}>
            <CardIcon color={tok.rgb('--fg', 0.85)} size={15} />
            <Text style={{ fontSize: 12.5, fontWeight: '600', color: tok.rgb('--fg', 0.85) }}>Card</Text>
          </PayPill>
        </View>
        <Text style={{ textAlign: 'center', marginTop: 9, fontSize: 11.5, color: tok.rgb('--fg', 0.4) }}>Secured by Stripe</Text>

        {/* links */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 16 }}>
          <Pressable onPress={() => openDoc('terms')} hitSlop={10} accessibilityRole="link" accessibilityLabel="Terms of Service"><Text style={{ fontSize: 12.5, color: tok.rgb('--fg', 0.4) }}>Terms</Text></Pressable>
          <Text style={{ fontSize: 12.5, color: tok.rgb('--fg', 0.28) }}>{'  ·  '}</Text>
          <Pressable onPress={() => openDoc('privacy')} hitSlop={10} accessibilityRole="link" accessibilityLabel="Privacy Policy"><Text style={{ fontSize: 12.5, color: tok.rgb('--fg', 0.4) }}>Privacy</Text></Pressable>
          <Text style={{ fontSize: 12.5, color: tok.rgb('--fg', 0.28) }}>{'  ·  '}</Text>
          <Pressable onPress={restore} hitSlop={10} accessibilityRole="button" accessibilityLabel="Restore an existing subscription"><Text style={{ fontSize: 12.5, color: tok.rgb('--fg', 0.4) }}>Restore</Text></Pressable>
        </View>
      </ScrollView>
      <LegalDocModal docKey={legalDoc} onClose={() => setLegalDoc(null)} />
    </View>
  )
}

export default Paywall
