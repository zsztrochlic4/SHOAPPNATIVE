/**
 * Editable exercise INFO overlay (exercise detail screen).
 *
 * The bundled exercise database (src/backend/data/exercises.ts) is the source of
 * truth for the workout ENGINE and the offline default. On top of it we overlay
 * an optional Firestore `exercises` collection that holds only the editable
 * DISPLAY fields — name, muscle, what-it-does, how-to steps, common mistake,
 * safety note. This lets those be edited from the workbook + `exercises:upload`
 * and show in the app WITHOUT a release, while the engine is never affected.
 *
 * Mirrors src/data/recipes.ts: bundled base, cached cloud snapshot, then a live
 * Firestore fetch. Firestore is never required; offline/demo keeps the bundle.
 */
import { useSyncExternalStore } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { EXERCISES } from '../backend/data/exercises'

export interface ExerciseInfo {
  id: string
  name: string
  muscleGroup: string
  whatItDoes: string
  whyInDatabase: string
  steps: string[]
  commonMistake: string
  safetyNote: string
  skillLevel: string
}

const CACHE_KEY = 'sho.exerciseInfo.cloud.v1'

// Bundled base (from the built-in exercise DB).
const BASE: Record<string, ExerciseInfo> = {}
for (const e of EXERCISES) {
  BASE[e.id] = {
    id: e.id,
    name: e.name,
    muscleGroup: e.muscleGroup,
    whatItDoes: e.whatItDoes,
    whyInDatabase: e.whyInDatabase,
    steps: e.steps,
    commonMistake: e.commonMistake,
    safetyNote: e.safetyNote,
    skillLevel: e.skillLevel,
  }
}

let overlay: Record<string, Partial<ExerciseInfo>> = {}
let version = 0
const listeners = new Set<() => void>()
const emit = () => { version++; listeners.forEach((l) => l()) }

/** Merged info for an exercise id (bundled base + any cloud override). */
export function getExerciseInfo(id: string): ExerciseInfo | undefined {
  const base = BASE[id]
  if (!base) return undefined
  const o = overlay[id]
  return o ? { ...base, ...o } : base
}

/** Subscribe so a screen re-renders when the cloud overlay loads. Returns a version tick. */
export function useExerciseInfo(): number {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb) },
    () => version,
    () => version,
  )
}

/** Only keep known string/array fields from a raw cloud doc (defensive). */
function sanitizeDoc(d: any): Partial<ExerciseInfo> | null {
  if (!d || typeof d.id !== 'string' || !d.id) return null
  const out: Partial<ExerciseInfo> = {}
  for (const k of ['name', 'muscleGroup', 'whatItDoes', 'whyInDatabase', 'commonMistake', 'safetyNote', 'skillLevel'] as const) {
    if (typeof d[k] === 'string' && d[k]) out[k] = d[k]
  }
  if (Array.isArray(d.steps)) out.steps = d.steps.filter((s: unknown) => typeof s === 'string')
  return out
}

function applyDocs(docs: any[]) {
  const next: Record<string, Partial<ExerciseInfo>> = {}
  for (const raw of docs) {
    const clean = sanitizeDoc(raw)
    if (clean && typeof raw.id === 'string') next[raw.id] = clean
  }
  if (Object.keys(next).length) { overlay = next; emit() }
}

/**
 * Load the info overlay: cached snapshot first, then a live Firestore fetch.
 * Safe no-op offline / in demo mode. Never throws. Call once near app start.
 */
export async function initExerciseInfo(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY)
    if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr)) applyDocs(arr) }
  } catch {
    /* ignore cache errors */
  }
  if (!db) return
  try {
    const snap = await getDocs(collection(db, 'exercises'))
    const docs = snap.docs.map((d) => d.data())
    if (docs.length) {
      applyDocs(docs)
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(docs))
    }
  } catch {
    /* offline / permission / unavailable → keep base or cache */
  }
}
