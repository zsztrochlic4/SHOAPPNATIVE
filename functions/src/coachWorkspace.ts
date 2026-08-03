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

/* ------------------------------------------------------------------ */
/*  Enriched context signals (Coach Capability Plan)                   */
/*  All derived from already-loaded docs — no extra Firestore reads.   */
/* ------------------------------------------------------------------ */

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** The app's market is Australia; used as the timezone fallback when none is stored (C-008). */
const DEFAULT_TIMEZONE = 'Australia/Sydney'

/**
 * The user's LOCAL weekday name (C-008). UTC would name the wrong day in Australia for the
 * evening hours (e.g. 20:00 UTC Monday is already Tuesday in Sydney). Uses the stored IANA
 * timezone when available, falling back to the app's Australian market timezone.
 */
function localWeekdayName(tz: string, now: Date = new Date()): string {
  try {
    const name = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: tz }).format(now)
    if (WEEKDAY_NAMES.includes(name)) return name
  } catch { /* invalid tz → fall through to the market default */ }
  try {
    return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: DEFAULT_TIMEZONE }).format(now)
  } catch {
    return WEEKDAY_NAMES[now.getUTCDay()]
  }
}

/** "Today (Wednesday) is a Push day: Bench Press, …" from the stored program's schedule. */
function programDayText(program: any, today: string): string {
  const days = program && Array.isArray(program.days) ? program.days : null
  if (!days) return ''
  const day = days.find((d: any) => d?.weekday === today)
  if (!day) return `Today (${today}) is a rest day in the current program.`
  const lifts = Array.isArray(day.exercises)
    ? day.exercises.map((e: any) => e?.name).filter(Boolean).slice(0, 6).join(', ')
    : ''
  return `Today (${today}) is a ${day.dayType ?? 'training'} day${lifts ? `: ${lifts}` : ''}.`
}

/** A one-line note on the most recent session and whether it was completed. */
function lastSessionText(sessions: Record<string, unknown>[]): string {
  const last = sessions[0] as any
  if (!last) return 'No sessions logged yet.'
  const vol = typeof last.volumeKg === 'number' ? `, ${Math.round(last.volumeKg)}kg volume` : ''
  return `Last session ${last.dateKey ?? '?'}: ${last.completed ? 'completed' : 'not completed'}${vol}.`
}

/** New per-lift est-1RM bests in the latest workout summary vs all earlier ones. */
function recentPRsText(summaries: Record<string, unknown>[]): string {
  if (summaries.length < 2) return ''
  const [latest, ...earlier] = summaries as any[]
  const latestLifts = latest?.lifts && typeof latest.lifts === 'object' ? latest.lifts : {}
  const prs: string[] = []
  for (const [defId, est] of Object.entries(latestLifts)) {
    if (typeof est !== 'number') continue
    let prevBest = 0
    for (const s of earlier) { const v = s?.lifts?.[defId]; if (typeof v === 'number' && v > prevBest) prevBest = v }
    if (prevBest > 0 && est > prevBest + 0.5) prs.push(`${defId} est-1RM ${Math.round(est)}kg (was ${Math.round(prevBest)}kg)`)
  }
  return prs.length ? `New bests in the latest session (${latest?.dateKey ?? '?'}): ${prs.slice(0, 4).join('; ')}.` : ''
}

/** Lifts whose est-1RM has not improved over the last ~3 summaries and sits below their peak. */
function plateausText(summaries: Record<string, unknown>[]): string {
  if (summaries.length < 3) return ''
  const chron = [...summaries].reverse() as any[] // oldest → newest
  const series: Record<string, number[]> = {}
  for (const s of chron) {
    const lifts = s?.lifts
    if (lifts && typeof lifts === 'object') {
      for (const [id, v] of Object.entries(lifts)) if (typeof v === 'number') (series[id] ||= []).push(v)
    }
  }
  const flags: string[] = []
  for (const [id, vals] of Object.entries(series)) {
    if (vals.length < 3) continue
    const recent = vals[vals.length - 1]
    const threeAgo = vals[vals.length - 3]
    const peak = Math.max(...vals)
    if (recent <= threeAgo + 0.5 && recent < peak - 0.5) flags.push(id)
  }
  return flags.length ? `Lifts that have stalled (flat/declining est-1RM over recent sessions): ${flags.slice(0, 5).join(', ')}.` : ''
}

/** 7-day averages for sleep and water from the habit log. */
function recovery7dText(habits: Record<string, unknown>[]): string {
  const week = habits.slice(0, 7) as any[]
  const sleeps = week.map((h) => h?.sleepH).filter((v) => typeof v === 'number' && v > 0) as number[]
  const waters = week.map((h) => h?.waterL).filter((v) => typeof v === 'number' && v > 0) as number[]
  if (!sleeps.length && !waters.length) return ''
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length
  const parts: string[] = []
  if (sleeps.length) parts.push(`sleep avg ${avg(sleeps).toFixed(1)}h over ${sleeps.length} logged night${sleeps.length > 1 ? 's' : ''}`)
  if (waters.length) parts.push(`water avg ${avg(waters).toFixed(1)}L over ${waters.length} logged day${waters.length > 1 ? 's' : ''}`)
  return parts.join('; ') + '.'
}

async function recentDocs(uid: string, name: string, limitCount: number, onFail?: () => void): Promise<Record<string, unknown>[]> {
  try {
    const snap = await getFirestore().collection('users').doc(uid).collection(name)
      .orderBy('dateKey', 'desc').limit(limitCount).get()
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  } catch {
    // C-015: a FAILED read is recorded so the coach can disclose the gap rather than treat it
    // as "no data". Still returns [] so downstream shaping is unaffected.
    onFail?.()
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
  // C-015: record which context reads FAILED (vs were genuinely empty) so we can disclose gaps.
  const gaps: string[] = []
  const track = (label: string) => () => gaps.push(label)
  const [userSnap, workspaceSnap, memoryList, turnSnap, safetySnap, sessions, habits, weights, meals, activities, foodReviews, workoutSummaries] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('coachUsers').doc(uid).get(),
    loadMemories(uid),
    db.collection('coachUsers').doc(uid).collection('turns').orderBy('createdAt', 'desc').limit(MAX_RECENT_TURNS).get(),
    db.collection('coachSafety').doc(uid).get(),
    recentDocs(uid, 'sessions', 12, track('recent sessions')),
    recentDocs(uid, 'habits', 14, track('sleep/hydration habits')),
    recentDocs(uid, 'weights', 12, track('weight history')),
    recentDocs(uid, 'meals', 20, track('nutrition log')),
    recentDocs(uid, 'activities', 12, track('activity log')),
    recentDocs(uid, 'foodReviews', 14, track('nutrition check-ins')),
    recentDocs(uid, 'workoutSummaries', 12, track('training summaries')),
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
  const settings = (user.settings && typeof user.settings === 'object') ? user.settings : {}
  const screening = (backend.screening && typeof backend.screening === 'object') ? backend.screening : {}
  // C-001 (P0): read the CANONICAL fields the onboarding contract actually writes —
  // `affected_regions` and `excluded_exercise_ids` — not the non-existent `backend.injuries`
  // (which was always empty) nor a hardcoded empty exclusion list.
  const affectedRegions: string[] = Array.isArray(backend.affected_regions)
    ? backend.affected_regions.map((r: any) => ordinary(r, 40)).filter(Boolean)
    : []
  const excludedExerciseIds: string[] = Array.isArray(backend.excluded_exercise_ids)
    ? backend.excluded_exercise_ids.map((id: any) => ordinary(id, 40)).filter(Boolean)
    : []
  // C-007: the unit preference lives in the app's settings (settings.units), NOT profile.units.
  const units = ordinary(settings.units || profile.units || 'metric', 20)
  // C-008: name the day in the user's local timezone (stored IANA tz, else the AU market default).
  const timezone = ordinary(settings.timezone || backend.timezone, 60) || DEFAULT_TIMEZONE
  const todayName = localWeekdayName(timezone)

  const context: CoachContext = {
    dateOfBirth: ordinary(backend.date_of_birth, 20) || null,
    affectedRegions,
    screeningOutcome: ordinary(screening.outcome ?? backend.screening_outcome, 80) || null,
    engineExcludedExerciseIds: excludedExerciseIds,
    isAustralia: true,
  }

  const completed = sessions.filter((s) => s.completed === true)
  const coachingStyleText = String(workspaceSnap.get('coachingStyle') ?? 'balanced')
  const constraints = [
    affectedRegions.length ? `affected regions: ${affectedRegions.join(', ')}` : '',
    excludedExerciseIds.length ? `excluded exercises: ${excludedExerciseIds.slice(0, 12).join(', ')}` : '',
    context.screeningOutcome ? `screening: ${context.screeningOutcome}` : '',
  ].filter(Boolean).join('; ')

  // Section-labelled snapshot for intent-aware selection (final plan Phase 2). The selector decides
  // which sections a given turn actually needs; nothing here forces the whole snapshot into the prompt.
  const snapshot: CoachContextSnapshot = {
    coachingStyle: coachingStyleText,
    goal: ordinary(backend.goal || profile.goal, 60),
    experience: ordinary(backend.experience_level || profile.experience, 40),
    units,
    constraints,
    profile: compact({ name: profile.name, goal: profile.goal, experience: profile.experience, daysPerWeek: profile.daysPerWeek, sessionMinutes: profile.sessionMinutes, equipment: profile.equipment, dietaryPrefs: profile.dietaryPrefs, motivation: profile.motivation }),
    canonicalProfile: compact({ goal: backend.goal, experience: backend.experience_level, daysPerWeek: backend.days_per_week, sessionLength: backend.session_length_min, equipment: backend.equipment, trainsAlone: backend.trains_alone }),
    program: compact(user.generatedProgram ?? user.program, 1800),
    recentTraining: `${completed.length}/${sessions.length} recent sessions completed. ${lastSessionText(sessions)} Latest ${compact(sessions.slice(0, 4), 1500)}`,
    trainingSummaries: compact(workoutSummaries.slice(0, 8), 1200),
    activity: compact(activities.slice(0, 8), 900),
    readiness: `habits ${habits.length}/14 days; latest ${compact(habits.slice(0, 7), 1200)}`,
    weights: compact(weights.slice(0, 8), 700),
    nutrition: `${meals.length} entries; latest ${compact(meals.slice(0, 8), 1000)}`,
    nutritionCheckins: compact(foodReviews.slice(0, 7), 900),
    memories: memoryList.map((m) => ({ category: m.category, value: m.value, sensitivity: m.sensitivity, scope: m.scope })),
    // Coach Capability Plan — enriched signals (all from the docs already loaded above).
    programDay: programDayText(user.generatedProgram ?? user.program, todayName),
    recentPRs: recentPRsText(workoutSummaries),
    plateaus: plateausText(workoutSummaries),
    recovery7d: recovery7dText(habits),
    // C-015: disclose reads that failed this turn (empty string when everything loaded).
    contextGaps: gaps.length ? gaps.join(', ') : undefined,
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
