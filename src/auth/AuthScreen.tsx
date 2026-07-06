import { useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LogoMark } from '../components/Logo'
import { useAuth } from './AuthProvider'
import { brand } from '../theme'

/** Turn Firebase's error codes into friendly, human sentences. */
function friendlyError(code: string): string {
  switch (code) {
    case 'auth/invalid-email': return 'That email address doesn’t look right.'
    case 'auth/missing-password': return 'Please enter a password.'
    case 'auth/weak-password': return 'Password should be at least 6 characters.'
    case 'auth/email-already-in-use': return 'An account with this email already exists — try signing in.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found': return 'Wrong email or password.'
    case 'auth/too-many-requests': return 'Too many attempts. Please wait a moment and try again.'
    case 'auth/network-request-failed': return 'Network error. Check your connection and try again.'
    default: return 'Something went wrong. Please try again.'
  }
}

export function AuthScreen({ initialMode = 'signin', onBack }: { initialMode?: 'signin' | 'signup'; onBack?: () => void }) {
  const insets = useSafeAreaInsets()
  const { signIn, signUp, signInWithGoogle } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    setBusy(true)
    try {
      if (mode === 'signup') await signUp(email, password, name)
      else await signIn(email, password)
      // On success the auth listener swaps this screen out automatically.
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code ?? ''
      setError(friendlyError(code) || (e as Error)?.message || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  async function google() {
    setError(null)
    setBusy(true)
    try {
      await signInWithGoogle()
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code ?? ''
      setError((e as Error)?.message && code === '' ? (e as Error).message : friendlyError(code))
    } finally {
      setBusy(false)
    }
  }

  const isSignup = mode === 'signup'

  return (
    <View className="flex-1 bg-ink-900" style={{ paddingTop: insets.top }}>
      {onBack && (
        <Pressable onPress={onBack} hitSlop={10} className="absolute left-4 z-10 h-10 w-10 items-center justify-center rounded-full bg-white/5 active:opacity-70" style={{ top: insets.top + 10 }}>
          <Text className="text-lg text-white/70">‹</Text>
        </Pressable>
      )}
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-8 items-center">
          <LogoMark size={52} />
          <Text className="mt-4 text-2xl font-extrabold tracking-tight text-white">StrengthHub Online</Text>
          <Text className="mt-1 text-[14px] text-white/50">{isSignup ? 'Create your account' : 'Welcome back'}</Text>
        </View>

        {isSignup && (
          <Field label="Name" value={name} onChangeText={setName} placeholder="Alex Morgan" autoCapitalize="words" />
        )}
        <Field
          label="Email" value={email} onChangeText={setEmail} placeholder="you@university.edu"
          keyboardType="email-address" autoCapitalize="none" autoComplete="email"
        />
        <Field
          label="Password" value={password} onChangeText={setPassword} placeholder="••••••••"
          secureTextEntry autoCapitalize="none"
        />

        {error && (
          <View className="mt-3 rounded-xl border border-red-500/25 bg-red-500/10 p-3">
            <Text className="text-[13px] text-red-300">{error}</Text>
          </View>
        )}

        <Pressable
          onPress={submit}
          disabled={busy}
          className={`btn-primary mt-5 w-full active:opacity-90 ${busy ? 'opacity-60' : ''}`}
        >
          {busy ? <ActivityIndicator color="#000" /> : (
            <Text className="font-semibold text-black">{isSignup ? 'Create account' : 'Sign in'}</Text>
          )}
        </Pressable>

        <View className="my-5 flex-row items-center gap-3">
          <View className="h-px flex-1 bg-white/10" />
          <Text className="text-[12px] text-white/35">or</Text>
          <View className="h-px flex-1 bg-white/10" />
        </View>

        <Pressable
          onPress={google}
          disabled={busy}
          className={`w-full flex-row items-center justify-center gap-2 rounded-full border border-white/15 bg-ink-800 py-3 active:opacity-90 ${busy ? 'opacity-60' : ''}`}
        >
          <Text className="font-semibold text-white">Continue with Google</Text>
        </Pressable>

        <Pressable onPress={() => { setMode(isSignup ? 'signin' : 'signup'); setError(null) }} className="mt-6 active:opacity-70">
          <Text className="text-center text-[14px] text-white/55">
            {isSignup ? 'Already have an account? ' : 'New here? '}
            <Text className="font-bold" style={{ color: brand[400] }}>{isSignup ? 'Sign in' : 'Create one'}</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View className="mt-3">
      <Text className="mb-1.5 text-[12px] font-semibold text-white/50">{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor="rgba(148,148,148,0.6)"
        className="w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-[15px] text-white"
      />
    </View>
  )
}
