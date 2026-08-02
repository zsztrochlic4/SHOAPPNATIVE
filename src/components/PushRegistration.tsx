import { useEffect, useRef } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useStoreSelector } from '../store/store'
import type { AppState } from '../store/types'
import { getPushToken, savePushToken, syncReminders } from '../lib/notifications'

const selectNotificationsEnabled = (state: AppState) => state.settings.notificationsEnabled
const selectNotificationConsent = (state: AppState) => state.settings.notificationConsent ?? 'unknown'
const selectNotificationPrefs = (state: AppState) => state.settings.notificationPrefs

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
  const enabled = useStoreSelector(selectNotificationsEnabled)
  const consent = useStoreSelector(selectNotificationConsent)
  // Guards against re-running for a (user, setting) pair we've already registered.
  const done = useRef<string | null>(null)

  useEffect(() => {
    // Permission is requested only from the user's Settings toggle. This
    // background bridge must never trigger an OS prompt on sign-in or launch.
    if (!user || !enabled || consent !== 'granted') return
    const key = `${user.uid}:on`
    if (done.current === key) return
    done.current = key
    ;(async () => {
      const token = await getPushToken()
      if (token) await savePushToken(user.uid, token)
    })().catch(() => { done.current = null })
  }, [user, enabled, consent])

  return null
}

/**
 * Keeps on-device local reminders in sync with the user's notification settings:
 * re-arms them on launch and reconciles whenever the toggle or any preference changes.
 * Native-only and never throws (a safe no-op on web / Expo Go / demo). Runs regardless
 * of auth so reminders work for signed-out and demo users too.
 */
export function NotificationsSync() {
  const enabled = useStoreSelector(selectNotificationsEnabled)
  const consent = useStoreSelector(selectNotificationConsent)
  const prefs = useStoreSelector(selectNotificationPrefs)
  useEffect(() => {
    void syncReminders(!!enabled && consent === 'granted', prefs)
  }, [enabled, consent, prefs])
  return null
}
