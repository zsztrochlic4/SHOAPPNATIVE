/**
 * Runtime quick-workout catalogue with a Firestore overlay ("12-Minute Bodyweight
 * Exercises" sheet).
 *
 * The bundled `QUICK_WORKOUTS_SEED` (generated from the spreadsheet) is the
 * always-available default, so the sheet shows instantly, offline, and on a fresh
 * install. On launch we then:
 *   1. hydrate the last cloud snapshot from AsyncStorage (fast, offline), then
 *   2. fetch the `workouts` collection and overlay it on the seed — edited/new
 *      workouts win by id, `deprecated` docs are removed (see overlayQuickWorkouts).
 *
 * This makes the workouts editable WITHOUT an app release: edit the spreadsheet →
 * `npm run workouts:build` (seed) + `npm run workouts:upload` (Firestore) → clients
 * pick it up next launch. Firestore is never required; if it is unavailable the
 * seed (or the cached snapshot) is used. The countdown player is protected because
 * every doc is validated + timing-clamped in the pure overlay module.
 *
 * Screens read the list through `useQuickWorkouts()` (reactive via
 * useSyncExternalStore) so a cloud refresh re-renders them.
 */
import { useSyncExternalStore } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { QuickWorkout } from '../store/types'
import { QUICK_WORKOUTS_SEED } from './quickWorkouts.generated'
import { overlayQuickWorkouts } from './quickWorkoutsOverlay'

const CACHE_KEY = 'sho.quickWorkouts.cloud.v1'

let current: QuickWorkout[] = QUICK_WORKOUTS_SEED
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

/** Current quick-workout list (seed, overlaid by any loaded cloud snapshot). */
export const getQuickWorkouts = (): QuickWorkout[] => current
/** Look one up by id across the current list. */
export const quickWorkoutById = (id: string): QuickWorkout | undefined => current.find((w) => w.id === id)

/** Reactive hook for the sheet — re-renders when the cloud overlay loads. */
export function useQuickWorkouts(): QuickWorkout[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
    () => current,
  )
}

function setList(list: QuickWorkout[]) {
  if (list && list.length) {
    current = list
    emit()
  }
}

/**
 * Load quick workouts: cached cloud snapshot first (fast), then a fresh Firestore
 * fetch. Safe no-op when Firebase is unconfigured (demo mode) — the seed stays.
 * Never throws. Call once near app start.
 */
export async function initQuickWorkouts(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) setList(overlayQuickWorkouts(QUICK_WORKOUTS_SEED, arr))
    }
  } catch {
    /* ignore cache errors */
  }
  if (!db) return
  try {
    const snap = await getDocs(collection(db, 'workouts'))
    const docs = snap.docs.map((d) => d.data())
    if (docs.length) {
      setList(overlayQuickWorkouts(QUICK_WORKOUTS_SEED, docs))
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(docs))
    }
  } catch {
    /* offline / permission / unavailable → keep seed or cache */
  }
}
