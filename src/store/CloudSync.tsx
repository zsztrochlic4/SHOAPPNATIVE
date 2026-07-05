import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useStore } from './store'
import { loadUserState, saveUserState } from './cloudSync'
import { SCHEMA_VERSION } from './seed'

/**
 * Bridges the local store and the user's cloud copy. Renders nothing.
 *
 * - On sign-in: pulls the user's saved state from Firestore and hydrates the
 *   store (cloud wins, so data follows them across devices). Photos aren't in
 *   the cloud doc, so we keep whatever photos are already local.
 * - While signed in: debounce-saves the state back to the cloud on every change.
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

  useEffect(() => {
    if (!user) { setSynced(false); return }
    let cancelled = false
    setSynced(false)
    loadUserState(user.uid)
      .then((cloud) => {
        if (cancelled) return
        if (cloud && cloud.v === SCHEMA_VERSION) {
          // Returning user: merge cloud over current state so local-only fields
          // (photos) survive.
          dispatch({ type: 'HYDRATE', state: { ...stateRef.current, ...cloud } })
        } else if (cloud === null) {
          // Brand-new account (no saved doc): start on a clean, un-onboarded
          // state so they go through onboarding; their answers then save to the
          // cloud. (A network error throws instead, landing in .catch below, so
          // we never wipe a returning user's screen just because they're offline.)
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
      saveUserState(user.uid, state).catch(() => { /* transient write error, retried on next change */ })
    }, 800)
    return () => clearTimeout(id)
  }, [state, synced, user])

  return null
}
