import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useStore, type WindowedHistory } from './store'
import { resetSharedCoachSession } from '../lib/coachSafety'
import { loadUserState, loadRemainingHistory, saveUserState } from './cloudRepo'
import { mergeById, type HistoryEntry } from './historyMerge'
import { registerEnsureFullHistory } from './historySync'
import { SCHEMA_VERSION } from './seed'
import type { AppState } from './types'

/**
 * Bridges the local store and the user's cloud copy (see cloudRepo.ts for the
 * Firestore data model). Renders nothing.
 *
 * - On sign-in: pulls the user's saved state and hydrates the store (cloud wins,
 *   so data follows them across devices). Photos aren't in the cloud, so we keep
 *   whatever is already local. To keep cold start bounded, the append-heavy
 *   collections load only a recent window (cloudRepo LOAD_POLICY); the older
 *   remainder loads lazily via `ensureFullHistory` when an all-time screen asks.
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
  const syncedRef = useRef(false)
  syncedRef.current = synced
  const stateRef = useRef(state)
  stateRef.current = state
  const userRef = useRef(user)
  userRef.current = user
  // The last state we know is persisted, used to diff the next save so we only
  // write what changed. Seeded from the cloud baseline on load.
  const savedRef = useRef<Partial<AppState> | undefined>(undefined)

  // ── Lazy full-history state (Phase C) ──────────────────────────────────────
  // Whether any windowed collection still has older docs on the server.
  const hasMoreRef = useRef(false)
  // Whether the older remainder has already been merged in this session.
  const historyLoadedRef = useRef(false)
  // Set while a full-history load is in flight OR its merge is still being
  // committed — pauses saves so the merge of state + baseline is atomic and can
  // never look like a deletion to the diff.
  const hydratingHistoryRef = useRef(false)
  // The baseline to adopt once the MERGE_HISTORY dispatch has actually committed
  // to `state`. Applied in the effect below (never eagerly), so `savedRef` is
  // only ever widened to include older docs in the same commit `state` gains
  // them — closing the window where a save could see new baseline + old state.
  const pendingBaselineRef = useRef<Partial<AppState> | null>(null)

  useEffect(() => {
    // Account switch / sign-out: drop the reducer path's in-memory coach safety state so a crisis
    // or health state can never carry across users (spec §2; in-memory only, never synced).
    resetSharedCoachSession()
    hasMoreRef.current = false
    historyLoadedRef.current = false
    hydratingHistoryRef.current = false
    pendingBaselineRef.current = null
    if (!user) { setSynced(false); savedRef.current = undefined; return }
    let cancelled = false
    setSynced(false)
    loadUserState(user.uid)
      .then((loaded) => {
        if (cancelled) return
        if (loaded && loaded.state.v === SCHEMA_VERSION) {
          // Returning user: merge cloud over current state so any local-only
          // fields survive. Diff future saves against what's actually in the
          // cloud subcollections (empty for a legacy doc → first save migrates).
          savedRef.current = loaded.baseline
          hasMoreRef.current = Object.values(loaded.partial).some(Boolean)
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

  // Load the older remainder of the windowed collections on demand (Phase C).
  // Idempotent; a no-op unless signed in, synced, there's more to load, and no
  // load is already in flight/done. Saves stay paused (hydratingHistoryRef)
  // until state AND baseline have both absorbed the older docs, so the diff can
  // never mistake the merge for a deletion.
  async function ensureFullHistory() {
    const u = userRef.current
    if (!u || !syncedRef.current) return
    if (!hasMoreRef.current || historyLoadedRef.current || hydratingHistoryRef.current) return
    hydratingHistoryRef.current = true
    try {
      const older = await loadRemainingHistory(u.uid)
      // Baseline = server truth for the whole collection: the recent window we
      // already had (server-recent, in savedRef) unioned with the older docs.
      // The recent copy wins on collision so an unsaved edit stays a diff.
      const base = (savedRef.current ?? {}) as Record<string, unknown>
      const olderMap = older as Record<string, HistoryEntry[] | undefined>
      const nextBaseline: Record<string, unknown> = { ...base }
      for (const k of Object.keys(olderMap)) {
        const cur = (base[k] as HistoryEntry[] | undefined) ?? []
        nextBaseline[k] = mergeById(cur, olderMap[k] ?? [])
      }
      // Stage the baseline; the effect below adopts it once `state` has the
      // older docs too. Saves stay paused (hydratingHistoryRef) until then.
      pendingBaselineRef.current = nextBaseline as Partial<AppState>
      historyLoadedRef.current = true
      hasMoreRef.current = false
      dispatch({ type: 'MERGE_HISTORY', history: older as unknown as WindowedHistory })
    } catch {
      // offline / transient — leave historyLoadedRef false so a later call
      // retries, and clear the guard since no merge is pending.
      hydratingHistoryRef.current = false
    }
  }

  // Adopt the staged baseline in the SAME commit `state` absorbs the merged
  // history, then release the save pause. Ordering matters: savedRef and state
  // become the full set together, so a resumed save can never see one without
  // the other (which would look like a mass deletion).
  useEffect(() => {
    if (!pendingBaselineRef.current) return
    savedRef.current = pendingBaselineRef.current
    pendingBaselineRef.current = null
    hydratingHistoryRef.current = false
  }, [state])

  // Register the implementation so any screen can trigger it via historySync.
  useEffect(() => {
    registerEnsureFullHistory(() => { void ensureFullHistory() })
    return () => registerEnsureFullHistory(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!user || !synced) return
    const id = setTimeout(() => {
      // Don't write mid-merge: state and baseline are briefly being reconciled.
      if (hydratingHistoryRef.current) return
      const snapshot = state
      saveUserState(user.uid, snapshot, savedRef.current)
        .then(() => { savedRef.current = snapshot })
        .catch(() => { /* transient write error, retried on next change */ })
    }, 800)
    return () => clearTimeout(id)
  }, [state, synced, user])

  return null
}
