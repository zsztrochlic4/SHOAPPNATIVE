/**
 * Generator Flow step 5 — weekly volume budget per muscle.
 * Source: sheet "Weekly Volume" (targets + 7 reconciliation rules) + "External Commitments"
 * (cuts). Produces a per-muscle {min,max} target the session builder aims at. The safe
 * floor (rule 7: >=4 direct sets) and the hard cap (20) are enforced here.
 */

import { WEEKLY_VOLUME } from '../data/weeklyVolume'
import { EXTERNAL_COMMITMENTS } from '../data/externalCommitments'
import type { BackendExperience, BackendGoal, Commitment, FocalPoint } from '../schema'

export const MAJOR_MUSCLES = ['Chest', 'Back', 'Quads', 'Hamstrings & Glutes', 'Shoulders'] as const
export const HALF_MUSCLES = ['Biceps', 'Triceps', 'Calves', 'Core'] as const
export const ALL_MUSCLES = [...MAJOR_MUSCLES, ...HALF_MUSCLES]

export const FLOOR = 4
export const CAP = 20

export type VolumeTargets = Record<string, { min: number; max: number }>

const clampSet = (n: number) => Math.max(FLOOR, Math.min(CAP, n))

export function volumeTargets(
  goal: BackendGoal,
  experience: BackendExperience,
  focalPoints: FocalPoint[],
  commitments: Commitment[],
): VolumeTargets {
  const row =
    WEEKLY_VOLUME.find((r) => r.goal === goal && r.experience === experience) ??
    WEEKLY_VOLUME.find((r) => r.goal === goal && r.experience === 'All')
  const baseMin = row?.weeklySetsMin ?? 6
  const baseMax = row?.weeklySetsMax ?? 12

  const targets: VolumeTargets = {}
  for (const m of MAJOR_MUSCLES) targets[m] = { min: baseMin, max: baseMax }
  // Rule 4: arms, calves, core at half the main target, direct sets only.
  for (const m of HALF_MUSCLES) targets[m] = { min: Math.ceil(baseMin / 2), max: Math.ceil(baseMax / 2) }

  // Rule 5: focal points add 3–4 sets to each chosen muscle (cap 20).
  for (const f of focalPoints) {
    if (targets[f]) { targets[f].min += 3; targets[f].max += 4 }
  }

  // Rule 6: commitment volume cuts, netted against focal additions.
  for (const c of commitments) {
    const cr = EXTERNAL_COMMITMENTS.find((x) => x.commitmentType === c.commitment_type)
    if (!cr || cr.volumeCutSetsMax === 0) continue
    const cut = Math.round((cr.volumeCutSetsMin + cr.volumeCutSetsMax) / 2)
    for (const m of cr.volumeCutMuscles) {
      if (m === 'user_reported' || !targets[m]) continue
      targets[m].min -= cut
      targets[m].max -= cut
    }
  }

  // Rule 7: floor 4 / cap 20 on every muscle.
  for (const m of Object.keys(targets)) {
    targets[m].min = clampSet(targets[m].min)
    targets[m].max = clampSet(Math.max(targets[m].max, targets[m].min))
  }
  return targets
}
