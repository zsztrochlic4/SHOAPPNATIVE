import { useEffect } from 'react'
import { AppState as RNAppState } from 'react-native'
import { useAuth } from '../auth/AuthProvider'
import { flushCompletionQueue, refreshPendingCount } from '../backend/repo/completionQueue'

/**
 * Keeps the durable workout-completion queue moving (audit F-011): retries any
 * pending canonical writes on sign-in and whenever the app returns to the
 * foreground (the natural "back online" moments). Renders nothing; safe no-op
 * when signed out or nothing is queued.
 */
export function CompletionQueueSync() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return
    void refreshPendingCount(user.uid)
    void flushCompletionQueue(user.uid)
    const sub = RNAppState.addEventListener('change', (s) => {
      if (s === 'active') void flushCompletionQueue(user.uid)
    })
    return () => sub.remove()
  }, [user])

  return null
}
