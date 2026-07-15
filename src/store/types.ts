import type { Language } from '../lib/i18n'

export type Units = 'metric' | 'imperial'
export type Theme = 'dark' | 'light'
export type Goal = 'build-muscle' | 'lose-fat' | 'gain-strength' | 'stay-healthy'
export type Experience = 'beginner' | 'intermediate' | 'advanced'
export type Equipment = 'full-gym' | 'home-basic' | 'dorm-bodyweight'
export type MealName = 'Breakfast' | 'Lunch' | 'Snack' | 'Dinner'

export interface Profile {
  name: string
  age: number
  /** contact phone number, free-form (optional) */
  phone?: string
  sex: 'male' | 'female' | 'other'
  university: string
  cohort: string
  dorm: string
  society: string
  goal: Goal
  experience: Experience
  daysPerWeek: number
  equipment: Equipment
  heightCm: number
  startWeightKg: number
  goalWeightKg: number
  calorieTarget: number
  proteinTarget: number
  carbTarget: number
  fatTarget: number
  waterTargetL: number
  stepTarget: number
  sleepTargetH: number
  onboarded: boolean
  examMode: boolean
  /** inclusive exam window, 'YYYY-MM-DD' */
  examStartKey?: string
  examEndKey?: string
  budgetMode: boolean
  /** opted into the New to the Gym first-90-days track */
  newToGym: boolean
  /** premium unlocks 1:1 video calls with the coach */
  premium: boolean
  createdAtKey: string
  /* ---- richer onboarding context for the AI (all optional) ---- */
  /** preferred time per session in minutes (e.g. 30, 45, 60, 75) */
  sessionMinutes?: number
  /** injuries / limitations to train around, free text ('' or absent = none) */
  injuries?: string
  /** dietary preferences / restrictions (e.g. 'vegetarian', 'halal', 'dairy-free') */
  dietaryPrefs?: string[]
  /** what's driving them — free text, great context for the coach */
  motivation?: string
}

/** A planned meal slot in the weekly meal planner. */
export interface PlannedMeal {
  id: string
  day: string // 'Mon'..'Sun'
  slot: MealName
  name: string
}

/** A comment on a community post. */
export interface PostComment {
  id: string
  postId: string
  author: string
  text: string
  time: string
}

/** A single message in the 1:1 coach messenger. */
export interface ChatMessage {
  id: string
  role: 'user' | 'coach'
  text: string
  dateKey: string
  time: string
  read: boolean
}

export interface Settings {
  units: Units
  theme: Theme
  notificationsEnabled: boolean
  /** Play the rest-timer beeps/tick and the workout-complete chime. Defaults on. */
  soundEnabled?: boolean
  /** UI language. Defaults to English when absent (older saves). */
  language?: Language
  /** Connected third-party integrations, e.g. { strava: true }. */
  connections?: Record<string, boolean>
  /** Which metric the main Progress chart shows (default 'weight'). */
  progressMetric?: string
  /** The three stat ids shown in the dashboard Progress overview. */
  dashboardStats?: string[]
}

export interface WeightEntry {
  dateKey: string
  kg: number
}

export interface HabitDay {
  dateKey: string
  steps: number
  sleepH: number
  waterL: number
  mindsetMin: number
  /** 0..10 nutrition adherence score */
  nutritionScore: number
  workout: boolean
}

export interface FoodItem {
  id: string
  name: string
  brand?: string
  serving: string
  kcal: number
  p: number
  c: number
  f: number
  barcode?: string
  budget?: boolean
  /** rough cost per serving, in local currency units */
  cost?: number
}

export interface LoggedMeal {
  id: string
  dateKey: string
  meal: MealName
  name: string
  qty: number
  kcal: number
  p: number
  c: number
  f: number
}

/** A free-text "what I ate today" entry plus the coach's computed quality score. */
export interface FoodReview {
  dateKey: string
  text: string
  /** 0..10 quality score from the on-device nutrition coach. */
  score: number
}

/** A self-logged fitness activity not prescribed by the app (run, swim, sport…). */
/** Connection + tokens for one external health platform. */
export interface IntegrationState {
  connected: boolean
  /** ISO timestamp of the last successful sync */
  lastSyncAt?: string
  accessToken?: string
  refreshToken?: string
  /** unix seconds when the access token expires */
  expiresAt?: number
}

export interface LoggedActivity {
  id: string
  dateKey: string
  /** preset key (e.g. 'run') or 'custom' */
  type: string
  name: string
  /** icon key resolved by ActivityIcon */
  icon: string
  minutes: number
  intensity: 'easy' | 'moderate' | 'hard'
  /** rough estimated calories */
  calories: number
  note?: string
  time: string
  /** marked as a regular weekly activity; only these count as "workouts this week" */
  weekly?: boolean
  /** which platform this came from (e.g. 'strava'); absent = logged by hand */
  source?: string
  /** the platform's own id, used to de-duplicate on re-sync */
  externalId?: string
}

export interface ExerciseDef {
  id: string
  name: string
  muscle: string
  equipment: Equipment[]
  image: string
  bodyweightAlt?: string
}

export interface SetLog {
  weightKg: number
  reps: number
  done: boolean
}

export interface LoggedExercise {
  defId: string
  name: string
  image: string
  targetSets: number
  targetReps: string
  sets: SetLog[]
}

export interface WorkoutSession {
  id: string
  dateKey: string
  name: string
  focus: string
  image: string
  durationMin: number
  volumeKg: number
  calories: number
  exercises: LoggedExercise[]
  completed: boolean
}

export interface ProgramDay {
  id: string
  day: string
  name: string
  focus: string
  rest?: boolean
  exerciseIds: string[]
}

export interface Post {
  id: string
  authorId: string
  author: string
  dateKey: string
  time: string
  text: string
  image?: string
  ring?: number
  ringLabel?: string
  likes: number
  comments: number
  liked: boolean
  bookmarked: boolean
  /** kudos are lightweight campus-scoped cheers, separate from likes */
  kudos?: number
  gaveKudos?: boolean
  /** a PR celebration moment shared to the cohort */
  pr?: { lift: string; weight: string }
  scope?: CommunityScope
}

export type CommunityScope = 'campus' | 'dorm' | 'society' | 'global'

export interface LeaderUser {
  id: string
  name: string
  university: string
  dorm?: string
  society?: string
  level?: Experience
  points: number
  workouts: number
  streak: number
  isYou?: boolean
  friend?: boolean
}

export interface Challenge {
  id: string
  title: string
  weeks: number
  totalWeeks: number
  currentWeek: number
  participants: number
  joined: boolean
  progressPct: number
  rank?: number
  /** how many places you've moved this week (positive = climbed) */
  rankDelta?: number
  /** belonging-scoped: who you're really competing alongside */
  scope?: CommunityScope
  /** e.g. "West Hall vs East Hall" */
  vsLabel?: string
  yourSide?: string
  yourSidePct?: number
  rivalSide?: string
  rivalSidePct?: number
}

export interface Badge {
  id: string
  name: string
  desc: string
  icon: string
  earned: boolean
  earnedDateKey?: string
}

export interface AppNotification {
  id: string
  type: 'workout' | 'nutrition' | 'streak' | 'social' | 'challenge' | 'system'
  title: string
  body: string
  dateKey: string
  time: string
  read: boolean
}

export interface CommunityEvent {
  id: string
  title: string
  when: string
  host: string
  going: number
  rsvp: boolean
}

export interface Group {
  id: string
  icon: string
  name: string
  members: number
  desc: string
  unread: number
  color: string
  joined: boolean
}

export interface ProgressPhoto {
  id: string
  dateKey: string
  dataUrl: string
  note?: string
}

export interface QuickWorkout {
  id: string
  name: string
  minutes: number
  focus: string
  exercises: string[]
}

/** Recipe categories used to filter the Eats browser. */
export type MealCategory = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack' | 'Sweet'

/** Easy, tasty, budget-friendly recipes with full step-by-step method. */
export interface BudgetMeal {
  id: string
  name: string
  image: string
  category: MealCategory
  /** Total hands-on + cook time, in minutes. */
  minutes: number
  serves: number
  kcal: number
  p: number
  c: number
  f: number
  ingredients: string[]
  steps: string[]
  cookOnce?: string
  tags: string[]
  /** One-line "why it tastes good" note. */
  flavour?: string
}

/** A user-created recipe meal saved in "My Meals". */
export interface UserMeal {
  id: string
  name: string
  notes?: string
  kcal: number
  p: number
  c: number
  f: number
  ingredients: string[]
  createdAtKey: string
}

/** A lesson in the New to the Gym first-90-days track. */
export interface BeginnerLesson {
  id: string
  category: 'gym' | 'app' | 'mindset' | 'machine'
  title: string
  summary: string
  body: string[]
  minutes: number
  icon: string
}

/** A potential training partner on campus. */
export interface PartnerCandidate {
  id: string
  name: string
  level: Experience
  dorm: string
  society?: string
  goal: Goal
  availability: string
  blurb: string
  matchPct: number
  connected: boolean
}

export type CoachKind = 'checkin' | 'nudge' | 'celebration' | 'exam' | 'qa'

/** A short, human message from the user's coach. Rules-driven, no chatbot. */
export interface CoachMessage {
  id: string
  dateKey: string
  kind: CoachKind
  title: string
  body: string
  cta?: { label: string; overlay: string }
}

export interface AppState {
  profile: Profile
  settings: Settings
  weights: WeightEntry[]
  habits: HabitDay[]
  meals: LoggedMeal[]
  foodReviews: FoodReview[]
  chat: ChatMessage[]
  /** self-logged activities (optional for older saves) */
  activities?: LoggedActivity[]
  /** weekly meal plan */
  mealPlan?: PlannedMeal[]
  /** comments per community post */
  postComments?: PostComment[]
  /** quick "how did eating go" tag ids chosen per day, keyed by dateKey */
  nutritionTags?: Record<string, string[]>
  foods: FoodItem[]
  sessions: WorkoutSession[]
  program: ProgramDay[]
  posts: Post[]
  leaderboard: LeaderUser[]
  challenges: Challenge[]
  badges: Badge[]
  notifications: AppNotification[]
  events: CommunityEvent[]
  groups: Group[]
  photos: ProgressPhoto[]
  partners: PartnerCandidate[]
  coachThread: CoachMessage[]
  /** user-created recipe meals */
  myMeals?: UserMeal[]
  /** day keys on which the user started a workout */
  workoutStartedKeys?: string[]
  /** day keys on which the user asked the nutrition coach a question */
  nutritionAskedKeys?: string[]
  /** completed beginner-track lesson ids */
  beginnerProgress: string[]
  /** AI coach usage for the current day, for the per-user daily message limit */
  coachUsage?: { dateKey: string; count: number }
  /** connected health platforms (Strava, Whoop, ...) and their sync state */
  integrations?: Record<string, IntegrationState>
  /** schema version for migrations */
  v: number
}
