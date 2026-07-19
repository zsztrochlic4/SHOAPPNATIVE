/**
 * Server-side kill switch (spec §20). Lets the coach be disabled remotely (e.g. Firebase Remote
 * Config) WITHOUT shipping a build. It sits ALONGSIDE the COACH_ENABLED gate and can only ever ADD
 * a reason to be off — it never turns the coach on.
 *
 * Default: not engaged, sourced locally. When wired to Remote Config, call setKillSwitchSource.
 * A read failure here defaults to NOT engaged (it won't cause an outage on its own); operators can
 * choose a fail-closed remote default if they prefer. Because COACH_ENABLED is false, the coach is
 * off regardless of this switch today.
 */

export interface KillSwitchSource {
  engaged(): boolean
}

const localOff: KillSwitchSource = { engaged: () => false }
let source: KillSwitchSource = localOff

/** Wire a remote source (e.g. Remote Config). Future ops step. */
export function setKillSwitchSource(s: KillSwitchSource): void { source = s }
export function __resetKillSwitch(): void { source = localOff }

/** True → the coach is remotely disabled, regardless of COACH_ENABLED. */
export function coachKillSwitchEngaged(): boolean {
  try { return source.engaged() } catch { return false }
}
