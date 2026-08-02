/**
 * Active-workout runtime persistence (audit F-010 / J-08).
 *
 * Closing or backgrounding the workout surface used to reset the elapsed
 * clock, guided cursor, rest timer and started flag — an interrupted workout
 * lost all timing/navigation context. This module persists that runtime as
 * WALL-CLOCK timestamps so a resume is accurate no matter how long the app
 * was away, and the pure `resumableRuntime` decision is unit-tested.
 *
 * Only cursor/timer context is stored (no set data — the session itself lives
 * in AppState, which is identity-scoped separately). A stored runtime resumes
 * only for the exact same session id, and expires after RESUME_MAX_AGE_MS.
 */

export interface WorkoutRuntime {
  sessionId: string
  /** Wall-clock epoch the workout effectively started (now − elapsed). */
  startedAtMs: number
  started: boolean
  mode: 'list' | 'work' | 'rest'
  cursor: { exIdx: number; setIdx: number }
  /** Wall-clock epoch the current rest ends, when mode === 'rest'. */
  restEndsAtMs: number | null
  restTotal: number
  savedAtMs: number
}

/** A runtime older than this is stale — yesterday's half-workout should not
 *  hijack today's fresh session. */
export const RESUME_MAX_AGE_MS = 12 * 60 * 60 * 1000

export interface ResumePlan {
  started: boolean
  mode: 'list' | 'work' | 'rest'
  cursor: { exIdx: number; setIdx: number }
  totalElapsedSec: number
  restRemainingSec: number
  restTotal: number
}

/**
 * Decide how (whether) a stored runtime resumes for `sessionId` at `nowMs`.
 * Pure so it can be tested: returns null when the record belongs to another
 * session, is stale, or never actually started. An expired rest phase resumes
 * straight into 'work' (the rest finished while the app was away).
 */
export function resumableRuntime(
  rt: WorkoutRuntime | null | undefined,
  sessionId: string,
  nowMs: number,
): ResumePlan | null {
  if (!rt || rt.sessionId !== sessionId || !rt.started) return null
  if (!Number.isFinite(rt.savedAtMs) || nowMs - rt.savedAtMs > RESUME_MAX_AGE_MS) return null
  const cursor = {
    exIdx: Math.max(0, Math.floor(rt.cursor?.exIdx ?? 0)),
    setIdx: Math.max(0, Math.floor(rt.cursor?.setIdx ?? 0)),
  }
  const totalElapsedSec = Math.max(0, Math.floor((nowMs - rt.startedAtMs) / 1000))
  if (rt.mode === 'rest' && rt.restEndsAtMs != null) {
    const restRemainingSec = Math.ceil((rt.restEndsAtMs - nowMs) / 1000)
    if (restRemainingSec > 0) {
      return { started: true, mode: 'rest', cursor, totalElapsedSec, restRemainingSec, restTotal: Math.max(rt.restTotal, restRemainingSec) }
    }
    // Rest completed while away → resume ready to work the next set.
    return { started: true, mode: 'work', cursor, totalElapsedSec, restRemainingSec: 0, restTotal: rt.restTotal }
  }
  return {
    started: true,
    mode: rt.mode === 'work' ? 'work' : 'list',
    cursor,
    totalElapsedSec,
    restRemainingSec: 0,
    restTotal: rt.restTotal,
  }
}

/* ------------------------- storage (app side) ------------------------- */

const STORAGE_KEY = 'sho.activeWorkout.runtime.v1'

async function storage() {
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage')
  return AsyncStorage
}

export async function saveWorkoutRuntime(rt: WorkoutRuntime): Promise<void> {
  try {
    await (await storage()).setItem(STORAGE_KEY, JSON.stringify(rt))
  } catch {
    /* best-effort */
  }
}

export async function loadWorkoutRuntime(): Promise<WorkoutRuntime | null> {
  try {
    const raw = await (await storage()).getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as WorkoutRuntime) : null
  } catch {
    return null
  }
}

export async function clearWorkoutRuntime(): Promise<void> {
  try {
    await (await storage()).removeItem(STORAGE_KEY)
  } catch {
    /* best-effort */
  }
}
