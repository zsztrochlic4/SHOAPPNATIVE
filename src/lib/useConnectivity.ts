import { useEffect, useRef, useState } from 'react'
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo'

/**
 * Reactive network reachability, cross-platform (NetInfo falls back to
 * `navigator.onLine` + the Network Information API on web, so it works in the
 * browser preview as well as on device).
 *
 * Debounced to avoid flicker: a drop must persist for OFFLINE_DELAY_MS before we
 * report offline (mobile connectivity blips constantly), but recovery is
 * reported immediately — coming back online should feel instant, going offline
 * should not fire on a passing tunnel. Returns `true` (online) until proven
 * otherwise, so a slow/unknown first probe never flashes a false "offline" bar.
 */
const OFFLINE_DELAY_MS = 1200

function isOnline(s: NetInfoState): boolean {
  // isInternetReachable is null while still being determined — treat unknown as
  // online (optimistic) so we only ever show the bar on a confirmed drop.
  return s.isConnected !== false && s.isInternetReachable !== false
}

export function useConnectivity(): boolean {
  const [online, setOnline] = useState(true)
  const offlineTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const clear = () => {
      if (offlineTimer.current) {
        clearTimeout(offlineTimer.current)
        offlineTimer.current = null
      }
    }

    const apply = (s: NetInfoState) => {
      if (isOnline(s)) {
        clear()
        setOnline(true)
      } else if (!offlineTimer.current) {
        // Debounce the drop: only commit to offline if it lasts.
        offlineTimer.current = setTimeout(() => {
          offlineTimer.current = null
          setOnline(false)
        }, OFFLINE_DELAY_MS)
      }
    }

    const unsub = NetInfo.addEventListener(apply)
    void NetInfo.fetch().then(apply)
    return () => {
      clear()
      unsub()
    }
  }, [])

  return online
}
