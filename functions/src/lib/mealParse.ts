/**
 * Server copy of the meal-scan prompt + validator. Kept in sync with the client's
 * src/lib/mealScanParse.ts (identical logic) so the server and client agree on the
 * food gate, the calorie RANGE, and the clamping of every field. Duplicated
 * intentionally — functions/ is a separate deploy target from the app.
 */

export type Confidence = 'low' | 'medium' | 'high'
export type Rec = 'freely' | 'moderation' | 'occasional'

export type MealFood = {
  kind: 'food'
  name: string
  items: string[]
  kcalLow: number
  kcalHigh: number
  p: number
  c: number
  f: number
  confidence: Confidence
  rec: Rec
  note: string
}

export type MealAnalysis = MealFood | { kind: 'not_food' }

export const MEAL_SCAN_PROMPT = [
  'You are a nutrition photo estimator inside a fitness app for university students in Australia.',
  'Look at the image and respond with ONLY a JSON object. No prose, no markdown, no code fences.',
  '',
  'First decide if the image is a photo of food or drink a person would actually eat and log.',
  'If it is NOT food (a person, a screenshot, an object, a pet, etc.) respond exactly: {"food":false}',
  '',
  'If it IS food, estimate conservatively and honestly. A single photo gives only a rough idea, so return a calorie RANGE, never one confident number. Respond with:',
  '{',
  '  "food": true,',
  '  "name": "<short dish name>",',
  '  "items": ["<main component>", "..." up to 5],',
  '  "kcalLow": <integer>, "kcalHigh": <integer>,',
  '  "protein": <grams integer>, "carbs": <grams integer>, "fat": <grams integer>,',
  '  "confidence": "low" | "medium" | "high",',
  '  "rec": "freely" | "moderation" | "occasional",',
  '  "note": "<one short warm sentence, no medical claims, no em dashes>"',
  '}',
  'All numbers are for ONE serving. If you are unsure, widen the range and use "low".',
  'Never invent precision. Do not diagnose or give medical advice.',
].join('\n')

export function extractJson(raw: string): string {
  const m = raw.match(/\{[\s\S]*\}/)
  return m ? m[0] : raw
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

export function parseMealAnalysis(raw: string): MealAnalysis {
  let obj: unknown
  try {
    obj = JSON.parse(extractJson((raw ?? '').trim()))
  } catch {
    throw new Error('Could not read the estimate')
  }
  if (!obj || typeof obj !== 'object') throw new Error('Could not read the estimate')
  const o = obj as Record<string, unknown>

  if (o.food === false) return { kind: 'not_food' }
  if (o.food !== true) throw new Error('Could not read the estimate')

  const kcalLow = clampInt(o.kcalLow, 0, 4000, 0)
  const kcalHigh = Math.max(kcalLow, clampInt(o.kcalHigh, 0, 5000, kcalLow))
  const confidence: Confidence =
    o.confidence === 'high' ? 'high' : o.confidence === 'medium' ? 'medium' : 'low'
  const rec: Rec = o.rec === 'freely' ? 'freely' : o.rec === 'occasional' ? 'occasional' : 'moderation'
  const name =
    typeof o.name === 'string' && o.name.trim() ? o.name.trim().slice(0, 60) : 'Your meal'
  const items = Array.isArray(o.items)
    ? o.items.filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, 5).map((x) => x.trim().slice(0, 40))
    : []
  const note =
    typeof o.note === 'string' ? o.note.trim().slice(0, 200).replace(/[—–]/g, '-') : ''

  return {
    kind: 'food',
    name,
    items,
    kcalLow,
    kcalHigh,
    p: clampInt(o.protein, 0, 400, 0),
    c: clampInt(o.carbs, 0, 600, 0),
    f: clampInt(o.fat, 0, 300, 0),
    confidence,
    rec,
    note,
  }
}
