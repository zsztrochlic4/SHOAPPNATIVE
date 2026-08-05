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

/** Manifest binding checked in a scored run (U-006 / R4-002). All fields are validated, never
 *  merely present. `replyCount` must equal the full corpus and every reply must be non-empty. */
export interface EvalManifest {
  releaseSha?: string
  model?: string
  promptHash?: string
  corpusHash?: string
  repliesHash?: string
  includesModelReplies?: boolean
  replyCount?: number
  /** Optional expected values a release job supplies; when present they must match exactly. */
  expectedReleaseSha?: string
  expectedModel?: string
}

const HEX40 = /^[0-9a-f]{40}$/i
// A real content hash: SHA-256 is 64 hex chars. (Legacy SHA-1 digests were 40; the release runner
// now emits SHA-256, so require the wider form for a genuine, non-truncated binding.)
const HASHLIKE = /^[0-9a-f]{64}$/i
const PLACEHOLDER = /^(FILL_ME|)$/i

/**
 * Canonical serialisation of the corpus that `corpusHash` is computed over (R5-004). Exported so the
 * release runner hashes EXACTLY this — the single source of truth for what the manifest binds, with
 * no drift between what is emitted and what is re-verified.
 */
export function canonicalCorpusPayload(): string {
  return JSON.stringify(RESPONSE_EVAL_CASES.map((c) => ({ id: c.id, prompt: c.prompt, scenario: c.scenario ?? '' })))
}

/** Canonical serialisation of the model replies that `repliesHash` is computed over (R5-004). */
export function canonicalRepliesPayload(replies: Record<string, string>): string {
  return JSON.stringify(RESPONSE_EVAL_CASES.map((c) => replies[c.id] ?? ''))
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

export interface EvalOptions {
  /** Release gate: a bound, complete manifest is MANDATORY (missing ⇒ fail). In a release run the
   *  expected SHA/model below also become MANDATORY, not optional (R5-004). */
  requireManifest?: boolean
  /** When supplied, the manifest must match these exactly (the release job derives them from HEAD /
   *  the configured model). Under `requireManifest` they are required, not merely checked-if-present. */
  expectedReleaseSha?: string
  expectedModel?: string
  /**
   * Hashes RE-COMPUTED by the release runner from the canonical corpus / model replies / system
   * prompt (R5-004). When present, each manifest hash must EQUAL its recomputed counterpart — this is
   * what actually binds the manifest to the real evidence (a shape check alone let a forged hash pass).
   */
  recomputedHashes?: { corpusHash?: string; repliesHash?: string; promptHash?: string }
  /** Release gate: recomputed provenance is MANDATORY — a run without it fails (R5-004). */
  requireRecomputedProvenance?: boolean
}

/** Strict manifest provenance validation (R4-002 / R5-004). Returns precise problems (empty ⇒ bound). */
export function validateManifest(manifest: EvalManifest | undefined, opts: EvalOptions = {}): string[] {
  const p: string[] = []
  if (!manifest) {
    if (opts.requireManifest) p.push('a bound evaluation manifest is required but none was supplied/readable')
    return p
  }
  // R5-004: in a release run the expected release SHA and model are MANDATORY inputs (the release job
  // derives them from HEAD and the configured model) — not optional self-asserted manifest fields.
  if (opts.requireManifest && !opts.expectedReleaseSha) p.push('release run requires an expected release SHA (derive it from HEAD) to bind the manifest')
  if (opts.requireManifest && !opts.expectedModel) p.push('release run requires an expected model id to bind the manifest')

  const sha = String(manifest.releaseSha ?? '')
  if (!HEX40.test(sha) || PLACEHOLDER.test(sha)) p.push('manifest releaseSha must be a 40-char commit SHA bound to the release')
  if (opts.expectedReleaseSha && sha.toLowerCase() !== opts.expectedReleaseSha.toLowerCase()) p.push(`manifest releaseSha ${sha} does not match the expected release ${opts.expectedReleaseSha}`)
  const model = String(manifest.model ?? '')
  if (!model || PLACEHOLDER.test(model)) p.push('manifest model is not set')
  if (opts.expectedModel && model !== opts.expectedModel) p.push(`manifest model ${model} does not match the expected model ${opts.expectedModel}`)
  for (const [k, v] of [['promptHash', manifest.promptHash], ['corpusHash', manifest.corpusHash], ['repliesHash', manifest.repliesHash]] as const) {
    const val = String(v ?? '')
    if (!HASHLIKE.test(val) || PLACEHOLDER.test(val)) p.push(`manifest ${k} must be a real SHA-256 hash (all 60 replies + corpus + prompt bound)`)
  }
  if (manifest.includesModelReplies !== true) p.push('manifest indicates no model replies were scored')
  if (manifest.replyCount !== REQUIRED_CASE_COUNT) p.push(`manifest replyCount must be exactly ${REQUIRED_CASE_COUNT} non-empty replies (got ${manifest.replyCount ?? 0})`)

  // R5-004: bind the manifest to hashes RE-COMPUTED from the real evidence. A shape-valid but forged,
  // stale or mismatched hash is caught here because it can't match a fresh recompute of the source.
  const rc = opts.recomputedHashes
  if (opts.requireRecomputedProvenance && !rc) {
    p.push('release run requires recomputed provenance hashes (corpus/replies/prompt) but none were supplied')
  }
  if (rc) {
    for (const [k, recomputed] of [['corpusHash', rc.corpusHash], ['repliesHash', rc.repliesHash], ['promptHash', rc.promptHash]] as const) {
      if (recomputed == null) {
        if (opts.requireRecomputedProvenance) p.push(`release run requires a recomputed ${k}`)
        continue
      }
      const claimed = String(manifest[k] ?? '')
      if (claimed.toLowerCase() !== String(recomputed).toLowerCase()) {
        p.push(`manifest ${k} does not match the hash recomputed from the actual ${k === 'corpusHash' ? 'corpus' : k === 'repliesHash' ? 'replies' : 'prompt'}`)
      }
    }
  }
  return p
}

export function evaluateResponseQuality(sheets: ReviewerSheet[], manifest?: EvalManifest, opts: EvalOptions = {}): EvalResult {
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

  // Manifest binding (U-006 / R4-002): strict, and MANDATORY in a release run — a missing manifest
  // no longer silently skips provenance; self-asserted / placeholder values are rejected.
  reasons.push(...validateManifest(manifest, opts))

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
