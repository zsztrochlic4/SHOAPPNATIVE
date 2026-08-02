import { useEffect, useRef, useState } from 'react'
import { AppState as RNAppState } from 'react-native'
import { useAuth } from '../auth/AuthProvider'
import { useStore, useStoreMeta, type WindowedHistory } from './store'
import { resetSharedCoachSession } from '../lib/coachSafety'
import { loadUserState, loadRemainingHistory, saveUserState } from './cloudRepo'
import { saveBackoffMs, MAX_SAVE_RETRIES } from './saveRetry'
import { mergeById, type HistoryEntry } from './historyMerge'
import { registerEnsureFullHistory } from './historySync'
import { registerCloudFlush } from './cloudFlush'
import { publishSyncStatus } from './syncStatus'
import { migrateAppState } from './migrate'
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
  // The identity whose data the local store currently holds (audit F-001). The
  // cloud load must not start until the store has swapped to THIS user's slot —
  // otherwise a merge could mix the previous account's in-memory state into the
  // new account's cloud copy.
  const { identity } = useStoreMeta()
  // "synced" means we've finished loading this user's cloud state, so it's now
  // safe to save changes back (never overwrite the cloud with the local seed).
  const [synced, setSynced] = useState(false)
  const syncedRef = useRef(false)
  syncedRef.current = synced
  // Publish the load state for the Settings sync row (audit F-039).
  useEffect(() => { publishSyncStatus({ synced }) }, [synced])
  const stateRef = useRef(state)
  stateRef.current = state
  const userRef = useRef(user)
  userRef.current = user
  // The last state we know is persisted, used to diff the next save so we only
  // write what changed. Seeded from the cloud baseline on load.
  const savedRef = useRef<Partial<AppState> | undefined>(undefined)
  const incompatibleCloudRef = useRef(false)

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
    incompatibleCloudRef.current = false
    if (!user) { setSynced(false); savedRef.current = undefined; return }
    // FAIL CLOSED on account switch (audit F-001): until the local store has
    // swapped to this user's own slot, do nothing — and if the cloud read
    // fails, retry with backoff rather than marking sync ready over state we
    // never verified. The user still sees their identity-scoped local state
    // (local-first); only cloud SAVES wait for a confirmed load.
    if (identity !== user.uid) { setSynced(false); return }
    let cancelled = false
    setSynced(false)
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let attemptCount = 0
    const attempt = () => {
      loadUserState(user.uid)
        .then((loaded) => {
          if (cancelled) return
          if (loaded) {
            const migration = migrateAppState({ ...stateRef.current, ...loaded.state })
            if (!migration.ok) {
              // Never let an older build overwrite a future or malformed payload.
              incompatibleCloudRef.current = true
              return
            }
            // Returning user: merge cloud over current state so any local-only
            // fields survive. Diff future saves against what's actually in the
            // cloud subcollections (empty for a legacy doc → first save migrates).
            savedRef.current = loaded.baseline
            hasMoreRef.current = Object.values(loaded.partial).some(Boolean)
            dispatch({ type: 'HYDRATE', state: migration.state })
          } else if (loaded === null) {
            // Brand-new account (no saved doc). Two cases:
            //  - The account was created at the END of onboarding (the current
            //    flow): the local state is already a real, onboarded user whose
            //    freshly-gathered answers must be PUSHED to the cloud, not wiped.
            //    Keep local and let the debounced save migrate it up.
            //  - Otherwise (a not-yet-onboarded local state): reset to a clean,
            //    un-onboarded state so they go through onboarding.
            // (A network error throws instead, landing in .catch below, so we never
            // wipe a returning user's screen just because they're offline.)
            savedRef.current = undefined
            const local = stateRef.current
            const localIsRealUser = local.profile?.onboarded === true && local.demo !== true
            if (!localIsRealUser) dispatch({ type: 'RESET_EMPTY' })
          }
          setSynced(!incompatibleCloudRef.current)
        })
        .catch(() => {
          // Offline / transient: keep showing the identity-scoped local state,
          // but NEVER mark sync ready off a failed load (that is what allowed
          // saving unverified state under a fresh sign-in). Retry with capped
          // backoff until a load actually resolves.
          if (cancelled) return
          const delay = Math.min(60_000, 5_000 * 3 ** Math.min(attemptCount, 3))
          attemptCount += 1
          retryTimer = setTimeout(attempt, delay)
        })
    }
    attempt()
    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, identity])

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
      // Full session history is now in state → build the summary projection once
      // (Phase C Option B). Applied in the same commit as the merge; the new
      // summaries + the completion flag then persist via the normal diff-save.
      dispatch({ type: 'BUILD_WORKOUT_SUMMARIES' })
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

  // ── Durable save (debounced, retried, flushed on background) ───────────────
  const savingRef = useRef(false)
  const savePendingRef = useRef(false)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryAttemptRef = useRef(0)
  const clearRetry = () => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
  }
  // Reassigned each render so timers/listeners always run the latest closure via
  // the stable ref. Reads live refs, so it never captures stale user/state.
  const saveNowRef = useRef<() => void>(() => {})
  saveNowRef.current = () => {
    const u = userRef.current
    // Don't write mid-merge: state and baseline are briefly being reconciled.
    if (!u || !syncedRef.current || hydratingHistoryRef.current || incompatibleCloudRef.current) return
    if (savingRef.current) {
      savePendingRef.current = true // a change landed during a save — save again after
      return
    }
    const snapshot = stateRef.current
    savingRef.current = true
    publishSyncStatus({ pending: true })
    saveUserState(u.uid, snapshot, savedRef.current)
      .then(() => {
        savedRef.current = snapshot
        retryAttemptRef.current = 0
        clearRetry()
        publishSyncStatus({ pending: false, error: false, lastSavedAt: Date.now() })
      })
      .catch(() => {
        // The last edit may be the final one — without a retry a transient failure
        // would silently lose it. Retry with capped backoff (reset by the next edit),
        // and surface the failure so Settings can show it with a manual retry (F-039).
        publishSyncStatus({ pending: false, error: true })
        if (!retryTimerRef.current && retryAttemptRef.current < MAX_SAVE_RETRIES) {
          const delay = saveBackoffMs(retryAttemptRef.current)
          retryAttemptRef.current += 1
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null
            saveNowRef.current()
          }, delay)
        }
      })
      .finally(() => {
        savingRef.current = false
        if (savePendingRef.current) {
          savePendingRef.current = false
          saveNowRef.current() // flush the change that arrived during the save
        }
      })
  }

  // Let sign-out flush the pending debounced save before the session ends
  // (registered via cloudFlush so AuthProvider needs no direct dependency).
  useEffect(() => {
    registerCloudFlush(async () => {
      saveNowRef.current()
      // Wait for the in-flight save to settle (bounded by requestCloudFlush).
      while (savingRef.current || savePendingRef.current) {
        await new Promise((r) => setTimeout(r, 100))
      }
    })
    return () => registerCloudFlush(null)
  }, [])

  // Debounced save on every change.
  useEffect(() => {
    if (!user || !synced) return
    retryAttemptRef.current = 0 // a fresh edit restarts the backoff budget
    const id = setTimeout(() => saveNowRef.current(), 800)
    return () => clearTimeout(id)
  }, [state, synced, user])

  // Flush immediately when the app backgrounds (OS suspend / tab hidden) so a
  // pending debounced or previously-failed save isn't lost. Works on web too
  // (RN-Web maps visibilitychange → 'background').
  useEffect(() => {
    const sub = RNAppState.addEventListener('change', (s) => {
      if (s === 'background' || s === 'inactive') saveNowRef.current()
    })
    return () => {
      sub.remove()
      clearRetry()
    }
  }, [])

  return null
}
