/**
 * Optimistic-concurrency primitives for coach program commits (audit R4-005 / R5-006).
 *
 * Kept free of any Firebase import so the version decision can be exercised in plain unit tests.
 * `programRepo.ts` re-exports these and applies the returned version inside its Firestore
 * transaction.
 */

/** Thrown when a coach action commits against a program another device already moved past. */
export class CoachActionConflictError extends Error {
  constructor(
    public storedVersion: number,
    public expectedVersion: number,
  ) {
    super(`coach_action_version_conflict: stored ${storedVersion} != expected ${expectedVersion}`)
    this.name = 'CoachActionConflictError'
  }
}

/**
 * Pure optimistic-concurrency decision for a coach commit. Given what the transaction read,
 * returns the monotonically-advanced version to stamp, or throws {@link CoachActionConflictError}
 * when the caller's expectation no longer matches the stored state.
 *
 *   • expectedVersion provided + doc exists → stored MUST be a number equal to expectedVersion,
 *     otherwise the plan moved on (or is an un-versioned legacy doc we cannot verify) → conflict.
 *   • Advance = (stored ?? expected ?? 0) + 1, i.e. the count of committed mutations. The program
 *     object's own `version` field is deliberately NOT trusted, so a patch swap that reused the same
 *     value still advances, a fresh doc becomes version 1, and a legacy un-versioned doc becomes 1.
 */
export function resolveNextProgramVersion(args: {
  exists: boolean
  storedVersion: number | undefined
  expectedVersion?: number
}): number {
  const { exists, storedVersion, expectedVersion } = args
  if (expectedVersion != null && exists) {
    if (typeof storedVersion !== 'number' || storedVersion !== expectedVersion) {
      throw new CoachActionConflictError(typeof storedVersion === 'number' ? storedVersion : -1, expectedVersion)
    }
  }
  const base = typeof storedVersion === 'number' ? storedVersion : (expectedVersion ?? 0)
  return base + 1
}
