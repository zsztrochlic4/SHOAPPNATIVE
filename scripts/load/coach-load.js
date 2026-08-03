// k6 load-test skeleton for the coach callable (audit §9 + SA-011).
//
//   BASE_URL="https://<region>-<project>.cloudfunctions.net" \
//   ID_TOKEN="<staging Firebase ID token>" \
//   k6 run scripts/load/coach-load.js
//
// Runs against STAGING only. Each iteration sends a UNIQUE idempotency requestKey,
// so this measures real throughput; reuse a key to verify dedupe returns the cached
// turn instead of a second model call. Ramp `stages` to each scenario's concurrency.
//
// NOTE: the coach ships gated OFF (COACH_ENABLED=false) — against real config it
// returns failed-precondition/coach_disabled, which still exercises auth, App Check
// and the rate-limit path. Enable it only in staging to load-test the model path.
import http from 'k6/http'
import { check, sleep } from 'k6'

const BASE_URL = __ENV.BASE_URL
const ID_TOKEN = __ENV.ID_TOKEN
const REGION_PATH = __ENV.REGION_PATH || '' // e.g. '' if BASE_URL already includes region

export const options = {
  // Pilot tier (~25 concurrent). Bump for growth/scale tiers.
  stages: [
    { duration: '1m', target: 5 },
    { duration: '3m', target: 25 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<8000'], // coach turn p95 under 8s
    http_req_failed: ['rate<0.02'],    // < 2% transport errors (excludes gated 4xx)
  },
}

function requestKey() {
  // Unique per iteration (VU + iteration + time) — mirrors the client key format.
  return `req-${__VU}-${__ITER}-${Date.now().toString(36)}`
}

export default function () {
  if (!BASE_URL || !ID_TOKEN) {
    throw new Error('Set BASE_URL and ID_TOKEN env vars (staging only).')
  }
  const url = `${BASE_URL}${REGION_PATH}/coachMessage`
  // Firebase callable envelope: { data: {...} }.
  const payload = JSON.stringify({
    data: {
      message: 'What should my first upper-body session look like?',
      requestKey: requestKey(),
    },
  })
  const res = http.post(url, payload, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ID_TOKEN}`,
    },
  })
  // 200 = served; 4xx with coach_disabled/resource-exhausted are EXPECTED under the
  // gate / rate limits and are not transport failures.
  check(res, {
    'not 5xx': (r) => r.status < 500,
  })
  sleep(1)
}
