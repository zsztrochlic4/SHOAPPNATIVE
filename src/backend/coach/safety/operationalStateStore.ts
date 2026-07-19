/**
 * Operational safety-state store (spec §2 persistence table; §19/§20 "operational eligibility /
 * safety state", kept SEPARATE from analytics). Persistent states — under-18, injury, pregnancy,
 * concussion, medical-condition restrictions and their clearance status — must survive across
 * sessions, not just per message.
 *
 * DORMANT BY DESIGN. This is a standalone, access-controlled, minimal-field mechanism that is NOT
 * wired to real user data. `PERSISTENCE_ACTIVE` is false and the default store is a no-op that
 * neither reads nor writes anything. Activation requires the separate privacy/consent foundation
 * (§19) first — see STATUS.md. Nothing here stores a message, transcript, name, or any content;
 * only the minimal state needed to enforce an ongoing restriction, under owner-only access.
 */

import type { PersistentState, SafetySession } from './types'
import { newSafetySession, CROSS_SESSION_STATES } from './types'

/** True only when the privacy foundation is in place AND the store is deliberately activated. */
export const PERSISTENCE_ACTIVE = false

export type ClearanceStatus = 'active' | 'cleared'

/** Minimal, content-free record. No message, name, PII, or stable analytics identifier. */
export interface OperationalStateRecord {
  /** Opaque, access-controlled key (e.g. the user's own uid under owner-only security rules). */
  key: string
  /** Each persistent state and whether it is still active or has been cleared. */
  states: Partial<Record<PersistentState, ClearanceStatus>>
  updatedAt: string // ISO
}

export interface OperationalStateStore {
  /** true only for a real backing store; the dormant default is false. */
  readonly active: boolean
  load(key: string): OperationalStateRecord | null
  save(record: OperationalStateRecord): void
}

/** The dormant default: reads nothing, writes nothing. Guarantees no live data collection. */
export const dormantStore: OperationalStateStore = {
  active: false,
  load() { return null },
  save() { /* intentionally inert until PERSISTENCE_ACTIVE + the privacy foundation */ },
}

/** In-memory store for tests / isolation only. Never used by the app while dormant. */
export function createInMemoryStore(): OperationalStateStore {
  const map = new Map<string, OperationalStateRecord>()
  return {
    active: true,
    load: (key) => map.get(key) ?? null,
    save: (r) => { map.set(r.key, { ...r, states: { ...r.states } }) },
  }
}

let active: OperationalStateStore = dormantStore
export function operationalStore(): OperationalStateStore { return active }
/** Tests only: activate an isolated store regardless of the dormancy flag. */
export function __activateStoreForTest(store: OperationalStateStore): void { active = store }
export function __resetStore(): void { active = dormantStore }

/** The cross-session states still ACTIVE (not cleared) in a record. */
export function carriedStatesFromRecord(rec: OperationalStateRecord | null): PersistentState[] {
  if (!rec) return []
  return (Object.keys(rec.states) as PersistentState[])
    .filter((s) => CROSS_SESSION_STATES.includes(s) && rec.states[s] === 'active')
}

/** A fresh session seeded with the carried-over states loaded for this key (dormant → none). */
export function loadSession(key: string): SafetySession {
  const rec = operationalStore().load(key)
  return newSafetySession(carriedStatesFromRecord(rec))
}

/** Persist the cross-session states active in a session (dormant → no-op, collects nothing). */
export function persistSession(key: string, session: SafetySession): void {
  const store = operationalStore()
  if (!store.active) return
  const prev = store.load(key)
  const states: Partial<Record<PersistentState, ClearanceStatus>> = { ...(prev?.states ?? {}) }
  for (const s of session.active) if (CROSS_SESSION_STATES.includes(s)) states[s] = 'active'
  for (const s of session.carriedOver) if (CROSS_SESSION_STATES.includes(s)) states[s] = states[s] ?? 'active'
  store.save({ key, states, updatedAt: new Date().toISOString() })
}

/** Record a clearance (spec §2 resolution — set by the router/state machine, never the model). */
export function clearState(key: string, state: PersistentState): void {
  const store = operationalStore()
  if (!store.active) return
  const prev = store.load(key)
  const states: Partial<Record<PersistentState, ClearanceStatus>> = { ...(prev?.states ?? {}) }
  states[state] = 'cleared'
  store.save({ key, states, updatedAt: new Date().toISOString() })
}
