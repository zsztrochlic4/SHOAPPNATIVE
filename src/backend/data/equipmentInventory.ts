/**
 * Equipment TIER vs. explicit INVENTORY (audit R5-005).
 *
 * `equipmentTags.ts` is a GENERATED union of every `requiredEquipmentTags` value that
 * appears on the exercises of a tier. That union is the right answer for "which tags can a
 * tier's exercises reference", but it is the WRONG answer for "what does a user of this tier
 * own by default": several exercises the workbook files under the Bodyweight tier actually
 * need a resistance band, an anchor point, a pull-up bar, a cable machine, rings or a rack.
 * Seeding a genuine no-equipment user with that whole union prescribes movements they cannot
 * physically perform (14 band/cable/pull-up-bar exercises in a default Bodyweight plan).
 *
 * The onboarding flow already models explicit inventory: a user who owns a band or a pull-up
 * bar ticks the matching equipment chip (see EQUIPMENT_TAG_MAP), which adds those tags on top
 * of the tier base. So the tier BASE must only include what the tier's name genuinely implies:
 *   • Bodyweight → the body plus ubiquitous household surfaces (floor, wall, chair, table…).
 *   • Basic Gym / Full Gym → a real gym, which does stock bands, benches, racks, machines.
 *
 * The Bodyweight base is derived by intersecting the generated union with an explicit
 * household allowlist, so a workbook regeneration can never silently re-grant gym equipment
 * to no-equipment users — anything outside the allowlist requires an explicit chip.
 */
import { BODYWEIGHT_TAGS, BASIC_GYM_TAGS, FULL_GYM_TAGS } from './equipmentTags'
import type { EquipmentTier } from '../schema'

/**
 * Tags a genuine no-equipment / at-home user can be assumed to have without owning any
 * purchased fitness equipment: the floor, a wall, common furniture and a towel. Anything
 * requiring a purchase (band, pull-up bar, rings, kettlebell, bench proper, machines, bars)
 * is deliberately excluded and must be opted into via an equipment chip.
 */
export const HOUSEHOLD_EQUIPMENT: readonly string[] = [
  'bed',
  'box',
  'chair',
  'desk',
  'floor',
  'sliders',
  'smooth_floor',
  'stair',
  'step',
  'sturdy_table',
  'table',
  'towel',
  'wall',
]

const HOUSEHOLD_SET = new Set(HOUSEHOLD_EQUIPMENT)

/** Bodyweight base = only the household-owned subset of the generated Bodyweight union. */
export const BODYWEIGHT_BASE_TAGS: string[] = BODYWEIGHT_TAGS.filter((t) => HOUSEHOLD_SET.has(t))

/**
 * Default owned inventory for a tier, before the user's explicit equipment chips are added.
 * Basic/Full Gym keep the full union (a gym stocks that equipment); Bodyweight is restricted
 * to genuinely household-owned tags so generated plans are always physically executable.
 */
export const DEFAULT_INVENTORY_BY_TIER: Record<EquipmentTier, string[]> = {
  'Full Gym': FULL_GYM_TAGS,
  'Basic Gym': BASIC_GYM_TAGS,
  Bodyweight: BODYWEIGHT_BASE_TAGS,
}

/**
 * Whether a user who owns `owned` can perform an exercise requiring `requiredTags` (R5-005).
 *
 * Each element of `requiredTags` is an AND requirement satisfied by any one of its '/'-separated
 * alternatives (OR). The workbook uses the sentinel `"none"` (and, defensively, an empty token)
 * to mean "no equipment required" — such a token is ALWAYS satisfied. Previously the filters
 * compared it literally, so genuinely no-equipment movements (push-ups, bodyweight squats, planks,
 * bodyweight rows) were unreachable for EVERY tier because no inventory contains the string "none".
 * Centralised here so every call site (generator, preview, swaps, invariants) agrees.
 */
export function equipmentTagsSatisfied(
  requiredTags: readonly string[],
  owned: ReadonlySet<string> | readonly string[],
): boolean {
  const has = owned instanceof Set ? (x: string) => owned.has(x) : (x: string) => (owned as readonly string[]).includes(x)
  return requiredTags.every((t) =>
    t.split('/').some((raw) => {
      const x = raw.trim()
      return x === '' || x === 'none' || has(x)
    }),
  )
}
