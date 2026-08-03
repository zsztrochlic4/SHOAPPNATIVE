import { httpsCallable } from 'firebase/functions'
import { auth, firebaseEnabled, functions } from './firebase'
import type { CoachWorkspaceSummary } from '../backend/coach/contracts'
import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * Coach workspace cache — UID-SCOPED (audit F-004). The offline snapshot of a
 * user's coach consent and memories is sensitive, so:
 *  - the cache key contains the owner's uid; it is never read or written
 *    without a resolved signed-in user,
 *  - `clearCoachWorkspaceCache` removes it on sign-out, account switch,
 *    consent revoke and account deletion (plus the pre-scoping global key).
 */
const LEGACY_CACHE_KEY = 'sho.coach.workspace.v1'
const cacheKeyFor = (uid: string) => `${LEGACY_CACHE_KEY}.u.${uid}`

function currentUid(): string | null {
  return auth?.currentUser?.uid ?? null
}

function callable<I, O>(name: string) {
  if (!firebaseEnabled || !functions) throw new Error('Coach backend is not configured')
  return httpsCallable<I, O>(functions, name, { timeout: 30_000 })
}

export async function fetchCoachWorkspace(): Promise<CoachWorkspaceSummary> {
  const result = await callable<Record<string, never>, CoachWorkspaceSummary>('getCoachWorkspace')({})
  return cache(result.data)
}

export async function readCachedCoachWorkspace(): Promise<CoachWorkspaceSummary | null> {
  const uid = currentUid()
  if (!uid) return null // never surface a cache before the account is known
  try {
    const raw = await AsyncStorage.getItem(cacheKeyFor(uid))
    return raw ? JSON.parse(raw) as CoachWorkspaceSummary : null
  } catch {
    return null
  }
}

/** Remove the coach cache for `uid` (or the current user) plus the legacy global key. */
export async function clearCoachWorkspaceCache(uid?: string): Promise<void> {
  const target = uid ?? currentUid()
  try {
    if (target) await AsyncStorage.removeItem(cacheKeyFor(target))
    await AsyncStorage.removeItem(LEGACY_CACHE_KEY)
  } catch {
    /* best-effort */
  }
}

async function cache(summary: CoachWorkspaceSummary): Promise<CoachWorkspaceSummary> {
  const uid = currentUid()
  if (uid) await AsyncStorage.setItem(cacheKeyFor(uid), JSON.stringify(summary)).catch(() => {})
  return summary
}

export async function grantCoachConsent(memoryEnabled: boolean): Promise<CoachWorkspaceSummary> {
  const result = await callable<{ memoryEnabled: boolean }, CoachWorkspaceSummary>('grantCoachConsent')({ memoryEnabled })
  return cache(result.data)
}

export async function revokeCoachConsent(): Promise<CoachWorkspaceSummary> {
  const result = await callable<Record<string, never>, CoachWorkspaceSummary>('revokeCoachConsent')({})
  // Revoking consent deletes the server workspace; the local snapshot of those
  // memories must go with it (audit F-004/F-015).
  await clearCoachWorkspaceCache()
  return result.data
}

export async function updateCoachPreferences(input: {
  memoryEnabled?: boolean
  proactiveEnabled?: boolean
  coachingStyle?: CoachWorkspaceSummary['coachingStyle']
}): Promise<CoachWorkspaceSummary> {
  const result = await callable<typeof input, CoachWorkspaceSummary>('updateCoachPreferences')(input)
  return cache(result.data)
}

export async function deleteCoachMemory(id: string): Promise<void> {
  await callable<{ id: string }, { ok: true }>('deleteCoachMemory')({ id })
}

export async function clearCoachMemories(): Promise<void> {
  await callable<Record<string, never>, { ok: true }>('clearCoachMemories')({})
}

export async function respondToCoachProposal(id: string, decision: 'confirm' | 'reject') {
  const result = await callable<
    { id: string; decision: 'confirm' | 'reject' },
    { id: string; actionId?: string; kind: string; payload: Record<string, string | number | boolean>; status: string }
  >('respondToCoachProposal')({ id, decision })
  return result.data
}

/**
 * Report the terminal outcome of a confirmed action so the server-side journal reaches
 * applied/failed/rolled_back (audit C-018 / CA-008). Best-effort: never throws into the UI —
 * the local apply/undo has already happened; this just keeps the audit trail honest.
 */
export async function recordCoachActionOutcome(
  actionId: string,
  outcome: 'applied' | 'failed' | 'rolled_back',
  reasonCode?: string,
): Promise<void> {
  try {
    await callable<{ actionId: string; outcome: string; reasonCode?: string }, { ok: true }>(
      'recordCoachActionOutcome',
    )({ actionId, outcome, ...(reasonCode ? { reasonCode } : {}) })
  } catch {
    /* audit-trail write is best-effort; a failure here must not disrupt the user. */
  }
}
