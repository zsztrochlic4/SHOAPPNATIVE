import type {
  BeginnerLesson,
  BudgetMeal,
  ExerciseDef,
  FoodItem,
  Goal,
  PartnerCandidate,
  ProgramDay,
  QuickWorkout,
} from '../store/types'
import { BUDGET_MEALS_SEED } from './recipes.generated'
import { QUICK_WORKOUTS_SEED } from './quickWorkouts.generated'

/* Pexels imagery */
export const img = {
  heroWorkout: 'https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?auto=compress&cs=tinysrgb&w=800',
  pushDay: 'https://images.pexels.com/photos/3837781/pexels-photo-3837781.jpeg?auto=compress&cs=tinysrgb&w=800',
  pullDay: 'https://images.pexels.com/photos/4162578/pexels-photo-4162578.jpeg?auto=compress&cs=tinysrgb&w=800',
  legDay: 'https://images.pexels.com/photos/1552106/pexels-photo-1552106.jpeg?auto=compress&cs=tinysrgb&w=800',
  community: 'https://images.pexels.com/photos/841130/pexels-photo-841130.jpeg?auto=compress&cs=tinysrgb&w=800',
  mountain: 'https://images.pexels.com/photos/1761279/pexels-photo-1761279.jpeg?auto=compress&cs=tinysrgb&w=800',
  oats: 'https://images.pexels.com/photos/704971/pexels-photo-704971.jpeg?auto=compress&cs=tinysrgb&w=200',
  chicken: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=200',
  yogurt: 'https://images.pexels.com/photos/1099680/pexels-photo-1099680.jpeg?auto=compress&cs=tinysrgb&w=200',
  salmon: 'https://images.pexels.com/photos/3763847/pexels-photo-3763847.jpeg?auto=compress&cs=tinysrgb&w=200',
  bench: 'https://images.pexels.com/photos/3837781/pexels-photo-3837781.jpeg?auto=compress&cs=tinysrgb&w=200',
  incline: 'https://images.pexels.com/photos/4162491/pexels-photo-4162491.jpeg?auto=compress&cs=tinysrgb&w=200',
  shoulder: 'https://images.pexels.com/photos/4162538/pexels-photo-4162538.jpeg?auto=compress&cs=tinysrgb&w=200',
  cable: 'https://images.pexels.com/photos/4162464/pexels-photo-4162464.jpeg?auto=compress&cs=tinysrgb&w=200',
  tricep: 'https://images.pexels.com/photos/4162439/pexels-photo-4162439.jpeg?auto=compress&cs=tinysrgb&w=200',
  squat: 'https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?auto=compress&cs=tinysrgb&w=200',
  deadlift: 'https://images.pexels.com/photos/1552106/pexels-photo-1552106.jpeg?auto=compress&cs=tinysrgb&w=200',
  row: 'https://images.pexels.com/photos/4162490/pexels-photo-4162490.jpeg?auto=compress&cs=tinysrgb&w=200',
  curl: 'https://images.pexels.com/photos/4162487/pexels-photo-4162487.jpeg?auto=compress&cs=tinysrgb&w=200',
  legpress: 'https://images.pexels.com/photos/4162542/pexels-photo-4162542.jpeg?auto=compress&cs=tinysrgb&w=200',
  mealPrep: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
  postPR: 'https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?auto=compress&cs=tinysrgb&w=400',
  rice: 'https://images.pexels.com/photos/723198/pexels-photo-723198.jpeg?auto=compress&cs=tinysrgb&w=200',
  eggs: 'https://images.pexels.com/photos/824635/pexels-photo-824635.jpeg?auto=compress&cs=tinysrgb&w=200',
}

/* --------------------------- Exercises --------------------------- */
export const EXERCISES: ExerciseDef[] = [
  { id: 'bench', name: 'Barbell Bench Press', muscle: 'Chest', equipment: ['full-gym'], image: img.bench, bodyweightAlt: 'Push-Ups' },
  { id: 'incline', name: 'Incline Dumbbell Press', muscle: 'Chest', equipment: ['full-gym', 'home-basic'], image: img.incline, bodyweightAlt: 'Decline Push-Ups' },
  { id: 'shoulder', name: 'Dumbbell Shoulder Press', muscle: 'Shoulders', equipment: ['full-gym', 'home-basic'], image: img.shoulder, bodyweightAlt: 'Pike Push-Ups' },
  { id: 'cablefly', name: 'Cable Fly', muscle: 'Chest', equipment: ['full-gym'], image: img.cable, bodyweightAlt: 'Band Fly' },
  { id: 'tricep', name: 'Rope Tricep Pushdown', muscle: 'Triceps', equipment: ['full-gym'], image: img.tricep, bodyweightAlt: 'Bench Dips' },
  { id: 'squat', name: 'Barbell Back Squat', muscle: 'Legs', equipment: ['full-gym'], image: img.squat, bodyweightAlt: 'Bulgarian Split Squat' },
  { id: 'deadlift', name: 'Deadlift', muscle: 'Back', equipment: ['full-gym'], image: img.deadlift, bodyweightAlt: 'Single-Leg RDL' },
  { id: 'pulldown', name: 'Lat Pulldown', muscle: 'Back', equipment: ['full-gym'], image: img.row, bodyweightAlt: 'Pull-Ups' },
  { id: 'row', name: 'Seated Cable Row', muscle: 'Back', equipment: ['full-gym'], image: img.row, bodyweightAlt: 'Inverted Row' },
  { id: 'curl', name: 'Dumbbell Bicep Curl', muscle: 'Biceps', equipment: ['full-gym', 'home-basic'], image: img.curl, bodyweightAlt: 'Band Curl' },
  { id: 'ohp', name: 'Overhead Press', muscle: 'Shoulders', equipment: ['full-gym'], image: img.shoulder, bodyweightAlt: 'Pike Push-Ups' },
  { id: 'legpress', name: 'Leg Press', muscle: 'Legs', equipment: ['full-gym'], image: img.legpress, bodyweightAlt: 'Jump Squats' },
  { id: 'rdl', name: 'Romanian Deadlift', muscle: 'Hamstrings', equipment: ['full-gym', 'home-basic'], image: img.deadlift, bodyweightAlt: 'Single-Leg RDL' },
  { id: 'lateral', name: 'Lateral Raise', muscle: 'Shoulders', equipment: ['full-gym', 'home-basic'], image: img.shoulder, bodyweightAlt: 'Band Lateral Raise' },
]

export const exById = (id: string) => EXERCISES.find((e) => e.id === id)

/* ---------------------- Technique cue cards ---------------------- */
/* Short, plain-language coaching for nervous beginners. */
export interface ExerciseDetail {
  /** One-line plain-language summary of what the movement is and trains. */
  desc: string
  cues: string[]
  commonMistake: string
  ifTaken: string
  beginnerFriendly: boolean
  /** Optional looping form clip. Drop a hosted url here and it plays in place of the poster slot. */
  video?: string
}

export const EXERCISE_DETAIL: Record<string, ExerciseDetail> = {
  bench: {
    desc: 'A barbell press from your chest that builds the chest, front shoulders and triceps.',
    cues: ['Plant your feet and squeeze the bar tight', 'Lower to mid chest, elbows tucked a little', 'Press up and slightly back toward your face'],
    commonMistake: 'Flaring elbows straight out to the sides, which stresses the shoulders.',
    ifTaken: 'No free bench? Use a dumbbell press on any flat bench, or push ups as a clean stand in.',
    beginnerFriendly: false,
  },
  incline: {
    desc: 'An angled dumbbell press that biases the upper chest.',
    cues: ['Set the bench to a low incline, around 30 degrees', 'Press the dumbbells up and slightly together', 'Control the way down, no bouncing'],
    commonMistake: 'Setting the incline too steep and turning it into a shoulder press.',
    ifTaken: 'Any adjustable bench works. If all are busy, do incline push ups with hands on a bench.',
    beginnerFriendly: true,
  },
  shoulder: {
    desc: 'A seated overhead press that builds round, strong shoulders.',
    cues: ['Start with dumbbells at ear height', 'Press up without shrugging', 'Stop just short of locking out'],
    commonMistake: 'Leaning back and turning it into an incline press.',
    ifTaken: 'Pike push ups against a wall hit the same muscles with no equipment.',
    beginnerFriendly: true,
  },
  cablefly: {
    desc: 'A cable isolation move that stretches and squeezes the chest.',
    cues: ['Soft bend in the elbows, hold it the whole set', 'Bring your hands together in front of your chest', 'Feel the stretch, then squeeze'],
    commonMistake: 'Bending the elbows more as you pull, which turns it into a press.',
    ifTaken: 'A resistance band anchored behind you does the same job.',
    beginnerFriendly: true,
  },
  tricep: {
    desc: 'A cable push-down that isolates and grows the triceps.',
    cues: ['Keep elbows pinned to your sides', 'Push the rope down and slightly apart at the bottom', 'Control it back to chest height'],
    commonMistake: 'Letting the elbows drift forward so the shoulders take over.',
    ifTaken: 'Bench dips with your hands behind you work well anywhere.',
    beginnerFriendly: true,
  },
  squat: {
    desc: 'A loaded full-depth squat driven by the quads and glutes.',
    cues: ['Brace your core before you go down', 'Sit between your hips, knees track over toes', 'Drive up through mid foot'],
    commonMistake: 'Letting the heels lift or the knees cave inward.',
    ifTaken: 'Goblet squats with one dumbbell, or bodyweight squats, are a great swap.',
    beginnerFriendly: false,
  },
  deadlift: {
    desc: 'A hinge that pulls the bar from the floor and trains the whole posterior chain.',
    cues: ['Bar over mid foot, shins almost touching', 'Flat back, take the slack out of the bar', 'Stand up tall, push the floor away'],
    commonMistake: 'Rounding the lower back or jerking the bar off the floor.',
    ifTaken: 'Romanian deadlifts with dumbbells let you train the same pattern lighter.',
    beginnerFriendly: false,
  },
  pulldown: {
    desc: 'A vertical pull that builds a wider, stronger back.',
    cues: ['Set the thigh pad so you stay seated', 'Pull the bar to your upper chest', 'Lead with the elbows, not the hands'],
    commonMistake: 'Leaning way back and using momentum instead of your back.',
    ifTaken: 'Assisted pull ups or a band around a bar gives the same movement.',
    beginnerFriendly: true,
  },
  row: {
    desc: 'A horizontal pull for back thickness and better posture.',
    cues: ['Sit tall with a slight lean back', 'Pull the handle to your belly button', 'Squeeze your shoulder blades together'],
    commonMistake: 'Rounding forward and yanking with the arms only.',
    ifTaken: 'A single arm dumbbell row on a bench is an easy alternative.',
    beginnerFriendly: true,
  },
  curl: {
    desc: 'A dumbbell curl that isolates and builds the biceps.',
    cues: ['Elbows stay by your sides', 'Curl up under control', 'Lower slowly, all the way down'],
    commonMistake: 'Swinging the body to throw the weight up.',
    ifTaken: 'Any dumbbells or a band work. No swap needed.',
    beginnerFriendly: true,
  },
  ohp: {
    desc: 'A standing overhead press for shoulder and core strength.',
    cues: ['Bar on your front shoulders, core braced', 'Press up and move your head through at the top', 'Lock out with the bar over your mid foot'],
    commonMistake: 'Overarching the lower back to lean into the press.',
    ifTaken: 'Seated dumbbell press or pike push ups cover the same muscles.',
    beginnerFriendly: false,
  },
  legpress: {
    desc: 'A machine press that loads the legs heavily while keeping you supported.',
    cues: ['Feet shoulder width on the platform', 'Lower until knees reach about 90 degrees', 'Press through your whole foot, no locking hard'],
    commonMistake: 'Letting the lower back round off the pad at the bottom.',
    ifTaken: 'Goblet squats or walking lunges are a strong substitute.',
    beginnerFriendly: true,
  },
  rdl: {
    desc: 'A hip hinge that targets the hamstrings and glutes.',
    cues: ['Soft knees, push your hips back', 'Keep the weights close to your legs', 'Feel the hamstrings, stand up tall'],
    commonMistake: 'Turning it into a squat by bending the knees too much.',
    ifTaken: 'Dumbbells or a single barbell both work. Pick whatever is free.',
    beginnerFriendly: true,
  },
  lateral: {
    desc: 'A raise that builds the side delts for shoulder width.',
    cues: ['Tiny bend in the elbows', 'Lead with your elbows out to the sides', 'Stop at shoulder height, lower slowly'],
    commonMistake: 'Going too heavy and shrugging the weight up.',
    ifTaken: 'A band under your feet gives smooth resistance with no dumbbells.',
    beginnerFriendly: true,
  },
}

export const exerciseDetail = (id: string): ExerciseDetail =>
  EXERCISE_DETAIL[id] ?? {
    desc: 'A strength movement. Move with control through a full range of motion.',
    cues: ['Move under control', 'Full range of motion', 'Breathe out on the effort'],
    commonMistake: 'Rushing the reps instead of staying controlled.',
    ifTaken: 'Pick a similar machine or a dumbbell variation that is free.',
    beginnerFriendly: true,
  }

/* -------- "Why this helps your goal": keeps every exercise purposeful -------- */
/* A noun-phrase describing what each lift develops, slotted into a goal-aware
 * sentence so the user always sees how a movement serves their bigger goal. */
const EXERCISE_ROLE: Record<string, string> = {
  bench: 'your chest, front shoulders and pressing strength',
  incline: 'your upper chest',
  shoulder: 'your shoulders and overhead pressing strength',
  cablefly: 'chest size with a deep stretch and squeeze',
  tricep: 'your triceps, so your presses lock out stronger',
  squat: 'your quads, glutes and total-body strength',
  deadlift: 'your back, glutes and hamstrings',
  pulldown: 'a wider back and stronger pulling strength',
  row: 'back thickness and upright posture',
  curl: 'your biceps',
  ohp: 'your shoulders and bracing core',
  legpress: 'your legs with heavy, low-skill loading',
  rdl: 'your hamstrings and glutes',
  lateral: 'your side delts and shoulder width',
}

const COMPOUND_IDS = ['bench', 'incline', 'shoulder', 'squat', 'deadlift', 'pulldown', 'row', 'ohp', 'legpress', 'rdl']

/** One sentence: how this exercise moves the user toward their overall goal. */
export function exerciseWhy(defId: string, goal: Goal): string {
  const role = EXERCISE_ROLE[defId] ?? 'strength across this movement'
  const compound = COMPOUND_IDS.includes(defId)
  switch (goal) {
    case 'build-muscle':
      return `Builds ${role}: direct, visible muscle for your goal.`
    case 'lose-fat':
      return compound
        ? `Works ${role} and burns serious energy, protecting muscle while you lose fat.`
        : `Keeps ${role} firm and defined as you lean down.`
    case 'gain-strength':
      return compound
        ? `A core strength lift. Driving up ${role} pushes your whole strength goal forward.`
        : `Strengthens ${role} to support your heavier compound lifts.`
    case 'stay-healthy':
    default:
      return `Strengthens ${role}, keeping you capable and resilient day to day.`
  }
}

/** A few words on what today's whole session is for, tied to the user's goal. */
export function workoutGoalLine(name: string, focus: string, goal: Goal): string {
  const muscles = focus.replace(/\s*·\s*/g, ', ').toLowerCase()
  const aim: Record<Goal, string> = {
    'build-muscle': 'building visible muscle',
    'lose-fat': 'losing fat while holding on to muscle',
    'gain-strength': 'getting noticeably stronger',
    'stay-healthy': 'staying strong and healthy',
  }
  return `${name} trains ${muscles}. Done well, every set here moves you closer to ${aim[goal]}.`
}

/* --------------- Self-logged activity presets ------------------- */
/* Common activities with a rough kcal/min (at moderate effort). The user can
 * also log any custom activity, so this list is a convenience, not a limit. */
export const ACTIVITY_PRESETS: { key: string; name: string; kcalPerMin: number }[] = [
  { key: 'run', name: 'Run', kcalPerMin: 11 },
  { key: 'walk', name: 'Walk', kcalPerMin: 4 },
  { key: 'cycle', name: 'Cycling', kcalPerMin: 8 },
  { key: 'swim', name: 'Swim', kcalPerMin: 9 },
  { key: 'football', name: 'Football', kcalPerMin: 9 },
  { key: 'basketball', name: 'Basketball', kcalPerMin: 8 },
  { key: 'tennis', name: 'Tennis', kcalPerMin: 7 },
  { key: 'pickleball', name: 'Pickleball', kcalPerMin: 6 },
  { key: 'climb', name: 'Climbing', kcalPerMin: 9 },
  { key: 'hike', name: 'Hike', kcalPerMin: 6 },
  { key: 'row', name: 'Rowing', kcalPerMin: 10 },
  { key: 'hiit', name: 'HIIT', kcalPerMin: 12 },
  { key: 'yoga', name: 'Yoga', kcalPerMin: 3 },
  { key: 'dance', name: 'Dance', kcalPerMin: 7 },
  { key: 'boxing', name: 'Boxing', kcalPerMin: 10 },
  { key: 'other', name: 'Other', kcalPerMin: 7 },
]
export const activityPreset = (key: string) => ACTIVITY_PRESETS.find((a) => a.key === key)
export const INTENSITY_MULT: Record<'easy' | 'moderate' | 'hard', number> = { easy: 0.8, moderate: 1, hard: 1.25 }

/* Plate increments for adaptive progression (kg) */
export const INCREMENT: Record<string, number> = {
  bench: 2.5, squat: 5, deadlift: 5, ohp: 2.5, row: 2.5, pulldown: 2.5, legpress: 5, rdl: 2.5,
  incline: 2, shoulder: 2, cablefly: 1.25, tricep: 2.5, curl: 1.25, lateral: 1.25,
}
export const incrementFor = (id: string) => INCREMENT[id] ?? 2.5

/* --------------------- Program (PPL split) ----------------------- */
export const PROGRAM: ProgramDay[] = [
  { id: 'p-push', day: 'Mon', name: 'Push Day', focus: 'Chest · Shoulders · Triceps', exerciseIds: ['bench', 'incline', 'shoulder', 'cablefly', 'tricep'] },
  { id: 'p-pull', day: 'Tue', name: 'Pull Day', focus: 'Back · Biceps', exerciseIds: ['deadlift', 'pulldown', 'row', 'curl'] },
  { id: 'p-legs', day: 'Wed', name: 'Leg Day', focus: 'Quads · Hamstrings · Glutes', exerciseIds: ['squat', 'legpress', 'rdl'] },
  { id: 'p-rest', day: 'Thu', name: 'Rest / Mobility', focus: 'Active recovery', rest: true, exerciseIds: [] },
  { id: 'p-upper', day: 'Fri', name: 'Upper Body', focus: 'Strength focus', exerciseIds: ['bench', 'ohp', 'row', 'lateral', 'curl'] },
  { id: 'p-lower', day: 'Sat', name: 'Lower Body', focus: 'Hypertrophy', exerciseIds: ['squat', 'rdl', 'legpress'] },
]

/* The rotating session order used to generate history */
export const SPLIT_ROTATION = ['p-push', 'p-pull', 'p-legs', 'p-rest', 'p-upper', 'p-lower', 'p-rest']

/* Baseline working weights (kg) at day 1, for progressive overload sim */
export const BASE_WEIGHTS: Record<string, number> = {
  bench: 70, incline: 20, shoulder: 18, cablefly: 13, tricep: 27,
  squat: 95, deadlift: 120, pulldown: 50, row: 45, curl: 12,
  ohp: 45, legpress: 140, rdl: 70, lateral: 8,
}

export const REP_TARGETS: Record<string, string> = {
  bench: '6-8', incline: '8-10', shoulder: '8-10', cablefly: '10-12', tricep: '12-15',
  squat: '5-8', deadlift: '5', pulldown: '8-12', row: '8-12', curl: '10-12',
  ohp: '6-8', legpress: '10-12', rdl: '8-10', lateral: '12-15',
}

export const SET_TARGETS: Record<string, number> = {
  bench: 4, incline: 3, shoulder: 3, cablefly: 3, tricep: 3,
  squat: 4, deadlift: 3, pulldown: 3, row: 3, curl: 3,
  ohp: 4, legpress: 3, rdl: 3, lateral: 3,
}

/* --------------------------- Foods ------------------------------- */
export const FOODS: FoodItem[] = [
  { id: 'f-oats', name: 'Oats with Protein, Berries & Banana', serving: '1 bowl', kcal: 512, p: 32, c: 68, f: 12, barcode: '5012345600012' },
  { id: 'f-chicken', name: 'Chicken, Rice & Veggies', serving: '1 plate', kcal: 645, p: 48, c: 72, f: 18, barcode: '5012345600029' },
  { id: 'f-yogurt', name: 'Greek Yogurt & Berries', serving: '1 cup', kcal: 210, p: 20, c: 15, f: 6, barcode: '5012345600036' },
  { id: 'f-salmon', name: 'Salmon, Potatoes & Green Beans', serving: '1 plate', kcal: 525, p: 42, c: 46, f: 14, barcode: '5012345600043' },
  { id: 'f-eggs', name: 'Scrambled Eggs on Toast', serving: '2 eggs + 2 toast', kcal: 340, p: 22, c: 28, f: 16, barcode: '5012345600050' },
  { id: 'f-rice', name: 'White Rice', serving: '1 cup cooked', kcal: 205, p: 4, c: 45, f: 0 },
  { id: 'f-pbsand', name: 'Peanut Butter Sandwich', serving: '1 sandwich', kcal: 380, p: 14, c: 42, f: 18 },
  { id: 'f-shake', name: 'Whey Protein Shake', serving: '1 scoop + water', kcal: 130, p: 25, c: 4, f: 2, barcode: '5012345600067' },
  { id: 'f-banana', name: 'Banana', serving: '1 medium', kcal: 105, p: 1, c: 27, f: 0 },
  { id: 'f-pasta', name: 'Pasta Bolognese', serving: '1 bowl', kcal: 560, p: 30, c: 70, f: 16 },
  { id: 'f-tuna', name: 'Tuna Pasta', serving: '1 bowl', kcal: 480, p: 38, c: 58, f: 8 },
  { id: 'f-noodles', name: 'Instant Noodles + Egg', serving: '1 pack', kcal: 420, p: 14, c: 60, f: 14 },
  { id: 'f-bagel', name: 'Bagel with Cream Cheese', serving: '1 bagel', kcal: 360, p: 12, c: 54, f: 11 },
  { id: 'f-burrito', name: 'Chicken Burrito', serving: '1 burrito', kcal: 680, p: 40, c: 72, f: 22 },
  { id: 'f-apple', name: 'Apple', serving: '1 medium', kcal: 95, p: 0, c: 25, f: 0 },
  { id: 'f-coffee', name: 'Flat White', serving: '1 cup', kcal: 120, p: 7, c: 10, f: 6 },
]

export const foodById = (id: string) => FOODS.find((f) => f.id === id)

/* ------------------------ Quick workouts ------------------------- */
/* The 8×12-minute bodyweight workouts, generated from the workout spreadsheet
 * (data/quick-workouts/8x12min.xlsx) and pre-sorted beginner → advanced. */
export const QUICK_WORKOUTS: QuickWorkout[] = QUICK_WORKOUTS_SEED

/* Universities for the leaderboard flavour */
export const UNIVERSITIES = [
  'State University',
  'City College',
  'Tech Institute',
  'Metro University',
]

export const DORMS = ['West Hall', 'East Hall', 'North Court', 'Riverside', 'Off campus']
export const SOCIETIES = ['Lifting Society', 'Run Club', 'Climbing Society', 'Football', 'None yet']
export const COHORTS = ['Class of 2026', 'Class of 2027', 'Class of 2028', 'Postgrad']

/* --------------------------- Recipes ----------------------------- */
/* Easy, tasty, budget-friendly recipes with full step-by-step method. */
export const BUDGET_MEALS: BudgetMeal[] = BUDGET_MEALS_SEED


export const budgetMealById = (id: string) => BUDGET_MEALS.find((m) => m.id === id)

/* ------------------- New to the Gym track ------------------------ */
export const BEGINNER_LESSONS: BeginnerLesson[] = [
  {
    id: 'bl-welcome',
    category: 'mindset',
    title: 'You belong here',
    summary: 'The truth about walking into a gym for the first time',
    minutes: 2,
    icon: 'leaf',
    body: [
      'Almost everyone felt nervous on their first day. The people around you are focused on their own session, not watching you.',
      'You do not need to look a certain way or lift a certain amount to be here. Showing up is the whole skill, and you already did the hard part.',
      'For your first two weeks, the only goal is to feel comfortable in the room. Strength follows comfort.',
    ],
  },
  {
    id: 'bl-tour',
    category: 'machine',
    title: 'What the main machines do',
    summary: 'A plain tour of the kit you will actually use',
    minutes: 3,
    icon: 'dumbbell',
    body: [
      'Cable machines have a stack of weights and a pin. Move the pin down for heavier, up for lighter.',
      'The lat pulldown trains your back. The leg press trains your legs while seated and supported.',
      'Dumbbells live on the rack in pairs. Take two, use them, and put them back where you found them.',
      'If a machine looks confusing, there is usually a small diagram on the side showing how to use it.',
    ],
  },
  {
    id: 'bl-dayone',
    category: 'gym',
    title: 'Your day one script',
    summary: 'Exactly what to do the first time you go',
    minutes: 3,
    icon: 'clock',
    body: [
      'Arrive, find a quiet corner, and warm up with five minutes of easy walking or cycling.',
      'Do three simple machines for two sets each. Pick a weight you can move for ten smooth reps.',
      'Rest as long as you need between sets. There is no rush.',
      'Leave after about thirty minutes. A short, calm first session you want to repeat beats a long one that scares you off.',
    ],
  },
  {
    id: 'bl-app',
    category: 'app',
    title: 'How to use this app',
    summary: 'Logging a set in ten seconds',
    minutes: 2,
    icon: 'trending',
    body: [
      'Open Workout, then Start Workout. Each exercise shows the weight and reps to aim for.',
      'After a set, type what you actually did and tap the circle to tick it off. The rest timer starts on its own.',
      'Next time, your coach reads what you logged and suggests the next weight. You can always change it.',
      'That is the whole loop. Log honestly and the app does the thinking for you.',
    ],
  },
  {
    id: 'bl-etiquette',
    category: 'gym',
    title: 'Unwritten gym rules',
    summary: 'Fit in without anyone telling you off',
    minutes: 2,
    icon: 'leaf',
    body: [
      'Wipe down a bench or machine when you finish with it.',
      'Put weights back on the rack. It is the fastest way to look like you belong.',
      'You can share equipment between sets. A simple "mind if I work in?" is normal and welcome.',
      'Headphones in is a fine way to keep to yourself. Most people do exactly that.',
    ],
  },
  {
    id: 'bl-month',
    category: 'mindset',
    title: 'What a normal first month looks like',
    summary: 'Realistic expectations so you do not quit',
    minutes: 2,
    icon: 'flame',
    body: [
      'Weeks one and two can feel awkward and a little sore. That is normal and it fades.',
      'By week three the movements start to feel natural and the weights creep up on their own.',
      'You will not see big changes in the mirror yet, and that is fine. The wins right now are turning up and feeling stronger.',
      'Aim for two or three sessions a week. Consistency at a level you can sustain beats a perfect plan you drop.',
    ],
  },
]

/* ------------------ Training partner candidates ------------------ */
export const PARTNER_CANDIDATES: PartnerCandidate[] = [
  { id: 'pc-1', name: 'Tom H.', level: 'beginner', dorm: 'West Hall', society: 'Lifting Society', goal: 'build-muscle', availability: 'Evenings, Mon to Thu', blurb: 'Also pretty new. Looking for someone to learn the basics with.', matchPct: 94, connected: false },
  { id: 'pc-2', name: 'Priya S.', level: 'beginner', dorm: 'West Hall', goal: 'stay-healthy', availability: 'Mornings before lectures', blurb: 'First semester lifting. Friendly and consistent.', matchPct: 90, connected: false },
  { id: 'pc-3', name: 'Marcus D.', level: 'intermediate', dorm: 'East Hall', society: 'Football', goal: 'gain-strength', availability: 'Afternoons', blurb: 'Happy to show a newer lifter the ropes on the big lifts.', matchPct: 82, connected: false },
  { id: 'pc-4', name: 'Ella W.', level: 'beginner', dorm: 'North Court', society: 'Run Club', goal: 'lose-fat', availability: 'Weekends', blurb: 'Runner trying to add some strength work. Same starting point.', matchPct: 88, connected: false },
  { id: 'pc-5', name: 'Noah K.', level: 'beginner', dorm: 'West Hall', goal: 'build-muscle', availability: 'Evenings', blurb: 'On campus, same goal. Keen for a regular gym buddy.', matchPct: 91, connected: false },
]
