/**
 * StrengthHub backend — Cloud Functions (2nd gen HTTPS).
 *
 * Health-platform integrations (Strava, Whoop):
 *  - `oauthToken`     exchanges an OAuth code (or refresh token) for tokens.
 *    The provider client SECRETS live here as Cloud secrets and never ship in
 *    the app.
 *  - `providerFetch`  proxies authenticated GETs to an allow-listed set of
 *    provider APIs, because browsers block those APIs cross-origin (CORS).
 *
 * (The old `coach` function was removed — the AI coach now runs through
 * Firebase AI Logic directly from the app.)
 *
 * Deploy:
 *   firebase functions:secrets:set STRAVA_CLIENT_ID
 *   firebase functions:secrets:set STRAVA_CLIENT_SECRET
 *   firebase functions:secrets:set WHOOP_CLIENT_ID
 *   firebase functions:secrets:set WHOOP_CLIENT_SECRET
 *   firebase deploy --only functions
 */
const { onRequest } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')

const STRAVA_CLIENT_ID = defineSecret('STRAVA_CLIENT_ID')
const STRAVA_CLIENT_SECRET = defineSecret('STRAVA_CLIENT_SECRET')
const WHOOP_CLIENT_ID = defineSecret('WHOOP_CLIENT_ID')
const WHOOP_CLIENT_SECRET = defineSecret('WHOOP_CLIENT_SECRET')

const TOKEN_URLS = {
  strava: 'https://www.strava.com/oauth/token',
  whoop: 'https://api.prod.whoop.com/oauth/oauth2/token',
}

const API_HOSTS = {
  strava: 'https://www.strava.com',
  whoop: 'https://api.prod.whoop.com',
}

function credsFor(provider) {
  if (provider === 'strava') return { id: STRAVA_CLIENT_ID.value(), secret: STRAVA_CLIENT_SECRET.value() }
  if (provider === 'whoop') return { id: WHOOP_CLIENT_ID.value(), secret: WHOOP_CLIENT_SECRET.value() }
  return null
}

exports.oauthToken = onRequest(
  { secrets: [STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET], cors: true, region: 'us-central1' },
  async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    const { provider, code, redirectUri, refreshToken } = req.body || {}
    const creds = credsFor(provider)
    if (!creds || !TOKEN_URLS[provider]) return res.status(400).json({ error: 'Unknown provider' })
    if (!creds.id || !creds.secret) return res.status(503).json({ error: `${provider} is not configured` })
    if (!code && !refreshToken) return res.status(400).json({ error: 'Missing code or refreshToken' })

    const params = new URLSearchParams({ client_id: creds.id, client_secret: creds.secret })
    if (code) {
      params.set('grant_type', 'authorization_code')
      params.set('code', code)
      if (redirectUri) params.set('redirect_uri', redirectUri)
    } else {
      params.set('grant_type', 'refresh_token')
      params.set('refresh_token', refreshToken)
    }

    try {
      const r = await fetch(TOKEN_URLS[provider], {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      })
      const data = await r.json()
      if (!r.ok) {
        console.error('token exchange failed', provider, r.status, data)
        return res.status(502).json({ error: 'Token exchange failed' })
      }
      return res.status(200).json({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_at ?? (data.expires_in ? Math.floor(Date.now() / 1000) + data.expires_in : undefined),
      })
    } catch (err) {
      console.error('oauthToken error', err?.message || err)
      return res.status(502).json({ error: 'Token exchange failed' })
    }
  },
)

exports.providerFetch = onRequest({ cors: true, region: 'us-central1' }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { provider, accessToken, path } = req.body || {}
  const host = API_HOSTS[provider]
  if (!host) return res.status(400).json({ error: 'Unknown provider' })
  if (!accessToken || typeof path !== 'string' || !path.startsWith('/')) {
    return res.status(400).json({ error: 'Missing accessToken or bad path' })
  }

  try {
    const r = await fetch(host + path, { headers: { Authorization: `Bearer ${accessToken}` } })
    const body = await r.text()
    res.status(r.status).set('Content-Type', 'application/json')
    return res.send(body)
  } catch (err) {
    console.error('providerFetch error', provider, err?.message || err)
    return res.status(502).json({ error: 'Provider fetch failed' })
  }
})
