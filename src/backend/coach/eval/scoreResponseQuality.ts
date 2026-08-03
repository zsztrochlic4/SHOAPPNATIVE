/**
 * Pure aggregation + gate for the coach response-quality evaluation (audit C-017, report §6).
 *
 * Given two reviewers' filled scores, computes the overall mean, per-critical-dimension means, the
 * automatic-failure count and inter-rater agreement, and decides PASS/FAIL against the release
 * thresholds. No I/O, no model — deterministic and unit-tested. The runner (runResponseQualityEval)
 * reads the scoring sheets and calls this; nothing here makes the human judgement, it only tallies it.
 */

import {
  EVAL_DIMENSIONS, MEAN_THRESHOLD, CRITICAL_MIN, IRR_MIN, MAX_AUTO_FAILS,
} from './responseQualityCorpus'

/** One reviewer's scores for one case: each dimension 1–5, plus an automatic-failure flag. */
export interface CaseScore {
  caseId: string
  scores: Record<string, number> // dimensionKey → 1..5
  autoFail: boolean
}

export interface ReviewerSheet {
  reviewer: string
  cases: CaseScore[]
}

export interface EvalResult {
  pass: boolean
  reasons: string[]
  overallMean: number
  criticalMeans: Record<string, number>
  autoFailCount: number
  interRaterAgreement: number | null // null when <2 reviewers
  reviewers: string[]
  casesScored: number
}

const clamp15 = (n: number): number => (Number.isFinite(n) ? Math.max(1, Math.min(5, n)) : 1)

function allScores(sheets: ReviewerSheet[]): { dim: string; value: number }[] {
  const out: { dim: string; value: number }[] = []
  for (const s of sheets) for (const c of s.cases) for (const d of EVAL_DIMENSIONS) {
    const v = c.scores[d.key]
    if (typeof v === 'number') out.push({ dim: d.key, value: clamp15(v) })
  }
  return out
}

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

/**
 * Inter-rater agreement across exactly two reviewers: the fraction of (case × dimension) scores that
 * agree within ONE point (a pragmatic, transparent alternative to weighted kappa for a 1–5 scale).
 * Returns null unless there are two reviewers scoring overlapping cases.
 */
export function interRaterAgreement(sheets: ReviewerSheet[]): number | null {
  if (sheets.length !== 2) return null
  const [a, b] = sheets
  const bIndex = new Map(b.cases.map((c) => [c.caseId, c]))
  let agree = 0
  let total = 0
  for (const ca of a.cases) {
    const cb = bIndex.get(ca.caseId)
    if (!cb) continue
    for (const d of EVAL_DIMENSIONS) {
      const va = ca.scores[d.key]
      const vb = cb.scores[d.key]
      if (typeof va === 'number' && typeof vb === 'number') {
        total++
        if (Math.abs(clamp15(va) - clamp15(vb)) <= 1) agree++
      }
    }
  }
  return total ? agree / total : null
}

export function evaluateResponseQuality(sheets: ReviewerSheet[]): EvalResult {
  const reasons: string[] = []
  const flat = allScores(sheets)
  const overallMean = mean(flat.map((x) => x.value))

  const criticalMeans: Record<string, number> = {}
  for (const d of EVAL_DIMENSIONS) {
    if (!d.critical) continue
    criticalMeans[d.key] = mean(flat.filter((x) => x.dim === d.key).map((x) => x.value))
  }

  const autoFailCount = sheets.reduce((n, s) => n + s.cases.filter((c) => c.autoFail).length, 0)
  const irr = interRaterAgreement(sheets)
  const casesScored = new Set(sheets.flatMap((s) => s.cases.map((c) => c.caseId))).size

  if (!flat.length) reasons.push('no scores provided')
  if (overallMean < MEAN_THRESHOLD) reasons.push(`overall mean ${overallMean.toFixed(2)} < ${MEAN_THRESHOLD}`)
  for (const [k, v] of Object.entries(criticalMeans)) {
    if (v < CRITICAL_MIN) reasons.push(`critical dimension "${k}" mean ${v.toFixed(2)} < ${CRITICAL_MIN}`)
  }
  if (autoFailCount > MAX_AUTO_FAILS) reasons.push(`${autoFailCount} automatic failure(s) (max ${MAX_AUTO_FAILS})`)
  if (sheets.length < 2) reasons.push('fewer than two independent reviewers')
  else if (irr != null && irr < IRR_MIN) reasons.push(`inter-rater agreement ${irr.toFixed(2)} < ${IRR_MIN}`)

  return {
    pass: reasons.length === 0,
    reasons,
    overallMean,
    criticalMeans,
    autoFailCount,
    interRaterAgreement: irr,
    reviewers: sheets.map((s) => s.reviewer),
    casesScored,
  }
}
