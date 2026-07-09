import type { AppState } from '../store/types'
import { streakStats, workoutsThisWeek, weightStats } from '../store/selectors'

/**
 * Turns a user's profile + key stats into a compact plain-text summary that we
 * inject into every AI call (coach today, workout/nutrition plans next). This is
 * how the AI "knows" the user: the app reads their private data and hands the
 * model exactly this context on each request — the model never sees the rest.
 *
 * Keep it short and factual: it's spent on every prompt, so it should be dense
 * signal, not prose. Absent/blank fields are omitted so early profiles stay lean.
 */
const GOAL_LABEL: Record<string, string> = {
  'build-muscle': 'build muscle',
  'lose-fat': 'lose fat',
  'gain-strength': 'get stronger',
  'stay-healthy': 'stay healthy',
}

const EQUIP_LABEL: Record<string, string> = {
  'full-gym': 'full gym',
  'home-basic': 'home basics (dumbbells and bands)',
  'dorm-bodyweight': 'dorm / bodyweight only',
}

export function buildUserContext(s: AppState): string {
  const p = s.profile
  const lines: string[] = []
  const add = (label: string, value: string | number | undefined | null | false) => {
    if (value === undefined || value === null || value === '' || value === false) return
    lines.push(`- ${label}: ${value}`)
  }

  const first = p.name?.split(' ')[0] || 'the student'
  add('Name', `${first}${p.age ? `, age ${p.age}` : ''}${p.sex && p.sex !== 'other' ? `, ${p.sex}` : ''}`)
  add('Main goal', GOAL_LABEL[p.goal] || p.goal)

  const w = weightStats(s)
  const body: string[] = []
  if (p.heightCm) body.push(`${p.heightCm}cm`)
  if (w.current) body.push(`${w.current}kg now`)
  if (p.goalWeightKg) body.push(`target ${p.goalWeightKg}kg`)
  if (body.length) add('Body', body.join(', '))

  add('Experience', p.experience)
  const schedule = [p.daysPerWeek ? `${p.daysPerWeek} days/week` : '', p.sessionMinutes ? `~${p.sessionMinutes} min/session` : '']
    .filter(Boolean).join(', ')
  add('Trains', schedule)
  add('Equipment', EQUIP_LABEL[p.equipment] || p.equipment)
  add('Works around (injuries/limits)', p.injuries?.trim())

  const diet = [...(p.dietaryPrefs ?? [])]
  if (p.budgetMode) diet.push('on a tight budget')
  if (diet.length) add('Diet', diet.join(', '))
  add('Daily targets', `${p.calorieTarget} kcal, ${p.proteinTarget}g protein`)

  if (p.examMode) add('Note', 'currently in exam season — protect study time, keep training light')
  add('Motivation', p.motivation?.trim())

  // A little live progress so advice reflects where they actually are.
  const streak = streakStats(s).current
  const wk = workoutsThisWeek(s)
  const prog: string[] = []
  if (streak > 0) prog.push(`${streak}-day streak`)
  prog.push(`${wk} workout${wk === 1 ? '' : 's'} this week`)
  add('Recent progress', prog.join(', '))

  return lines.join('\n')
}
