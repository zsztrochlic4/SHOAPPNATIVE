import { useEffect } from 'react'
import { useDispatch } from '../store/store'
import { coachOperational } from '../lib/coachSafety'
import { fetchCoachWorkspace, readCachedCoachWorkspace } from '../lib/coachWorkspace'

/**
 * Keeps the local mirror of the coach's `proactiveEnabled` preference in step with the server for a
 * signed-in user, so the dashboard proactive check-in card gates correctly without the user first
 * opening the coach settings screen. Offline-first: it applies the cached workspace immediately,
 * then refreshes from the server. Dormant (and mounts nothing) while the coach is not operational.
 *
 * This only mirrors the gating preference into `settings` — the coach workspace itself (memories,
 * consent) is still fetched lazily by the coach surfaces that need it.
 */
export function CoachWorkspaceSync() {
  const dispatch = useDispatch()
  useEffect(() => {
    if (!coachOperational()) return
    let cancelled = false
    const mirror = (proactiveEnabled: boolean) => {
      if (!cancelled) dispatch({ type: 'SET_SETTINGS', patch: { coachProactiveEnabled: proactiveEnabled } })
    }
    void (async () => {
      const cached = await readCachedCoachWorkspace()
      if (cached) mirror(cached.proactiveEnabled)
      try {
        const fresh = await fetchCoachWorkspace()
        mirror(fresh.proactiveEnabled)
      } catch {
        // Offline or coach backend unavailable — keep the cached/current mirror.
      }
    })()
    return () => { cancelled = true }
  }, [dispatch])
  return null
}
