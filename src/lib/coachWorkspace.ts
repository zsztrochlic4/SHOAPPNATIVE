import { httpsCallable } from 'firebase/functions'
import { auth, firebaseEnabled, functions } from './firebase'
import type { CoachWorkspaceSummary } from '../backend/coach/contracts'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { mergeOutcomeIntent, type CoachOutcomeIntent } from './coachActionOutboxCore'

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

/** One end-of-chat rating. Best-effort: never blocks or interrupts the chat if it fails. */
export async function recordCoachFeedback(rating: 'helpful' | 'not_helpful', reason?: string): Promise<void> {
  try { await callable<{ rating: string; reason?: string }, { ok: true }>('recordCoachFeedback')({ rating, reason }) } catch { /* best-effort telemetry */ }
}

export async function respondToCoachProposal(id: string, decision: 'confirm' | 'reject') {
  const result = await callable<
    { id: string; decision: 'confirm' | 'reject' },
    { id: string; actionId?: string; kind: string; payload: Record<string, string | number | boolean>; status: string }
  >('respondToCoachProposal')({ id, decision })
  return result.data
}

/**
 * Durable outcome OUTBOX (audit R5-007). The action journal previously terminalised via a single
 * best-effort callable: if it failed (offline) or the app was killed before it ran, the server-side
 * entry could sit at `pending_apply` forever. We now persist the terminal outcome to a UID-scoped,
 * on-device outbox BEFORE attempting the network call, then drain it — so a crash or offline window
 * only DELAYS reconciliation instead of losing it. The outbox is re-drained whenever the coach opens
 * (see `flushCoachActionOutcomeOutbox`), which is the client-side reconciler for the pending state.
 *
 * Entries carry no free-text — just the action id, the terminal state and a short reason code.
 */
const OUTBOX_KEY = 'sho.coach.outcome_outbox.v1'
const outboxKeyFor = (uid: string) => `${OUTBOX_KEY}.u.${uid}`
const OUTBOX_MAX = 100

async function loadOutbox(uid: string): Promise<CoachOutcomeIntent[]> {
  try {
    const raw = await AsyncStorage.getItem(outboxKeyFor(uid))
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? (parsed as CoachOutcomeIntent[]) : []
  } catch {
    return []
  }
}

async function saveOutbox(uid: string, list: CoachOutcomeIntent[]): Promise<void> {
  try {
    // Keep the newest entries if we ever exceed the cap (a runaway backstop, never expected).
    await AsyncStorage.setItem(outboxKeyFor(uid), JSON.stringify(list.slice(-OUTBOX_MAX)))
  } catch {
    /* best-effort persistence */
  }
}

async function sendOutcome(intent: CoachOutcomeIntent): Promise<void> {
  await callable<{ actionId: string; outcome: string; reasonCode?: string }, { ok: true }>(
    'recordCoachActionOutcome',
  )({ actionId: intent.actionId, outcome: intent.outcome, ...(intent.reasonCode ? { reasonCode: intent.reasonCode } : {}) })
}

/**
 * Drain the outcome outbox for the current user: send each queued terminal outcome and drop it on
 * success; keep anything that still fails for the next attempt. Best-effort — never throws into the
 * UI. Call on coach open / reconnect so a `pending_apply` left by a crash or offline window is
 * reconciled promptly.
 */
export async function flushCoachActionOutcomeOutbox(): Promise<void> {
  const uid = currentUid()
  if (!uid) return
  const list = await loadOutbox(uid)
  if (!list.length) return
  const remaining: CoachOutcomeIntent[] = []
  for (const intent of list) {
    try {
      await sendOutcome(intent)
    } catch {
      remaining.push(intent) // still unreachable — keep it for the next flush
    }
  }
  if (remaining.length !== list.length) await saveOutbox(uid, remaining)
}

/**
 * Report the terminal outcome of a confirmed action so the server-side journal reaches
 * applied/failed/rolled_back (audit C-018 / CA-008 / R5-007). DURABLE: the outcome is persisted to
 * the on-device outbox first, so a failed/interrupted network call cannot silently strand the entry
 * at `pending_apply`; it is then flushed opportunistically. Never throws into the UI.
 */
export async function recordCoachActionOutcome(
  actionId: string,
  outcome: 'applied' | 'failed' | 'rolled_back',
  reasonCode?: string,
): Promise<void> {
  const uid = currentUid()
  // Demo / anonymous users have no server-side journal to reconcile.
  if (!uid) return
  const intent: CoachOutcomeIntent = { actionId, outcome, ...(reasonCode ? { reasonCode } : {}), queuedAt: new Date().toISOString() }
  // Persist FIRST (a terminal state for an action supersedes any earlier queued state for it).
  const list = mergeOutcomeIntent(await loadOutbox(uid), intent, OUTBOX_MAX)
  await saveOutbox(uid, list)
  // Then attempt to drain now; anything unsent stays durably queued for the next flush.
  await flushCoachActionOutcomeOutbox()
}
