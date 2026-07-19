import { doc, onSnapshot, type Firestore } from 'firebase/firestore'
import { COACH_ENABLED } from '../backend/coach/coachGate'
import { setKillSwitchSource } from '../backend/coach/safety/killSwitch'

/**
 * Server-side kill-switch SOURCE (spec §20). Feeds the coach-safety kill switch from a
 * cross-platform Firestore flag — `config/coach.killSwitch` — instead of the web-only Remote
 * Config JS SDK. Setting that flag to `true` disables the coach remotely, without a build. It
 * sits ALONGSIDE `COACH_ENABLED` (the master switch) and can only ever ADD a reason to be off.
 *
 * DORMANT while `COACH_ENABLED` is false: this returns immediately and starts no listener / no
 * reads. `config/coach` requires an authenticated read, so when the coach is eventually enabled
 * this should run after sign-in; a denied/failed read leaves the switch NOT engaged (fail-safe),
 * so availability simply falls back to the `COACH_ENABLED` gate.
 */
let started = false

export function startCoachKillSwitch(db: Firestore | null): void {
  if (started || !COACH_ENABLED || !db) return // dormant: no listener while the coach is off
  started = true
  let engaged = false
  onSnapshot(
    doc(db, 'config', 'coach'),
    (snap) => { engaged = snap.exists() && snap.get('killSwitch') === true },
    () => { engaged = false }, // read failed (e.g. before sign-in) → fail safe: not engaged
  )
  setKillSwitchSource({ engaged: () => engaged })
}
