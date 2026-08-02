/**
 * Coach controlled-rollout telemetry (final plan Phase 6). Privacy-preserving AGGREGATES only — the
 * plan's list: route category, response latency, fallback use, retry, abandonment after refusal,
 * suggestion-chip completion, and explicit negative feedback. Content-free and de-identified: NO
 * message text, transcript, name, account id, or any stable user identifier — exactly like
 * safety/safetyAnalytics.ts, and kept separate from any operational state.
 *
 * DORMANT BY DESIGN. `COACH_TELEMETRY_ACTIVE` is false and the default sink discards everything, so no
 * real data is collected ahead of the privacy foundation and the controlled rollout. Latency is bucketed
 * (never a raw millisecond timestamp) so it can't be used to fingerprint a turn.
 */

export const COACH_TELEMETRY_ACTIVE = false

/** The event kinds the plan asks us to watch during the controlled rollout. */
export type CoachTelemetryKind =
  | 'route'          // a routed turn, tagged with its route category
  | 'latency'        // a completed live turn, tagged with a latency bucket
  | 'fallback_used'  // the on-device / outage fallback was shown
  | 'retry'          // the user retried after an outage
  | 'abandon_refusal'// the user left after a refusal without continuing
  | 'chip_completion'// a suggestion chip produced a useful answer
  | 'negative_feedback' // an explicit thumbs-down / "not helpful"

export type LatencyBucket = 'lt1s' | '1to3s' | '3to6s' | '6to10s' | 'gt10s'

export function latencyBucket(ms: number): LatencyBucket {
  if (ms < 1000) return 'lt1s'
  if (ms < 3000) return '1to3s'
  if (ms < 6000) return '3to6s'
  if (ms < 10000) return '6to10s'
  return 'gt10s'
}

/** A content-free telemetry event. Carries no user identifier of any kind. */
export interface CoachTelemetryEvent {
  kind: CoachTelemetryKind
  /** For 'route': the route category. For 'latency': the latency bucket. Otherwise a short label. */
  label: string
  timestamp: string // ISO
  appVersion: string
}

export interface CoachTelemetrySink {
  readonly active: boolean
  record(event: CoachTelemetryEvent): void
  /** counts keyed by `${kind}:${label}` over the retained window. */
  summary(): Record<string, number>
}

/** The dormant default: records nothing, summarises nothing. */
export const dormantCoachSink: CoachTelemetrySink = {
  active: false,
  record() { /* inert until COACH_TELEMETRY_ACTIVE + the privacy foundation + controlled rollout */ },
  summary() { return {} },
}

/** In-memory sink for tests / isolation only. */
export function createInMemoryCoachSink(): CoachTelemetrySink {
  const counts: Record<string, number> = {}
  return {
    active: true,
    record(e) { const k = `${e.kind}:${e.label}`; counts[k] = (counts[k] ?? 0) + 1 },
    summary() { return { ...counts } },
  }
}

let sink: CoachTelemetrySink = dormantCoachSink
export function coachTelemetrySink(): CoachTelemetrySink { return sink }
export function __activateCoachSinkForTest(s: CoachTelemetrySink): void { sink = s }
export function __resetCoachSink(): void { sink = dormantCoachSink }

const APP_VERSION = '0.0.0' // wired from app/functions config when activated

/** Record a content-free telemetry event (no-op while dormant). */
export function recordCoachTelemetry(kind: CoachTelemetryKind, label: string): void {
  const s = coachTelemetrySink()
  if (!s.active) return
  s.record({ kind, label: label.slice(0, 40), timestamp: new Date().toISOString(), appVersion: APP_VERSION })
}

/** Convenience for a completed live turn: route category + latency bucket, both content-free. */
export function recordCoachTurn(routeCategory: string, latencyMs: number): void {
  recordCoachTelemetry('route', routeCategory)
  recordCoachTelemetry('latency', latencyBucket(latencyMs))
}

/** The controlled-rollout aggregate summary (empty while dormant). */
export function coachTelemetrySummary(): Record<string, number> {
  return coachTelemetrySink().summary()
}
