import type { Language } from '../lib/i18n'
import type { ContactButton } from '../backend/coach/safety'
import type { CoachActionProposal, CoachAnswerMode, CoachCitation, CoachMemory } from '../backend/coach/contracts'
import type { UserDoc, WorkoutInstanceDoc, ProgramDoc } from '../backend/schema'
import type { StoredProgram, ProgramStatus } from '../backend/runtime/activate'

/** A restorable snapshot of the program-related state, taken before a coach-actioned
 *  change so the user can UNDO it (Coach Capability Plan). */
export interface ProgramSnapshot {
  backendUser: UserDoc
  generatedProgram: StoredProgram | null
  programStatus: ProgramStatus | null
  programDoc: ProgramDoc | null
  workoutInstances: WorkoutInstanceDoc[] | undefined
  plannedPeriods: PlannedPeriod[] | undefined
}

export type Units = 'metric' | 'imperial'
/** 'system' follows the OS light/dark setting (audit SA-017 "Follow system"). */
export type Theme = 'dark' | 'light' | 'system'
/** Reduced-motion preference: follow the OS, or force it either way (audit SA-013/SA-017). */
export type ReducedMotionSetting = 'system' | 'reduce' | 'full'
export type NotificationConsent = 'unknown' | 'granted' | 'denied'
export type Goal = 'build-muscle' | 'lose-fat' | 'gain-strength' | 'stay-healthy'
export type Experience = 'beginner' | 'intermediate' | 'advanced'
export type Equipment = 'full-gym' | 'home-basic' | 'dorm-bodyweight'
export type MealName = 'Breakfast' | 'Lunch' | 'Snack' | 'Dinner'

export interface Profile {
  name: string
  /** What the user calls their AI coach. Falls back to "Coach" everywhere it's shown (see
   *  coachDisplayName). Per-user, synced across devices with the rest of the profile. */
  coachName?: string
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
  /** inclusive exam window, 'YYYY-MM-DD' — kept as min/max of examDates for the
   *  plan-adaptation phase logic. */
  examStartKey?: string
  examEndKey?: string
  /** The individual exam dates the user picked, sorted 'YYYY-MM-DD'. */
  examDates?: string[]
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

/* ------------------------- Plan Around Your Life ------------------------- */

/** How training bends during a declared busy period. See store/periods.ts. */
export type PeriodMode = 'pause' | 'maintenance' | 'moving' | 'fewer' | 'deload' | 'asis'

/** What "just keep moving" means for this user. */
export type MovingType = 'walking' | 'mobility' | 'both'

/**
 * One busy period the user declared in advance — exams, travel, moving house.
 * Maps onto the backend's `PlannedAbsence`; the extra fields here are the
 * per-mode follow-up answers the friendly flow collects.
 */
export interface PlannedPeriod {
  id: string
  /** inclusive range, 'YYYY-MM-DD' */
  start: string
  end: string
  /** null only while a draft is still being built */
  mode: PeriodMode | null
  /** maintenance: the 1–2 days they can still train ('Mon'..'Sun') */
  maintDays: string[]
  /** fewer days: sessions per week */
  fewerCount: 1 | 2
  /** fewer days: which days those sessions land on */
  fewerDays: string[]
  /** just keep moving: what to be nudged to do */
  movingType: MovingType
  /** what the user calls this period, e.g. 'Final exams' */
  note?: string
}

/** A planned meal slot in the weekly meal planner. */
export interface PlannedMeal {
  id: string
  day: string // 'Mon'..'Sun'
  slot: MealName
  name: string
  /** Week offset from the current week (0 = this week, -1 = last, 1 = next). */
  w?: number
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
  /** Tap-to-call / tap-to-text buttons for a fixed safety response (spec §20). */
  buttons?: ContactButton[]
  /** The message this one is a reply to (quoted above the bubble). */
  replyTo?: { role: 'user' | 'coach'; text: string }
  mode?: CoachAnswerMode | 'safety'
  citations?: CoachCitation[]
  learnedMemory?: CoachMemory
  proposal?: CoachActionProposal
}

/** Per-category local-notification preferences (see lib/notifications). */
export interface NotificationPrefs {
  /** A nudge to train (daily, at `reminderHour`). */
  workoutReminder: boolean
  /** An evening reminder to log the day and keep the streak. */
  streakReminder: boolean
  /** A daily nudge to open the coach for its check-in. Only fires while proactive check-ins are
   *  enabled (gated by `settings.coachProactiveEnabled` at schedule time). Defaults on. */
  coachCheckin?: boolean
  /** Preferred hour (0–23, device local) for the workout reminder. */
  reminderHour: number
  /** Suppress notifications overnight. */
  quiet: boolean
  /** Quiet-hours window start/end (0–23, may wrap midnight). */
  quietStartHour: number
  quietEndHour: number
}

export interface Settings {
  units: Units
  theme: Theme
  notificationsEnabled: boolean
  /** Explicit OS permission provenance. Missing on legacy saves, which must be
   *  treated as unknown rather than consent inferred from the old seeded flag. */
  notificationConsent?: NotificationConsent
  /** Per-category notification preferences + quiet hours. Defaults applied when absent. */
  notificationPrefs?: NotificationPrefs
  /** Play the rest-timer beeps/tick and the workout-complete chime. Defaults on. */
  soundEnabled?: boolean
  /** Haptic feedback on taps/actions, separate from sound (audit SA-017). Defaults on. */
  hapticsEnabled?: boolean
  /** Reduced-motion override (audit SA-013/SA-017). Defaults to 'system'. */
  reducedMotion?: ReducedMotionSetting
  /** UI language. Defaults to English when absent (older saves). */
  language?: Language
  /** IANA timezone captured from the device (audit R4-010), e.g. 'Australia/Perth'. Persisted so
   *  the server coach context names the correct LOCAL day instead of falling back to a default. */
  timezone?: string
  /** Local mirror of the server coach preference `proactiveEnabled` (source of truth is the coach
   *  workspace). Cached in settings so the client can gate the on-device proactive check-in surface
   *  without a network round-trip; refreshed whenever the workspace is fetched. */
  coachProactiveEnabled?: boolean
  /** Day-key of the most recent proactive coach check-in the user dismissed, so a check-in shows at
   *  most once per day and never reappears after being dismissed for that day. */
  coachCheckinDismissedKey?: string
  /** True once the "Meet your coach" first-run welcome has been dismissed, so it shows only once. */
  coachWelcomeSeen?: boolean
  /** Connected third-party integrations, e.g. { strava: true }. */
  connections?: Record<string, boolean>
  /** Which metric the main Progress chart shows (default 'weight'). */
  progressMetric?: string
  /** The three stat ids shown in the dashboard Progress overview. */
  dashboardStats?: string[]
  /** The window those stats are measured over. Defaults to '7 days'. */
  dashboardTimeframe?: StatTimeframe
  /** Exercise id featured in the Progress "Strength progress" 4-week focus card. */
  strengthFocusId?: string
  /** Time window for the Progress featured card + quick stats. Defaults to '4 weeks'. */
  progressTimeframe?: StatTimeframe
  /** The (up to three) quick-stat ids under the Progress featured card. */
  progressQuickStats?: string[]
  /** The tracked lift ids shown in the Progress "Training progress" section. */
  progressTrackedIds?: string[]
  /** Trend window for the Progress "Training progress" ranked lifts. */
  progressLiftPeriod?: ProgressLiftPeriod
}

/** The Progress "Training progress" trend window. */
export type ProgressLiftPeriod = '4 weeks' | '3 months' | '6 months'

/** The Progress overview time window (see lib/metrics). */
export type StatTimeframe = '7 days' | '4 weeks' | '3 months'

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
/**
 * Connection state for one external health platform.
 *
 * SECURITY (Hardening Plan v3 §6): the former OAuth `accessToken` / `refreshToken`
 * / `expiresAt` fields were REMOVED. Those integrations no longer exist, and a
 * client-writable Firestore document must never hold plaintext third-party
 * credentials. Any future credentials belong in Secret Manager or a server-only
 * backend — never here. The Firestore rules additionally reject top-level
 * `accessToken`/`refreshToken`, and the canonical sanitiser strips them from any
 * nested integration map before a write (src/lib/sanitize.ts).
 */
export interface IntegrationState {
  connected: boolean
  /** ISO timestamp of the last successful sync */
  lastSyncAt?: string
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
  /** Time-based station (bodyweight quick workouts): the work phase counts this
   *  many seconds down and auto-advances to rest, instead of tap-to-log reps. */
  measure?: 'time'
  /** Working seconds for a time station (the hold/interval length). */
  durationSec?: number
  /** Transition rest after this station within a round, in seconds (10–15s). */
  restSec?: number
  /** Per-side move: prompt "switch sides halfway" during the hold. */
  perSide?: boolean
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
  /** For sessions materialised from a generated program: the `WorkoutInstanceDoc` id this
   *  was built from. Links completed sets back to the prescription for set-log + progression
   *  persistence. Absent on demo/seed sessions and self-built sessions. */
  instanceId?: string
  /** Accent for the guided logger. Bodyweight "quick" sessions run in blue to match
   *  their blue entry point in the Workout section; everything else stays brand green. */
  accent?: 'brand' | 'blue'
  /** Circuit sessions (time-based quick workouts): full rest between rounds, in
   *  seconds (60s). Each `set` index across the exercises is one round; the player
   *  runs them round-major and rests this long when a new round begins. */
  roundRestSec?: number
}

/**
 * A compact projection of one COMPLETED workout session (Phase C Option B).
 * Everything the all-time Progress charts need — total volume and the best
 * estimated 1RM per exercise — without the full per-set session document. Kept
 * tiny (~4–8 lift entries) so the whole history loads on cold start cheaply and
 * the charts never have to read full sessions. Maintained client-side; id and
 * dateKey mirror the session it summarises. See src/store/workoutSummary.ts.
 */
export interface WorkoutSummary {
  /** == the source WorkoutSession.id */
  id: string
  dateKey: string
  /** WorkoutSession.volumeKg (done sets only, already computed). */
  volumeKg: number
  /** exercise defId → best Epley estimated-1RM across that exercise's sets. */
  lifts: Record<string, number>
}

/** One exercise slot in a user-built workout template (no per-set data — that's
 *  filled in live when the session is started). */
export interface TemplateExercise {
  defId: string
  name: string
  image: string
  targetSets: number
  targetReps: string
}

/** A reusable workout the user built themselves, saved to start again later. */
export interface WorkoutTemplate {
  id: string
  name: string
  createdAtKey: string
  exercises: TemplateExercise[]
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

/* ------------------------------------------------------------------ */
/*  Community competition hub (leaderboards + friend groups)          */
/* ------------------------------------------------------------------ */

/** How a group leaderboard is ranked. All three are "higher is better". */
export type GroupRankMetric = 'odometer' | 'streak' | 'volume'

/** A member of a friend group. The current user's row (`isYou`) carries their
 *  live stats (see selectors.myLeaderStats); everyone else is simulated locally
 *  until the Firestore backend lands. */
export interface GroupMember {
  /** stable id — the member's username (unique within the app) */
  id: string
  username: string
  isYou?: boolean
  /** 0..100 dashboard "odometer" (weeklyIndex) score */
  odometer: number
  /** current consistency streak, in days */
  streak: number
  /** longest streak on record (>= streak). Optional on legacy data. */
  bestStreak?: number
  /** total weight lifted in the last 7 days, kg */
  volume7: number
  /** total weight lifted in the last 30 days, kg */
  volume30: number
  /** sessions logged in the last 7 days — contributes to the team goal. Optional
   *  on legacy data (treated as 0). */
  sessionsThisWeek?: number
  /** F-003 competitive-integrity status. `held`/`provisional` standings have their
   *  ranking metrics withheld (server-zeroed) and should be shown as "under review"
   *  rather than ranked. Absent = treat as 'ok' (local simulation / legacy data). */
  status?: 'ok' | 'provisional' | 'held'
}

/** One "cheer" (reaction-only social) tally on a group activity event, keyed by
 *  the event's stable id. `mine` reflects whether the current user has cheered. */
export interface CheerTally {
  count: number
  mine: boolean
}

/** A private friend group the user created or joined. `ownerUsername` matches
 *  the current user's username when they created it (drives owner-only delete). */
export interface CommunityGroup {
  id: string
  name: string
  /** short, easy-to-share join code (see community/passcode.ts) */
  passcode: string
  ownerUsername: string
  createdAtKey: string
  members: GroupMember[]
  /** Icon key (src/components/Icon map) + accent colour chosen at creation.
   *  Optional on legacy groups; the UI falls back to a default. */
  icon?: string
  color?: string
  /** Shared target: combined member sessions the group aims to log this week.
   *  Owner-editable. Optional on legacy groups (UI falls back to a default). */
  weeklyGoal?: number
  /** Reaction-only "cheers" on activity events, keyed by event id. */
  cheers?: Record<string, CheerTally>
}

/** The user's weekly league placement. Tier 0 = Bronze … 4 = Diamond. `weekKey`
 *  is the Monday date-key of the week this placement belongs to. */
export interface LeagueState {
  tier: number
  weekKey: string
  /** how many seasons/weeks the user has been promoted (for a small flourish) */
  seasonWins?: number
}

/** Persisted community slice. `username` is null until the first-visit setup
 *  gate is completed; groups are the ones the user belongs to locally. */
export interface CommunityState {
  username: string | null
  usernameSetAtKey?: string
  groups: CommunityGroup[]
  /* ---- forgiving streaks (Recommendation 2) ---- */
  /** unspent streak-freeze tokens (auto-offered when a streak is at risk) */
  freezeTokens?: number
  /** planned rest-day keys — these keep a streak alive without a token */
  restDays?: string[]
  /** day keys the user spent a freeze on (kept the streak through a miss) */
  frozenDays?: string[]
  /** weekKey of the last weekly freeze grant (prevents double-granting) */
  freezeGrantWeek?: string
  /* ---- weekly league (Recommendation 1) ---- */
  league?: LeagueState
}

/** Difficulty tier shown on a quick workout (drives the beginner→advanced order). */
export type WorkoutLevel = 'Beginner' | 'Intermediate' | 'Advanced'

/** One timed station within a quick-workout round (a bodyweight move, not a lift). */
export interface QuickStation {
  /** Canonical exercise DB id (e.g. 'QD09', 'CH04', 'BK16'). */
  exerciseId: string
  /** Display name, denormalised so the list renders offline. */
  name: string
  /** Working time in seconds (the timer shows the full station length). */
  workSec: number
  /** Transition rest after this station, in seconds (10–15s). */
  restSec: number
  /** Optional rep target inside the working time, e.g. '5-6 reps/side', '6-8 reps'. */
  repHint?: string
  /** Per-side move: prompt "switch sides halfway". */
  perSide?: boolean
}

/** One round of a quick workout. Round 1 is the build round; a full rest follows rounds 1 & 2. */
export interface QuickRound {
  round: number
  /** Round 1: move at a controlled pace, focus on technique, do not push to the limit. */
  build?: boolean
  stations: QuickStation[]
  /** Full rest after this round, in seconds (60s after rounds 1 & 2; absent on the last). */
  roundRestSec?: number
}

/**
 * A 12-minute bodyweight quick workout: 3 rounds of 4 timed stations. Time-based
 * (seconds), not weight×reps. Rendered in the "12-Minute Bodyweight Exercises" sheet,
 * ordered by `order` (beginner → advanced).
 */
export interface QuickWorkout {
  id: string
  name: string
  level: WorkoutLevel
  /** Beginner→advanced display order (1-based). */
  order: number
  focus: string
  minutes: number
  rounds: QuickRound[]
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
  /** Optional human time label for recipes with passive time (chilling, marinating,
   *  overnight), e.g. "5 min prep + overnight". `minutes` is always ACTIVE time;
   *  when this is present the card shows it instead of "{minutes} min". */
  timeDisplay?: string
  /** Derived vegan flag (mirrors the 'vegan' tag). Optional; absent = not vegan. */
  vegan?: boolean
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

/**
 * Paid-entitlement state, mirrored from the server-authoritative
 * `entitlements/{uid}` Firestore doc by BillingSync (never written by the
 * client). Absent/`'none'` means non-premium. `trialing` and `active` both
 * grant access; see `isEntitled` in selectors.ts. This field is local-only —
 * it is never written back to the user root doc (see cloudRepo LOCAL_ONLY).
 */
export type SubscriptionStatus =
  | 'none'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'

export interface Subscription {
  status: SubscriptionStatus
  /** Stripe price id backing the subscription (informational). */
  plan?: string
  /** Unix seconds — current period end (renewal/expiry). */
  currentPeriodEnd?: number
  /** Unix seconds — when the free trial ends. */
  trialEnd?: number
  /** Stripe customer id for this user (kept for the billing portal). */
  stripeCustomerId?: string
  /** Unix ms — when the webhook last wrote this record. */
  updatedAt?: number
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
  /** Compact per-completed-session projections backing the all-time Progress
   *  charts (Phase C Option B). Maintained client-side; see workoutSummary.ts. */
  workoutSummaries?: WorkoutSummary[]
  /** True once `workoutSummaries` covers every completed session on the server
   *  (a new account, or after the one-time backfill on first Progress open).
   *  While false the charts derive from whatever sessions are currently loaded. */
  workoutSummaryComplete?: boolean
  program: ProgramDay[]
  posts: Post[]
  leaderboard: LeaderUser[]
  challenges: Challenge[]
  badges: Badge[]
  notifications: AppNotification[]
  events: CommunityEvent[]
  groups: Group[]
  /** Community competition hub: persistent username + friend groups. Absent on
   *  saves written before v13; the migrate merge defaults it (see migrate.ts). */
  community: CommunityState
  partners: PartnerCandidate[]
  coachThread: CoachMessage[]
  /** user-created recipe meals */
  myMeals?: UserMeal[]
  /** reusable workouts the user built themselves (see #2 custom sessions) */
  templates?: WorkoutTemplate[]
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
  /** Busy periods declared in advance (Plan Around Your Life). Absent on saves
   *  written before the feature existed — store/periods.ts reads legacy exam
   *  dates as a single period until the user edits something. */
  plannedPeriods?: PlannedPeriod[]
  /** Canonical backend `users` document (workout backend source of truth). Written
   *  only by the onboarding mapping module; the local Profile above is derived from it. */
  backendUser?: UserDoc
  /** The generated recommended program (compact render projection). Null/undefined until
   *  the generation gate opens and a program is produced (see backend/runtime/activate). */
  generatedProgram?: StoredProgram | null
  /** The canonical per-day `WorkoutInstanceDoc` templates the program was built from
   *  (schema.ts). Source of truth for building a loggable session from a program day; the
   *  set-by-set logger reads these. Written only when the generation gate opens. */
  workoutInstances?: WorkoutInstanceDoc[]
  /** Generation-gate status. `{ ok:false, reason }` drives the "program being finalised"
   *  holding screen; `{ ok:true }` means `generatedProgram` is present. */
  programStatus?: ProgramStatus | null
  /** The canonical `ProgramDoc` for the active program (schema.ts). Held so a coach-actioned
   *  change (coachActionResolver) can persist via writeActiveProgram and be restored on undo.
   *  Written alongside `generatedProgram` whenever the program is (re)generated. */
  programDoc?: ProgramDoc | null
  /** True only for the seeded "Alex" demo, which runs on a frozen clock so its
   *  40-day history lines up. Real onboarded users are false and run on live
   *  device time (see lib/date setLiveClock). */
  demo?: boolean
  /** Paid-entitlement state, mirrored from `entitlements/{uid}` by BillingSync.
   *  Local-only (never saved to the user root); the server doc is the truth. */
  subscription?: Subscription
  /** schema version for migrations */
  v: number
}
