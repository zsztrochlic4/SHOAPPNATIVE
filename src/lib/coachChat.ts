import type { AppState } from '../store/types'
import { streakStats, weightStats } from '../store/selectors'
import { examState } from '../store/training'
import { answerQuestion } from './nutritionCoach'

/* ------------------------------------------------------------------ */
/*  1:1 coach messenger: on-device, rules-based replies.              */
/*  Warm, concise and personalised. No external API.                  */
/*                                                                     */
/*  PARITY (final plan Phase 4): this partial-context fallback shares  */
/*  the live path's VOICE contract and its POLICY floor. It never      */
/*  gives a supplement dose, never programs through an injury, and     */
/*  never prescribes a fixed training frequency — those refer out,     */
/*  exactly like the fixed safety responses. It acknowledges the       */
/*  details the user actually gave (exercise, time, goal, action)      */
/*  instead of answering generically. It is only reached in the dev    */
/*  design preview and never bypasses the server-authoritative safety  */
/*  precheck in production.                                            */
/* ------------------------------------------------------------------ */

const GOAL_LABEL: Record<string, string> = {
  'build-muscle': 'building muscle',
  'lose-fat': 'losing fat',
  'gain-strength': 'getting stronger',
  'stay-healthy': 'staying healthy',
}

/** A few common lifts we can name back to the user when they mention one (detail acknowledgement). */
const EXERCISE_TERMS = ['squat', 'bench', 'deadlift', 'press', 'overhead press', 'row', 'pull up', 'pull-up',
  'chin up', 'curl', 'lunge', 'leg press', 'lat pulldown', 'pulldown', 'push up', 'push-up', 'plank', 'run']

/** Extract the details the user actually gave, so a reply can acknowledge them instead of being generic. */
export interface FallbackDetails {
  exercise: string | null
  minutes: number | null
}
export function extractDetails(text: string): FallbackDetails {
  const clean = ` ${text.toLowerCase()} `
  const exercise = EXERCISE_TERMS.find((e) => clean.includes(e)) ?? null
  const mins = clean.match(/\b(\d{1,3})\s?(?:min|mins|minute|minutes)\b/)
  const halfHour = /\bhalf an hour\b/.test(clean) ? 30 : null
  return { exercise, minutes: mins ? parseInt(mins[1], 10) : halfHour }
}

type Rule = { keywords: string[]; reply: (s: AppState, d: FallbackDetails) => string }

const RULES: Rule[] = [
  {
    keywords: ['change', 'swap', 'replace', 'different exercise', 'substitute', 'alternative', "don't like", 'dont like', 'hate'],
    reply: (s, d) => `Totally fine to swap ${d.exercise ? `the ${d.exercise}` : 'something'} out, ${name(s)} — the best exercise is one you'll actually do. Tell me what's bugging you (boredom, a niggle, no kit) and I'll suggest a swap that hits the same muscles, or pick any alternative from the Exercises tab.`,
  },
  {
    keywords: ['sore', 'soreness', 'ache', 'aching', 'doms', 'stiff'],
    reply: () => `A day or two of dull muscle soreness after training is normal, especially on something new. Keep moving gently, get your protein and sleep in, and it settles. If it's sharp pain in a joint rather than muscle ache, that's one to get looked at rather than push through.`,
  },
  {
    // Pain / injury: policy-safe referral. Never the injury-override "keep loading it" advice.
    keywords: ['injur', 'pain', 'hurt', 'tweak', 'strain'],
    reply: () => `Sorry to hear that. Pain's a signal worth respecting, so I won't program you through it. If it's sharp, lingering, or from a knock or fall, please get it checked by a physio or GP — they can clear you and tell me what to avoid. Once you're cleared I'll adjust the plan around it.`,
  },
  {
    keywords: ['tired', 'exhausted', 'no energy', 'fatigued', 'burnt out', 'burnout', 'unmotivated', 'motivation', 'cant be bothered', "can't be bothered", 'lazy'],
    reply: (s, d) => `We all get those days, ${name(s)}. Shrink the task: just the first two exercises, or a ${d.minutes ?? 15}-minute quick session. Starting is the hard part and momentum does the rest — and if you're genuinely run down, a rest day is training too. ${streakLine(s)}`,
  },
  {
    keywords: ['plateau', 'stuck', 'not progressing', 'no progress', 'stalled', 'not improving'],
    reply: (_s, d) => `Plateaus hit everyone. The usual fixes: make sure you're truly adding weight or reps each week, eat and sleep enough to recover, and push the last set close to failure. If ${d.exercise ? `the ${d.exercise}` : 'a lift'} has been stuck for weeks we can deload — drop about 10% and build back. Which lift is stalling?`,
  },
  {
    // Frequency: reference the days THEY set, don't prescribe a fixed 5–6 range.
    keywords: ['how often', 'how many days', 'days a week', 'frequency', 'rest day', 'overtraining'],
    reply: (s) => `Your plan's already built around the ${s.profile.daysPerWeek || 3} days a week you set, with rest days baked in — and consistency across weeks beats cramming. Recovery is when you actually adapt, so those rest days are part of the plan, not a break from it. Want to change how many days you train?`,
  },
  {
    keywords: ['weight', 'scale', 'heavier', 'not losing', 'gaining weight', 'lighter'],
    reply: (s) => `Bodyweight bounces day to day with water, food and sleep, so don't read one reading too hard — the weekly trend is the real signal. ${weightLine(s)} Pair the scale with how your clothes fit, your photos and your lifts for the full picture.`,
  },
  {
    keywords: ['form', 'technique', 'how do i do', 'how to do', 'right way'],
    reply: (_s, d) => `Good instinct — form is what keeps you progressing and injury-free. Open ${d.exercise ? `the ${d.exercise}` : 'any exercise'} and tap "Not sure how? Show me" mid-workout for step-by-step cues and a form clip. Tell me the lift and I'll give you the two or three things that matter most.`,
  },
  {
    keywords: ['sleep', 'sleeping', 'rest', 'recovery', 'recover'],
    reply: () => `Sleep is the most underrated part of training — it's when you build muscle and recharge focus. Aim for a consistent 7–9 hours. If sessions feel flat, sleep is usually the first thing to fix, before any supplement or program tweak. How's yours been lately?`,
  },
  {
    keywords: ['exam', 'study', 'busy', 'no time', 'stressed', 'stress'],
    reply: (s, d) => examState(s).active
      ? `Exam mode's already on, so your sessions are shorter and your targets eased. Three key lifts and good sleep is a full win right now — protect your study and don't feel guilty about a lighter week.`
      : `When life's busy, short and consistent beats long and perfect. Try a ${d.minutes ?? 15}-minute quick session, and if exams are coming up, turn on Exam mode in settings and I'll lighten your plan automatically. Want me to walk you through that?`,
  },
  {
    // Supplements: food-first, NO personal dose (that refers to a pharmacist/label, like the live path).
    keywords: ['supplement', 'creatine', 'protein powder', 'pre workout', 'pre-workout'],
    reply: () => `Supplements are the cherry, not the cake — food, sleep and consistent training do about 95% of the work. Two with solid evidence are a protein powder for convenience and creatine monohydrate. For how much to take, go by the label and a pharmacist rather than me. Everything else is optional.`,
  },
  {
    keywords: ['thank', 'thanks', 'cheers', 'appreciate', 'awesome', 'great', 'love'],
    reply: (s) => `Anytime, ${name(s)}. Keep showing up and the results follow. What's next on your mind?`,
  },
  {
    keywords: ['hello', 'hi ', 'hey', 'yo ', 'morning', 'sup'],
    reply: (s) => `Hey ${name(s)}, good to hear from you. How's training been feeling this week — anything you want to tweak or talk through?`,
  },
]

export function coachReply(s: AppState, text: string): string {
  const clean = ` ${text.trim().toLowerCase()} `
  const details = extractDetails(text)

  // Food questions → reuse the nutrition knowledge base.
  if (/\b(eat|food|protein|carb|carbs|diet|meal|snack|calorie|sugar|breakfast|lunch|dinner|hydrat|water|alcohol)\b/.test(clean)) {
    const qa = answerQuestion(text)
    if (qa.matched) return qa.answer
  }

  for (const rule of RULES) {
    if (rule.keywords.some((k) => clean.includes(k))) return rule.reply(s, details)
  }

  // Fallback: name what I can help with and ask for one detail — no empty filler.
  return `Happy to help with that, ${name(s)}. I'm best on changing exercises, soreness and niggles, motivation, plateaus, form, sleep and nutrition for ${GOAL_LABEL[s.profile.goal] ?? 'your goal'}. Tell me a bit more and I'll give you a clear next step.`
}

/** Coach's opening message for a fresh thread. */
export function coachWelcome(s: AppState): string {
  return `Hi ${name(s)}, I'm your coach 👋 Message me anytime about how a session felt, an exercise you'd like to change, a niggle, or staying on track with ${GOAL_LABEL[s.profile.goal] ?? 'your goal'}. What's on your mind?`
}

export const CHAT_SUGGESTIONS = [
  'Why did I train chest today?',
  'Why do I feel so sore?',
  'Am I on track for my goal?',
  'What should I eat tonight?',
]

function name(s: AppState) {
  return s.profile.name?.split(' ')[0] || 'there'
}
function streakLine(s: AppState) {
  const st = streakStats(s)
  return st.current > 0 ? `You're on a ${st.current}-day streak, well worth protecting.` : `Let's get a fresh streak going.`
}
function weightLine(s: AppState) {
  const w = weightStats(s)
  const dir = w.delta < 0 ? 'down' : w.delta > 0 ? 'up' : 'steady'
  return `Your 4-week trend is ${dir}${w.delta !== 0 ? ` by ${Math.abs(w.delta).toFixed(1)} kg` : ''}.`
}
