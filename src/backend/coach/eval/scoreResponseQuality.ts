/**
 * Pure completeness validation + gate for the coach response-quality evaluation (audit C-017 / U-004
 * / U-005 / U-006, report §6).
 *
 * The gate FAILS CLOSED: it can only pass on COMPLETE, well-formed evidence — exactly two distinct
 * reviewers, each scoring every one of the 60 corpus cases on every one of the 15 dimensions with an
 * integer 1–5, full overlap, a non-null inter-rater agreement, and (when a manifest is supplied) a
 * manifest bound to a real release/model/prompt with model replies present. Incomplete or malformed
 * evidence returns precise failure reasons — a poor or untested model can never slip through a
 * green-but-empty gate. No I/O, no model — deterministic and unit-tested.
 */

import {
  EVAL_DIMENSIONS, RESPONSE_EVAL_CASES, MEAN_THRESHOLD, CRITICAL_MIN, IRR_MIN, MAX_AUTO_FAILS,
  REQUIRED_REVIEWERS, REQUIRED_CASE_COUNT,
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

/** Optional manifest binding checked when supplied (U-006). */
export interface EvalManifest {
  releaseSha?: string
  model?: string
  promptHash?: string
  includesModelReplies?: boolean
}

export interface EvalResult {
  pass: boolean
  reasons: string[]
  overallMean: number
  dimensionMeans: Record<string, number>
  criticalMeans: Record<string, number>
  autoFailCount: number
  interRaterAgreement: number | null // null when not exactly two overlapping reviewers
  reviewers: string[]
  casesScored: number
  complete: boolean // did the evidence pass every completeness check?
}

const CORPUS_IDS: string[] = RESPONSE_EVAL_CASES.map((c) => c.id)
const DIM_KEYS: string[] = EVAL_DIMENSIONS.map((d) => d.key)
const isInt15 = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 5

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

/**
 * Completeness (U-004): exactly REQUIRED_REVIEWERS distinct reviewers, each covering EXACTLY the 60
 * corpus case ids (no missing, extra, unknown or duplicate), each case carrying all 15 integer 1–5
 * dimension scores. Returns the list of precise problems (empty ⇒ complete).
 */
export function validateCompleteness(sheets: ReviewerSheet[]): string[] {
  const problems: string[] = []
  if (sheets.length !== REQUIRED_REVIEWERS) {
    problems.push(`expected exactly ${REQUIRED_REVIEWERS} reviewers, got ${sheets.length}`)
  }
  const names = sheets.map((s) => (s.reviewer || '').trim())
  if (names.some((n) => !n)) problems.push('every reviewer must have a non-empty name')
  if (new Set(names).size !== names.length) problems.push('reviewer names must be distinct (no duplicates)')

  const corpusSet = new Set(CORPUS_IDS)
  for (const s of sheets) {
    const label = s.reviewer || '(unnamed)'
    const ids = s.cases.map((c) => c.caseId)
    const idSet = new Set(ids)
    if (ids.length !== idSet.size) problems.push(`${label}: duplicate case ids`)
    for (const id of corpusSet) if (!idSet.has(id)) problems.push(`${label}: missing case ${id}`)
    for (const id of idSet) if (!corpusSet.has(id)) problems.push(`${label}: unknown case ${id}`)
    if (idSet.size !== REQUIRED_CASE_COUNT) problems.push(`${label}: scored ${idSet.size}/${REQUIRED_CASE_COUNT} cases`)
    for (const c of s.cases) {
      for (const k of DIM_KEYS) {
        if (!isInt15(c.scores?.[k])) { problems.push(`${label}/${c.caseId}: dimension "${k}" must be an integer 1–5`); }
      }
      const extra = Object.keys(c.scores ?? {}).filter((k) => !DIM_KEYS.includes(k))
      if (extra.length) problems.push(`${label}/${c.caseId}: unknown dimension(s) ${extra.join(', ')}`)
      if (typeof c.autoFail !== 'boolean') problems.push(`${label}/${c.caseId}: autoFail must be a boolean`)
    }
  }
  // Full overlap: both reviewers must score the same case set (guaranteed above if both == corpus).
  if (sheets.length === REQUIRED_REVIEWERS) {
    const [a, b] = sheets.map((s) => new Set(s.cases.map((c) => c.caseId)))
    for (const id of a) if (!b.has(id)) problems.push(`non-overlapping: case ${id} scored by only one reviewer`)
  }
  // De-dup for readability; cap noise.
  return Array.from(new Set(problems)).slice(0, 50)
}

/**
 * Inter-rater agreement across exactly two reviewers: the fraction of (case × dimension) scores that
 * agree within ONE point. Returns null unless there are exactly two reviewers scoring overlapping
 * cases with valid scores (so a missing/malformed set can never yield a passing agreement).
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
    for (const k of DIM_KEYS) {
      const va = ca.scores?.[k]
      const vb = cb.scores?.[k]
      if (isInt15(va) && isInt15(vb)) { total++; if (Math.abs(va - vb) <= 1) agree++ }
    }
  }
  return total ? agree / total : null
}

export function evaluateResponseQuality(sheets: ReviewerSheet[], manifest?: EvalManifest): EvalResult {
  const reasons: string[] = []
  const completenessProblems = validateCompleteness(sheets)
  const complete = completenessProblems.length === 0
  reasons.push(...completenessProblems)

  // Only valid integer scores contribute to the numbers (invalid ones are already flagged above).
  const flat: { dim: string; value: number }[] = []
  for (const s of sheets) for (const c of s.cases) for (const k of DIM_KEYS) {
    if (isInt15(c.scores?.[k])) flat.push({ dim: k, value: c.scores[k] })
  }
  const overallMean = mean(flat.map((x) => x.value))
  const dimensionMeans: Record<string, number> = {}
  const criticalMeans: Record<string, number> = {}
  for (const d of EVAL_DIMENSIONS) {
    const dm = mean(flat.filter((x) => x.dim === d.key).map((x) => x.value))
    dimensionMeans[d.key] = dm
    if (d.critical) criticalMeans[d.key] = dm
  }
  const autoFailCount = sheets.reduce((n, s) => n + s.cases.filter((c) => c.autoFail === true).length, 0)
  const irr = interRaterAgreement(sheets)
  const casesScored = new Set(sheets.flatMap((s) => s.cases.map((c) => c.caseId))).size

  // Manifest binding (U-006): if provided, it must bind to a real release/model/prompt with replies.
  if (manifest) {
    if (!manifest.releaseSha || manifest.releaseSha === 'FILL_ME') reasons.push('manifest releaseSha is not bound to a release')
    if (!manifest.model || manifest.model === 'FILL_ME') reasons.push('manifest model is not set')
    if (!manifest.promptHash || manifest.promptHash === 'FILL_ME') reasons.push('manifest promptHash is not set')
    if (manifest.includesModelReplies !== true) reasons.push('manifest indicates no model replies were scored')
  }

  // Thresholds — only meaningful on complete evidence, but always reported.
  if (!flat.length) reasons.push('no valid scores provided')
  if (overallMean < MEAN_THRESHOLD) reasons.push(`overall mean ${overallMean.toFixed(2)} < ${MEAN_THRESHOLD}`)
  for (const [k, v] of Object.entries(criticalMeans)) {
    if (v < CRITICAL_MIN) reasons.push(`critical dimension "${k}" mean ${v.toFixed(2)} < ${CRITICAL_MIN}`)
  }
  if (autoFailCount > MAX_AUTO_FAILS) reasons.push(`${autoFailCount} automatic failure(s) (max ${MAX_AUTO_FAILS})`)
  if (irr == null) reasons.push('inter-rater agreement could not be computed (needs exactly two overlapping reviewers)')
  else if (irr < IRR_MIN) reasons.push(`inter-rater agreement ${irr.toFixed(2)} < ${IRR_MIN}`)

  return {
    pass: reasons.length === 0,
    reasons: Array.from(new Set(reasons)),
    overallMean,
    dimensionMeans,
    criticalMeans,
    autoFailCount,
    interRaterAgreement: irr,
    reviewers: sheets.map((s) => s.reviewer),
    casesScored,
    complete,
  }
}
