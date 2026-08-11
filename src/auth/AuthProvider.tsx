import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Platform } from 'react-native'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { auth, functions, firebaseEnabled } from '../lib/firebase'
import { ANON_IDENTITY, clearStoredStateFor, setActiveIdentity } from '../store/identity'
import { requestCloudFlush } from '../store/cloudFlush'
import { clearCoachWorkspaceCache } from '../lib/coachWorkspace'
import { cancelAllReminders, unregisterPush } from '../lib/notifications'
import { clearWorkoutRuntimeFor } from '../screens/activeWorkoutRuntime'
import { clearCompletionQueueFor } from '../backend/repo/completionQueue'

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
  resetPassword: (email: string) => Promise<void>
  /** Permanently delete the signed-in user's cloud data and their account. */
  deleteAccount: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

/**
 * Reject a hung auth call so the UI surfaces an error and re-enables its button
 * instead of sitting on a spinner forever (e.g. when the network is blocked in a
 * sandboxed preview). A real Firebase error still rejects first and is handled by
 * the caller's `friendlyError`; the timeout only fires when the call never settles.
 */
function withAuthTimeout<T>(p: Promise<T>, ms = 20_000): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('The connection timed out. Check your internet and try again.')), ms),
    ),
  ])
}

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
    // End the initial loading spinner exactly once — either when Firebase first
    // reports auth state, or via the fallback timeout below. This must NOT gate
    // setUser: the listener has to keep firing for every later sign-in, sign-up
    // and sign-out so the app reacts immediately (e.g. account creation logs the
    // user straight in instead of bouncing them back to the login screen).
    let loaded = false
    const finishLoading = () => {
      if (loaded) return
      loaded = true
      setLoading(false)
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      // Publish the active identity BEFORE exposing the user to the tree, so
      // the store swaps to the right per-account slot first (audit F-001).
      setActiveIdentity(u?.uid ?? ANON_IDENTITY)
      setUser(u)
      finishLoading()
    })
    // If the auth backend is unreachable (sandboxed preview, blocked network),
    // onAuthStateChanged may never fire — fall through to the app after 3s so
    // the user isn't stuck on a blank loading screen.
    const timeout = setTimeout(finishLoading, 3000)
    return () => {
      clearTimeout(timeout)
      unsub()
    }
  }, [])

  async function signUp(email: string, password: string, name?: string) {
    if (!auth) throw new Error('Accounts are not available yet.')
    const cred = await withAuthTimeout(createUserWithEmailAndPassword(auth, email.trim(), password))
    // Display name is non-critical — never let it hang or fail the whole sign-up.
    if (name?.trim()) await updateProfile(cred.user, { displayName: name.trim() }).catch(() => {})
  }

  async function signIn(email: string, password: string) {
    if (!auth) throw new Error('Accounts are not available yet.')
    await withAuthTimeout(signInWithEmailAndPassword(auth, email.trim(), password))
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

  async function resetPassword(email: string) {
    if (!auth) throw new Error('Accounts are not available yet.')
    // Sends the branded reset email configured in Firebase → Authentication → Templates.
    await sendPasswordResetEmail(auth, email.trim())
  }

  async function deleteAccount() {
    if (!auth || !auth.currentUser) throw new Error('You are not signed in.')
    const uid = auth.currentUser.uid
    // Deletion is SERVER-ONLY (audit F-002 / SA-002). The callable is AUTH-FIRST:
    // it revokes the login BEFORE destroying data, tracks its phase in a
    // tombstone, and is idempotent/resumable (a scheduled sweep finishes any job
    // a disabled account can no longer retry itself). On failure the thrown
    // error carries `details.accountDisabled` / `details.dataDeleted` so the UI
    // can tell the user the truth instead of a blanket "nothing was deleted".
    if (!functions) {
      throw new Error('Account deletion needs a connection to our servers. Please try again once you are back online.')
    }
    await httpsCallable(functions, 'deleteAccount', { timeout: 300_000 })()
    // Server purge succeeded — scrub every local trace of the account.
    await scrubLocalAccount(uid)
    await fbSignOut(auth).catch(() => {}) // clear the now-defunct local session
  }

  // Remove every on-device trace of an account (audit SA-020). Shared by
  // deletion and sign-out so the two can never drift on what "local health data"
  // covers: AppState, coach cache, active-workout runtime, completion queue,
  // local reminders and the push token.
  async function scrubLocalAccount(uid: string) {
    await unregisterPush(uid).catch(() => {})
    await cancelAllReminders().catch(() => {})
    await clearCoachWorkspaceCache(uid).catch(() => {})
    await clearWorkoutRuntimeFor(uid).catch(() => {}) // audit SA-005/SA-020
    await clearCompletionQueueFor(uid).catch(() => {}) // audit SA-020
    await clearStoredStateFor(uid).catch(() => {})
  }

  async function signOut() {
    if (!auth) return
    const uid = auth.currentUser?.uid
    if (uid) {
      // While still authenticated: push any last pending edit to the cloud, then
      // scrub every on-device trace of this account (audit F-001/F-004/F-005/
      // SA-020) — AppState, coach cache, active-workout runtime, completion
      // queue, local reminders and the push token — so nothing stays readable
      // or resumable on a shared device.
      await requestCloudFlush()
      await scrubLocalAccount(uid)
    }
    await fbSignOut(auth)
  }

  const value: AuthState = {
    loading,
    user,
    enabled: firebaseEnabled,
    signUp,
    signIn,
    signInWithGoogle,
    resetPassword,
    deleteAccount,
    signOut,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
