import { useMemo, useState } from 'react'
import { View, Text, Pressable, ScrollView, ActivityIndicator, Linking } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path, Rect, Line, Circle } from 'react-native-svg'
import { LinearGradient } from 'expo-linear-gradient'
import { PressableScale } from '../components/PressableScale'
import { cssVars, useThemeName } from '../theme'
import { tick, thud } from '../lib/haptics'
import { startCheckout, openBillingPortal } from '../lib/billing'

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

/** Small rising area chart echoing the design's <sho-graph-wave>. */
function WaveGraph({ tok }: { tok: Tok }) {
  const stroke = tok.rgb('--brand-400')
  const fill = tok.rgb('--brand-400', 0.14)
  return (
    <Svg width={120} height={56} viewBox="0 0 120 56">
      <Path d="M0 44 C 24 40, 40 34, 60 26 S 96 10, 120 6 L 120 56 L 0 56 Z" fill={fill} />
      <Path d="M0 44 C 24 40, 40 34, 60 26 S 96 10, 120 6" fill="none" stroke={stroke} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
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

  const openLink = (url: string) => { tick(); void Linking.openURL(url).catch(() => {}) }

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
            body="Program, AI coach and nutrition — all unlocked."
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
          <Pressable onPress={() => openLink('https://strengthhubonline.com/terms')} hitSlop={6}><Text style={{ fontSize: 12.5, color: tok.rgb('--fg', 0.4) }}>Terms</Text></Pressable>
          <Text style={{ fontSize: 12.5, color: tok.rgb('--fg', 0.28) }}>{'  ·  '}</Text>
          <Pressable onPress={() => openLink('https://strengthhubonline.com/privacy')} hitSlop={6}><Text style={{ fontSize: 12.5, color: tok.rgb('--fg', 0.4) }}>Privacy</Text></Pressable>
          <Text style={{ fontSize: 12.5, color: tok.rgb('--fg', 0.28) }}>{'  ·  '}</Text>
          <Pressable onPress={restore} hitSlop={6}><Text style={{ fontSize: 12.5, color: tok.rgb('--fg', 0.4) }}>Restore</Text></Pressable>
        </View>
      </ScrollView>
    </View>
  )
}

export default Paywall
