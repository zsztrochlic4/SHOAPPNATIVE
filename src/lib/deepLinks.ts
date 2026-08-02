/**
 * Allowlisted deep-link routing (audit F-020).
 *
 * Push payloads may carry a `deepLink` (functions/src/notifications.ts) and the
 * app registers the `strengthhub://` scheme — but nothing consumed either, so
 * tapping a push just opened the app. This module is the single, ALLOWLISTED
 * parser: only known in-app destinations resolve; anything else (external
 * hosts, http(s), unknown paths, malformed input) is rejected, never followed.
 */

export type DeepLinkTarget =
  | { kind: 'tab'; tab: 'dashboard' | 'workout' | 'nutrition' | 'progress' | 'community' }
  | { kind: 'overlay'; overlay: 'notifications' | 'settings' | 'quick' | 'badges' | 'addFood' | 'profile' }

const TABS = new Set(['dashboard', 'workout', 'nutrition', 'progress', 'community'])
const OVERLAYS = new Set(['notifications', 'settings', 'quick', 'badges', 'addFood', 'profile'])

/** Billing return URLs are handled by the checkout auth-session, not routing. */
const IGNORED = new Set(['checkout'])

export function parseDeepLink(url: unknown): DeepLinkTarget | null {
  if (typeof url !== 'string' || url.length === 0 || url.length > 512) return null
  const m = /^strengthhub:\/\/([A-Za-z0-9_-]+)(?:[/?#].*)?$/.exec(url.trim())
  if (!m) return null // wrong scheme (http(s), other apps) or malformed → reject
  const path = m[1].toLowerCase()
  if (IGNORED.has(path)) return null
  if (TABS.has(path)) return { kind: 'tab', tab: path as 'dashboard' | 'workout' | 'nutrition' | 'progress' | 'community' }
  if (OVERLAYS.has(path)) return { kind: 'overlay', overlay: path as 'notifications' | 'settings' | 'quick' | 'badges' | 'addFood' | 'profile' }
  return null
}
