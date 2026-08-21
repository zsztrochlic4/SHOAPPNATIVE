import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, ScrollView, ActivityIndicator, Platform, Animated } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path, Rect, Line, Circle } from 'react-native-svg'
import { LinearGradient } from 'expo-linear-gradient'
import { PressableScale } from '../components/PressableScale'
import { cssVars, useThemeName } from '../theme'
import { tick, thud } from '../lib/haptics'
import { startCheckout, openBillingPortal } from '../lib/billing'
import { iapActive, purchasePlan, restorePurchases } from '../lib/iap'
import { DEFAULT_PLAN, BILLING_OFFER, type PlanId } from '../lib/plans'
import { LegalDocModal } from '../components/LegalDocModal'
import { type LegalDocKey } from '../content/legal'
import { useReducedMotion } from '../lib/a11y'

/**
 * Paywall — the post-account subscription gate. A value-focused port of the
 * "StrengthHub Online — Value-Focused Paywall" design: a hero offer, a two-plan
 * selector (4-week free trial then $2/week, or $90 upfront for 52 weeks), a
 * benefit list, member testimonials and a sticky checkout footer.
 *
 * Shown by AuthGate whenever a signed-in user is onboarded but not yet entitled
 * (see isEntitled in store/selectors). The primary button starts Stripe Checkout
 * (web) or store billing (native) for the selected plan; the webhook then writes
 * `entitlements/{uid}` and BillingSync flips the gate, at which point AuthGate
 * advances to the dashboard on its own.
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

function ChevronLeft({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 5l-7 7 7 7" />
    </Svg>
  )
}
function ChevronDown({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 9l6 6 6-6" />
    </Svg>
  )
}
function CardIcon({ color, size = 15 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={2} y={5} width={20} height={14} rx={2.5} />
      <Line x1={2} y1={9.5} x2={22} y2={9.5} />
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
 * Benefit icons — 1:1 ports of the design's inline SVGs (24×24, round caps).
 * Sub-shapes the design fills with `currentColor` (chat dots, play triangle)
 * take the accent `color` directly, since react-native-svg has no currentColor.
 */
function BenefitIcon({ kind, color }: { kind: BenefitKind; color: string }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (kind) {
    case 'coach':
      return (
        <Svg {...common}>
          <Path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" />
          <Circle cx={9} cy={10} r={1.2} fill={color} stroke="none" />
          <Circle cx={12.5} cy={10} r={1.2} fill={color} stroke="none" />
          <Circle cx={16} cy={10} r={1.2} fill={color} stroke="none" />
        </Svg>
      )
    case 'play':
      return (
        <Svg {...common}>
          <Circle cx={12} cy={12} r={9} />
          <Path d="M10 8.5l6 3.5-6 3.5z" fill={color} stroke="none" />
        </Svg>
      )
    case 'dumbbell':
      return (
        <Svg {...common}>
          <Path d="M4 5h5v14H4zM15 5h5v14h-5z" />
          <Path d="M9 12h6" />
          <Path d="M2 9v6M22 9v6" />
        </Svg>
      )
    case 'learn':
      return (
        <Svg {...common}>
          <Path d="M3 6.5l9-3.5 9 3.5-9 3.5z" />
          <Path d="M6.5 9v5c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V9" />
          <Path d="M21 6.5V13" />
        </Svg>
      )
    case 'plan':
      return (
        <Svg {...common}>
          <Rect x={3} y={4.5} width={18} height={16} rx={3} />
          <Path d="M3 9h18M8 2.5v4M16 2.5v4" />
          <Path d="M8.5 14.5l2 2 4-4.5" />
        </Svg>
      )
    case 'compete':
      return (
        <Svg {...common}>
          <Path d="M6 4h12v3a6 6 0 0 1-12 0z" />
          <Path d="M6 5H3.5v1.5A3.5 3.5 0 0 0 6 9.5M18 5h2.5v1.5A3.5 3.5 0 0 1 18 9.5" />
          <Path d="M12 13v3M9 20h6M10 16h4l1 4H9z" />
        </Svg>
      )
  }
}

/* ─────────────────────────── entrance animation ─────────────────────────── */

/**
 * A block that rises + fades in on mount (design: 0.6s cubic-bezier(0.22,1,0.36,1)
 * with staggered delays). Honours Reduce Motion by rendering static (audit F-038).
 */
function Rise({ delay = 0, children, style }: { delay?: number; children: React.ReactNode; style?: object }) {
  const reduced = useReducedMotion()
  const p = useRef(new Animated.Value(reduced ? 1 : 0)).current
  useEffect(() => {
    if (reduced) { p.setValue(1); return }
    const anim = Animated.timing(p, { toValue: 1, duration: 600, delay, useNativeDriver: Platform.OS !== 'web' })
    anim.start()
    return () => anim.stop()
  }, [reduced, delay, p])
  return (
    <Animated.View style={[style, { opacity: p, transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
      {children}
    </Animated.View>
  )
}

/* ─────────────────────────────── benefits ───────────────────────────────── */

type BenefitKind = 'coach' | 'play' | 'dumbbell' | 'learn' | 'plan' | 'compete'
type Benefit = { kind: BenefitKind; token: string; title: string; desc: string }

const PRIMARY_BENEFITS: Benefit[] = [
  { kind: 'coach', token: '--brand-400', title: 'AI personal coach', desc: 'Tells you exactly what to train and eat, built around your body and goals. No more guessing.' },
  { kind: 'play', token: '--brand-400', title: 'Follow-along workouts', desc: 'Watch a real person, then copy them rep for rep. Impossible to do it wrong.' },
  { kind: 'dumbbell', token: '--accent-yellow', title: '300 recipes & 120+ workouts', desc: 'Never wonder what to eat or train again. 300 recipes and 120+ workouts, ready when you are.' },
]
const MORE_BENEFITS: Benefit[] = [
  { kind: 'learn', token: '--accent-blue', title: 'Learn as you go', desc: 'Understand the why behind your food and training, so the results stick after the app.' },
  { kind: 'plan', token: '--accent-purple', title: 'Plan mode', desc: 'Got a busy week, exams, or a holiday? Plan around it so you never fall off track.' },
  { kind: 'compete', token: '--accent-orange', title: 'Compete & win', desc: 'Climb global leaderboards and beat friends on consistency and effort.' },
]

function BenefitRow({ tok, benefit, first }: { tok: Tok; benefit: Benefit; first?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', paddingVertical: 17, borderTopWidth: first ? 0 : 1, borderTopColor: tok.rgb('--fg', 0.06) }}>
      <View style={{ width: 42, height: 42, borderRadius: 999, flexShrink: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: tok.rgb(benefit.token, 0.16) }}>
        <BenefitIcon kind={benefit.kind} color={tok.rgb(benefit.token)} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15.5, fontWeight: '700', color: tok.rgb('--fg') }}>{benefit.title}</Text>
        <Text style={{ marginTop: 3, fontSize: 13.5, lineHeight: 19, color: tok.rgb('--fg', 0.52) }}>{benefit.desc}</Text>
      </View>
    </View>
  )
}

/* ─────────────────────────────── plan tab ───────────────────────────────── */

function PlanTab({
  tok, selected, onPress, line1, line2, ribbon,
}: {
  tok: Tok
  selected: boolean
  onPress: () => void
  line1: string
  line2: string
  ribbon?: string
}) {
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.97}
      containerStyle={{ flex: 1 }}
      style={{
        overflow: 'hidden',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 16,
        borderWidth: 1.5,
        backgroundColor: selected ? tok.rgb('--brand-400', 0.14) : tok.rgb('--ink-700', 0.5),
        borderColor: selected ? tok.rgb('--brand-400', 0.6) : tok.rgb('--fg', 0.06),
      }}
    >
      {ribbon ? (
        <View style={{ position: 'absolute', top: 0, right: 0, paddingHorizontal: 8, paddingVertical: 3, borderBottomLeftRadius: 12, borderTopRightRadius: 15, backgroundColor: tok.rgb('--brand-400') }}>
          <Text style={{ fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: tok.rgb('--ink-900') }}>{ribbon}</Text>
        </View>
      ) : null}
      <Text style={{ fontSize: 14, fontWeight: '800', color: tok.rgb('--fg') }}>{line1}</Text>
      <Text style={{ marginTop: 2, fontSize: 12, fontWeight: '600', color: tok.rgb('--fg', 0.55) }}>{line2}</Text>
    </PressableScale>
  )
}

/* ─────────────────────────────── screen ─────────────────────────────────── */

export function Paywall({ email, onBack, onSignOut }: { email?: string; onBack?: () => void; onSignOut?: () => void }) {
  const tok = useTok()
  const insets = useSafeAreaInsets()
  const reduced = useReducedMotion()
  const [plan, setPlan] = useState<PlanId>(DEFAULT_PLAN)
  const [showMore, setShowMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [legalDoc, setLegalDoc] = useState<LegalDocKey | null>(null)

  const isAnnual = plan === 'annual'

  // Trial bills 28 days out; show the date so the charge is never a surprise.
  const billDate = useMemo(() => {
    const bd = new Date()
    bd.setDate(bd.getDate() + 28)
    return bd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }, [])

  // Chevron rotation for the "see more" toggle.
  const chevron = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (reduced) { chevron.setValue(showMore ? 1 : 0); return }
    const anim = Animated.timing(chevron, { toValue: showMore ? 1 : 0, duration: 250, useNativeDriver: Platform.OS !== 'web' })
    anim.start()
    return () => anim.stop()
  }, [showMore, reduced, chevron])

  // Web checkout opens in a separate tab and this screen stays mounted. On a
  // successful payment BillingSync flips `isEntitled`, which unmounts this screen
  // before the timer below fires. If the user instead returns WITHOUT completing
  // payment (entitlement never lands), release the confirming state a few seconds
  // after they refocus this tab so the paywall is usable again rather than stuck.
  useEffect(() => {
    if (!confirming || Platform.OS !== 'web' || typeof window === 'undefined') return
    let timer: ReturnType<typeof setTimeout> | undefined
    const onFocus = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { setConfirming(false); setBusy(false) }, 8000)
    }
    window.addEventListener('focus', onFocus)
    return () => { window.removeEventListener('focus', onFocus); if (timer) clearTimeout(timer) }
  }, [confirming])

  function selectPlan(next: PlanId) {
    if (next === plan) return
    tick()
    setPlan(next)
  }

  async function start() {
    setError(null)
    setBusy(true)
    thud()
    try {
      if (iapActive()) {
        // Native store billing (Apple StoreKit / Google Play Billing) via RevenueCat.
        const { ok, entitled, cancelled } = await purchasePlan(plan)
        if (cancelled || (!ok && !entitled)) setBusy(false)
        else setConfirming(true) // wait for the RevenueCat webhook → entitlements to land (BillingSync)
      } else {
        // Web (and until IAP is enabled): the Stripe hosted checkout.
        const outcome = await startCheckout(plan, email)
        // 'opened' on web now means Stripe opened in a SEPARATE tab and this app is
        // still mounted — wait in the confirming state for BillingSync to flip the
        // gate (see the focus-recovery effect for the cancel path).
        if (outcome === 'success' || outcome === 'opened') setConfirming(true)
        else if (outcome === 'cancel' || outcome === 'dismiss') setBusy(false)
      }
    } catch (e) {
      setError((e as Error)?.message ?? 'Could not start checkout. Please try again.')
      setBusy(false)
    }
  }

  async function restore() {
    setError(null)
    tick()
    try {
      if (iapActive()) {
        const { entitled } = await restorePurchases()
        if (entitled) setConfirming(true)
        else setError('No existing subscription found to restore.')
      } else {
        await openBillingPortal()
      }
    } catch (e) {
      setError('No existing subscription found to restore.')
    }
  }

  const openDoc = (key: LegalDocKey) => { tick(); setLegalDoc(key) }

  const ctaLabel = isAnnual ? `Get 12 months for ${BILLING_OFFER.annual.totalLabel}` : `Start my ${BILLING_OFFER.weekly.trialWeeks}-week free trial`
  const footerLine1 = isAnnual ? `${BILLING_OFFER.annual.totalLabel} today, ${BILLING_OFFER.annual.weeks} weeks of access` : `$0 today, then ${BILLING_OFFER.weekly.perWeekLabel} from ${billDate}`
  const footerLine2 = isAnnual ? 'Just $1.73/week, billed yearly. Renews at $90.' : `Cancel before ${billDate} and pay nothing.`

  return (
    <View style={{ flex: 1, backgroundColor: tok.rgb('--ink-900') }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: insets.top + 14, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* eyebrow + optional back + escape hatch (sign out) so a non-paying user is never trapped */}
        <Rise delay={0}>
          <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 36, marginLeft: onBack ? -8 : 0 }}>
            {onBack ? (
              <Pressable onPress={() => { tick(); onBack() }} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center' }}>
                <ChevronLeft color={tok.rgb('--fg', 0.7)} />
              </Pressable>
            ) : null}
            <Text style={{ fontSize: 12.5, fontWeight: '800', letterSpacing: 1.6, textTransform: 'uppercase', color: tok.rgb('--brand-400') }}>Almost there</Text>
            {onSignOut ? (
              <Pressable onPress={() => { tick(); onSignOut() }} hitSlop={8} accessibilityRole="button" accessibilityLabel="Sign out" style={{ marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 6 }}>
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: tok.rgb('--fg', 0.5) }}>Sign out</Text>
              </Pressable>
            ) : null}
          </View>
        </Rise>

        {/* title */}
        <Rise delay={60} style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 32, lineHeight: 35, fontWeight: '800', letterSpacing: -0.6, color: tok.rgb('--fg') }}>Your first 4 weeks are on us</Text>
          <Text style={{ marginTop: 11, fontSize: 15.5, lineHeight: 22, color: tok.rgb('--fg', 0.55) }}>Prove it to yourself before you pay a thing.</Text>
        </Rise>

        {/* pricing card */}
        <Rise delay={120} style={{ marginTop: 24 }}>
          <View style={{ borderRadius: 24, backgroundColor: tok.rgb('--ink-800'), borderWidth: 1, borderColor: tok.rgb('--fg', 0.06), overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 6 }}>
            {/* plan selector */}
            <View style={{ flexDirection: 'row', gap: 8, padding: 14, backgroundColor: tok.rgb('--ink-900', 0.4), borderBottomWidth: 1, borderBottomColor: tok.rgb('--fg', 0.07) }}>
              <PlanTab tok={tok} selected={!isAnnual} onPress={() => selectPlan('weekly')} line1="Free trial" line2={`Then ${BILLING_OFFER.weekly.perWeekLabel}`} />
              <PlanTab tok={tok} selected={isAnnual} onPress={() => selectPlan('annual')} line1="52 weeks" line2="$90 upfront" ribbon="SAVE 13%" />
            </View>

            {/* price band */}
            <View style={{ padding: 22, borderBottomWidth: 1, borderBottomColor: tok.rgb('--fg', 0.07) }}>
              <LinearGradient
                colors={[tok.rgb('--brand-400', 0.15), tok.rgb('--brand-400', 0.01)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
              />
              <Text style={{ fontSize: 11.5, fontWeight: '800', letterSpacing: 1.3, textTransform: 'uppercase', color: tok.rgb('--fg', 0.5) }}>Due today</Text>

              {isAnnual ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 8 }}>
                    <Text style={{ fontSize: 44, fontWeight: '800', letterSpacing: -1, lineHeight: 46, color: tok.rgb('--brand-400') }}>$90</Text>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: tok.rgb('--fg', 0.45), textDecorationLine: 'line-through', marginBottom: 6 }}>$104</Text>
                  </View>
                  <Text style={{ marginTop: 8, fontSize: 13.5, color: tok.rgb('--fg', 0.55) }}>One payment for 52 weeks, just $1.73/week.</Text>
                </>
              ) : (
                <>
                  <Text style={{ marginTop: 8, fontSize: 44, fontWeight: '800', letterSpacing: -1, lineHeight: 46, color: tok.rgb('--brand-400') }}>$0.00</Text>
                  <Text style={{ marginTop: 8, fontSize: 13.5, color: tok.rgb('--fg', 0.55) }}>Then $2/week starting {billDate}.</Text>

                  {/* trial timeline */}
                  <View style={{ marginTop: 20, flexDirection: 'row' }}>
                    <View style={{ position: 'absolute', left: '16%', right: '16%', top: 5, height: 2, backgroundColor: tok.rgb('--fg', 0.14) }} />
                    <TimelineNode tok={tok} label="Today" value="$0" valueColor={tok.rgb('--fg')} dot={<View style={{ width: 12, height: 12, borderRadius: 999, backgroundColor: tok.rgb('--brand-400') }} />} />
                    <TimelineNode tok={tok} label="Weeks 1-4" value="Free" valueColor={tok.rgb('--brand-400')} dot={<View style={{ width: 12, height: 12, borderRadius: 999, backgroundColor: tok.rgb('--ink-800'), borderWidth: 2, borderColor: tok.rgb('--brand-400') }} />} />
                    <TimelineNode tok={tok} label={billDate} value="$2/wk" valueColor={tok.rgb('--fg')} dot={<View style={{ width: 12, height: 12, borderRadius: 999, backgroundColor: tok.rgb('--ink-600'), borderWidth: 2, borderColor: tok.rgb('--fg', 0.2) }} />} />
                  </View>
                </>
              )}
            </View>

            {/* benefit list */}
            <View style={{ paddingHorizontal: 20, paddingVertical: 4 }}>
              {PRIMARY_BENEFITS.map((b, i) => (
                <BenefitRow key={b.title} tok={tok} benefit={b} first={i === 0} />
              ))}
              {showMore && MORE_BENEFITS.map((b) => (
                <Rise key={b.title} delay={0}>
                  <BenefitRow tok={tok} benefit={b} />
                </Rise>
              ))}
              <Pressable
                onPress={() => { tick(); setShowMore((v) => !v) }}
                accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 15, borderTopWidth: 1, borderTopColor: tok.rgb('--fg', 0.06) }}
              >
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: tok.rgb('--brand-400') }}>{showMore ? 'Show less' : 'See everything you unlock (3 more)'}</Text>
                <Animated.View style={{ transform: [{ rotate: chevron.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
                  <ChevronDown color={tok.rgb('--brand-400')} />
                </Animated.View>
              </Pressable>
            </View>
          </View>
        </Rise>

        {/* testimonials */}
        <Rise delay={200} style={{ marginTop: 16 }}>
          <View style={{ padding: 22, borderRadius: 20, backgroundColor: tok.rgb('--ink-800'), borderWidth: 1, borderColor: tok.rgb('--fg', 0.06), overflow: 'hidden' }}>
            <Text style={{ position: 'absolute', top: -14, right: 16, fontSize: 90, fontWeight: '800', color: tok.rgb('--fg', 0.06) }}>{'”'}</Text>
            <Text style={{ fontSize: 11.5, fontWeight: '800', letterSpacing: 1.3, textTransform: 'uppercase', color: tok.rgb('--fg', 0.4) }}>What members say</Text>

            <Text style={{ marginTop: 14, fontSize: 16, lineHeight: 24, color: tok.rgb('--fg', 0.92) }}>
              {'“'}I used to bookmark workouts from Instagram Reels that I always lost. Now I open StrengthHub and it <Text style={{ fontWeight: '600', color: tok.rgb('--fg') }}>simply tells me what to do</Text>.{'”'}
            </Text>
            <Text style={{ marginTop: 14, fontSize: 14, fontWeight: '600', color: tok.rgb('--fg') }}>Jedidiah O.</Text>
            <Text style={{ marginTop: 2, fontSize: 13, color: tok.rgb('--fg', 0.5) }}>StrengthHub member</Text>

            <View style={{ marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: tok.rgb('--fg', 0.08) }}>
              <Text style={{ fontSize: 16, lineHeight: 24, color: tok.rgb('--fg', 0.92) }}>
                {'“'}After six years with an in-person trainer I was skeptical about switching, but the AI coach <Text style={{ fontWeight: '600', color: tok.rgb('--fg') }}>helps me hit my goals at a fraction of the cost</Text>.{'”'}
              </Text>
              <Text style={{ marginTop: 14, fontSize: 14, fontWeight: '600', color: tok.rgb('--fg') }}>Jason A.</Text>
              <Text style={{ marginTop: 2, fontSize: 13, color: tok.rgb('--fg', 0.5) }}>StrengthHub member</Text>
            </View>
          </View>
        </Rise>

        {error ? (
          <View style={{ marginTop: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)', backgroundColor: 'rgba(239,68,68,0.1)', padding: 12 }}>
            <Text style={{ fontSize: 13, color: 'rgb(252,165,165)' }}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* sticky footer */}
      <View style={{ paddingHorizontal: 22, paddingTop: 14, paddingBottom: insets.bottom + 16, backgroundColor: tok.rgb('--ink-900'), borderTopWidth: 1, borderTopColor: tok.rgb('--fg', 0.06) }}>
        <LinearGradient
          colors={[tok.rgb('--ink-900', 0), tok.rgb('--ink-900')]}
          style={{ position: 'absolute', left: 0, right: 0, top: -26, height: 26 }}
          pointerEvents="none"
        />
        {/* disclosure panel */}
        <View style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 16, backgroundColor: tok.rgb('--ink-800', 0.78), borderWidth: 1, borderColor: tok.rgb('--fg', 0.06) }}>
          <Text style={{ textAlign: 'center', fontSize: 13.5, fontWeight: '700', color: tok.rgb('--fg', 0.9) }}>{footerLine1}</Text>
          <Text style={{ textAlign: 'center', marginTop: 3, fontSize: 12.5, color: tok.rgb('--fg', 0.55) }}>{footerLine2}</Text>
        </View>

        {/* CTA */}
        <PressableScale
          onPress={start}
          disabled={busy || confirming}
          haptic={false}
          containerStyle={{ marginTop: 12 }}
          style={{ height: 54, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: tok.rgb('--brand-400'), opacity: busy || confirming ? 0.7 : 1 }}
        >
          {busy || confirming ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ActivityIndicator color={tok.rgb('--ink-900')} />
              <Text style={{ fontSize: 17, fontWeight: '800', color: tok.rgb('--ink-900') }}>{confirming ? (isAnnual ? 'Confirming your plan…' : 'Confirming your trial…') : 'Opening secure checkout…'}</Text>
            </View>
          ) : (
            <Text style={{ fontSize: 17, fontWeight: '800', letterSpacing: -0.2, color: tok.rgb('--ink-900') }}>{ctaLabel}</Text>
          )}
        </PressableScale>

        {/* payment chips */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 12 }}>
          <PayChip tok={tok}><AppleGlyph color={tok.rgb('--fg', 0.8)} /><Text style={{ fontSize: 13, fontWeight: '600', color: tok.rgb('--fg', 0.8) }}>Pay</Text></PayChip>
          <PayChip tok={tok}><Text style={{ fontSize: 13, fontWeight: '700', color: tok.rgb('--fg', 0.8) }}>G Pay</Text></PayChip>
          <PayChip tok={tok}><CardIcon color={tok.rgb('--fg', 0.8)} /><Text style={{ fontSize: 13, fontWeight: '600', color: tok.rgb('--fg', 0.8) }}>Card</Text></PayChip>
        </View>

        {/* legal + restore */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 12 }}>
          <Pressable onPress={() => openDoc('terms')} hitSlop={10} accessibilityRole="link" accessibilityLabel="Terms of Service"><Text style={{ fontSize: 12, color: tok.rgb('--fg', 0.4) }}>Terms</Text></Pressable>
          <Text style={{ fontSize: 12, color: tok.rgb('--fg', 0.28) }}>{'   ·   '}</Text>
          <Pressable onPress={() => openDoc('privacy')} hitSlop={10} accessibilityRole="link" accessibilityLabel="Privacy Policy"><Text style={{ fontSize: 12, color: tok.rgb('--fg', 0.4) }}>Privacy</Text></Pressable>
          <Text style={{ fontSize: 12, color: tok.rgb('--fg', 0.28) }}>{'   ·   '}</Text>
          <Pressable onPress={restore} hitSlop={10} accessibilityRole="button" accessibilityLabel="Restore an existing subscription"><Text style={{ fontSize: 12, color: tok.rgb('--fg', 0.4) }}>Restore</Text></Pressable>
          <Text style={{ fontSize: 12, color: tok.rgb('--fg', 0.28) }}>{'   ·   '}</Text>
          <Text style={{ fontSize: 12, color: tok.rgb('--fg', 0.4) }}>Secured by Stripe</Text>
        </View>
      </View>

      <LegalDocModal docKey={legalDoc} onClose={() => setLegalDoc(null)} />
    </View>
  )
}

function TimelineNode({ tok, label, value, valueColor, dot }: { tok: Tok; label: string; value: string; valueColor: string; dot: React.ReactNode }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      {dot}
      <Text style={{ marginTop: 9, fontSize: 11, fontWeight: '700', color: tok.rgb('--fg', 0.5) }}>{label}</Text>
      <Text style={{ marginTop: 2, fontSize: 13, fontWeight: '800', color: valueColor }}>{value}</Text>
    </View>
  )
}

function PayChip({ tok, children }: { tok: Tok; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, backgroundColor: tok.rgb('--ink-700') }}>
      {children}
    </View>
  )
}

export default Paywall
