import { useEffect, useRef } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useStore } from '../store/store'
import { requestPushPermission, getPushToken, savePushToken, syncReminders } from '../lib/notifications'

/**
 * Registers this device for notifications when a signed-in user has them enabled:
 * asks permission, gets the Expo push token, and stores it under the user in
 * Firestore so a future sender can reach them. Renders nothing.
 *
 * Runs once per (user, enabled) transition. Fully inert on web, in demo mode, and
 * until an EAS project id is configured — `getPushToken()` returns null and nothing
 * is written. Never throws.
 */
export function PushRegistration() {
  const { user } = useAuth()
  const { state } = useStore()
  const enabled = state.settings.notificationsEnabled
  // Guards against re-running for a (user, setting) pair we've already registered.
  const done = useRef<string | null>(null)

  useEffect(() => {
    if (!user || !enabled) return
    const key = `${user.uid}:on`
    if (done.current === key) return
    done.current = key
    ;(async () => {
      const granted = await requestPushPermission()
      if (!granted) { done.current = null; return } // let a later enable retry
      const token = await getPushToken()
      if (token) await savePushToken(user.uid, token)
    })().catch(() => { done.current = null })
  }, [user, enabled])

  return null
}

/**
 * Keeps on-device local reminders in sync with the user's notification settings:
 * re-arms them on launch and reconciles whenever the toggle or any preference changes.
 * Native-only and never throws (a safe no-op on web / Expo Go / demo). Runs regardless
 * of auth so reminders work for signed-out and demo users too.
 */
export function NotificationsSync() {
  const { state } = useStore()
  const enabled = state.settings.notificationsEnabled
  const prefs = state.settings.notificationPrefs
  useEffect(() => {
    void syncReminders(!!enabled, prefs)
  }, [enabled, prefs])
  return null
}
