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
  { id: 'f-oats', name: 'Oats with Protein, Berries & Banana', serving: '1 bowl', kcal: 512, p: 32, c: 68, f: 12, barcode: '5012345600012', budget: true },
  { id: 'f-chicken', name: 'Chicken, Rice & Veggies', serving: '1 plate', kcal: 645, p: 48, c: 72, f: 18, barcode: '5012345600029', budget: true },
  { id: 'f-yogurt', name: 'Greek Yogurt & Berries', serving: '1 cup', kcal: 210, p: 20, c: 15, f: 6, barcode: '5012345600036' },
  { id: 'f-salmon', name: 'Salmon, Potatoes & Green Beans', serving: '1 plate', kcal: 525, p: 42, c: 46, f: 14, barcode: '5012345600043' },
  { id: 'f-eggs', name: 'Scrambled Eggs on Toast', serving: '2 eggs + 2 toast', kcal: 340, p: 22, c: 28, f: 16, barcode: '5012345600050', budget: true },
  { id: 'f-rice', name: 'White Rice', serving: '1 cup cooked', kcal: 205, p: 4, c: 45, f: 0, budget: true },
  { id: 'f-pbsand', name: 'Peanut Butter Sandwich', serving: '1 sandwich', kcal: 380, p: 14, c: 42, f: 18, budget: true },
  { id: 'f-shake', name: 'Whey Protein Shake', serving: '1 scoop + water', kcal: 130, p: 25, c: 4, f: 2, barcode: '5012345600067' },
  { id: 'f-banana', name: 'Banana', serving: '1 medium', kcal: 105, p: 1, c: 27, f: 0, budget: true },
  { id: 'f-pasta', name: 'Pasta Bolognese', serving: '1 bowl', kcal: 560, p: 30, c: 70, f: 16, budget: true },
  { id: 'f-tuna', name: 'Tuna Pasta', serving: '1 bowl', kcal: 480, p: 38, c: 58, f: 8, budget: true },
  { id: 'f-noodles', name: 'Instant Noodles + Egg', serving: '1 pack', kcal: 420, p: 14, c: 60, f: 14, budget: true },
  { id: 'f-bagel', name: 'Bagel with Cream Cheese', serving: '1 bagel', kcal: 360, p: 12, c: 54, f: 11 },
  { id: 'f-burrito', name: 'Chicken Burrito', serving: '1 burrito', kcal: 680, p: 40, c: 72, f: 22 },
  { id: 'f-apple', name: 'Apple', serving: '1 medium', kcal: 95, p: 0, c: 25, f: 0, budget: true },
  { id: 'f-coffee', name: 'Flat White', serving: '1 cup', kcal: 120, p: 7, c: 10, f: 6 },
]

export const foodById = (id: string) => FOODS.find((f) => f.id === id)

/* ------------------------ Quick workouts ------------------------- */
export const QUICK_WORKOUTS: QuickWorkout[] = [
  { id: 'q-dorm', name: 'Dorm Room Pump', minutes: 15, focus: 'Full body · no equipment', exercises: ['Push-Ups', 'Bodyweight Squats', 'Plank', 'Mountain Climbers'] },
  { id: 'q-core', name: 'Express Core', minutes: 10, focus: 'Abs · core', exercises: ['Plank', 'Leg Raises', 'Bicycle Crunches', 'Russian Twists'] },
  { id: 'q-upper', name: 'Quick Upper', minutes: 20, focus: 'Chest · back · arms', exercises: ['Push-Ups', 'Pull-Ups', 'Pike Push-Ups', 'Dips'] },
  { id: 'q-mobility', name: 'Desk Recovery', minutes: 8, focus: 'Mobility · stretch', exercises: ['Cat-Cow', 'Hip Openers', 'Shoulder Rolls', 'Hamstring Stretch'] },
]

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
export const BUDGET_MEALS: BudgetMeal[] = [
  /* ----------------------- Breakfast ----------------------- */
  {
    id: 'bm-scrambled-eggs', name: 'Scrambled Eggs on Toast', image: img.eggs,
    category: 'Breakfast', minutes: 10, serves: 1, kcal: 380, p: 22, c: 30, f: 18,
    flavour: 'Soft, buttery eggs piled on hot toast. The five-minute classic.',
    ingredients: ['3 eggs', '2 slices of bread', 'Splash of milk', 'Knob of butter', 'Salt and pepper'],
    steps: [
      'Crack the eggs into a bowl, add the milk and a pinch of salt, then whisk well.',
      'Melt the butter in a non-stick pan over medium-low heat.',
      'Pour in the eggs and let them sit for a few seconds, then gently fold with a spatula.',
      'Keep folding slowly until just set but still soft, then take off the heat.',
      'Toast the bread, butter it, and pile the eggs on top. Season and serve.',
    ],
    tags: ['High protein', '10 minutes', 'Beginner'],
  },
  {
    id: 'bm-overnight-oats', name: 'Overnight Oats', image: img.oats,
    category: 'Breakfast', minutes: 5, serves: 1, kcal: 420, p: 16, c: 62, f: 12,
    flavour: 'Mix it tonight, grab it tomorrow. Creamy oats with no cooking.',
    ingredients: ['1/2 cup rolled oats', '1/2 cup milk', '2 tbsp yogurt', '1 tbsp honey', 'Handful of berries'],
    steps: [
      'Add the oats, milk and yogurt to a jar or bowl.',
      'Stir in the honey and give it a good mix.',
      'Cover and leave in the fridge overnight.',
      'In the morning, top with berries and eat cold.',
    ],
    cookOnce: 'Make three jars at once so breakfast is sorted for half the week.',
    tags: ['No cook', 'Meal prep', '5 minutes'],
  },
  {
    id: 'bm-banana-pancakes', name: 'Banana Pancakes', image: img.oats,
    category: 'Breakfast', minutes: 15, serves: 2, kcal: 350, p: 12, c: 48, f: 11,
    flavour: 'Fluffy pancakes sweetened with ripe banana. No fancy mix needed.',
    ingredients: ['1 ripe banana', '2 eggs', '1/2 cup flour', '1/4 cup milk', '1 tsp baking powder', 'Oil for the pan'],
    steps: [
      'Mash the banana in a bowl until smooth.',
      'Whisk in the eggs, then the flour, milk and baking powder until you have a thick batter.',
      'Heat a little oil in a pan over medium heat.',
      'Pour in small rounds of batter and cook until bubbles form on top.',
      'Flip and cook the other side until golden, then serve with honey.',
    ],
    tags: ['Vegetarian', 'Weekend', '15 minutes'],
  },
  {
    id: 'bm-yogurt-bowl', name: 'Greek Yogurt Breakfast Bowl', image: img.yogurt,
    category: 'Breakfast', minutes: 5, serves: 1, kcal: 330, p: 24, c: 38, f: 9,
    flavour: 'Thick yogurt, crunchy granola and fruit. Fast and filling.',
    ingredients: ['1 cup Greek yogurt', 'Handful of granola', 'Handful of berries or chopped fruit', '1 tbsp honey'],
    steps: [
      'Spoon the yogurt into a bowl.',
      'Scatter the granola over the top.',
      'Add the fruit and drizzle with honey.',
      'Mix as you go and enjoy.',
    ],
    tags: ['High protein', 'No cook', '5 minutes'],
  },
  {
    id: 'bm-veggie-omelette', name: 'Veggie Omelette', image: img.eggs,
    category: 'Breakfast', minutes: 12, serves: 1, kcal: 360, p: 24, c: 8, f: 26,
    flavour: 'A loaded omelette that uses up whatever veg is in the fridge.',
    ingredients: ['3 eggs', 'Handful of chopped peppers and onion', 'Handful of grated cheese', 'Knob of butter', 'Salt and pepper'],
    steps: [
      'Whisk the eggs with a pinch of salt and pepper.',
      'Melt the butter in a pan and soften the chopped veg for a couple of minutes.',
      'Pour the eggs over the veg and tilt the pan so they spread out.',
      'When the base is set, scatter the cheese over one half.',
      'Fold the omelette over and slide onto a plate.',
    ],
    tags: ['High protein', 'Low carb', 'Vegetarian'],
  },
  {
    id: 'bm-pb-banana-toast', name: 'Peanut Butter Banana Toast', image: img.oats,
    category: 'Breakfast', minutes: 5, serves: 1, kcal: 340, p: 12, c: 44, f: 14,
    flavour: 'Creamy peanut butter and sweet banana on crunchy toast.',
    ingredients: ['2 slices of bread', '2 tbsp peanut butter', '1 banana', 'Sprinkle of cinnamon'],
    steps: [
      'Toast the bread.',
      'Spread the peanut butter over each slice while still warm.',
      'Slice the banana and lay it on top.',
      'Finish with a sprinkle of cinnamon.',
    ],
    tags: ['Vegetarian', 'No cook', '5 minutes'],
  },
  {
    id: 'bm-breakfast-burrito', name: 'Breakfast Burrito', image: img.eggs,
    category: 'Breakfast', minutes: 15, serves: 1, kcal: 480, p: 26, c: 44, f: 22,
    flavour: 'Eggs, cheese and beans wrapped up warm. A proper start.',
    ingredients: ['2 eggs', '1 large tortilla', 'Handful of grated cheese', '1/2 tin of beans', 'Splash of oil', 'Hot sauce (optional)'],
    steps: [
      'Scramble the eggs in a little oil until just set.',
      'Warm the beans in a small pan or the microwave.',
      'Warm the tortilla for a few seconds in a dry pan.',
      'Pile the eggs, beans and cheese down the middle of the tortilla.',
      'Add hot sauce if you like, fold in the sides and roll it up tight.',
    ],
    tags: ['High protein', 'Filling', '15 minutes'],
  },
  {
    id: 'bm-berry-porridge', name: 'Berry Porridge', image: img.oats,
    category: 'Breakfast', minutes: 8, serves: 1, kcal: 360, p: 12, c: 60, f: 8,
    flavour: 'Warm, creamy oats topped with berries. Cheap comfort in a bowl.',
    ingredients: ['1/2 cup rolled oats', '1 cup milk or water', 'Handful of berries', '1 tbsp honey', 'Pinch of salt'],
    steps: [
      'Add the oats, milk and a pinch of salt to a small pot.',
      'Cook over medium heat, stirring, for about five minutes until thick and creamy.',
      'Pour into a bowl and top with the berries.',
      'Drizzle with honey and eat warm.',
    ],
    tags: ['Vegetarian', 'Cheap', '8 minutes'],
  },
  {
    id: 'bm-bacon-egg-roll', name: 'Bacon & Egg Roll', image: img.eggs,
    category: 'Breakfast', minutes: 12, serves: 1, kcal: 520, p: 28, c: 38, f: 28,
    flavour: 'Crispy bacon and a fried egg in a soft roll. The weekend treat.',
    ingredients: ['2 rashers of bacon', '1 egg', '1 bread roll', 'Butter', 'Sauce of choice'],
    steps: [
      'Fry the bacon in a pan until crisp, then set aside.',
      'Crack the egg into the same pan and fry to your liking.',
      'Slice the roll and butter both sides.',
      'Layer in the bacon and egg, add your sauce and close it up.',
    ],
    tags: ['Weekend', 'Filling', '12 minutes'],
  },
  {
    id: 'bm-berry-smoothie', name: 'Berry Banana Smoothie', image: img.yogurt,
    category: 'Breakfast', minutes: 5, serves: 1, kcal: 300, p: 18, c: 48, f: 5,
    flavour: 'A thick, fruity smoothie you can drink on the way out the door.',
    ingredients: ['1 banana', 'Handful of frozen berries', '1 cup milk', '2 tbsp yogurt', '1 tbsp honey (optional)'],
    steps: [
      'Add the banana, berries, milk and yogurt to a blender.',
      'Blend until smooth.',
      'Taste and add honey if you want it sweeter.',
      'Pour into a glass and drink straight away.',
    ],
    tags: ['No cook', 'On the go', '5 minutes'],
  },

  /* ------------------------- Lunch ------------------------- */
  {
    id: 'bm-tuna-sandwich', name: 'Tuna Mayo Sandwich', image: img.salmon,
    category: 'Lunch', minutes: 7, serves: 1, kcal: 420, p: 30, c: 40, f: 16,
    flavour: 'Creamy tuna with a bit of crunch. The reliable lunchbox filler.',
    ingredients: ['1 tin of tuna', '2 tbsp mayo', '2 slices of bread', 'Handful of sweetcorn', 'Squeeze of lemon', 'Salt and pepper'],
    steps: [
      'Drain the tuna and tip it into a bowl.',
      'Mix in the mayo, sweetcorn, lemon, salt and pepper.',
      'Spread the mix over one slice of bread.',
      'Top with the second slice, press down and cut in half.',
    ],
    tags: ['High protein', 'No cook', 'Lunchbox'],
  },
  {
    id: 'bm-chicken-caesar-wrap', name: 'Chicken Caesar Wrap', image: img.chicken,
    category: 'Lunch', minutes: 10, serves: 1, kcal: 480, p: 36, c: 40, f: 18,
    flavour: 'Cooked chicken, crisp lettuce and creamy dressing in a wrap.',
    ingredients: ['1 cooked chicken breast, sliced', '1 large tortilla', 'Handful of shredded lettuce', '2 tbsp caesar or creamy dressing', 'Handful of grated cheese'],
    steps: [
      'Lay the tortilla flat and spread the dressing down the middle.',
      'Add the lettuce, then the sliced chicken.',
      'Scatter the cheese over the top.',
      'Fold in the sides and roll it up tightly, then cut in half.',
    ],
    tags: ['High protein', 'Quick', '10 minutes'],
  },
  {
    id: 'bm-jacket-potato', name: 'Jacket Potato with Beans & Cheese', image: img.mealPrep,
    category: 'Lunch', minutes: 15, serves: 1, kcal: 460, p: 20, c: 70, f: 12,
    flavour: 'Fluffy baked potato loaded with saucy beans and melty cheese.',
    ingredients: ['1 large potato', '1/2 tin of beans', 'Handful of grated cheese', 'Knob of butter', 'Salt and pepper'],
    steps: [
      'Prick the potato all over with a fork.',
      'Microwave for about eight minutes, turning halfway, until soft inside.',
      'Warm the beans in a pan or the microwave.',
      'Cut a cross in the potato, push it open and add the butter.',
      'Top with the beans and cheese, season and serve.',
    ],
    tags: ['Vegetarian', 'Filling', 'Cheap'],
  },
  {
    id: 'bm-tomato-soup-toastie', name: 'Tomato Soup & Grilled Cheese', image: img.mealPrep,
    category: 'Lunch', minutes: 15, serves: 1, kcal: 520, p: 18, c: 52, f: 26,
    flavour: 'Warm tomato soup with a crisp, cheesy toastie for dunking.',
    ingredients: ['1 tin of tomato soup', '2 slices of bread', 'Handful of grated cheese', 'Butter'],
    steps: [
      'Heat the soup in a small pot over medium heat, stirring now and then.',
      'Butter the bread on the outside and fill with the cheese.',
      'Fry in a pan until golden and the cheese melts, pressing down gently.',
      'Cut the toastie in half and serve alongside the soup for dunking.',
    ],
    tags: ['Vegetarian', 'Comfort food', '15 minutes'],
  },
  {
    id: 'bm-pesto-pasta-salad', name: 'Pesto Pasta Salad', image: img.mealPrep,
    category: 'Lunch', minutes: 15, serves: 2, kcal: 440, p: 14, c: 62, f: 16,
    flavour: 'Cold pasta tossed in pesto with juicy tomatoes. Travels well.',
    ingredients: ['2 cups pasta', '3 tbsp pesto', 'Handful of cherry tomatoes, halved', 'Handful of grated cheese', 'Salt and pepper'],
    steps: [
      'Boil the pasta in salted water until tender, then drain and rinse under cold water.',
      'Tip the cooled pasta into a bowl.',
      'Stir through the pesto until every piece is coated.',
      'Mix in the tomatoes and cheese, season, and serve cold.',
    ],
    cookOnce: 'Doubles easily and keeps in the fridge for a couple of days of lunches.',
    tags: ['Vegetarian', 'Meal prep', 'No reheat'],
  },
  {
    id: 'bm-egg-fried-rice', name: 'Egg Fried Rice', image: img.rice,
    category: 'Lunch', minutes: 12, serves: 1, kcal: 480, p: 16, c: 68, f: 14,
    flavour: 'Quick fried rice with egg and veg. Best with leftover rice.',
    ingredients: ['1.5 cups cooked rice', '2 eggs', 'Handful of frozen peas and corn', '1 tbsp soy sauce', '1 tbsp oil', '1 clove garlic, chopped'],
    steps: [
      'Heat the oil in a pan and fry the garlic for a few seconds.',
      'Push it aside, crack in the eggs and scramble them.',
      'Add the rice and frozen veg and stir fry for a few minutes.',
      'Pour over the soy sauce, toss everything together and serve hot.',
    ],
    tags: ['Uses leftovers', 'Quick', '12 minutes'],
  },
  {
    id: 'bm-quesadilla', name: 'Cheese & Bean Quesadilla', image: img.mealPrep,
    category: 'Lunch', minutes: 10, serves: 1, kcal: 470, p: 20, c: 50, f: 20,
    flavour: 'Crispy tortilla stuffed with melted cheese and beans.',
    ingredients: ['2 tortillas', 'Handful of grated cheese', '1/2 tin of beans, drained', 'Splash of oil', 'Salsa to serve'],
    steps: [
      'Heat a dry pan over medium heat and lay in one tortilla.',
      'Scatter over the cheese and beans, then top with the second tortilla.',
      'Cook until the bottom is golden, then carefully flip.',
      'Cook the other side until crisp and the cheese has melted.',
      'Slide onto a board, cut into wedges and serve with salsa.',
    ],
    tags: ['Vegetarian', 'Quick', '10 minutes'],
  },
  {
    id: 'bm-hummus-wrap', name: 'Hummus & Veg Wrap', image: img.mealPrep,
    category: 'Lunch', minutes: 8, serves: 1, kcal: 380, p: 12, c: 52, f: 14,
    flavour: 'Creamy hummus and crunchy veg rolled up. No cooking at all.',
    ingredients: ['1 large tortilla', '3 tbsp hummus', 'Handful of grated carrot', 'Handful of shredded lettuce', 'Sliced cucumber'],
    steps: [
      'Spread the hummus all over the tortilla.',
      'Pile the carrot, lettuce and cucumber down the middle.',
      'Fold in the sides and roll it up tightly.',
      'Cut in half and eat, or wrap in foil for later.',
    ],
    tags: ['Vegetarian', 'No cook', 'Lunchbox'],
  },
  {
    id: 'bm-ham-cheese-toastie', name: 'Ham & Cheese Toastie', image: img.mealPrep,
    category: 'Lunch', minutes: 8, serves: 1, kcal: 450, p: 24, c: 38, f: 22,
    flavour: 'Golden, crisp and oozing with cheese. The ultimate quick lunch.',
    ingredients: ['2 slices of bread', '2 slices of ham', 'Handful of grated cheese', 'Butter'],
    steps: [
      'Butter the bread on the outside of both slices.',
      'Fill with the ham and cheese, butter side out.',
      'Fry in a pan over medium heat, pressing down gently.',
      'Flip when golden and cook the other side until the cheese melts.',
    ],
    tags: ['Quick', 'Comfort food', '8 minutes'],
  },
  {
    id: 'bm-chicken-avo-salad', name: 'Chicken & Avocado Salad', image: img.chicken,
    category: 'Lunch', minutes: 12, serves: 1, kcal: 420, p: 34, c: 14, f: 26,
    flavour: 'Fresh, filling salad with creamy avocado and lean chicken.',
    ingredients: ['1 cooked chicken breast, sliced', '1/2 avocado, sliced', 'Handful of salad leaves', 'Handful of cherry tomatoes', '1 tbsp olive oil', 'Squeeze of lemon'],
    steps: [
      'Pile the salad leaves into a bowl.',
      'Add the chicken, avocado and tomatoes.',
      'Drizzle with the olive oil and a squeeze of lemon.',
      'Season with salt and pepper and toss gently.',
    ],
    tags: ['High protein', 'Low carb', 'No cook'],
  },

  /* ------------------------ Dinner ------------------------- */
  {
    id: 'bm-spag-bol', name: 'Spaghetti Bolognese', image: img.mealPrep,
    category: 'Dinner', minutes: 30, serves: 4, kcal: 560, p: 32, c: 64, f: 18,
    flavour: 'Rich, savoury mince sauce over spaghetti. A proper crowd-pleaser.',
    ingredients: ['500g beef mince', '1 onion, chopped', '2 cloves garlic, chopped', '1 tin of chopped tomatoes', '2 tbsp tomato paste', '400g spaghetti', '1 tbsp oil', 'Salt and pepper'],
    steps: [
      'Heat the oil in a large pan and soften the onion and garlic.',
      'Add the mince and brown it, breaking it up with a spoon.',
      'Stir in the chopped tomatoes and tomato paste, then season.',
      'Simmer for fifteen to twenty minutes, stirring now and then.',
      'Meanwhile, boil the spaghetti in salted water until tender, then drain.',
      'Serve the sauce over the spaghetti.',
    ],
    cookOnce: 'The sauce freezes brilliantly. Make a big batch and freeze in portions.',
    tags: ['Family', 'Freezer friendly', 'Comfort food'],
  },
  {
    id: 'bm-chicken-stir-fry', name: 'Chicken Stir Fry', image: img.chicken,
    category: 'Dinner', minutes: 20, serves: 2, kcal: 520, p: 38, c: 56, f: 14,
    flavour: 'Fast, fresh and packed with veg. Done in one pan.',
    ingredients: ['2 chicken breasts, sliced', 'Bag of stir fry veg', '2 portions of noodles or rice', '3 tbsp soy sauce', '1 tbsp oil', '1 clove garlic, chopped'],
    steps: [
      'Heat the oil in a large pan or wok over high heat.',
      'Add the chicken and cook until no longer pink.',
      'Throw in the veg and garlic and stir fry for a few minutes.',
      'Cook the noodles or rice as the packet says.',
      'Add the soy sauce to the pan, toss everything together and serve over the noodles.',
    ],
    tags: ['High protein', 'One pan', '20 minutes'],
  },
  {
    id: 'bm-chili-con-carne', name: 'Chili con Carne', image: img.mealPrep,
    category: 'Dinner', minutes: 35, serves: 4, kcal: 540, p: 34, c: 66, f: 14,
    flavour: 'Warming, spiced mince and beans. Even better the next day.',
    ingredients: ['500g beef mince', '1 onion, chopped', '1 tin of kidney beans, drained', '1 tin of chopped tomatoes', '2 tsp chili powder', '1 cup rice', '1 tbsp oil'],
    steps: [
      'Soften the onion in the oil in a large pan.',
      'Add the mince and brown it all over.',
      'Stir in the chili powder, then the tomatoes and beans.',
      'Simmer gently for twenty minutes until thick.',
      'Cook the rice while the chili simmers.',
      'Serve the chili over the rice.',
    ],
    cookOnce: 'Scales up easily and freezes well for quick dinners later.',
    tags: ['Freezer friendly', 'Family', 'Meal prep'],
  },
  {
    id: 'bm-sausage-mash', name: 'Sausage & Mash', image: img.mealPrep,
    category: 'Dinner', minutes: 30, serves: 2, kcal: 620, p: 26, c: 60, f: 30,
    flavour: 'Bangers and creamy mash. Pure comfort on a plate.',
    ingredients: ['4 sausages', '4 potatoes, peeled and chopped', 'Knob of butter', 'Splash of milk', 'Salt and pepper'],
    steps: [
      'Boil the potatoes in salted water until soft, about fifteen minutes.',
      'Meanwhile, cook the sausages in a pan, turning until browned all over.',
      'Drain the potatoes, then mash with the butter and milk until smooth.',
      'Season the mash and serve with the sausages.',
    ],
    tags: ['Comfort food', 'Family', 'Filling'],
  },
  {
    id: 'bm-chicken-traybake', name: 'Chicken & Veg Traybake', image: img.chicken,
    category: 'Dinner', minutes: 40, serves: 4, kcal: 500, p: 36, c: 44, f: 18,
    flavour: 'Throw it all on one tray and let the oven do the work.',
    ingredients: ['6 chicken thighs', '4 potatoes, chopped', '2 peppers, chopped', '1 onion, chopped', '2 tbsp oil', 'Salt, pepper and paprika'],
    steps: [
      'Heat the oven to 200C.',
      'Spread the potatoes, peppers and onion over a large roasting tray.',
      'Sit the chicken thighs on top, then drizzle everything with oil and season.',
      'Roast for about thirty-five minutes until the chicken is cooked through and the veg is tender.',
      'Serve straight from the tray.',
    ],
    cookOnce: 'Leftovers reheat well for lunch the next day.',
    tags: ['One pan', 'High protein', 'Hands off'],
  },
  {
    id: 'bm-tuna-pasta-bake', name: 'Tuna Pasta Bake', image: img.salmon,
    category: 'Dinner', minutes: 35, serves: 4, kcal: 540, p: 32, c: 64, f: 16,
    flavour: 'Creamy, cheesy pasta baked until golden. Family favourite.',
    ingredients: ['3 cups pasta', '2 tins of tuna, drained', '1 tin of sweetcorn, drained', '2 cups cheese sauce or 1 tub of creme fraiche', 'Handful of grated cheese'],
    steps: [
      'Heat the oven to 200C and boil the pasta until just tender, then drain.',
      'Mix the pasta with the tuna, sweetcorn and cheese sauce.',
      'Tip into an oven dish and level it out.',
      'Scatter the grated cheese on top.',
      'Bake for about twenty minutes until bubbling and golden.',
    ],
    cookOnce: 'Makes four big portions. Great for batch cooking.',
    tags: ['Family', 'Meal prep', 'Comfort food'],
  },
  {
    id: 'bm-chicken-fried-rice', name: 'Chicken Fried Rice', image: img.chicken,
    category: 'Dinner', minutes: 20, serves: 2, kcal: 560, p: 34, c: 68, f: 14,
    flavour: 'Takeaway-style fried rice loaded with chicken and veg.',
    ingredients: ['2 cups cooked rice', '2 chicken breasts, diced', '2 eggs', 'Handful of frozen peas and carrots', '3 tbsp soy sauce', '1 tbsp oil'],
    steps: [
      'Heat the oil in a large pan and cook the chicken until done.',
      'Push it to one side, crack in the eggs and scramble.',
      'Add the rice and frozen veg and stir fry for a few minutes.',
      'Pour over the soy sauce, toss everything together and serve hot.',
    ],
    tags: ['High protein', 'Uses leftovers', '20 minutes'],
  },
  {
    id: 'bm-beef-tacos', name: 'Beef Tacos', image: img.mealPrep,
    category: 'Dinner', minutes: 25, serves: 3, kcal: 520, p: 30, c: 48, f: 22,
    flavour: 'Spiced mince in soft tortillas with cheese and salad. Build your own.',
    ingredients: ['500g beef mince', '1 onion, chopped', '2 tsp taco or chili seasoning', '6 small tortillas', 'Handful of grated cheese', 'Shredded lettuce and chopped tomato'],
    steps: [
      'Brown the onion and mince in a pan until cooked through.',
      'Stir in the seasoning with a splash of water and simmer for a few minutes.',
      'Warm the tortillas briefly in a dry pan.',
      'Spoon the mince into each tortilla.',
      'Top with cheese, lettuce and tomato, then fold and eat.',
    ],
    tags: ['Family', 'Fun', '25 minutes'],
  },
  {
    id: 'bm-flatbread-pizza', name: 'Margherita Flatbread Pizza', image: img.mealPrep,
    category: 'Dinner', minutes: 18, serves: 1, kcal: 520, p: 22, c: 58, f: 20,
    flavour: 'A quick pizza on a flatbread base. Crisp, cheesy and fast.',
    ingredients: ['1 large flatbread or tortilla', '3 tbsp passata or tomato paste', 'Handful of grated mozzarella', 'Pinch of dried oregano', 'Fresh basil (optional)'],
    steps: [
      'Heat the oven to 220C.',
      'Spread the passata over the flatbread, leaving a small border.',
      'Scatter the cheese and oregano on top.',
      'Bake for about eight minutes until the cheese is melted and bubbling.',
      'Finish with fresh basil and slice.',
    ],
    tags: ['Vegetarian', 'Quick', '18 minutes'],
  },
  {
    id: 'bm-chickpea-curry', name: 'Chickpea Curry', image: img.rice,
    category: 'Dinner', minutes: 25, serves: 3, kcal: 480, p: 16, c: 72, f: 12,
    flavour: 'A cosy, mild curry that is cheap and totally meat-free.',
    ingredients: ['2 tins of chickpeas, drained', '1 tin of chopped tomatoes', '1 onion, chopped', '2 tbsp curry powder', '1 cup rice', '1 tbsp oil', '1 clove garlic, chopped'],
    steps: [
      'Soften the onion and garlic in the oil in a large pan.',
      'Stir in the curry powder and cook for a minute until fragrant.',
      'Add the tomatoes and chickpeas and simmer for fifteen minutes.',
      'Cook the rice while the curry simmers.',
      'Serve the curry over the rice.',
    ],
    cookOnce: 'Tastes even better reheated, so make extra for tomorrow.',
    tags: ['Vegan', 'Cheap', 'Meal prep'],
  },
  {
    id: 'bm-shepherds-pie', name: "Shepherd's Pie", image: img.mealPrep,
    category: 'Dinner', minutes: 50, serves: 4, kcal: 560, p: 30, c: 58, f: 22,
    flavour: 'Savoury mince under a fluffy mash topping, baked until golden.',
    ingredients: ['500g beef or lamb mince', '1 onion, chopped', '1 cup frozen mixed veg', '2 tbsp tomato paste', '5 potatoes, peeled and chopped', 'Knob of butter', 'Splash of milk'],
    steps: [
      'Heat the oven to 200C and boil the potatoes until soft.',
      'Brown the onion and mince in a pan, then stir in the veg and tomato paste with a splash of water.',
      'Simmer for ten minutes, then tip into an oven dish.',
      'Mash the potatoes with butter and milk, then spread over the mince.',
      'Bake for about twenty minutes until the top is golden.',
    ],
    cookOnce: 'Freezes well, so make two and keep one for a busy night.',
    tags: ['Family', 'Freezer friendly', 'Comfort food'],
  },
  {
    id: 'bm-fish-chips-peas', name: 'Fish Fingers, Chips & Peas', image: img.salmon,
    category: 'Dinner', minutes: 30, serves: 2, kcal: 580, p: 26, c: 70, f: 22,
    flavour: 'The easy oven dinner everyone secretly loves.',
    ingredients: ['8 fish fingers', '2 large potatoes, cut into chips', '1 cup frozen peas', '1 tbsp oil', 'Salt'],
    steps: [
      'Heat the oven to 220C.',
      'Toss the chips in the oil and a little salt, spread on a tray and bake for fifteen minutes.',
      'Add the fish fingers to the tray and bake for another fifteen minutes, turning once.',
      'Boil the peas for a few minutes, then drain.',
      'Plate up the fish fingers, chips and peas.',
    ],
    tags: ['Easy', 'Family', '30 minutes'],
  },
  {
    id: 'bm-garlic-pasta', name: 'Creamy Garlic Pasta', image: img.mealPrep,
    category: 'Dinner', minutes: 20, serves: 2, kcal: 560, p: 16, c: 72, f: 22,
    flavour: 'Silky garlic and cheese sauce coating every strand. Pure comfort.',
    ingredients: ['2.5 cups pasta', '2 cloves garlic, chopped', '1 cup cream or creme fraiche', 'Handful of grated parmesan', 'Knob of butter', 'Salt and pepper'],
    steps: [
      'Boil the pasta in salted water until tender, saving a cup of the water before draining.',
      'Melt the butter in a pan and gently cook the garlic for a minute.',
      'Pour in the cream and let it warm through.',
      'Add the pasta and parmesan, loosening with a splash of pasta water.',
      'Toss until glossy, season and serve.',
    ],
    tags: ['Vegetarian', 'Quick', 'Comfort food'],
  },
  {
    id: 'bm-stirfry-noodles', name: 'Stir-Fried Veg Noodles', image: img.rice,
    category: 'Dinner', minutes: 18, serves: 2, kcal: 460, p: 14, c: 74, f: 12,
    flavour: 'Saucy noodles tossed with crunchy veg. Cheap and meat-free.',
    ingredients: ['2 portions of noodles', 'Bag of stir fry veg', '3 tbsp soy sauce', '1 tbsp honey', '1 tbsp oil', '1 clove garlic, chopped'],
    steps: [
      'Cook the noodles as the packet says, then drain.',
      'Heat the oil in a wok and stir fry the veg and garlic for a few minutes.',
      'Mix the soy sauce and honey, then pour into the pan.',
      'Add the noodles and toss until everything is coated and hot.',
    ],
    tags: ['Vegetarian', 'Quick', '18 minutes'],
  },
  {
    id: 'bm-honey-garlic-chicken', name: 'Honey Garlic Chicken Thighs', image: img.chicken,
    category: 'Dinner', minutes: 25, serves: 2, kcal: 540, p: 38, c: 48, f: 20,
    flavour: 'Sticky, sweet and savoury chicken over rice. Tastes fancy, is not.',
    ingredients: ['6 chicken thighs', '3 tbsp honey', '3 tbsp soy sauce', '2 cloves garlic, chopped', '1 cup rice', '1 tbsp oil'],
    steps: [
      'Cook the rice as the packet says.',
      'Brown the chicken thighs in the oil in a pan, a few minutes each side.',
      'Add the garlic, honey and soy sauce with a splash of water.',
      'Simmer until the chicken is cooked through and the sauce turns sticky.',
      'Serve the chicken and sauce over the rice.',
    ],
    tags: ['High protein', 'Sticky', '25 minutes'],
  },
  {
    id: 'bm-mac-cheese', name: 'Mac and Cheese', image: img.mealPrep,
    category: 'Dinner', minutes: 25, serves: 3, kcal: 600, p: 22, c: 68, f: 26,
    flavour: 'Creamy, cheesy pasta from scratch. The ultimate comfort bowl.',
    ingredients: ['3 cups macaroni', '2 tbsp butter', '2 tbsp flour', '2 cups milk', '2 cups grated cheese', 'Salt and pepper'],
    steps: [
      'Boil the macaroni until tender, then drain.',
      'Melt the butter in a pan, stir in the flour and cook for a minute.',
      'Slowly whisk in the milk until smooth and thickened.',
      'Stir in most of the cheese until melted, then season.',
      'Mix in the pasta, top with the rest of the cheese and serve.',
    ],
    cookOnce: 'Bake any leftovers in a dish the next day for a crispy top.',
    tags: ['Vegetarian', 'Comfort food', 'Family'],
  },

  /* ------------------------- Snack ------------------------- */
  {
    id: 'bm-hummus-carrots', name: 'Hummus & Carrot Sticks', image: img.yogurt,
    category: 'Snack', minutes: 5, serves: 1, kcal: 220, p: 7, c: 24, f: 11,
    flavour: 'Crunchy carrots and creamy hummus. The easy afternoon fix.',
    ingredients: ['2 carrots, cut into sticks', '4 tbsp hummus', 'Squeeze of lemon (optional)'],
    steps: [
      'Peel the carrots and cut them into sticks.',
      'Spoon the hummus into a small bowl.',
      'Add a squeeze of lemon to the hummus if you like.',
      'Dip and snack.',
    ],
    tags: ['Vegan', 'No cook', '5 minutes'],
  },
  {
    id: 'bm-apple-pb', name: 'Apple & Peanut Butter', image: img.yogurt,
    category: 'Snack', minutes: 3, serves: 1, kcal: 260, p: 8, c: 30, f: 14,
    flavour: 'Crisp apple slices with peanut butter. Sweet, salty, done.',
    ingredients: ['1 apple', '2 tbsp peanut butter'],
    steps: [
      'Core the apple and cut it into slices.',
      'Spread or dip each slice in peanut butter.',
      'Eat straight away.',
    ],
    tags: ['Vegetarian', 'No cook', '3 minutes'],
  },
  {
    id: 'bm-cheese-crackers', name: 'Cheese & Crackers', image: img.yogurt,
    category: 'Snack', minutes: 3, serves: 1, kcal: 280, p: 12, c: 24, f: 16,
    flavour: 'Cheese on crackers. Simple, satisfying, no effort.',
    ingredients: ['6 crackers', 'A few slices of cheese', 'Sliced tomato or pickle (optional)'],
    steps: [
      'Lay the crackers out on a plate.',
      'Top each one with a slice of cheese.',
      'Add tomato or pickle if you have it.',
      'Snack away.',
    ],
    tags: ['No cook', 'Quick', '3 minutes'],
  },
  {
    id: 'bm-yogurt-granola', name: 'Yogurt & Granola Cup', image: img.yogurt,
    category: 'Snack', minutes: 3, serves: 1, kcal: 260, p: 16, c: 34, f: 6,
    flavour: 'Thick yogurt with crunchy granola. A protein-packed snack.',
    ingredients: ['1 cup Greek yogurt', 'Handful of granola', '1 tsp honey'],
    steps: [
      'Spoon the yogurt into a cup or bowl.',
      'Top with the granola.',
      'Drizzle with honey and eat.',
    ],
    tags: ['High protein', 'No cook', '3 minutes'],
  },
  {
    id: 'bm-boiled-eggs', name: 'Boiled Eggs', image: img.eggs,
    category: 'Snack', minutes: 12, serves: 2, kcal: 160, p: 14, c: 1, f: 11,
    flavour: 'Cheap, portable protein. Boil a batch for the week.',
    ingredients: ['4 eggs', 'Pinch of salt'],
    steps: [
      'Bring a pot of water to the boil.',
      'Gently lower in the eggs and boil for about eight minutes for firm yolks.',
      'Drain and run under cold water until cool enough to handle.',
      'Peel, sprinkle with salt and eat, or keep in the fridge.',
    ],
    cookOnce: 'Boil six at once for grab-and-go protein all week.',
    tags: ['High protein', 'Meal prep', 'Low carb'],
  },
  {
    id: 'bm-popcorn', name: 'Stovetop Popcorn', image: img.oats,
    category: 'Snack', minutes: 8, serves: 2, kcal: 200, p: 4, c: 30, f: 8,
    flavour: 'Fresh popcorn for a fraction of the bag price. Add your own flavour.',
    ingredients: ['1/3 cup popcorn kernels', '1 tbsp oil', 'Pinch of salt'],
    steps: [
      'Heat the oil in a large pot with a lid over medium heat.',
      'Add a few kernels and wait until they pop, then add the rest.',
      'Cover and shake the pot now and then until the popping slows down.',
      'Take off the heat, season with salt and tip into a bowl.',
    ],
    tags: ['Vegan', 'Cheap', 'Movie night'],
  },
  {
    id: 'bm-avocado-toast', name: 'Avocado Toast', image: img.oats,
    category: 'Snack', minutes: 6, serves: 1, kcal: 300, p: 8, c: 32, f: 16,
    flavour: 'Creamy smashed avocado on crunchy toast. A quick pick-me-up.',
    ingredients: ['2 slices of bread', '1/2 avocado', 'Squeeze of lemon', 'Salt, pepper and chili flakes'],
    steps: [
      'Toast the bread.',
      'Mash the avocado with the lemon, salt and pepper.',
      'Spread it thickly over the toast.',
      'Finish with a pinch of chili flakes.',
    ],
    tags: ['Vegetarian', 'Quick', '6 minutes'],
  },

  /* ------------------------- Sweet ------------------------- */
  {
    id: 'bm-mug-cake', name: 'Chocolate Mug Cake', image: img.yogurt,
    category: 'Sweet', minutes: 5, serves: 1, kcal: 380, p: 8, c: 52, f: 15,
    flavour: 'Warm, gooey chocolate cake in a mug, ready in minutes.',
    ingredients: ['4 tbsp flour', '3 tbsp sugar', '2 tbsp cocoa powder', '3 tbsp milk', '2 tbsp oil', 'Pinch of baking powder'],
    steps: [
      'Mix the flour, sugar, cocoa and baking powder in a large mug.',
      'Stir in the milk and oil until smooth with no dry patches.',
      'Microwave for about ninety seconds until risen and just set.',
      'Let it cool for a minute, then eat straight from the mug.',
    ],
    tags: ['Vegetarian', 'Quick', '5 minutes'],
  },
  {
    id: 'bm-banana-nice-cream', name: 'Banana Nice Cream', image: img.yogurt,
    category: 'Sweet', minutes: 5, serves: 1, kcal: 220, p: 3, c: 50, f: 2,
    flavour: 'Creamy soft-serve made from just frozen banana. No sugar added.',
    ingredients: ['2 frozen bananas, sliced', 'Splash of milk', '1 tbsp peanut butter or cocoa (optional)'],
    steps: [
      'Add the frozen banana to a blender or food processor.',
      'Blend, adding a splash of milk to get it moving.',
      'Keep blending until thick and creamy like soft serve.',
      'Add peanut butter or cocoa if you like, then scoop and eat.',
    ],
    tags: ['Vegan', 'No added sugar', '5 minutes'],
  },
  {
    id: 'bm-oat-bites', name: 'No-Bake Chocolate Oat Bites', image: img.oats,
    category: 'Sweet', minutes: 10, serves: 6, kcal: 180, p: 5, c: 22, f: 9,
    flavour: 'Chewy peanut butter and oat balls. No oven required.',
    ingredients: ['1.5 cups rolled oats', '1/2 cup peanut butter', '1/3 cup honey', '2 tbsp cocoa powder'],
    steps: [
      'Mix the oats, peanut butter, honey and cocoa in a bowl until it clumps together.',
      'Roll the mixture into small balls with your hands.',
      'Place them on a plate or tray.',
      'Chill in the fridge for thirty minutes to firm up.',
    ],
    cookOnce: 'Keep a batch in the fridge for a quick sweet hit during the week.',
    tags: ['No bake', 'Meal prep', 'Vegetarian'],
  },
  {
    id: 'bm-rice-pudding', name: 'Rice Pudding', image: img.rice,
    category: 'Sweet', minutes: 30, serves: 3, kcal: 280, p: 8, c: 50, f: 6,
    flavour: 'Creamy, cosy and cheap. Old-school pudding done on the stove.',
    ingredients: ['1/2 cup pudding or short grain rice', '2.5 cups milk', '3 tbsp sugar', '1 tsp vanilla', 'Pinch of cinnamon'],
    steps: [
      'Add the rice, milk and sugar to a pot.',
      'Bring to a gentle simmer, stirring often so it does not stick.',
      'Cook for about twenty-five minutes until thick and creamy.',
      'Stir in the vanilla, sprinkle with cinnamon and serve warm.',
    ],
    tags: ['Vegetarian', 'Comfort food', 'Cheap'],
  },
  {
    id: 'bm-baked-apples', name: 'Cinnamon Baked Apples', image: img.yogurt,
    category: 'Sweet', minutes: 30, serves: 2, kcal: 200, p: 2, c: 42, f: 4,
    flavour: 'Soft, spiced apples that taste like the inside of an apple pie.',
    ingredients: ['2 apples', '2 tbsp oats', '1 tbsp honey', '1 tsp cinnamon', 'Knob of butter'],
    steps: [
      'Heat the oven to 180C.',
      'Core the apples and sit them in a small baking dish.',
      'Mix the oats, honey, cinnamon and butter, then stuff into the centres.',
      'Bake for about twenty-five minutes until the apples are soft.',
      'Serve warm, with yogurt if you like.',
    ],
    tags: ['Vegetarian', 'No added sugar', 'Cosy'],
  },
  {
    id: 'bm-berry-parfait', name: 'Berry Yogurt Parfait', image: img.yogurt,
    category: 'Sweet', minutes: 5, serves: 1, kcal: 260, p: 14, c: 38, f: 5,
    flavour: 'Layers of yogurt, berries and granola. Dessert that loves you back.',
    ingredients: ['1 cup Greek yogurt', 'Handful of berries', 'Handful of granola', '1 tbsp honey'],
    steps: [
      'Spoon a layer of yogurt into a glass.',
      'Add a layer of berries, then a layer of granola.',
      'Repeat the layers until the glass is full.',
      'Drizzle with honey and serve.',
    ],
    tags: ['High protein', 'No cook', '5 minutes'],
  },
  {
    id: 'bm-pb-cookies', name: '3-Ingredient Peanut Butter Cookies', image: img.oats,
    category: 'Sweet', minutes: 20, serves: 8, kcal: 150, p: 5, c: 14, f: 9,
    flavour: 'Soft peanut butter cookies from just three things. No flour.',
    ingredients: ['1 cup peanut butter', '1/2 cup sugar', '1 egg'],
    steps: [
      'Heat the oven to 180C and line a tray with baking paper.',
      'Mix the peanut butter, sugar and egg into a smooth dough.',
      'Roll into small balls, place on the tray and press flat with a fork.',
      'Bake for about ten minutes, then let them firm up on the tray before moving.',
    ],
    cookOnce: 'Makes a batch of around eight cookies to share or save.',
    tags: ['3 ingredients', 'Vegetarian', 'Quick'],
  },
]


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
