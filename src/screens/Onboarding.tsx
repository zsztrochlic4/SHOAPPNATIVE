/**
 * Onboarding.tsx — StrengthHub Online new-user onboarding.
 *
 * A premium, one-question-at-a-time flow (Cal-AI-style pacing) recreated in
 * React Native + NativeWind from the design handoff in
 * design_handoff_onboarding/. `prototype/data.jsx` is the canonical spec for the
 * flow order, copy, conditionals and the age/safety logic — this file ports that
 * structure directly. It finishes by dispatching the same store action the old
 * screen used:
 *
 *   dispatch({ type: 'COMPLETE_ONBOARDING', profile })
 *
 * Only the presentation layer lives here — lib/, data/, store/ and the reducer
 * are untouched. Onboarding gathers answers, maps them to a Partial<Profile>,
 * and hands the account itself to the existing AuthProvider / AuthScreen.
 */
import type { ComponentType, ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, Pressable, ScrollView, TextInput, Animated, Easing,
  type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native'
import {
  ChevronLeft, ChevronRight, Check, ShieldAlert, Search, Plus, X, Lock,
  Dumbbell, Flame, TrendingUp, HeartPulse, House, User, Footprints, Signal, Zap,
} from 'lucide-react-native'
import { useDispatch } from '../store/store'
import { useAuth } from '../auth/AuthProvider'
import { LogoMark, Wordmark } from '../components/Logo'
import { PressableScale } from '../components/PressableScale'
import { WeightDial } from '../components/WeightDial'
import { HeightRuler } from '../components/HeightRuler'
import { IS_WEB } from '../components/WebFrame'
import { tick, thud } from '../lib/haptics'
import { useColors } from '../theme'
import { todayKey } from '../lib/date'
import type { Equipment, Experience, Goal, Profile } from '../store/types'

/** Repo motion curve (see ScreenFade in src/App.tsx). */
const EASE = Easing.bezier(0.22, 1, 0.36, 1)
const NATIVE = !IS_WEB

/* ────────────────────────────── answer model ────────────────────────────── */

type Sex = 'male' | 'female' | 'other'
type GoalKey = 'build' | 'lose' | 'strong' | 'healthy'
type EnvKey = 'gym' | 'home' | 'bodyweight'
type Intensity = 'easy' | 'moderate' | 'hard'

interface ActivityDetail { days: string[]; intensity?: Intensity }

interface Answers {
  name: string
  dob: string // 'YYYY-MM-DD'
  guardianConsent: boolean
  sex: Sex | ''
  height: number
  weight: number
  goalWeight: number
  noGoalWeight: boolean
  goal: GoalKey | ''
  focus: string[]
  experience: Experience | ''
  structured: 'yes' | 'no' | ''
  days: string[]
  session: number
  alone: string
  environment: EnvKey | ''
  equipment: string[]
  trainAround: string[]
  moreInfo: string
  activities: string[]
  activityOther: string
  activityDetail: Record<string, ActivityDetail>
  loveExercises: string[]
  avoidExercises: string[]
  motivation: string
  safety: Record<string, 'yes' | 'no'>
  followup: Record<string, string>
  movements: string[]
  movementsOther: string
  terms: boolean
}

const DEFAULT_ANSWERS: Answers = {
  name: '', dob: '', guardianConsent: false, sex: '',
  height: 175, weight: 75, goalWeight: 78, noGoalWeight: false,
  goal: 'build', focus: [], experience: 'beginner', structured: '',
  days: ['Monday', 'Wednesday', 'Friday', 'Saturday'], session: 60, alone: '',
  environment: 'gym', equipment: [], trainAround: [], moreInfo: '',
  activities: [], activityOther: '', activityDetail: {}, loveExercises: [], avoidExercises: [],
  motivation: '', safety: {}, followup: {}, movements: [], movementsOther: '', terms: false,
}

/* ─────────────────────────────── option data ─────────────────────────────── */

type IconCmp = ComponentType<{ size?: number; color?: string }>

const SECTIONS = [
  { id: 'about', label: 'About You' },
  { id: 'goals', label: 'Your Goals' },
  { id: 'training', label: 'Your Training' },
  { id: 'lifestyle', label: 'Your Lifestyle' },
  { id: 'safety', label: 'Safety' },
] as const

const SEX_OPTIONS = [
  { value: 'male', label: 'Male', glyph: '♂' },
  { value: 'female', label: 'Female', glyph: '♀' },
  { value: 'other', label: 'Other', glyph: '⚥' },
]
const GOAL_OPTIONS: { value: GoalKey; label: string; desc: string; icon: IconCmp }[] = [
  { value: 'build', label: 'Build muscle', desc: 'I want to get bigger muscles.', icon: Dumbbell },
  { value: 'lose', label: 'Lose fat', desc: 'I want to get leaner.', icon: Flame },
  { value: 'strong', label: 'Get stronger', desc: 'I want to lift heavier.', icon: TrendingUp },
  { value: 'healthy', label: 'Stay healthy', desc: 'I want to feel fit and healthy.', icon: HeartPulse },
]
const FOCUS_OPTIONS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Glutes', 'Core', 'Abs']
const EXPERIENCE_OPTIONS: { value: Experience; label: string; desc: string; icon: IconCmp }[] = [
  { value: 'beginner', label: 'Beginner', desc: 'Up to 6 months of consistent training.', icon: Footprints },
  { value: 'intermediate', label: 'Intermediate', desc: '6 months to 3 years training consistently.', icon: Signal },
  { value: 'advanced', label: 'Advanced', desc: '3+ years of consistent, structured training.', icon: Zap },
]
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAYS_SHORT: Record<string, string> = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun' }
const SESSION_OPTIONS = [30, 45, 60, 75]
const ALONE_OPTIONS = [
  { value: 'always', label: 'Always' }, { value: 'usually', label: 'Usually' },
  { value: 'sometimes', label: 'Sometimes' }, { value: 'never', label: 'Never' },
]
const ENVIRONMENT_OPTIONS: { value: EnvKey; label: string; desc: string; icon: IconCmp }[] = [
  { value: 'gym', label: 'Full Gym', desc: 'Machines, cables, free weights and common gym equipment.', icon: Dumbbell },
  { value: 'home', label: 'Home Basics', desc: 'A smaller amount of home training equipment.', icon: House },
  { value: 'bodyweight', label: 'Bodyweight', desc: 'Little or no dedicated training equipment.', icon: User },
]
const EQUIPMENT_OPTIONS = ['Pull-up bar', 'Resistance bands', 'Bench or chair', 'Kettlebell']
const EQUIPMENT_HOME = ['Squat rack', 'Barbell', 'Dumbbells', 'Bench or chair', 'Pull-up bar', 'Resistance bands', 'Kettlebell']
const TRAIN_AROUND_OPTIONS = ['Lower back', 'Knees', 'Shoulders', 'Wrists', 'Hips', 'Ankles']
const ACTIVITY_OPTIONS = ['Basketball', 'Football', 'Running', 'Tennis', 'Climbing', 'Martial arts', 'Swimming', 'Cycling', 'Dance', 'Active job', 'Other']
const INTENSITY_OPTIONS: { value: Intensity; label: string }[] = [
  { value: 'easy', label: 'Easy' }, { value: 'moderate', label: 'Moderate' }, { value: 'hard', label: 'Hard' },
]
const SAFETY_QUESTIONS = [
  { id: 's1', text: 'Has a doctor ever said you have a heart condition, or that you should only exercise under medical supervision?' },
  { id: 's2', text: 'Do you feel chest pain during physical activity?' },
  { id: 's3', text: 'In the past month, have you had chest pain when you were not physically active?' },
  { id: 's4', text: 'Do you lose balance because of dizziness, or have you ever lost consciousness?' },
  { id: 's5', text: 'Do you have a bone, joint or soft-tissue problem that physical activity could worsen?' },
  { id: 's6', text: 'Are you currently pregnant, or have you given birth within the past six months?' },
  { id: 's7', text: 'Is there any other reason you should not do physical activity?' },
]
const SAFETY_FOLLOWUPS = [
  { id: 'f1', type: 'yesno', text: 'Is the area painful right now?' },
  { id: 'f2', type: 'yesno', text: 'Are you currently receiving treatment for it?' },
  { id: 'f3', type: 'yesno', text: 'Have you been advised to restrict exercise or particular movements?' },
  { id: 'f4', type: 'choice', text: 'Has the issue fully resolved, or is it still active?', options: [
    { value: 'resolved', label: 'Fully resolved' }, { value: 'active', label: 'Still active' }, { value: 'unsure', label: 'Unsure' },
  ] },
] as const
const MOVEMENT_CATEGORIES = ['Squatting', 'Overhead pressing', 'Deadlifting', 'Pulling', 'Pushing', 'Lunging', 'Jumping', 'Twisting']
const EXERCISE_LIB = ['Barbell Squat', 'Deadlift', 'Bench Press', 'Pull-up', 'Overhead Press', 'Romanian Deadlift', 'Barbell Row', 'Lunge', 'Hip Thrust', 'Lat Pulldown', 'Dumbbell Curl', 'Face Pull', 'Leg Press', 'Plank', 'Dips', 'Bulgarian Split Squat', 'Incline Press', 'Cable Fly', 'Calf Raise', 'Burpee']
const PROCESSING_STAGES = [
  'Reviewing your goals', 'Matching your experience level', 'Building your weekly structure',
  'Working around your commitments', 'Accounting for your equipment', 'Applying your exercise preferences',
  'Checking your safety responses', 'Personalising your StrengthHub experience',
]

/* ─────────────────────── logic (ported from data.jsx) ─────────────────────── */

function normalizeName(raw: string) {
  if (!raw) return ''
  return raw.trim().replace(/\s+/g, ' ').split(' ').map((w) =>
    w.split('-').map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : p)).join('-'),
  ).join(' ')
}
function ageFromDob(dob: string): number | null {
  if (!dob) return null
  const d = new Date(dob)
  if (isNaN(d.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age
}
function firstName(a: Answers) {
  if (!a.name) return 'there'
  return normalizeName(a.name).split(' ')[0]
}
function trainAroundAreas(a: Answers) {
  return (a.trainAround || []).filter((x) => x !== 'None')
}
function joinAreas(list: string[]) {
  const l = list.map((x) => x.toLowerCase())
  if (l.length === 0) return ''
  if (l.length === 1) return l[0]
  return l.slice(0, -1).join(', ') + ' and ' + l[l.length - 1]
}
type Verdict = 'clear' | 'modify' | 'block' | 'donotgenerate'
function evaluateSafety(a: Answers): Verdict {
  const s = a.safety || {}
  if (s.s3 === 'yes') return 'donotgenerate'
  if (s.s1 === 'yes' || s.s2 === 'yes' || s.s4 === 'yes' || s.s6 === 'yes' || s.s7 === 'yes') return 'block'
  const areas = trainAroundAreas(a)
  const f = a.followup || {}
  if (areas.length > 0) {
    if (f.f1 === 'yes' || f.f2 === 'yes' || f.f3 === 'yes' || f.f4 === 'active' || f.f4 === 'unsure') return 'block'
    return 'modify'
  }
  if (s.s5 === 'yes') return 'block'
  return 'clear'
}
function needsFollowup(a: Answers) {
  return trainAroundAreas(a).length > 0
}
const targetsFor = (goal: Goal) => {
  switch (goal) {
    case 'build-muscle': return { calorieTarget: 2600, proteinTarget: 170, carbTarget: 300, fatTarget: 75 }
    case 'lose-fat': return { calorieTarget: 1900, proteinTarget: 165, carbTarget: 180, fatTarget: 60 }
    case 'gain-strength': return { calorieTarget: 2500, proteinTarget: 160, carbTarget: 280, fatTarget: 80 }
    default: return { calorieTarget: 2200, proteinTarget: 140, carbTarget: 240, fatTarget: 70 }
  }
}
const GOAL_MAP: Record<GoalKey, Goal> = { build: 'build-muscle', lose: 'lose-fat', strong: 'gain-strength', healthy: 'stay-healthy' }
const EQUIP_MAP: Record<EnvKey, Equipment> = { gym: 'full-gym', home: 'home-basic', bodyweight: 'dorm-bodyweight' }

/* personalisation copy (verbatim from data.jsx) */
function goalMessage(a: Answers) {
  const map: Record<GoalKey, { title: string; sub: string }> = {
    build: { title: 'Build muscle', sub: 'We’ll focus on progressive overload and enough volume to grow.' },
    lose: { title: 'Lose fat', sub: 'We’ll pair strength work with a plan that keeps you in a deficit.' },
    strong: { title: 'Get stronger', sub: 'We’ll build your plan around the big lifts and steady strength gains.' },
    healthy: { title: 'Stay healthy', sub: 'We’ll keep you moving with balanced, sustainable training.' },
  }
  return map[(a.goal || 'build') as GoalKey]
}
function focusMessage(a: Answers) {
  const f = (a.focus || []).filter(Boolean)
  if (f.length === 0) return { title: 'We’ll keep it balanced', sub: 'Your plan will train every major muscle group evenly.' }
  if (f.length === 1) return { title: `Extra attention on your ${f[0].toLowerCase()}`, sub: `We’ll add targeted volume so your ${f[0].toLowerCase()} gets the focus you want.` }
  return { title: `Extra work for your ${f[0].toLowerCase()} and ${f[1].toLowerCase()}`, sub: 'Your plan will prioritise both areas alongside your main goal.' }
}
function sessionMessage(a: Answers) {
  const v = a.session || 60
  return { title: `${v} minute sessions`, sub: `We’ll build workouts that fit comfortably into ${v} minutes.` }
}
function equipmentMessage(a: Answers) {
  if (a.environment === 'gym') return { title: 'Full gym access', sub: 'We’ll make the most of the machines and free weights available to you.' }
  if (a.environment === 'home') return { title: 'Built for home', sub: 'Your plan will work with the space and kit you have at home.' }
  return { title: 'Bodyweight ready', sub: 'We’ll build effective sessions that need little to no equipment.' }
}
function activityMessage(a: Answers) {
  const acts = (a.activities || []).filter((x) => x !== 'None' && x !== 'Other')
  const first = acts[0]
  if (!first) return { title: 'Balanced with your week', sub: 'We’ll shape your training around your everyday routine.' }
  return { title: `Working around your ${first.toLowerCase()}`, sub: `We’ll balance your training load so it complements your ${first.toLowerCase()}.` }
}
function daysMessage(a: Answers) {
  const n = (a.days || []).length
  if (n <= 2) return 'We’ll keep your plan realistic and focused.'
  if (n === 3) return 'Three days a week is enough to make strong progress.'
  if (n === 4) return 'We’ll build a balanced four day schedule around these days.'
  return `We’ll shape a flexible plan around your ${n} available days.`
}

/* ────────────────────────────── flow builder ─────────────────────────────── */

type Step = { id: string; type: string; section: string; [k: string]: any }

function buildFlow(a: Answers): Step[] {
  const flow: Step[] = []
  const push = (s: Step) => flow.push(s)

  // SECTION: About You
  push({ id: 'a1', type: 'text', section: 'about', key: 'name', title: 'What should we call you?', sub: 'This is what your coach will refer to you as.', placeholder: 'Your name', required: true })
  push({ id: 'a2', type: 'date', section: 'about', key: 'dob', title: 'When were you born?', sub: 'This helps us build your workout.' })
  push({ id: 'a4', type: 'single', section: 'about', key: 'sex', title: 'Which option best describes you?', sub: 'This may help improve nutrition, sleep and water estimates. It doesn’t change your workouts.', options: SEX_OPTIONS })
  push({ id: 'b1', type: 'measure', section: 'about', key: 'height', kind: 'height', title: 'What’s your height?', sub: 'This will help with your nutrition guidance.' })
  push({ id: 'b2', type: 'measure', section: 'about', key: 'weight', kind: 'weight', title: 'What’s your current weight?', sub: 'This helps choose your starting weights and gives us a benchmark to track your progress.' })
  push({ id: 'b3', type: 'measure', section: 'about', key: 'goalWeight', kind: 'goalweight', title: 'Do you have a goal weight?', sub: 'This is so you can track your progress. You can change it later.' })

  // SECTION: Your Goals
  push({ id: 'c1', type: 'single', section: 'goals', key: 'goal', title: 'What’s your main goal?', sub: 'This will help build your workout plan.', options: GOAL_OPTIONS, cards: true })
  push({ id: 'p_goal', type: 'interstitial', section: 'goals', compute: goalMessage })
  push({ id: 'c2', type: 'multi', section: 'goals', key: 'focus', title: 'Anywhere you especially want to grow?', sub: 'Choose up to two areas. This is optional.', options: FOCUS_OPTIONS, max: 2, optional: true })
  push({ id: 'p_focus', type: 'interstitial', section: 'goals', compute: focusMessage })

  // SECTION: Your Training
  push({ id: 'd1', type: 'single', section: 'training', key: 'experience', title: 'How experienced are you with training?', options: EXPERIENCE_OPTIONS, cards: true })
  if (a.experience === 'intermediate') {
    push({ id: 'd2', type: 'single', section: 'training', key: 'structured', title: 'Have you followed a structured training program before?', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }], autoAdvance: true })
    if (a.structured === 'no') push({ id: 'p_structured', type: 'interstitial', section: 'training', compute: () => ({ title: 'No problem at all', sub: 'We’ll give you a clear structure to follow from day one.' }) })
  }
  push({ id: 'mid', type: 'midtransition', section: 'training' })
  push({ id: 'e1', type: 'multi', section: 'training', key: 'days', title: 'Which days can you train?', sub: 'Choose every day that could realistically work.', options: DAYS, weekday: true, note: 'You can always change your days later if things get busy.' })
  push({ id: 'e2', type: 'single', section: 'training', key: 'session', title: 'How long can you usually train?', sub: 'This helps us shape your workout plan.', options: SESSION_OPTIONS.map((v) => ({ value: v, label: `${v} minutes`, flag: v === (a.experience === 'beginner' ? 45 : 60) ? 'Suggested' : undefined })) })
  push({ id: 'p_session', type: 'interstitial', section: 'training', compute: sessionMessage })
  push({ id: 'e3', type: 'single', section: 'training', key: 'alone', title: 'Do you usually train alone?', sub: 'This helps us decide your exercise selection and when someone may be able to help you.', options: ALONE_OPTIONS })
  push({ id: 'f1', type: 'single', section: 'training', key: 'environment', title: 'What equipment do you normally have access to?', options: ENVIRONMENT_OPTIONS, cards: true })
  if (a.environment === 'home' || a.environment === 'bodyweight') {
    push({ id: 'f2', type: 'multi', section: 'training', key: 'equipment', title: 'Do you have any of these?', sub: 'Select everything you can regularly use.', options: a.environment === 'home' ? EQUIPMENT_HOME : EQUIPMENT_OPTIONS, optional: true })
  }
  push({ id: 'p_equip', type: 'interstitial', section: 'training', compute: equipmentMessage })

  // SECTION: Your Lifestyle
  push({ id: 'g1', type: 'multi', section: 'lifestyle', key: 'trainAround', title: 'Any body parts we should train around?', sub: 'Select any areas that need a bit of extra care.', options: TRAIN_AROUND_OPTIONS, noneValue: 'None', exclusiveNone: true, optional: true, selectNote: 'We’ll ask you a little more about this at the end of onboarding.' })
  push({ id: 'g2', type: 'text', section: 'lifestyle', key: 'moreInfo', title: 'Anything else we should know?', sub: 'This does not replace the safety check completed later.', placeholder: 'Tell us about anything that may affect your training or experience.', optional: true, multiline: true })
  push({ id: 'h1', type: 'multi', section: 'lifestyle', key: 'activities', title: 'Are you active outside the gym?', sub: 'This helps us make sure your training works with the rest of your week.', options: ACTIVITY_OPTIONS, otherValue: 'Other', otherKey: 'activityOther', optional: true, skipLabel: 'No other activity' })
  if ((a.activities || []).filter((x) => x !== 'None').length > 0) {
    push({ id: 'h2', type: 'activitydetail', section: 'lifestyle', key: 'activityDetail', title: 'Tell us about your activities', sub: 'When you do each one, and how demanding it usually is.', optional: true, skipLabel: 'Skip, I’ll log these later' })
    push({ id: 'p_activity', type: 'interstitial', section: 'lifestyle', compute: activityMessage })
  }
  push({ id: 'i1', type: 'search', section: 'lifestyle', key: 'loveExercises', title: 'Are there any exercises you love?', sub: 'We’ll prioritise them where they fit your plan.', optional: true, mode: 'love' })
  push({ id: 'i2', type: 'search', section: 'lifestyle', key: 'avoidExercises', title: 'Any exercises you’d rather never do?', sub: 'We won’t include exercises you exclude.', optional: true, mode: 'avoid' })
  push({ id: 'j1', type: 'text', section: 'lifestyle', key: 'motivation', title: 'What’s driving you?', sub: 'There’s no wrong answer. This helps make your experience feel more relevant to you.', placeholder: 'e.g. I want to feel fitter and build a routine I can keep', optional: true, multiline: true, appendPrompts: true, prompts: ['I want to look better', 'I’m getting ready for summer', 'I want to feel fitter', 'I want to build a better routine', 'I want to feel more confident', 'I want to prove I can stay consistent'] })
  push({ id: 'p_motivation', type: 'interstitial', section: 'lifestyle', compute: () => ({ title: 'That’s worth working toward', sub: 'We’ll keep this front of mind as we build your plan.' }) })

  // SECTION: Safety — injury follow-up first (if flagged), then the rapid check
  if (needsFollowup(a)) {
    push({ id: 'fintro', type: 'followupintro', section: 'safety' })
    SAFETY_FOLLOWUPS.forEach((q) => push({ id: q.id, type: 'followup', section: 'safety', key: q.id, q }))
    push({ id: 'fmoves', type: 'movements', section: 'safety', key: 'movements', title: 'Which movements cause discomfort?', sub: 'Optional. Select any that apply and add your own.' })
  }
  push({ id: 'safetyall', type: 'safetyall', section: 'safety' })
  const v = evaluateSafety(a)
  if (v !== 'clear' && v !== 'modify') push({ id: 'outcome', type: 'safetyoutcome', section: 'safety' })

  return flow
}

const isTransient = (t: string) => t === 'interstitial' || t === 'midtransition'

/* ─────────────────────────── animation primitives ────────────────────────── */

/** Soft fade-and-rise on enter (headings, options, cards). */
function Reveal({ delay = 0, children }: { delay?: number; children: ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    anim.setValue(0)
    Animated.timing(anim, { toValue: 1, duration: 440, delay, easing: EASE, useNativeDriver: NATIVE }).start()
  }, [anim, delay])
  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
      {children}
    </Animated.View>
  )
}

/** Stagger a list of children with an increasing delay. */
function Stagger({ start = 150, step = 58, children }: { start?: number; step?: number; children: ReactNode[] }) {
  return <>{children.map((c, i) => <Reveal key={i} delay={start + i * step}>{c}</Reveal>)}</>
}

/**
 * Directional slide+fade between screens. `animKey` changing re-runs the enter
 * animation; `dir` decides which side the incoming view slides in from.
 */
function Stage({ animKey, dir, children }: { animKey: string; dir: 'fwd' | 'back'; children: ReactNode }) {
  const x = useRef(new Animated.Value(0)).current
  const o = useRef(new Animated.Value(1)).current
  useEffect(() => {
    x.setValue(dir === 'back' ? -34 : 34)
    o.setValue(0)
    Animated.parallel([
      Animated.timing(x, { toValue: 0, duration: 380, easing: EASE, useNativeDriver: NATIVE }),
      Animated.timing(o, { toValue: 1, duration: 300, easing: EASE, useNativeDriver: NATIVE }),
    ]).start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey])
  return <Animated.View style={{ flex: 1, opacity: o, transform: [{ translateX: x }] }}>{children}</Animated.View>
}

/* ─────────────────────────── shared UI helpers ───────────────────────────── */

function QHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <View className="mb-6">
      <Reveal delay={40}><Text className="text-[27px] font-extrabold leading-8 tracking-tight text-white">{title}</Text></Reveal>
      {sub ? <Reveal delay={120}><Text className="mt-2.5 text-[15px] leading-6 text-white/55">{sub}</Text></Reveal> : null}
    </View>
  )
}

/** Premium segmented progress: one bar per section, fill animates smoothly. */
function ProgressHeader({ sectionIdx, sectionProgress, onBack }: { sectionIdx: number; sectionProgress: number; onBack: () => void }) {
  const fills = useRef(SECTIONS.map(() => new Animated.Value(0))).current
  useEffect(() => {
    fills.forEach((f, i) => {
      const target = i < sectionIdx ? 1 : i === sectionIdx ? sectionProgress : 0
      Animated.timing(f, { toValue: target, duration: 600, easing: EASE, useNativeDriver: false }).start()
    })
  }, [fills, sectionIdx, sectionProgress])
  return (
    <View className="px-4 pb-1 pt-1">
      <View className="mb-2 flex-row items-center gap-1.5">
        <Pressable onPress={() => { tick(); onBack() }} hitSlop={12} className="h-10 w-10 items-center justify-center rounded-full active:opacity-60">
          <ChevronLeft size={22} color="rgba(255,255,255,0.7)" />
        </Pressable>
        <View className="flex-1 flex-row gap-1.5">
          {SECTIONS.map((s, i) => (
            <View key={s.id} className="h-[5px] flex-1 overflow-hidden rounded-full bg-white/12">
              <Animated.View className="h-full rounded-full bg-brand-400" style={{ width: fills[i].interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
            </View>
          ))}
        </View>
        <View className="w-8" />
      </View>
      <Text className="ml-[42px] text-[12px] font-semibold uppercase tracking-[0.06em] text-brand-300">{SECTIONS[sectionIdx]?.label}</Text>
    </View>
  )
}

/** Bottom action bar with an optional secondary skip link. */
function ActionBar({ label = 'Continue', disabled, onPress, hint, skipLabel, onSkip }: {
  label?: string; disabled?: boolean; onPress: () => void; hint?: string; skipLabel?: string; onSkip?: () => void
}) {
  return (
    <View className="px-5 pb-8 pt-2">
      {hint ? <Text className="mb-2.5 text-center text-[13px] text-white/50">{hint}</Text> : null}
      <PressableScale disabled={disabled} onPress={() => { thud(); onPress() }} className={`h-[54px] items-center justify-center rounded-full bg-brand-400 ${disabled ? 'opacity-40' : ''}`}>
        <Text className={`text-base font-bold ${disabled ? 'text-white/40' : 'text-black'}`}>{label}</Text>
      </PressableScale>
      {onSkip ? (
        <Pressable onPress={() => { tick(); onSkip() }} className="mt-1.5 h-10 items-center justify-center active:opacity-70">
          <Text className="text-[15px] font-semibold text-white/50">{skipLabel || 'Skip'}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

function Radio({ selected }: { selected: boolean }) {
  return (
    <View className={`h-6 w-6 items-center justify-center rounded-full border-2 ${selected ? 'border-brand-400 bg-brand-400' : 'border-white/25'}`}>
      {selected ? <Check size={14} strokeWidth={3} color="#08140a" /> : null}
    </View>
  )
}

/** Rich single-select row/card. `Icon` renders a tinted lucide glyph for cards. */
function OptionCard({ selected, onPress, title, desc, glyph, Icon, flag }: {
  selected: boolean; onPress: () => void; title: string; desc?: string; glyph?: string; Icon?: IconCmp; flag?: string
}) {
  const colors = useColors()
  return (
    <PressableScale scaleTo={0.985} onPress={onPress} className={`w-full flex-row items-center gap-3.5 rounded-[18px] border p-4 ${selected ? 'border-brand-400 bg-brand-400/10' : 'border-white/8 bg-ink-800'}`}>
      {Icon ? (
        <View className={`h-11 w-11 items-center justify-center rounded-[14px] ${selected ? 'bg-brand-400/18' : 'bg-white/6'}`}>
          <Icon size={23} color={selected ? colors.brand300 : 'rgba(255,255,255,0.6)'} />
        </View>
      ) : glyph ? (
        <View className={`h-10 w-10 items-center justify-center rounded-xl ${selected ? 'bg-brand-400/18' : 'bg-white/6'}`}>
          <Text className={`text-xl ${selected ? 'text-brand-300' : 'text-white/60'}`}>{glyph}</Text>
        </View>
      ) : null}
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-[16.5px] font-bold text-white">{title}</Text>
          {flag ? <Text className="overflow-hidden rounded-full bg-brand-400/16 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-300">{flag}</Text> : null}
        </View>
        {desc ? <Text className="mt-1 text-[13.5px] leading-5 text-white/50">{desc}</Text> : null}
      </View>
      <Radio selected={selected} />
    </PressableScale>
  )
}

/** Pill chip for multi-select. */
function Chip({ on, label, disabled, onPress }: { on: boolean; label: string; disabled?: boolean; onPress: () => void }) {
  const colors = useColors()
  return (
    <Pressable disabled={disabled && !on} onPress={() => { tick(); onPress() }} className={`flex-row items-center gap-1.5 rounded-full border px-4 py-3 active:opacity-90 ${on ? 'border-brand-400 bg-brand-400/16' : disabled ? 'border-white/5 bg-ink-800 opacity-40' : 'border-white/8 bg-ink-800'}`}>
      {on ? <Check size={14} strokeWidth={3} color={colors.brand300} /> : null}
      <Text className={`text-[15px] font-semibold ${on ? 'text-brand-300' : disabled ? 'text-white/30' : 'text-white/80'}`}>{label}</Text>
    </Pressable>
  )
}

/** Animated success ring + tick. */
function Checkmark({ size = 76 }: { size?: number }) {
  const colors = useColors()
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: NATIVE, speed: 12, bounciness: 8 }).start()
  }, [anim])
  return (
    <Animated.View style={{ width: size, height: size, borderRadius: size / 2, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }], opacity: anim }} className="items-center justify-center border-2 border-brand-400/40 bg-brand-400/10">
      <Check size={size * 0.5} strokeWidth={3} color={colors.brand400} />
    </Animated.View>
  )
}

/** Scaffold: scroll body over a pinned footer (no remounts — keeps input focus). */
function Scaffold({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <View className="flex-1">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
      {footer}
    </View>
  )
}

/* ──────────────────────────── the screen ─────────────────────────────────── */

type Phase = 'welcome' | 'flow' | 'gate-under16' | 'gate-guardian' | 'terms' | 'processing' | 'summary' | 'account'

export default function Onboarding() {
  const dispatch = useDispatch()
  const [answers, setAnswers] = useState<Answers>(DEFAULT_ANSWERS)
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd')
  const [phase, setPhase] = useState<Phase>('welcome')
  const [returnToSummary, setReturnToSummary] = useState(false)
  const set = <K extends keyof Answers>(k: K, v: Answers[K]) => setAnswers((a) => ({ ...a, [k]: v }))

  const flow = useMemo(() => buildFlow(answers), [answers])
  const step = flow[Math.min(index, flow.length - 1)]

  const sectionIdx = step ? SECTIONS.findIndex((s) => s.id === step.section) : 0
  const sectionSteps = step ? flow.filter((s) => s.section === step.section) : []
  const sectionProgress = sectionSteps.length <= 1 ? 1 : sectionSteps.indexOf(step) / sectionSteps.length

  const advance = () => {
    if (returnToSummary) { setReturnToSummary(false); setDir('back'); setPhase('summary'); return }
    setDir('fwd')
    setIndex((i) => Math.min(i + 1, flow.length - 1))
  }

  const back = () => {
    setDir('back')
    let i = index - 1
    while (i >= 0 && flow[i] && isTransient(flow[i].type)) i -= 1
    if (i < 0) { setPhase('welcome'); return }
    setIndex(i)
  }

  const onContinue = () => {
    if (!step) return
    if (step.key === 'name' && answers.name) set('name', normalizeName(answers.name))
    if (step.key === 'dob') {
      const age = ageFromDob(answers.dob)
      if (age !== null && age < 16) { setDir('fwd'); setPhase('gate-under16'); return }
      if (age !== null && age < 18 && !answers.guardianConsent) { setDir('fwd'); setPhase('gate-guardian'); return }
    }
    if (step.type === 'safetyoutcome') { setDir('fwd'); setPhase('terms'); return }
    // clear / modify have no outcome screen — the rapid check is the last step
    if (step.type === 'safetyall' && !(flow[index + 1] && flow[index + 1].type === 'safetyoutcome')) { setDir('fwd'); setPhase('terms'); return }
    advance()
  }

  const onEdit = (stepId: string) => {
    const i = flow.findIndex((s) => s.id === stepId)
    if (i >= 0) { setReturnToSummary(true); setDir('back'); setPhase('flow'); setIndex(i) }
  }

  const restart = () => { setAnswers(DEFAULT_ANSWERS); setIndex(0); setReturnToSummary(false); setDir('fwd'); setPhase('welcome') }

  function finish() {
    const goal = GOAL_MAP[(answers.goal || 'build') as GoalKey]
    const injuries = [joinAreas(trainAroundAreas(answers)), answers.moreInfo.trim()].filter(Boolean).join('. ')
    const profile: Partial<Profile> = {
      name: normalizeName(answers.name) || 'Athlete',
      age: ageFromDob(answers.dob) ?? 20,
      goal,
      experience: (answers.experience || 'beginner') as Experience,
      daysPerWeek: answers.days.length || 3,
      sessionMinutes: answers.session,
      equipment: EQUIP_MAP[(answers.environment || 'gym') as EnvKey],
      newToGym: answers.experience === 'beginner',
      heightCm: answers.height,
      startWeightKg: Math.round(answers.weight * 10) / 10,
      goalWeightKg: answers.noGoalWeight ? Math.round(answers.weight * 10) / 10 : Math.round(answers.goalWeight * 10) / 10,
      injuries,
      motivation: answers.motivation.trim(),
      budgetMode: false,
      dietaryPrefs: [],
      createdAtKey: todayKey,
      ...targetsFor(goal),
    }
    if (answers.sex) profile.sex = answers.sex
    thud()
    dispatch({ type: 'COMPLETE_ONBOARDING', profile })
  }

  /* out-of-flow phases */
  let view: ReactNode
  let viewKey = phase
  if (phase === 'welcome') view = <Welcome onStart={() => { setDir('fwd'); setPhase('flow'); setIndex(0) }} />
  else if (phase === 'gate-under16') view = <Under16 onBack={() => { setDir('back'); setPhase('flow') }} />
  else if (phase === 'gate-guardian') view = <Guardian answers={answers} set={set} onBack={() => { setDir('back'); setPhase('flow') }} onContinue={() => { set('guardianConsent', true); setPhase('flow'); advance() }} />
  else if (phase === 'terms') view = <Terms answers={answers} set={set} onBack={() => { setDir('back'); setPhase('flow'); setIndex(flow.length - 1) }} onContinue={() => { setDir('fwd'); setPhase('processing') }} />
  else if (phase === 'processing') view = <Processing onDone={() => { setDir('fwd'); setPhase('summary') }} />
  else if (phase === 'summary') view = <Summary answers={answers} onContinue={() => { setDir('fwd'); setPhase('account') }} onEdit={onEdit} onBack={() => { setDir('back'); setPhase('flow'); setIndex(flow.length - 1) }} />
  else if (phase === 'account') view = <AccountCreate answers={answers} onComplete={finish} onBack={() => { setDir('back'); setPhase('summary') }} />
  else {
    viewKey = 'flow:' + step?.id
    view = (
      <View className="flex-1">
        <ProgressHeader sectionIdx={sectionIdx} sectionProgress={sectionProgress} onBack={back} />
        <StepView step={step} answers={answers} set={set} onContinue={onContinue} onAdvance={advance} onRestart={restart} />
      </View>
    )
  }

  return <Stage animKey={viewKey} dir={dir}>{view}</Stage>
}

/* ─────────────────────────── per-step renderer ───────────────────────────── */

function StepView({ step, answers, set, onContinue, onAdvance, onRestart }: {
  step: Step; answers: Answers; set: <K extends keyof Answers>(k: K, v: Answers[K]) => void
  onContinue: () => void; onAdvance: () => void; onRestart: () => void
}) {
  const colors = useColors()
  if (!step) return null

  switch (step.type) {
    case 'text': {
      const key = step.key as keyof Answers
      const val = (answers[key] as string) || ''
      const ok = step.optional || val.trim().length > 0
      const showName = step.key === 'name' && val.trim().length > 0
      return (
        <Scaffold footer={<ActionBar disabled={!ok} onPress={onContinue} onSkip={step.optional && !val.trim() ? onAdvance : undefined} skipLabel="Skip" />}>
          <QHeader title={step.title} sub={step.sub} />
          <Reveal delay={180}>
            <TextInput
              autoFocus value={val} onChangeText={(t) => set(key, t as any)}
              placeholder={step.placeholder} placeholderTextColor="rgba(255,255,255,0.32)"
              multiline={!!step.multiline}
              className="w-full rounded-2xl border border-white/8 bg-ink-800 px-4 py-4 text-[18px] font-semibold text-white"
              style={step.multiline ? { minHeight: 120, fontWeight: '400', textAlignVertical: 'top' } : undefined}
            />
          </Reveal>
          {showName ? (
            <Reveal delay={40}><Text className="mt-4 text-[15px] font-semibold text-brand-300">Great to meet you, {normalizeName(val).split(' ')[0]}.</Text></Reveal>
          ) : null}
          {step.prompts ? (
            <View className="mt-5">
              <Text className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-white/40">Need a nudge?</Text>
              <View className="flex-row flex-wrap gap-2">
                {(step.prompts as string[]).map((p, i) => {
                  const on = val.toLowerCase().includes(p.toLowerCase())
                  return (
                    <Reveal key={p} delay={200 + i * 40}>
                      <Pressable onPress={() => { if (on) return; tick(); const cur = val.trim(); set(key, (cur ? cur + '. ' + p : p) as any) }} className={`flex-row items-center gap-1.5 rounded-full border px-3.5 py-2 active:opacity-80 ${on ? 'border-brand-400/70 bg-brand-400/16' : 'border-white/6 bg-ink-700'}`}>
                        {on ? <Check size={13} strokeWidth={3} color={colors.brand300} /> : <Plus size={13} strokeWidth={2.4} color="rgba(255,255,255,0.4)" />}
                        <Text className={`text-[13.5px] font-semibold ${on ? 'text-brand-300' : 'text-white/70'}`}>{p}</Text>
                      </Pressable>
                    </Reveal>
                  )
                })}
              </View>
            </View>
          ) : null}
        </Scaffold>
      )
    }

    case 'date':
      return <DateStep answers={answers} set={set} title={step.title} sub={step.sub} onContinue={onContinue} />

    case 'single': {
      const key = step.key as keyof Answers
      const cur = answers[key]
      return (
        <Scaffold footer={step.autoAdvance ? undefined : <ActionBar disabled={cur === '' || cur === undefined} onPress={onContinue} />}>
          <QHeader title={step.title} sub={step.sub} />
          <View className="gap-2.5">
            <Stagger start={170} step={58}>
              {step.options.map((o: any) => (
                <OptionCard
                  key={String(o.value)} selected={cur === o.value} title={o.label}
                  desc={step.cards ? o.desc : undefined} glyph={o.glyph} Icon={step.cards ? o.icon : undefined} flag={o.flag}
                  onPress={() => { tick(); set(key, o.value as any); if (step.autoAdvance) setTimeout(onContinue, 240) }}
                />
              ))}
            </Stagger>
          </View>
        </Scaffold>
      )
    }

    case 'multi': {
      const key = step.key as keyof Answers
      const cur = (answers[key] as string[]) || []
      const noneOn = step.noneValue ? cur.includes(step.noneValue) : false
      const count = cur.filter((x) => x !== step.noneValue).length
      const atMax = step.max ? count >= step.max : false
      const toggle = (v: string) => {
        tick()
        if (step.noneValue && v === step.noneValue) { set(key, (noneOn ? [] : [step.noneValue]) as any); return }
        let next = cur.filter((x) => (step.exclusiveNone ? x !== step.noneValue : true))
        if (next.includes(v)) next = next.filter((x) => x !== v)
        else { if (atMax) return; next = [...next, v] }
        set(key, next as any)
      }
      const showOther = step.otherValue && cur.includes(step.otherValue)
      const disabled = step.weekday ? cur.length === 0 : step.skipLabel ? count === 0 : step.optional ? false : count === 0
      return (
        <Scaffold footer={<ActionBar disabled={disabled} onPress={onContinue} onSkip={(step.optional || step.skipLabel) && count === 0 ? onAdvance : undefined} skipLabel={step.skipLabel || 'Skip'} />}>
          <QHeader title={step.title} sub={step.sub} />
          {step.max ? (
            <View className="mb-3">
              <Text className={`self-start overflow-hidden rounded-full px-3 py-1 text-[12.5px] font-bold ${atMax ? 'bg-brand-400/16 text-brand-300' : 'bg-white/8 text-white/60'}`}>{count}/{step.max} selected{atMax ? ' · limit reached' : ''}</Text>
            </View>
          ) : null}
          <View className="flex-row flex-wrap gap-2.5">
            <Stagger start={150} step={38}>
              {step.options.map((o: string) => {
                const label = step.weekday ? DAYS_SHORT[o] : o
                const on = cur.includes(o)
                return <Chip key={o} on={on} label={label} disabled={atMax && !on} onPress={() => toggle(o)} />
              }).concat(step.noneValue ? [<Chip key="__none" on={noneOn} label={step.noneValue} onPress={() => toggle(step.noneValue)} />] : [])}
            </Stagger>
          </View>
          {step.weekday && cur.length > 0 ? (
            <View className="mt-4 rounded-[14px] border border-brand-400/18 bg-brand-400/8 px-4 py-3">
              <Text className="text-[14px] font-semibold text-brand-300">{daysMessage(answers)}</Text>
            </View>
          ) : null}
          {step.weekday && step.note ? <Text className="mt-3 text-[13px] leading-5 text-white/40">{step.note}</Text> : null}
          {step.selectNote && count > 0 ? (
            <View className="mt-4 flex-row items-start gap-2.5 rounded-[14px] border border-brand-400/18 bg-brand-400/8 px-4 py-3">
              <ShieldAlert size={17} color={colors.brand300} style={{ marginTop: 1 }} />
              <Text className="flex-1 text-[13.5px] leading-5 text-brand-300">{step.selectNote}</Text>
            </View>
          ) : null}
          {showOther ? (
            <View className="mt-4">
              <TextInput value={answers.activityOther} onChangeText={(t) => set('activityOther', t)} placeholder="What activity is it?" placeholderTextColor="rgba(255,255,255,0.32)" className="w-full rounded-[14px] border border-white/8 bg-ink-800 px-4 py-3.5 text-[15.5px] text-white" />
            </View>
          ) : null}
        </Scaffold>
      )
    }

    case 'measure': {
      const key = step.key as 'height' | 'weight' | 'goalWeight'
      return (
        <Scaffold footer={
          <View>
            <ActionBar onPress={onContinue} />
            {step.kind === 'goalweight' ? (
              <Pressable onPress={() => { thud(); set('noGoalWeight', true); onContinue() }} className="-mt-6 mb-6 h-10 items-center justify-center active:opacity-70">
                <Text className="text-[14.5px] font-semibold text-white/55">I don&apos;t have a goal weight</Text>
              </Pressable>
            ) : null}
          </View>
        }>
          <QHeader title={step.title} sub={step.sub} />
          <Reveal delay={160}>
            <View className="mt-1">
              {step.kind === 'height'
                ? <HeightRuler value={answers.height} onChange={(v) => set('height', v)} min={120} max={220} />
                : <WeightDial value={answers[key] as number} onChange={(v) => set(key, v as any)} min={35} max={200} />}
            </View>
          </Reveal>
        </Scaffold>
      )
    }

    case 'interstitial':
      return <Interstitial message={step.compute(answers)} onAdvance={onAdvance} />

    case 'midtransition':
      return <MidTransition onDone={onAdvance} />

    case 'followupintro': {
      const areas = joinAreas(trainAroundAreas(answers))
      return (
        <View className="flex-1">
          <View className="flex-1 justify-center px-7">
            <Reveal><Text className="mb-3.5 text-[12.5px] font-bold uppercase tracking-[0.08em] text-brand-300">Extra care</Text></Reveal>
            <Reveal delay={120}><Text className="text-[26px] font-extrabold leading-8 tracking-tight text-white">About your {areas || 'flagged area'}</Text></Reveal>
            <Reveal delay={200}><Text className="mt-3.5 text-[15.5px] leading-6 text-white/60">You mentioned this may need extra care. Just a few quick questions so we can work around it and see how we can help.</Text></Reveal>
          </View>
          <ActionBar label="Continue" onPress={onAdvance} />
        </View>
      )
    }

    case 'followup': {
      const q = step.q
      const cur = answers.followup[q.id]
      const opts = q.type === 'choice' ? q.options : [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]
      const isYesNo = q.type === 'yesno'
      return (
        <View className="flex-1">
          <View className="flex-1 justify-center px-6">
            <Reveal><Text className="mb-7 text-2xl font-bold leading-8 text-white">{q.text}</Text></Reveal>
            <View className="gap-2.5">
              <Stagger start={160} step={60}>
                {opts.map((o: any) => (
                  <OptionCard key={o.value} selected={cur === o.value} title={o.label}
                    onPress={() => { tick(); set('followup', { ...answers.followup, [q.id]: o.value }); if (isYesNo) setTimeout(onAdvance, 280) }} />
                ))}
              </Stagger>
            </View>
          </View>
          {isYesNo ? <View className="pb-8" /> : <ActionBar disabled={!cur} onPress={onAdvance} />}
        </View>
      )
    }

    case 'movements': {
      const cur = answers.movements
      return (
        <Scaffold footer={<ActionBar label="Continue" onPress={onAdvance} onSkip={cur.length === 0 && !answers.movementsOther ? onAdvance : undefined} skipLabel="Nothing specific" />}>
          <QHeader title={step.title} sub={step.sub} />
          <View className="flex-row flex-wrap gap-2.5">
            <Stagger start={150} step={38}>
              {MOVEMENT_CATEGORIES.map((m) => <Chip key={m} on={cur.includes(m)} label={m} onPress={() => { tick(); set('movements', cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]) }} />)}
            </Stagger>
          </View>
          <View className="mt-4">
            <TextInput value={answers.movementsOther} onChangeText={(t) => set('movementsOther', t)} multiline placeholder="Anything else you'd like to describe (optional)" placeholderTextColor="rgba(255,255,255,0.32)" className="w-full rounded-[14px] border border-white/8 bg-ink-800 px-4 py-3.5 text-[15px] text-white" style={{ minHeight: 72, textAlignVertical: 'top' }} />
          </View>
        </Scaffold>
      )
    }

    case 'search':
      return <SearchStep step={step} answers={answers} set={set} onContinue={onContinue} onSkip={onAdvance} />

    case 'activitydetail':
      return <ActivityDetailStep answers={answers} set={set} title={step.title} sub={step.sub} skipLabel={step.skipLabel} onContinue={onContinue} onSkip={onAdvance} />

    case 'safetyall': {
      const done = SAFETY_QUESTIONS.every((q) => answers.safety[q.id])
      const answered = SAFETY_QUESTIONS.filter((q) => answers.safety[q.id]).length
      return (
        <Scaffold footer={<ActionBar disabled={!done} onPress={onContinue} hint={!done ? `${answered} of ${SAFETY_QUESTIONS.length} answered` : undefined} />}>
          <QHeader title="Our final 7 second safety check" sub="Tap Yes or No for each." />
          <View className="gap-2.5">
            {SAFETY_QUESTIONS.map((q, i) => (
              <Reveal key={q.id} delay={110 + i * 45}>
                <View className={`rounded-2xl border p-3.5 ${answers.safety[q.id] === 'yes' ? 'border-accent-orange/40' : 'border-white/8'} bg-ink-800`}>
                  <Text className="text-[13.8px] leading-5 text-white/85">{q.text}</Text>
                  <View className="mt-3 flex-row gap-2">
                    {(['no', 'yes'] as const).map((v) => {
                      const on = answers.safety[q.id] === v
                      const warn = v === 'yes' && on
                      return (
                        <Pressable key={v} onPress={() => { tick(); set('safety', { ...answers.safety, [q.id]: v }) }} className={`h-10 flex-1 items-center justify-center rounded-xl border active:opacity-90 ${on ? (warn ? 'border-accent-orange/70 bg-accent-orange/16' : 'border-brand-400 bg-brand-400/16') : 'border-transparent bg-ink-700'}`}>
                          <Text className={`text-[14.5px] font-bold ${on ? (warn ? 'text-accent-orange' : 'text-brand-300') : 'text-white/60'}`}>{v === 'yes' ? 'Yes' : 'No'}</Text>
                        </Pressable>
                      )
                    })}
                  </View>
                </View>
              </Reveal>
            ))}
          </View>
        </Scaffold>
      )
    }

    case 'safetyoutcome': {
      const verdict = evaluateSafety(answers)
      const cfg: Record<string, { title: string; body: string; danger?: boolean }> = {
        block: { title: 'Please speak with a qualified health professional before continuing', body: 'Based on your answers, we can’t safely generate a training program for you yet. Please speak with a GP, physiotherapist or another appropriately qualified health professional.\n\nOnce you’ve been cleared to exercise, you can return and continue setting up your StrengthHub experience.' },
        donotgenerate: { title: 'Please seek medical advice before training', body: 'You told us you’ve experienced chest pain while at rest. For your safety we can’t generate a training program. Please speak with a doctor or another qualified health professional as a priority.\n\nWe’ll keep your answers safe so you can return once you’ve been cleared.', danger: true },
      }
      const c = cfg[verdict] || cfg.block
      const tint = c.danger ? colors.danger : colors.accentOrange
      return (
        <View className="flex-1">
          <View className="flex-1 justify-center px-7">
            <Reveal><View style={{ backgroundColor: tint + '24' }} className="h-[70px] w-[70px] items-center justify-center rounded-[22px]"><ShieldAlert size={34} color={tint} /></View></Reveal>
            <Reveal delay={260}><Text className="mt-6 text-2xl font-extrabold leading-8 text-white">{c.title}</Text></Reveal>
            <Reveal delay={360}><Text className="mt-3.5 text-[15px] leading-6 text-white/60">{c.body}</Text></Reveal>
            <Reveal delay={440}><View className="mt-4 rounded-[14px] bg-white/5 p-3.5"><Text className="text-[13px] leading-5 text-white/50">StrengthHub provides general fitness information, not a medical assessment. This isn&apos;t a diagnosis.</Text></View></Reveal>
          </View>
          <View className="px-5 pb-8 pt-2">
            <PressableScale onPress={() => { thud(); onRestart() }} className="h-[54px] items-center justify-center rounded-full bg-white/10">
              <Text className="text-base font-bold text-white">I&apos;ll come back later</Text>
            </PressableScale>
          </View>
        </View>
      )
    }

    default:
      return <View className="p-10"><Text className="text-white">Unknown step: {step.type}</Text></View>
  }
}

/* ─────────────────────────── DOB wheel picker ────────────────────────────── */

const DOB_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WHEEL_ITEM = 44
const pad2 = (n: number) => String(n).padStart(2, '0')

function Wheel({ items, index, onIndex, flexBasis, render }: { items: (string | number)[]; index: number; onIndex: (i: number) => void; flexBasis: number; render?: (v: string | number) => string }) {
  const ref = useRef<ScrollView>(null)
  const last = useRef(index)
  useEffect(() => {
    const t = setTimeout(() => ref.current?.scrollTo({ y: index * WHEEL_ITEM, animated: false }), 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Commit the resting index. Driven by live scrolling and, because programmatic
  // scrollTo doesn't reliably emit scroll events on native, directly on tap too.
  const commitOffset = (y: number) => {
    const i = Math.max(0, Math.min(items.length - 1, Math.round(y / WHEEL_ITEM)))
    if (i !== last.current) { last.current = i; tick(); onIndex(i) }
  }
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => commitOffset(e.nativeEvent.contentOffset.y)
  const selectIndex = (i: number) => { ref.current?.scrollTo({ y: i * WHEEL_ITEM, animated: true }); if (i !== last.current) { last.current = i; tick(); onIndex(i) } }
  return (
    <ScrollView
      ref={ref} style={{ flex: flexBasis, height: WHEEL_ITEM * 5 }} showsVerticalScrollIndicator={false}
      snapToInterval={WHEEL_ITEM} decelerationRate="fast" scrollEventThrottle={16} onScroll={onScroll}
      onMomentumScrollEnd={onScroll} contentContainerStyle={{ paddingVertical: WHEEL_ITEM * 2 }}
    >
      {items.map((it, i) => {
        const sel = i === index
        return (
          <Pressable key={i} onPress={() => selectIndex(i)} style={{ height: WHEEL_ITEM, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: sel ? 19 : 16, fontWeight: sel ? '800' : '500', opacity: Math.abs(i - index) > 2 ? 0.35 : 1 }} className={sel ? 'text-white' : 'text-white/30'}>
              {render ? render(it) : String(it)}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

function DateStep({ answers, set, title, sub, onContinue }: { answers: Answers; set: <K extends keyof Answers>(k: K, v: Answers[K]) => void; title: string; sub?: string; onContinue: () => void }) {
  const now = new Date()
  const years = useMemo(() => { const out: number[] = []; for (let y = now.getFullYear() - 13; y >= now.getFullYear() - 80; y--) out.push(y); return out }, [])
  const initial = answers.dob ? new Date(answers.dob + 'T00:00:00') : null
  const defYearIdx = Math.max(0, years.indexOf(now.getFullYear() - 20))
  const [mIdx, setM] = useState(initial ? initial.getMonth() : 0)
  const [dIdx, setD] = useState(initial ? initial.getDate() - 1 : 0)
  const [yIdx, setY] = useState(initial ? Math.max(0, years.indexOf(initial.getFullYear())) : defYearIdx)
  const days = useMemo(() => Array.from({ length: 31 }, (_, i) => i + 1), [])

  const commit = (m: number, d: number, y: number) => {
    const year = years[y]
    const dim = new Date(year, m + 1, 0).getDate()
    const dayN = Math.min(d + 1, dim)
    set('dob', `${year}-${pad2(m + 1)}-${pad2(dayN)}`)
  }
  useEffect(() => { commit(mIdx, dIdx, yIdx) /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  return (
    <View className="flex-1">
      <View className="flex-1 justify-center px-5">
        <QHeader title={title} sub={sub} />
        <Reveal delay={180}>
          <View className="mt-2">
            <View pointerEvents="none" className="absolute left-0 right-0 top-1/2 -mt-[22px] h-[44px] rounded-[14px] border border-brand-400/30 bg-ink-700" />
            <View className="flex-row">
              <Wheel items={DOB_MONTHS} index={mIdx} onIndex={(i) => { setM(i); commit(i, dIdx, yIdx) }} flexBasis={1.5} />
              <Wheel items={days} index={dIdx} onIndex={(i) => { setD(i); commit(mIdx, i, yIdx) }} flexBasis={0.8} />
              <Wheel items={years} index={yIdx} onIndex={(i) => { setY(i); commit(mIdx, dIdx, i) }} flexBasis={1} />
            </View>
          </View>
        </Reveal>
      </View>
      <ActionBar onPress={onContinue} />
    </View>
  )
}

/* ─────────────────────────── search (love / avoid) ───────────────────────── */

function SearchStep({ step, answers, set, onContinue, onSkip }: { step: Step; answers: Answers; set: <K extends keyof Answers>(k: K, v: Answers[K]) => void; onContinue: () => void; onSkip: () => void }) {
  const colors = useColors()
  const key = step.key as 'loveExercises' | 'avoidExercises'
  const sel = answers[key]
  const avoid = step.mode === 'avoid'
  const accent = avoid ? colors.danger : colors.brand300
  const [q, setQ] = useState('')
  const results = q.trim() ? EXERCISE_LIB.filter((e) => e.toLowerCase().includes(q.toLowerCase()) && !sel.includes(e)).slice(0, 6) : []
  const add = (e: string) => { tick(); set(key, [...sel, e]); setQ('') }
  const rm = (e: string) => { tick(); set(key, sel.filter((x) => x !== e)) }
  const addCustom = () => { const v = q.trim(); if (v && !sel.includes(v)) add(v) }
  return (
    <Scaffold footer={<ActionBar onPress={onContinue} onSkip={onSkip} skipLabel="Skip" />}>
      <QHeader title={step.title} sub={step.sub} />
      <Reveal delay={160}>
        <View className={`flex-row items-center gap-2.5 rounded-[14px] border bg-ink-800 px-4 py-3 ${avoid ? 'border-danger/40' : 'border-white/8'}`}>
          <Search size={19} color="rgba(255,255,255,0.4)" />
          <TextInput value={q} onChangeText={setQ} onSubmitEditing={addCustom} placeholder="Search or type an exercise" placeholderTextColor="rgba(255,255,255,0.35)" className="flex-1 text-[16px] text-white" />
          {q.trim() ? (
            <Pressable onPress={addCustom} style={{ backgroundColor: accent + '28' }} className="rounded-full px-3 py-1.5 active:opacity-80"><Text style={{ color: accent }} className="text-[13px] font-bold">Add</Text></Pressable>
          ) : null}
        </View>
      </Reveal>
      {results.length > 0 ? (
        <View className="mt-2.5 overflow-hidden rounded-[14px] border border-white/6 bg-ink-800">
          {results.map((e, i) => (
            <Pressable key={e} onPress={() => add(e)} className={`flex-row items-center justify-between px-4 py-3.5 active:opacity-80 ${i ? 'border-t border-white/5' : ''}`}>
              <Text className="text-[15px] text-white/85">{e}</Text>
              <Plus size={16} color="rgba(255,255,255,0.35)" />
            </Pressable>
          ))}
        </View>
      ) : null}
      {sel.length > 0 ? (
        <View className="mt-5">
          <Text className="mb-2.5 text-[12.5px] font-semibold uppercase tracking-[0.05em] text-white/40">{avoid ? 'Excluded' : 'Favourites'}</Text>
          <View className="flex-row flex-wrap gap-2">
            {sel.map((e) => (
              <View key={e} style={{ backgroundColor: accent + '24', borderColor: accent + '4d' }} className="flex-row items-center gap-2 rounded-full border py-2.5 pl-4 pr-2.5">
                <Text style={{ color: accent }} className="text-[14.5px] font-semibold">{e}</Text>
                <Pressable onPress={() => rm(e)} hitSlop={6}><X size={14} strokeWidth={2.5} color={accent} /></Pressable>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </Scaffold>
  )
}

/* ─────────────────────── activity detail (expandable) ────────────────────── */

function ActivityDetailStep({ answers, set, title, sub, skipLabel, onContinue, onSkip }: { answers: Answers; set: <K extends keyof Answers>(k: K, v: Answers[K]) => void; title: string; sub?: string; skipLabel?: string; onContinue: () => void; onSkip: () => void }) {
  const colors = useColors()
  const acts = (answers.activities || []).filter((x) => x !== 'None' && x !== 'Other')
  const detail = answers.activityDetail
  const [open, setOpen] = useState<string | null>(acts[0] || null)
  const patch = (act: string, p: Partial<ActivityDetail>) => {
    const base: ActivityDetail = detail[act] || { days: [] }
    set('activityDetail', { ...detail, [act]: { ...base, ...p } })
  }
  const toggleDay = (act: string, d: string) => { tick(); const cur = (detail[act]?.days) || []; patch(act, { days: cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d] }) }
  const complete = acts.every((a) => (detail[a]?.days?.length ?? 0) > 0 && detail[a]?.intensity)
  return (
    <Scaffold footer={<ActionBar disabled={!complete} onPress={onContinue} hint={!complete ? 'Set the days and intensity for each activity' : undefined} onSkip={onSkip} skipLabel={skipLabel || 'Skip'} />}>
      <QHeader title={title} sub={sub} />
      <View className="gap-2.5">
        {acts.map((act, i) => {
          const d = detail[act] || { days: [] }
          const isOpen = open === act
          const done = (d.days?.length ?? 0) > 0 && d.intensity
          return (
            <Reveal key={act} delay={150 + i * 60}>
              <View className={`overflow-hidden rounded-[18px] border bg-ink-800 ${isOpen ? 'border-brand-400/50' : 'border-white/6'}`}>
                <Pressable onPress={() => { tick(); setOpen(isOpen ? null : act) }} className="flex-row items-center justify-between px-4 py-4 active:opacity-90">
                  <Text className="text-[16px] font-bold text-white">{act}</Text>
                  <View className="flex-row items-center gap-2">
                    {done ? <Check size={17} strokeWidth={3} color={colors.brand400} /> : null}
                    <Text className="text-[13px] text-white/40">{done ? `${d.days!.length}d · ${d.intensity}` : 'Set up'}</Text>
                  </View>
                </Pressable>
                {isOpen ? (
                  <View className="px-4 pb-4">
                    <Text className="mb-2.5 mt-1 text-[13px] text-white/50">When do you usually do this?</Text>
                    <View className="flex-row flex-wrap gap-1.5">
                      {DAYS.map((day) => {
                        const on = (d.days || []).includes(day)
                        return (
                          <Pressable key={day} onPress={() => toggleDay(act, day)} className={`rounded-full border px-3 py-2 active:opacity-90 ${on ? 'border-brand-400 bg-brand-400/16' : 'border-white/6 bg-ink-700'}`}>
                            <Text className={`text-[13px] font-bold ${on ? 'text-brand-300' : 'text-white/55'}`}>{DAYS_SHORT[day]}</Text>
                          </Pressable>
                        )
                      })}
                    </View>
                    <Text className="mb-2.5 mt-4 text-[13px] text-white/50">How demanding is it usually?</Text>
                    <View className="flex-row gap-2">
                      {INTENSITY_OPTIONS.map((o) => {
                        const on = d.intensity === o.value
                        return (
                          <Pressable key={o.value} onPress={() => { tick(); patch(act, { intensity: o.value }) }} className={`h-11 flex-1 items-center justify-center rounded-xl border active:opacity-90 ${on ? 'border-brand-400 bg-brand-400/16' : 'border-white/6 bg-ink-700'}`}>
                            <Text className={`text-[14px] font-bold ${on ? 'text-brand-300' : 'text-white/60'}`}>{o.label}</Text>
                          </Pressable>
                        )
                      })}
                    </View>
                  </View>
                ) : null}
              </View>
            </Reveal>
          )
        })}
      </View>
    </Scaffold>
  )
}

/* ─────────────────────────── milestone moments ───────────────────────────── */

function Interstitial({ message, onAdvance }: { message: { title: string; sub?: string }; onAdvance: () => void }) {
  useEffect(() => { const t = setTimeout(onAdvance, 1700); return () => clearTimeout(t) }, [onAdvance])
  return (
    <Pressable onPress={onAdvance} className="flex-1">
      <View className="flex-1 items-center justify-center px-8">
        <Reveal delay={80}><Checkmark size={74} /></Reveal>
        <Reveal delay={320}><Text className="mt-6 text-center text-[29px] font-extrabold leading-9 tracking-tight text-white">{message.title}</Text></Reveal>
        {message.sub ? <Reveal delay={440}><Text className="mt-3.5 text-center text-[15.5px] leading-6 text-white/55">{message.sub}</Text></Reveal> : null}
      </View>
      <Text className="pb-7 text-center text-[13.5px] text-white/40">Tap to continue</Text>
    </Pressable>
  )
}

function Spinner({ size = 60 }: { size?: number }) {
  const colors = useColors()
  const spin = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: NATIVE }))
    loop.start()
    return () => loop.stop()
  }, [spin])
  return (
    <Animated.View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 4, borderColor: 'rgba(255,255,255,0.1)', borderTopColor: colors.brand400, transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }} />
  )
}

function MidTransition({ onDone }: { onDone: () => void }) {
  const [stage, setStage] = useState(0)
  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 2100)
    const t2 = setTimeout(onDone, 4200)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onDone])
  return (
    <View className="flex-1 items-center justify-center px-9">
      {stage === 0 ? (
        <>
          <Spinner />
          <Reveal><Text className="mt-7 text-center text-2xl font-extrabold tracking-tight text-white">Understanding your training needs…</Text></Reveal>
          <Reveal delay={100}><Text className="mt-2.5 text-center text-[15px] text-white/50">Reading your goals and experience.</Text></Reveal>
        </>
      ) : (
        <>
          <Checkmark size={76} />
          <Reveal><Text className="mt-6 text-center text-[25px] font-extrabold leading-8 tracking-tight text-white">We have a clearer picture of what will work for you.</Text></Reveal>
        </>
      )}
    </View>
  )
}

/* ─────────────────────── out-of-flow phase screens ───────────────────────── */

function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <View className="flex-1 px-7">
      <View className="flex-1 items-center justify-center">
        <LogoMark size={72} />
        <View className="mt-8"><Wordmark size="lg" /></View>
        <Text className="mt-8 text-center text-[32px] font-extrabold leading-[38px] tracking-tight text-white">Training built{'\n'}around you.</Text>
        <Text className="mt-4 max-w-[300px] text-center text-[15px] leading-6 text-white/55">A few quick questions and your coach will build training around you, not a generic template.</Text>
      </View>
      <View className="pb-10">
        <PressableScale onPress={onStart} className="h-[56px] items-center justify-center rounded-full bg-brand-400"><Text className="text-[16.5px] font-bold text-black">Get Started</Text></PressableScale>
        <Text className="mt-4 text-center text-[12.5px] text-white/40">Takes about 3 minutes</Text>
      </View>
    </View>
  )
}

function Under16({ onBack }: { onBack: () => void }) {
  const colors = useColors()
  return (
    <View className="flex-1">
      <View className="px-5 pt-1">
        <Pressable onPress={onBack} hitSlop={12} className="h-10 w-10 items-center justify-center rounded-full active:opacity-60"><ChevronLeft size={22} color="rgba(255,255,255,0.7)" /></Pressable>
      </View>
      <View className="flex-1 justify-center px-7">
        <Reveal><View className="h-16 w-16 items-center justify-center rounded-[20px] bg-white/6"><HeartPulse size={32} color={colors.fg} /></View></Reveal>
        <Reveal delay={180}><Text className="mt-6 text-[26px] font-extrabold leading-8 tracking-tight text-white">Thanks for your interest in StrengthHub</Text></Reveal>
        <Reveal delay={260}><Text className="mt-3.5 text-[15.5px] leading-6 text-white/60">StrengthHub creates personalised training programs for people aged 16 and over. We can&apos;t generate a program just yet — but we&apos;d love to have you when the time is right.</Text></Reveal>
        <Reveal delay={340}><Text className="mt-3 text-[14px] leading-5 text-white/45">In the meantime, staying active with school sports and everyday movement is a great foundation.</Text></Reveal>
      </View>
      <View className="px-5 pb-8 pt-2">
        <PressableScale onPress={onBack} className="h-[54px] items-center justify-center rounded-full bg-white/10"><Text className="text-base font-bold text-white">Back</Text></PressableScale>
      </View>
    </View>
  )
}

function Guardian({ answers, set, onContinue, onBack }: { answers: Answers; set: <K extends keyof Answers>(k: K, v: Answers[K]) => void; onContinue: () => void; onBack: () => void }) {
  const colors = useColors()
  const ok = answers.guardianConsent
  return (
    <View className="flex-1">
      <View className="px-5 pt-1">
        <Pressable onPress={onBack} hitSlop={12} className="h-10 w-10 items-center justify-center rounded-full active:opacity-60"><ChevronLeft size={22} color="rgba(255,255,255,0.7)" /></Pressable>
      </View>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 26, paddingTop: 10 }} keyboardShouldPersistTaps="handled">
        <Reveal><View className="h-[62px] w-[62px] items-center justify-center rounded-[18px] bg-brand-400/12"><ShieldAlert size={30} color={colors.brand300} /></View></Reveal>
        <Reveal delay={180}><Text className="mt-5 text-[26px] font-extrabold leading-8 tracking-tight text-white">A quick step for under-18s</Text></Reveal>
        <Reveal delay={260}><Text className="mb-5 mt-3 text-[15px] leading-6 text-white/60">Because you&apos;re 16 or 17, we ask that a parent or guardian is aware you&apos;re setting up StrengthHub and consents to you training with a personalised program.</Text></Reveal>
        <Reveal delay={340}>
          <Pressable onPress={() => { tick(); set('guardianConsent', !ok) }} className={`flex-row items-start gap-3.5 rounded-[18px] border p-[18px] ${ok ? 'border-brand-400/80 bg-brand-400/10' : 'border-white/8 bg-ink-800'}`}>
            <View className={`mt-0.5 h-[26px] w-[26px] items-center justify-center rounded-lg border-2 ${ok ? 'border-brand-400 bg-brand-400' : 'border-white/25'}`}>{ok ? <Check size={16} strokeWidth={3} color="#08140a" /> : null}</View>
            <Text className="flex-1 text-[14.5px] leading-6 text-white/85">My parent or guardian is aware and consents to me setting up and using StrengthHub.</Text>
          </Pressable>
        </Reveal>
      </ScrollView>
      <ActionBar disabled={!ok} onPress={onContinue} />
    </View>
  )
}

function Terms({ answers, set, onContinue, onBack }: { answers: Answers; set: <K extends keyof Answers>(k: K, v: Answers[K]) => void; onContinue: () => void; onBack: () => void }) {
  const checked = answers.terms
  return (
    <View className="flex-1">
      <View className="flex-row items-center gap-2 px-4 pt-1">
        <Pressable onPress={onBack} hitSlop={12} className="h-10 w-10 items-center justify-center rounded-full active:opacity-60"><ChevronLeft size={22} color="rgba(255,255,255,0.7)" /></Pressable>
        <Text className="text-[12.5px] font-semibold uppercase tracking-[0.05em] text-brand-300">Almost there</Text>
      </View>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14 }} keyboardShouldPersistTaps="handled">
        <QHeader title="A quick acknowledgement" sub="One last thing before we build your experience." />
        <Reveal delay={160}>
          <Pressable onPress={() => { tick(); set('terms', !checked) }} className={`flex-row items-start gap-3.5 rounded-[18px] border p-[18px] ${checked ? 'border-brand-400/80 bg-brand-400/10' : 'border-white/8 bg-ink-800'}`}>
            <View className={`mt-0.5 h-[26px] w-[26px] items-center justify-center rounded-lg border-2 ${checked ? 'border-brand-400 bg-brand-400' : 'border-white/25'}`}>{checked ? <Check size={16} strokeWidth={3} color="#08140a" /> : null}</View>
            <Text className="flex-1 text-[14.5px] leading-6 text-white/85">I have read and agree to the Terms of Use and acknowledge that StrengthHub provides general fitness and wellness information, <Text className="font-bold text-white">not medical advice</Text>.</Text>
          </Pressable>
        </Reveal>
        <Reveal delay={230}>
          <View className="mt-4">
            {['Terms of Use', 'Privacy Policy', 'Health & safety information'].map((l) => (
              <Pressable key={l} className="flex-row items-center justify-between border-b border-white/5 px-0.5 py-3 active:opacity-70">
                <Text className="text-[14.5px] font-semibold text-brand-300">{l}</Text>
                <ChevronRight size={16} color="rgba(255,255,255,0.3)" />
              </Pressable>
            ))}
          </View>
        </Reveal>
      </ScrollView>
      <ActionBar label="Agree & continue" disabled={!checked} onPress={onContinue} hint={!checked ? 'Please read and tick the box to continue' : undefined} />
    </View>
  )
}

function Processing({ onDone }: { onDone: () => void }) {
  const colors = useColors()
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    if (idx >= PROCESSING_STAGES.length) { const t = setTimeout(onDone, 700); return () => clearTimeout(t) }
    const t = setTimeout(() => setIdx((i) => i + 1), idx === 0 ? 500 : 640)
    return () => clearTimeout(t)
  }, [idx, onDone])
  const pct = Math.round((Math.min(idx, PROCESSING_STAGES.length) / PROCESSING_STAGES.length) * 100)
  const barW = useRef(new Animated.Value(0)).current
  useEffect(() => { Animated.timing(barW, { toValue: pct, duration: 600, easing: EASE, useNativeDriver: false }).start() }, [barW, pct])
  return (
    <View className="flex-1 px-7">
      <View className="items-center pt-16">
        <Wordmark size="md" />
        <Text className="mt-5 text-2xl font-extrabold tracking-tight text-white">Building your experience</Text>
        <View className="mt-4 h-1.5 w-[220px] overflow-hidden rounded-full bg-white/10">
          <Animated.View className="h-full rounded-full bg-brand-400" style={{ width: barW.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }} />
        </View>
      </View>
      <View className="flex-1 justify-center">
        {PROCESSING_STAGES.map((s, i) => {
          if (i > idx) return null
          const done = i < idx
          return (
            <Reveal key={s}>
              <View className="flex-row items-center gap-3.5 px-1 py-2.5">
                <View className="h-[26px] w-[26px] items-center justify-center">
                  {done ? <Check size={22} strokeWidth={3} color={colors.brand400} /> : <Spinner size={20} />}
                </View>
                <Text className={`text-[15.5px] font-semibold ${done ? 'text-white/85' : 'text-white/60'}`}>{s}</Text>
              </View>
            </Reveal>
          )
        })}
      </View>
    </View>
  )
}

function Summary({ answers, onContinue, onEdit, onBack }: { answers: Answers; onContinue: () => void; onEdit: (id: string) => void; onBack: () => void }) {
  const colors = useColors()
  const g = GOAL_OPTIONS.find((o) => o.value === answers.goal)?.label || 'Not set'
  const exp = EXPERIENCE_OPTIONS.find((o) => o.value === answers.experience)?.label || 'Not set'
  const env = ENVIRONMENT_OPTIONS.find((o) => o.value === answers.environment)?.label || 'Not set'
  const focus = answers.focus.length ? answers.focus.join(', ') : 'Whole body'
  const days = answers.days
  const around = trainAroundAreas(answers)
  const acts = answers.activities.filter((x) => x !== 'None' && x !== 'Other')
  const equip = answers.equipment
  const love = answers.loveExercises
  const wt = answers.noGoalWeight ? `${answers.weight} kg` : `${answers.weight} kg`

  const Stat = ({ label, value, edit }: { label: string; value: string; edit?: string }) => (
    <View className="flex-1 rounded-2xl border border-white/5 bg-ink-800 px-4 py-3.5">
      <View className="flex-row items-center justify-between">
        <Text className="text-[11.5px] font-bold uppercase tracking-[0.05em] text-white/40">{label}</Text>
        {edit ? <Pressable onPress={() => { tick(); onEdit(edit) }} hitSlop={8}><Text className="text-[12.5px] font-bold text-brand-300">Edit</Text></Pressable> : null}
      </View>
      <Text className="mt-1.5 text-[15.5px] font-bold leading-5 text-white" numberOfLines={2}>{value}</Text>
    </View>
  )

  return (
    <View className="flex-1">
      <View className="flex-row items-center gap-2 px-4 pt-1">
        <Pressable onPress={onBack} hitSlop={12} className="h-10 w-10 items-center justify-center rounded-full active:opacity-60"><ChevronLeft size={22} color="rgba(255,255,255,0.7)" /></Pressable>
        <Text className="text-[12.5px] font-semibold uppercase tracking-[0.05em] text-brand-300">Your setup</Text>
      </View>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
        <Reveal delay={60}><View className="mb-1.5 items-center"><Checkmark size={64} /></View></Reveal>
        <Reveal delay={240}><Text className="mt-1.5 text-center text-[26px] font-extrabold leading-8 tracking-tight text-white">Your StrengthHub experience is ready</Text></Reveal>
        <Reveal delay={340}><Text className="mb-5 mt-2.5 text-center text-[14.5px] leading-5 text-white/55">Shaped around your goals, schedule and preferences, {firstName(answers)}.</Text></Reveal>

        <Reveal delay={420}>
          <View className="mb-3 rounded-[20px] border border-brand-400/20 bg-brand-900/40 p-[18px]">
            <View className="flex-row items-center gap-2.5">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-brand-400/18"><Dumbbell size={22} color={colors.brand300} /></View>
              <View>
                <Text className="text-[12px] font-bold uppercase tracking-[0.05em] text-brand-300">Your plan</Text>
                <Text className="text-[18px] font-extrabold text-white">{g} · {days.length || 4} day{(days.length || 4) === 1 ? '' : 's'} / week</Text>
              </View>
            </View>
            <View className="mt-3.5 flex-row flex-wrap gap-1.5">
              {(days.length ? days : ['Monday', 'Wednesday', 'Friday', 'Saturday']).map((d) => (
                <Text key={d} className="overflow-hidden rounded-full bg-brand-400/14 px-2.5 py-1.5 text-[12.5px] font-bold text-brand-300">{DAYS_SHORT[d]}</Text>
              ))}
            </View>
            <Text className="mt-3 text-[13px] text-white/50">A full week-by-week program unlocks once you save your experience.</Text>
          </View>
        </Reveal>

        <Reveal delay={500}>
          <View className="gap-2.5">
            <View className="flex-row gap-2.5"><Stat label="Main goal" value={g} edit="c1" /><Stat label="Focus" value={focus} edit="c2" /></View>
            <View className="flex-row gap-2.5"><Stat label="Experience" value={exp} edit="d1" /><Stat label="Session" value={`${answers.session} min`} edit="e2" /></View>
            <View className="flex-row gap-2.5"><Stat label="Environment" value={env} edit="f1" /><Stat label="Weight" value={wt} edit="b2" /></View>
          </View>
        </Reveal>
        <Reveal delay={560}>
          <View className="mt-2.5 gap-2.5">
            <View className="flex-row"><Stat label="Equipment" value={equip.length ? equip.join(', ') : (env === 'Full Gym' ? 'Full gym access' : 'Bodyweight')} edit="f1" /></View>
            <View className="flex-row"><Stat label="Outside activity" value={acts.length ? acts.join(', ') : 'None'} edit="h1" /></View>
            {love.length ? <View className="flex-row"><Stat label="You love" value={love.join(', ')} edit="i1" /></View> : null}
            {around.length ? <View className="flex-row"><Stat label="Training around" value={joinAreas(around)} edit="g1" /></View> : null}
          </View>
        </Reveal>
      </ScrollView>
      <ActionBar label="Save my experience" onPress={onContinue} />
    </View>
  )
}

/**
 * Account creation. In this repo the auth layer (AuthProvider / AuthScreen) owns
 * real accounts and, when Firebase is configured, the user has already signed in
 * before reaching onboarding. So the job here is to save the gathered profile —
 * `onComplete` dispatches COMPLETE_ONBOARDING — and, where a live Google sign-in
 * is still needed, hand off to the existing provider.
 */
function AccountCreate({ onComplete, onBack }: { answers: Answers; onComplete: () => void; onBack: () => void }) {
  const colors = useColors()
  const { enabled, user, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState('')

  // Signs in with Google when a live account is still required, then saves.
  const google = async () => {
    tick()
    try { if (enabled && !user) await signInWithGoogle() } catch { /* fall through to save */ }
    onComplete()
  }

  return (
    <View className="flex-1">
      <View className="flex-row items-center gap-2 px-4 pt-1">
        <Pressable onPress={onBack} hitSlop={12} className="h-10 w-10 items-center justify-center rounded-full active:opacity-60"><ChevronLeft size={22} color="rgba(255,255,255,0.7)" /></Pressable>
        <Text className="text-[12.5px] font-semibold uppercase tracking-[0.05em] text-brand-300">Almost there</Text>
      </View>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 14 }} keyboardShouldPersistTaps="handled">
        <Reveal><View className="h-[60px] w-[60px] items-center justify-center rounded-[18px] bg-brand-400/14"><Lock size={28} color={colors.brand300} /></View></Reveal>
        <Reveal delay={140}><Text className="mt-5 text-[27px] font-extrabold leading-8 tracking-tight text-white">Save your personalised experience</Text></Reveal>
        <Reveal delay={220}><Text className="mb-5 mt-3 text-[15px] leading-6 text-white/55">Create your account to save your answers, access your personalised training and track your progress.</Text></Reveal>
        <Reveal delay={300}>
          <Text className="mb-2 mt-1 text-[12.5px] font-semibold uppercase tracking-[0.04em] text-white/40">Email</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder="you@university.ac.uk" placeholderTextColor="rgba(255,255,255,0.32)" keyboardType="email-address" autoCapitalize="none" autoComplete="email" className="mb-3 w-full rounded-[14px] border border-white/8 bg-ink-800 px-4 py-4 text-[16px] text-white" />
          <PressableScale onPress={() => { thud(); onComplete() }} className="h-[54px] items-center justify-center rounded-full bg-brand-400"><Text className="text-base font-bold text-black">Create Account</Text></PressableScale>
        </Reveal>
        <Reveal delay={380}>
          <View className="my-4 flex-row items-center gap-3">
            <View className="h-px flex-1 bg-white/8" /><Text className="text-[12.5px] text-white/40">or</Text><View className="h-px flex-1 bg-white/8" />
          </View>
          <View className="gap-2.5">
            <PressableScale onPress={google} className="h-[52px] flex-row items-center justify-center gap-2.5 rounded-full bg-white"><Text className="text-[15.5px] font-bold text-[#111]">Continue with Google</Text></PressableScale>
            <PressableScale onPress={() => { tick(); onComplete() }} className="h-[52px] flex-row items-center justify-center gap-2.5 rounded-full border border-white/12 bg-ink-700"><Text className="text-[15.5px] font-bold text-white">Continue with Apple</Text></PressableScale>
          </View>
        </Reveal>
      </ScrollView>
      <View className="flex-row items-center justify-center px-5 pb-8 pt-3">
        <Text className="text-[14.5px] text-white/50">Already have an account? </Text>
        <Pressable onPress={() => { tick(); onComplete() }} hitSlop={8}><Text className="text-[14.5px] font-bold text-brand-300">Log In</Text></Pressable>
      </View>
    </View>
  )
}
