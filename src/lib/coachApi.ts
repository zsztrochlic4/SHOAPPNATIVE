import { getAI, getGenerativeModel, GoogleAIBackend, type AI } from 'firebase/ai'
import { app, firebaseEnabled } from './firebase'
import type { AppState } from '../store/types'
import { streakStats } from '../store/selectors'

/**
 * Live AI coach, powered by Gemini via Firebase AI Logic.
 *
 * Firebase AI Logic proxies requests to the Gemini Developer API — the API key
 * is held by Firebase, never shipped in the app — and runs on the free Spark
 * plan (no billing needed). We use `gemini-2.5-flash-lite`, the cheapest model.
 *
 * If Firebase isn't configured, the model errors, or the API isn't enabled yet,
 * `askCoach` throws and the caller falls back to the on-device rules engine, so
 * the coach always answers.
 */
const MODEL = 'gemini-2.5-flash-lite'

const GOAL_LABEL: Record<string, string> = {
  'build-muscle': 'building muscle',
  'lose-fat': 'losing fat',
  'gain-strength': 'getting stronger',
  'stay-healthy': 'staying healthy',
}

/** The coach persona + guardrails (mirrors the previous server prompt). */
function systemPrompt(s: AppState): string {
  const p = s.profile
  const name = p.name?.split(' ')[0] || 'the student'
  const goal = GOAL_LABEL[p.goal] || 'their fitness goals'
  const streak = streakStats(s).current
  return [
    `You are the personal strength & nutrition coach inside StrengthHub Online, a fitness app for university students.`,
    `You are texting 1:1 with ${name}. Their main goal is ${goal}.`,
    p.experience ? `Training experience: ${p.experience}.` : '',
    p.daysPerWeek ? `They train about ${p.daysPerWeek} days per week.` : '',
    streak > 0 ? `Current streak: ${streak} days.` : '',
    p.examMode ? `They are in exam season, so keep expectations light and protect their study time.` : '',
    '',
    `Voice: warm, encouraging, and genuinely knowledgeable, like a great coach who texts back.`,
    `Keep replies short and conversational (usually 2 to 4 sentences). Be specific and give one clear next step rather than long lists. Do not use em dashes; write plainly with commas and full stops.`,
    `You can help with: workouts and swapping exercises, soreness, motivation, plateaus, form cues, sleep, recovery, and student-friendly nutrition.`,
    `Safety: you are not a doctor. For sharp or lingering pain, possible injury, or disordered-eating concerns, gently recommend they see a professional. Never give crash-diet or extreme advice; keep it healthy and sustainable.`,
    `Use the student's first name occasionally, not every message. No markdown headers; plain friendly text. An occasional emoji is fine, sparingly.`,
  ].filter(Boolean).join('\n')
}

let ai: AI | null = null
function getAiInstance(): AI {
  if (!app) throw new Error('Firebase not configured')
  if (!ai) ai = getAI(app, { backend: new GoogleAIBackend() })
  return ai
}

/**
 * Gemini requires history to start with a user turn and strictly alternate
 * user/model, ending before the new user message. Sanitise the app's chat log
 * into that shape so a stray unanswered turn can't cause an API error.
 */
function toGeminiHistory(s: AppState) {
  const mapped = s.chat.slice(-10).map((m) => ({
    role: m.role === 'user' ? ('user' as const) : ('model' as const),
    parts: [{ text: m.text }],
  }))
  while (mapped.length && mapped[0].role !== 'user') mapped.shift()
  const out: typeof mapped = []
  for (const turn of mapped) {
    const last = out[out.length - 1]
    if (last && last.role === turn.role) last.parts = turn.parts // keep latest of a repeated role
    else out.push(turn)
  }
  if (out.length && out[out.length - 1].role === 'user') out.pop() // end on a model turn
  return out
}

/** Send a message to the Gemini coach. Resolves with the reply text. */
export async function askCoach(s: AppState, text: string, _signal?: AbortSignal): Promise<string> {
  if (!firebaseEnabled) throw new Error('Coach is not configured')

  const model = getGenerativeModel(getAiInstance(), {
    model: MODEL,
    systemInstruction: systemPrompt(s),
    generationConfig: { maxOutputTokens: 400, temperature: 0.8 },
  })

  const chat = model.startChat({ history: toGeminiHistory(s) })
  const result = await chat.sendMessage(text)
  const reply = (result.response.text() ?? '').trim()
  if (!reply) throw new Error('Coach returned an empty reply')
  return reply
}
