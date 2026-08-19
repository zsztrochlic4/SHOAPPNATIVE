/**
 * Deterministic GOAL-DIRECTION backstop (coach correctness, spec: "interpret every trend against the
 * goal's intended direction; never praise a trend that moves the wrong way").
 *
 * The small model reliably knows the user's goal and weight but does NOT reliably APPLY the direction
 * rule: on a live test it praised a downward body-weight trend as "a positive sign for your goal of
 * building muscle" (a muscle-building goal wants weight to hold or climb toward a higher goal weight).
 * Prompt instructions alone did not fix it, so — exactly like the schedule-grounded reply backstop —
 * this computes the answer deterministically and overrides the model when the user asks how their
 * progress / on-track status looks. Correct by construction; the model can never invert the direction.
 *
 * Bounds: fires ONLY on an explicit progress / on-track question, ONLY when a real current body-weight
 * reading is available, and NEVER states or implies a calorie or macro target (nutrition is qualitative
 * in this app). General-fitness goals are weight-direction-neutral, so the reply leans on training
 * signals instead. Pure and dependency-free so it lives in the shared safety layer and is unit-tested.
 */

export interface GoalProgressInput {
  /** BackendGoal: 'Hypertrophy' | 'Strength' | 'Fat Loss' | 'General Fitness'. */
  goal: string
  name?: string | null
  /** Most recent logged body weight (kg), or null when none is logged. */
  currentKg: number | null
  /** Earliest body weight (kg) in the recent window, for the trend. */
  priorKg: number | null
  /** Target / goal body weight (kg) when set. */
  goalWeightKg?: number | null
  /** Precomputed "new bests…" line, if any. */
  recentPRs?: string | null
  /** Short training-adherence note, e.g. "you have logged your recent sessions consistently". */
  sessionsNote?: string | null
}

const ONE = /\b(am i on track|on track for my goal|are we on track|am i progressing|making progress|am i making progress|how(?:'s| is| am i) (?:my )?(?:progress|going|doing)|how am i (?:tracking|going|doing)|is (?:this|it) working|am i improving|any progress|progress so far|going in the right direction)\b/i

/** True when the message is asking how the user's overall progress / on-track status looks. */
export function isProgressQuestion(text: string): boolean {
  return ONE.test(text)
}

type Dir = 'up' | 'down' | 'neutral'
function intendedDirection(goal: string): Dir {
  const g = goal.toLowerCase()
  if (g.includes('fat') || g.includes('loss') || g.includes('lose') || g.includes('cut')) return 'down'
  if (g.includes('hypertroph') || g.includes('muscle') || g.includes('strength') || g.includes('gain') || g.includes('build')) return 'up'
  return 'neutral'
}

function round1(n: number): string {
  return (Math.round(n * 10) / 10).toString()
}

/**
 * A goal-direction-correct, data-grounded progress reply, or null when the message is not a progress
 * question or there is no weight reading to reason from (the model then answers normally).
 */
export function synthesizeGoalProgressReply(input: GoalProgressInput, text: string): string | null {
  if (!isProgressQuestion(text)) return null
  const { currentKg, priorKg, goalWeightKg, name } = input
  if (currentKg == null || !Number.isFinite(currentKg)) return null

  const who = name && name.trim() ? `, ${name.trim()}` : ''
  const dir = intendedDirection(input.goal)
  const trainingBits: string[] = []
  if (input.recentPRs && input.recentPRs.trim()) trainingBits.push(input.recentPRs.trim().replace(/\.$/, ''))
  if (input.sessionsNote && input.sessionsNote.trim()) trainingBits.push(input.sessionsNote.trim().replace(/\.$/, ''))
  const training = trainingBits.length
    ? `On training you are moving in the right direction${who}: ${trainingBits.join(', and ')}.`
    : `Keep your sessions consistent and your lifts progressing${who}, that is the clearest sign your plan is working.`

  // Body-weight trend vs the goal's intended direction.
  const trend = priorKg != null && Number.isFinite(priorKg) ? currentKg - priorKg : null
  let weightLine = ''
  if (dir === 'neutral') {
    weightLine = `Body weight sits around ${round1(currentKg)} kg. For staying healthy the number matters less than showing up, so judge progress by consistency and how you feel rather than the scale.`
  } else if (trend == null) {
    // No trend yet; state the goal direction so any future reading is read correctly.
    const want = dir === 'up' ? 'holding steady or edging up' : 'easing down gradually'
    weightLine = `Body weight is around ${round1(currentKg)} kg. For this goal you want it ${want}${goalWeightKg ? ` toward about ${round1(goalWeightKg)} kg` : ''}; keep logging so we can read the trend.`
  } else {
    const movingUp = trend > 0.1
    const movingDown = trend < -0.1
    const from = priorKg != null ? `from ${round1(priorKg)} to ${round1(currentKg)} kg` : `${round1(currentKg)} kg`
    const towardGoal = (dir === 'up' && !movingDown) || (dir === 'down' && !movingUp)
    if (dir === 'up') {
      if (movingDown) {
        weightLine = `Your body weight is drifting down ${from}, and for building muscle that is moving away from your goal${goalWeightKg ? ` of about ${round1(goalWeightKg)} kg` : ''}, not toward it. If gaining is the priority, lift your daily food a little so weight edges back up while your lifts keep climbing.`
      } else if (movingUp) {
        weightLine = `Your body weight is trending up ${from}, which is what you want for building muscle${goalWeightKg ? ` toward about ${round1(goalWeightKg)} kg` : ''}. Keep it gradual so it stays mostly muscle.`
      } else {
        weightLine = `Your body weight is holding around ${round1(currentKg)} kg. For muscle gain you generally want it slowly climbing${goalWeightKg ? ` toward about ${round1(goalWeightKg)} kg` : ''}, so a small, steady rise from here is the aim.`
      }
    } else { // dir === 'down' (fat loss)
      if (movingDown) {
        weightLine = `Your body weight is easing down ${from}, which is exactly the direction you want for fat loss${goalWeightKg ? ` toward about ${round1(goalWeightKg)} kg` : ''}. Keep the pace gradual and protein high so you hold onto muscle.`
      } else if (movingUp) {
        weightLine = `Your body weight is creeping up ${from}, which is moving away from your fat-loss goal${goalWeightKg ? ` of about ${round1(goalWeightKg)} kg` : ''}. Tighten up portions a little and keep training as you are.`
      } else {
        weightLine = `Your body weight is holding around ${round1(currentKg)} kg. For fat loss you want a gradual downward drift${goalWeightKg ? ` toward about ${round1(goalWeightKg)} kg` : ''}, so a small steady decline from here is the aim.`
      }
    }
    void towardGoal
  }

  return `${training} ${weightLine}`.trim()
}
