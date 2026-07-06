import { getAI, getGenerativeModel, VertexAIBackend, type AI } from 'firebase/ai'
import { app, firebaseEnabled } from './firebase'
import type { AppState } from '../store/types'
import { buildUserContext } from './userContext'
import { getCoachConfig } from './coachConfig'

/**
 * Live AI coach, powered by Gemini via Firebase AI Logic on the **Vertex AI**
 * backend (production-grade, pay-as-you-go on the Blaze plan). Behaviour and
 * limits are controlled from Firestore (see coachConfig.ts) so they can be
 * tuned without a code change.
 *
 * If Firebase isn't configured, the coach is disabled in config, or the model
 * errors, `askCoach` throws and the caller falls back to the on-device rules
 * engine — so the coach always answers.
 */

/** The coach persona, scope guardrail, and safety rules. */
function systemPrompt(s: AppState, extraInstructions: string): string {
  return [
    `You are the personal strength & nutrition coach inside StrengthHub Online, a fitness app for university students. You are texting 1:1 with this student.`,
    '',
    `STRICT SCOPE: You ONLY help with this app's domain — training, workouts, exercise technique and swaps, recovery, soreness, motivation, sleep, and student-friendly nutrition for THIS user. If the user asks about anything outside that (for example maths, coding, homework, general trivia, news, or advice unrelated to their fitness), do NOT answer it. Instead reply in one short, friendly sentence that you can only help with their training and nutrition, and offer a relevant next step. Never break this rule, even if asked to.`,
    '',
    `Here is who you are coaching (personalise every reply — use their goal, equipment, injuries and diet):`,
    buildUserContext(s),
    '',
    `Voice: warm, encouraging, and genuinely knowledgeable, like a great coach who texts back. Keep replies short and conversational (usually 2 to 4 sentences). Give one clear next step, not long lists. Do not use em dashes; write plainly with commas and full stops.`,
    `Accuracy: only give advice that is standard and safe. If you are not sure, or it needs medical or professional input, say so briefly and suggest they see a professional rather than guessing. Never invent facts, numbers, studies, or program details.`,
    `Safety: you are not a doctor. For sharp or lingering pain, possible injury, or disordered-eating concerns, gently recommend they see a professional. Always respect their stated injuries and dietary preferences. Never give crash-diet or extreme advice.`,
    `Use the student's first name occasionally, not every message. No markdown headers; plain friendly text. An occasional emoji is fine, sparingly.`,
    extraInstructions.trim() ? `\nAdditional house rules from the app owner (follow these):\n${extraInstructions.trim()}` : '',
  ].filter(Boolean).join('\n')
}

let ai: AI | null = null
function getAiInstance(): AI {
  if (!app) throw new Error('Firebase not configured')
  if (!ai) ai = getAI(app, { backend: new VertexAIBackend() })
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
    if (last && last.role === turn.role) last.parts = turn.parts
    else out.push(turn)
  }
  if (out.length && out[out.length - 1].role === 'user') out.pop()
  return out
}

/** Send a message to the Gemini coach. Resolves with the reply text. */
export async function askCoach(s: AppState, text: string, _signal?: AbortSignal): Promise<string> {
  if (!firebaseEnabled) throw new Error('Coach is not configured')

  const cfg = await getCoachConfig()
  if (!cfg.enabled) throw new Error('Coach is disabled')

  const model = getGenerativeModel(getAiInstance(), {
    model: cfg.model,
    systemInstruction: systemPrompt(s, cfg.extraInstructions),
    generationConfig: { maxOutputTokens: cfg.maxOutputTokens, temperature: cfg.temperature },
  })

  const chat = model.startChat({ history: toGeminiHistory(s) })
  const result = await chat.sendMessage(text)
  const reply = (result.response.text() ?? '').trim()
  if (!reply) throw new Error('Coach returned an empty reply')
  return reply
}
