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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Transient statuses worth retrying: rate limit + server errors. */
const RETRYABLE = new Set([429, 500, 502, 503, 504])

/**
 * Generate content for a single prompt. Returns the trimmed text reply.
 *
 * Retries transient failures (HTTP 429 rate limit, 5xx, network errors) with exponential backoff —
 * important when a larger/slower model or a big burst hits per-minute quotas, so a transient 429 is
 * NOT miscounted as a classification (which would inflate the measured false-positive rate).
 *
 * @param {string} prompt
 * @param {object} opts { apiKey, model, systemInstruction, temperature, maxOutputTokens, timeoutMs, retries }
 */
export async function generate(prompt, opts) {
  const {
    apiKey,
    model,
    systemInstruction,
    temperature = 0,
    maxOutputTokens = 120,
    timeoutMs = 20000,
    retries = 4,
  } = opts
  if (!apiKey) throw new GeminiError('missing GEMINI_API_KEY', 0)

  const url = `${ENDPOINT}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens, responseMimeType: 'text/plain' },
  }
  if (systemInstruction) body.systemInstruction = { parts: [{ text: systemInstruction }] }

  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
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
        const err = new GeminiError(`gemini_${res.status}: ${text.slice(0, 300)}`, res.status)
        if (RETRYABLE.has(res.status) && attempt < retries) {
          // Honour Retry-After when present, else exponential backoff with jitter.
          const ra = Number(res.headers.get('retry-after'))
          const wait = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 2 ** attempt * 1000 + Math.random() * 500
          lastErr = err
          await sleep(wait)
          continue
        }
        throw err
      }
      const data = await res.json()
      const parts = data?.candidates?.[0]?.content?.parts ?? []
      return parts
        .map((p) => p?.text ?? '')
        .join('')
        .trim()
    } catch (e) {
      // Network/abort errors are retryable too.
      if (attempt < retries && !(e instanceof GeminiError)) {
        lastErr = e
        await sleep(2 ** attempt * 1000 + Math.random() * 500)
        continue
      }
      throw e instanceof GeminiError ? e : new GeminiError(String(e?.message ?? e), 0)
    } finally {
      clearTimeout(t)
    }
  }
  throw lastErr ?? new GeminiError('exhausted retries', 0)
}

/** List the models this key can call for generateContent (diagnostic — names without the models/ prefix). */
export async function listModels(apiKey, timeoutMs = 20000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}&pageSize=200`, { signal: ctrl.signal })
    if (!res.ok) throw new GeminiError(`listModels_${res.status}`, res.status)
    const data = await res.json()
    return (data.models ?? [])
      .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
      .map((m) => (m.name ?? '').replace(/^models\//, ''))
      .filter(Boolean)
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
