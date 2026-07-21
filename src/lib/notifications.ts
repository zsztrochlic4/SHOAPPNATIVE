import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { doc, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from './firebase'
import type { NotificationPrefs } from '../store/types'

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

/* --------------------------- preferences → schedule --------------------------- */

/** Sensible lean-quiet defaults (used when a user has never touched the settings). */
export const DEFAULT_NOTIF_PREFS: NotificationPrefs = {
  workoutReminder: true,
  streakReminder: true,
  reminderHour: 17, // 5pm — a common "head to the gym" time
  quiet: true,
  quietStartHour: 22, // 10pm–7am
  quietEndHour: 7,
}

/** The evening streak nudge is fixed at 8pm (outside the default quiet window). */
const STREAK_HOUR = 20

/** Is `hour` inside the quiet window [startH, endH)? Handles windows that wrap midnight. */
export function inQuietHours(hour: number, startH: number, endH: number): boolean {
  if (startH === endH) return false
  return startH < endH ? hour >= startH && hour < endH : hour >= startH || hour < endH
}

/** Merge stored prefs over the defaults so older saves always resolve fully. */
export function resolveNotifPrefs(prefs?: Partial<NotificationPrefs>): NotificationPrefs {
  return { ...DEFAULT_NOTIF_PREFS, ...(prefs ?? {}) }
}

/**
 * Reconcile scheduled local reminders with the user's settings: clears everything, then
 * re-schedules only the enabled categories at their times (skipping any that land inside
 * quiet hours). Safe no-op on web / Expo Go. Call on launch and whenever prefs change.
 */
export async function syncReminders(enabled: boolean, prefs?: Partial<NotificationPrefs>): Promise<void> {
  if (!NATIVE) return
  await cancelAllReminders()
  if (!enabled) return
  const p = resolveNotifPrefs(prefs)
  const quiet = (h: number) => p.quiet && inQuietHours(h, p.quietStartHour, p.quietEndHour)
  const jobs: DailyReminder[] = []
  if (p.workoutReminder && !quiet(p.reminderHour)) {
    jobs.push({ id: 'workout-reminder', title: 'Time to train 💪', body: "Your session's ready when you are — 45 minutes and it's done.", hour: p.reminderHour })
  }
  if (p.streakReminder && !quiet(STREAK_HOUR)) {
    jobs.push({ id: 'streak-reminder', title: 'Keep your streak alive 🔥', body: 'Log today to keep the run going. Even a quick check-in counts.', hour: STREAK_HOUR })
  }
  for (const j of jobs) await scheduleDailyReminder(j)
}
