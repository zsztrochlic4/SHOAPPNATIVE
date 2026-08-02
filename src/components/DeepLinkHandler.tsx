import { useEffect } from 'react'
import { Linking, Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import { useNav } from '../nav'
import { parseDeepLink } from '../lib/deepLinks'

/**
 * Consumes notification taps and `strengthhub://` URLs (audit F-020): a push
 * whose payload names an allowlisted destination now actually takes the user
 * there, on cold and warm starts. Unknown/external targets are ignored by the
 * allowlisted parser — never followed. Renders nothing.
 */
export function DeepLinkHandler() {
  const nav = useNav()

  useEffect(() => {
    let cancelled = false

    const route = (raw: unknown) => {
      const target = parseDeepLink(raw)
      if (!target || cancelled) return
      if (target.kind === 'tab') nav.goTab(target.tab)
      else nav.open(target.overlay)
    }

    // Warm-start URL events (scheme opened while running).
    const urlSub = Linking.addEventListener('url', (e) => route(e.url))
    // Cold-start URL (app launched by the scheme).
    void Linking.getInitialURL().then((url) => { if (url) route(url) })

    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      // Push tapped while the app runs (or is backgrounded).
      const respSub = Notifications.addNotificationResponseReceivedListener((resp) => {
        route(resp.notification.request.content.data?.deepLink)
      })
      // Push that LAUNCHED the app.
      void Notifications.getLastNotificationResponseAsync().then((resp) => {
        if (resp) route(resp.notification.request.content.data?.deepLink)
      }).catch(() => {})
      return () => { cancelled = true; urlSub.remove(); respSub.remove() }
    }
    return () => { cancelled = true; urlSub.remove() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
