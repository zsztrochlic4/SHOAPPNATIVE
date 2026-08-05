/**
 * Pure reducer logic for the coach action-outcome outbox (audit R5-007), split out from the
 * AsyncStorage/Firebase-bound `coachWorkspace.ts` so the dedupe/cap behaviour is unit-testable.
 */
export interface CoachOutcomeIntent {
  actionId: string
  outcome: 'applied' | 'failed' | 'rolled_back'
  reasonCode?: string
  queuedAt: string
}

/**
 * Add a terminal outcome to the outbox. A newer terminal state for an action SUPERSEDES any earlier
 * queued state for the same action (e.g. an `applied` later reverted to `rolled_back`), so the server
 * journal converges on the latest truth. The list is bounded to `max` newest entries as a runaway
 * backstop.
 */
export function mergeOutcomeIntent(
  list: CoachOutcomeIntent[],
  intent: CoachOutcomeIntent,
  max = 100,
): CoachOutcomeIntent[] {
  const next = list.filter((e) => e.actionId !== intent.actionId)
  next.push(intent)
  return next.slice(-max)
}
