/**
 * First-run setup gate — the full-screen surface shown when the user has no
 * username and hasn't chosen to preview. A podium graphic sets the tone ("anyone
 * can finish first"), then a single validated field claims a handle. "Preview
 * Community" lets them browse first without registering.
 *
 * The claim reuses the same validated field + availability check as the change-
 * username sheet (UsernameSetup), and persists via SET_USERNAME. On success the
 * host (Community.tsx) shows the welcome modal.
 */
import { useEffect, useRef } from 'react'
import { View, Text, Pressable, Animated, Easing, ActivityIndicator } from 'react-native'
import { Trophy, Crown, Flame, Users, Eye } from 'lucide-react-native'
import { useStore } from '../store/store'
import { useToast } from '../components/Toast'
import { useReducedMotion } from '../lib/a11y'
import { brand } from '../theme'
import { useUsernameField, UsernameField } from './UsernameSetup'
import { COMMUNITY_BACKEND } from './backendConfig'

/** One podium column: a medal disc (trophy inside) above a tinted riser. */
function Podium({ place, color, discSize, barHeight, tintBg, num, crown, delay, reduce }: {
  place: 1 | 2 | 3
  color: string
  discSize: number
  barHeight: number
  tintBg: string
  num: string
  crown?: boolean
  delay: number
  reduce: boolean
}) {
  const pop = useRef(new Animated.Value(reduce ? 1 : 0)).current
  useEffect(() => {
    if (reduce) { pop.setValue(1); return }
    Animated.timing(pop, { toValue: 1, duration: 460, delay, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }).start()
  }, [pop, delay, reduce])
  const discFg = place === 1 ? '#0a2a0a' : place === 2 ? '#14181f' : '#1c1206'
  return (
    <View className="items-center" style={{ width: place === 1 ? 80 : 76 }}>
      {crown && (
        <Animated.View style={{ marginBottom: -2, opacity: pop, transform: [{ scale: pop }] }}>
          <Crown size={24} color="#F5C518" fill="#F5C518" />
        </Animated.View>
      )}
      <Animated.View
        style={{
          width: discSize, height: discSize, borderRadius: 999, backgroundColor: color,
          alignItems: 'center', justifyContent: 'center', opacity: pop, transform: [{ scale: pop }],
          ...(place === 1 ? { shadowColor: brand[400], shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 6 } : null),
        }}
      >
        <Trophy size={Math.round(discSize * 0.48)} color={discFg} />
      </Animated.View>
      <Animated.View
        style={{
          marginTop: 9, width: '100%', height: barHeight, borderTopLeftRadius: 13, borderTopRightRadius: 13,
          backgroundColor: tintBg, alignItems: 'center', paddingTop: place === 1 ? 9 : 6,
          opacity: pop, transform: [{ scaleY: pop }],
        }}
      >
        <Text style={{ fontSize: place === 1 ? 22 : place === 2 ? 17 : 16, fontWeight: '900', color }}>{num}</Text>
      </Animated.View>
    </View>
  )
}

function InfoPill({ icon, label, color, bg }: { icon: React.ReactNode; label: string; color: string; bg: string }) {
  return (
    <View className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5" style={{ backgroundColor: bg }}>
      {icon}
      <Text style={{ fontSize: 12, fontWeight: '700', color }}>{label}</Text>
    </View>
  )
}

export function SetupGate({ onClaimed, onPreview }: { onClaimed: (name: string) => void; onPreview: () => void }) {
  const { dispatch } = useStore()
  const toast = useToast()
  const reduce = useReducedMotion()
  const { value, field, onChange } = useUsernameField('', null)
  const busyRef = useRef(false)
  const canContinue = field.kind === 'available'

  const submit = async () => {
    if (field.kind !== 'available' || busyRef.current) return
    // Live backend: claim the name transactionally first (firebase loaded on demand).
    if (COMMUNITY_BACKEND) {
      const backend = await import('./backend')
      if (backend.isCommunityBackendOn()) {
        busyRef.current = true
        try {
          await backend.claimUsernameRemote(field.canonical)
        } catch {
          busyRef.current = false
          toast('That username was just taken — try another')
          return
        }
        busyRef.current = false
      }
    }
    dispatch({ type: 'SET_USERNAME', username: field.canonical })
    onClaimed(field.canonical)
  }

  const rise = useRef(new Animated.Value(reduce ? 1 : 0)).current
  useEffect(() => {
    if (reduce) { rise.setValue(1); return }
    Animated.timing(rise, { toValue: 1, duration: 420, delay: 120, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()
  }, [rise, reduce])

  return (
    <View className="pb-4">
      {/* podium */}
      <View className="mt-1 flex-row items-end justify-center gap-3" style={{ height: 126 }}>
        <Podium place={2} color="#C7CDD6" discSize={42} barHeight={54} tintBg="rgba(199,205,214,0.16)" num="2" delay={140} reduce={reduce} />
        <Podium place={1} color={brand[400]} discSize={50} barHeight={76} tintBg="rgba(126,217,87,0.20)" num="1" crown delay={0} reduce={reduce} />
        <Podium place={3} color="#D08B4E" discSize={40} barHeight={44} tintBg="rgba(208,139,78,0.16)" num="3" delay={220} reduce={reduce} />
      </View>

      <Animated.View style={{ opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
        <View className="mt-3 items-center">
          <View className="rounded-full border border-white/12 px-2.5 py-1">
            <Text className="text-[10px] font-bold uppercase tracking-wide text-white/35">Anyone can finish first</Text>
          </View>
        </View>

        <Text className="mt-4 text-center text-[22px] font-extrabold text-white">Claim your username</Text>
        <Text className="mt-2 text-center text-[14px] leading-snug text-secondary">
          Join the streak leaderboard and compete with friends and the wider world. You can change your username later.
        </Text>

        <View className="mt-4 flex-row justify-center gap-2">
          <InfoPill icon={<Trophy size={14} color="#C7CDD6" />} label="Leagues" color="#C7CDD6" bg="rgba(199,205,214,0.14)" />
          <InfoPill icon={<Flame size={14} color="#F5A524" fill="#F5A524" />} label="Streaks" color="#F5A524" bg="rgba(245,165,36,0.14)" />
          <InfoPill icon={<Users size={14} color={brand[400]} />} label="Groups" color={brand[400]} bg="rgba(126,217,87,0.14)" />
        </View>

        <View className="mt-4">
          <UsernameField value={value} field={field} onChange={onChange} autoFocus />
          <Pressable
            onPress={submit}
            disabled={!canContinue}
            accessibilityRole="button"
            accessibilityLabel="Claim username and continue"
            accessibilityState={{ disabled: !canContinue }}
            className={`mt-3.5 min-h-[52px] flex-row items-center justify-center rounded-2xl py-4 ${canContinue ? 'bg-brand-400 active:opacity-90' : 'bg-white/10'}`}
          >
            {busyRef.current ? <ActivityIndicator size="small" color="#000" /> : <Text className={`text-[15px] font-bold ${canContinue ? 'text-black' : 'text-disabled'}`}>Continue</Text>}
          </Pressable>
          <Pressable
            onPress={onPreview}
            accessibilityRole="button"
            accessibilityLabel="Preview Community without registering"
            className="mt-2.5 min-h-[52px] flex-row items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/5 active:opacity-80"
          >
            <Eye size={16} color="rgba(255,255,255,0.7)" />
            <Text className="text-[14px] font-bold text-white/80">Preview Community</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  )
}
