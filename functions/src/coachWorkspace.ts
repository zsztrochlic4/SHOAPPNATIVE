import { randomUUID } from 'node:crypto'
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore'
import type {
  CoachActionProposal,
  CoachMemory,
  CoachMemoryCandidate,
  CoachWorkspaceSummary,
} from './_shared/backend/coach/contracts'
import type { CoachContextSnapshot } from './_shared/backend/coach/contextSelection'
import type {
  CoachContext,
  PersistentState,
  SafetyDecision,
  SafetySession,
} from './_shared/backend/coach/safety/types'
import { CROSS_SESSION_STATES, newSafetySession } from './_shared/backend/coach/safety/types'

const COACH_SCHEMA_VERSION = 1
const MAX_MEMORIES = 60
const MAX_RECENT_TURNS = 16
const ACUTE_TTL_MS = 24 * 60 * 60 * 1000
const CROSS_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

const ordinary = (value: unknown, max = 500): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : ''

function iso(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    try { return (value as { toDate: () => Date }).toDate().toISOString() } catch { return null }
  }
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString()
  return null
}

export interface CoachTurnData {
  context: CoachContext
  /** Full flattened snapshot text — kept for back-compat / non-selective callers. */
  contextText: string
  /** Section-labelled snapshot for intent-aware selection (final plan Phase 2). */
  snapshot: CoachContextSnapshot
  recent: string[]
  safetySession: SafetySession
  memoryEnabled: boolean
  coachingStyle: CoachWorkspaceSummary['coachingStyle']
}

function compact(value: unknown, max = 1200): string {
  try { return JSON.stringify(value).slice(0, max) } catch { return '' }
}

async function recentDocs(uid: string, name: string, limitCount: number): Promise<Record<string, unknown>[]> {
  try {
    const snap = await getFirestore().collection('users').doc(uid).collection(name)
      .orderBy('dateKey', 'desc').limit(limitCount).get()
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  } catch {
    return []
  }
}

async function loadMemories(uid: string): Promise<CoachMemory[]> {
  const snap = await getFirestore().collection('coachUsers').doc(uid).collection('memories').limit(MAX_MEMORIES).get()
  return snap.docs.map((doc) => {
    const d = doc.data() as Record<string, unknown>
    return {
      id: doc.id,
      category: ordinary(d.category, 80),
      value: ordinary(d.value),
      status: (['confirmed', 'observation', 'hypothesis', 'pending'].includes(String(d.status)) ? d.status : 'pending') as CoachMemory['status'],
      confidence: typeof d.confidence === 'number' ? Math.max(0, Math.min(1, d.confidence)) : 0,
      source: (['user_statement', 'onboarding', 'app_record', 'coach_observation'].includes(String(d.source)) ? d.source : 'coach_observation') as CoachMemory['source'],
      evidenceRef: ordinary(d.evidenceRef, 200),
      scope: (['stable', 'current_program', 'current_period', 'current_week', 'current_session'].includes(String(d.scope)) ? d.scope : 'stable') as CoachMemory['scope'],
      sensitivity: (d.sensitivity === 'sensitive' ? 'sensitive' : 'ordinary') as CoachMemory['sensitivity'],
      visible: d.visible !== false,
      createdAt: iso(d.createdAt) ?? new Date().toISOString(),
      updatedAt: iso(d.updatedAt) ?? new Date().toISOString(),
      ...(iso(d.expiresAt) ? { expiresAt: iso(d.expiresAt)! } : {}),
    }
  }).filter((m) => m.visible && m.status !== 'pending' && (!m.expiresAt || Date.parse(m.expiresAt) > Date.now()))
}

function restoreSafety(data: Record<string, unknown> | undefined): SafetySession {
  const updated = iso(data?.updatedAt)
  if (!updated) return newSafetySession()
  const ageMs = Date.now() - Date.parse(updated)
  const raw = Array.isArray(data?.activeStates) ? data!.activeStates : []
  const valid = raw.filter((s): s is PersistentState => typeof s === 'string' && [
    'crisis', 'injury', 'pregnancy', 'concussion', 'medical_condition', 'under_18',
    'disordered_eating', 'overdose', 'emergency',
  ].includes(s))
  const session = newSafetySession()
  for (const state of valid) {
    const ttl = CROSS_SESSION_STATES.includes(state) ? CROSS_SESSION_TTL_MS : ACUTE_TTL_MS
    if (ageMs <= ttl) session.active.add(state)
  }
  const last = data?.lastDecision
  if (last && typeof last === 'object') session.lastDecision = last as SafetyDecision
  return session
}

export async function loadCoachTurnData(uid: string): Promise<CoachTurnData> {
  const db = getFirestore()
  const [userSnap, workspaceSnap, memoryList, turnSnap, safetySnap, sessions, habits, weights, meals, activities, foodReviews, workoutSummaries] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('coachUsers').doc(uid).get(),
    loadMemories(uid),
    db.collection('coachUsers').doc(uid).collection('turns').orderBy('createdAt', 'desc').limit(MAX_RECENT_TURNS).get(),
    db.collection('coachSafety').doc(uid).get(),
    recentDocs(uid, 'sessions', 12),
    recentDocs(uid, 'habits', 14),
    recentDocs(uid, 'weights', 12),
    recentDocs(uid, 'meals', 20),
    recentDocs(uid, 'activities', 12),
    recentDocs(uid, 'foodReviews', 14),
    recentDocs(uid, 'workoutSummaries', 12),
  ])

  if (!userSnap.exists) throw new Error('user_profile_missing')
  if (workspaceSnap.get('consentVersion') !== 1) {
    await db.collection('coachUsers').doc(uid).set({
      schemaVersion: COACH_SCHEMA_VERSION,
      consentVersion: null,
      memoryEnabled: false,
      proactiveEnabled: false,
      coachingStyle: 'balanced',
      createdAt: workspaceSnap.exists ? workspaceSnap.get('createdAt') ?? FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    throw new Error('coach_consent_required')
  }
  const user = userSnap.data() as Record<string, any>
  const backend = (user.backendUser && typeof user.backendUser === 'object') ? user.backendUser : {}
  const profile = (user.profile && typeof user.profile === 'object') ? user.profile : {}
  const screening = (backend.screening && typeof backend.screening === 'object') ? backend.screening : {}
  const injuries = Array.isArray(backend.injuries) ? backend.injuries : []
  const affectedRegions = injuries.map((i: any) => ordinary(i?.region, 40)).filter(Boolean)

  const context: CoachContext = {
    dateOfBirth: ordinary(backend.date_of_birth, 20) || null,
    affectedRegions,
    screeningOutcome: ordinary(screening.outcome ?? backend.screening_outcome, 80) || null,
    engineExcludedExerciseIds: [],
    isAustralia: true,
  }

  const completed = sessions.filter((s) => s.completed === true)
  const coachingStyleText = String(workspaceSnap.get('coachingStyle') ?? 'balanced')
  const constraints = [
    affectedRegions.length ? `affected regions: ${affectedRegions.join(', ')}` : '',
    context.screeningOutcome ? `screening: ${context.screeningOutcome}` : '',
  ].filter(Boolean).join('; ')

  // Section-labelled snapshot for intent-aware selection (final plan Phase 2). The selector decides
  // which sections a given turn actually needs; nothing here forces the whole snapshot into the prompt.
  const snapshot: CoachContextSnapshot = {
    coachingStyle: coachingStyleText,
    goal: ordinary(backend.goal || profile.goal, 60),
    experience: ordinary(backend.experience_level || profile.experience, 40),
    units: ordinary(profile.units || 'metric', 20),
    constraints,
    profile: compact({ name: profile.name, goal: profile.goal, experience: profile.experience, daysPerWeek: profile.daysPerWeek, sessionMinutes: profile.sessionMinutes, equipment: profile.equipment, dietaryPrefs: profile.dietaryPrefs, motivation: profile.motivation }),
    canonicalProfile: compact({ goal: backend.goal, experience: backend.experience_level, daysPerWeek: backend.days_per_week, sessionLength: backend.session_length_min, equipment: backend.equipment, trainsAlone: backend.trains_alone }),
    program: compact(user.generatedProgram ?? user.program, 1800),
    recentTraining: `${completed.length}/${sessions.length} recent sessions completed; latest ${compact(sessions.slice(0, 4), 1800)}`,
    trainingSummaries: compact(workoutSummaries.slice(0, 8), 1200),
    activity: compact(activities.slice(0, 8), 900),
    readiness: `habits ${habits.length}/14 days; latest ${compact(habits.slice(0, 7), 1200)}`,
    weights: compact(weights.slice(0, 8), 700),
    nutrition: `${meals.length} entries; latest ${compact(meals.slice(0, 8), 1000)}`,
    nutritionCheckins: compact(foodReviews.slice(0, 7), 900),
    memories: memoryList.map((m) => ({ category: m.category, value: m.value, sensitivity: m.sensitivity, scope: m.scope })),
  }

  // Full flattened text kept for back-compat (tests, non-selective callers).
  const contextLines = [
    'SERVER-TRUSTED USER SNAPSHOT',
    `Coach preference: ${coachingStyleText} style.`,
    `Profile: ${snapshot.profile}`,
    `Canonical training profile: ${snapshot.canonicalProfile}`,
    `Program: ${snapshot.program}`,
    `Recent training: ${snapshot.recentTraining}`,
    `Recent training summaries: ${snapshot.trainingSummaries}`,
    `Recent self-chosen activity: ${snapshot.activity}`,
    `Recent readiness coverage: ${snapshot.readiness}`,
    `Recent weight entries: ${snapshot.weights}`,
    `Recent nutrition entries: ${snapshot.nutrition}`,
    `Recent nutrition check-ins: ${snapshot.nutritionCheckins}`,
    `Confirmed coach memories: ${compact(memoryList.map((m) => ({ id: m.id, category: m.category, value: m.value, status: m.status, scope: m.scope, updatedAt: m.updatedAt })), 2500)}`,
    'Treat absent or incomplete data as unknown. Do not claim app data you cannot see.',
  ]

  const recent = turnSnap.docs.reverse().map((d) => {
    const data = d.data()
    return `${data.role === 'coach' ? 'Coach' : 'User'}: ${ordinary(data.text, 2000)}`
  })
  const workspace = workspaceSnap.data() as Record<string, unknown> | undefined
  return {
    context,
    contextText: contextLines.join('\n'),
    snapshot,
    recent,
    safetySession: restoreSafety(safetySnap.data() as Record<string, unknown> | undefined),
    memoryEnabled: workspace?.consentVersion === 1 && workspace?.memoryEnabled === true,
    coachingStyle: (['supportive', 'direct', 'balanced'].includes(String(workspace?.coachingStyle)) ? workspace!.coachingStyle : 'balanced') as CoachWorkspaceSummary['coachingStyle'],
  }
}

export async function saveSafetySession(uid: string, session: SafetySession): Promise<void> {
  const activeStates = [...new Set([...session.active, ...session.carriedOver])]
  await getFirestore().collection('coachSafety').doc(uid).set({
    schemaVersion: COACH_SCHEMA_VERSION,
    activeStates,
    lastDecision: session.lastDecision ?? null,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })
}

export async function saveCoachTurn(uid: string, role: 'user' | 'coach', text: string, extra: Record<string, unknown> = {}): Promise<string> {
  const ref = getFirestore().collection('coachUsers').doc(uid).collection('turns').doc()
  await ref.set({
    role,
    text: ordinary(text, role === 'user' ? 2000 : 4000),
    ...extra,
    createdAt: FieldValue.serverTimestamp(),
  })
  return ref.id
}

function quoteIsFromMessage(quote: string, message: string): boolean {
  const normalise = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
  return normalise(message).includes(normalise(quote))
}

export async function saveMemoryCandidate(uid: string, currentMessage: string, candidate: CoachMemoryCandidate): Promise<CoachMemory | null> {
  if (!quoteIsFromMessage(candidate.evidenceQuote, currentMessage)) return null
  const now = new Date().toISOString()
  const id = randomUUID()
  const memory: CoachMemory = {
    id,
    category: ordinary(candidate.category, 80),
    value: ordinary(candidate.value, 500),
    status: 'confirmed',
    confidence: 1,
    source: 'user_statement',
    evidenceRef: `turn_quote:${ordinary(candidate.evidenceQuote, 500)}`,
    scope: candidate.scope,
    sensitivity: candidate.sensitivity,
    visible: true,
    createdAt: now,
    updatedAt: now,
  }
  if (!memory.category || !memory.value) return null
  const memories = getFirestore().collection('coachUsers').doc(uid).collection('memories')
  const duplicate = await memories.where('value', '==', memory.value).limit(1).get()
  if (!duplicate.empty) {
    const existing = duplicate.docs[0]
    await existing.ref.update({
      category: memory.category,
      evidenceRef: memory.evidenceRef,
      scope: memory.scope,
      sensitivity: memory.sensitivity,
      status: 'confirmed',
      confidence: 1,
      visible: true,
      updatedAt: FieldValue.serverTimestamp(),
    })
    return { ...memory, id: existing.id, createdAt: iso(existing.get('createdAt')) ?? memory.createdAt }
  }
  const oldest = await memories.orderBy('createdAt', 'asc').limit(1).get()
  const count = await memories.count().get()
  if (count.data().count >= MAX_MEMORIES && !oldest.empty) await oldest.docs[0].ref.delete()
  await memories.doc(id).set({
    ...memory,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
  return memory
}

export async function saveProposal(uid: string, proposal: Omit<CoachActionProposal, 'id' | 'status' | 'createdAt' | 'expiresAt'>): Promise<CoachActionProposal> {
  const now = new Date()
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const id = randomUUID()
  const full: CoachActionProposal = {
    ...proposal, id, status: 'pending', createdAt: now.toISOString(), expiresAt: expires.toISOString(),
  }
  await getFirestore().collection('coachUsers').doc(uid).collection('proposals').doc(id).set({
    ...full,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromDate(expires),
  })
  return full
}

export async function getWorkspaceSummary(uid: string): Promise<CoachWorkspaceSummary> {
  const db = getFirestore()
  const [root, memories] = await Promise.all([
    db.collection('coachUsers').doc(uid).get(),
    loadMemories(uid),
  ])
  const data = root.data() as Record<string, unknown> | undefined
  return {
    schemaVersion: typeof data?.schemaVersion === 'number' ? data.schemaVersion : COACH_SCHEMA_VERSION,
    consentVersion: data?.consentVersion === 1 ? 1 : null,
    memoryEnabled: data?.consentVersion === 1 && data?.memoryEnabled === true,
    proactiveEnabled: data?.proactiveEnabled === true,
    coachingStyle: (['supportive', 'direct', 'balanced'].includes(String(data?.coachingStyle)) ? data!.coachingStyle : 'balanced') as CoachWorkspaceSummary['coachingStyle'],
    memories,
    updatedAt: iso(data?.updatedAt),
  }
}
