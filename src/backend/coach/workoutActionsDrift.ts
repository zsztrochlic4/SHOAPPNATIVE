/**
 * Compile-time DRIFT GUARD for src/backend/coach/workoutActions.ts.
 *
 * `workoutActions.ts` is deliberately dependency-free (it must stay out of the coach-safety
 * sync closure), so it MIRRORS the canonical engine enums as local literal arrays instead of
 * importing them. This file — imported by nobody, therefore never synced — asserts at compile
 * time that each mirror is EXACTLY the canonical union. If someone adds a SwapReason / Goal /
 * Weekday / absence mode to the engine and forgets to mirror it (or vice-versa), `npx tsc`
 * fails here rather than the coach silently proposing or rejecting the wrong value.
 */

import type { Weekday, BackendGoal, AbsenceMode } from '../schema'
import type { SwapReason } from '../generator/swaps'
import type { MissAction } from '../generator/adapt'
import type { SwapReasonLit, BackendGoalLit, WeekdayLit, AbsenceModeLit, CatchUpModeLit } from './workoutActions'

/** `true` only when A and B are the same union in both directions; otherwise `never`. */
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never

// Each line fails to compile (true is not assignable to never) if the mirror drifts.
export const _driftSwapReason: Exact<SwapReasonLit, SwapReason> = true
export const _driftBackendGoal: Exact<BackendGoalLit, BackendGoal> = true
export const _driftWeekday: Exact<WeekdayLit, Weekday> = true
export const _driftAbsenceMode: Exact<AbsenceModeLit, AbsenceMode> = true
export const _driftCatchUpMode: Exact<CatchUpModeLit, MissAction> = true
