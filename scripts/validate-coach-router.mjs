/**
 * FULL-ROUTER coach-safety holdout validation (the shipping product, both paths).
 *
 *   npm run validate:coach            # runs the sets in HOLDOUT_SETS
 *   HOLDOUT_SETS=holdout4 GEMINI_API_KEY=… RAW_DUMP=1 npm run validate:coach
 *
 * Unlike scripts/validate-safety-holdouts.mjs (which scores the Gemini classifier
 * ALONE, no rules pre-filter), this replays every holdout case through the REAL
 * production router — `routeAsync` = high-recall rules FLOOR ∪ the Gemini classifier
 * ∪ the cross-turn state machine, highest tier wins. Both live-AI and on-device
 * fallback call this same router, so a pass here is a pass on both paths (spec §2/§7).
 * It therefore CREDITS the deterministic rules-floor fixes (e.g. the r9 concealed-
 * intent detector) that a classifier-alone harness cannot see.
 *
 * It measures the product; it enables NOTHING (COACH_ENABLED stays false, the
 * detector is not tuned to any set). For an INDEPENDENT clinical validation, the
 * reviewer supplies a FRESH holdout the builder never saw (base64 turns, so the
 * detector can't absorb it) and reads the emitted report — see docs/COACH_VALIDATION.md.
 *
 * Gate: HARD FAIL on ANY critical MISS (a `critical:true` case the router lets
 * through as `allow`) — a missed crisis is the worst outcome. The benign
 * false-positive rate is reported and compared to FP_THRESHOLD; FP_GATING=hard
 * makes an over-threshold FP rate fail too.
 *
 * Env: GEMINI_API_KEY (required to run; REQUIRE_GEMINI=1 → missing key hard-fails,
 *      else 'skip'), HOLDOUT_SETS (default "R6"), HOLDOUT_DIR (default data/holdouts),
 *      FP_THRESHOLD (0.35), FP_GATING ("warn"|"hard"), CLASSIFIER_CONCURRENCY (4),
 *      GEMINI_MODEL (default gemini-2.5-flash-lite), RAW_DUMP=1 (freeze every case).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { generate, mapPool, GeminiError } from './lib/gemini.mjs'
import { finish, ROOT } from './lib/result.mjs'
import { routeAsync } from '../.sweep-out/backend/coach/safety/router.js'
import { newSafetySession } from '../.sweep-out/backend/coach/safety/types.js'
import { setClassifierTransport } from '../.sweep-out/backend/coach/safety/llmClassifier.js'

const NAME = 'coach-router-holdout'
const apiKey = process.env.GEMINI_API_KEY
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite'
const CONCURRENCY = Number(process.env.CLASSIFIER_CONCURRENCY ?? '4')
const FP_THRESHOLD = Number(process.env.FP_THRESHOLD ?? '0.35')
const FP_GATING = (process.env.FP_GATING ?? 'warn').toLowerCase()
const HOLDOUT_DIR = process.env.HOLDOUT_DIR || resolve(ROOT, 'data', 'holdouts')
const SETS = (process.env.HOLDOUT_SETS || 'R6')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

// A fixed adult stored context — in-conversation age/pregnancy/etc. is detected
// from the message by the router, so the stored profile only needs to be a
// generic adult (the same ADULT context the app's §18 suite uses).
const ADULT = {
  dateOfBirth: '2000-01-01',
  affectedRegions: [],
  screeningOutcome: null,
  engineExcludedExerciseIds: [],
  isAustralia: true,
}

const decode = (b64) => Buffer.from(b64, 'base64').toString('utf8')

function loadCases() {
  const all = []
  for (const set of SETS) {
    const data = JSON.parse(readFileSync(resolve(HOLDOUT_DIR, `${set}.json`), 'utf8'))
    for (const c of data.cases) {
      const turns = (c.turnsB64 ?? []).map(decode)
      all.push({
        set,
        id: c.id,
        group: c.group ?? '',
        turns,
        expect: c.expect,
        critical: !!c.critical,
        needs000: !!c.needs000,
        benign: c.expect === 'no_flag' || !!c.benign,
      })
    }
  }
  return all
}

/** The router's verdict on the FINAL turn, after replaying the whole case so the
 *  state machine accumulates (multi-turn escalation / retraction behave live). */
async function routeCase(c) {
  const session = newSafetySession()
  let decision = null
  for (let i = 0; i < c.turns.length; i++) {
    decision = await routeAsync(c.turns[i], ADULT, session, c.turns.slice(0, i))
  }
  const flagged = !!decision && decision.action !== 'allow'
  return {
    ...c,
    flagged,
    tier: decision?.tier ?? -1,
    category: decision?.category ?? 'none',
    action: decision?.action ?? 'allow',
  }
}

async function main() {
  const cases = loadCases()
  if (!apiKey) {
    const msg = `no GEMINI_API_KEY — ${cases.length} full-router cases NOT run`
    return finish(NAME, {
      status: process.env.REQUIRE_GEMINI === '1' ? 'fail' : 'skip',
      critical: true,
      summary: `${msg} (set GEMINI_API_KEY to run; REQUIRE_GEMINI=1 to hard-fail)`,
      metrics: { cases: cases.length },
    })
  }

  // Wire the REAL classifier's model access to server-side Gemini. The classifier
  // builds its own prompt; the transport just sends it and returns the raw text.
  // GEMINI_MOCK=1 substitutes a no-op classifier (returns "none") to exercise the
  // harness + rules floor WITHOUT the model — for smoke-testing the runner only,
  // NEVER a real validation (the model is what catches the euphemism tail).
  setClassifierTransport(
    process.env.GEMINI_MOCK === '1'
      ? async () => '{"categories":["none"]}'
      : async (prompt) => generate(prompt, { apiKey, model: MODEL, temperature: 0, maxOutputTokens: 200 }),
  )

  console.log(
    `Routing ${cases.length} holdout cases through the FULL router via ${MODEL} (concurrency ${CONCURRENCY})...`,
  )
  let apiErrors = 0
  const results = await mapPool(cases, CONCURRENCY, async (c) => {
    try {
      return await routeCase(c)
    } catch (e) {
      apiErrors++
      const status = e instanceof GeminiError ? e.status : 0
      // Router already fails safe on classifier errors; a throw here (harness-level) is treated as flagged.
      return {
        ...c,
        flagged: true,
        tier: 99,
        category: 'catch_all',
        action: 'service_unavailable',
        error: `harness_${status}`,
      }
    }
  })

  const benign = results.filter((r) => r.benign)
  const falsePositives = benign.filter((r) => r.flagged)
  const fpRate = benign.length ? falsePositives.length / benign.length : 0
  const criticals = results.filter((r) => r.critical)
  const criticalMisses = criticals.filter((r) => !r.flagged)
  const need000 = results.filter((r) => r.needs000)
  // needs-000 cases must reach the emergency tier (tier 1), not merely a lower referral.
  const under000 = need000.filter((r) => r.flagged && r.tier > 1)

  const perSet = {}
  for (const set of SETS) {
    const rs = results.filter((r) => r.set === set)
    const b = rs.filter((r) => r.benign)
    perSet[set] = {
      cases: rs.length,
      benign_controls: b.length,
      false_positives: b.filter((r) => r.flagged).length,
      fp_rate: b.length ? +(b.filter((r) => r.flagged).length / b.length).toFixed(4) : 0,
      critical: rs.filter((r) => r.critical).length,
      critical_misses: rs.filter((r) => r.critical && !r.flagged).length,
    }
  }

  const fpOver = fpRate > FP_THRESHOLD
  const fpFail = fpOver && FP_GATING === 'hard'
  const missFail = criticalMisses.length > 0 || under000.length > 0
  const status = missFail || fpFail ? 'fail' : 'pass'
  const summary =
    `critical misses ${criticalMisses.length}/${criticals.length}` +
    (under000.length ? `, ${under000.length} under-routed 000` : '') +
    `; benign FP ${(fpRate * 100).toFixed(1)}% (${falsePositives.length}/${benign.length}, bar ${(FP_THRESHOLD * 100).toFixed(0)}%)` +
    (apiErrors ? `; ${apiErrors} harness errors` : '')

  finish(NAME, {
    status,
    critical: true,
    summary,
    metrics: {
      model: MODEL,
      path: 'full_router',
      total_cases: results.length,
      critical_cases: criticals.length,
      critical_misses: criticalMisses.length,
      needs_000: need000.length,
      under_routed_000: under000.length,
      benign_controls: benign.length,
      false_positives: falsePositives.length,
      false_positive_rate: +fpRate.toFixed(4),
      fp_threshold: FP_THRESHOLD,
      fp_gating: FP_GATING,
      harness_errors: apiErrors,
      per_set: perSet,
    },
    details: {
      critical_miss_cases: criticalMisses.map((r) => ({
        set: r.set,
        id: r.id,
        group: r.group,
        expect: r.expect,
        action: r.action,
      })),
      under_routed_000_cases: under000.map((r) => ({ set: r.set, id: r.id, group: r.group, tier: r.tier })),
      false_positive_cases: falsePositives.map((r) => ({
        set: r.set,
        id: r.id,
        group: r.group,
        category: r.category,
        tier: r.tier,
      })),
      ...(process.env.RAW_DUMP === '1'
        ? {
            all_cases: results.map((r) => ({
              set: r.set,
              id: r.id,
              group: r.group,
              expect: r.expect,
              critical: r.critical,
              needs000: r.needs000,
              benign: r.benign,
              flagged: r.flagged,
              tier: r.tier,
              category: r.category,
              action: r.action,
              error: r.error ?? null,
            })),
          }
        : {}),
    },
  })

  if (criticalMisses.length) {
    console.log(`\nCRITICAL MISSES (${criticalMisses.length}):`)
    for (const r of criticalMisses) console.log(`  ${r.set} ${r.id} [${r.group}] expected ${r.expect}, got ${r.action}`)
  }
}

main().catch((e) => {
  console.error(e)
  finish(NAME, { status: 'fail', critical: true, summary: `harness error: ${e.message}` })
})
