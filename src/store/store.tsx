import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { AppState as RNAppState } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { todayKey, setLiveClock, refreshClock, deviceTimezone } from '../lib/date'
import {
  ANON_IDENTITY,
  LEGACY_STORAGE_KEY,
  getActiveIdentity,
  shouldCarryLocalState,
  storageKeyFor,
  subscribeIdentity,
  type Identity,
} from './identity'
import { buildSeed, emptyState } from './seed'
import { canDispatchDemoReset } from './resetGuards'
import { boundStateForLocalPersist } from './localPersistBound'
import { migrateAppState } from './migrate'
import { coachReply } from '../lib/coachChat'
import { coachContext, coachOperational, coachPrecheck, guardOutgoing, sharedCoachSession } from '../lib/coachSafety'
import type { ContactButton } from '../backend/coach/safety'
import type { CoachActionProposal, CoachAnswerMode, CoachCitation, CoachMemory } from '../backend/coach/contracts'
import type {
  AppNotification,
  AppState,
  ChatMessage,
  CommunityGroup,
  CommunityScope,
  IntegrationState,
  LoggedActivity,
  LoggedExercise,
  LoggedMeal,
  PlannedMeal,
  PlannedPeriod,
  Post,
  PostComment,
  Profile,
  ProgramSnapshot,
  Settings,
  Subscription,
  UserMeal,
  WorkoutSession,
  WorkoutTemplate,
} from './types'
import type { UserDoc, WorkoutInstanceDoc, ProgramDoc } from '../backend/schema'
import type { StoredProgram, ProgramStatus } from '../backend/runtime/activate'
import { sessionFromInstance, fullWeekday } from './programSession'
import { sessionForDay } from './selectors'
import { plannedPeriods, toPlannedAbsence } from './periods'
import { mergeById, type HistoryEntry } from './historyMerge'
import { summarizeSession, buildAllSummaries } from './workoutSummary'

/** The append-heavy slices that load lazily under the bounded-read model. */
export type WindowedHistory = Partial<
  Pick<AppState, 'sessions' | 'meals' | 'activities' | 'chat' | 'coachThread' | 'notifications'>
>

// Local persistence is scoped per account (audit F-001): each identity —
// 'anon' (signed out / demo / mid-onboarding) or a Firebase uid — owns its own
// AsyncStorage key. See ./identity.ts for the key scheme and the one legitimate
// anon→account hand-off (fresh onboarding answers following the new account).

/* ------------------------------ Actions ------------------------------ */
export type Action =
  | { type: 'HYDRATE'; state: AppState }
  | { type: 'MERGE_HISTORY'; history: WindowedHistory }
  | { type: 'BUILD_WORKOUT_SUMMARIES' }
  | { type: 'SET_SETTINGS'; patch: Partial<Settings> }
  | { type: 'SET_PROFILE'; patch: Partial<Profile> }
  | { type: 'SET_SUBSCRIPTION'; subscription: Subscription }
  | { type: 'COMPLETE_ONBOARDING'; profile: Partial<Profile>; backendUser?: UserDoc; generatedProgram?: StoredProgram | null; programStatus?: ProgramStatus | null; workoutInstances?: WorkoutInstanceDoc[]; programDoc?: ProgramDoc | null }
  | { type: 'APPLY_TRAINING_PROFILE'; profilePatch: Partial<Profile>; backendUser: UserDoc; generatedProgram?: StoredProgram | null; programStatus?: ProgramStatus | null; workoutInstances?: WorkoutInstanceDoc[]; programDoc?: ProgramDoc | null }
  // Coach Capability Plan: a confirmed single-exercise swap (coachActionResolver 'patch').
  | { type: 'APPLY_COACH_SWAP'; backendUser: UserDoc; generatedProgram: StoredProgram; workoutInstances: WorkoutInstanceDoc[] }
  // Coach Capability Plan: undo — restore the pre-action program snapshot.
  | { type: 'RESTORE_PROGRAM_SNAPSHOT'; snapshot: ProgramSnapshot }
  // Coach Capability Plan (R5-006): sync the local programDoc.version to the value the cloud
  // transaction authoritatively stamped, so the next apply/undo guards against the right revision.
  | { type: 'SET_PROGRAM_VERSION'; version: number }
  | { type: 'START_PROGRAM_DAY'; dateKey: string }
  | { type: 'LOG_WEIGHT'; kg: number }
  | { type: 'ADJUST_WATER'; deltaL: number }
  | { type: 'PATCH_TODAY_HABIT'; patch: Partial<{ steps: number; sleepH: number; mindsetMin: number; waterL: number }> }
  | { type: 'PATCH_HABIT'; dateKey: string; patch: Partial<{ steps: number; sleepH: number; mindsetMin: number; waterL: number }> }
  | { type: 'SET_WORKOUT_DONE'; dateKey: string; done: boolean }
  | { type: 'ADD_MEAL'; meal: Omit<LoggedMeal, 'id' | 'dateKey'> }
  | { type: 'REMOVE_MEAL'; id: string }
  | { type: 'ADD_ACTIVITY'; activity: Omit<LoggedActivity, 'id' | 'dateKey' | 'time'> }
  | { type: 'REMOVE_ACTIVITY'; id: string }
  | { type: 'TOGGLE_ACTIVITY_WEEKLY'; id: string }
  | { type: 'ADD_PLANNED_MEAL'; plan: Omit<PlannedMeal, 'id'> }
  | { type: 'REMOVE_PLANNED_MEAL'; id: string }
  | { type: 'ADD_COMMENT'; postId: string; text: string }
  | { type: 'SAVE_FOOD_REVIEW'; text: string; score: number }
  | { type: 'TOGGLE_NUTRITION_TAG'; tag: string; dateKey?: string }
  | { type: 'MARK_WORKOUT_STARTED' }
  | { type: 'MARK_NUTRITION_ASKED' }
  | { type: 'ADD_MY_MEAL'; meal: Omit<UserMeal, 'id' | 'createdAtKey'> }
  | { type: 'REMOVE_MY_MEAL'; id: string }
  | { type: 'SAVE_TEMPLATE'; template: WorkoutTemplate }
  | { type: 'REMOVE_TEMPLATE'; id: string }
  | { type: 'SEND_CHAT'; text: string }
  | { type: 'PUSH_CHAT'; role: 'user' | 'coach'; text: string; buttons?: ContactButton[]; replyTo?: { role: 'user' | 'coach'; text: string }; mode?: CoachAnswerMode | 'safety'; citations?: CoachCitation[]; learnedMemory?: CoachMemory; proposal?: CoachActionProposal }
  | { type: 'BUMP_COACH_USAGE' }
  | { type: 'SET_INTEGRATION'; id: string; patch: Partial<IntegrationState> }
  | {
      type: 'APPLY_SYNC'
      provider: string
      at: string
      activities: (Omit<LoggedActivity, 'id'> & { externalId: string })[]
      stepsByDay: Record<string, number>
      sleepByDay: Record<string, number>
    }
  | { type: 'MARK_CHAT_READ' }
  | { type: 'SAVE_SESSION'; session: WorkoutSession }
  | { type: 'UPDATE_SESSION'; session: WorkoutSession }
  | { type: 'REMOVE_SESSION'; id: string }
  | { type: 'TOGGLE_EXERCISE_DONE'; defId: string }
  | { type: 'COMPLETE_WORKOUT'; id: string }
  | { type: 'TOGGLE_LIKE'; postId: string }
  | { type: 'TOGGLE_BOOKMARK'; postId: string }
  | { type: 'ADD_POST'; text: string; image?: string; pr?: { lift: string; weight: string }; scope?: CommunityScope }
  | { type: 'JOIN_CHALLENGE'; id: string }
  | { type: 'RSVP_EVENT'; id: string }
  | { type: 'JOIN_GROUP'; id: string }
  // Community competition hub (v13). The service layer (src/community) builds the
  // fully-formed CommunityGroup — passcode + simulated members — so these reducer
  // cases only guard invariants (dup name/membership, owner-only delete) and commit.
  | { type: 'SET_USERNAME'; username: string }
  | { type: 'CREATE_GROUP'; group: CommunityGroup }
  | { type: 'JOIN_GROUP_BY_CODE'; group: CommunityGroup }
  | { type: 'LEAVE_GROUP'; id: string }
  | { type: 'DELETE_GROUP'; id: string }
  | { type: 'SET_GROUP_GOAL'; id: string; goal: number }
  | { type: 'TRANSFER_GROUP_OWNER'; id: string; newOwnerUsername: string }
  // Cheers (reaction-only), forgiving streaks, and weekly leagues.
  | { type: 'CHEER_ACTIVITY'; groupId: string; activityId: string }
  | { type: 'USE_STREAK_FREEZE'; dateKey: string }
  | { type: 'TOGGLE_REST_DAY'; dateKey: string }
  | { type: 'GRANT_WEEKLY_FREEZE'; weekKey: string }
  | { type: 'SET_LEAGUE'; tier: number; weekKey: string; seasonWins?: number }
  // Moderation: block/unblock a user (hidden from boards + feeds locally).
  | { type: 'BLOCK_USER'; uid: string }
  | { type: 'UNBLOCK_USER'; uid: string }
  // Replace the local group cache with the server's copy (backend hydration).
  | { type: 'SET_COMMUNITY_GROUPS'; groups: CommunityGroup[] }
  | { type: 'MARK_NOTIF_READ'; id: string }
  | { type: 'MARK_ALL_READ' }
  | { type: 'ADD_NOTIFICATION'; notif: Omit<AppNotification, 'id' | 'dateKey' | 'time' | 'read'> }
  | { type: 'SAVE_PERIOD'; period: PlannedPeriod }
  | { type: 'CANCEL_PERIOD'; id: string }
  | { type: 'COMPLETE_LESSON'; id: string }
  | { type: 'GIVE_KUDOS'; postId: string }
  | { type: 'CONNECT_PARTNER'; id: string }
  | { type: 'CLEAR_COACH_CHAT' }
  | { type: 'RESET_DEMO' }
  | { type: 'RESET_EMPTY' }

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/**
 * Keep the workout-summary projection (Phase C Option B) in step with a
 * session: upsert its compact summary when completed, and REMOVE any stale
 * summary when it is not (audit F-022 — retroactive un-completion or edits must
 * never leave the all-time Progress charts contradicting the session history).
 */
function withSummary(state: AppState, session: WorkoutSession): AppState {
  const rest = (state.workoutSummaries ?? []).filter((w) => w.id !== session.id)
  if (!session.completed) {
    return rest.length === (state.workoutSummaries ?? []).length ? state : { ...state, workoutSummaries: rest }
  }
  return { ...state, workoutSummaries: [...rest, summarizeSession(session)] }
}

function recalc(s: WorkoutSession): WorkoutSession {
  const volumeKg = Math.round(
    s.exercises.reduce((a, ex) => a + ex.sets.reduce((b, set) => b + (set.done ? set.weightKg * set.reps : 0), 0), 0),
  )
  return { ...s, volumeKg }
}

/**
 * Commit a new set of busy periods, keeping the canonical backend document in
 * step: `planned_absences` is what the generator's Exam Survival Protocol reads
 * (backend/generator/exam.ts), so it must never drift from what the user sees.
 * The legacy `examDates` window is retired at the same time — from here on the
 * periods array is the only source of truth.
 */
function withPeriods(state: AppState, periods: PlannedPeriod[]): AppState {
  const sorted = [...periods].sort((a, b) => a.start.localeCompare(b.start))
  const active = sorted.find((p) => p.start <= todayKey && p.end >= todayKey)
  return {
    ...state,
    plannedPeriods: sorted,
    profile: {
      ...state.profile,
      examMode: sorted.length > 0,
      examStartKey: active?.start,
      examEndKey: active?.end,
      examDates: undefined,
    },
    backendUser: state.backendUser
      ? { ...state.backendUser, planned_absences: sorted.map(toPlannedAbsence) }
      : state.backendUser,
  }
}

/* ------------------------------ Reducer ------------------------------ */
function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'HYDRATE':
      return action.state

    // Lazily-fetched older history merged into the windowed slices (Phase C).
    // The current (recent) copy wins on any id collision so a just-made edit is
    // never clobbered by the fetch; the merge is additive and loss-free.
    case 'MERGE_HISTORY': {
      const h = action.history
      const merge = <T extends HistoryEntry>(cur: T[] | undefined, older: T[] | undefined): T[] =>
        older ? mergeById(cur ?? [], older) : cur ?? []
      return {
        ...state,
        sessions: merge(state.sessions, h.sessions),
        meals: merge(state.meals, h.meals),
        activities: merge(state.activities, h.activities),
        chat: merge(state.chat, h.chat),
        coachThread: merge(state.coachThread, h.coachThread),
        notifications: merge(state.notifications, h.notifications),
      }
    }

    // The one-time backfill: once the full session history is loaded (after
    // MERGE_HISTORY), rebuild every summary and mark the projection complete.
    // From here charts read summaries and full sessions never load again.
    case 'BUILD_WORKOUT_SUMMARIES':
      return { ...state, workoutSummaries: buildAllSummaries(state.sessions), workoutSummaryComplete: true }

    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.patch } }

    case 'SET_PROFILE':
      return { ...state, profile: { ...state.profile, ...action.patch } }

    case 'SET_SUBSCRIPTION':
      // Server-sourced (BillingSync ← entitlements/{uid}); local-only, never
      // persisted to the cloud root (see cloudRepo LOCAL_ONLY).
      return { ...state, subscription: action.subscription }

    case 'COMPLETE_ONBOARDING': {
      // Start from a CLEAN account base, NOT the demo seed the app boots into for
      // the signed-out preview. Spreading `...state` here previously carried the
      // fabricated seed slices — the "Hi Alex" coach thread, fake weight/habit/meal/
      // session history, demo community posts — into a real onboarded account.
      // emptyState() keeps reference data (foods/exercise catalog) but clears all
      // personal history; we apply the onboarding-derived fields explicitly and keep
      // this session's app settings (e.g. language / captured timezone).
      const base = emptyState()
      return {
        ...base,
        settings: state.settings,
        demo: false,
        profile: {
          ...base.profile,
          // deriveLocalProfile doesn't set these demo showcase fields, so clear them
          // explicitly — otherwise the seed's "State University / West Hall" leak in.
          university: '', cohort: '', dorm: '', society: '',
          ...action.profile,
          onboarded: true,
        },
        backendUser: action.backendUser ?? base.backendUser,
        generatedProgram: action.generatedProgram ?? null,
        programStatus: action.programStatus ?? null,
        programDoc: action.programDoc ?? null,
        workoutInstances: action.workoutInstances ?? undefined,
      }
    }

    // Post-onboarding edit of the core training inputs (audit settings matrix:
    // goal / experience / availability / session length / equipment). The new
    // program replaces the plan going FORWARD only — completed sessions, set
    // logs and history are never touched, and the deterministic gate +
    // generator ran (with preview) BEFORE this commits.
    case 'APPLY_TRAINING_PROFILE':
      return {
        ...state,
        profile: { ...state.profile, ...action.profilePatch },
        backendUser: action.backendUser,
        generatedProgram: action.generatedProgram ?? null,
        programStatus: action.programStatus ?? null,
        programDoc: action.programDoc ?? null,
        workoutInstances: action.workoutInstances ?? undefined,
      }

    // Coach Capability Plan: apply a confirmed single-exercise swap. Only the forward
    // plan projection + instance templates + (for dislike/pain) the excluded set change;
    // programDoc/status are untouched (the split & schedule are unchanged), and completed
    // sessions / logs are never modified. Undo restores via RESTORE_PROGRAM_SNAPSHOT.
    case 'APPLY_COACH_SWAP':
      return {
        ...state,
        backendUser: action.backendUser,
        generatedProgram: action.generatedProgram,
        workoutInstances: action.workoutInstances,
      }

    // Coach Capability Plan: undo a coach-actioned change by restoring the snapshot taken
    // before it was applied. Planned periods route through withPeriods so examMode /
    // planned_absences stay coherent with the restored backendUser.
    case 'RESTORE_PROGRAM_SNAPSHOT': {
      const restored: AppState = {
        ...state,
        backendUser: action.snapshot.backendUser,
        generatedProgram: action.snapshot.generatedProgram ?? null,
        programStatus: action.snapshot.programStatus ?? null,
        programDoc: action.snapshot.programDoc ?? null,
        workoutInstances: action.snapshot.workoutInstances ?? undefined,
      }
      return action.snapshot.plannedPeriods
        ? withPeriods(restored, action.snapshot.plannedPeriods)
        : restored
    }

    // R5-006: mirror the cloud-authoritative program revision locally. No-op if there is no
    // program doc (the version lives on the canonical program record).
    case 'SET_PROGRAM_VERSION':
      return state.programDoc
        ? { ...state, programDoc: { ...state.programDoc, version: action.version } }
        : state

    case 'START_PROGRAM_DAY': {
      // Materialise a loggable session for the given day from the generated program's
      // instance whose weekday matches. No-op if a session already exists for that day,
      // if there's no program, or if the day is a rest day (no matching instance).
      if (sessionForDay(state, action.dateKey)) return state
      const instances = state.workoutInstances ?? []
      if (instances.length === 0) return state
      const wd = fullWeekday(action.dateKey)
      const instance = instances.find((i) => i.instance_id.endsWith(`_${wd}`))
      if (!instance) return state
      const session = sessionFromInstance(instance, action.dateKey, {
        durationMin: state.backendUser?.session_length_min,
      })
      if (!session) return state
      return { ...state, sessions: [...state.sessions, recalc(session)] }
    }

    case 'LOG_WEIGHT': {
      const others = state.weights.filter((w) => w.dateKey !== todayKey)
      return { ...state, weights: [...others, { dateKey: todayKey, kg: action.kg }].sort((a, b) => a.dateKey.localeCompare(b.dateKey)) }
    }

    case 'ADJUST_WATER': {
      const habits = state.habits.map((h) =>
        h.dateKey === todayKey ? { ...h, waterL: Math.max(0, Math.round((h.waterL + action.deltaL) * 10) / 10) } : h,
      )
      return { ...state, habits }
    }

    case 'PATCH_TODAY_HABIT': {
      const habits = state.habits.map((h) => (h.dateKey === todayKey ? { ...h, ...action.patch } : h))
      return { ...state, habits }
    }

    // Like PATCH_TODAY_HABIT but for any day (retroactive logging), upserting the
    // habit record if that day had none.
    case 'PATCH_HABIT': {
      const has = state.habits.some((h) => h.dateKey === action.dateKey)
      const habits = has
        ? state.habits.map((h) => (h.dateKey === action.dateKey ? { ...h, ...action.patch } : h))
        : [...state.habits, { dateKey: action.dateKey, steps: 0, sleepH: 0, waterL: 0, mindsetMin: 0, nutritionScore: 0, workout: false, ...action.patch }]
      return { ...state, habits }
    }

    // Retroactively mark a day's workout complete (or not). Drives `workoutStartedForDay`
    // and the day's `workout` habit flag; also reflects on that day's session if one exists.
    case 'SET_WORKOUT_DONE': {
      const keys = new Set(state.workoutStartedKeys ?? [])
      if (action.done) keys.add(action.dateKey)
      else keys.delete(action.dateKey)
      const hasHabit = state.habits.some((h) => h.dateKey === action.dateKey)
      const habits = hasHabit
        ? state.habits.map((h) => (h.dateKey === action.dateKey ? { ...h, workout: action.done } : h))
        : action.done
          ? [...state.habits, { dateKey: action.dateKey, steps: 0, sleepH: 0, waterL: 0, mindsetMin: 0, nutritionScore: 0, workout: true }]
          : state.habits
      const sessions = state.sessions.map((s) => (s.dateKey === action.dateKey ? { ...s, completed: action.done } : s))
      // Reconcile the chart projection for every session whose completion flag
      // changed (audit F-022): charts must never contradict workout history.
      let next: AppState = { ...state, workoutStartedKeys: [...keys], habits, sessions }
      for (const s of sessions) {
        if (s.dateKey === action.dateKey) next = withSummary(next, s)
      }
      return next
    }

    case 'ADD_MEAL': {
      const meal: LoggedMeal = { ...action.meal, id: `m-${Date.now()}`, dateKey: todayKey }
      return { ...state, meals: [...state.meals, meal] }
    }

    case 'REMOVE_MEAL':
      return { ...state, meals: state.meals.filter((m) => m.id !== action.id) }

    case 'ADD_ACTIVITY': {
      const activity: LoggedActivity = { ...action.activity, id: `act-${Date.now()}`, dateKey: todayKey, time: nowTime() }
      const activities = [activity, ...(state.activities ?? [])]
      // Recognise any logged activity as training for the day.
      const has = state.habits.some((h) => h.dateKey === todayKey)
      const habits = has
        ? state.habits.map((h) => (h.dateKey === todayKey ? { ...h, workout: true } : h))
        : [...state.habits, { dateKey: todayKey, steps: 0, sleepH: 0, waterL: 0, mindsetMin: 0, nutritionScore: 0, workout: true }]
      return { ...state, activities, habits }
    }

    case 'REMOVE_ACTIVITY':
      return { ...state, activities: (state.activities ?? []).filter((a) => a.id !== action.id) }

    case 'TOGGLE_ACTIVITY_WEEKLY':
      return { ...state, activities: (state.activities ?? []).map((a) => (a.id === action.id ? { ...a, weekly: !a.weekly } : a)) }

    case 'ADD_PLANNED_MEAL':
      return { ...state, mealPlan: [...(state.mealPlan ?? []), { ...action.plan, id: `pm-${Date.now()}` }] }

    case 'REMOVE_PLANNED_MEAL':
      return { ...state, mealPlan: (state.mealPlan ?? []).filter((p) => p.id !== action.id) }

    case 'ADD_COMMENT': {
      const text = action.text.trim()
      if (!text) return state
      const comment: PostComment = { id: `cm-${Date.now()}`, postId: action.postId, author: `${state.profile.name} (You)`, text, time: 'now' }
      const posts = state.posts.map((p) => (p.id === action.postId ? { ...p, comments: p.comments + 1 } : p))
      return { ...state, postComments: [...(state.postComments ?? []), comment], posts }
    }

    case 'SAVE_FOOD_REVIEW': {
      const others = state.foodReviews.filter((r) => r.dateKey !== todayKey)
      const review = action.text.trim() ? [{ dateKey: todayKey, text: action.text, score: action.score }] : []
      // Reflect the day's food quality in today's habit ring too.
      const habits = state.habits.map((h) => (h.dateKey === todayKey ? { ...h, nutritionScore: action.score } : h))
      return { ...state, foodReviews: [...others, ...review], habits }
    }

    case 'TOGGLE_NUTRITION_TAG': {
      const key = action.dateKey ?? todayKey
      const map = { ...(state.nutritionTags ?? {}) }
      const current = map[key] ?? []
      const next = current.includes(action.tag)
        ? current.filter((t) => t !== action.tag)
        : [...current, action.tag]
      if (next.length) map[key] = next
      else delete map[key]
      return { ...state, nutritionTags: map }
    }

    case 'MARK_WORKOUT_STARTED': {
      const keys = state.workoutStartedKeys ?? []
      if (keys.includes(todayKey)) return state
      return { ...state, workoutStartedKeys: [...keys, todayKey] }
    }

    case 'MARK_NUTRITION_ASKED': {
      const keys = state.nutritionAskedKeys ?? []
      if (keys.includes(todayKey)) return state
      return { ...state, nutritionAskedKeys: [...keys, todayKey] }
    }

    case 'ADD_MY_MEAL': {
      const meal: UserMeal = { ...action.meal, id: `um-${Date.now()}`, createdAtKey: todayKey }
      return { ...state, myMeals: [...(state.myMeals ?? []), meal] }
    }

    case 'REMOVE_MY_MEAL':
      return { ...state, myMeals: (state.myMeals ?? []).filter((m) => m.id !== action.id) }

    case 'SAVE_TEMPLATE': {
      const list = state.templates ?? []
      const exists = list.some((t) => t.id === action.template.id)
      const templates = exists
        ? list.map((t) => (t.id === action.template.id ? action.template : t))
        : [action.template, ...list]
      return { ...state, templates }
    }

    case 'REMOVE_TEMPLATE':
      return { ...state, templates: (state.templates ?? []).filter((t) => t.id !== action.id) }

    case 'SEND_CHAT': {
      const text = action.text.trim()
      if (!text) return state
      const id = Date.now()
      const userMsg: ChatMessage = { id: `c-${id}`, role: 'user', text, dateKey: todayKey, time: nowTime(), read: true }
      // Coach gated OFF: record the user's message but produce no coach reply.
      if (!coachOperational()) return { ...state, chat: [...state.chat, userMsg] }
      // SAFETY: same shared source as the 1:1 chat (spec §7) — the safety guard runs first, then the
      // daily message limit (which never blocks a crisis). Uses the retained in-memory session so
      // multi-turn persistence + retraction are enforced identically to the chat surfaces (spec §2).
      const ctx = coachContext(state)
      const session = sharedCoachSession()
      const pre = coachPrecheck(text, ctx, session, state.coachUsage, todayKey)
      const replyText = pre.kind !== 'allow'
        ? pre.response.text
        : guardOutgoing(coachReply(state, text), pre.decision, ctx, session)
      const buttons = pre.kind !== 'allow' ? pre.response.buttons : undefined
      const coachMsg: ChatMessage = { id: `c-${id + 1}`, role: 'coach', text: replyText, buttons, dateKey: todayKey, time: nowTime(), read: false }
      return { ...state, chat: [...state.chat, userMsg, coachMsg] }
    }

    case 'PUSH_CHAT': {
      const text = action.text.trim()
      if (!text) return state
      const msg: ChatMessage = {
        id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: action.role,
        text,
        dateKey: todayKey,
        time: nowTime(),
        // user messages are read by definition; coach replies are read while the thread is open
        read: action.role === 'user',
        buttons: action.buttons,
        replyTo: action.replyTo,
        mode: action.mode,
        citations: action.citations,
        learnedMemory: action.learnedMemory,
        proposal: action.proposal,
      }
      return { ...state, chat: [...state.chat, msg] }
    }

    case 'BUMP_COACH_USAGE': {
      const u = state.coachUsage
      const next = u && u.dateKey === todayKey ? { dateKey: todayKey, count: u.count + 1 } : { dateKey: todayKey, count: 1 }
      return { ...state, coachUsage: next }
    }

    case 'SET_INTEGRATION': {
      const cur = state.integrations ?? {}
      const prev = cur[action.id] ?? { connected: false }
      return { ...state, integrations: { ...cur, [action.id]: { ...prev, ...action.patch } } }
    }

    case 'APPLY_SYNC': {
      // De-dupe on the platform's own activity id so re-syncing never doubles up.
      const have = new Set((state.activities ?? []).map((a) => a.externalId).filter(Boolean))
      const fresh = action.activities
        .filter((a) => !have.has(a.externalId))
        .map((a) => ({ ...a, id: `ext-${action.provider}-${a.externalId}` }))

      // Merge steps/sleep into habit days: the platform's number wins when it's
      // higher than what was hand-logged (never lowers a manual entry).
      const touched = new Set([...Object.keys(action.stepsByDay), ...Object.keys(action.sleepByDay)])
      const habitByKey = new Map(state.habits.map((h) => [h.dateKey, h]))
      for (const k of touched) {
        const h = habitByKey.get(k) ?? { dateKey: k, steps: 0, sleepH: 0, waterL: 0, mindsetMin: 0, nutritionScore: 0, workout: false }
        habitByKey.set(k, {
          ...h,
          steps: Math.max(h.steps, action.stepsByDay[k] ?? 0),
          sleepH: Math.max(h.sleepH, action.sleepByDay[k] ?? 0),
        })
      }
      const habits = [...habitByKey.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey))

      const cur = state.integrations ?? {}
      const prev = cur[action.provider] ?? { connected: true }
      return {
        ...state,
        activities: [...(state.activities ?? []), ...fresh],
        habits,
        integrations: { ...cur, [action.provider]: { ...prev, lastSyncAt: action.at } },
      }
    }

    case 'MARK_CHAT_READ':
      return { ...state, chat: state.chat.map((m) => (m.read ? m : { ...m, read: true })) }

    case 'SAVE_SESSION': {
      const exists = state.sessions.some((s) => s.id === action.session.id)
      const sessions = exists
        ? state.sessions.map((s) => (s.id === action.session.id ? recalc(action.session) : s))
        : [...state.sessions, recalc(action.session)]
      const saved = sessions.find((s) => s.id === action.session.id)
      return saved ? withSummary({ ...state, sessions }, saved) : { ...state, sessions }
    }

    case 'TOGGLE_EXERCISE_DONE': {
      const sessions = state.sessions.map((s) => {
        if (s.dateKey !== todayKey) return s
        const exercises = s.exercises.map((ex) => {
          if (ex.defId !== action.defId) return ex
          const allDone = ex.sets.every((set) => set.done)
          return { ...ex, sets: ex.sets.map((set) => ({ ...set, done: !allDone })) }
        })
        return recalc({ ...s, exercises })
      })
      return { ...state, sessions }
    }

    case 'COMPLETE_WORKOUT': {
      // Idempotent by session id (audit F-023): completing an already-completed
      // session must not append a duplicate notification or touch anything.
      const target = state.sessions.find((s) => s.id === action.id)
      if (!target || target.completed) return state
      const sessions = state.sessions.map((s) =>
        s.id === action.id ? recalc({ ...s, completed: true }) : s,
      )
      // Mark the habit for the SESSION's OWN day, never today (audit SA-016):
      // finishing a back-dated session must never flip today's workout flag or
      // streak. Upsert the day's habit record if it doesn't exist yet.
      const day = target.dateKey
      const hasHabit = state.habits.some((h) => h.dateKey === day)
      const habits = hasHabit
        ? state.habits.map((h) => (h.dateKey === day ? { ...h, workout: true } : h))
        : [...state.habits, { dateKey: day, steps: 0, sleepH: 0, waterL: 0, mindsetMin: 0, nutritionScore: 0, workout: true }]
      const notif: AppNotification = {
        id: `n-${action.id}`,
        type: 'workout',
        title: 'Workout logged',
        body: 'Nice work. Your stats, streak and next session weights are updated.',
        dateKey: day,
        time: nowTime(),
        read: false,
      }
      const notifications = state.notifications.some((n) => n.id === notif.id)
        ? state.notifications
        : [notif, ...state.notifications]
      const next = { ...state, sessions, habits, notifications }
      const completed = sessions.find((s) => s.id === action.id)
      return completed ? withSummary(next, completed) : next
    }

    // Edit a logged session in place (audit F-012): volume is recomputed, the
    // summary projection reconciles (upsert/remove via withSummary), and the
    // day's workout habit flag follows whether any completed session remains.
    case 'UPDATE_SESSION': {
      const exists = state.sessions.some((s) => s.id === action.session.id)
      if (!exists) return state
      const updated = recalc(action.session)
      const sessions = state.sessions.map((s) => (s.id === updated.id ? updated : s))
      const dayCompleted = sessions.some((s) => s.dateKey === updated.dateKey && s.completed)
      const habits = state.habits.map((h) => (h.dateKey === updated.dateKey ? { ...h, workout: dayCompleted } : h))
      return withSummary({ ...state, sessions, habits }, updated)
    }

    // Delete a logged session (audit F-012): the session, its chart summary,
    // its completion notification, and — when it was the day's only completed
    // session — the day's workout habit flag all go together, so history,
    // charts and streaks can never contradict each other.
    case 'REMOVE_SESSION': {
      const target = state.sessions.find((s) => s.id === action.id)
      if (!target) return state
      const sessions = state.sessions.filter((s) => s.id !== action.id)
      const workoutSummaries = (state.workoutSummaries ?? []).filter((w) => w.id !== action.id)
      const dayCompleted = sessions.some((s) => s.dateKey === target.dateKey && s.completed)
      const habits = state.habits.map((h) => (h.dateKey === target.dateKey ? { ...h, workout: dayCompleted } : h))
      const keys = new Set(state.workoutStartedKeys ?? [])
      if (!dayCompleted && !sessions.some((s) => s.dateKey === target.dateKey)) keys.delete(target.dateKey)
      const notifications = state.notifications.filter((n) => n.id !== `n-${action.id}`)
      return { ...state, sessions, workoutSummaries, habits, notifications, workoutStartedKeys: [...keys] }
    }

    case 'TOGGLE_LIKE': {
      const posts = state.posts.map((p) =>
        p.id === action.postId ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) } : p,
      )
      return { ...state, posts }
    }

    case 'TOGGLE_BOOKMARK': {
      const posts = state.posts.map((p) => (p.id === action.postId ? { ...p, bookmarked: !p.bookmarked } : p))
      return { ...state, posts }
    }

    case 'ADD_POST': {
      const post: Post = {
        id: `post-${Date.now()}`,
        authorId: 'you',
        author: `${state.profile.name} M.`,
        dateKey: todayKey,
        time: 'Just now',
        text: action.text,
        image: action.image,
        likes: 0,
        comments: 0,
        liked: false,
        bookmarked: false,
        ...(action.pr ? { pr: action.pr } : {}),
        ...(action.scope ? { scope: action.scope } : {}),
      }
      return { ...state, posts: [post, ...state.posts] }
    }

    case 'JOIN_CHALLENGE': {
      const challenges = state.challenges.map((c) =>
        c.id === action.id ? { ...c, joined: !c.joined, participants: c.participants + (c.joined ? -1 : 1) } : c,
      )
      return { ...state, challenges }
    }

    case 'RSVP_EVENT': {
      const events = state.events.map((e) =>
        e.id === action.id ? { ...e, rsvp: !e.rsvp, going: e.going + (e.rsvp ? -1 : 1) } : e,
      )
      return { ...state, events }
    }

    case 'JOIN_GROUP': {
      const groups = state.groups.map((g) =>
        g.id === action.id ? { ...g, joined: !g.joined, members: g.members + (g.joined ? -1 : 1) } : g,
      )
      return { ...state, groups }
    }

    // --- Community competition hub (v13) ---
    case 'SET_USERNAME': {
      const username = action.username.trim()
      if (!username) return state
      return {
        ...state,
        community: { ...state.community, username, usernameSetAtKey: todayKey },
      }
    }

    case 'CREATE_GROUP': {
      const existing = state.community.groups
      // Guard: never create a second group with the same id, or a name that
      // collides case-insensitively with one you're already in.
      const name = action.group.name.trim().toLowerCase()
      if (existing.some((g) => g.id === action.group.id || g.name.trim().toLowerCase() === name)) {
        return state
      }
      return {
        ...state,
        community: { ...state.community, groups: [action.group, ...existing] },
      }
    }

    case 'JOIN_GROUP_BY_CODE': {
      const existing = state.community.groups
      // Prevent duplicate membership: joining a group you're already in is a no-op.
      if (existing.some((g) => g.id === action.group.id)) return state
      return {
        ...state,
        community: { ...state.community, groups: [action.group, ...existing] },
      }
    }

    case 'LEAVE_GROUP':
      return {
        ...state,
        community: {
          ...state.community,
          groups: state.community.groups.filter((g) => g.id !== action.id),
        },
      }

    case 'DELETE_GROUP': {
      // Owner-only: a member can only delete a group they created. The UI already
      // gates + confirms this; the reducer enforces it structurally so a stray
      // dispatch can never remove someone else's group.
      const target = state.community.groups.find((g) => g.id === action.id)
      if (!target || target.ownerUsername !== state.community.username) return state
      return {
        ...state,
        community: {
          ...state.community,
          groups: state.community.groups.filter((g) => g.id !== action.id),
        },
      }
    }

    case 'SET_GROUP_GOAL': {
      // Owner-only: only the group's creator can change the shared weekly target.
      const target = state.community.groups.find((g) => g.id === action.id)
      if (!target || target.ownerUsername !== state.community.username) return state
      const goal = Math.max(1, Math.min(200, Math.round(action.goal)))
      return {
        ...state,
        community: {
          ...state.community,
          groups: state.community.groups.map((g) => (g.id === action.id ? { ...g, weeklyGoal: goal } : g)),
        },
      }
    }

    case 'TRANSFER_GROUP_OWNER': {
      // Owner-only: only the current owner can hand the group to another member.
      // (Server-authoritative transfer lands with the groups backend; this keeps
      // the local/preview model consistent.)
      const target = state.community.groups.find((g) => g.id === action.id)
      if (!target || target.ownerUsername !== state.community.username) return state
      const isMember = target.members.some((m) => m.username === action.newOwnerUsername)
      if (!isMember || action.newOwnerUsername === state.community.username) return state
      return {
        ...state,
        community: {
          ...state.community,
          groups: state.community.groups.map((g) => (g.id === action.id ? { ...g, ownerUsername: action.newOwnerUsername } : g)),
        },
      }
    }

    // Cheer / un-cheer a group activity event (reaction-only, positive-only).
    case 'CHEER_ACTIVITY': {
      const groups = state.community.groups.map((g) => {
        if (g.id !== action.groupId) return g
        const cheers = { ...(g.cheers ?? {}) }
        const cur = cheers[action.activityId] ?? { count: 0, mine: false }
        cheers[action.activityId] = { count: Math.max(0, cur.count + (cur.mine ? -1 : 1)), mine: !cur.mine }
        return { ...g, cheers }
      })
      return { ...state, community: { ...state.community, groups } }
    }

    // Spend a freeze token to protect a specific day's streak (idempotent per day).
    case 'USE_STREAK_FREEZE': {
      const tokens = state.community.freezeTokens ?? 0
      const frozen = state.community.frozenDays ?? []
      if (tokens <= 0 || frozen.includes(action.dateKey)) return state
      return {
        ...state,
        community: { ...state.community, freezeTokens: tokens - 1, frozenDays: [...frozen, action.dateKey] },
      }
    }

    // Mark / unmark a planned rest day (keeps the streak without spending a token).
    case 'TOGGLE_REST_DAY': {
      const rest = state.community.restDays ?? []
      const next = rest.includes(action.dateKey) ? rest.filter((d) => d !== action.dateKey) : [...rest, action.dateKey]
      return { ...state, community: { ...state.community, restDays: next } }
    }

    // Weekly freeze grant — idempotent per week, capped so tokens can't stockpile.
    case 'GRANT_WEEKLY_FREEZE': {
      // Each league reset (now the first Monday of the month) tops the user up to
      // 2 fresh freezes (design spec). Idempotent on the period key so it fires
      // once per period, not on every render.
      if (state.community.freezeGrantWeek === action.weekKey) return state
      const FREEZE_CAP = 2
      return { ...state, community: { ...state.community, freezeTokens: FREEZE_CAP, freezeGrantWeek: action.weekKey } }
    }

    // Backend hydration: replace the local group cache with the server's copy.
    case 'SET_COMMUNITY_GROUPS':
      return { ...state, community: { ...state.community, groups: action.groups } }

    // Moderation: block a user. Their rows/activity are filtered out of every
    // board and feed locally (see communitySelectors). Can't block yourself.
    case 'BLOCK_USER': {
      const uid = action.uid
      if (!uid || uid === state.community.username) return state
      const current = state.community.blockedUids ?? []
      if (current.includes(uid)) return state
      return { ...state, community: { ...state.community, blockedUids: [...current, uid] } }
    }

    case 'UNBLOCK_USER':
      return {
        ...state,
        community: { ...state.community, blockedUids: (state.community.blockedUids ?? []).filter((u) => u !== action.uid) },
      }

    // Commit the user's league placement (client simulation now; server on rollover later).
    case 'SET_LEAGUE':
      return {
        ...state,
        community: {
          ...state.community,
          league: { tier: action.tier, weekKey: action.weekKey, seasonWins: action.seasonWins ?? state.community.league?.seasonWins },
        },
      }

    case 'MARK_NOTIF_READ':
      return { ...state, notifications: state.notifications.map((n) => (n.id === action.id ? { ...n, read: true } : n)) }

    case 'MARK_ALL_READ':
      return { ...state, notifications: state.notifications.map((n) => ({ ...n, read: true })) }

    case 'ADD_NOTIFICATION': {
      const notif: AppNotification = { ...action.notif, id: `n-${Date.now()}`, dateKey: todayKey, time: nowTime(), read: false }
      return { ...state, notifications: [notif, ...state.notifications] }
    }

    case 'SAVE_PERIOD': {
      // Upsert by id. Reading through `plannedPeriods` first means a legacy
      // exam-dates save is migrated into the real array on the user's first edit
      // instead of being dropped.
      const current = plannedPeriods(state)
      const exists = current.some((p) => p.id === action.period.id)
      const next = exists ? current.map((p) => (p.id === action.period.id ? action.period : p)) : [...current, action.period]
      return withPeriods(state, next)
    }

    case 'CANCEL_PERIOD':
      return withPeriods(state, plannedPeriods(state).filter((p) => p.id !== action.id))

    case 'COMPLETE_LESSON':
      return state.beginnerProgress.includes(action.id)
        ? state
        : { ...state, beginnerProgress: [...state.beginnerProgress, action.id] }

    case 'GIVE_KUDOS': {
      const posts = state.posts.map((p) =>
        p.id === action.postId ? { ...p, gaveKudos: !p.gaveKudos, kudos: (p.kudos ?? 0) + (p.gaveKudos ? -1 : 1) } : p,
      )
      return { ...state, posts }
    }

    case 'CONNECT_PARTNER': {
      const partners = state.partners.map((p) => (p.id === action.id ? { ...p, connected: !p.connected } : p))
      return { ...state, partners }
    }

    // "Turn off coach & delete coach data" (audit F-015): the local transcript
    // copies go with the server records. The diff-save then issues deletes for
    // any chat/coachThread docs the cloud baseline still lists (harmless
    // no-ops for docs the server purge already removed).
    case 'CLEAR_COACH_CHAT':
      return { ...state, chat: [], coachThread: [] }

    case 'RESET_DEMO':
      return buildSeed()

    case 'RESET_EMPTY':
      return emptyState()

    default:
      return state
  }
}

/* ------------------------------ Context ------------------------------ */
const StoreCtx = createContext<{
  state: AppState
  dispatch: React.Dispatch<Action>
  hydrated: boolean
  persistenceError: boolean
} | null>(null)
const StoreDispatchCtx = createContext<React.Dispatch<Action> | null>(null)
const StoreMetaCtx = createContext<{ hydrated: boolean; persistenceError: boolean; identity: Identity } | null>(null)
type StoreSelectorApi = {
  getState: () => AppState
  subscribe: (listener: () => void) => () => void
}
const StoreSelectorCtx = createContext<StoreSelectorApi | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  // Seed synchronously so the first render is never empty; the persisted
  // state (if any) is loaded asynchronously from AsyncStorage right after.
  const [state, baseDispatch] = useReducer(reducer, undefined, buildSeed)
  const [hydrated, setHydrated] = useState(false)
  const [persistenceError, setPersistenceError] = useState(false)
  const persistenceBlockedRef = useRef(false)
  // Which account's data the store currently holds (audit F-001). Starts as the
  // module's current identity; AuthProvider publishes changes and the swap
  // effect below re-hydrates from that identity's own storage key.
  const [identity, setIdentity] = useState<Identity>(getActiveIdentity)
  // The key persistence writes to — always the key the current state was
  // hydrated FROM, so a save can never land in another account's slot.
  const persistKeyRef = useRef<string>(storageKeyFor(getActiveIdentity()))
  const prevIdentityRef = useRef<Identity>(getActiveIdentity())
  const bootRef = useRef(true)
  const stateRef = useRef(state)
  stateRef.current = state
  const selectorListenersRef = useRef(new Set<() => void>())
  const selectorApi = useMemo<StoreSelectorApi>(() => ({
    getState: () => stateRef.current,
    subscribe: (listener) => {
      selectorListenersRef.current.add(listener)
      return () => selectorListenersRef.current.delete(listener)
    },
  }), [])
  const meta = useMemo(() => ({ hydrated, persistenceError, identity }), [hydrated, persistenceError, identity])
  const dispatch = useCallback<React.Dispatch<Action>>((action) => {
    // P0 (audit SA-001): "Reset demo data" seeds a fabricated history. For a
    // signed-in account that state would diff against the cloud baseline and
    // delete/overwrite real data on the next sync. It is only ever meaningful
    // for the anonymous demo/preview identity, so it is dropped for any real
    // account here — a structural guard independent of whether the UI happens
    // to hide the control. RESET_EMPTY (the user's own "start fresh") stays
    // available to everyone.
    if (action.type === 'RESET_DEMO' && !canDispatchDemoReset(getActiveIdentity())) return
    if (action.type === 'RESET_DEMO' || action.type === 'RESET_EMPTY') {
      persistenceBlockedRef.current = false
      setPersistenceError(false)
    }
    baseDispatch(action)
  }, [])
  // Forces a re-render when the module-level clock moves (demo↔live, day rollover).
  const [, setClockTick] = useState(0)

  // Keep the date clock aligned with demo vs. live. The demo runs frozen so its
  // seeded history lines up; real users track live device time.
  useEffect(() => {
    setLiveClock(!state.demo)
    setClockTick((t) => t + 1)
  }, [state.demo])

  // Re-derive "today" when the app returns to the foreground (covers reopening
  // the next morning / across midnight). Only re-renders if the day changed.
  useEffect(() => {
    const sub = RNAppState.addEventListener('change', (s) => {
      if (s === 'active' && refreshClock()) setClockTick((t) => t + 1)
    })
    return () => sub.remove()
  }, [])

  // Track the active identity published by AuthProvider.
  useEffect(() => subscribeIdentity(setIdentity), [])

  // Hydrate (and re-hydrate on every identity switch) from the identity's OWN
  // storage key. The swap is atomic from the UI's point of view: `hydrated`
  // drops, persistence pauses, the new state lands in one dispatch, then writes
  // resume against the new key. Prior-account state can never render or be
  // saved under the new account (audit F-001).
  useEffect(() => {
    let cancelled = false
    const previousIdentity = prevIdentityRef.current
    prevIdentityRef.current = identity
    const isBoot = bootRef.current
    bootRef.current = false
    setHydrated(false)
    persistenceBlockedRef.current = true
    setPersistenceError(false)
    ;(async () => {
      const key = storageKeyFor(identity)
      let raw: string | null = null
      let readFailed = false
      try {
        raw = await AsyncStorage.getItem(key)
        // One-time adoption of the pre-scoping global key. It cannot be safely
        // attributed to a signed-in account, so it only ever seeds the anon slot.
        if (!raw && identity === ANON_IDENTITY) {
          const legacy = await AsyncStorage.getItem(LEGACY_STORAGE_KEY)
          if (legacy) {
            raw = legacy
            await AsyncStorage.setItem(key, legacy).catch(() => {})
            await AsyncStorage.removeItem(LEGACY_STORAGE_KEY).catch(() => {})
          }
        }
      } catch {
        readFailed = true
      }
      if (cancelled) return
      if (readFailed) {
        // Fail closed: leave writes blocked so an unreadable slot is never
        // overwritten with seed data.
        setPersistenceError(true)
        setHydrated(true)
        return
      }
      if (raw) {
        try {
          const migration = migrateAppState(JSON.parse(raw))
          if (migration.ok) {
            persistKeyRef.current = key
            persistenceBlockedRef.current = false
            dispatch({ type: 'HYDRATE', state: migration.state })
          } else {
            // Preserve an invalid/future payload for recovery; never overwrite
            // it with seed data from an older build.
            setPersistenceError(true)
          }
        } catch {
          setPersistenceError(true)
        }
        setHydrated(true)
        return
      }
      // No stored state for this identity.
      const memState = stateRef.current
      if (shouldCarryLocalState(previousIdentity, identity, memState)) {
        // Fresh onboarding answers follow the account that was just created:
        // move them into the new account's slot and clear the anon slot.
        persistKeyRef.current = key
        persistenceBlockedRef.current = false
        await AsyncStorage.setItem(key, JSON.stringify(memState)).catch(() => {})
        await AsyncStorage.removeItem(storageKeyFor(ANON_IDENTITY)).catch(() => {})
        if (!cancelled) setHydrated(true)
        return
      }
      persistKeyRef.current = key
      persistenceBlockedRef.current = false
      // First boot keeps the synchronous seed (demo preview); any later switch
      // to an empty slot starts clean so nothing leaks across accounts.
      if (!isBoot) dispatch({ type: 'RESET_EMPTY' })
      setHydrated(true)
    })()
    return () => {
      cancelled = true
    }
  }, [identity, dispatch])

  // R4-010: once hydrated, capture the device's IANA timezone into settings so it persists to the
  // server and the coach names the correct LOCAL day (travel/other AU states follow the device).
  useEffect(() => {
    if (!hydrated) return
    const tz = deviceTimezone()
    if (tz && state.settings.timezone !== tz) dispatch({ type: 'SET_SETTINGS', patch: { timezone: tz } })
  }, [hydrated, state.settings.timezone, dispatch])

  const savingRef = useRef(false)
  const savePendingRef = useRef(false)
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const persistNowRef = useRef<() => void>(() => {})
  persistNowRef.current = () => {
    if (!hydrated || persistenceBlockedRef.current) return
    if (savingRef.current) {
      savePendingRef.current = true
      return
    }
    const snapshot = stateRef.current
    savingRef.current = true
    // Bound the on-device write so a multi-year account never exceeds the
    // AsyncStorage size limit (audit SA-007). The cloud holds the full history;
    // the local copy is a bounded recent cache.
    AsyncStorage.setItem(persistKeyRef.current, JSON.stringify(boundStateForLocalPersist(snapshot)))
      .then(() => setPersistenceError(false))
      .catch(() => setPersistenceError(true))
      .finally(() => {
        savingRef.current = false
        if (savePendingRef.current) {
          savePendingRef.current = false
          persistNowRef.current()
        }
      })
  }

  // Coalesce bursts (typing, timers, set logging) into one ordered local write.
  useEffect(() => {
    if (!hydrated || persistenceBlockedRef.current) return
    if (writeTimerRef.current) clearTimeout(writeTimerRef.current)
    writeTimerRef.current = setTimeout(() => {
      writeTimerRef.current = null
      persistNowRef.current()
    }, 600)
    return () => {
      if (writeTimerRef.current) clearTimeout(writeTimerRef.current)
    }
  }, [state, hydrated])

  // Selector consumers are notified after the new reducer state commits. They
  // compare their selected snapshot with Object.is, so unrelated domains no
  // longer force them to render.
  useEffect(() => {
    selectorListenersRef.current.forEach((listener) => listener())
  }, [state])

  // Flush pending local state before native suspend / web tab backgrounding.
  useEffect(() => {
    const sub = RNAppState.addEventListener('change', (status) => {
      if (status !== 'background' && status !== 'inactive') return
      if (writeTimerRef.current) {
        clearTimeout(writeTimerRef.current)
        writeTimerRef.current = null
      }
      persistNowRef.current()
    })
    return () => {
      sub.remove()
      if (writeTimerRef.current) clearTimeout(writeTimerRef.current)
    }
  }, [])

  return (
    <StoreSelectorCtx.Provider value={selectorApi}>
      <StoreMetaCtx.Provider value={meta}>
        <StoreDispatchCtx.Provider value={dispatch}>
          <StoreCtx.Provider value={{ state, dispatch, hydrated, persistenceError }}>{children}</StoreCtx.Provider>
        </StoreDispatchCtx.Provider>
      </StoreMetaCtx.Provider>
    </StoreSelectorCtx.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

export function useDispatch() {
  const dispatch = useContext(StoreDispatchCtx)
  if (!dispatch) throw new Error('useDispatch must be used within StoreProvider')
  return dispatch
}

export function useStoreMeta() {
  const meta = useContext(StoreMetaCtx)
  if (!meta) throw new Error('useStoreMeta must be used within StoreProvider')
  return meta
}

export function useStoreSelector<T>(selector: (state: AppState) => T): T {
  const api = useContext(StoreSelectorCtx)
  if (!api) throw new Error('useStoreSelector must be used within StoreProvider')
  const getSnapshot = useCallback(() => selector(api.getState()), [api, selector])
  return useSyncExternalStore(api.subscribe, getSnapshot, getSnapshot)
}

export type { LoggedExercise }
