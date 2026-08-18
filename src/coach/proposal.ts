/**
 * Shared helpers for rendering a coach action proposal as the ONE reusable
 * confirmation card (see CoachActionCard). Category → colour and the optional
 * before→after diff both live here so the card never re-derives design values.
 */
import type { AppState } from '../store/types'
import type { CoachActionProposal } from '../backend/coach/contracts'
import type { Palette } from '../theme'
import { exerciseView } from '../store/programSession'
import { resolveExerciseRef } from '../backend/data'
import { fmtWeight } from '../lib/format'

/** The four coach action categories, keyed to their accent colour (per CLAUDE.md). */
export type CoachCategory = 'training' | 'recovery' | 'progress' | 'nutrition'

const CATEGORY_LABEL: Record<CoachCategory, string> = {
  training: 'Training',
  recovery: 'Recovery',
  progress: 'Progress',
  nutrition: 'Nutrition',
}

/** Category → accent colour: Training = brand green, Recovery = orange, Progress = blue, Nutrition = purple. */
export function categoryColor(cat: CoachCategory, c: Palette): string {
  return cat === 'training' ? c.brand400 : cat === 'recovery' ? c.accentOrange : cat === 'progress' ? c.accentBlue : c.accentPurple
}

export function categoryLabel(cat: CoachCategory): string {
  return CATEGORY_LABEL[cat]
}

/** Map a proposal to its category, so every proposed change carries the right coloured dot + label. */
export function proposalCategory(p: CoachActionProposal): CoachCategory {
  if (p.kind === 'navigation') {
    const overlay = String(p.payload?.overlay ?? '')
    if (overlay === 'progress' || overlay === 'logWeight') return 'progress'
    if (overlay === 'nutrition' || overlay === 'budgetEats' || overlay === 'logProgress') return 'nutrition'
    return 'training'
  }
  if (p.kind === 'workout_action') {
    switch (String(p.payload?.action ?? '')) {
      case 'planned_absence':
      case 'exam_mode':
      case 'catch_up':
      case 'deload':
        return 'recovery'
      case 'set_goal_weight':
      case 'share_pr':
        return 'progress'
      case 'set_wellness_goal':
      case 'open_budget_eats':
      case 'nudge_log':
        return 'nutrition'
      default:
        return 'training'
    }
  }
  return 'training'
}

/** A clean old→new value pair when the change has one, else null (the card then omits the diff). */
export function proposalDiff(p: CoachActionProposal, state: AppState): { from: string; to: string } | null {
  if (p.kind !== 'workout_action') return null
  const payload = p.payload ?? {}
  const num = (v: unknown) => (typeof v === 'number' ? v : Number(v))
  const units = state.settings.units
  const profile = state.profile

  if (payload.action === 'set_wellness_goal') {
    const value = num(payload.value)
    if (!Number.isFinite(value)) return null
    if (payload.metric === 'water') return { from: `${profile.waterTargetL} L`, to: `${value} L` }
    if (payload.metric === 'sleep') return { from: `${profile.sleepTargetH} hrs`, to: `${value} hrs` }
    if (payload.metric === 'steps')
      return { from: `${Math.round(profile.stepTarget).toLocaleString('en-AU')}`, to: `${Math.round(value).toLocaleString('en-AU')}` }
    return null
  }
  if (payload.action === 'set_goal_weight') {
    const kg = num(payload.valueKg)
    if (!Number.isFinite(kg)) return null
    return { from: fmtWeight(profile.goalWeightKg, units), to: fmtWeight(kg, units) }
  }
  return null
}

/** Resolve a navigation proposal's exercise reference to a real, renderable exercise id (or null). */
export function resolveNavExerciseId(payload: Record<string, string | number | boolean> | undefined): string | null {
  const raw = String(payload?.exercise ?? payload?.defId ?? '')
  if (!raw) return null
  const direct = exerciseView(raw) ? raw : null
  const id = direct ?? resolveExerciseRef(raw)
  return id && exerciseView(id) ? id : null
}

/** A proposal renders unless it's an exerciseDetail nav whose exercise can't be resolved to a real lift. */
export function isProposalRenderable(p: CoachActionProposal): boolean {
  if (p.kind === 'navigation' && String((p.payload as Record<string, unknown>)?.overlay) === 'exerciseDetail') {
    return resolveNavExerciseId(p.payload) != null
  }
  return true
}

/** Title shown on the proposal card — names the resolved lift for an exerciseDetail nav. */
export function proposalDisplayTitle(p: CoachActionProposal): string {
  if (p.kind === 'navigation' && String((p.payload as Record<string, unknown>)?.overlay) === 'exerciseDetail') {
    const id = resolveNavExerciseId(p.payload)
    const name = id ? exerciseView(id)?.name : null
    if (name) return `Open the ${name} guide`
  }
  return p.title
}

/** Detects an explicit request for evidence ("how do you know", "source?", "proof"), so the coach can
 *  surface a citation as a follow-up ONLY when asked (citations are never shown inline by default). */
export function isProofRequest(text: string): boolean {
  return /\b(how (?:do|did|would) (?:you|u) know|how'd you know|says who|what'?s (?:your |the )?source|sources?\b|proof\b|evidence\b|according to|cite|back that up|says? who)\b/i.test(
    text,
  )
}
