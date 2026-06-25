// Serverless endpoint that powers the 1:1 coach messenger with Claude.
//
// IMPORTANT: this file runs on the SERVER (e.g. a Vercel/Netlify function),
// never in the browser. The Anthropic API key is read from the host
// environment (`ANTHROPIC_API_KEY`) and is NEVER shipped to the client or
// committed to the repo. If the key is missing, the function returns 503 and
// the app falls back to its on-device rules engine, so the demo still works.
//
// Deploy notes:
//   • Vercel: drop this in /api and set ANTHROPIC_API_KEY in Project Settings.
//   • Add `@anthropic-ai/sdk` (already in package.json) so the function builds.
import Anthropic from '@anthropic-ai/sdk'

type ChatTurn = { role: 'user' | 'assistant'; content: string }

interface CoachRequest {
  message: string
  history?: ChatTurn[]
  profile?: {
    name?: string
    goal?: string
    experience?: string
    daysPerWeek?: number
    premium?: boolean
    examMode?: boolean
    streak?: number
    notes?: string
  }
}

const GOAL_LABEL: Record<string, string> = {
  'build-muscle': 'building muscle',
  'lose-fat': 'losing fat',
  'gain-strength': 'getting stronger',
  'stay-healthy': 'staying healthy',
}

function systemPrompt(p: CoachRequest['profile']): string {
  const name = p?.name || 'the student'
  const goal = (p?.goal && GOAL_LABEL[p.goal]) || 'their fitness goals'
  const bits = [
    `You are the personal strength & nutrition coach inside StrengthHub Online, a fitness app for university students.`,
    `You are texting 1:1 with ${name}. Their main goal is ${goal}.`,
    p?.experience ? `Training experience: ${p.experience}.` : '',
    p?.daysPerWeek ? `They train about ${p.daysPerWeek} days/week.` : '',
    typeof p?.streak === 'number' && p.streak > 0 ? `Current streak: ${p.streak} days.` : '',
    p?.examMode ? `They are in exam season, so keep expectations light and protect their study time.` : '',
    '',
    `Voice: warm, encouraging, and genuinely knowledgeable, like a great coach who texts back.`,
    `Keep replies short and conversational (usually 2 to 4 sentences). Be specific and give one clear next step rather than long lists. Do not use em dashes; write plainly with commas and full stops.`,
    `You can help with: workouts and swapping exercises, soreness, motivation, plateaus, form cues, sleep, recovery, and student-friendly nutrition.`,
    `Safety: you are not a doctor. For sharp/lingering pain, possible injury, or disordered-eating concerns, gently recommend they see a professional. Never give crash-diet or extreme advice; keep it healthy and sustainable.`,
    `Use the student's first name occasionally, not every message. No markdown headers; plain friendly text. An occasional emoji is fine, sparingly.`,
  ]
  return bits.filter(Boolean).join('\n')
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    // No key configured, tell the client to use its local fallback.
    res.status(503).json({ error: 'Coach API not configured' })
    return
  }

  try {
    const body: CoachRequest =
      typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}
    const message = (body.message || '').toString().trim()
    if (!message) {
      res.status(400).json({ error: 'Missing message' })
      return
    }

    // Keep only the most recent turns to bound cost/latency.
    const history = (body.history || [])
      .filter((t) => t && (t.role === 'user' || t.role === 'assistant') && t.content)
      .slice(-10)

    const client = new Anthropic({ apiKey })

    const msg = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 400,
      system: systemPrompt(body.profile),
      messages: [
        ...history.map((t) => ({ role: t.role, content: t.content })),
        { role: 'user' as const, content: message },
      ],
    })

    const reply = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()

    if (!reply) {
      res.status(502).json({ error: 'Empty reply' })
      return
    }

    res.status(200).json({ reply })
  } catch (err: any) {
    console.error('coach API error:', err?.message || err)
    res.status(502).json({ error: 'Coach API failed' })
  }
}
