import type { AppState } from '../store/types'
import { streakStats, weightStats } from '../store/selectors'
import { examState } from '../store/training'
import { answerQuestion } from './nutritionCoach'

/* ------------------------------------------------------------------ */
/*  1:1 coach messenger — on-device, rules-based replies.              */
/*  Warm, concise and personalised. No external API.                  */
/* ------------------------------------------------------------------ */

const GOAL_LABEL: Record<string, string> = {
  'build-muscle': 'building muscle',
  'lose-fat': 'losing fat',
  'gain-strength': 'getting stronger',
  'stay-healthy': 'staying healthy',
}

type Rule = { keywords: string[]; reply: (s: AppState) => string }

const RULES: Rule[] = [
  {
    keywords: ['change', 'swap', 'replace', 'different exercise', 'substitute', 'alternative', "don't like", 'dont like', 'hate'],
    reply: (s) => `Totally fine to swap things out — the best exercise is one you'll actually do, ${name(s)}. Tell me which movement you want to change and what's bugging you (boredom, a niggle, no equipment) and I'll suggest a swap that hits the same muscles. You can also pick any alternative from the Exercises tab.`,
  },
  {
    keywords: ['sore', 'soreness', 'ache', 'aching', 'doms', 'stiff'],
    reply: () => `Some soreness a day or two after training is normal, especially on something new. Keep moving gently, stay hydrated, and get your protein and sleep in. If it's sharp pain in a joint rather than dull muscle ache, ease off that movement and we'll find a pain-free alternative.`,
  },
  {
    keywords: ['injur', 'pain', 'hurt', 'tweak', 'strain'],
    reply: () => `Sorry to hear that. Pain is a signal, so let's respect it: skip anything that reproduces it for now and train around it — there's almost always a pain-free option. If it's severe, lingering, or from a fall, please get it checked by a professional. Tell me where it is and I'll adjust today's plan.`,
  },
  {
    keywords: ['tired', 'exhausted', 'no energy', 'fatigued', 'burnt out', 'burnout', 'unmotivated', 'motivation', 'cant be bothered', "can't be bothered", 'lazy'],
    reply: (s) => `We all get those days, ${name(s)}. The trick is to shrink the task: just do the first two exercises, or even a 15-minute quick session. Starting is the hard part — momentum does the rest. And if you're genuinely run down, a rest day is training too. ${streakLine(s)}`,
  },
  {
    keywords: ['plateau', 'stuck', 'not progressing', 'no progress', 'stalled', 'not improving'],
    reply: () => `Plateaus happen to everyone. A few things that usually break them: make sure you're truly progressing the weight or reps each week, eat and sleep enough to recover, and check your effort is close to failure on the last set. If a lift's been stuck for weeks, we can deload (drop ~10% and build back). Which lift is stalling?`,
  },
  {
    keywords: ['how often', 'how many days', 'days a week', 'frequency', 'rest day', 'overtraining'],
    reply: (s) => `For ${GOAL_LABEL[s.profile.goal] ?? 'your goal'}, ${s.profile.daysPerWeek || 3}–${Math.min(6, (s.profile.daysPerWeek || 3) + 1)} sessions a week with at least one rest day works well. Consistency over weeks beats cramming. Recovery is when you actually adapt, so rest days are part of the plan, not a break from it.`,
  },
  {
    keywords: ['weight', 'scale', 'heavier', 'not losing', 'gaining weight', 'lighter'],
    reply: (s) => `Bodyweight bounces around day to day with water, food and sleep — don't read too much into one reading. Look at the weekly trend instead. ${weightLine(s)} Pair the scale with how your clothes fit, your photos and your lifts for the full picture.`,
  },
  {
    keywords: ['form', 'technique', 'how do i do', 'how to do', 'right way'],
    reply: () => `Great that you're thinking about form — it's what keeps you progressing and injury-free. Open any exercise and tap "Not sure how? Show me" mid-workout for step-by-step cues and a form clip. Tell me which lift and I'll give you the two or three things that matter most.`,
  },
  {
    keywords: ['sleep', 'sleeping', 'rest', 'recovery', 'recover'],
    reply: () => `Sleep is the most underrated part of training — it's when you build muscle and recharge focus. Aim for a consistent 7–9 hours. If sessions feel flat, sleep is usually the first thing to fix, before any supplement or program tweak.`,
  },
  {
    keywords: ['exam', 'study', 'busy', 'no time', 'stressed', 'stress'],
    reply: (s) => examState(s).active
      ? `Exam mode is already on, so I've shortened your sessions and eased your targets — three key lifts and good sleep is a full win right now. Protect your study and don't feel guilty about lighter weeks.`
      : `When life gets busy, shorter and consistent beats long and perfect. Try the 15-minute quick sessions, and if exams are coming up, turn on Exam mode in settings and I'll automatically lighten your plan.`,
  },
  {
    keywords: ['supplement', 'creatine', 'protein powder', 'pre workout', 'pre-workout'],
    reply: () => `Supplements are the cherry on top, not the cake. Food, sleep and consistent training do 95% of the work. If you want two with solid evidence: a protein powder for convenience, and creatine monohydrate (3–5g daily) for strength. Everything else is optional.`,
  },
  {
    keywords: ['thank', 'thanks', 'cheers', 'appreciate', 'awesome', 'great', 'love'],
    reply: (s) => `Anytime, ${name(s)} — that's what I'm here for. Keep showing up and the results follow. 💪`,
  },
  {
    keywords: ['hello', 'hi ', 'hey', 'yo ', 'morning', 'sup'],
    reply: (s) => `Hey ${name(s)}! Good to hear from you. How's training going, and is there anything you want to tweak or talk through today?`,
  },
]

export function coachReply(s: AppState, text: string): string {
  const clean = ` ${text.trim().toLowerCase()} `

  // Food questions → reuse the nutrition knowledge base.
  if (/\b(eat|food|protein|carb|carbs|diet|meal|snack|calorie|sugar|breakfast|lunch|dinner|hydrat|water|alcohol)\b/.test(clean)) {
    const qa = answerQuestion(text)
    if (qa.matched) return qa.answer
  }

  for (const rule of RULES) {
    if (rule.keywords.some((k) => clean.includes(k))) return rule.reply(s)
  }

  // Fallback — keep it human and useful, point to what I can help with.
  return `I hear you, ${name(s)}. I can help with changing exercises, soreness or niggles, motivation, plateaus, form, sleep and nutrition — whatever's on your mind for ${GOAL_LABEL[s.profile.goal] ?? 'your goal'}. Tell me a bit more and I'll give you a clear next step.`
}

/** Coach's opening message for a fresh thread. */
export function coachWelcome(s: AppState): string {
  return `Hi ${name(s)}, I'm your coach 👋 Message me anytime — about how a session felt, an exercise you'd like to change, a niggle, or staying on track with ${GOAL_LABEL[s.profile.goal] ?? 'your goal'}. What's on your mind?`
}

export const CHAT_SUGGESTIONS = [
  'I want to swap an exercise',
  'My legs are really sore',
  "I'm feeling unmotivated",
  'How many days should I train?',
]

function name(s: AppState) {
  return s.profile.name?.split(' ')[0] || 'there'
}
function streakLine(s: AppState) {
  const st = streakStats(s)
  return st.current > 0 ? `You're on a ${st.current}-day streak — worth protecting.` : `Let's get a fresh streak going.`
}
function weightLine(s: AppState) {
  const w = weightStats(s)
  const dir = w.delta < 0 ? 'down' : w.delta > 0 ? 'up' : 'steady'
  return `Your 4-week trend is ${dir}${w.delta !== 0 ? ` by ${Math.abs(w.delta).toFixed(1)} kg` : ''}.`
}
