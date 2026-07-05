import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Platform } from 'react-native'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
  onAuthStateChanged,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth'
import { auth, firebaseEnabled } from '../lib/firebase'

type AuthState = {
  /** True while we're still figuring out if someone is logged in. */
  loading: boolean
  /** The signed-in user, or null. Always null when Firebase isn't configured. */
  user: User | null
  /** Whether a backend is wired up at all (drives demo vs real mode). */
  enabled: boolean
  signUp: (email: string, password: string, name?: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

/**
 * Wraps the app and exposes auth state. When Firebase isn't configured
 * (`firebaseEnabled === false`) this is inert: `user` stays null and the app
 * runs in local demo mode, so nothing here can break the preview.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  // If there's no backend, we're "done loading" immediately with no user.
  const [loading, setLoading] = useState(firebaseEnabled)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    if (!firebaseEnabled || !auth) return
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
    return unsub
  }, [])

  async function signUp(email: string, password: string, name?: string) {
    if (!auth) throw new Error('Accounts are not available yet.')
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
    if (name?.trim()) await updateProfile(cred.user, { displayName: name.trim() })
  }

  async function signIn(email: string, password: string) {
    if (!auth) throw new Error('Accounts are not available yet.')
    await signInWithEmailAndPassword(auth, email.trim(), password)
  }

  async function signInWithGoogle() {
    if (!auth) throw new Error('Accounts are not available yet.')
    // Popup works in the web preview (Bolt) and Expo web. Native Google sign-in
    // needs a dedicated flow (expo-auth-session); wired up in a later step.
    if (Platform.OS !== 'web') {
      throw new Error('Google sign-in on the app is coming soon — use email for now.')
    }
    await signInWithPopup(auth, new GoogleAuthProvider())
  }

  async function signOut() {
    if (auth) await fbSignOut(auth)
  }

  const value: AuthState = {
    loading,
    user,
    enabled: firebaseEnabled,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
