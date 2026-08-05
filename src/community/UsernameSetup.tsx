/**
 * Persistent username: the first-visit setup gate and the later "change username"
 * sheet, both built on one validated form. Format is checked on every keystroke;
 * availability is checked (debounced) against the service so "taken" is caught
 * before saving. The saved name persists via SET_USERNAME (see store + migrate).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native'
import { AtSign, Check, X, Trophy } from 'lucide-react-native'
import { useStore } from '../store/store'
import { useColors, brand } from '../theme'
import { useToast } from '../components/Toast'
import { Sheet } from '../components/Sheet'
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
