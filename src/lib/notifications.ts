import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { doc, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from './firebase'

/**
 * Push-notification foundation (client side).
 *
 * Covers the pieces every notification feature is built on:
 *  - permission + an Expo push TOKEN (register the device),
 *  - storing the token per-user in Firestore (users/{uid}/pushTokens/{token}) — the sender
 *    (a Cloud Function / the Expo Push API) reads these later,
 *  - scheduling on-device LOCAL reminders (no server needed).
 *
 * Everything is a SAFE no-op on web and fails soft — notifications must never crash the app.
 *
 * NOT included (deliberately, later steps): the SEND side (a Cloud Function or the Expo Push
 * API), and remote push needs an EAS project id + a dev/EAS build + an iOS APNs key. Until
 * `extra.eas.projectId` is set (via `eas init`), `getPushToken()` returns null and only local
 * reminders work.
 */

const NATIVE = Platform.OS === 'ios' || Platform.OS === 'android'

// How a notification shows while the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

/** Ask the OS for notification permission (shows the system prompt once). */
export async function requestPushPermission(): Promise<boolean> {
  if (!NATIVE) return false
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.DEFAULT,
      })
    }
    const current = await Notifications.getPermissionsAsync()
    if (current.granted) return true
    const asked = await Notifications.requestPermissionsAsync()
    return asked.granted
  } catch {
    return false
  }
}

/** The device's Expo push token, or null (web, simulator, or EAS project id not configured yet). */
export async function getPushToken(): Promise<string | null> {
  if (!NATIVE || !Device.isDevice) return null
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId
    if (!projectId) return null // remote push needs `eas init` to set extra.eas.projectId
    const token = await Notifications.getExpoPushTokenAsync({ projectId })
    return token.data
  } catch {
    return null
  }
}

/** Store this device's push token under the user (owner-only per Firestore rules). No-op locally. */
export async function savePushToken(uid: string, token: string): Promise<void> {
  if (!db || !uid || uid === 'local' || !token) return
  try {
    await setDoc(
      doc(db, 'users', uid, 'pushTokens', token),
      { token, platform: Platform.OS, updatedAt: new Date().toISOString() },
      { merge: true },
    )
  } catch {
    /* transient — retried on next launch */
  }
}

/** Remove a token (e.g. on sign-out or when notifications are turned off). */
export async function removePushToken(uid: string, token: string): Promise<void> {
  if (!db || !uid || uid === 'local' || !token) return
  try {
    await deleteDoc(doc(db, 'users', uid, 'pushTokens', token))
  } catch {
    /* ignore */
  }
}

/* ------------------------------ local reminders ------------------------------ */

export interface DailyReminder {
  /** Stable id so it can be updated/cancelled (e.g. 'log-your-day'). */
  id: string
  title: string
  body: string
  hour: number // 0–23, device local time
  minute?: number
}

/** Schedule (or replace) a repeating daily local reminder. Returns the id, or null. */
export async function scheduleDailyReminder(r: DailyReminder): Promise<string | null> {
  if (!NATIVE) return null
  try {
    await Notifications.cancelScheduledNotificationAsync(r.id).catch(() => {})
    return await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: { title: r.title, body: r.body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: r.hour,
        minute: r.minute ?? 0,
      },
    })
  } catch {
    return null
  }
}

export async function cancelReminder(id: string): Promise<void> {
  if (!NATIVE) return
  try {
    await Notifications.cancelScheduledNotificationAsync(id)
  } catch {
    /* ignore */
  }
}

/** Cancel every scheduled local reminder (e.g. when the user turns notifications off). */
export async function cancelAllReminders(): Promise<void> {
  if (!NATIVE) return
  try {
    await Notifications.cancelAllScheduledNotificationsAsync()
  } catch {
    /* ignore */
  }
}
