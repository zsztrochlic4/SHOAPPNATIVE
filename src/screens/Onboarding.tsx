/**
 * Onboarding.tsx — StrengthHub Online new-user onboarding.
 *
 * A pixel-faithful React Native port of the design prototype in
 * design_handoff_onboarding/prototype/ (ui.jsx, screens*.jsx, app.jsx). The
 * canonical flow/copy/conditionals and the age + safety logic come from
 * data.jsx and are ported verbatim. Styling mirrors the prototype's inline
 * styles via the `useTok().rgb()` theme-token helper; the bespoke controls
 * (geometric SVG icons, the drag ruler + unit toggle, the animated Welcome
 * feature-card carousel, the SVG-draw checkmark) are recreated with
 * react-native-svg + Animated so it matches the design rather than reusing the
 * repo's generic components.
 *
 * The only store integration is the final dispatch, unchanged from the old
 * screen: dispatch({ type: 'COMPLETE_ONBOARDING', profile }).
 */
import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, Pressable, ScrollView, TextInput, Animated, Easing, PanResponder,
  Platform, useWindowDimensions,
  type NativeSyntheticEvent, type NativeScrollEvent, type ViewStyle, type TextStyle,
} from 'react-native'
import Svg, { Path, Line, Rect, Circle, Polygon, G, Text as SvgText } from 'react-native-svg'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDispatch } from '../store/store'
import { useAuth } from '../auth/AuthProvider'
import { cssVars, useThemeName } from '../theme'
import { tick, thud } from '../lib/haptics'
import { todayKey } from '../lib/date'
import { LANGUAGES, type Language } from '../lib/i18n'
import type { Equipment, Experience, Goal, Profile } from '../store/types'

const NATIVE = Platform.OS !== 'web'
/** Prototype motion curve (cubic-bezier(0.22,0.8,0.28,1)). */
const EASE = Easing.bezier(0.22, 0.8, 0.28, 1)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedPath = Animated.createAnimatedComponent(Path)

/* ─────────────────────────── theme-token helper ──────────────────────────── */
/**
 * Mirrors the prototype's `rgb('--token', alpha)` — reads the raw CSS-variable
 * RGB triple for the active theme so every colour flips light/dark and matches
 * the design's exact opacities.
 */
function useTok() {
  const name = useThemeName()
  return useMemo(() => {
    const map = cssVars[name]
    const rgb = (t: string, a?: number) => {
      const parts = (map[t] || '0 0 0').split(' ')
      return a === undefined ? `rgb(${parts.join(',')})` : `rgba(${parts.join(',')},${a})`
    }
    return { rgb }
  }, [name])
}
type Tok = ReturnType<typeof useTok>

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
  height: number; weight: number; goalWeight: number; noGoalWeight: boolean
  goal: GoalKey | ''
  focus: string[]
  experience: Experience | ''
  structured: 'yes' | 'no' | ''
  days: string[]; session: number; alone: string
  environment: EnvKey | ''
  equipment: string[]
  trainAround: string[]; moreInfo: string
  activities: string[]; activityOther: string; activityDetail: Record<string, ActivityDetail>
  loveExercises: string[]; avoidExercises: string[]
  motivation: string
  safety: Record<string, 'yes' | 'no'>
  followup: Record<string, string>
  movements: string[]; movementsOther: string
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
const GOAL_OPTIONS = [
  { value: 'build', label: 'Build muscle', desc: 'I want to get bigger muscles.', icon: 'muscle' },
  { value: 'lose', label: 'Lose fat', desc: 'I want to get leaner.', icon: 'flame' },
  { value: 'strong', label: 'Get stronger', desc: 'I want to lift heavier.', icon: 'bolt' },
  { value: 'healthy', label: 'Stay healthy', desc: 'I want to feel fit and healthy.', icon: 'heart' },
]
const FOCUS_OPTIONS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Glutes', 'Core', 'Abs']
const EXPERIENCE_OPTIONS = [
  { value: 'beginner', label: 'Beginner', desc: 'Up to 6 months of consistent training.', icon: 'lvl1' },
  { value: 'intermediate', label: 'Intermediate', desc: '6 months to 3 years training consistently.', icon: 'lvl2' },
  { value: 'advanced', label: 'Advanced', desc: '3+ years of consistent, structured training.', icon: 'lvl3' },
]
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAYS_SHORT: Record<string, string> = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun' }
const SESSION_OPTIONS = [{ value: 30, label: '30 minutes' }, { value: 45, label: '45 minutes' }, { value: 60, label: '60 minutes' }, { value: 75, label: '75 minutes' }]
const ALONE_OPTIONS = [
  { value: 'always', label: 'Always' }, { value: 'usually', label: 'Usually' },
  { value: 'sometimes', label: 'Sometimes' }, { value: 'never', label: 'Never' },
]
const ENVIRONMENT_OPTIONS = [
  { value: 'gym', label: 'Full Gym', desc: 'Machines, cables, free weights and common gym equipment.', icon: 'gym' },
  { value: 'home', label: 'Home Basics', desc: 'A smaller amount of home training equipment.', icon: 'home' },
  { value: 'bodyweight', label: 'Bodyweight', desc: 'Little or no dedicated training equipment.', icon: 'body' },
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
function trainAroundAreas(a: Answers) { return (a.trainAround || []).filter((x) => x !== 'None') }
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
function needsFollowup(a: Answers) { return trainAroundAreas(a).length > 0 }
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

  push({ id: 'a1', type: 'text', section: 'about', key: 'name', title: 'What should we call you?', sub: 'This is what your coach will refer to you as.', placeholder: 'Your name', required: true })
  push({ id: 'a2', type: 'date', section: 'about', key: 'dob', title: 'When were you born?', sub: 'This helps us build your workout.' })
  push({ id: 'a4', type: 'single', section: 'about', key: 'sex', title: 'Which option best describes you?', sub: 'This may help improve nutrition, sleep and water estimates. It doesn’t change your workouts.', options: SEX_OPTIONS })
  push({ id: 'b1', type: 'measure', section: 'about', key: 'height', kind: 'height', title: 'What’s your height?', sub: 'This will help with your nutrition guidance.' })
  push({ id: 'b2', type: 'measure', section: 'about', key: 'weight', kind: 'weight', title: 'What’s your current weight?', sub: 'This helps choose your starting weights and gives us a benchmark to track your progress.' })
  push({ id: 'b3', type: 'measure', section: 'about', key: 'goalWeight', kind: 'goalweight', title: 'Do you have a goal weight?', sub: 'This is so you can track your progress. You can change it later.' })

  push({ id: 'c1', type: 'single', section: 'goals', key: 'goal', title: 'What’s your main goal?', sub: 'This will help build your workout plan.', options: GOAL_OPTIONS, cards: true })
  push({ id: 'p_goal', type: 'interstitial', section: 'goals', compute: goalMessage })
  push({ id: 'c2', type: 'multi', section: 'goals', key: 'focus', title: 'Anywhere you especially want to grow?', sub: 'Choose up to two areas. This is optional.', options: FOCUS_OPTIONS, max: 2, optional: true })
  push({ id: 'p_focus', type: 'interstitial', section: 'goals', compute: focusMessage })

  push({ id: 'd1', type: 'single', section: 'training', key: 'experience', title: 'How experienced are you with training?', options: EXPERIENCE_OPTIONS, cards: true })
  if (a.experience === 'intermediate') {
    push({ id: 'd2', type: 'single', section: 'training', key: 'structured', title: 'Have you followed a structured training program before?', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }], autoAdvance: true })
    if (a.structured === 'no') push({ id: 'p_structured', type: 'interstitial', section: 'training', compute: () => ({ title: 'No problem at all', sub: 'We’ll give you a clear structure to follow from day one.' }) })
  }
  push({ id: 'mid', type: 'midtransition', section: 'training' })
  push({ id: 'e1', type: 'multi', section: 'training', key: 'days', title: 'Which days can you train?', sub: 'Choose every day that could realistically work.', options: DAYS, weekday: true, note: 'You can always change your days later if things get busy.' })
  push({ id: 'e2', type: 'single', section: 'training', key: 'session', title: 'How long can you usually train?', sub: 'This helps us shape your workout plan.', options: SESSION_OPTIONS.map((o) => ({ ...o, flag: o.value === (a.experience === 'beginner' ? 45 : 60) ? 'Suggested' : undefined })) })
  push({ id: 'p_session', type: 'interstitial', section: 'training', compute: sessionMessage })
  push({ id: 'e3', type: 'single', section: 'training', key: 'alone', title: 'Do you usually train alone?', sub: 'This helps us decide your exercise selection and when someone may be able to help you.', options: ALONE_OPTIONS })
  push({ id: 'f1', type: 'single', section: 'training', key: 'environment', title: 'What equipment do you normally have access to?', options: ENVIRONMENT_OPTIONS, cards: true })
  if (a.environment === 'home' || a.environment === 'bodyweight') {
    push({ id: 'f2', type: 'multi', section: 'training', key: 'equipment', title: 'Do you have any of these?', sub: 'Select everything you can regularly use.', options: a.environment === 'home' ? EQUIPMENT_HOME : EQUIPMENT_OPTIONS, optional: true })
  }
  push({ id: 'p_equip', type: 'interstitial', section: 'training', compute: equipmentMessage })

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

/* ───────────────────────── geometric icon set (SVG) ──────────────────────── */
/** Minimalist geometric icons, ported 1:1 from the prototype's ui.jsx Icon. */
function Icon({ name, size = 26, color = '#fff', stroke = 2 }: { name: string; size?: number; color?: string; stroke?: number }) {
  const p = { stroke: color, strokeWidth: stroke, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' as const }
  const svg = (children: ReactNode) => <Svg width={size} height={size} viewBox="0 0 24 24">{children}</Svg>
  switch (name) {
    case 'muscle': case 'gym':
      return svg(<><Line x1="7" y1="12" x2="17" y2="12" {...p} /><Rect x="3" y="8.5" width="3" height="7" rx="1.2" {...p} /><Rect x="18" y="8.5" width="3" height="7" rx="1.2" {...p} /></>)
    case 'flame':
      return svg(<><Path d="M6 7l6 5 6-5" {...p} /><Path d="M6 13l6 5 6-5" {...p} /></>)
    case 'bolt':
      return svg(<><Line x1="5" y1="19" x2="5" y2="15" {...p} /><Line x1="12" y1="19" x2="12" y2="11" {...p} /><Line x1="19" y1="19" x2="19" y2="6" {...p} /></>)
    case 'heart':
      return svg(<Path d="M3 12h4l2-5 3 10 2-5h7" {...p} />)
    case 'home':
      return svg(<><Path d="M4 11l8-6 8 6" {...p} /><Path d="M6 10v9h12v-9" {...p} /></>)
    case 'body':
      return svg(<><Circle cx="12" cy="6" r="2.5" {...p} /><Path d="M12 9v7" {...p} /><Path d="M8 11l4-1 4 1" {...p} /><Path d="M9 20l3-4 3 4" {...p} /></>)
    case 'lvl1': case 'lvl2': case 'lvl3': {
      const active = name === 'lvl1' ? 1 : name === 'lvl2' ? 2 : 3
      const bars = [{ x: 4, y: 14, h: 6 }, { x: 10.5, y: 9, h: 11 }, { x: 17, y: 4, h: 16 }]
      return svg(<>{bars.map((b, i) => <Rect key={i} x={b.x} y={b.y} width={3.4} height={b.h} rx={1.4} fill={i < active ? color : 'none'} stroke={color} strokeWidth={1.7} opacity={i < active ? 1 : 0.4} />)}</>)
    }
    case 'check':
      return svg(<Path d="M5 12.5l4.5 4.5L19 7" {...p} />)
    case 'back':
      return svg(<Path d="M15 5l-7 7 7 7" {...p} />)
    case 'forward':
      return svg(<Path d="M9 5l7 7-7 7" {...p} />)
    case 'search':
      return svg(<><Circle cx="11" cy="11" r="6" {...p} /><Line x1="20" y1="20" x2="15.5" y2="15.5" {...p} /></>)
    case 'plus':
      return svg(<><Line x1="12" y1="6" x2="12" y2="18" {...p} /><Line x1="6" y1="12" x2="18" y2="12" {...p} /></>)
    case 'close':
      return svg(<><Line x1="6" y1="6" x2="18" y2="18" {...p} /><Line x1="18" y1="6" x2="6" y2="18" {...p} /></>)
    case 'shield':
      return svg(<Path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" {...p} />)
    case 'lock':
      return svg(<><Rect x="5" y="11" width="14" height="9" rx="2" {...p} /><Path d="M8 11V8a4 4 0 018 0v3" {...p} /></>)
    default:
      return null
  }
}

/* ───────────────────────── animation primitives ──────────────────────────── */

/** sho-rise: fade + translateY on enter. */
function Reveal({ delay = 0, y = 10, dur = 460, children, style }: { delay?: number; y?: number; dur?: number; children: ReactNode; style?: ViewStyle }) {
  const a = useRef(new Animated.Value(0)).current
  useEffect(() => {
    a.setValue(0)
    Animated.timing(a, { toValue: 1, duration: dur, delay, easing: EASE, useNativeDriver: NATIVE }).start()
  }, [a, delay, dur])
  return <Animated.View style={[style, { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [y, 0] }) }] }]}>{children}</Animated.View>
}

/** Stagger children with an increasing delay. */
function Stagger({ start = 120, step = 62, children }: { start?: number; step?: number; children: ReactNode[] }) {
  return <>{children.map((c, i) => <Reveal key={i} delay={start + i * step}>{c}</Reveal>)}</>
}

/**
 * Directional slide+fade between screens (sho-slide-fwd/back: 26px, 380ms).
 * Remounts per `animKey` — like the prototype's `<div key={viewKey}>` — so the
 * incoming screen starts hidden at its offset (CSS `both` fill) instead of
 * flashing at rest and snapping back, and so per-step state (unit toggles,
 * scroll positions, focus) resets naturally.
 */
function Stage({ animKey, dir, children }: { animKey: string; dir: 'fwd' | 'back'; children: ReactNode }) {
  return <StageInner key={animKey} dir={dir}>{children}</StageInner>
}
function StageInner({ dir, children }: { dir: 'fwd' | 'back'; children: ReactNode }) {
  const x = useRef(new Animated.Value(dir === 'back' ? -26 : 26)).current
  const o = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.parallel([
      Animated.timing(x, { toValue: 0, duration: 380, easing: EASE, useNativeDriver: NATIVE }),
      Animated.timing(o, { toValue: 1, duration: 380, easing: EASE, useNativeDriver: NATIVE }),
    ]).start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <Animated.View style={{ flex: 1, opacity: o, transform: [{ translateX: x }] }}>{children}</Animated.View>
}

/** Animated success ring + tick (sho-ring / sho-check). */
function Checkmark({ size = 76, delay = 0 }: { size?: number; delay?: number }) {
  const tok = useTok()
  const ring = useRef(new Animated.Value(0)).current
  const check = useRef(new Animated.Value(0)).current
  const C = 2 * Math.PI * 35
  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(ring, { toValue: 1, duration: 640, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }),
        Animated.sequence([Animated.delay(260), Animated.timing(check, { toValue: 1, duration: 460, easing: Easing.bezier(0.6, 0, 0.2, 1), useNativeDriver: NATIVE })]),
      ]),
    ]).start()
  }, [ring, check, delay, C])
  return (
    <Svg width={size} height={size} viewBox="0 0 76 76">
      <AnimatedCircle cx="38" cy="38" r="35" stroke={tok.rgb('--brand-400', 0.25)} strokeWidth={3} fill="none"
        strokeDasharray={C} strokeDashoffset={ring.interpolate({ inputRange: [0, 1], outputRange: [C, 0] })} />
      <AnimatedPath d="M23 39l10.5 10.5L54 27" stroke={tok.rgb('--brand-400')} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" fill="none"
        strokeDasharray={60} strokeDashoffset={check.interpolate({ inputRange: [0, 1], outputRange: [60, 0] })} />
    </Svg>
  )
}

/** Spinning ring (sho-spin). */
function Spinner({ size = 60, thickness = 4 }: { size?: number; thickness?: number }) {
  const tok = useTok()
  const spin = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: NATIVE }))
    loop.start()
    return () => loop.stop()
  }, [spin])
  return <Animated.View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: thickness, borderColor: tok.rgb('--fg', 0.1), borderTopColor: tok.rgb('--brand-400'), transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }} />
}

/* ─────────────────────────── shared UI controls ──────────────────────────── */

/** Premium segmented progress + section label (ProgressHeader). */
function ProgressHeader({ sectionIdx, sectionProgress, onBack, showBack = true }: { sectionIdx: number; sectionProgress: number; onBack: () => void; showBack?: boolean }) {
  const tok = useTok()
  // The header remounts with each step (Stage keys the whole screen), so start
  // each bar AT its current fill — mirroring CSS, which only transitions
  // changes after mount — and animate only subsequent in-place updates.
  const fills = useRef(SECTIONS.map((_s, i) => new Animated.Value(i < sectionIdx ? 1 : i === sectionIdx ? sectionProgress : 0))).current
  useEffect(() => {
    fills.forEach((f, i) => {
      const target = i < sectionIdx ? 1 : i === sectionIdx ? sectionProgress : 0
      Animated.timing(f, { toValue: target, duration: 600, easing: EASE, useNativeDriver: false }).start()
    })
  }, [fills, sectionIdx, sectionProgress])
  return (
    // The app renders below a real (or frame-drawn) status bar, so the
    // prototype's 48px status-clearing padding shrinks to a small gap.
    <View style={{ paddingTop: 6, paddingHorizontal: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40 }}>
        <Pressable onPress={() => { if (showBack) { tick(); onBack() } }} hitSlop={8} style={{ width: 40, height: 40, marginLeft: -8, borderRadius: 999, alignItems: 'center', justifyContent: 'center', opacity: showBack ? 1 : 0 }}>
          <Icon name="back" size={22} stroke={2.4} color={tok.rgb('--fg', 0.7)} />
        </Pressable>
        <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
          {SECTIONS.map((s, i) => (
            <View key={s.id} style={{ flex: 1, height: 5, borderRadius: 999, backgroundColor: tok.rgb('--fg', 0.12), overflow: 'hidden' }}>
              <Animated.View style={{ height: '100%', borderRadius: 999, backgroundColor: tok.rgb('--brand-400'), width: fills[i].interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
            </View>
          ))}
        </View>
        <View style={{ width: 32 }} />
      </View>
      <Text style={{ marginTop: 8, marginLeft: 34, fontSize: 12.5, fontWeight: '600', letterSpacing: 0.7, textTransform: 'uppercase', color: tok.rgb('--brand-300') }}>{SECTIONS[sectionIdx]?.label}</Text>
    </View>
  )
}

/** Question heading block (QHeader) with optional chip. */
function QHeader({ title, sub, chip }: { title: string; sub?: string; chip?: ReactNode }) {
  const tok = useTok()
  return (
    <View style={{ marginBottom: 22 }}>
      {chip ? <Reveal delay={40} style={{ marginBottom: 12, alignSelf: 'flex-start' }}>{chip}</Reveal> : null}
      <Reveal delay={60}><Text style={{ fontSize: 27, lineHeight: 32, fontWeight: '800', letterSpacing: -0.5, color: tok.rgb('--fg') }}>{title}</Text></Reveal>
      {sub ? <Reveal delay={130}><Text style={{ marginTop: 10, fontSize: 15, lineHeight: 22, color: tok.rgb('--fg', 0.55) }}>{sub}</Text></Reveal> : null}
    </View>
  )
}

/** Bottom action bar with a gradient scrim, optional hint + skip link. */
function ActionBar({ onPress, disabled, label = 'Continue', onSkip, skipLabel = 'Skip', hint }: { onPress: () => void; disabled?: boolean; label?: string; onSkip?: () => void; skipLabel?: string; hint?: string }) {
  const tok = useTok()
  const scale = useRef(new Animated.Value(1)).current
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 26 }}>
      {/* prototype scrim: linear-gradient(to top, ink-900 62%, transparent) */}
      <LinearGradient pointerEvents="none" colors={[tok.rgb('--ink-900', 0), tok.rgb('--ink-900'), tok.rgb('--ink-900')]} locations={[0, 0.38, 1]} style={{ position: 'absolute', top: -26, left: 0, right: 0, bottom: 0 }} />
      {hint ? <Text style={{ textAlign: 'center', fontSize: 13, color: tok.rgb('--fg', 0.5), marginBottom: 10 }}>{hint}</Text> : null}
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          disabled={disabled}
          onPressIn={() => { if (!disabled) Animated.spring(scale, { toValue: 0.985, useNativeDriver: NATIVE, speed: 50, bounciness: 0 }).start() }}
          onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: NATIVE, speed: 30, bounciness: 6 }).start()}
          onPress={() => { if (!disabled) { thud(); onPress() } }}
          style={{ height: 54, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: disabled ? tok.rgb('--fg', 0.09) : tok.rgb('--brand-400') }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: disabled ? tok.rgb('--fg', 0.35) : '#08140a' }}>{label}</Text>
        </Pressable>
      </Animated.View>
      {onSkip ? (
        <Pressable onPress={() => { tick(); onSkip() }} style={{ height: 40, marginTop: 6, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: tok.rgb('--fg', 0.5) }}>{skipLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

function Radio({ selected }: { selected: boolean }) {
  const tok = useTok()
  return (
    <View style={{ width: 24, height: 24, borderRadius: 999, borderWidth: 2, borderColor: selected ? tok.rgb('--brand-400') : tok.rgb('--fg', 0.22), backgroundColor: selected ? tok.rgb('--brand-400') : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      {selected ? <Icon name="check" size={15} color="#08140a" stroke={3} /> : null}
    </View>
  )
}

/** Simple single-select row (glyph + label + optional flag + radio). */
function OptionRow({ label, glyph, flag, selected, onPress }: { label: string; glyph?: string; flag?: string; selected: boolean; onPress: () => void }) {
  const tok = useTok()
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 17, paddingHorizontal: 18, borderRadius: 18, backgroundColor: selected ? tok.rgb('--brand-400', 0.12) : tok.rgb('--ink-800'), borderWidth: 1.5, borderColor: selected ? tok.rgb('--brand-400', 0.9) : tok.rgb('--fg', 0.06), transform: [{ scale: selected ? 1.005 : 1 }] }}>
      {glyph ? <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? tok.rgb('--brand-400', 0.18) : tok.rgb('--fg', 0.06) }}><Text style={{ fontSize: 22, color: selected ? tok.rgb('--brand-300') : tok.rgb('--fg', 0.6) }}>{glyph}</Text></View> : null}
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 }}>
        <Text style={{ fontSize: 16.5, fontWeight: '700', color: tok.rgb('--fg') }}>{label}</Text>
        {flag ? <View style={{ paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999, backgroundColor: tok.rgb('--brand-400', 0.16) }}><Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', color: tok.rgb('--brand-300') }}>{flag}</Text></View> : null}
      </View>
      <Radio selected={selected} />
    </Pressable>
  )
}

/** Rich selection card (icon + title + description + radio). */
function OptionCard({ icon, label, desc, selected, onPress }: { icon?: string; label: string; desc?: string; selected: boolean; onPress: () => void }) {
  const tok = useTok()
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 15, paddingVertical: 17, paddingHorizontal: 17, borderRadius: 20, backgroundColor: selected ? tok.rgb('--brand-400', 0.12) : tok.rgb('--ink-800'), borderWidth: 1.5, borderColor: selected ? tok.rgb('--brand-400', 0.9) : tok.rgb('--fg', 0.06), transform: [{ scale: selected ? 1.005 : 1 }] }}>
      {icon ? <View style={{ width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? tok.rgb('--brand-400', 0.18) : tok.rgb('--fg', 0.06) }}><Icon name={icon} size={24} color={selected ? tok.rgb('--brand-300') : tok.rgb('--fg', 0.6)} /></View> : null}
      <View style={{ flex: 1, paddingTop: 1 }}>
        <Text style={{ fontSize: 16.5, fontWeight: '700', color: tok.rgb('--fg') }}>{label}</Text>
        {desc ? <Text style={{ fontSize: 13.5, lineHeight: 19.5, color: tok.rgb('--fg', 0.5), marginTop: 4 }}>{desc}</Text> : null}
      </View>
      <View style={{ paddingTop: 11 }}><Radio selected={selected} /></View>
    </Pressable>
  )
}

/** Multi-select pill chip. */
function SelectChip({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled?: boolean; onPress: () => void }) {
  const tok = useTok()
  return (
    <Pressable disabled={disabled && !selected} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 999, backgroundColor: selected ? tok.rgb('--brand-400', 0.16) : tok.rgb('--ink-800'), borderWidth: 1.5, borderColor: selected ? tok.rgb('--brand-400', 0.85) : tok.rgb('--fg', 0.07), transform: [{ scale: selected ? 1.03 : 1 }] }}>
      {selected ? <Icon name="check" size={14} color={tok.rgb('--brand-300')} stroke={3} /> : null}
      <Text style={{ fontSize: 15, fontWeight: '600', color: selected ? tok.rgb('--brand-300') : disabled ? tok.rgb('--fg', 0.28) : tok.rgb('--fg', 0.82) }}>{label}</Text>
    </Pressable>
  )
}

/** 7-column weekday grid (day initials). */
function WeekdayGrid({ selected, onToggle }: { selected: string[]; onToggle: (d: string) => void }) {
  const tok = useTok()
  return (
    <View style={{ flexDirection: 'row', gap: 7 }}>
      {DAYS.map((d) => {
        const on = selected.includes(d)
        return (
          <Pressable key={d} onPress={() => { tick(); onToggle(d) }} style={{ flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: on ? tok.rgb('--brand-400', 0.16) : tok.rgb('--ink-800'), borderWidth: 1.5, borderColor: on ? tok.rgb('--brand-400', 0.85) : tok.rgb('--fg', 0.07), transform: [{ scale: on ? 1.04 : 1 }] }}>
            <Text style={{ fontSize: 13.5, fontWeight: '700', color: on ? tok.rgb('--brand-300') : tok.rgb('--fg', 0.55) }}>{DAYS_SHORT[d].slice(0, 1)}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/** Segmented unit toggle (cm/ft, kg/lb). */
function UnitToggle({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  const tok = useTok()
  return (
    <View style={{ flexDirection: 'row', padding: 3, borderRadius: 999, backgroundColor: tok.rgb('--ink-800'), borderWidth: 1, borderColor: tok.rgb('--fg', 0.06) }}>
      {options.map((o) => {
        const on = o === value
        return (
          <Pressable key={o} onPress={() => { tick(); onChange(o) }} style={{ paddingVertical: 7, paddingHorizontal: 18, borderRadius: 999, backgroundColor: on ? tok.rgb('--brand-400') : 'transparent' }}>
            <Text style={{ fontSize: 13.5, fontWeight: '700', color: on ? '#08140a' : tok.rgb('--fg', 0.5) }}>{o}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function ValueReadout({ value, unit }: { value: number | string; unit: string }) {
  const tok = useTok()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
      <Text style={{ fontSize: 52, fontWeight: '800', letterSpacing: -1.5, color: tok.rgb('--fg') }}>{value}</Text>
      {unit ? <Text style={{ fontSize: 20, fontWeight: '700', color: tok.rgb('--brand-300') }}>{unit}</Text> : null}
    </View>
  )
}

/** Edge fade so the ruler tape dissolves at both ends (mirrors the CSS mask). */
function FadeMask({ horizontal }: { horizontal: boolean }) {
  const tok = useTok()
  const bg = tok.rgb('--ink-900')
  const clear = tok.rgb('--ink-900', 0)
  const common: ViewStyle = { position: 'absolute' }
  if (horizontal) {
    return (
      <>
        <LinearGradient pointerEvents="none" colors={[bg, clear]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={[common, { left: 0, top: 0, bottom: 0, width: '22%' }]} />
        <LinearGradient pointerEvents="none" colors={[clear, bg]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={[common, { right: 0, top: 0, bottom: 0, width: '22%' }]} />
      </>
    )
  }
  return (
    <>
      <LinearGradient pointerEvents="none" colors={[bg, clear]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={[common, { top: 0, left: 0, right: 0, height: '24%' }]} />
      <LinearGradient pointerEvents="none" colors={[clear, bg]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={[common, { bottom: 0, left: 0, right: 0, height: '24%' }]} />
    </>
  )
}

/** Draggable ruler / tape control. Value is in display units. */
function RulerControl({ value, onChange, min, max, unit, orientation }: { value: number; onChange: (v: number) => void; min: number; max: number; unit: string; orientation: 'horizontal' | 'vertical' }) {
  const tok = useTok()
  const vertical = orientation === 'vertical'
  const GAP = vertical ? 13 : 15
  const { width: screenW } = useWindowDimensions()
  const base = useRef(value)
  const last = useRef(value)
  const dragging = useRef(false)

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { base.current = last.current = value; dragging.current = true },
    onPanResponderMove: (_e, g) => {
      const d = vertical ? g.dy : -g.dx
      let nv = Math.round(base.current + d / GAP)
      nv = Math.max(min, Math.min(max, nv))
      if (nv !== last.current) { last.current = nv; tick(); onChange(nv) }
    },
    onPanResponderRelease: () => { dragging.current = false },
    onPanResponderTerminate: () => { dragging.current = false },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [vertical, GAP, min, max, value])

  const ticks: number[] = []
  for (let v = min; v <= max; v++) ticks.push(v)
  const offset = (value - min) * GAP

  if (vertical) {
    const H = 240
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20, justifyContent: 'center' }}>
        <ValueReadout value={value} unit={unit} />
        <View {...pan.panHandlers} style={{ width: 96, height: H, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', left: 0, right: 0, top: H / 2 - offset }}>
            {ticks.map((v) => {
              const major = v % 10 === 0, mid = v % 5 === 0
              return (
                <View key={v} style={{ position: 'absolute', top: (v - min) * GAP, right: 0, height: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', width: '100%' }}>
                  {major ? <Text style={{ fontSize: 12, fontWeight: '700', color: tok.rgb('--fg', 0.5), marginRight: 10 }}>{v}</Text> : null}
                  <View style={{ width: major ? 28 : mid ? 20 : 13, height: 2, borderRadius: 2, backgroundColor: tok.rgb('--fg', major ? 0.4 : 0.18) }} />
                </View>
              )
            })}
          </View>
          <FadeMask horizontal={false} />
          <View style={{ position: 'absolute', top: H / 2 - 1.5, right: 0, width: 40, height: 3, borderRadius: 3, backgroundColor: tok.rgb('--brand-400') }} />
        </View>
      </View>
    )
  }
  const W = Math.min(screenW, 402)
  return (
    <View style={{ alignItems: 'center', gap: 18 }}>
      <ValueReadout value={value} unit={unit} />
      <View {...pan.panHandlers} style={{ width: W, height: 82, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', top: 8, bottom: 22, left: W / 2 - offset }}>
          {ticks.map((v) => {
            const major = v % 10 === 0, mid = v % 5 === 0
            return (
              <View key={v} style={{ position: 'absolute', left: (v - min) * GAP, top: 0, bottom: 0, alignItems: 'center' }}>
                <View style={{ width: 2, height: major ? 34 : mid ? 24 : 15, borderRadius: 2, backgroundColor: tok.rgb('--fg', major ? 0.42 : 0.18) }} />
                {major ? <Text style={{ fontSize: 12, fontWeight: '700', color: tok.rgb('--fg', 0.5), marginTop: 6 }}>{v}</Text> : null}
              </View>
            )
          })}
        </View>
        <FadeMask horizontal />
        <View style={{ position: 'absolute', left: W / 2 - 1.5, top: 4, width: 3, height: 44, borderRadius: 3, backgroundColor: tok.rgb('--brand-400') }} />
      </View>
    </View>
  )
}

/** Screen shell: fixed header, scrollable body, pinned footer (no remounts). */
function Shell({ header, footer, children }: { header?: ReactNode; footer?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ flex: 1 }}>
      {header}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
      {footer}
    </View>
  )
}

/** A back top-bar for the standalone phase screens (Terms/Summary/Account). */
function TopBack({ onBack, label }: { onBack: () => void; label?: string }) {
  const tok = useTok()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 6, paddingHorizontal: 16, minHeight: 40 }}>
      <Pressable onPress={() => { tick(); onBack() }} hitSlop={8} style={{ width: 40, height: 40, marginLeft: -8, borderRadius: 999, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="back" size={22} stroke={2.4} color={tok.rgb('--fg', 0.7)} />
      </Pressable>
      {label ? <Text style={{ fontSize: 13, fontWeight: '600', letterSpacing: 0.65, textTransform: 'uppercase', color: tok.rgb('--brand-300') }}>{label}</Text> : null}
    </View>
  )
}

/* ──────────────────────────── the screen ─────────────────────────────────── */

type Phase = 'splash' | 'welcome' | 'login' | 'flow' | 'gate-under16' | 'gate-guardian' | 'terms' | 'processing' | 'summary' | 'account'

export default function Onboarding() {
  const dispatch = useDispatch()
  const tok = useTok()
  const [answers, setAnswers] = useState<Answers>(DEFAULT_ANSWERS)
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd')
  const [phase, setPhase] = useState<Phase>('splash')
  const [returnToSummary, setReturnToSummary] = useState(false)
  const set = <K extends keyof Answers>(k: K, v: Answers[K]) => setAnswers((a) => ({ ...a, [k]: v }))

  const flow = useMemo(() => buildFlow(answers), [answers])
  const step = flow[Math.min(index, flow.length - 1)]

  const sectionIdx = step ? SECTIONS.findIndex((s) => s.id === step.section) : 0
  const sectionSteps = step ? flow.filter((s) => s.section === step.section) : []
  const sectionProgress = sectionSteps.length <= 1 ? 1 : sectionSteps.indexOf(step) / sectionSteps.length

  const advance = () => {
    if (returnToSummary) { setReturnToSummary(false); setDir('back'); setPhase('summary'); return }
    setDir('fwd'); setIndex((i) => Math.min(i + 1, flow.length - 1))
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

  const header = <ProgressHeader sectionIdx={sectionIdx} sectionProgress={sectionProgress} onBack={back} />

  let view: ReactNode
  let viewKey = phase as string
  if (phase === 'splash') view = <Splash onDone={() => { setDir('fwd'); setPhase('welcome') }} />
  else if (phase === 'welcome') view = <Welcome onStart={() => { setDir('fwd'); setIndex(0); setPhase('flow') }} onLogin={() => { setDir('fwd'); setPhase('login') }} />
  else if (phase === 'login') view = <Login onBack={() => { setDir('back'); setPhase('welcome') }} />
  else if (phase === 'gate-under16') view = <Under16 onBack={() => { setDir('back'); setPhase('flow') }} />
  else if (phase === 'gate-guardian') view = <Guardian answers={answers} set={set} onBack={() => { setDir('back'); setPhase('flow') }} onContinue={() => { set('guardianConsent', true); setPhase('flow'); advance() }} />
  else if (phase === 'terms') view = <Terms answers={answers} set={set} onBack={() => { setDir('back'); setPhase('flow'); setIndex(flow.length - 1) }} onContinue={() => { setDir('fwd'); setPhase('processing') }} />
  else if (phase === 'processing') view = <Processing onDone={() => { setDir('fwd'); setPhase('summary') }} />
  else if (phase === 'summary') view = <Summary answers={answers} onEdit={onEdit} onContinue={() => { setDir('fwd'); setPhase('account') }} onBack={() => { setDir('back'); setPhase('flow'); setIndex(flow.length - 1) }} />
  else if (phase === 'account') view = <AccountCreate onComplete={finish} onBack={() => { setDir('back'); setPhase('summary') }} />
  else {
    viewKey = 'flow:' + step?.id
    view = <StepView step={step} answers={answers} set={set} header={header} onContinue={onContinue} onAdvance={advance} onRestart={restart} />
  }

  return (
    <View style={{ flex: 1, backgroundColor: tok.rgb('--ink-900') }}>
      <Stage animKey={viewKey} dir={dir}>{view}</Stage>
    </View>
  )
}

/* ─────────────────────────── per-step renderer ───────────────────────────── */

type SetFn = <K extends keyof Answers>(k: K, v: Answers[K]) => void

function StepView({ step, answers, set, header, onContinue, onAdvance, onRestart }: {
  step: Step; answers: Answers; set: SetFn; header: ReactNode; onContinue: () => void; onAdvance: () => void; onRestart: () => void
}) {
  const tok = useTok()
  if (!step) return null

  switch (step.type) {
    case 'text':
      return <TextStep step={step} answers={answers} set={set} header={header} onContinue={onContinue} onSkip={onAdvance} />
    case 'date':
      return <DateStep step={step} answers={answers} set={set} header={header} onContinue={onContinue} />
    case 'measure':
      return <MeasureStep step={step} answers={answers} set={set} header={header} onContinue={onContinue} />
    case 'search':
      return <SearchStep step={step} answers={answers} set={set} header={header} onContinue={onContinue} onSkip={onAdvance} />
    case 'activitydetail':
      return <ActivityDetailStep step={step} answers={answers} set={set} header={header} onContinue={onContinue} onSkip={onAdvance} />

    case 'single': {
      const key = step.key as keyof Answers
      const cur = answers[key]
      const valid = cur !== undefined && cur !== ''
      const pick = (v: any) => { tick(); set(key, v); if (step.autoAdvance) setTimeout(onContinue, 240) }
      return (
        <Shell header={header} footer={step.autoAdvance ? undefined : <ActionBar disabled={!valid} onPress={onContinue} />}>
          <QHeader title={step.title} sub={step.sub} />
          <View style={{ gap: 11 }}>
            <Stagger start={170} step={58}>
              {step.options.map((o: any) => step.cards
                ? <OptionCard key={String(o.value)} icon={o.icon} label={o.label} desc={o.desc} selected={cur === o.value} onPress={() => pick(o.value)} />
                : <OptionRow key={String(o.value)} label={o.label} glyph={o.glyph} flag={o.flag} selected={cur === o.value} onPress={() => pick(o.value)} />)}
            </Stagger>
          </View>
        </Shell>
      )
    }

    case 'multi': {
      const key = step.key as keyof Answers
      const arr = (answers[key] as string[]) || []
      const count = arr.filter((x) => x !== step.noneValue).length
      const atMax = step.max ? count >= step.max : false
      const noneOn = step.noneValue ? arr.includes(step.noneValue) : false
      const toggle = (v: string) => {
        tick()
        if (step.noneValue && v === step.noneValue) { set(key, (arr.includes(v) ? [] : [step.noneValue]) as any); return }
        let next: string[]
        if (arr.includes(v)) next = arr.filter((x) => x !== v)
        else { if (step.max && count >= step.max) return; next = [...arr.filter((x) => (step.exclusiveNone ? x !== step.noneValue : true)), v] }
        set(key, next as any)
      }
      const showOther = step.otherValue && arr.includes(step.otherValue)
      const disabled = step.weekday ? arr.length === 0 : step.skipLabel ? count === 0 : step.optional ? false : count === 0
      return (
        <Shell header={header} footer={<ActionBar disabled={disabled} onPress={onContinue} onSkip={(step.optional || step.skipLabel) && count === 0 ? onAdvance : undefined} skipLabel={step.skipLabel || 'Skip'} />}>
          <QHeader title={step.title} sub={step.sub}
            chip={step.max ? (
              <View style={{ paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999, backgroundColor: atMax ? tok.rgb('--brand-400', 0.16) : tok.rgb('--fg', 0.08) }}>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: atMax ? tok.rgb('--brand-300') : tok.rgb('--fg', 0.6) }}>{count}/{step.max} selected{atMax ? ' · limit reached' : ''}</Text>
              </View>
            ) : undefined} />
          {step.weekday ? (
            <Reveal delay={170}><WeekdayGrid selected={arr} onToggle={toggle} /></Reveal>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <Stagger start={160} step={40}>
                {(step.options as string[]).map((o) => <SelectChip key={o} label={o} selected={arr.includes(o)} disabled={atMax && !arr.includes(o)} onPress={() => toggle(o)} />)
                  .concat(step.noneValue ? [<SelectChip key="__none" label={step.noneValue} selected={noneOn} onPress={() => toggle(step.noneValue)} />] : [])}
              </Stagger>
            </View>
          )}
          {step.weekday && arr.length > 0 ? (
            <View style={{ marginTop: 18, paddingVertical: 13, paddingHorizontal: 15, borderRadius: 14, backgroundColor: tok.rgb('--brand-400', 0.08), borderWidth: 1, borderColor: tok.rgb('--brand-400', 0.18) }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: tok.rgb('--brand-300') }}>{daysMessage(answers)}</Text>
            </View>
          ) : null}
          {step.weekday && step.note ? <Text style={{ marginTop: 12, fontSize: 13, lineHeight: 19.5, color: tok.rgb('--fg', 0.4) }}>{step.note}</Text> : null}
          {step.selectNote && count > 0 ? (
            <View style={{ marginTop: 18, flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 13, paddingHorizontal: 15, borderRadius: 14, backgroundColor: tok.rgb('--brand-400', 0.08), borderWidth: 1, borderColor: tok.rgb('--brand-400', 0.18) }}>
              <View style={{ marginTop: 1 }}><Icon name="shield" size={17} color={tok.rgb('--brand-300')} /></View>
              <Text style={{ flex: 1, fontSize: 13.5, lineHeight: 19.6, fontWeight: '500', color: tok.rgb('--brand-300') }}>{step.selectNote}</Text>
            </View>
          ) : null}
          {showOther ? (
            <View style={{ marginTop: 16 }}>
              <FocusInput value={answers.activityOther} onChangeText={(t) => set('activityOther', t)} placeholder="What activity is it?" />
            </View>
          ) : null}
        </Shell>
      )
    }

    case 'interstitial':
      return <Interstitial message={step.compute(answers)} header={header} onContinue={onAdvance} />
    case 'midtransition':
      return <MidTransition header={header} onContinue={onAdvance} />

    case 'followupintro': {
      const areas = joinAreas(trainAroundAreas(answers))
      return (
        <View style={{ flex: 1 }}>
          {header}
          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 26 }}>
            <Reveal delay={60}><Text style={{ fontSize: 12.5, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: tok.rgb('--brand-300'), marginBottom: 14 }}>Extra care</Text></Reveal>
            <Reveal delay={120}><Text style={{ fontSize: 26, fontWeight: '800', letterSpacing: -0.5, color: tok.rgb('--fg'), lineHeight: 31 }}>About your {areas || 'flagged area'}</Text></Reveal>
            <Reveal delay={200}><Text style={{ marginTop: 14, fontSize: 15.5, lineHeight: 24, color: tok.rgb('--fg', 0.6) }}>You mentioned this may need extra care. Just a few quick questions so we can work around it and see how we can help.</Text></Reveal>
          </View>
          <ActionBar label="Continue" onPress={onAdvance} />
        </View>
      )
    }

    case 'followup': {
      const q = step.q
      const val = (answers.followup || {})[step.key]
      const isYesNo = q.type === 'yesno'
      const opts = isYesNo ? [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }] : q.options
      const pick = (v: string) => { tick(); set('followup', { ...answers.followup, [step.key]: v }); if (isYesNo) setTimeout(onAdvance, 300) }
      return (
        <View style={{ flex: 1 }}>
          {header}
          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}>
            <Reveal delay={80}><Text style={{ marginBottom: 30, fontSize: 24, fontWeight: '700', color: tok.rgb('--fg'), lineHeight: 31 }}>{q.text}</Text></Reveal>
            <View style={{ gap: 11 }}>
              <Stagger start={180} step={60}>
                {opts.map((o: any) => <OptionRow key={o.value} label={o.label} selected={val === o.value} onPress={() => pick(o.value)} />)}
              </Stagger>
            </View>
          </View>
          {isYesNo ? <View style={{ height: 22 }} /> : <ActionBar disabled={val === undefined} onPress={onAdvance} />}
        </View>
      )
    }

    case 'movements': {
      const sel = answers.movements
      const toggle = (m: string) => { tick(); set('movements', sel.includes(m) ? sel.filter((x) => x !== m) : [...sel, m]) }
      return (
        <Shell header={header} footer={<ActionBar onPress={onContinue} onSkip={onAdvance} skipLabel="Nothing specific" />}>
          <QHeader title={step.title} sub={step.sub} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Stagger start={150} step={40}>
              {MOVEMENT_CATEGORIES.map((m) => <SelectChip key={m} label={m} selected={sel.includes(m)} onPress={() => toggle(m)} />)}
            </Stagger>
          </View>
          <View style={{ marginTop: 18 }}>
            <FocusInput value={answers.movementsOther} onChangeText={(t) => set('movementsOther', t)} placeholder="Anything else you'd like to describe (optional)" multiline />
          </View>
        </Shell>
      )
    }

    case 'safetyall': {
      const answered = SAFETY_QUESTIONS.filter((q) => answers.safety[q.id]).length
      const total = SAFETY_QUESTIONS.length
      const setV = (id: string, v: 'yes' | 'no') => { tick(); set('safety', { ...answers.safety, [id]: v }) }
      return (
        <Shell header={header} footer={<ActionBar disabled={answered < total} onPress={onContinue} hint={answered < total ? `${answered} of ${total} answered` : undefined} />}>
          <QHeader title="Our final 7 second safety check" sub="Tap Yes or No for each." />
          <View style={{ gap: 10 }}>
            {SAFETY_QUESTIONS.map((q, i) => (
              <Reveal key={q.id} delay={110 + i * 45}>
                <View style={{ paddingVertical: 14, paddingHorizontal: 15, borderRadius: 16, backgroundColor: tok.rgb('--ink-800'), borderWidth: 1, borderColor: answers.safety[q.id] === 'yes' ? tok.rgb('--accent-orange', 0.4) : tok.rgb('--fg', 0.06) }}>
                  <Text style={{ fontSize: 13.8, lineHeight: 19.3, fontWeight: '500', color: tok.rgb('--fg', 0.85) }}>{q.text}</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 11 }}>
                    {(['no', 'yes'] as const).map((v) => {
                      const on = answers.safety[q.id] === v
                      const warn = v === 'yes' && on
                      return (
                        <Pressable key={v} onPress={() => setV(q.id, v)} style={{ flex: 1, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? (warn ? tok.rgb('--accent-orange', 0.16) : tok.rgb('--brand-400', 0.16)) : tok.rgb('--ink-700'), borderWidth: 1.5, borderColor: on ? (warn ? tok.rgb('--accent-orange', 0.7) : tok.rgb('--brand-400', 0.8)) : 'transparent' }}>
                          <Text style={{ fontSize: 14.5, fontWeight: '700', color: on ? (warn ? tok.rgb('--accent-orange') : tok.rgb('--brand-300')) : tok.rgb('--fg', 0.6) }}>{v === 'yes' ? 'Yes' : 'No'}</Text>
                        </Pressable>
                      )
                    })}
                  </View>
                </View>
              </Reveal>
            ))}
          </View>
        </Shell>
      )
    }

    case 'safetyoutcome':
      return <SafetyOutcome answers={answers} header={header} onSaveExit={onRestart} />

    default:
      return <View style={{ padding: 40 }}><Text style={{ color: tok.rgb('--fg') }}>Unknown step: {step.type}</Text></View>
  }
}

/** Text input with a brand focus ring (matches the prototype's focus style). */
function FocusInput({ value, onChangeText, placeholder, multiline, autoFocus, keyboardType, autoCapitalize, big }: {
  value: string; onChangeText: (t: string) => void; placeholder?: string; multiline?: boolean; autoFocus?: boolean; keyboardType?: 'default' | 'email-address'; autoCapitalize?: 'none' | 'words' | 'sentences'; big?: boolean
}) {
  const tok = useTok()
  const [focused, setFocused] = useState(false)
  const ref = useRef<TextInput>(null)
  // The prototype focuses 360ms after mount so the screen slide settles first —
  // focusing immediately yanks the view mid-transition.
  useEffect(() => {
    if (!autoFocus) return
    const t = setTimeout(() => ref.current?.focus(), 360)
    return () => clearTimeout(t)
  }, [autoFocus])
  return (
    <TextInput
      ref={ref}
      value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={tok.rgb('--fg', 0.32)}
      multiline={multiline} keyboardType={keyboardType} autoCapitalize={autoCapitalize}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} selectionColor={tok.rgb('--brand-400')}
      style={{
        width: '100%', backgroundColor: tok.rgb('--ink-800'), color: tok.rgb('--fg'), borderRadius: multiline ? 14 : 16,
        borderWidth: 1.5, borderColor: focused ? tok.rgb('--brand-400', 0.8) : tok.rgb('--fg', 0.08),
        paddingHorizontal: multiline ? 15 : 16, paddingVertical: multiline ? 14 : 16,
        // Prototype: 18px, semibold ONLY for single-line answers; multiline
        // paragraphs (and their placeholders) stay regular weight at 1.5.
        fontSize: big ? 18 : 15.5, fontWeight: big && !multiline ? '600' : '400',
        lineHeight: multiline ? (big ? 27 : 22) : undefined, textAlignVertical: multiline ? 'top' : 'center',
        minHeight: multiline ? (big ? 113 : 92) : undefined,
      }}
    />
  )
}

/* ─────────────────────────────── text step ───────────────────────────────── */

function TextStep({ step, answers, set, header, onContinue, onSkip }: { step: Step; answers: Answers; set: SetFn; header: ReactNode; onContinue: () => void; onSkip: () => void }) {
  const tok = useTok()
  const key = step.key as keyof Answers
  const val = (answers[key] as string) || ''
  const valid = step.optional ? true : val.trim().length > 0
  const showName = step.key === 'name' && val.trim().length > 0
  return (
    <Shell header={header} footer={<ActionBar disabled={!valid} onPress={onContinue} onSkip={step.optional ? onSkip : undefined} skipLabel="Skip" />}>
      <QHeader title={step.title} sub={step.sub} />
      <Reveal delay={180}>
        <FocusInput value={val} onChangeText={(t) => set(key, t as any)} placeholder={step.placeholder} multiline={!!step.multiline} autoFocus big />
      </Reveal>
      {showName ? <Reveal delay={40} style={{ marginTop: 16 }}><Text style={{ fontSize: 15, fontWeight: '600', color: tok.rgb('--brand-300') }}>Great to meet you, {normalizeName(val).split(' ')[0]}.</Text></Reveal> : null}
      {step.prompts ? (
        <View style={{ marginTop: 18 }}>
          <Text style={{ fontSize: 12.5, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase', color: tok.rgb('--fg', 0.4), marginBottom: 10 }}>Need a nudge?</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(step.prompts as string[]).map((p, i) => {
              const on = val.toLowerCase().includes(p.toLowerCase())
              return (
                <Reveal key={p} delay={220 + i * 40}>
                  <Pressable onPress={() => { if (on) return; tick(); const cur = val.trim(); set(key, (cur ? cur + '. ' + p : p) as any) }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, backgroundColor: on ? tok.rgb('--brand-400', 0.16) : tok.rgb('--ink-700'), borderWidth: 1, borderColor: on ? tok.rgb('--brand-400', 0.7) : tok.rgb('--fg', 0.06) }}>
                    <Icon name={on ? 'check' : 'plus'} size={13} stroke={on ? 3 : 2.4} color={on ? tok.rgb('--brand-300') : tok.rgb('--fg', 0.4)} />
                    <Text style={{ fontSize: 13.5, fontWeight: '600', color: on ? tok.rgb('--brand-300') : tok.rgb('--fg', 0.7) }}>{p}</Text>
                  </Pressable>
                </Reveal>
              )
            })}
          </View>
        </View>
      ) : null}
    </Shell>
  )
}

/* ─────────────────────────── DOB wheel date step ─────────────────────────── */

const DOB_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WHEEL_ITEM = 42
const pad2 = (n: number) => String(n).padStart(2, '0')

function Wheel({ items, index, onIndex, flexBasis, render }: { items: (string | number)[]; index: number; onIndex: (i: number) => void; flexBasis: number; render?: (v: string | number) => string }) {
  const tok = useTok()
  const ref = useRef<ScrollView>(null)
  const last = useRef(index)
  useEffect(() => { const t = setTimeout(() => ref.current?.scrollTo({ y: index * WHEEL_ITEM, animated: false }), 0); return () => clearTimeout(t) /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.max(0, Math.min(items.length - 1, Math.round(e.nativeEvent.contentOffset.y / WHEEL_ITEM)))
    if (i !== last.current) { last.current = i; tick(); onIndex(i) }
  }
  return (
    <ScrollView ref={ref} style={{ flex: flexBasis, height: WHEEL_ITEM * 5 }} showsVerticalScrollIndicator={false} snapToInterval={WHEEL_ITEM} decelerationRate="fast" scrollEventThrottle={16} onScroll={onScroll} contentContainerStyle={{ paddingVertical: WHEEL_ITEM * 2 }}>
      {items.map((it, i) => {
        const sel = i === index
        return (
          <Pressable key={i} onPress={() => ref.current?.scrollTo({ y: i * WHEEL_ITEM, animated: true })} style={{ height: WHEEL_ITEM, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: sel ? 19 : 16, fontWeight: sel ? '800' : '500', color: sel ? tok.rgb('--fg') : tok.rgb('--fg', 0.3), opacity: Math.abs(i - index) > 2 ? 0.4 : 1 }}>{render ? render(it) : String(it)}</Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

function DateStep({ step, answers, set, header, onContinue }: { step: Step; answers: Answers; set: SetFn; header: ReactNode; onContinue: () => void }) {
  const tok = useTok()
  const now = new Date()
  const years = useMemo(() => { const out: number[] = []; for (let y = now.getFullYear() - 13; y >= now.getFullYear() - 80; y--) out.push(y); return out }, [])
  const initial = answers.dob ? new Date(answers.dob + 'T00:00:00') : null
  const [mIdx, setM] = useState(initial ? initial.getMonth() : 0)
  const [dIdx, setD] = useState(initial ? initial.getDate() - 1 : 0)
  const [yIdx, setY] = useState(initial ? Math.max(0, years.indexOf(initial.getFullYear())) : Math.max(0, years.indexOf(now.getFullYear() - 20)))
  const days = useMemo(() => Array.from({ length: 31 }, (_, i) => i + 1), [])
  const commit = (m: number, d: number, y: number) => {
    const year = years[y]; const dim = new Date(year, m + 1, 0).getDate(); const dayN = Math.min(d + 1, dim)
    set('dob', `${year}-${pad2(m + 1)}-${pad2(dayN)}`)
  }
  useEffect(() => { commit(mIdx, dIdx, yIdx) /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])
  return (
    <View style={{ flex: 1 }}>
      {header}
      {/* Heading sits at the top like every other question page; only the
          wheel itself is centred in the remaining space. */}
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 18 }}>
        <QHeader title={step.title} sub={step.sub} />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Reveal delay={180}>
            <View>
              <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 42, marginTop: -21, borderRadius: 14, backgroundColor: tok.rgb('--ink-700'), borderWidth: 1, borderColor: tok.rgb('--brand-400', 0.28) }} />
              <View style={{ flexDirection: 'row' }}>
                <Wheel items={DOB_MONTHS} index={mIdx} onIndex={(i) => { setM(i); commit(i, dIdx, yIdx) }} flexBasis={1.5} />
                <Wheel items={days} index={dIdx} onIndex={(i) => { setD(i); commit(mIdx, i, yIdx) }} flexBasis={0.8} />
                <Wheel items={years} index={yIdx} onIndex={(i) => { setY(i); commit(mIdx, dIdx, i) }} flexBasis={1} />
              </View>
              <FadeMask horizontal={false} />
            </View>
          </Reveal>
        </View>
      </View>
      <ActionBar onPress={onContinue} />
    </View>
  )
}

/* ───────────────────────────── measure (ruler) ───────────────────────────── */

function FtInReadout({ inches }: { inches: number }) {
  const tok = useTok()
  const ft = Math.floor(inches / 12); const inch = inches % 12
  return <View style={{ alignItems: 'center', marginBottom: 4 }}><Text style={{ fontSize: 44, fontWeight: '800', letterSpacing: -1.3, color: tok.rgb('--fg') }}>{ft}′ {inch}″</Text></View>
}

function MeasureStep({ step, answers, set, header, onContinue }: { step: Step; answers: Answers; set: SetFn; header: ReactNode; onContinue: () => void }) {
  const key = step.key as 'height' | 'weight' | 'goalWeight'
  const isHeight = step.kind === 'height'
  const [unit, setUnit] = useState(isHeight ? 'cm' : 'kg')
  const isImperial = unit === 'ft' || unit === 'lb'
  const metric = answers[key] as number
  const min = isHeight ? (isImperial ? 48 : 120) : (isImperial ? 77 : 35)
  const max = isHeight ? (isImperial ? 87 : 220) : (isImperial ? 440 : 200)
  const toDisplay = (v: number) => isHeight ? (isImperial ? Math.round(v / 2.54) : v) : (isImperial ? Math.round(v * 2.20462) : v)
  const toMetric = (d: number) => isHeight ? (isImperial ? Math.round(d * 2.54) : d) : (isImperial ? Math.round(d / 2.20462) : d)
  const disp = toDisplay(metric)
  const readoutUnit = unit === 'ft' ? 'in' : unit
  return (
    <Shell header={header} footer={
      <View>
        <ActionBar onPress={onContinue} />
        {step.kind === 'goalweight' ? (
          <Pressable onPress={() => { thud(); set('noGoalWeight', true); setTimeout(onContinue, 120) }} style={{ marginTop: -20, marginBottom: 6, paddingVertical: 13, alignItems: 'center' }}>
            <SkipText>I don’t have a goal weight</SkipText>
          </Pressable>
        ) : null}
      </View>
    }>
      <QHeader title={step.title} sub={step.sub} />
      <View style={{ alignItems: 'center', marginBottom: 18 }}>
        <UnitToggle options={isHeight ? ['cm', 'ft'] : ['kg', 'lb']} value={unit} onChange={setUnit} />
      </View>
      <View style={{ marginTop: 12 }}>
        {isHeight && isImperial ? <FtInReadout inches={disp} /> : null}
        <RulerControl value={disp} onChange={(d) => set(key, toMetric(d))} min={min} max={max} unit={isHeight && isImperial ? 'in' : readoutUnit} orientation={isHeight ? 'vertical' : 'horizontal'} />
      </View>
    </Shell>
  )
}

function SkipText({ children }: { children: ReactNode }) {
  const tok = useTok()
  return <Text style={{ fontSize: 14.5, fontWeight: '600', color: tok.rgb('--fg', 0.55) }}>{children}</Text>
}

/* ─────────────────────────── search (love / avoid) ───────────────────────── */

function SearchStep({ step, answers, set, header, onContinue, onSkip }: { step: Step; answers: Answers; set: SetFn; header: ReactNode; onContinue: () => void; onSkip: () => void }) {
  const tok = useTok()
  const key = step.key as 'loveExercises' | 'avoidExercises'
  const sel = answers[key]
  const avoid = step.mode === 'avoid'
  const accent = avoid ? tok.rgb('--danger') : tok.rgb('--brand-300')
  const accentBg = avoid ? tok.rgb('--danger', 0.16) : tok.rgb('--brand-400', 0.16)
  const [q, setQ] = useState('')
  const [focus, setFocus] = useState(false)
  const results = q.trim() ? EXERCISE_LIB.filter((e) => e.toLowerCase().includes(q.toLowerCase()) && !sel.includes(e)).slice(0, 6) : []
  const add = (e: string) => { tick(); set(key, [...sel, e]); setQ('') }
  const rm = (e: string) => { tick(); set(key, sel.filter((x) => x !== e)) }
  const addCustom = () => { const v = q.trim(); if (v && !sel.includes(v)) add(v) }
  return (
    <Shell header={header} footer={<ActionBar onPress={onContinue} onSkip={onSkip} skipLabel="Skip" />}>
      <QHeader title={step.title} sub={step.sub} />
      <Reveal delay={160}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: tok.rgb('--ink-800'), borderRadius: 14, paddingVertical: 13, paddingHorizontal: 15, borderWidth: 1.5, borderColor: focus ? (avoid ? tok.rgb('--danger', 0.7) : tok.rgb('--brand-400', 0.7)) : tok.rgb('--fg', 0.08) }}>
          <Icon name="search" size={19} color={tok.rgb('--fg', 0.4)} />
          <TextInput value={q} onChangeText={setQ} onSubmitEditing={addCustom} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} placeholder="Search or type an exercise" placeholderTextColor={tok.rgb('--fg', 0.35)} selectionColor={accent} style={{ flex: 1, fontSize: 16, color: tok.rgb('--fg') }} />
          {q.trim() ? <Pressable onPress={addCustom} style={{ backgroundColor: accentBg, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 11 }}><Text style={{ fontSize: 13, fontWeight: '700', color: accent }}>Add</Text></Pressable> : null}
        </View>
      </Reveal>
      {results.length > 0 ? (
        <View style={{ marginTop: 10, backgroundColor: tok.rgb('--ink-800'), borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: tok.rgb('--fg', 0.06) }}>
          {results.map((e, i) => (
            <Pressable key={e} onPress={() => add(e)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 15, borderTopWidth: i ? 1 : 0, borderTopColor: tok.rgb('--fg', 0.05) }}>
              <Text style={{ fontSize: 15, color: tok.rgb('--fg', 0.85) }}>{e}</Text>
              <Icon name="plus" size={16} color={tok.rgb('--fg', 0.35)} />
            </Pressable>
          ))}
        </View>
      ) : null}
      {sel.length > 0 ? (
        <View style={{ marginTop: 20 }}>
          <Text style={{ fontSize: 12.5, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase', color: tok.rgb('--fg', 0.4), marginBottom: 10 }}>{avoid ? 'Excluded' : 'Favourites'}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {sel.map((e) => (
              <View key={e} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingLeft: 15, paddingRight: 12, borderRadius: 999, backgroundColor: avoid ? tok.rgb('--danger', 0.14) : tok.rgb('--brand-400', 0.14), borderWidth: 1, borderColor: avoid ? tok.rgb('--danger', 0.3) : tok.rgb('--brand-400', 0.3) }}>
                <Text style={{ fontSize: 14.5, fontWeight: '600', color: accent }}>{e}</Text>
                <Pressable onPress={() => rm(e)} hitSlop={6}><Icon name="close" size={14} stroke={2.5} color={accent} /></Pressable>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </Shell>
  )
}

/* ───────────────────────── activity detail (expandable) ──────────────────── */

function ActivityDetailStep({ step, answers, set, header, onContinue, onSkip }: { step: Step; answers: Answers; set: SetFn; header: ReactNode; onContinue: () => void; onSkip: () => void }) {
  const tok = useTok()
  const acts = (answers.activities || []).filter((x) => x !== 'None' && x !== 'Other')
  const detail = answers.activityDetail
  const [open, setOpen] = useState<string | null>(acts[0] || null)
  const patch = (act: string, p: Partial<ActivityDetail>) => { const base: ActivityDetail = detail[act] || { days: [] }; set('activityDetail', { ...detail, [act]: { ...base, ...p } }) }
  const toggleDay = (act: string, d: string) => { tick(); const cur = detail[act]?.days || []; patch(act, { days: cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d] }) }
  const complete = acts.every((a) => (detail[a]?.days?.length ?? 0) > 0 && detail[a]?.intensity)
  return (
    <Shell header={header} footer={<ActionBar disabled={!complete} onPress={onContinue} hint={!complete ? 'Set the days and intensity for each activity' : undefined} onSkip={onSkip} skipLabel={step.skipLabel || 'Skip'} />}>
      <QHeader title={step.title} sub={step.sub} />
      <View style={{ gap: 10 }}>
        {acts.map((act, i) => {
          const d = detail[act] || { days: [] }
          const isOpen = open === act
          const done = (d.days?.length ?? 0) > 0 && d.intensity
          return (
            <Reveal key={act} delay={150 + i * 60}>
              <View style={{ borderRadius: 18, backgroundColor: tok.rgb('--ink-800'), borderWidth: 1.5, borderColor: isOpen ? tok.rgb('--brand-400', 0.5) : tok.rgb('--fg', 0.06), overflow: 'hidden' }}>
                <Pressable onPress={() => { tick(); setOpen(isOpen ? null : act) }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, paddingHorizontal: 17 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: tok.rgb('--fg') }}>{act}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {done ? <Icon name="check" size={17} stroke={3} color={tok.rgb('--brand-400')} /> : null}
                    <Text style={{ fontSize: 13, color: tok.rgb('--fg', 0.4) }}>{done ? `${d.days!.length}d · ${d.intensity}` : 'Set up'}</Text>
                  </View>
                </Pressable>
                {isOpen ? (
                  <View style={{ paddingHorizontal: 17, paddingBottom: 18 }}>
                    <Text style={{ fontSize: 13, color: tok.rgb('--fg', 0.5), marginTop: 4, marginBottom: 10 }}>When do you usually do this?</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {DAYS.map((day) => {
                        const on = (d.days || []).includes(day)
                        return <Pressable key={day} onPress={() => toggleDay(act, day)} style={{ paddingVertical: 9, paddingHorizontal: 12, borderRadius: 999, backgroundColor: on ? tok.rgb('--brand-400', 0.16) : tok.rgb('--ink-700'), borderWidth: 1.5, borderColor: on ? tok.rgb('--brand-400', 0.8) : tok.rgb('--fg', 0.06) }}><Text style={{ fontSize: 13, fontWeight: '700', color: on ? tok.rgb('--brand-300') : tok.rgb('--fg', 0.55) }}>{DAYS_SHORT[day]}</Text></Pressable>
                      })}
                    </View>
                    <Text style={{ fontSize: 13, color: tok.rgb('--fg', 0.5), marginTop: 16, marginBottom: 10 }}>How demanding is it usually?</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {INTENSITY_OPTIONS.map((o) => {
                        const on = d.intensity === o.value
                        return <Pressable key={o.value} onPress={() => { tick(); patch(act, { intensity: o.value }) }} style={{ flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center', backgroundColor: on ? tok.rgb('--brand-400', 0.16) : tok.rgb('--ink-700'), borderWidth: 1.5, borderColor: on ? tok.rgb('--brand-400', 0.8) : tok.rgb('--fg', 0.06) }}><Text style={{ fontSize: 14, fontWeight: '700', color: on ? tok.rgb('--brand-300') : tok.rgb('--fg', 0.6) }}>{o.label}</Text></Pressable>
                      })}
                    </View>
                  </View>
                ) : null}
              </View>
            </Reveal>
          )
        })}
      </View>
    </Shell>
  )
}

/* ─────────────────────── milestones / transitions ────────────────────────── */

function Interstitial({ message, header, onContinue }: { message: { title: string; sub?: string }; header: ReactNode; onContinue: () => void }) {
  const tok = useTok()
  useEffect(() => { const t = setTimeout(onContinue, 1700); return () => clearTimeout(t) }, [onContinue])
  return (
    <View style={{ flex: 1 }}>
      {header}
      <Pressable onPress={onContinue} style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 34 }}>
        <Reveal delay={80}><Checkmark size={74} /></Reveal>
        <Reveal delay={320}><Text style={{ marginTop: 24, fontSize: 29, fontWeight: '800', letterSpacing: -0.6, color: tok.rgb('--fg'), lineHeight: 33, textAlign: 'center' }}>{message.title}</Text></Reveal>
        {message.sub ? <Reveal delay={440}><Text style={{ marginTop: 14, fontSize: 15.5, lineHeight: 23, color: tok.rgb('--fg', 0.55), textAlign: 'center', maxWidth: 300 }}>{message.sub}</Text></Reveal> : null}
      </Pressable>
      <Text style={{ textAlign: 'center', paddingBottom: 24, fontSize: 13.5, color: tok.rgb('--fg', 0.4) }}>Tap to continue</Text>
    </View>
  )
}

function MidTransition({ header, onContinue }: { header: ReactNode; onContinue: () => void }) {
  const tok = useTok()
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 2100)
    const t2 = setTimeout(onContinue, 4200)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onContinue])
  return (
    <View style={{ flex: 1 }}>
      {header}
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 34 }}>
        {phase === 0 ? (
          <>
            <Spinner />
            <Reveal><Text style={{ marginTop: 26, fontSize: 24, fontWeight: '800', color: tok.rgb('--fg'), letterSpacing: -0.3, textAlign: 'center' }}>Understanding your training needs…</Text></Reveal>
            <Reveal delay={100}><Text style={{ marginTop: 10, fontSize: 15, color: tok.rgb('--fg', 0.5), textAlign: 'center' }}>Reading your goals and experience.</Text></Reveal>
          </>
        ) : (
          <>
            <Checkmark size={76} />
            <Reveal><Text style={{ marginTop: 22, fontSize: 25, fontWeight: '800', color: tok.rgb('--fg'), letterSpacing: -0.3, lineHeight: 30, textAlign: 'center' }}>We have a clearer picture of what will work for you.</Text></Reveal>
          </>
        )}
      </View>
    </View>
  )
}

function SafetyOutcome({ answers, header, onSaveExit }: { answers: Answers; header: ReactNode; onSaveExit: () => void }) {
  const tok = useTok()
  const verdict = evaluateSafety(answers)
  const cfg: Record<string, { icon: string; title: string; body: string; tone: 'warn' | 'danger' }> = {
    block: { icon: 'shield', tone: 'warn', title: 'Please speak with a qualified health professional before continuing', body: 'Based on your answers, we can’t safely generate a training program for you yet. Please speak with a GP, physiotherapist or another appropriately qualified health professional.\n\nOnce you’ve been cleared to exercise, you can return and continue setting up your StrengthHub experience.' },
    donotgenerate: { icon: 'shield', tone: 'danger', title: 'Please seek medical advice before training', body: 'You told us you’ve experienced chest pain while at rest. For your safety we can’t generate a training program. Please speak with a doctor or another qualified health professional as a priority.\n\nWe’ll keep your answers safe so you can return once you’ve been cleared.' },
  }
  const c = cfg[verdict] || cfg.block
  const accent = c.tone === 'danger' ? tok.rgb('--danger') : tok.rgb('--accent-orange')
  return (
    <View style={{ flex: 1 }}>
      {header}
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 26 }}>
        <Reveal delay={80}><View style={{ width: 70, height: 70, borderRadius: 22, backgroundColor: c.tone === 'danger' ? tok.rgb('--danger', 0.14) : tok.rgb('--accent-orange', 0.14), alignItems: 'center', justifyContent: 'center' }}><Icon name={c.icon} size={34} color={accent} /></View></Reveal>
        <Reveal delay={260}><Text style={{ marginTop: 24, fontSize: 24, fontWeight: '800', letterSpacing: -0.5, color: tok.rgb('--fg'), lineHeight: 29 }}>{c.title}</Text></Reveal>
        <Reveal delay={360}><Text style={{ marginTop: 14, fontSize: 15, lineHeight: 24, color: tok.rgb('--fg', 0.6) }}>{c.body}</Text></Reveal>
        <Reveal delay={440}><View style={{ marginTop: 18, paddingVertical: 13, paddingHorizontal: 15, borderRadius: 14, backgroundColor: tok.rgb('--fg', 0.05) }}><Text style={{ fontSize: 13, lineHeight: 19.5, color: tok.rgb('--fg', 0.5) }}>StrengthHub provides general fitness information, not a medical assessment. This isn’t a diagnosis.</Text></View></Reveal>
      </View>
      <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 26 }}>
        <Pressable onPress={() => { thud(); onSaveExit() }} style={{ height: 54, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: tok.rgb('--fg', 0.1) }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: tok.rgb('--fg') }}>I’ll come back later</Text>
        </Pressable>
      </View>
    </View>
  )
}

/* ─────────────────────── age-gate + terms + finish ───────────────────────── */

function CheckboxCard({ checked, onToggle, children }: { checked: boolean; onToggle: () => void; children: ReactNode }) {
  const tok = useTok()
  return (
    <Pressable onPress={() => { tick(); onToggle() }} style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start', padding: 18, borderRadius: 18, backgroundColor: checked ? tok.rgb('--brand-400', 0.1) : tok.rgb('--ink-800'), borderWidth: 1.5, borderColor: checked ? tok.rgb('--brand-400', 0.8) : tok.rgb('--fg', 0.08) }}>
      <View style={{ width: 26, height: 26, borderRadius: 8, marginTop: 1, borderWidth: 2, borderColor: checked ? tok.rgb('--brand-400') : tok.rgb('--fg', 0.25), backgroundColor: checked ? tok.rgb('--brand-400') : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{checked ? <Icon name="check" size={16} color="#08140a" stroke={3} /> : null}</View>
      <Text style={{ flex: 1, fontSize: 14.5, lineHeight: 22.5, color: tok.rgb('--fg', 0.85) }}>{children}</Text>
    </Pressable>
  )
}

function Under16({ onBack }: { onBack: () => void }) {
  const tok = useTok()
  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingTop: 10, paddingHorizontal: 20 }}>
        <Pressable onPress={onBack} hitSlop={8} style={{ width: 40, height: 40, marginLeft: -8, borderRadius: 999, alignItems: 'center', justifyContent: 'center' }}><Icon name="back" size={22} color={tok.rgb('--fg', 0.7)} /></Pressable>
      </View>
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 26 }}>
        <Reveal delay={80}><View style={{ width: 66, height: 66, borderRadius: 20, backgroundColor: tok.rgb('--fg', 0.06), alignItems: 'center', justifyContent: 'center' }}><Icon name="heart" size={32} color={tok.rgb('--fg', 0.8)} /></View></Reveal>
        <Reveal delay={180}><Text style={{ marginTop: 24, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, color: tok.rgb('--fg'), lineHeight: 31 }}>Thanks for your interest in StrengthHub</Text></Reveal>
        <Reveal delay={260}><Text style={{ marginTop: 14, fontSize: 15.5, lineHeight: 25, color: tok.rgb('--fg', 0.6) }}>StrengthHub creates personalised training programs for people aged 16 and over. We can’t generate a program just yet — but we’d love to have you when the time is right.</Text></Reveal>
        <Reveal delay={340}><Text style={{ marginTop: 12, fontSize: 14, lineHeight: 21.7, color: tok.rgb('--fg', 0.45) }}>In the meantime, staying active with school sports and everyday movement is a great foundation.</Text></Reveal>
      </View>
      <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 26 }}>
        <Pressable onPress={onBack} style={{ height: 54, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: tok.rgb('--fg', 0.1) }}><Text style={{ fontSize: 16, fontWeight: '700', color: tok.rgb('--fg') }}>Back</Text></Pressable>
      </View>
    </View>
  )
}

function Guardian({ answers, set, onContinue, onBack }: { answers: Answers; set: SetFn; onContinue: () => void; onBack: () => void }) {
  const tok = useTok()
  const ok = answers.guardianConsent
  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingTop: 10, paddingHorizontal: 20 }}>
        <Pressable onPress={onBack} hitSlop={8} style={{ width: 40, height: 40, marginLeft: -8, borderRadius: 999, alignItems: 'center', justifyContent: 'center' }}><Icon name="back" size={22} color={tok.rgb('--fg', 0.7)} /></Pressable>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 26, paddingTop: 10 }} keyboardShouldPersistTaps="handled">
        <Reveal delay={80}><View style={{ width: 62, height: 62, borderRadius: 18, backgroundColor: tok.rgb('--brand-400', 0.12), alignItems: 'center', justifyContent: 'center' }}><Icon name="shield" size={30} color={tok.rgb('--brand-300')} /></View></Reveal>
        <Reveal delay={180}><Text style={{ marginTop: 20, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, color: tok.rgb('--fg'), lineHeight: 31 }}>A quick step for under-18s</Text></Reveal>
        <Reveal delay={260}><Text style={{ marginTop: 12, marginBottom: 20, fontSize: 15, lineHeight: 23, color: tok.rgb('--fg', 0.6) }}>Because you’re 16 or 17, we ask that a parent or guardian is aware you’re setting up StrengthHub and consents to you training with a personalised program.</Text></Reveal>
        <Reveal delay={340}><CheckboxCard checked={ok} onToggle={() => set('guardianConsent', !ok)}>My parent or guardian is aware and consents to me setting up and using StrengthHub.</CheckboxCard></Reveal>
      </ScrollView>
      <ActionBar disabled={!ok} onPress={onContinue} />
    </View>
  )
}

function Terms({ answers, set, onContinue, onBack }: { answers: Answers; set: SetFn; onContinue: () => void; onBack: () => void }) {
  const tok = useTok()
  const checked = answers.terms
  return (
    <View style={{ flex: 1 }}>
      <TopBack onBack={onBack} label="Almost there" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18 }} keyboardShouldPersistTaps="handled">
        <QHeader title="A quick acknowledgement" sub="One last thing before we build your experience." />
        <Reveal delay={160}>
          <CheckboxCard checked={checked} onToggle={() => set('terms', !checked)}>
            <>I have read and agree to the Terms of Use and acknowledge that StrengthHub provides general fitness and wellness information, <Text style={{ fontWeight: '700', color: tok.rgb('--fg') }}>not medical advice</Text>.</>
          </CheckboxCard>
        </Reveal>
        <Reveal delay={230}>
          <View style={{ marginTop: 16 }}>
            {['Terms of Use', 'Privacy Policy', 'Health & safety information'].map((l) => (
              <Pressable key={l} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: tok.rgb('--fg', 0.05) }}>
                <Text style={{ fontSize: 14.5, fontWeight: '600', color: tok.rgb('--brand-300') }}>{l}</Text>
                <Icon name="forward" size={16} stroke={2.2} color={tok.rgb('--fg', 0.3)} />
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
  const tok = useTok()
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    if (idx >= PROCESSING_STAGES.length) { const t = setTimeout(onDone, 700); return () => clearTimeout(t) }
    const t = setTimeout(() => setIdx((i) => i + 1), idx === 0 ? 500 : 640)
    return () => clearTimeout(t)
  }, [idx, onDone])
  const pct = Math.round((Math.min(idx, PROCESSING_STAGES.length) / PROCESSING_STAGES.length) * 100)
  const bar = useRef(new Animated.Value(0)).current
  useEffect(() => { Animated.timing(bar, { toValue: pct, duration: 600, easing: EASE, useNativeDriver: false }).start() }, [bar, pct])
  return (
    <View style={{ flex: 1, paddingHorizontal: 26 }}>
      <View style={{ paddingTop: 30, alignItems: 'center' }}>
        <Wordmark size={18} />
        <Text style={{ marginTop: 22, fontSize: 24, fontWeight: '800', letterSpacing: -0.5, color: tok.rgb('--fg') }}>Building your experience</Text>
        <View style={{ marginTop: 18, width: 220, height: 6, borderRadius: 999, backgroundColor: tok.rgb('--fg', 0.1), overflow: 'hidden' }}>
          <Animated.View style={{ height: '100%', borderRadius: 999, backgroundColor: tok.rgb('--brand-400'), width: bar.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }} />
        </View>
      </View>
      <View style={{ flex: 1, justifyContent: 'center', gap: 4 }}>
        {PROCESSING_STAGES.map((s, i) => {
          if (i > idx) return null
          const done = i < idx
          return (
            <Reveal key={s}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 11, paddingHorizontal: 4 }}>
                <View style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}>
                  {done ? <Icon name="check" size={22} stroke={3} color={tok.rgb('--brand-400')} /> : <Spinner size={20} thickness={3} />}
                </View>
                <Text style={{ fontSize: 15.5, fontWeight: '600', color: done ? tok.rgb('--fg', 0.85) : tok.rgb('--fg', 0.6) }}>{s}</Text>
              </View>
            </Reveal>
          )
        })}
      </View>
      <View style={{ height: 30 }} />
    </View>
  )
}

/* ────────────────────────────── brand marks ──────────────────────────────── */

/** StrengthHub wordmark, rendered as live text (sharp) with the ONLINE tag. */
function Wordmark({ size = 26 }: { size?: number }) {
  const tok = useTok()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      <Text style={{ fontSize: size, fontWeight: '800', letterSpacing: -0.3, color: tok.rgb('--fg') }}>Strength<Text style={{ color: tok.rgb('--brand-400'), fontStyle: 'italic' }}>Hub</Text></Text>
      <Text style={{ fontSize: size * 0.3, fontWeight: '700', letterSpacing: size * 0.06, color: tok.rgb('--brand-300'), marginLeft: 2, marginTop: 1 }}>ONLINE</Text>
    </View>
  )
}

function AppIcon({ size = 34 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: '#7ED957', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontWeight: '800', fontSize: size * 0.48, color: '#0A0A0B', letterSpacing: -0.4 }}>S<Text style={{ fontStyle: 'italic' }}>H</Text></Text>
    </View>
  )
}

/* ───────────────────────────────── summary ───────────────────────────────── */

function Summary({ answers, onEdit, onContinue, onBack }: { answers: Answers; onEdit: (id: string) => void; onContinue: () => void; onBack: () => void }) {
  const tok = useTok()
  const g = GOAL_OPTIONS.find((o) => o.value === answers.goal)?.label || 'Not set'
  const exp = EXPERIENCE_OPTIONS.find((o) => o.value === answers.experience)?.label || 'Not set'
  const env = ENVIRONMENT_OPTIONS.find((o) => o.value === answers.environment)?.label || 'Not set'
  const focus = answers.focus.length ? answers.focus.join(', ') : 'Whole body'
  const days = answers.days
  const around = trainAroundAreas(answers)
  const acts = answers.activities.filter((x) => x !== 'None' && x !== 'Other')
  const equip = answers.equipment
  const love = answers.loveExercises

  const Stat = ({ label, value, edit }: { label: string; value: string; edit?: string }) => (
    <View style={{ flex: 1, backgroundColor: tok.rgb('--ink-800'), borderRadius: 16, paddingVertical: 14, paddingHorizontal: 15, borderWidth: 1, borderColor: tok.rgb('--fg', 0.05) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 11.5, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: tok.rgb('--fg', 0.4) }}>{label}</Text>
        {edit ? <Pressable onPress={() => { tick(); onEdit(edit) }} hitSlop={8}><Text style={{ fontSize: 12.5, fontWeight: '700', color: tok.rgb('--brand-300') }}>Edit</Text></Pressable> : null}
      </View>
      <Text style={{ marginTop: 6, fontSize: 15.5, fontWeight: '700', color: tok.rgb('--fg'), lineHeight: 20 }}>{value}</Text>
    </View>
  )

  return (
    <View style={{ flex: 1 }}>
      <TopBack onBack={onBack} label="Your setup" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
        <Reveal delay={60} style={{ alignItems: 'center', marginBottom: 6 }}><Checkmark size={64} /></Reveal>
        <Reveal delay={240}><Text style={{ marginTop: 6, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, color: tok.rgb('--fg'), textAlign: 'center', lineHeight: 31 }}>Your StrengthHub experience is ready</Text></Reveal>
        <Reveal delay={340}><Text style={{ marginTop: 10, marginBottom: 20, fontSize: 14.5, color: tok.rgb('--fg', 0.55), textAlign: 'center', lineHeight: 21.7 }}>Shaped around your goals, schedule and preferences, {firstName(answers)}.</Text></Reveal>

        <Reveal delay={420}>
          <LinearGradient colors={[tok.rgb('--brand-900', 0.5), tok.rgb('--ink-800')]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={{ borderRadius: 20, padding: 18, borderWidth: 1, borderColor: tok.rgb('--brand-400', 0.2), marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: tok.rgb('--brand-400', 0.18), alignItems: 'center', justifyContent: 'center' }}><Icon name="muscle" size={22} color={tok.rgb('--brand-300')} /></View>
              <View>
                <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: tok.rgb('--brand-300') }}>Your plan</Text>
                <Text style={{ fontSize: 18, fontWeight: '800', color: tok.rgb('--fg') }}>{g} · {days.length || 4} day{(days.length || 4) === 1 ? '' : 's'} / week</Text>
              </View>
            </View>
            <View style={{ marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
              {(days.length ? days : ['Monday', 'Wednesday', 'Friday', 'Saturday']).map((d) => (
                <View key={d} style={{ paddingVertical: 6, paddingHorizontal: 11, borderRadius: 999, backgroundColor: tok.rgb('--brand-400', 0.14) }}><Text style={{ fontSize: 12.5, fontWeight: '700', color: tok.rgb('--brand-300') }}>{DAYS_SHORT[d]}</Text></View>
              ))}
            </View>
            <Text style={{ marginTop: 12, fontSize: 13, color: tok.rgb('--fg', 0.5) }}>A full week-by-week program unlocks once you save your experience.</Text>
          </LinearGradient>
        </Reveal>

        <Reveal delay={500}>
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}><Stat label="Main goal" value={g} edit="c1" /><Stat label="Focus" value={focus} edit="c2" /></View>
            <View style={{ flexDirection: 'row', gap: 10 }}><Stat label="Experience" value={exp} edit="d1" /><Stat label="Session" value={`${answers.session} min`} edit="e2" /></View>
            <View style={{ flexDirection: 'row', gap: 10 }}><Stat label="Environment" value={env} edit="f1" /><Stat label="Weight" value={`${answers.weight} kg`} edit="b2" /></View>
          </View>
        </Reveal>
        <Reveal delay={560}>
          <View style={{ gap: 10, marginTop: 10 }}>
            <View style={{ flexDirection: 'row' }}><Stat label="Equipment" value={equip.length ? equip.join(', ') : (env === 'Full Gym' ? 'Full gym access' : 'Bodyweight')} edit="f1" /></View>
            <View style={{ flexDirection: 'row' }}><Stat label="Outside activity" value={acts.length ? acts.join(', ') : 'None'} edit="h1" /></View>
            {love.length ? <View style={{ flexDirection: 'row' }}><Stat label="You love" value={love.join(', ')} edit="i1" /></View> : null}
            {around.length ? <View style={{ flexDirection: 'row' }}><Stat label="Training around" value={joinAreas(around)} edit="g1" /></View> : null}
          </View>
        </Reveal>
      </ScrollView>
      <ActionBar label="Save my experience" onPress={onContinue} />
    </View>
  )
}

/* ─────────────────────────────── account ─────────────────────────────────── */
/**
 * In this repo the auth layer (AuthProvider / AuthScreen) owns real accounts and,
 * when Firebase is configured, the user has already signed in before onboarding.
 * So this saves the gathered profile — `onComplete` dispatches COMPLETE_ONBOARDING
 * — and hands off to the existing provider for a live Google sign-in when needed.
 */
function AccountCreate({ onComplete, onBack }: { onComplete: () => void; onBack: () => void }) {
  const tok = useTok()
  const { enabled, user, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const google = async () => { tick(); try { if (enabled && !user) await signInWithGoogle() } catch { /* fall through to save */ } onComplete() }
  const Social = ({ label, bg, fg, letter }: { label: string; bg: string; fg: string; letter?: string }) => (
    <Pressable onPress={() => { tick(); onComplete() }} style={{ height: 52, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: bg, borderWidth: bg === 'transparent' ? 1.5 : 0, borderColor: tok.rgb('--fg', 0.12) }}>
      {letter ? <View style={{ width: 20, height: 20, borderRadius: 5, backgroundColor: fg === '#111' ? 'rgba(0,0,0,0.08)' : tok.rgb('--fg', 0.1), alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 12, fontWeight: '900', color: fg }}>{letter}</Text></View> : null}
      <Text style={{ fontSize: 15.5, fontWeight: '700', color: fg }}>{label}</Text>
    </Pressable>
  )
  return (
    <View style={{ flex: 1 }}>
      <TopBack onBack={onBack} label="Almost there" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 18 }} keyboardShouldPersistTaps="handled">
        <Reveal delay={60}><View style={{ width: 60, height: 60, borderRadius: 18, backgroundColor: tok.rgb('--brand-400', 0.14), alignItems: 'center', justifyContent: 'center' }}><Icon name="lock" size={28} color={tok.rgb('--brand-300')} /></View></Reveal>
        <Reveal delay={140}><Text style={{ marginTop: 20, fontSize: 27, fontWeight: '800', letterSpacing: -0.5, color: tok.rgb('--fg'), lineHeight: 32 }}>Save your personalised experience</Text></Reveal>
        <Reveal delay={220}><Text style={{ marginTop: 12, marginBottom: 22, fontSize: 15, lineHeight: 22.5, color: tok.rgb('--fg', 0.55) }}>Create your account to save your answers, access your personalised training and track your progress.</Text></Reveal>
        <Reveal delay={300}>
          <Text style={{ fontSize: 12.5, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', color: tok.rgb('--fg', 0.4), marginBottom: 8 }}>Email</Text>
          <View style={{ marginBottom: 12 }}><FocusInput value={email} onChangeText={setEmail} placeholder="you@university.ac.uk" keyboardType="email-address" autoCapitalize="none" /></View>
          <Pressable onPress={() => { thud(); onComplete() }} style={{ height: 54, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: tok.rgb('--brand-400') }}><Text style={{ fontSize: 16, fontWeight: '700', color: '#08140a' }}>Create Account</Text></Pressable>
        </Reveal>
        <Reveal delay={380}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 18 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: tok.rgb('--fg', 0.08) }} /><Text style={{ fontSize: 12.5, color: tok.rgb('--fg', 0.4) }}>or</Text><View style={{ flex: 1, height: 1, backgroundColor: tok.rgb('--fg', 0.08) }} />
          </View>
          <View style={{ gap: 10 }}>
            <Pressable onPress={google} style={{ height: 52, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#fff' }}>
              <View style={{ width: 20, height: 20, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.08)', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 12, fontWeight: '900', color: '#111' }}>G</Text></View>
              <Text style={{ fontSize: 15.5, fontWeight: '700', color: '#111' }}>Continue with Google</Text>
            </Pressable>
            <Social label="Continue with Apple" bg={tok.rgb('--ink-700')} fg={tok.rgb('--fg')} />
          </View>
        </Reveal>
      </ScrollView>
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 26 }}>
        <Text style={{ fontSize: 14.5, color: tok.rgb('--fg', 0.5) }}>Already have an account? </Text>
        <Pressable onPress={() => { tick(); onComplete() }} hitSlop={8}><Text style={{ fontSize: 14.5, fontWeight: '700', color: tok.rgb('--brand-300') }}>Log In</Text></Pressable>
      </View>
    </View>
  )
}

/* ───────────────────── welcome (animated showcase) ───────────────────────── */

function CoachSparkle({ size = 28 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: 999, backgroundColor: '#7ED957', alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24">
        <Path d="M12 2c.4 3.4 2.2 5.2 5.6 5.6-3.4.4-5.2 2.2-5.6 5.6-.4-3.4-2.2-5.2-5.6-5.6C9.8 7.2 11.6 5.4 12 2Z" fill="#08140a" />
        <Path d="M18.5 13c.2 1.6 1 2.4 2.5 2.6-1.5.2-2.3 1-2.5 2.6-.2-1.6-1-2.4-2.5-2.6 1.5-.2 2.3-1 2.5-2.6Z" fill="#08140a" />
      </Svg>
    </View>
  )
}

/** Ring with the % label in the centre; fill sweeps smoothly (900ms). */
function MiniRing({ pct }: { pct: number }) {
  const tok = useTok()
  const r = 16, c = 2 * Math.PI * r
  const anim = useRef(new Animated.Value(pct)).current
  useEffect(() => { Animated.timing(anim, { toValue: pct, duration: 900, easing: EASE, useNativeDriver: false }).start() }, [anim, pct])
  return (
    <Svg width={42} height={42} viewBox="0 0 42 42">
      <Circle cx="21" cy="21" r={r} fill="none" stroke={tok.rgb('--fg', 0.12)} strokeWidth={4} />
      <AnimatedCircle cx="21" cy="21" r={r} fill="none" stroke={tok.rgb('--brand-400')} strokeWidth={4} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={anim.interpolate({ inputRange: [0, 100], outputRange: [c, 0] })} transform="rotate(-90 21 21)" />
      <SvgText x="21" y="25" textAnchor="middle" fontSize="11" fontWeight="800" fill={tok.rgb('--fg')}>{`${pct}%`}</SvgText>
    </Svg>
  )
}

/** sho-tick: the check pops in — scale 0.2 → 1.15 (60%) → 1 over 520ms. */
function TickPop({ children }: { children: ReactNode }) {
  const a = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 520, easing: Easing.bezier(0.34, 1.56, 0.64, 1), useNativeDriver: NATIVE }).start()
  }, [a])
  return (
    <Animated.View style={{ opacity: a.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }), transform: [{ scale: a.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.2, 1.15, 1] }) }] }}>
      {children}
    </Animated.View>
  )
}

function PushRow({ name, done, justClicked }: { name: string; done: boolean; justClicked: boolean }) {
  const tok = useTok()
  // The just-ticked row swells to 1.015 and settles back (320ms bounce).
  const s = useRef(new Animated.Value(1)).current
  useEffect(() => {
    Animated.timing(s, { toValue: justClicked ? 1.015 : 1, duration: 320, easing: Easing.bezier(0.34, 1.56, 0.64, 1), useNativeDriver: NATIVE }).start()
  }, [s, justClicked])
  return (
    <Animated.View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 15, borderRadius: 13, backgroundColor: tok.rgb('--ink-800'), transform: [{ scale: s }] }}>
      <View style={{ width: 22, height: 22, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? tok.rgb('--brand-400') : 'transparent', borderWidth: done ? 0 : 2, borderColor: tok.rgb('--fg', 0.2) }}>
        {done ? <TickPop><Icon name="check" size={13} stroke={3.4} color="#08140a" /></TickPop> : null}
      </View>
      <Text style={{ fontSize: 15.5, fontWeight: '600', color: tok.rgb('--fg', done ? 0.85 : 0.6) }}>{name}</Text>
    </Animated.View>
  )
}

/** Card 1 — Push Day checklist ticking through exercises. */
function PushDayCard() {
  const tok = useTok()
  const [n, setN] = useState(1)
  useEffect(() => {
    const t = [setTimeout(() => { tick(); setN(2) }, 550), setTimeout(() => { tick(); setN(3) }, 1000), setTimeout(() => { thud(); setN(4) }, 1450)]
    return () => t.forEach(clearTimeout)
  }, [])
  const names = ['Bench Press', 'Shoulder Press', 'Incline Fly', 'Tricep Pushdown']
  const pct = Math.round((n / 4) * 100)
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.3, textTransform: 'uppercase', color: tok.rgb('--brand-300') }}>Today</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: tok.rgb('--fg') }}>Push Day</Text>
        <MiniRing pct={pct} />
      </View>
      <View style={{ flex: 1, marginTop: 16, justifyContent: 'center', gap: 9 }}>
        {names.map((name, k) => <PushRow key={name} name={name} done={k < n} justClicked={k === n - 1 && k < n} />)}
      </View>
    </View>
  )
}

/** Card 2 — bench-press progress bars. */
function ProgressCard() {
  const tok = useTok()
  const heights = [40, 55, 50, 68, 82]
  const anims = useRef(heights.map(() => new Animated.Value(0))).current
  useEffect(() => {
    Animated.stagger(70, anims.map((a) => Animated.timing(a, { toValue: 1, duration: 700, easing: EASE, useNativeDriver: false }))).start()
  }, [anims])
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.3, textTransform: 'uppercase', color: tok.rgb('--brand-300') }}>Progress</Text>
      <Text style={{ fontSize: 24, fontWeight: '800', color: tok.rgb('--fg'), marginTop: 10 }}>Bench press</Text>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 18 }}>
        {heights.map((h, k) => (
          <Animated.View key={k} style={{ flex: 1, height: anims[k].interpolate({ inputRange: [0, 1], outputRange: ['0%', `${h}%`] }), borderRadius: 8, backgroundColor: k === 4 ? tok.rgb('--brand-400') : tok.rgb('--brand-400', 0.28) }} />
        ))}
      </View>
      <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: tok.rgb('--brand-300') }}>+12%</Text>
        <Text style={{ fontSize: 14, color: tok.rgb('--fg', 0.85) }}>this month</Text>
      </View>
    </View>
  )
}

/** Card 3 — coach chat with a typing → send → reply sequence. */
function CoachChat() {
  const tok = useTok()
  const full = 'yes, is eggs, avocado and toast a healthy breakfast?'
  const [typed, setTyped] = useState('')
  const [sent, setSent] = useState(false)
  const [reply, setReply] = useState(false)
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    let iv: ReturnType<typeof setInterval>
    timers.push(setTimeout(() => {
      let idx = 0
      iv = setInterval(() => {
        idx += 1; setTyped(full.slice(0, idx))
        if (idx >= full.length) { clearInterval(iv); timers.push(setTimeout(() => { setSent(true); setTyped('') }, 480)); timers.push(setTimeout(() => setReply(true), 1000)) }
      }, 44)
    }, 360))
    return () => { timers.forEach(clearTimeout); clearInterval(iv) }
  }, [])
  return (
    <View style={{ flex: 1, marginHorizontal: -20, marginVertical: -20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 13, borderBottomWidth: 1, borderBottomColor: tok.rgb('--fg', 0.07) }}>
        <CoachSparkle size={30} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: tok.rgb('--fg') }}>Coach</Text>
          <Text style={{ fontSize: 11.5, fontWeight: '600', color: tok.rgb('--brand-300'), marginTop: 2 }}>Active now</Text>
        </View>
      </View>
      <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginRight: 26 }}>
          <CoachSparkle size={22} />
          <View style={{ maxWidth: '88%', paddingVertical: 11, paddingHorizontal: 14, borderRadius: 16, borderTopLeftRadius: 4, backgroundColor: tok.rgb('--ink-800') }}>
            <Text style={{ fontSize: 14, lineHeight: 19.6, color: tok.rgb('--fg', 0.9), fontWeight: '500' }}>Hey Alex, I just want to check in with how your eating is going. Do you have any questions for me?</Text>
          </View>
        </View>
        {sent ? (
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginLeft: 26 }}>
            <View style={{ maxWidth: '84%', paddingVertical: 11, paddingHorizontal: 14, borderRadius: 16, borderBottomRightRadius: 4, backgroundColor: tok.rgb('--brand-400') }}>
              <Text style={{ fontSize: 14, lineHeight: 19.6, color: '#08140a', fontWeight: '600' }}>{full}</Text>
            </View>
          </View>
        ) : null}
        {reply ? (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <CoachSparkle size={22} />
            <View style={{ paddingVertical: 13, paddingHorizontal: 15, borderRadius: 16, borderTopLeftRadius: 4, backgroundColor: tok.rgb('--ink-800'), flexDirection: 'row', gap: 5 }}>
              {[0, 1, 2].map((d) => <TypingDot key={d} delay={d * 160} />)}
            </View>
          </View>
        ) : null}
      </View>
      <View style={{ paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: tok.rgb('--fg', 0.07), flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, minHeight: 40, borderRadius: 999, backgroundColor: tok.rgb('--ink-800'), borderWidth: 1, borderColor: tok.rgb('--fg', 0.08), paddingVertical: 10, paddingHorizontal: 16, justifyContent: 'center' }}>
          <Text style={{ fontSize: 14, color: typed ? tok.rgb('--fg', 0.92) : tok.rgb('--fg', 0.35), fontWeight: '500' }}>{typed || 'Message'}</Text>
        </View>
        <View style={{ width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: typed ? tok.rgb('--brand-400') : tok.rgb('--ink-800'), borderWidth: 1, borderColor: tok.rgb('--fg', 0.08) }}>
          <Svg width={17} height={17} viewBox="0 0 24 24"><Path d="m22 2-7 20-4-9-9-4Z" fill="none" stroke={typed ? '#08140a' : tok.rgb('--fg', 0.4)} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /><Path d="M22 2 11 13" fill="none" stroke={typed ? '#08140a' : tok.rgb('--fg', 0.4)} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
        </View>
      </View>
    </View>
  )
}

function TypingDot({ delay }: { delay: number }) {
  const tok = useTok()
  const a = useRef(new Animated.Value(0.3)).current
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.delay(delay), Animated.timing(a, { toValue: 1, duration: 400, useNativeDriver: NATIVE }), Animated.timing(a, { toValue: 0.3, duration: 400, useNativeDriver: NATIVE })]))
    loop.start()
    return () => loop.stop()
  }, [a, delay])
  return <Animated.View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: tok.rgb('--brand-300'), opacity: a }} />
}

function AppShowcase({ scale = 1 }: { scale?: number }) {
  const tok = useTok()
  const [i, setI] = useState(0)
  const fade = useRef(new Animated.Value(0)).current
  // sho-hero-in: the card floats up and settles once on mount.
  const hero = useRef(new Animated.Value(0)).current
  useEffect(() => { Animated.timing(hero, { toValue: 1, duration: 1000, easing: EASE, useNativeDriver: NATIVE }).start() }, [hero])
  useEffect(() => { const t = setInterval(() => setI((v) => (v + 1) % 3), 3800); return () => clearInterval(t) }, [])
  useEffect(() => { fade.setValue(0); Animated.timing(fade, { toValue: 1, duration: 620, easing: EASE, useNativeDriver: NATIVE }).start() }, [i, fade])
  // Design canvas is 316x396; scale down (never up) to fit shorter screens.
  return (
    <View style={{ width: 316 * scale, height: 396 * scale }}>
      <Animated.View style={{ width: 316, height: 396, transformOrigin: 'top left' as any, opacity: hero, transform: [{ scale }, { translateY: hero.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }}>
        <View style={{ position: 'absolute', top: 40, left: 40, right: 40, bottom: 40, borderRadius: 200, backgroundColor: tok.rgb('--brand-400', 0.08) }} />
        <View style={{ flex: 1, borderRadius: 28, overflow: 'hidden', backgroundColor: tok.rgb('--ink-700'), borderWidth: 1, borderColor: tok.rgb('--fg', 0.09) }}>
          <Animated.View key={i} style={{ flex: 1, padding: 20, opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
            {i === 0 ? <PushDayCard /> : i === 1 ? <ProgressCard /> : <CoachChat />}
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  )
}

/* country flags (ported from the prototype Flag component) */
function Flag({ code, w = 22 }: { code: string; w?: number }) {
  const tok = useTok()
  const h = w * 0.7
  const box = { width: w, height: h, borderRadius: 3, borderWidth: 1, borderColor: tok.rgb('--fg', 0.12), overflow: 'hidden' as const }
  const svg = (children: ReactNode) => <View style={box}><Svg width={w} height={h} viewBox="0 0 60 42" preserveAspectRatio="xMidYMid slice">{children}</Svg></View>
  const star = (cx: number, cy: number, R: number, fill: string) => {
    const pts: string[] = []
    for (let k = 0; k < 10; k++) { const rad = k % 2 ? R * 0.382 : R; const ang = (-90 + k * 36) * Math.PI / 180; pts.push(`${(cx + rad * Math.cos(ang)).toFixed(1)},${(cy + rad * Math.sin(ang)).toFixed(1)}`) }
    return <Polygon points={pts.join(' ')} fill={fill} />
  }
  switch (code) {
    case 'GB': return svg(<G><Rect width={60} height={42} fill="#012169" /><Path d="M0 0 60 42 M60 0 0 42" stroke="#fff" strokeWidth={8} /><Path d="M0 0 60 42 M60 0 0 42" stroke="#C8102E" strokeWidth={4} /><Path d="M30 0 V42 M0 21 H60" stroke="#fff" strokeWidth={12} /><Path d="M30 0 V42 M0 21 H60" stroke="#C8102E" strokeWidth={7} /></G>)
    case 'CN': return svg(<G><Rect width={60} height={42} fill="#DE2910" />{star(13, 13, 6, '#FFDE00')}{star(25, 6, 2.4, '#FFDE00')}{star(30, 12, 2.4, '#FFDE00')}{star(30, 20, 2.4, '#FFDE00')}{star(25, 26, 2.4, '#FFDE00')}</G>)
    case 'IN': return svg(<G><Rect width={60} height={14} fill="#FF9933" /><Rect y={14} width={60} height={14} fill="#fff" /><Rect y={28} width={60} height={14} fill="#138808" /><Circle cx={30} cy={21} r={4.6} fill="none" stroke="#000080" strokeWidth={1} /></G>)
    case 'SA': return svg(<G><Rect width={60} height={42} fill="#006C35" /><Rect x={12} y={27} width={36} height={2.6} rx={1.3} fill="#fff" /><Rect x={16} y={15} width={28} height={4} rx={2} fill="#fff" /></G>)
    case 'VN': return svg(<G><Rect width={60} height={42} fill="#DA251D" />{star(30, 21, 12, '#FFFF00')}</G>)
    default: return <View style={box} />
  }
}

const LANG_CODE: Record<Language, string> = { en: 'GB', zh: 'CN', hi: 'IN', ar: 'SA', vi: 'VN' }

function LanguageSelect() {
  const tok = useTok()
  const dispatch = useDispatch()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState<Language>('en')
  const cur = LANGUAGES.find((l) => l.code === code) || LANGUAGES[0]
  return (
    <View style={{ position: 'relative', zIndex: open ? 100 : 1 }}>
      <Pressable onPress={() => { tick(); setOpen((o) => !o) }} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, backgroundColor: tok.rgb('--ink-800'), borderWidth: 1, borderColor: tok.rgb('--fg', 0.08) }}>
        <Flag code={LANG_CODE[cur.code]} w={20} />
        <Text style={{ fontSize: 11.5, fontWeight: '700', color: tok.rgb('--fg', 0.85) }}>{LANG_CODE[cur.code]}</Text>
      </Pressable>
      {open ? (
        <View style={{ position: 'absolute', top: 40, right: 0, minWidth: 158, padding: 6, borderRadius: 14, backgroundColor: tok.rgb('--ink-700'), borderWidth: 1, borderColor: tok.rgb('--fg', 0.1) }}>
          {LANGUAGES.map((l) => (
            <Pressable key={l.code} onPress={() => { tick(); setCode(l.code); setOpen(false); dispatch({ type: 'SET_SETTINGS', patch: { language: l.code } }) }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 9, backgroundColor: l.code === code ? tok.rgb('--brand-400', 0.14) : 'transparent' }}>
              <Flag code={LANG_CODE[l.code]} w={24} />
              <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '600', color: l.code === code ? tok.rgb('--brand-300') : tok.rgb('--fg', 0.85) }}>{l.native}</Text>
              {l.code === code ? <Icon name="check" size={15} stroke={3} color={tok.rgb('--brand-300')} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  )
}

function Welcome({ onStart, onLogin }: { onStart: () => void; onLogin: () => void }) {
  const tok = useTok()
  const { height: winH } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  // The prototype laid this out on a fixed 874px canvas. Real screens (and the
  // web phone frame, whose content area sits below a separate 44px status bar
  // inside a 12px bezel) can be shorter, so derive the available height and
  // scale the showcase card to fit instead of letting it overflow the buttons.
  const contentH = NATIVE ? winH - insets.top - insets.bottom : Math.min(874, winH - 48) - 68
  const midAvail = contentH - 252 // header block + button block + paddings
  const HEADLINE_RESERVE = 150 // headline (2 × 36px lines) + 30 top margin + breathing room
  const scale = Math.max(0.55, Math.min(1, (midAvail - HEADLINE_RESERVE) / 396))
  return (
    <View style={{ flex: 1, paddingHorizontal: 24 }}>
      <View style={{ paddingTop: 30, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 50 }}>
        <Reveal delay={80}><AppIcon size={34} /></Reveal>
        <Reveal delay={120}><LanguageSelect /></Reveal>
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 16, paddingBottom: 16 }}>
        <AppShowcase scale={scale} />
        <Reveal delay={360}><Text style={{ marginTop: 30 * scale, fontSize: 33, lineHeight: 36, fontWeight: '800', letterSpacing: -1, color: tok.rgb('--fg'), textAlign: 'center' }}>Training built{'\n'}around you.</Text></Reveal>
      </View>
      <View style={{ paddingHorizontal: 8, paddingBottom: 32 }}>
        <Reveal delay={920}>
          <Pressable onPress={() => { thud(); onStart() }} style={{ height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: tok.rgb('--brand-400') }}><Text style={{ fontSize: 16.5, fontWeight: '700', color: '#08140a' }}>Get Started</Text></Pressable>
        </Reveal>
        <Reveal delay={1080}>
          <Pressable onPress={() => { tick(); onLogin() }} style={{ height: 50, marginTop: 18, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 15.5, fontWeight: '600', color: tok.rgb('--fg', 0.6) }}>Already have an account? <Text style={{ color: tok.rgb('--brand-300') }}>Log In</Text></Text>
          </Pressable>
        </Reveal>
      </View>
    </View>
  )
}

function Login({ onBack }: { onBack: () => void }) {
  const tok = useTok()
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => { setBusy(true); try { await signIn(email, pw) } catch { /* auth listener handles success; errors surface in the real AuthScreen */ } finally { setBusy(false) } }
  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingTop: 10, paddingHorizontal: 20 }}>
        <Pressable onPress={onBack} hitSlop={8} style={{ width: 40, height: 40, marginLeft: -8, borderRadius: 999, alignItems: 'center', justifyContent: 'center' }}><Icon name="back" size={22} color={tok.rgb('--fg', 0.7)} /></Pressable>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 10 }} keyboardShouldPersistTaps="handled">
        <Reveal delay={60}><Text style={{ fontSize: 28, fontWeight: '800', letterSpacing: -0.5, color: tok.rgb('--fg') }}>Welcome back</Text></Reveal>
        <Reveal delay={120}><Text style={{ marginTop: 8, marginBottom: 22, fontSize: 15, color: tok.rgb('--fg', 0.55) }}>Log in to pick up where you left off.</Text></Reveal>
        <Reveal delay={160}>
          <Pressable style={{ height: 52, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 11, backgroundColor: '#fff' }}>
            <View style={{ width: 20, height: 20, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.08)', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 12, fontWeight: '900', color: '#111' }}>G</Text></View>
            <Text style={{ fontSize: 15.5, fontWeight: '600', color: '#1f1f1f' }}>Continue with Google</Text>
          </Pressable>
        </Reveal>
        <Reveal delay={210}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: tok.rgb('--fg', 0.1) }} /><Text style={{ fontSize: 12.5, fontWeight: '600', color: tok.rgb('--fg', 0.4) }}>or</Text><View style={{ flex: 1, height: 1, backgroundColor: tok.rgb('--fg', 0.1) }} />
          </View>
        </Reveal>
        <Reveal delay={260}>
          <Text style={{ fontSize: 12.5, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', color: tok.rgb('--fg', 0.4), marginBottom: 8 }}>Email</Text>
          <View style={{ marginBottom: 14 }}><FocusInput value={email} onChangeText={setEmail} placeholder="you@university.ac.uk" keyboardType="email-address" autoCapitalize="none" /></View>
        </Reveal>
        <Reveal delay={300}>
          <Text style={{ fontSize: 12.5, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', color: tok.rgb('--fg', 0.4), marginBottom: 8 }}>Password</Text>
          <PasswordInput value={pw} onChangeText={setPw} />
        </Reveal>
        <Reveal delay={340}><Pressable style={{ marginTop: 12 }}><Text style={{ color: tok.rgb('--brand-300'), fontSize: 14, fontWeight: '600' }}>Forgot password?</Text></Pressable></Reveal>
      </ScrollView>
      <ActionBar label={busy ? 'Logging in…' : 'Log In'} disabled={!(email && pw) || busy} onPress={submit} />
    </View>
  )
}

function PasswordInput({ value, onChangeText }: { value: string; onChangeText: (t: string) => void }) {
  const tok = useTok()
  const [focused, setFocused] = useState(false)
  return (
    <TextInput value={value} onChangeText={onChangeText} secureTextEntry autoCapitalize="none" placeholder="••••••••" placeholderTextColor={tok.rgb('--fg', 0.32)} selectionColor={tok.rgb('--brand-400')} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{ width: '100%', backgroundColor: tok.rgb('--ink-800'), color: tok.rgb('--fg'), borderRadius: 14, borderWidth: 1.5, borderColor: focused ? tok.rgb('--brand-400', 0.8) : tok.rgb('--fg', 0.08), paddingHorizontal: 15, paddingVertical: 15, fontSize: 16 }} />
  )
}

/* ─────────────────────────────── splash ──────────────────────────────────── */
/** Dark splash: the wordmark fades in still (sho-splash-fade), ~1.75s. */
function Splash({ onDone }: { onDone: () => void }) {
  const tok = useTok()
  const fade = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 500, easing: Easing.out(Easing.ease), useNativeDriver: NATIVE }).start()
    const t = setTimeout(onDone, 1750)
    return () => clearTimeout(t)
  }, [fade, onDone])
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ opacity: fade }}>
        <View style={{ flexDirection: 'row' }}>
          <Text style={{ fontSize: 38, fontWeight: '800', letterSpacing: -0.8, lineHeight: 40, color: tok.rgb('--fg') }}>Strength</Text>
          <Text style={{ fontSize: 38, fontWeight: '800', fontStyle: 'italic', letterSpacing: -0.8, lineHeight: 40, color: tok.rgb('--brand-400') }}>Hub</Text>
          <Text style={{ position: 'absolute', top: -11, right: 2, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: tok.rgb('--brand-400') }}>ONLINE</Text>
        </View>
      </Animated.View>
    </View>
  )
}
