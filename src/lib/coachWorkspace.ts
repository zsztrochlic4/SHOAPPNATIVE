import { httpsCallable } from 'firebase/functions'
import { firebaseEnabled, functions } from './firebase'
import type { CoachWorkspaceSummary } from '../backend/coach/contracts'
import AsyncStorage from '@react-native-async-storage/async-storage'

const CACHE_KEY = 'sho.coach.workspace.v1'

function callable<I, O>(name: string) {
  if (!firebaseEnabled || !functions) throw new Error('Coach backend is not configured')
  return httpsCallable<I, O>(functions, name, { timeout: 30_000 })
}

export async function fetchCoachWorkspace(): Promise<CoachWorkspaceSummary> {
  const result = await callable<Record<string, never>, CoachWorkspaceSummary>('getCoachWorkspace')({})
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(result.data)).catch(() => {})
  return result.data
}

export async function readCachedCoachWorkspace(): Promise<CoachWorkspaceSummary | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) as CoachWorkspaceSummary : null
  } catch {
    return null
  }
}

async function cache(summary: CoachWorkspaceSummary): Promise<CoachWorkspaceSummary> {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(summary)).catch(() => {})
  return summary
}

export async function grantCoachConsent(memoryEnabled: boolean): Promise<CoachWorkspaceSummary> {
  const result = await callable<{ memoryEnabled: boolean }, CoachWorkspaceSummary>('grantCoachConsent')({ memoryEnabled })
  return cache(result.data)
}

export async function revokeCoachConsent(): Promise<CoachWorkspaceSummary> {
  const result = await callable<Record<string, never>, CoachWorkspaceSummary>('revokeCoachConsent')({})
  return cache(result.data)
}

export async function updateCoachPreferences(input: {
  memoryEnabled?: boolean
  proactiveEnabled?: boolean
  coachingStyle?: CoachWorkspaceSummary['coachingStyle']
}): Promise<CoachWorkspaceSummary> {
  const result = await callable<typeof input, CoachWorkspaceSummary>('updateCoachPreferences')(input)
  return cache(result.data)
}

export async function deleteCoachMemory(id: string): Promise<void> {
  await callable<{ id: string }, { ok: true }>('deleteCoachMemory')({ id })
}

export async function clearCoachMemories(): Promise<void> {
  await callable<Record<string, never>, { ok: true }>('clearCoachMemories')({})
}

export async function respondToCoachProposal(id: string, decision: 'confirm' | 'reject') {
  const result = await callable<
    { id: string; decision: 'confirm' | 'reject' },
    { id: string; kind: string; payload: Record<string, string | number | boolean>; status: string }
  >('respondToCoachProposal')({ id, decision })
  return result.data
}
