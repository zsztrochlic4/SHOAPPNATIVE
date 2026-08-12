import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { doc, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from './firebase'
import type { NotificationPrefs } from '../store/types'
import { inQuietHours, nextAllowedHour } from './quietHours'

// Re-exported for existing importers; the implementation lives in the pure,
// unit-tested ./quietHours module.
export { inQuietHours, nextAllowedHour }

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

/**
 * The device's active push registration — which account currently owns this
 * device's token (audit F-005). Persisted locally so sign-out, account switch
 * and the notifications toggle can revoke the OLD owner's registration before
 * (or without) creating a new one; without this, one device token accumulates
 * under every account that ever signed in here.
 */
const PUSH_REG_KEY = 'sho.push.registration.v1'
type PushRegistrationRecord = { uid: string; token: string }

export async function getStoredPushRegistration(): Promise<PushRegistrationRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(PUSH_REG_KEY)
    return raw ? (JSON.parse(raw) as PushRegistrationRecord) : null
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
      {
        token,
        platform: Platform.OS,
        updatedAt: new Date().toISOString(),
        // Device UTC offset in minutes (e.g. AEST = +600) so the server-side
        // sender can honour this device's quiet hours in its local time.
        utcOffsetMinutes: -new Date().getTimezoneOffset(),
      },
      { merge: true },
    )
    await AsyncStorage.setItem(PUSH_REG_KEY, JSON.stringify({ uid, token })).catch(() => {})
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

/**
 * Revoke this device's stored push registration (audit F-005): delete the token
 * doc from its recorded owner and clear the local record. Called on sign-out,
 * account switch, notification disable and account deletion. Must run while the
 * owner is still authenticated (Firestore rules are owner-only). Never throws.
 */
export async function unregisterPush(expectedUid?: string): Promise<void> {
  const reg = await getStoredPushRegistration()
  if (!reg) return
  if (expectedUid && reg.uid !== expectedUid) return
  await removePushToken(reg.uid, reg.token)
  try {
    await AsyncStorage.removeItem(PUSH_REG_KEY)
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
  coachCheckin: true,
  reminderHour: 17, // 5pm — a common "head to the gym" time
  quiet: true,
  quietStartHour: 22, // 10pm–7am
  quietEndHour: 7,
}

/** The evening streak nudge is fixed at 8pm (outside the default quiet window). */
const STREAK_HOUR = 20
/** The coach check-in nudge is fixed at 6pm (early evening, before the streak nudge). */
const COACH_HOUR = 18

/** Merge stored prefs over the defaults so older saves always resolve fully. */
export function resolveNotifPrefs(prefs?: Partial<NotificationPrefs>): NotificationPrefs {
  return { ...DEFAULT_NOTIF_PREFS, ...(prefs ?? {}) }
}

/**
 * Reconcile scheduled local reminders with the user's settings: clears everything, then
 * re-schedules only the enabled categories at their times. The user's preferred workout
 * reminder time is DEFERRED to the next valid hour if it lands inside quiet hours (rather
 * than being dropped); the fixed evening streak nudge is skipped when quiet covers it.
 * Safe no-op on web / Expo Go. Call on launch and whenever prefs change.
 */
export async function syncReminders(
  enabled: boolean,
  prefs?: Partial<NotificationPrefs>,
  coach?: { proactiveEnabled: boolean; name?: string },
): Promise<void> {
  if (!NATIVE) return
  await cancelAllReminders()
  if (!enabled) return
  const p = resolveNotifPrefs(prefs)
  const quiet = (h: number) => p.quiet && inQuietHours(h, p.quietStartHour, p.quietEndHour)
  const jobs: DailyReminder[] = []
  if (p.workoutReminder) {
    // A preferred time inside quiet hours is deferred to the next valid hour, not dropped.
    const hour = nextAllowedHour(p.reminderHour, p.quiet, p.quietStartHour, p.quietEndHour)
    jobs.push({ id: 'workout-reminder', title: 'Time to train 💪', body: "Your session's ready when you are — 45 minutes and it's done.", hour })
  }
  // The coach check-in nudge only exists while the user has proactive check-ins on; the app's own
  // coach screen always has today's note waiting, so this daily prompt is never empty.
  if (coach?.proactiveEnabled && p.coachCheckin !== false && !quiet(COACH_HOUR)) {
    const who = (coach.name ?? '').trim() || 'Your coach'
    jobs.push({ id: 'coach-checkin', title: `${who} checked in 👋`, body: 'Open the app for today’s note and to keep your week on track.', hour: COACH_HOUR })
  }
  if (p.streakReminder && !quiet(STREAK_HOUR)) {
    jobs.push({ id: 'streak-reminder', title: 'Keep your streak alive 🔥', body: 'Log today to keep the run going. Even a quick check-in counts.', hour: STREAK_HOUR })
  }
  for (const j of jobs) await scheduleDailyReminder(j)
}
