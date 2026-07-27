/**
 * Minimal Google Generative Language (Gemini) REST client for CI.
 *
 * Uses GEMINI_API_KEY and Node's built-in fetch (Node 18+). No SDK dependency so the workflow stays
 * `npm ci`-clean. Mirrors the app's Firebase AI Logic call (Gemini, temperature 0, small token budget).
 */
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'

export class GeminiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'GeminiError'
    this.status = status
  }
}

/**
 * Generate content for a single prompt. Returns the trimmed text reply.
 * @param {string} prompt
 * @param {object} opts { apiKey, model, systemInstruction, temperature, maxOutputTokens, timeoutMs }
 */
export async function generate(prompt, opts) {
  const { apiKey, model, systemInstruction, temperature = 0, maxOutputTokens = 120, timeoutMs = 20000 } = opts
  if (!apiKey) throw new GeminiError('missing GEMINI_API_KEY', 0)

  const url = `${ENDPOINT}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens, responseMimeType: 'text/plain' },
  }
  if (systemInstruction) body.systemInstruction = { parts: [{ text: systemInstruction }] }

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new GeminiError(`gemini_${res.status}: ${text.slice(0, 300)}`, res.status)
    }
    const data = await res.json()
    const parts = data?.candidates?.[0]?.content?.parts ?? []
    return parts
      .map((p) => p?.text ?? '')
      .join('')
      .trim()
  } finally {
    clearTimeout(t)
  }
}

/** Bounded-concurrency map so a run doesn't fire hundreds of requests at once. */
export async function mapPool(items, limit, fn) {
  const out = new Array(items.length)
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx], idx)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}
