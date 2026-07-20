import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useStore } from './store'
import { resetSharedCoachSession } from '../lib/coachSafety'
import { loadUserState, saveUserState } from './cloudRepo'
import { SCHEMA_VERSION } from './seed'
import type { AppState } from './types'

/**
 * Bridges the local store and the user's cloud copy (see cloudRepo.ts for the
 * Firestore data model). Renders nothing.
 *
 * - On sign-in: pulls the user's saved state and hydrates the store (cloud wins,
 *   so data follows them across devices). Photos aren't in the cloud, so we keep
 *   whatever is already local.
 * - While signed in: debounce-saves changes back to the cloud, writing only the
 *   entries that actually changed since the last save.
 *
 * Inert when signed out or when Firebase isn't configured.
 */
export function CloudSync() {
  const { user } = useAuth()
  const { state, dispatch } = useStore()
  // "synced" means we've finished loading this user's cloud state, so it's now
  // safe to save changes back (never overwrite the cloud with the local seed).
  const [synced, setSynced] = useState(false)
  const stateRef = useRef(state)
  stateRef.current = state
  // The last state we know is persisted, used to diff the next save so we only
  // write what changed. Seeded from the cloud baseline on load.
  const savedRef = useRef<Partial<AppState> | undefined>(undefined)

  useEffect(() => {
    // Account switch / sign-out: drop the reducer path's in-memory coach safety state so a crisis
    // or health state can never carry across users (spec §2; in-memory only, never synced).
    resetSharedCoachSession()
    if (!user) { setSynced(false); savedRef.current = undefined; return }
    let cancelled = false
    setSynced(false)
    loadUserState(user.uid)
      .then((loaded) => {
        if (cancelled) return
        if (loaded && loaded.state.v === SCHEMA_VERSION) {
          // Returning user: merge cloud over current state so local-only fields
          // (photos) survive. Diff future saves against what's actually in the
          // cloud subcollections (empty for a legacy doc → first save migrates).
          savedRef.current = loaded.baseline
          dispatch({ type: 'HYDRATE', state: { ...stateRef.current, ...loaded.state } as AppState })
        } else if (loaded === null) {
          // Brand-new account (no saved doc): start on a clean, un-onboarded
          // state so they go through onboarding; their answers then save to the
          // cloud. (A network error throws instead, landing in .catch below, so
          // we never wipe a returning user's screen just because they're offline.)
          savedRef.current = undefined
          dispatch({ type: 'RESET_EMPTY' })
        }
      })
      .catch(() => { /* offline / transient — keep local state, save later */ })
      .finally(() => { if (!cancelled) setSynced(true) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid])

  useEffect(() => {
    if (!user || !synced) return
    const id = setTimeout(() => {
      const snapshot = state
      saveUserState(user.uid, snapshot, savedRef.current)
        .then(() => { savedRef.current = snapshot })
        .catch(() => { /* transient write error, retried on next change */ })
    }, 800)
    return () => clearTimeout(id)
  }, [state, synced, user])

  return null
}
