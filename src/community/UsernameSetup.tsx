/**
 * Persistent username: the first-visit setup gate and the later "change username"
 * sheet, both built on one validated form. Format is checked on every keystroke;
 * availability is checked (debounced) against the service so "taken" is caught
 * before saving. The saved name persists via SET_USERNAME (see store + migrate).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native'
import { AtSign, Check, X, Trophy, Crown, Flame, Users, Eye } from 'lucide-react-native'
import { useStore } from '../store/store'
import { useColors, brand } from '../theme'
import { useToast } from '../components/Toast'
import { Sheet } from '../components/Sheet'
import { AppModal } from '../components/WebFrame'
import {
  checkUsernameAvailable,
  validateUsername,
  USERNAME_MAX,
  type UsernameAvailability,
} from './service'
import { COMMUNITY_BACKEND } from './backendConfig'

type FieldState =
  | { kind: 'idle' }
  | { kind: 'invalid'; message: string }
  | { kind: 'checking' }
  | { kind: 'available'; canonical: string }
  | { kind: 'taken'; message: string }
  | { kind: 'error'; message: string }

function useUsernameField(initial: string, ownHandle: string | null) {
  const [value, setValue] = useState(initial)
  const [field, setField] = useState<FieldState>({ kind: 'idle' })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tokenRef = useRef(0)

  const onChange = useCallback((raw: string) => {
    // Canonicalise as they type: lowercase, no spaces — so what they see is what
    // gets saved and checked.
    const next = raw.toLowerCase().replace(/\s+/g, '').slice(0, USERNAME_MAX)
    setValue(next)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    const token = ++tokenRef.current

    if (next === ownHandle) {
      // Re-typing the current name — nothing to change.
      setField({ kind: 'available', canonical: next })
      return
    }
    const v = validateUsername(next)
    if (!v.ok) {
      setField(next.length === 0 ? { kind: 'idle' } : { kind: 'invalid', message: v.message })
      return
    }
    setField({ kind: 'checking' })
    debounceRef.current = setTimeout(async () => {
      const res: UsernameAvailability = await checkUsernameAvailable(next, ownHandle)
      if (token !== tokenRef.current) return // superseded by a newer keystroke
      if (res.status === 'available') setField({ kind: 'available', canonical: res.canonical })
      else if (res.status === 'taken') setField({ kind: 'taken', message: res.message })
      else if (res.status === 'invalid') setField({ kind: 'invalid', message: res.message })
      else setField({ kind: 'error', message: res.message })
    }, 480)
  }, [ownHandle])

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  return { value, field, onChange }
}

/** The validated text field + inline status, shared by the gate and the sheet. */
function UsernameField({
  value,
  field,
  onChange,
  autoFocus,
}: {
  value: string
  field: FieldState
  onChange: (s: string) => void
  autoFocus?: boolean
}) {
  const colors = useColors()
  const borderColor =
    field.kind === 'available' ? `${brand[400]}aa`
    : field.kind === 'taken' || field.kind === 'invalid' || field.kind === 'error' ? `${colors.danger}aa`
    : 'rgba(255,255,255,0.12)'

  return (
    <View>
      <View
        className="flex-row items-center gap-2 rounded-2xl border bg-ink-700 px-3.5"
        style={{ borderColor, height: 54 }}
      >
        <AtSign size={18} color="rgba(255,255,255,0.4)" />
        <TextInput
          value={value}
          onChangeText={onChange}
          autoFocus={autoFocus}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          maxLength={USERNAME_MAX}
          placeholder="username"
          placeholderTextColor="rgba(255,255,255,0.3)"
          accessibilityLabel="Username"
          className="flex-1 text-[16px] font-semibold text-white"
          style={{ color: colors.fg }}
        />
        {field.kind === 'checking' && <ActivityIndicator size="small" color={brand[400]} />}
        {field.kind === 'available' && (
          <View className="h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: `${brand[400]}22` }}>
            <Check size={14} color={brand[400]} />
          </View>
        )}
        {(field.kind === 'taken' || field.kind === 'invalid' || field.kind === 'error') && (
          <View className="h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: `${colors.danger}22` }}>
            <X size={14} color={colors.danger} />
          </View>
        )}
      </View>
      <View className="mt-2 min-h-[18px] px-1">
        {field.kind === 'checking' && <Text className="text-[12px] text-tertiary">Checking availability…</Text>}
        {field.kind === 'available' && <Text className="text-[12px] font-semibold text-brand-300">Available</Text>}
        {(field.kind === 'taken' || field.kind === 'invalid' || field.kind === 'error') && (
          <Text className="text-[12px] font-semibold" style={{ color: colors.danger }}>{field.message}</Text>
        )}
        {field.kind === 'idle' && <Text className="text-[12px] text-tertiary">Letters, numbers and underscores. This is how you appear on leaderboards.</Text>}
      </View>
    </View>
  )
}

/**
 * Username claim / change sheet. The hub is browse-first: this opens when the
 * user takes an action that needs an identity (competing on the board, creating
 * or joining a group) or edits their name from the settings pill. Copy adapts
 * for a first-time claim vs an edit; both persist via SET_USERNAME.
 */
export function UsernameSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const current = state.community.username
  const isFirst = !current
  const [busy, setBusy] = useState(false)
  const { value, field, onChange } = useUsernameField(current ?? '', current)
  // Save only a valid, available name that differs from the current one.
  const canSave = field.kind === 'available' && field.canonical !== current && !busy

  const save = async () => {
    if (field.kind !== 'available' || field.canonical === current || busy) return
    // Live backend: claim the name transactionally first, so a race that lost the
    // name is caught before we commit it locally (firebase loaded on demand).
    if (COMMUNITY_BACKEND) {
      const backend = await import('./backend')
      if (backend.isCommunityBackendOn()) {
        setBusy(true)
        try {
          await backend.claimUsernameRemote(field.canonical)
        } catch {
          setBusy(false)
          toast('That username was just taken — try another')
          return
        }
        setBusy(false)
      }
    }
    dispatch({ type: 'SET_USERNAME', username: field.canonical })
    toast(isFirst ? `Welcome, @${field.canonical}` : 'Username updated')
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={isFirst ? 'Claim your username' : 'Change username'}>
      {isFirst ? (
        <View className="mb-5 items-center">
          <View className="h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: `${brand[400]}1a` }}>
            <Trophy size={26} color={brand[400]} />
          </View>
          <Text className="mt-3 max-w-[300px] text-center text-[14px] leading-snug text-secondary">
            Pick a unique name to compete on the leaderboard and join groups with friends. You can change it later.
          </Text>
        </View>
      ) : (
        <Text className="mb-4 text-[13px] leading-snug text-secondary">
          Your username is how friends find you and how you appear on every leaderboard.
        </Text>
      )}
      <UsernameField value={value} field={field} onChange={onChange} autoFocus />
      <Pressable
        onPress={save}
        disabled={!canSave}
        accessibilityRole="button"
        accessibilityLabel={isFirst ? 'Claim username' : 'Save new username'}
        accessibilityState={{ disabled: !canSave }}
        className={`mt-3 items-center rounded-2xl py-4 ${canSave ? 'bg-brand-400 active:opacity-90' : 'bg-white/10'}`}
      >
        <Text className={`text-[15px] font-bold ${canSave ? 'text-black' : 'text-disabled'}`}>{busy ? 'Saving…' : isFirst ? 'Continue' : 'Save'}</Text>
      </Pressable>
    </Sheet>
  )
}

/* ------------------------------- setup gate -------------------------------- */

// Podium tier colours (design tokens): 1st brand green, 2nd silver, 3rd bronze.
const POD = {
  first: { ring: '#7ED957', bar: 'rgba(126,217,87,0.2)', ink: '#0a2a0a' },
  second: { ring: '#C7CDD6', bar: 'rgba(199,205,214,0.16)', ink: '#14181f' },
  third: { ring: '#D08B4E', bar: 'rgba(208,139,78,0.16)', ink: '#1c1206' },
}

/** The 2/1/3 podium with a crown on first — the hero of the first-run gate. */
function Podium() {
  return (
    <View className="flex-row items-end justify-center gap-3" style={{ height: 126 }}>
      {/* 2nd */}
      <View className="items-center" style={{ width: 76 }}>
        <View className="items-center justify-center rounded-full" style={{ width: 42, height: 42, backgroundColor: POD.second.ring }}>
          <Trophy size={20} color={POD.second.ink} />
        </View>
        <View className="mt-2.5 w-full items-center rounded-t-xl pt-1.5" style={{ height: 54, backgroundColor: POD.second.bar }}>
          <Text style={{ fontSize: 17, fontWeight: '900', color: POD.second.ring }}>2</Text>
        </View>
      </View>
      {/* 1st */}
      <View className="items-center" style={{ width: 80 }}>
        <View style={{ marginBottom: -2 }}><Crown size={24} color="#F5C518" fill="#F5C518" /></View>
        <View
          className="mt-1 items-center justify-center rounded-full"
          style={{ width: 50, height: 50, backgroundColor: POD.first.ring, shadowColor: '#7ED957', shadowOpacity: 0.45, shadowRadius: 22, shadowOffset: { width: 0, height: 8 } }}
        >
          <Trophy size={24} color={POD.first.ink} />
        </View>
        <View className="mt-2.5 w-full items-center rounded-t-xl pt-2.5" style={{ height: 76, backgroundColor: POD.first.bar }}>
          <Text style={{ fontSize: 22, fontWeight: '900', color: POD.first.ring }}>1</Text>
        </View>
      </View>
      {/* 3rd */}
      <View className="items-center" style={{ width: 76 }}>
        <View className="items-center justify-center rounded-full" style={{ width: 40, height: 40, backgroundColor: POD.third.ring }}>
          <Trophy size={19} color={POD.third.ink} />
        </View>
        <View className="mt-2.5 w-full items-center rounded-t-xl pt-1.5" style={{ height: 44, backgroundColor: POD.third.bar }}>
          <Text style={{ fontSize: 16, fontWeight: '900', color: POD.third.ring }}>3</Text>
        </View>
      </View>
    </View>
  )
}

function FeaturePill({ icon, label, color, tint }: { icon: React.ReactNode; label: string; color: string; tint: string }) {
  return (
    <View className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5" style={{ backgroundColor: tint }}>
      {icon}
      <Text style={{ fontSize: 12, fontWeight: '700', color }}>{label}</Text>
    </View>
  )
}

/**
 * First-run gate (design Screen 1): claim a username before the hub unlocks, or
 * tap "Preview Community" to browse without registering. Reuses the same validated
 * username field + availability service as the change-username sheet.
 */
export function CommunitySetupGate({ onPreview, onClaimed }: { onPreview: () => void; onClaimed: (name: string) => void }) {
  const { dispatch } = useStore()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const { value, field, onChange } = useUsernameField('', null)
  const canContinue = field.kind === 'available' && !busy

  const claim = async () => {
    if (field.kind !== 'available' || busy) return
    const name = field.canonical
    if (COMMUNITY_BACKEND) {
      const backend = await import('./backend')
      if (backend.isCommunityBackendOn()) {
        setBusy(true)
        try {
          await backend.claimUsernameRemote(name)
        } catch {
          setBusy(false)
          toast('That username was just taken — try another')
          return
        }
        setBusy(false)
      }
    }
    dispatch({ type: 'SET_USERNAME', username: name })
    onClaimed(name)
  }

  return (
    <View className="pb-4 pt-1">
      <View className="mt-5"><Podium /></View>
      <View className="mt-3 flex-row justify-center">
        <Text className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-tertiary">
          Anyone can finish first
        </Text>
      </View>
      <Text className="mt-4 text-center text-[22px] font-extrabold text-white">Claim your username</Text>
      <Text className="mt-2 text-center text-[14px] leading-relaxed text-secondary">
        Join the streak leaderboard and compete with friends and the wider world. You can change your username later.
      </Text>
      <View className="mt-4 flex-row justify-center gap-2">
        <FeaturePill icon={<Trophy size={14} color="#C7CDD6" />} label="Leagues" color="#C7CDD6" tint="rgba(199,205,214,0.14)" />
        <FeaturePill icon={<Flame size={14} color="#F5A524" fill="#F5A524" />} label="Streaks" color="#F5A524" tint="rgba(245,165,36,0.14)" />
        <FeaturePill icon={<Users size={14} color="#7ED957" />} label="Groups" color="#7ED957" tint="rgba(126,217,87,0.14)" />
      </View>
      <View className="mt-4">
        <UsernameField value={value} field={field} onChange={onChange} autoFocus />
        <Pressable
          onPress={claim}
          disabled={!canContinue}
          accessibilityRole="button"
          accessibilityLabel="Claim username and continue"
          accessibilityState={{ disabled: !canContinue }}
          className={`mt-3.5 min-h-[52px] items-center justify-center rounded-2xl py-4 ${canContinue ? 'bg-brand-400 active:opacity-90' : 'bg-white/10'}`}
        >
          <Text className={`text-[15px] font-bold ${canContinue ? 'text-black' : 'text-disabled'}`}>{busy ? 'Claiming…' : 'Continue'}</Text>
        </Pressable>
        <Pressable
          onPress={onPreview}
          accessibilityRole="button"
          accessibilityLabel="Preview Community without registering"
          className="mt-2.5 min-h-[52px] flex-row items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-4 active:opacity-90"
        >
          <Eye size={16} color="rgba(255,255,255,0.7)" />
          <Text className="text-[14px] font-bold text-secondary">Preview Community</Text>
        </Pressable>
      </View>
    </View>
  )
}

/* ------------------------------ welcome modal ------------------------------ */

const WELCOME_ROWS = [
  { color: '#C7CDD6', title: 'League', body: 'Every month you compete in a league of lifters at your level. Your rank comes from your consistency score, not just how much you lift. Finish near the top to move up a tier.' },
  { color: '#F5A524', title: 'Streaks', body: 'Your streak counts the days you show up. A rest day or a freeze token keeps it alive through an off day, so one skipped session never resets you.' },
  { color: '#7ED957', title: 'Groups', body: 'Start a private group and share the code, or join one with a friend. Inside, you rank each other and chase a shared weekly team goal.' },
] as const

/** Centred "You're all set" modal shown once, right after a username is claimed.
 *  Uses AppModal + an absolute backdrop Pressable (same proven pattern as Sheet),
 *  with a plain card View so nested Pressables don't swallow the close taps. */
export function CommunityWelcomeModal({ open, onClose, name }: { open: boolean; onClose: () => void; name: string }) {
  const colors = useColors()
  return (
    <AppModal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 16 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close welcome"
          onPress={onClose}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.62)' }}
        />
        <View className="rounded-3xl border border-white/10 bg-ink-800 p-5" style={{ shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 40, shadowOffset: { width: 0, height: 24 } }}>
          <View className="mb-3.5 flex-row items-center justify-between">
            <Text className="text-[18px] font-extrabold text-white">You're all set</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close" className="h-7 w-7 items-center justify-center rounded-full bg-white/10">
              <X size={15} color={colors.fg} />
            </Pressable>
          </View>
          <Text className="mb-4 text-[13px] leading-relaxed text-secondary">
            Welcome, <Text className="font-bold text-white">@{name}</Text>. Community is where you compete on staying consistent. Here's what you'll find.
          </Text>
          <View className="gap-3.5">
            {WELCOME_ROWS.map((w) => (
              <View key={w.title} className="flex-row gap-3">
                <View className="mt-1.5 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: w.color }} />
                <View className="flex-1">
                  <Text className="text-[14px] font-bold text-white">{w.title}</Text>
                  <Text className="mt-0.5 text-[12px] leading-relaxed text-secondary">{w.body}</Text>
                </View>
              </View>
            ))}
          </View>
          <View className="mt-4 flex-row items-center gap-2 rounded-2xl bg-white/[0.04] px-3.5 py-3">
            <Settings2Placeholder />
            <Text className="flex-1 text-[12px] leading-snug text-tertiary">Change your username any time from the settings icon in the top corner.</Text>
          </View>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Explore Community" className="mt-4 items-center justify-center rounded-2xl bg-brand-400/15 py-4 active:opacity-90">
            <Text className="text-[15px] font-bold text-brand-300">Explore Community</Text>
          </Pressable>
        </View>
      </View>
    </AppModal>
  )
}

// Small at-sign/rename glyph matching the design's note row.
function Settings2Placeholder() {
  return <AtSign size={16} color="rgba(255,255,255,0.5)" />
}
