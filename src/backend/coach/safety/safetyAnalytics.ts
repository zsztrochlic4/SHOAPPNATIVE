/**
 * Weekly aggregate safety summary (spec §20). Content-free and de-identified: counts by flag type
 * over a period, with NO message, transcript, name, account id, or any stable user identifier. This
 * is the AGGREGATE ANALYTICS side, kept strictly SEPARATE from the operational state store (§20).
 *
 * DORMANT BY DESIGN. `ANALYTICS_ACTIVE` is false and the default sink discards everything, so no
 * real data is collected ahead of the privacy foundation (§19). See STATUS.md.
 */

import type { SafetyCategory } from './types'

export const ANALYTICS_ACTIVE = false

/** A content-free safety event. Deliberately carries no user identifier of any kind. */
export interface SafetyEvent {
  category: SafetyCategory
  timestamp: string // ISO
  appVersion: string
}

export interface SafetyEventSink {
  readonly active: boolean
  record(event: SafetyEvent): void
  /** counts by category over the retained window. */
  summary(): Record<string, number>
}

/** The dormant default: records nothing, summarises nothing. */
export const dormantSink: SafetyEventSink = {
  active: false,
  record() { /* inert until ANALYTICS_ACTIVE + the privacy foundation */ },
  summary() { return {} },
}

/** In-memory sink for tests / isolation only. */
export function createInMemorySink(): SafetyEventSink {
  const counts: Record<string, number> = {}
  return {
    active: true,
    record(e) { counts[e.category] = (counts[e.category] ?? 0) + 1 },
    summary() { return { ...counts } },
  }
}

let sink: SafetyEventSink = dormantSink
export function safetySink(): SafetyEventSink { return sink }
export function __activateSinkForTest(s: SafetyEventSink): void { sink = s }
export function __resetSink(): void { sink = dormantSink }

const APP_VERSION = '0.0.0' // wired from app config when activated

/** Record a decision's category as a content-free event (no-op while dormant). */
export function recordSafetyEvent(category: SafetyCategory): void {
  const s = safetySink()
  if (!s.active || category === 'none') return
  s.record({ category, timestamp: new Date().toISOString(), appVersion: APP_VERSION })
}

/** The weekly aggregate summary — counts by flag type (empty while dormant). */
export function weeklySafetySummary(): Record<string, number> {
  return safetySink().summary()
}
