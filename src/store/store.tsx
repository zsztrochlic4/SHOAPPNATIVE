import { createContext, useContext, useEffect, useReducer, useState, type ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { todayKey } from '../lib/date'
import { buildSeed, emptyState, SCHEMA_VERSION } from './seed'
import { coachReply } from '../lib/coachChat'
import type {
  AppNotification,
  AppState,
  ChatMessage,
  IntegrationState,
  LoggedActivity,
  LoggedExercise,
  LoggedMeal,
  PlannedMeal,
  Post,
  PostComment,
  Profile,
  Settings,
  UserMeal,
  WorkoutSession,
} from './types'
import type { UserDoc } from '../backend/schema'

const STORAGE_KEY = 'sho.state.v1'

/* ------------------------------ Actions ------------------------------ */
export type Action =
  | { type: 'HYDRATE'; state: AppState }
  | { type: 'SET_SETTINGS'; patch: Partial<Settings> }
  | { type: 'SET_PROFILE'; patch: Partial<Profile> }
  | { type: 'COMPLETE_ONBOARDING'; profile: Partial<Profile>; backendUser?: UserDoc }
  | { type: 'LOG_WEIGHT'; kg: number }
  | { type: 'ADJUST_WATER'; deltaL: number }
  | { type: 'PATCH_TODAY_HABIT'; patch: Partial<{ steps: number; sleepH: number; mindsetMin: number; waterL: number }> }
  | { type: 'ADD_MEAL'; meal: Omit<LoggedMeal, 'id' | 'dateKey'> }
  | { type: 'REMOVE_MEAL'; id: string }
  | { type: 'ADD_ACTIVITY'; activity: Omit<LoggedActivity, 'id' | 'dateKey' | 'time'> }
  | { type: 'REMOVE_ACTIVITY'; id: string }
  | { type: 'TOGGLE_ACTIVITY_WEEKLY'; id: string }
  | { type: 'ADD_PLANNED_MEAL'; plan: Omit<PlannedMeal, 'id'> }
  | { type: 'REMOVE_PLANNED_MEAL'; id: string }
  | { type: 'ADD_COMMENT'; postId: string; text: string }
  | { type: 'SAVE_FOOD_REVIEW'; text: string; score: number }
  | { type: 'TOGGLE_NUTRITION_TAG'; tag: string }
  | { type: 'MARK_WORKOUT_STARTED' }
  | { type: 'MARK_NUTRITION_ASKED' }
  | { type: 'ADD_MY_MEAL'; meal: Omit<UserMeal, 'id' | 'createdAtKey'> }
  | { type: 'REMOVE_MY_MEAL'; id: string }
  | { type: 'SEND_CHAT'; text: string }
  | { type: 'PUSH_CHAT'; role: 'user' | 'coach'; text: string }
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
  | { type: 'TOGGLE_EXERCISE_DONE'; defId: string }
  | { type: 'COMPLETE_WORKOUT'; id: string }
  | { type: 'TOGGLE_LIKE'; postId: string }
  | { type: 'TOGGLE_BOOKMARK'; postId: string }
  | { type: 'ADD_POST'; text: string; image?: string }
  | { type: 'JOIN_CHALLENGE'; id: string }
  | { type: 'RSVP_EVENT'; id: string }
  | { type: 'JOIN_GROUP'; id: string }
  | { type: 'MARK_NOTIF_READ'; id: string }
  | { type: 'MARK_ALL_READ' }
  | { type: 'ADD_NOTIFICATION'; notif: Omit<AppNotification, 'id' | 'dateKey' | 'time' | 'read'> }
  | { type: 'ADD_PHOTO'; dataUrl: string; note?: string }
  | { type: 'REMOVE_PHOTO'; id: string }
  | { type: 'SET_EXAM_DATES'; startKey: string; endKey: string }
  | { type: 'COMPLETE_LESSON'; id: string }
  | { type: 'GIVE_KUDOS'; postId: string }
  | { type: 'CONNECT_PARTNER'; id: string }
  | { type: 'RESET_DEMO' }
  | { type: 'RESET_EMPTY' }

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function recalc(s: WorkoutSession): WorkoutSession {
  const volumeKg = Math.round(
    s.exercises.reduce((a, ex) => a + ex.sets.reduce((b, set) => b + (set.done ? set.weightKg * set.reps : 0), 0), 0),
  )
  return { ...s, volumeKg }
}

/* ------------------------------ Reducer ------------------------------ */
function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'HYDRATE':
      return action.state

    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.patch } }

    case 'SET_PROFILE':
      return { ...state, profile: { ...state.profile, ...action.patch } }

    case 'COMPLETE_ONBOARDING':
      return {
        ...state,
        profile: { ...state.profile, ...action.profile, onboarded: true },
        backendUser: action.backendUser ?? state.backendUser,
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
      const map = { ...(state.nutritionTags ?? {}) }
      const current = map[todayKey] ?? []
      const next = current.includes(action.tag)
        ? current.filter((t) => t !== action.tag)
        : [...current, action.tag]
      if (next.length) map[todayKey] = next
      else delete map[todayKey]
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

    case 'SEND_CHAT': {
      const text = action.text.trim()
      if (!text) return state
      const id = Date.now()
      const userMsg: ChatMessage = { id: `c-${id}`, role: 'user', text, dateKey: todayKey, time: nowTime(), read: true }
      const coachMsg: ChatMessage = { id: `c-${id + 1}`, role: 'coach', text: coachReply(state, text), dateKey: todayKey, time: nowTime(), read: false }
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
      return { ...state, sessions }
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
      const sessions = state.sessions.map((s) =>
        s.id === action.id ? recalc({ ...s, completed: true }) : s,
      )
      const habits = state.habits.map((h) => (h.dateKey === todayKey ? { ...h, workout: true } : h))
      const notif: AppNotification = {
        id: `n-${Date.now()}`,
        type: 'workout',
        title: 'Workout logged',
        body: 'Nice work. Your stats, streak and next session weights are updated.',
        dateKey: todayKey,
        time: nowTime(),
        read: false,
      }
      return { ...state, sessions, habits, notifications: [notif, ...state.notifications] }
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

    case 'MARK_NOTIF_READ':
      return { ...state, notifications: state.notifications.map((n) => (n.id === action.id ? { ...n, read: true } : n)) }

    case 'MARK_ALL_READ':
      return { ...state, notifications: state.notifications.map((n) => ({ ...n, read: true })) }

    case 'ADD_NOTIFICATION': {
      const notif: AppNotification = { ...action.notif, id: `n-${Date.now()}`, dateKey: todayKey, time: nowTime(), read: false }
      return { ...state, notifications: [notif, ...state.notifications] }
    }

    case 'ADD_PHOTO': {
      const photo = { id: `ph-${Date.now()}`, dateKey: todayKey, dataUrl: action.dataUrl, note: action.note }
      return { ...state, photos: [photo, ...state.photos] }
    }

    case 'REMOVE_PHOTO':
      return { ...state, photos: state.photos.filter((p) => p.id !== action.id) }

    case 'SET_EXAM_DATES':
      return { ...state, profile: { ...state.profile, examMode: true, examStartKey: action.startKey, examEndKey: action.endKey } }

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

    case 'RESET_DEMO':
      return buildSeed()

    case 'RESET_EMPTY':
      return emptyState()

    default:
      return state
  }
}

/* ------------------------------ Context ------------------------------ */
const StoreCtx = createContext<{ state: AppState; dispatch: React.Dispatch<Action>; hydrated: boolean } | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  // Seed synchronously so the first render is never empty; the persisted
  // state (if any) is loaded asynchronously from AsyncStorage right after.
  const [state, dispatch] = useReducer(reducer, undefined, buildSeed)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let cancelled = false
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return
        const parsed = JSON.parse(raw) as AppState
        if (parsed && parsed.v === SCHEMA_VERSION) dispatch({ type: 'HYDRATE', state: parsed })
      })
      .catch(() => {
        /* ignore — fall back to the freshly seeded demo state */
      })
      .finally(() => {
        if (!cancelled) setHydrated(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Persist on every change once the initial load has settled, so we never
  // overwrite a saved state with the transient seed during hydration.
  useEffect(() => {
    if (!hydrated) return
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {
      /* ignore quota / write errors */
    })
  }, [state, hydrated])

  return <StoreCtx.Provider value={{ state, dispatch, hydrated }}>{children}</StoreCtx.Provider>
}

export function useStore() {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

export function useDispatch() {
  return useStore().dispatch
}

export type { LoggedExercise }
