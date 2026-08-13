import type { PersistentState } from './types'
import { CROSS_SESSION_STATES } from './types'

/** Only durable eligibility/training restrictions may be restored into a new conversation. */
export function restorablePersistentStates(raw: unknown, ageMs: number, ttlMs: number): PersistentState[] {
  if (!Array.isArray(raw) || !Number.isFinite(ageMs) || ageMs < 0 || ageMs > ttlMs) return []
  return raw.filter((state): state is PersistentState =>
    typeof state === 'string' && CROSS_SESSION_STATES.includes(state as PersistentState),
  )
}
