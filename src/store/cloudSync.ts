import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { AppState } from './types'

/**
 * Per-user cloud copy of the app state, in Firestore.
 *
 * Scalability: the growing, append-only parts (workout history, coach messages,
 * daily logs) each live in their OWN document under `users/{uid}/state/*`, so no
 * single document approaches Firestore's 1MB limit. That's what lets a user keep
 * years of history — and view a session from months ago — without sync silently
 * failing, and keeps the store organised for many users. Everything else lives
 * in the small core doc `users/{uid}`.
 *
 * Security is enforced by firestore.rules (owner-only on users/{uid}/**).
 */

/** Growing slices, each written to its own doc so it has its own 1MB budget. */
const SLICES = {
  sessions: ['sessions'] as const,
  chat: ['chat', 'coachThread'] as const,
  logs: ['weights', 'habits', 'meals', 'activities', 'foodReviews'] as const,
}
type SliceName = keyof typeof SLICES

// Photos are base64 (kept on-device); slice fields live in their own docs.
// Everything else is the small "core".
const NON_CORE = new Set<string>([...SLICES.sessions, ...SLICES.chat, ...SLICES.logs, 'photos'])

function pick(state: AppState, keys: readonly string[]) {
  const s = state as unknown as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const k of keys) if (s[k] !== undefined) out[k] = s[k]
  return out
}
function core(state: AppState) {
  const s = state as unknown as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(s)) if (!NON_CORE.has(k)) out[k] = s[k]
  return out
}

const coreRef = (uid: string) => doc(db!, 'users', uid)
const sliceRef = (uid: string, name: SliceName) => doc(db!, 'users', uid, 'state', name)

/** Read the signed-in user's saved state, or null if brand-new (no core doc). */
export async function loadUserState(uid: string): Promise<Partial<AppState> | null> {
  if (!db) return null
  const coreSnap = await getDoc(coreRef(uid))
  if (!coreSnap.exists()) return null // brand-new account -> onboarding
  const [sessions, chat, logs] = await Promise.all([
    getDoc(sliceRef(uid, 'sessions')),
    getDoc(sliceRef(uid, 'chat')),
    getDoc(sliceRef(uid, 'logs')),
  ])
  const data: Record<string, unknown> = { ...coreSnap.data() }
  delete data.updatedAt
  Object.assign(data, sessions.data() ?? {}, chat.data() ?? {}, logs.data() ?? {})
  return data as Partial<AppState>
}

// Skip re-writing a slice whose content hasn't changed, to save writes.
const lastWritten: Record<string, string> = {}
async function writeIfChanged(uid: string, name: SliceName | 'core', data: Record<string, unknown>) {
  const json = JSON.stringify(data)
  const key = `${uid}:${name}`
  if (lastWritten[key] === json) return
  const ref = name === 'core' ? coreRef(uid) : sliceRef(uid, name)
  await setDoc(ref, name === 'core' ? { ...data, updatedAt: serverTimestamp() } : data)
  lastWritten[key] = json
}

/** Write the signed-in user's state, split across the core + slice docs. */
export async function saveUserState(uid: string, state: AppState): Promise<void> {
  if (!db) return
  await Promise.all([
    writeIfChanged(uid, 'core', core(state)),
    writeIfChanged(uid, 'sessions', pick(state, SLICES.sessions)),
    writeIfChanged(uid, 'chat', pick(state, SLICES.chat)),
    writeIfChanged(uid, 'logs', pick(state, SLICES.logs)),
  ])
}
