/**
 * Daily message limit (spec §21). Applies ONLY to normal coaching turns. A crisis / safety
 * response is NEVER blocked by the limit: the router runs first, and the limit is consulted only
 * when the router ALLOWS normal coaching. The enforced order lives in coachPrecheck (index.ts).
 */

import type { FixedResponse } from './types'

/** A sensible default cap on normal coaching messages per day. */
export const DAILY_COACH_LIMIT = 25

export interface CoachUsage { dateKey: string; count: number }

/** True when a normal coaching turn is still within today's limit. Safety turns never call this. */
export function withinDailyLimit(usage: CoachUsage | undefined, todayKey: string): boolean {
  if (!usage || usage.dateKey !== todayKey) return true
  return usage.count < DAILY_COACH_LIMIT
}

/** Neutral limit-reached message — NOT a safety response, and NOT the fitness menu. */
export function dailyLimitResponse(): FixedResponse {
  return {
    text:
      'You’ve reached today’s limit of coach messages — it resets tomorrow. If something urgent comes ' +
      'up before then, please reach out to the appropriate professional, or your local emergency services in an emergency.',
    buttons: [],
    noAI: true,
  }
}
