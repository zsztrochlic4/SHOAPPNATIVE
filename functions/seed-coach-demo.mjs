// LOCAL-ONLY dev seeder: writes a realistic user profile + training/nutrition history
// into the Firestore EMULATOR so the live coach reasons over genuine context.
// Run: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=strengthhub-2ab33 node seed-coach-demo.mjs <uid>
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const uid = process.argv[2]
if (!uid) { console.error('usage: node seed-coach-demo.mjs <uid>'); process.exit(1) }

initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'strengthhub-2ab33' })
const db = getFirestore()

// Deterministic date helper anchored on 2026-08-14 (Friday), the app's "today".
const BASE = new Date('2026-08-14T08:00:00+10:00')
const dayKey = (n) => { const d = new Date(BASE); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }

// Exercises carry the app's CANONICAL exercise ids so the coach can emit a valid swap
// proposal (fromExerciseId) instead of dropping to prose.
const program = {
  name: 'Alex — 4-day hypertrophy split',
  daysPerWeek: 4,
  days: [
    { weekday: 'Monday', dayType: 'Legs', exercises: [{ id: 'QD01', name: 'Barbell Back Squat' }, { id: 'HG01', name: 'Romanian Deadlift' }, { id: 'QD05', name: 'Leg Press' }, { id: 'HG04', name: 'Seated Leg Curl' }, { id: 'CA01', name: 'Standing Calf Raise' }] },
    { weekday: 'Wednesday', dayType: 'Pull', exercises: [{ id: 'BK12', name: 'Trap Bar Deadlift' }, { id: 'BK02', name: 'Barbell Bent Over Row' }, { id: 'BK05', name: 'Lat Pulldown' }, { id: 'SH06', name: 'Face Pull' }, { id: 'BI01', name: 'Barbell Curl' }] },
    { weekday: 'Friday', dayType: 'Push', exercises: [{ id: 'CH01', name: 'Barbell Bench Press' }, { id: 'SH01', name: 'Barbell Overhead Press' }, { id: 'CH03', name: 'Incline Dumbbell Press' }, { id: 'CH06', name: 'Cable Chest Fly' }, { id: 'TR03', name: 'Triceps Pushdown' }] },
    { weekday: 'Sunday', dayType: 'Upper', exercises: [{ id: 'CH01', name: 'Barbell Bench Press' }, { id: 'BK02', name: 'Barbell Bent Over Row' }, { id: 'SH01', name: 'Barbell Overhead Press' }, { id: 'BK05', name: 'Lat Pulldown' }] },
  ],
}

const userDoc = {
  profile: {
    name: 'Alex', coachName: 'Coach', goal: 'Build muscle', experience: 'Beginner',
    // Demo user is a real, onboarded, entitled account so the local client boots
    // straight into the app (past onboarding + paywall) when it syncs this profile.
    onboarded: true, premium: true,
    heightCm: 175, startWeightKg: 75, goalWeightKg: 78,
    daysPerWeek: 4, sessionMinutes: 60, equipment: 'Full gym',
    sleepTargetH: 8, stepTarget: 9000, waterTargetL: 3,
    dietaryPrefs: 'no restrictions', budgetMode: false, motivation: 'I want to feel fitter',
  },
  backendUser: {
    goal: 'hypertrophy', experience_level: 'beginner', days_per_week: 4, session_length_min: 60,
    days_available: ['Monday', 'Wednesday', 'Friday', 'Sunday'],
    equipment: 'full_gym', trains_alone: 'usually', date_of_birth: '2006-01-01',
    affected_regions: [], excluded_exercise_ids: [],
  },
  settings: { units: 'metric', timezone: 'Australia/Sydney' },
  generatedProgram: program,
  // Saved weekly meal plan (this week, w:0) so the coach can review the PLAN, not just logged meals.
  mealPlan: [
    { id: 'mp1', day: 'Mon', slot: 'Breakfast', name: 'Oats with banana and peanut butter', w: 0 },
    { id: 'mp2', day: 'Mon', slot: 'Lunch', name: 'Chicken, rice and broccoli', w: 0 },
    { id: 'mp3', day: 'Mon', slot: 'Dinner', name: 'Beef stir fry with noodles', w: 0 },
    { id: 'mp4', day: 'Tue', slot: 'Breakfast', name: 'Greek yoghurt, berries and granola', w: 0 },
    { id: 'mp5', day: 'Tue', slot: 'Lunch', name: 'Tuna pasta salad', w: 0 },
    { id: 'mp6', day: 'Tue', slot: 'Dinner', name: 'Salmon, potatoes and greens', w: 0 },
    { id: 'mp7', day: 'Wed', slot: 'Breakfast', name: 'Three-egg omelette with toast', w: 0 },
    { id: 'mp8', day: 'Wed', slot: 'Dinner', name: 'Takeaway pizza', w: 0 },
    { id: 'mp9', day: 'Thu', slot: 'Lunch', name: 'Burrito bowl with chicken and beans', w: 0 },
    { id: 'mp10', day: 'Fri', slot: 'Dinner', name: 'Homemade beef burgers and sweet potato fries', w: 0 },
  ],
}

// est-1RM progression per lift across ~8 sessions (oldest→newest); overhead press plateaus.
const liftSeries = {
  'barbell-bench-press': [95, 96, 97.5, 99, 100, 102, 104, 106],
  'barbell-back-squat': [130, 132, 134, 137, 139, 141, 143, 145],
  'deadlift': [150, 152, 155, 157, 160, 162, 163, 165],
  'overhead-press': [62, 63, 64, 65, 65, 65, 65, 65],
}
const N = 8

async function seed() {
  await db.collection('users').doc(uid).set(userDoc, { merge: true })
  // Open the server-authoritative, default-CLOSED release gate for local/internal testing. The coach
  // now requires BOTH the internal build channel (env) AND config/coach.releaseEnabled === true, so an
  // env var alone can never open a real deploy; the emulator's Firestore is ephemeral, so this is a
  // local-only opt-in that must be re-seeded after every restart (see the coach release gate).
  await db.collection('config').doc('coach').set({ releaseEnabled: true }, { merge: true })
  // Grant coach consent + enable memory server-side so we skip the in-app consent click.
  await db.collection('coachUsers').doc(uid).set({
    schemaVersion: 1, consentVersion: 1, memoryEnabled: true, proactiveEnabled: false, coachingStyle: 'balanced',
  }, { merge: true })

  const b = db.batch()
  // Workout summaries (drives PRs + plateaus): one per training day, newest = index 0 via dateKey desc.
  for (let i = 0; i < N; i++) {
    const dk = dayKey(i * 2) // every ~2 days
    const lifts = {}
    for (const [id, series] of Object.entries(liftSeries)) lifts[id] = series[N - 1 - i]
    b.set(db.collection('users').doc(uid).collection('workoutSummaries').doc(dk), { dateKey: dk, lifts, volumeKg: 8200 - i * 120 })
  }
  // Completed training sessions with real set data.
  const pushSets = (bench) => [
    { name: 'Barbell Bench Press', sets: [{ weightKg: bench, reps: 6 }, { weightKg: bench, reps: 6 }, { weightKg: bench - 5, reps: 8 }, { weightKg: bench - 5, reps: 8 }] },
    { name: 'Overhead Press', sets: [{ weightKg: 50, reps: 8 }, { weightKg: 50, reps: 7 }, { weightKg: 45, reps: 9 }] },
    { name: 'Incline Dumbbell Press', sets: [{ weightKg: 26, reps: 10 }, { weightKg: 26, reps: 9 }, { weightKg: 24, reps: 10 }] },
    { name: 'Rope Tricep Pushdown', sets: [{ weightKg: 30, reps: 12 }, { weightKg: 30, reps: 12 }, { weightKg: 27, reps: 12 }] },
  ]
  const benchByI = [88, 86, 84, 82.5, 80, 79, 77.5, 76]
  for (let i = 0; i < N; i++) {
    const dk = dayKey(i * 2)
    b.set(db.collection('users').doc(uid).collection('sessions').doc(dk), {
      dateKey: dk, completed: true, title: i % 3 === 0 ? 'Push Day' : i % 3 === 1 ? 'Pull Day' : 'Legs Day',
      volumeKg: 8200 - i * 120, exercises: pushSets(benchByI[i]),
    })
  }
  // Bodyweight trend (slnow recomp): 75.0 → 74.2
  const weights = [74.2, 74.3, 74.5, 74.6, 74.8, 75.0]
  weights.forEach((kg, i) => { const dk = dayKey(i * 2); b.set(db.collection('users').doc(uid).collection('weights').doc(dk), { dateKey: dk, weightKg: kg }) })
  // 14 days of recovery habits
  for (let i = 0; i < 14; i++) {
    const dk = dayKey(i)
    b.set(db.collection('users').doc(uid).collection('habits').doc(dk), {
      dateKey: dk, sleepH: +(6.6 + (i % 5) * 0.35).toFixed(1), waterL: +(2.0 + (i % 4) * 0.3).toFixed(1), steps: 6800 + (i % 6) * 520, nutritionScore: 6 + (i % 4),
    })
  }
  // Nutrition entries
  const meals = [
    { meal: 'Breakfast', name: 'Eggs, avocado, wholegrain toast', quality: 'balanced' },
    { meal: 'Lunch', name: 'Chicken, rice, mixed veg', quality: 'balanced' },
    { meal: 'Dinner', name: 'Salmon, potatoes, salad', quality: 'balanced' },
    { meal: 'Snack', name: 'Greek yoghurt and berries', quality: 'balanced' },
    { meal: 'Dinner', name: 'Burger and chips (takeaway)', quality: 'indulgent' },
  ]
  for (let i = 0; i < 12; i++) {
    const dk = dayKey(Math.floor(i / 2))
    const m = meals[i % meals.length]
    b.set(db.collection('users').doc(uid).collection('meals').doc(`${dk}-${i}`), { dateKey: dk, ...m })
  }
  // Nutrition check-ins (foodReviews)
  for (let i = 0; i < 7; i++) {
    const dk = dayKey(i)
    b.set(db.collection('users').doc(uid).collection('foodReviews').doc(dk), {
      dateKey: dk, score: [80, 72, 90, 65, 85, 78, 88][i], tags: ['had protein with meals', 'stayed hydrated'], note: i === 3 ? 'busy day, ate out' : 'solid day',
    })
  }
  // Self-chosen activity
  for (let i = 0; i < 4; i++) { const dk = dayKey(i * 3 + 1); b.set(db.collection('users').doc(uid).collection('activities').doc(dk), { dateKey: dk, type: i % 2 ? 'Running' : 'Basketball', minutes: 40 + i * 5 }) }

  await b.commit()
  console.log(`Seeded realistic history for ${uid}: profile+program, ${N} sessions/summaries, weights, 14 habits, meals, check-ins, activities.`)
}
seed().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
