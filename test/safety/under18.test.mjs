/**
 * Deterministic under-18 rules-floor detection (node --test).
 *
 *   npm run test:safety   (compiles src/backend via tsconfig.sweep.json, then runs this)
 *
 * Guards the Option-B fix: the rules floor must catch enumerable age disclosure — including the INDIRECT
 * "approaching 18" class (Jack JV-U03: "my eighteenth birthday is next month" = currently 17) — without
 * flagging third-party ages, rep/kg quantities, or adults. This is provable, model-independent detection.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { runRules } from '../../.sweep-out/backend/coach/safety/rules.js'

const CTX = {
  dateOfBirth: null,
  affectedRegions: [],
  screeningOutcome: null,
  engineExcludedExerciseIds: [],
  isAustralia: true,
}
const flagsUnder18 = (t) => runRules(t, CTX).hits.some((h) => h.category === 'under_18')

const MUST_FLAG = [
  'My eighteenth birthday is next month. Can I use the coach now?', // JV-U03 (indirect)
  'im turning 18 next month',
  'i turn 18 in two weeks',
  'im almost 18',
  'i am about to turn 18',
  'not yet 18, can i sign up',
  'before i turn 18 can i start',
  'im 15 and want a plan', // direct age (existing)
  'in year 8, can you build me a cutting program', // school year (existing)
  // Indirect US high-school class terms (2026-08-16 hardening): unambiguous minors, in the high-school
  // collocation only.
  "i'm a junior in high school, can i use this",
  'i am a high school sophomore, can i start',
  'freshman in high school here, is this ok',
  "i'm in high school, can i use the coach", // first-person present enrolment
  "i'm currently in high school",
]

const MUST_NOT_FLAG = [
  "my sister's 18th birthday is next month", // third party
  'i did almost 18 reps today', // reps collision
  'i need 18 kg more on my squat', // kg collision
  'i turned 18 last year', // now an adult
  'i am 24 and want to bulk', // adult
  'can you write me an upper/lower split', // benign
  'my cousin is 15 and wants to lift', // third-party age
  // 2026-08-16 hardening must NOT over-flag the gym-/college-overloaded uses of these words:
  'i coach a high school team on weekends', // coach, an adult
  'i teach high school pe', // teacher, an adult
  'i am a senior lifter with 20 years experience', // 'senior' in the gym
  "i'm a junior doctor working nights", // 'junior' profession
  'i did junior athletics as a kid', // historical junior sport
  "i'm a college freshman, can i use this", // college freshman = 18+
  'when i was in high school i played footy', // historical, now an adult
  'my son is a junior in high school', // third party
]

for (const msg of MUST_FLAG) {
  test(`flags under_18: ${msg}`, () => assert.equal(flagsUnder18(msg), true))
}
for (const msg of MUST_NOT_FLAG) {
  test(`does NOT flag under_18: ${msg}`, () => assert.equal(flagsUnder18(msg), false))
}
