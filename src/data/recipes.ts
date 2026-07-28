/**
 * Runtime recipe catalogue with a Firestore overlay (Nutrition → Recipes).
 *
 * The bundled `BUDGET_MEALS_SEED` (generated from the recipe spreadsheet) is the
 * always-available default, so the app shows recipes instantly, offline, and on
 * a brand-new install. On launch we then:
 *   1. hydrate the last cloud snapshot from AsyncStorage (fast, offline), then
 *   2. fetch the `recipes` collection from Firestore and overlay it on the seed —
 *      edited/new recipes win by id, and any doc marked `deprecated` is removed.
 *
 * This is what makes recipes editable WITHOUT an app release: edit the
 * spreadsheet → `npm run recipes:upload` → Firestore updates → clients pick it up
 * on next launch. Firestore is never required; if it is unavailable the seed (or
 * the cached snapshot) is used.
 *
 * Screens read the list through `useBudgetMeals()` (reactive via
 * useSyncExternalStore) so a cloud refresh re-renders them.
 */
import { useSyncExternalStore } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { BudgetMeal, MealCategory } from '../store/types'
import { BUDGET_MEALS_SEED } from './recipes.generated'

const CACHE_KEY = 'sho.recipes.cloud.v1'
const CATEGORIES = new Set<MealCategory>(['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Sweet'])

let current: BudgetMeal[] = BUDGET_MEALS_SEED
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

/** Current recipe list (seed, overlaid by any loaded cloud snapshot). */
export const getBudgetMeals = (): BudgetMeal[] => current
/** Look one up by id across the current list. */
export const budgetMealById = (id: string): BudgetMeal | undefined => current.find((m) => m.id === id)

/** Reactive hook for screens — re-renders when the cloud overlay loads. */
export function useBudgetMeals(): BudgetMeal[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
    () => current,
  )
}

/** Validate + normalise a raw Firestore recipe doc. Returns null if unusable, so a
 *  single bad cloud document can never break the list (the seed entry stays). */
function fromDoc(d: any): BudgetMeal | null {
  if (!d || typeof d !== 'object') return null
  if (typeof d.id !== 'string' || !d.id) return null
  if (typeof d.name !== 'string' || !d.name) return null
  if (!CATEGORIES.has(d.category)) return null
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [])
  const nz = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  const meal: BudgetMeal = {
    id: d.id,
    name: d.name,
    image: typeof d.image === 'string' ? d.image : '',
    category: d.category,
    minutes: nz(d.minutes),
    serves: nz(d.serves) || 1,
    kcal: nz(d.kcal),
    p: nz(d.p),
    c: nz(d.c),
    f: nz(d.f),
    ingredients: arr(d.ingredients),
    steps: arr(d.steps),
    tags: arr(d.tags),
  }
  if (typeof d.flavour === 'string' && d.flavour) meal.flavour = d.flavour
  if (typeof d.cookOnce === 'string' && d.cookOnce) meal.cookOnce = d.cookOnce
  if (typeof d.timeDisplay === 'string' && d.timeDisplay) meal.timeDisplay = d.timeDisplay
  if (d.vegan === true) meal.vegan = true
  return meal
}

/** Overlay cloud docs on the seed: edited/new win by id; `deprecated` removed. */
function overlay(cloudDocs: any[]): BudgetMeal[] {
  const map = new Map(BUDGET_MEALS_SEED.map((r) => [r.id, r]))
  for (const raw of cloudDocs) {
    if (!raw || typeof raw.id !== 'string') continue
    if (raw.deprecated === true) {
      map.delete(raw.id)
      continue
    }
    const m = fromDoc(raw)
    if (m) map.set(m.id, m)
  }
  return [...map.values()]
}

function setList(list: BudgetMeal[]) {
  if (list && list.length) {
    current = list
    emit()
  }
}

/**
 * Load recipes: cached cloud snapshot first (fast), then a fresh Firestore fetch.
 * Safe no-op when Firebase is unconfigured (demo mode) — the seed stays. Never
 * throws. Call once near app start.
 */
export async function initBudgetMeals(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) setList(overlay(arr))
    }
  } catch {
    /* ignore cache errors */
  }
  if (!db) return
  try {
    const snap = await getDocs(collection(db, 'recipes'))
    const docs = snap.docs.map((d) => d.data())
    if (docs.length) {
      setList(overlay(docs))
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(docs))
    }
  } catch {
    /* offline / permission / unavailable → keep seed or cache */
  }
}
