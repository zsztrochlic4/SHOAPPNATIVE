// Tests for the proactive coach check-in — the delivery behind the "Proactive check-ins"
// preference. It shares the daily-message signal ladder but only surfaces moments worth the coach
// reaching out about unprompted, and never the generic greeting, the "sleep has been solid" note, or
// the streak-at-risk nudge (which the dashboard already shows). Fixtures are hand-built (a fresh
// account with no busy periods) so the signal ladder is fully under the test's control regardless of
// the machine clock.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import { todayKey } from '../../.sweep-out/lib/date.js'
import { coachDaily, proactiveCheckin } from '../../.sweep-out/store/coach.js'

const PROFILE = { name: 'Alex', stepTarget: 10000, waterTargetL: 3, sleepTargetH: 8 }

// Minimal AppState shape the coach signal ladder reads. plannedPeriods:[] forces exam mode off, so
// the lower-priority signals under test are never pre-empted.
const base = {
  profile: PROFILE,
  settings: { units: 'metric' },
  plannedPeriods: [],
  program: null,
  habits: [],
  sessions: [],
  weights: [],
  meals: [],
  activities: [],
  foodReviews: [],
  notifications: [],
  chat: [],
}
const st = (o = {}) => ({ ...base, ...o, profile: { ...PROFILE, ...(o.profile ?? {}) }, settings: { ...base.settings, ...(o.settings ?? {}) } })
const habit = (o) => ({ dateKey: todayKey, steps: 0, sleepH: 0, waterL: 0, workout: false, nutritionScore: 0, ...o })

test('proactiveCheckin surfaces the actionable hydration nudge, matching the daily message', () => {
  const s = st() // nothing logged today → water below target → the low-water nudge fires
  const p = proactiveCheckin(s)
  assert.ok(p, 'expected a proactive check-in')
  assert.equal(p.title, 'Easy win today')
  assert.equal(p.cta?.overlay, 'logHabit')
  // When the same signal tops the ladder, the daily message and the proactive card agree.
  assert.equal(coachDaily(s).title, 'Easy win today')
})

test('proactiveCheckin returns null when nothing is worth interrupting for', () => {
  // Water satisfied, sleep low, no PR / gap / milestone / exam → no proactive moment…
  const s = st({ habits: [habit({ waterL: PROFILE.waterTargetL * 2, sleepH: 0 })] })
  assert.equal(proactiveCheckin(s), null)
  // …yet the daily message still falls back to the generic greeting.
  assert.match(coachDaily(s).title, /^Morning,/)
})

test('a positive-but-inactionable signal shows daily but never interrupts proactively', () => {
  // Solid sleep + water satisfied today: coachDaily celebrates it; the proactive check-in stays quiet.
  const s = st({ habits: [habit({ waterL: PROFILE.waterTargetL * 2, sleepH: PROFILE.sleepTargetH + 1 })] })
  assert.equal(coachDaily(s).title, 'Sleep has been solid')
  assert.equal(proactiveCheckin(s), null)
})

test('proactiveCheckin never returns the generic greeting or a plain nudge', () => {
  // Across the controlled fixtures, a proactive check-in is always either null or a genuinely
  // relevant, non-generic message — never the "Morning," fallback.
  for (const s of [st(), st({ habits: [habit({ waterL: 99, sleepH: 0 })] }), st({ habits: [habit({ waterL: 99, sleepH: 99 })] })]) {
    const p = proactiveCheckin(s)
    if (p) assert.ok(!p.title.startsWith('Morning,'), 'generic greeting must never be proactive')
  }
})
