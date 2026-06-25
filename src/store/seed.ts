import { makeRng, rand, randInt, pick, round } from '../lib/rng'
import { dayKey, todayKey } from '../lib/date'
import {
  BASE_WEIGHTS,
  EXERCISES,
  FOODS,
  PARTNER_CANDIDATES,
  PROGRAM,
  REP_TARGETS,
  SET_TARGETS,
  SPLIT_ROTATION,
  exById,
  foodById,
  img,
} from '../data/catalog'
import type {
  AppNotification,
  AppState,
  Badge,
  Challenge,
  CoachMessage,
  CommunityEvent,
  Group,
  HabitDay,
  LeaderUser,
  LoggedActivity,
  LoggedExercise,
  LoggedMeal,
  PlannedMeal,
  Post,
  PostComment,
  ProgressPhoto,
  WeightEntry,
  WorkoutSession,
} from './types'

export const SCHEMA_VERSION = 8
const DAYS = 40 // 0..38 completed history, 39 = today (in progress)

/* round to nearest 2.5 (plate increments) */
const r25 = (n: number) => Math.round(n / 2.5) * 2.5

/* per-lift total strength gain across the block */
const GAIN: Record<string, number> = {
  bench: 0.2, incline: 0.22, shoulder: 0.2, cablefly: 0.18, tricep: 0.16,
  squat: 0.2, deadlift: 0.19, pulldown: 0.22, row: 0.2, curl: 0.25,
  ohp: 0.18, legpress: 0.22, rdl: 0.2, lateral: 0.3,
}

function rotationFor(i: number) {
  return SPLIT_ROTATION[(i + 3) % 7]
}

const PROG_IMAGE: Record<string, string> = {
  'p-push': img.pushDay,
  'p-pull': img.pullDay,
  'p-legs': img.legDay,
  'p-upper': img.heroWorkout,
  'p-lower': img.legDay,
}

function buildSession(rng: () => number, i: number, completed: boolean): WorkoutSession | null {
  const progId = rotationFor(i)
  const prog = PROGRAM.find((p) => p.id === progId)
  if (!prog || prog.rest) return null

  const progress = i / (DAYS - 2) // 0..1 across completed block
  const exercises: LoggedExercise[] = prog.exerciseIds.map((exId) => {
    const def = exById(exId)!
    const base = BASE_WEIGHTS[exId]
    const target = SET_TARGETS[exId]
    const repsTarget = REP_TARGETS[exId]
    const repNums = (repsTarget.match(/\d+/g) ?? ['8']).map(Number)
    const low = Math.min(...repNums)
    const high = Math.max(...repNums)
    const weight = r25(base * (1 + GAIN[exId] * progress) * (1 + rand(rng, -0.015, 0.015)))
    // log reps within the target range, usually at or near the top
    const sets = Array.from({ length: target }, () => ({
      weightKg: weight,
      reps: Math.max(low, high - randInt(rng, 0, 1)),
      done: completed,
    }))
    return {
      defId: exId,
      name: def.name,
      image: def.image,
      targetSets: target,
      targetReps: repsTarget,
      sets,
    }
  })

  const volumeKg = Math.round(
    exercises.reduce(
      (a, ex) => a + ex.sets.reduce((b, s) => b + (s.done || completed ? s.weightKg * s.reps : 0), 0),
      0,
    ),
  )
  const durationMin = randInt(rng, 44, 62)
  const calories = Math.round(durationMin * rand(rng, 8.5, 10.5))

  return {
    id: `s-${i}`,
    dateKey: dayKey(DAYS - 1 - i),
    name: prog.name,
    focus: prog.focus,
    image: PROG_IMAGE[prog.id] ?? img.heroWorkout,
    durationMin,
    volumeKg,
    calories,
    exercises,
    completed,
  }
}

function buildMeals(rng: () => number, i: number): LoggedMeal[] {
  const dateKey = dayKey(DAYS - 1 - i)
  const slots: { meal: LoggedMeal['meal']; ids: string[] }[] = [
    { meal: 'Breakfast', ids: ['f-oats', 'f-eggs', 'f-bagel', 'f-shake'] },
    { meal: 'Lunch', ids: ['f-chicken', 'f-burrito', 'f-tuna', 'f-pasta'] },
    { meal: 'Snack', ids: ['f-yogurt', 'f-apple', 'f-banana', 'f-pbsand'] },
    { meal: 'Dinner', ids: ['f-salmon', 'f-pasta', 'f-noodles', 'f-tuna'] },
  ]
  return slots.map((s, idx) => {
    const food = foodById(pick(rng, s.ids))!
    return {
      id: `m-${i}-${idx}`,
      dateKey,
      meal: s.meal,
      name: food.name,
      qty: 1,
      kcal: food.kcal,
      p: food.p,
      c: food.c,
      f: food.f,
    }
  })
}

/* Today's exact meals: matches the Nutrition mockup numbers */
function todaysMeals(): LoggedMeal[] {
  const ids: [LoggedMeal['meal'], string][] = [
    ['Breakfast', 'f-oats'],
    ['Lunch', 'f-chicken'],
    ['Snack', 'f-yogurt'],
    ['Dinner', 'f-salmon'],
  ]
  return ids.map(([meal, id], idx) => {
    const food = foodById(id)!
    return { id: `m-today-${idx}`, dateKey: todayKey, meal, name: food.name, qty: 1, kcal: food.kcal, p: food.p, c: food.c, f: food.f }
  })
}

/* tiny gradient SVG used as a seeded progress-photo placeholder */
function photoDataUrl(label: string, hue: number) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='400'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl(${hue},35%,18%)'/><stop offset='1' stop-color='hsl(${hue},45%,9%)'/></linearGradient></defs><rect width='300' height='400' fill='url(%23g)'/><text x='150' y='205' font-family='sans-serif' font-size='22' fill='rgba(255,255,255,0.55)' text-anchor='middle'>${label}</text></svg>`
  return `data:image/svg+xml;utf8,${svg}`
}

export function buildSeed(): AppState {
  const rng = makeRng(40021)

  /* -------- profile -------- */
  const startWeightKg = 74.6
  const profile: AppState['profile'] = {
    name: 'Alex',
    age: 21,
    sex: 'male',
    university: 'State University',
    cohort: 'Class of 2027',
    dorm: 'West Hall',
    society: 'Lifting Society',
    goal: 'build-muscle',
    experience: 'intermediate',
    daysPerWeek: 5,
    equipment: 'full-gym',
    heightCm: 178,
    startWeightKg,
    goalWeightKg: 74,
    calorieTarget: 2200,
    proteinTarget: 160,
    carbTarget: 250,
    fatTarget: 70,
    waterTargetL: 3,
    stepTarget: 9000,
    sleepTargetH: 8,
    onboarded: true,
    examMode: false,
    budgetMode: true,
    newToGym: false,
    premium: false,
    createdAtKey: dayKey(DAYS - 1),
  }

  /* -------- weights (daily, 74.6 → 72.4) -------- */
  const weights: WeightEntry[] = []
  for (let i = 0; i < DAYS - 1; i++) {
    const p = i / (DAYS - 2)
    const kg = round(startWeightKg + (72.4 - startWeightKg) * p + rand(rng, -0.22, 0.22), 1)
    if (i % 1 === 0) weights.push({ dateKey: dayKey(DAYS - 1 - i), kg })
  }
  weights.push({ dateKey: todayKey, kg: 72.4 })

  /* -------- habits (streak break days at completed-index 2 & 24) -------- */
  const breakDays = new Set([2, 24])
  const habits: HabitDay[] = []
  for (let i = 0; i < DAYS - 1; i++) {
    const good = !breakDays.has(i)
    const isTraining = !PROGRAM.find((p) => p.id === rotationFor(i))?.rest
    habits.push({
      dateKey: dayKey(DAYS - 1 - i),
      steps: good ? randInt(rng, 8200, 12500) : randInt(rng, 3200, 6500),
      sleepH: good ? round(rand(rng, 7.1, 8.6), 1) : round(rand(rng, 4.8, 6.2), 1),
      waterL: good ? round(rand(rng, 2.6, 3.4), 1) : round(rand(rng, 1.1, 2.0), 1),
      mindsetMin: good ? randInt(rng, 5, 15) : randInt(rng, 0, 4),
      nutritionScore: good ? randInt(rng, 7, 10) : randInt(rng, 3, 6),
      workout: isTraining && good,
    })
  }
  // today (in progress), mirrors the dashboard mockup feel
  habits.push({
    dateKey: todayKey,
    steps: 7632,
    sleepH: 7.5,
    waterL: 2.3,
    mindsetMin: 5,
    nutritionScore: 8,
    workout: false,
  })

  /* Curate the current week (Mon..Sat) into a believable, varied "week in the
   * life" so each day tells its own story and the dashboard gauge + colour-coded
   * breakdown show a real mix: steps strong (green), sleep & nutrition mixed
   * (amber), water the weak spot (red). */
  const weekHabit: Record<string, Partial<HabitDay>> = {
    [dayKey(6)]: { steps: 13200, sleepH: 7.4, waterL: 2.2, mindsetMin: 12, nutritionScore: 8, workout: true }, // Mon, strong start
    [dayKey(5)]: { steps: 10800, sleepH: 7.6, waterL: 1.8, mindsetMin: 8, nutritionScore: 7, workout: true }, // Tue, solid
    [dayKey(4)]: { steps: 4800, sleepH: 5.5, waterL: 0.8, mindsetMin: 0, nutritionScore: 4, workout: false }, // Wed, rough day off
    [dayKey(3)]: { steps: 7200, sleepH: 5.2, waterL: 1.0, mindsetMin: 5, nutritionScore: 5, workout: true }, // Thu, trained on poor sleep
    [dayKey(2)]: { steps: 11500, sleepH: 6.2, waterL: 1.3, mindsetMin: 6, nutritionScore: 6, workout: true }, // Fri, busy but active
    [dayKey(1)]: { steps: 9000, sleepH: 7.2, waterL: 1.6, mindsetMin: 10, nutritionScore: 8, workout: true }, // Sat, football day
  }
  for (let j = 0; j < habits.length; j++) {
    const ov = weekHabit[habits[j].dateKey]
    if (ov) habits[j] = { ...habits[j], ...ov }
  }

  /* A couple of self-logged activities this week (cross-training the app didn't
   * prescribe). The Saturday football is flagged as a regular weekly activity. */
  const activities: LoggedActivity[] = [
    { id: 'act-seed-foot', dateKey: dayKey(1), type: 'football', name: 'Football', icon: 'football', minutes: 60, intensity: 'hard', calories: 540, weekly: true, time: '4:30 PM' },
    { id: 'act-seed-swim', dateKey: dayKey(3), type: 'swim', name: 'Swim', icon: 'swim', minutes: 30, intensity: 'moderate', calories: 270, weekly: false, time: '8:10 AM' },
  ]

  /* -------- a starter weekly meal plan -------- */
  const mealPlan: PlannedMeal[] = [
    { id: 'pm-1', day: 'Mon', slot: 'Breakfast', name: 'Protein Overnight Oats' },
    { id: 'pm-2', day: 'Mon', slot: 'Lunch', name: 'Chicken, Rice & Frozen Veg' },
    { id: 'pm-3', day: 'Tue', slot: 'Dinner', name: 'Tuna Pasta' },
    { id: 'pm-4', day: 'Thu', slot: 'Lunch', name: 'Chicken & Hummus Wrap' },
  ]

  /* -------- seeded comments on the feed -------- */
  const postComments: PostComment[] = [
    { id: 'cm-s1', postId: 'post-1', author: 'Jayden K.', text: 'Huge, congrats! That bench is flying up.', time: '1h ago' },
    { id: 'cm-s2', postId: 'post-1', author: 'Sophie L.', text: 'Beast mode 💪 see you Friday?', time: '45m ago' },
    { id: 'cm-s3', postId: 'post-3', author: 'Mia R.', text: 'Recipe please 🙏', time: '20h ago' },
  ]

  /* -------- sessions -------- */
  const sessions: WorkoutSession[] = []
  for (let i = 0; i < DAYS - 1; i++) {
    if (breakDays.has(i)) continue // missed-training days
    const s = buildSession(rng, i, true)
    if (s) sessions.push(s)
  }
  // today's session, partial (first 3 exercises done) so "Today's Progress" is live
  const todaySession = buildSession(rng, DAYS - 1, false)
  if (todaySession) {
    todaySession.id = 's-today'
    todaySession.dateKey = todayKey
    todaySession.exercises.forEach((ex, idx) => {
      if (idx < 3) ex.sets = ex.sets.map((s) => ({ ...s, done: true }))
    })
    todaySession.completed = false
    sessions.push(todaySession)
  }

  /* -------- meals -------- */
  const meals: LoggedMeal[] = []
  for (let i = 0; i < DAYS - 1; i++) meals.push(...buildMeals(rng, i))
  meals.push(...todaysMeals())

  /* -------- posts (campus scoped) -------- */
  const posts: Post[] = [
    { id: 'post-1', authorId: 'you', author: 'Alex M.', dateKey: dayKey(0), time: '2h ago', text: 'New bench best today. 92.5kg for 3, and it finally felt light. Forty days of just turning up.', image: img.postPR, likes: 24, comments: 8, liked: false, bookmarked: false, kudos: 16, gaveKudos: false, pr: { lift: 'Bench Press', weight: '92.5kg' }, scope: 'campus' },
    { id: 'post-2', authorId: 'sophie', author: 'Sophie L.', dateKey: dayKey(0), time: '5h ago', text: 'Finished week 3 of the strength challenge. Halfway and still showing up.', ring: 75, ringLabel: 'WEEK 3 PROGRESS', likes: 18, comments: 6, liked: true, bookmarked: false, kudos: 9, scope: 'campus' },
    { id: 'post-3', authorId: 'jayden', author: 'Jayden K.', dateKey: dayKey(1), time: '1d ago', text: 'Sunday meal prep done. Chicken, rice and veg for the week, stayed under 25 dollars total.', image: img.mealPrep, likes: 21, comments: 11, liked: false, bookmarked: true, kudos: 7, scope: 'campus' },
    { id: 'post-4', authorId: 'mia', author: 'Mia R.', dateKey: dayKey(2), time: '2d ago', text: 'Leg day hits different during exam week. Kept it short and still got it done.', likes: 32, comments: 14, liked: false, bookmarked: false, kudos: 11, scope: 'campus' },
  ]

  /* -------- leaderboard (campus + cohort) -------- */
  const leaderboard: LeaderUser[] = [
    { id: 'jayden', name: 'Jayden K.', university: 'State University', dorm: 'West Hall', society: 'Lifting Society', level: 'intermediate', points: 4120, workouts: 34, streak: 22, friend: true },
    { id: 'sophie', name: 'Sophie L.', university: 'State University', dorm: 'East Hall', society: 'Run Club', level: 'beginner', points: 3980, workouts: 31, streak: 19, friend: true },
    { id: 'mia', name: 'Mia R.', university: 'State University', dorm: 'West Hall', society: 'Climbing Society', level: 'beginner', points: 3760, workouts: 30, streak: 16, friend: true },
    { id: 'you', name: 'Alex M. (You)', university: 'State University', dorm: 'West Hall', society: 'Lifting Society', level: 'intermediate', points: 3640, workouts: 30, streak: 14, isYou: true, friend: false },
    { id: 'dan', name: 'Dan P.', university: 'State University', dorm: 'North Court', society: 'Football', level: 'intermediate', points: 3410, workouts: 28, streak: 9, friend: true },
    { id: 'leo', name: 'Leo T.', university: 'State University', dorm: 'West Hall', society: 'Lifting Society', level: 'beginner', points: 3180, workouts: 26, streak: 12, friend: true },
    { id: 'ana', name: 'Ana V.', university: 'State University', dorm: 'East Hall', society: 'Run Club', level: 'beginner', points: 2950, workouts: 24, streak: 7, friend: false },
    { id: 'sam', name: 'Sam W.', university: 'State University', dorm: 'Riverside', society: 'Football', level: 'beginner', points: 2610, workouts: 22, streak: 5, friend: true },
  ]

  /* -------- challenges (belonging scoped) -------- */
  const challenges: Challenge[] = [
    { id: 'c-strength', title: '10 Week Strength Challenge', weeks: 10, totalWeeks: 10, currentWeek: 3, participants: 342, joined: true, progressPct: 30, rank: 14, scope: 'campus' },
    { id: 'c-dorm', title: 'Hall Wars: Weekly Sessions', weeks: 2, totalWeeks: 2, currentWeek: 1, participants: 210, joined: true, progressPct: 58, scope: 'dorm', vsLabel: 'West Hall vs East Hall', yourSide: 'West Hall', yourSidePct: 58, rivalSide: 'East Hall', rivalSidePct: 42 },
    { id: 'c-society', title: 'Lifting Society Volume Cup', weeks: 4, totalWeeks: 4, currentWeek: 2, participants: 64, joined: false, progressPct: 0, scope: 'society', vsLabel: 'Lifting Society vs Run Club', yourSide: 'Lifting Society', yourSidePct: 51, rivalSide: 'Run Club', rivalSidePct: 49 },
    { id: 'c-steps', title: '30 Day Step Streak', weeks: 30, totalWeeks: 30, currentWeek: 0, participants: 218, joined: false, progressPct: 0, scope: 'global' },
    { id: 'c-shred', title: 'Summer Shred', weeks: 8, totalWeeks: 8, currentWeek: 0, participants: 540, joined: false, progressPct: 0, scope: 'global' },
  ]

  /* -------- coach thread (seeded history) -------- */
  const coachThread: CoachMessage[] = [
    { id: 'ct-1', dateKey: dayKey(1), kind: 'qa', title: 'How many days should I train?', body: 'You asked about frequency. For where you are, three to five days a week is the sweet spot. More only helps if your sleep and food keep up.' },
    { id: 'ct-2', dateKey: dayKey(3), kind: 'celebration', title: 'Two clean weeks', body: 'You strung together two consistent weeks. That is the habit setting in. Keep the weights where they are and let it compound.' },
    { id: 'ct-3', dateKey: dayKey(5), kind: 'checkin', title: 'Recovery signal', body: 'Sleep dipped midweek and your squats felt heavy. Not a problem, just a signal. An earlier night tonight will pay off tomorrow.' },
  ]

  /* -------- badges -------- */
  const badges: Badge[] = [
    { id: 'b-first', name: 'First Rep', desc: 'Complete your first workout', icon: 'dumbbell', earned: true, earnedDateKey: dayKey(39) },
    { id: 'b-10w', name: 'Getting Serious', desc: 'Complete 10 workouts', icon: 'flame', earned: true, earnedDateKey: dayKey(26) },
    { id: 'b-25w', name: 'Iron Habit', desc: 'Complete 25 workouts', icon: 'trending', earned: true, earnedDateKey: dayKey(6) },
    { id: 'b-streak7', name: 'Week Warrior', desc: '7-day streak', icon: 'flame', earned: true, earnedDateKey: dayKey(21) },
    { id: 'b-streak14', name: 'Locked In', desc: '14-day streak', icon: 'flame', earned: true, earnedDateKey: dayKey(0) },
    { id: 'b-pr', name: 'New PR', desc: 'Hit a personal record', icon: 'trending', earned: true, earnedDateKey: dayKey(0) },
    { id: 'b-hydration', name: 'Hydrated', desc: '7 days hitting your water goal', icon: 'droplet', earned: true, earnedDateKey: dayKey(3) },
    { id: 'b-protein', name: 'Protein Pro', desc: 'Hit protein goal 10 days', icon: 'utensils', earned: false },
    { id: 'b-streak30', name: 'Unstoppable', desc: '30-day streak', icon: 'flame', earned: false },
    { id: 'b-50w', name: 'Half Century', desc: 'Complete 50 workouts', icon: 'dumbbell', earned: false },
  ]

  /* -------- notifications -------- */
  const notifications: AppNotification[] = [
    { id: 'n-1', type: 'streak', title: 'Keep your streak alive', body: "You're on a 14 day streak. Logging today keeps it going.", dateKey: todayKey, time: '8:02 AM', read: false },
    { id: 'n-2', type: 'social', title: 'Sophie gave you kudos', body: 'On your bench PR. Three people from West Hall cheered it.', dateKey: todayKey, time: '7:41 AM', read: false },
    { id: 'n-3', type: 'challenge', title: 'Hall Wars update', body: 'West Hall leads East Hall 58 to 42 this week. Your session counts.', dateKey: dayKey(0), time: 'Yesterday', read: false },
    { id: 'n-4', type: 'workout', title: 'Push day is ready', body: "Today: chest, shoulders and triceps. Your coach set the weights.", dateKey: todayKey, time: '6:30 AM', read: true },
    { id: 'n-5', type: 'system', title: 'Badge unlocked: Locked In', body: 'You earned the 14 day streak badge.', dateKey: dayKey(0), time: 'Yesterday', read: true },
  ]

  /* -------- events / groups -------- */
  const events: CommunityEvent[] = [
    { id: 'e-1', title: 'Live Form Check Q&A', when: 'Today · 7:00 PM', host: 'Coach Mia', going: 64, rsvp: true },
    { id: 'e-2', title: 'Group Long Run', when: 'Sat · 8:00 AM', host: 'Run Club', going: 22, rsvp: false },
    { id: 'e-3', title: 'Nutrition Workshop', when: 'Sun · 5:00 PM', host: 'Coach Dan', going: 88, rsvp: false },
    { id: 'e-4', title: 'Exam De-Stress Yoga', when: 'Mon · 6:00 PM', host: 'Wellness Soc', going: 41, rsvp: false },
  ]
  const groups: Group[] = [
    { id: 'g-1', icon: 'dumbbell', name: 'Beginner Lifters', members: 128, desc: 'Share tips, ask questions, build confidence.', unread: 12, color: '#7ED957', joined: true },
    { id: 'g-2', icon: 'utensils', name: 'Nutrition & Recipes', members: 96, desc: 'Healthy recipes, meal prep, tips & more.', unread: 8, color: '#8B5CF6', joined: true },
    { id: 'g-3', icon: 'brain', name: 'Mindset & Motivation', members: 74, desc: 'Stay motivated and level up mentally.', unread: 5, color: '#3B82F6', joined: false },
    { id: 'g-4', icon: 'leaf', name: 'Campus Runners', members: 53, desc: 'Group runs around campus every week.', unread: 0, color: '#F5A524', joined: false },
  ]

  /* -------- progress photos (seeded placeholders) -------- */
  const photos: ProgressPhoto[] = [
    { id: 'ph-1', dateKey: dayKey(39), dataUrl: photoDataUrl('Day 1', 150), note: 'Starting out, 74.6 kg' },
    { id: 'ph-2', dateKey: dayKey(19), dataUrl: photoDataUrl('Day 20', 150), note: 'Halfway, 73.0 kg' },
    { id: 'ph-3', dateKey: dayKey(0), dataUrl: photoDataUrl('Day 40', 150), note: 'Today, 72.4 kg, leaner & stronger' },
  ]

  return {
    profile,
    settings: { units: 'metric', theme: 'dark', notificationsEnabled: true, language: 'en', connections: {} },
    weights,
    habits,
    meals,
    foodReviews: [],
    activities,
    mealPlan,
    postComments,
    chat: [
      {
        id: 'chat-welcome',
        role: 'coach',
        text: `Hi ${profile.name}, I'm your coach 👋 Message me anytime about how a session felt, an exercise you'd like to change, a niggle, or staying on track. What's on your mind?`,
        dateKey: todayKey,
        time: '9:00 AM',
        read: true,
      },
    ],
    foods: FOODS,
    sessions,
    program: PROGRAM,
    posts,
    leaderboard,
    challenges,
    badges,
    notifications,
    events,
    groups,
    photos,
    partners: PARTNER_CANDIDATES,
    coachThread,
    beginnerProgress: [],
    v: SCHEMA_VERSION,
  }
}

/** A fresh (non-onboarded) state for first-time users who skip the demo. */
export function emptyState(): AppState {
  const s = buildSeed()
  return {
    ...s,
    profile: { ...s.profile, onboarded: false },
    weights: [],
    habits: [],
    meals: [],
    foodReviews: [],
    activities: [],
    mealPlan: [],
    postComments: [],
    sessions: [],
    photos: [],
    posts: s.posts.filter((p) => p.authorId !== 'you'),
    notifications: [],
    coachThread: [],
    beginnerProgress: [],
    badges: s.badges.map((b) => ({ ...b, earned: false, earnedDateKey: undefined })),
  }
}

/* re-export catalog refs commonly used alongside seed data */
export { EXERCISES, FOODS, PROGRAM }
