import { FOOD_KB, NUTRITION_QA, type FoodTag, type FoodTier } from '../data/nutrition'
import type { Goal } from '../store/types'

/* ------------------------------------------------------------------ */
/*  On-device nutrition coach.                                         */
/*  Heuristic, rules-based and offline — no external API. Built to     */
/*  read a free-text food log and give warm, goal-aware feedback.      */
/* ------------------------------------------------------------------ */

export interface DayReview {
  empty: boolean
  score: number
  verdict: string
  summary: string
  found: { label: string; tier: FoodTier }[]
  highlights: string[]
  improvements: string[]
  encouragement: string
}

const TIER_RANK: Record<FoodTier, number> = { great: 0, good: 1, moderate: 2, limit: 3 }

function emptyCounts(): Record<FoodTag, number> {
  return {
    protein: 0, veg: 0, fruit: 0, wholegrain: 0, refined: 0, fried: 0,
    sugary: 0, processed: 0, dairy: 0, legume: 0, healthyfat: 0,
    'sugary-drink': 0, alcohol: 0, water: 0,
  }
}

export function reviewDay(text: string, goal: Goal): DayReview {
  const clean = text.trim().toLowerCase()
  if (!clean) {
    return { empty: true, score: 0, verdict: '', summary: '', found: [], highlights: [], improvements: [], encouragement: '' }
  }

  const counts = emptyCounts()
  const found: { label: string; tier: FoodTier }[] = []
  const proteinFoods: string[] = []
  const seen = new Set<string>()

  for (const entry of FOOD_KB) {
    if (entry.keywords.some((k) => clean.includes(k))) {
      if (seen.has(entry.label)) continue
      seen.add(entry.label)
      found.push({ label: entry.label, tier: entry.tier })
      for (const tag of entry.tags) counts[tag] += 1
      if (entry.tags.includes('protein')) proteinFoods.push(entry.label)
    }
  }

  const vegFruit = counts.veg + counts.fruit
  const proteinSources = proteinFoods.length
  const treats = counts.sugary + counts['sugary-drink']
  const friedProcessed = counts.fried + counts.processed

  // ---- score (start neutral, nudge from there) ----
  let score = 5
  if (proteinSources >= 2) score += 2
  else if (proteinSources === 1) score += 1
  else score -= 1

  if (vegFruit >= 2) score += 2
  else if (vegFruit === 1) score += 1
  else score -= 1

  if (counts.wholegrain >= 1) score += 1
  if (counts.healthyfat >= 1 || counts.legume >= 1) score += 1
  if (counts.water >= 1) score += 1

  score -= Math.min(2, friedProcessed)
  score -= Math.min(2, treats)
  if (counts.alcohol >= 1) score -= 1
  // a day that is only refined carbs with no veg/protein
  if (counts.refined >= 1 && vegFruit === 0 && proteinSources === 0) score -= 1

  score = Math.max(1, Math.min(10, Math.round(score)))

  // ---- verdict + summary ----
  const verdict =
    score >= 9 ? 'Excellent day' :
    score >= 7 ? 'Strong day' :
    score >= 5 ? 'Solid — a few tweaks' :
    score >= 3 ? 'Room to improve' :
    'Let\'s rebuild tomorrow'

  const goodBits: string[] = []
  if (proteinSources >= 1) goodBits.push('good protein')
  if (vegFruit >= 1) goodBits.push('some veg & fruit')
  if (counts.wholegrain >= 1) goodBits.push('smart carbs')
  const watchBits: string[] = []
  if (treats >= 1) watchBits.push('sugary extras')
  if (friedProcessed >= 1) watchBits.push('fried / processed food')
  if (counts.alcohol >= 1) watchBits.push('alcohol')

  let summary = ''
  if (goodBits.length) summary += `Nice work on ${list(goodBits)}.`
  if (watchBits.length) summary += `${summary ? ' ' : ''}Keep an eye on ${list(watchBits)}.`
  if (!summary) summary = 'Hard to read much from that — add a little detail on what you ate and I\'ll give you a sharper review.'

  // ---- highlights ----
  const highlights: string[] = []
  if (proteinSources >= 1) highlights.push(`Protein from ${list(proteinFoods.slice(0, 3))} — that supports recovery and keeps you full.`)
  if (vegFruit >= 2) highlights.push('Plenty of veg and fruit — great for fibre, vitamins and feeling satisfied.')
  else if (vegFruit === 1) highlights.push('You got some veg or fruit in — try to build on that tomorrow.')
  if (counts.wholegrain >= 1) highlights.push('Wholegrains / starchy carbs gave you steady energy for training and study.')
  if (counts.water >= 1) highlights.push('And you mentioned water — hydration quietly helps everything.')

  // ---- improvements (goal-aware, most useful first, capped at 3) ----
  const improvements: string[] = []
  const push = (s: string) => { if (improvements.length < 3) improvements.push(s) }

  if (proteinSources === 0) {
    push(goal === 'build-muscle' || goal === 'gain-strength'
      ? 'Add a clear protein to each meal — chicken, eggs, Greek yogurt or beans. It\'s the lever for building muscle.'
      : 'Add a protein source to your meals (eggs, chicken, yogurt, beans). It keeps you full and protects muscle.')
  } else if (proteinSources === 1) {
    push('Try to land protein at every main meal, not just one — spreading it out helps.')
  }

  if (vegFruit === 0) {
    push('Get some veg or fruit in — even frozen veg or a piece of fruit. Aim to fill half your plate with it.')
  }

  if (friedProcessed >= 2) {
    push(goal === 'lose-fat'
      ? 'Lots of fried / processed food today. Swapping one of those for a home-cooked plate would cut a lot of hidden calories.'
      : 'A few fried / processed items today — fine now and then, but home-cooked most of the time will serve you better.')
  }

  if (treats >= 2) {
    push('A couple of sugary extras crept in. No need to ban them — just dial them back to one and you\'re golden.')
  }

  if (counts.alcohol >= 1 && (goal === 'build-muscle' || goal === 'gain-strength' || goal === 'lose-fat')) {
    push('Alcohol blunts recovery and adds easy calories — keep it for the occasional night and drink water alongside.')
  }

  if (goal === 'lose-fat' && counts.refined >= 1 && counts.wholegrain === 0) {
    push('Swap a refined carb (white rice / bread) for a wholegrain or potato — more fibre, fuller for longer.')
  }

  if (improvements.length === 0) {
    push(goalNextTip(goal))
  }

  return {
    empty: false,
    score,
    verdict,
    summary,
    found: found.sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier]),
    highlights: highlights.slice(0, 3),
    improvements,
    encouragement: encouragementFor(goal, score),
  }
}

function goalNextTip(goal: Goal): string {
  switch (goal) {
    case 'build-muscle': return 'Strong base. To push muscle growth, make sure you\'re eating enough overall — an extra carb portion around training helps.'
    case 'gain-strength': return 'Great foundation. Fuel your heavy sessions with smart carbs and keep sleep and water high.'
    case 'lose-fat': return 'Really clean day. Keep protein and veg high like this and the fat loss takes care of itself.'
    default: return 'Lovely balanced day. Keep mixing up your veg and protein sources and you\'re set.'
  }
}

function encouragementFor(goal: Goal, score: number): string {
  if (score >= 8) return 'This is exactly the kind of day that adds up. Repeat it.'
  if (score >= 5) return 'Good base to build on — one small swap tomorrow and you\'re flying.'
  return goal === 'lose-fat'
    ? 'One day never makes or breaks it. Fresh plate at the next meal.'
    : 'No guilt — just aim for one better choice next meal. You\'ve got this.'
}

function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/* ------------------------------------------------------------------ */
/*  Ask-anything food Q&A                                              */
/* ------------------------------------------------------------------ */
export interface QAResult {
  matched: boolean
  question?: string
  answer: string
}

export function answerQuestion(text: string): QAResult {
  const clean = text.trim().toLowerCase()
  if (!clean) {
    return { matched: false, answer: 'Ask me anything about food — protein, snacks, eating on a budget, fat loss, eating out, and more.' }
  }
  let best: { score: number; q: typeof NUTRITION_QA[number] } | null = null
  for (const item of NUTRITION_QA) {
    const hits = item.keywords.reduce((a, k) => a + (clean.includes(k) ? 1 : 0), 0)
    if (hits > 0 && (!best || hits > best.score)) best = { score: hits, q: item }
  }
  if (best) return { matched: true, question: best.q.q, answer: best.q.a }
  return {
    matched: false,
    answer: 'I don\'t have a set answer for that one, but the golden rules cover most things: build meals around protein and veg, lean on wholegrains, keep sugary and fried food occasional, and drink water. Try rephrasing, or tap one of the common questions below.',
  }
}

/** Starter questions to surface as tappable chips. */
export const STARTER_QUESTIONS = NUTRITION_QA.slice(0, 6).map((q) => q.q)
export function answerForQuestion(q: string): QAResult {
  const item = NUTRITION_QA.find((x) => x.q === q)
  return item ? { matched: true, question: item.q, answer: item.a } : answerQuestion(q)
}
