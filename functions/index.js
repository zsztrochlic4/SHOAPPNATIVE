/**
 * StrengthHub AI coach — Firebase Cloud Function (2nd gen HTTPS).
 *
 * Mirrors api/coach.ts but runs on Firebase. The Anthropic API key lives in a
 * Cloud secret (ANTHROPIC_API_KEY) and is NEVER shipped to the app. If the key
 * is missing or Anthropic errors, the function returns a non-200 and the app
 * falls back to its on-device rules engine, so the app always works.
 *
 * Deploy: see docs/BACKEND.md. Point the app at the function URL by setting
 * EXPO_PUBLIC_COACH_API to the deployed https URL.
 */
const { onRequest } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const Anthropic = require('@anthropic-ai/sdk')

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY')

const GOAL_LABEL = {
  'build-muscle': 'building muscle',
  'lose-fat': 'losing fat',
  'gain-strength': 'getting stronger',
  'stay-healthy': 'staying healthy',
}

function systemPrompt(p = {}) {
  const name = p.name || 'the student'
  const goal = (p.goal && GOAL_LABEL[p.goal]) || 'their fitness goals'
  const bits = [
    `You are the personal strength & nutrition coach inside StrengthHub Online, a fitness app for university students.`,
    `You are texting 1:1 with ${name}. Their main goal is ${goal}.`,
    p.experience ? `Training experience: ${p.experience}.` : '',
    p.daysPerWeek ? `They train about ${p.daysPerWeek} days/week.` : '',
    typeof p.streak === 'number' && p.streak > 0 ? `Current streak: ${p.streak} days.` : '',
    p.examMode ? `They are in exam season, so keep expectations light and protect their study time.` : '',
    '',
    `Voice: warm, encouraging, and genuinely knowledgeable, like a great coach who texts back.`,
    `Keep replies short and conversational (usually 2 to 4 sentences). Be specific and give one clear next step rather than long lists. Do not use em dashes; write plainly with commas and full stops.`,
    `You can help with: workouts and swapping exercises, soreness, motivation, plateaus, form cues, sleep, recovery, and student-friendly nutrition.`,
    `Safety: you are not a doctor. For sharp/lingering pain, possible injury, or disordered-eating concerns, gently recommend they see a professional. Never give crash-diet or extreme advice; keep it healthy and sustainable.`,
    `Use the student's first name occasionally, not every message. No markdown headers; plain friendly text. An occasional emoji is fine, sparingly.`,
  ]
  return bits.filter(Boolean).join('\n')
}

exports.coach = onRequest(
  { secrets: [ANTHROPIC_API_KEY], cors: true, region: 'us-central1' },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const apiKey = ANTHROPIC_API_KEY.value()
    if (!apiKey) {
      res.status(503).json({ error: 'Coach API not configured' })
      return
    }

    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}
      const message = (body.message || '').toString().trim()
      if (!message) {
        res.status(400).json({ error: 'Missing message' })
        return
      }

      const history = (body.history || [])
        .filter((t) => t && (t.role === 'user' || t.role === 'assistant') && t.content)
        .slice(-10)

      const client = new Anthropic({ apiKey })

      const msg = await client.messages.create({
        // Swap to a cheaper model (e.g. claude-haiku-4-5) to cut cost/latency.
        model: 'claude-opus-4-8',
        max_tokens: 400,
        system: systemPrompt(body.profile),
        messages: [
          ...history.map((t) => ({ role: t.role, content: t.content })),
          { role: 'user', content: message },
        ],
      })

      const reply = msg.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim()

      if (!reply) {
        res.status(502).json({ error: 'Empty reply' })
        return
      }

      res.status(200).json({ reply })
    } catch (err) {
      console.error('coach function error:', (err && err.message) || err)
      res.status(502).json({ error: 'Coach API failed' })
    }
  },
)
