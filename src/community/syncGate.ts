/**
 * The single gate deciding whether an account may post its stats to the competitive
 * community backend (`syncCommunityStats`).
 *
 * The seeded "Alex" DEMO runs on a FROZEN clock (see `src/lib/date.ts`): every
 * workout logged while exploring the demo is stamped with the same `dateKey`. Fed
 * through `buildDayRecords`, those collapse onto one day and trip the server's
 * `impossible_session_cadence` anti-cheat rule (> 6 sessions/day → `held`), pulling
 * the account off the ladder for no real reason. A demo account is not a real
 * competitor and must never enter the competitive/integrity pipeline.
 *
 * Pure and dependency-free so it is unit-testable and has one obvious meaning.
 */
export interface CommunitySyncContext {
  /** The community backend feature flag is on. */
  backendOn: boolean
  /** The user has claimed a username (i.e. is participating). */
  hasUsername: boolean
  /** True only for the seeded "Alex" demo, which runs on a frozen clock. */
  demo: boolean
}

export function shouldPostCommunityStats(ctx: CommunitySyncContext): boolean {
  return ctx.backendOn && ctx.hasUsername && !ctx.demo
}
