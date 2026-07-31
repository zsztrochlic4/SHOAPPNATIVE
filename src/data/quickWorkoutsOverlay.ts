/**
 * Pure validation + merge for the quick-workout Firestore overlay.
 *
 * The bundled seed (src/data/quickWorkouts.generated.ts, built from the
 * spreadsheet) is the always-available offline default. On top of it we overlay
 * an optional Firestore `workouts` collection (written by
 * scripts/upload-workouts.mjs) so a workout can be edited or added WITHOUT an app
 * release — exactly like recipes (src/data/recipes.ts) and exercise info.
 *
 * A quick workout drives a live COUNTDOWN player, so a malformed cloud doc must
 * never reach it. Every doc is fully validated here and every timing value is
 * clamped to sane bounds; a doc that can't be made safe is dropped and the seed
 * entry stays. This module is pure (no Firebase, no React) so it is unit-tested
 * node-side — the reactive/Firestore wrapper lives in src/data/quickWorkouts.ts.
 */
import type { QuickWorkout, QuickRound, QuickStation, WorkoutLevel } from '../store/types'

const LEVELS = new Set<WorkoutLevel>(['Beginner', 'Intermediate', 'Advanced'])

// Sane bounds — a cloud typo (e.g. workSec: 99999, or a negative rest) can never
// make the player hang or run backwards. Values outside the range fall back to
// the field default rather than dropping the whole workout.
const clampInt = (v: unknown, min: number, max: number, fallback: number): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback
  return Math.min(max, Math.max(min, Math.round(v)))
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined)

/** Validate + clamp one raw station. Returns null if the exercise link is missing. */
function stationFromDoc(raw: any): QuickStation | null {
  const exerciseId = str(raw?.exerciseId)
  const name = str(raw?.name)
  if (!exerciseId || !name) return null
  const st: QuickStation = {
    exerciseId,
    name,
    workSec: clampInt(raw.workSec, 1, 600, 30),
    restSec: clampInt(raw.restSec, 0, 300, 15),
  }
  const repHint = str(raw.repHint)
  if (repHint) st.repHint = repHint
  if (raw.perSide === true) st.perSide = true
  return st
}

/** Validate one raw round. Returns null if it has no usable stations. */
function roundFromDoc(raw: any, index: number): QuickRound | null {
  if (!raw || !Array.isArray(raw.stations)) return null
  const stations = raw.stations.map(stationFromDoc).filter((s: QuickStation | null): s is QuickStation => !!s)
  if (!stations.length) return null
  const round: QuickRound = {
    round: clampInt(raw.round, 1, 99, index + 1),
    stations,
  }
  if (raw.build === true) round.build = true
  // roundRestSec is optional (absent on the final round); only keep a valid one.
  if (typeof raw.roundRestSec === 'number' && Number.isFinite(raw.roundRestSec)) {
    round.roundRestSec = clampInt(raw.roundRestSec, 0, 600, 60)
  }
  return round
}

/**
 * Validate + normalise a raw Firestore workout doc into a QuickWorkout, or null
 * if it is unusable (so one bad document can never break the list — the seed
 * entry is kept instead).
 */
export function workoutFromDoc(raw: any): QuickWorkout | null {
  if (!raw || typeof raw !== 'object') return null
  const id = str(raw.id)
  const name = str(raw.name)
  if (!id || !name) return null
  if (!LEVELS.has(raw.level)) return null
  if (!Array.isArray(raw.rounds)) return null
  const rounds = raw.rounds
    .map((r: any, i: number) => roundFromDoc(r, i))
    .filter((r: QuickRound | null): r is QuickRound => !!r)
  if (!rounds.length) return null
  return {
    id,
    name,
    level: raw.level,
    order: clampInt(raw.order, 1, 999, 999),
    focus: str(raw.focus) ?? '',
    minutes: clampInt(raw.minutes, 1, 120, 12),
    rounds,
  }
}

/**
 * Overlay cloud docs on the bundled seed: an edited/new workout wins by `id`, a
 * doc flagged `deprecated` is removed, malformed docs are ignored. The result is
 * re-sorted beginner→advanced by `order` (then name) so a cloud order change
 * takes effect. Never throws.
 */
export function overlayQuickWorkouts(seed: QuickWorkout[], cloudDocs: any[]): QuickWorkout[] {
  const map = new Map<string, QuickWorkout>(seed.map((w) => [w.id, w]))
  for (const raw of Array.isArray(cloudDocs) ? cloudDocs : []) {
    const id = str(raw?.id)
    if (!id) continue
    if (raw.deprecated === true) {
      map.delete(id)
      continue
    }
    const w = workoutFromDoc(raw)
    if (w) map.set(w.id, w)
  }
  return [...map.values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
}
