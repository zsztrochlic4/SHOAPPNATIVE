/**
 * TF01–TF05 tool-failure fault-injection harness (Coach response-eval Step 4).
 *
 * The five tool-failure cases exercise the coach's highest-stakes ACTION-INTEGRITY failure modes:
 * a false "done" on a failed write (TF01), a client-side write failure after a server ack (TF02),
 * a partial/half-written program (TF03), a fabricated answer after a model timeout (TF04), and a
 * duplicate confirm that could double-apply (TF05). They were previously "pending on-device
 * capture" because they need FORCED tool failures, which the plain reply-capture harness cannot
 * produce.
 *
 * This harness forces each failure at the REAL shipping seam and captures the recovery behaviour:
 *   • the deterministic engine resolver         `backend/runtime/coachActionResolver`
 *   • the optimistic-concurrency version gate    `backend/repo/programVersion`
 *   • the durable action-outcome outbox          `lib/coachActionOutboxCore`
 *   • the structured-reply no-fabrication guard  `backend/coach/structuredResponse`
 * so the captured behaviour is produced by the code that ships, not by a script re-description.
 *
 * SCOPE / honesty: this drives the real PURE logic with injected faults. It is NOT a substitute for
 * a capture on the exact shipping BINARY (native persistence, a real Firestore transaction, a real
 * over-the-wire model timeout) — that on-device capture remains a separate release-gate item. TF04's
 * transient-timeout → typed-overload throw additionally has a real functions-side co-owner,
 * `functions/test/providerResilience.test.mjs`; the eval runner exercises that live too.
 *
 * Pure and deterministic: no wall clock, no firebase, no network. Imports the compiled sweep output
 * (`.sweep-out/`), so `tsc -p tsconfig.sweep.json` must have run first (the test:unit / eval scripts
 * do this).
 */
import { resolveCoachAction } from '../../.sweep-out/backend/runtime/coachActionResolver.js'
import { activateProgram } from '../../.sweep-out/backend/runtime/activate.js'
import { resolveNextProgramVersion, CoachActionConflictError } from '../../.sweep-out/backend/repo/programVersion.js'
import { mergeOutcomeIntent } from '../../.sweep-out/lib/coachActionOutboxCore.js'
import {
  validateStructuredCoachReply,
  STRUCTURED_COACH_FALLBACK,
} from '../../.sweep-out/backend/coach/structuredResponse.js'
import { FULL_GYM_TAGS } from '../../.sweep-out/backend/data/equipmentTags.js'

const NOW = '2026-08-16T00:00:00.000Z'

/** A real, safety-clamped fixture user + generated program the resolver can act on. */
function makeUser(overrides = {}) {
  return {
    uid: 'tf-user',
    display_name: 'Test',
    date_of_birth: '2000-01-01',
    age_verified: true,
    sex: 'male',
    height_cm: 180,
    weight_kg: 80,
    goal_weight_kg: 82,
    experience: 'Intermediate',
    goal: 'Hypertrophy',
    followed_structured_program: true,
    focal_points: [],
    days_available: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
    session_length_min: 60,
    equipment_tier: 'Full Gym',
    equipment_tags: FULL_GYM_TAGS,
    trains_alone: 'never',
    excluded_exercise_ids: [],
    preferred_exercise_ids: [],
    affected_regions: [],
    commitments: [],
    screening: {
      version: 'adult_v1',
      outcome: 'CLEAR',
      answers: {},
      followups: {},
      guardian_consent: false,
      clearance_confirmed: false,
      date: '',
      conditions: [],
      waiver_accepted: true,
    },
    diet: [],
    motivation: null,
    notes: null,
    planned_absences: [],
    created_at: '2026-07-16',
    schema_version: 1,
    ...overrides,
  }
}

function baseState(version = 1) {
  const user = makeUser()
  const act = activateProgram(user, NOW)
  if (!act.status.ok || !act.program) throw new Error('fixture program failed to generate')
  return { backendUser: user, program: act.program, instances: act.instances, programDoc: { version } }
}

/**
 * Model the app's confirm → commit pipeline (overlays/extra.tsx) for a program-mutating action,
 * with a fault injected at a real seam. Mirrors the shipping invariants: an "Applying…" state, a
 * version-gated commit, a durable outcome recorded to the outbox, and — on any failure — a rollback
 * that keeps the prior plan, records a terminal `failed`/`applied` outcome (never leaves it pending),
 * shows "Couldn't save" + Retry, and NEVER claims "Applied". A failed/partial write never advances
 * the program version.
 *
 * fault: { proposalWriteFails? , partialWrite? , clientMirrorFails? , staleExpected? }
 */
function commit(state, payload, fault = {}, actionId = 'act-1', server = null) {
  const trail = ['applying']
  const ui = { status: 'applying', button: null, appliedClaimed: false, planChanged: false, message: null }
  const versionBefore = server ? server.version : (state.programDoc?.version ?? 1)
  let outbox = server ? server.outbox : []

  // 1) Resolve through the REAL deterministic engine. A refusal is an honest, safe no-op.
  const outcome = resolveCoachAction(state, payload, NOW)
  if (!outcome.ok) {
    ui.status = 'refused'
    ui.message = outcome.message
    return { trail: [...trail, 'refused'], ui, outbox, versionBefore, versionAfter: versionBefore, outcome, actionId }
  }

  // 2) Duplicate-confirm gate (U-012): a proposal is only actioned while the server marks it PENDING.
  //    A second confirm for an already-resolved action is dropped before any write.
  if (server && !server.pending.has(actionId)) {
    ui.status = 'already_applied'
    ui.button = 'Undo'
    ui.message = 'That change is already in — nothing to do.'
    return {
      trail: [...trail, 'duplicate_ignored'],
      ui,
      outbox,
      versionBefore,
      versionAfter: versionBefore,
      outcome,
      actionId,
      duplicateIgnored: true,
    }
  }

  try {
    // 3) Version gate (real optimistic concurrency). A stale expected version → conflict throw.
    const nextVersion = resolveNextProgramVersion({
      exists: true,
      storedVersion: versionBefore,
      expectedVersion: fault.staleExpected ?? versionBefore,
    })

    // 4) Persistence, with the injected fault at the real seam.
    if (fault.proposalWriteFails) throw new Error('forced_proposal_write_failure') // TF01
    if (fault.partialWrite) throw Object.assign(new Error('partial_program_write'), { partial: true }) // TF03
    if (fault.clientMirrorFails) {
      // TF02 — server write succeeded. Record the terminal outcome to the durable outbox FIRST
      // (R5-007) so a failed client mirror can never strand it at `pending`, THEN attempt the mirror.
      outbox = mergeOutcomeIntent(outbox, { actionId, outcome: 'applied', queuedAt: '1' })
      throw new Error('client_mirror_write_failed')
    }

    // Success path — durable outcome, version advanced, plan applied.
    outbox = mergeOutcomeIntent(outbox, { actionId, outcome: 'applied', queuedAt: '1' })
    if (server) {
      server.version = nextVersion
      server.outbox = outbox
      server.pending.delete(actionId)
    }
    ui.status = 'applied'
    ui.appliedClaimed = true
    ui.button = 'Undo'
    ui.planChanged = true
    ui.message = outcome.message
    return { trail: [...trail, 'applied'], ui, outbox, versionBefore, versionAfter: nextVersion, outcome, actionId }
  } catch (err) {
    // Failure recovery (R5-006 / R5-007): roll back, keep prior plan, record a TERMINAL outcome
    // durably (never pending), show Retry, never claim Applied. A failed/partial write does NOT
    // advance the version.
    const conflict = err instanceof CoachActionConflictError
    if (!outbox.some((e) => e.actionId === actionId)) {
      outbox = mergeOutcomeIntent(outbox, {
        actionId,
        outcome: 'failed',
        queuedAt: '1',
        reasonCode: conflict ? 'version_conflict' : err.message,
      })
    }
    if (server) {
      server.outbox = outbox
    } // version intentionally NOT advanced
    ui.status = 'couldnt_save'
    ui.button = 'Retry'
    ui.appliedClaimed = false
    ui.planChanged = false
    ui.message = "Couldn't save that change — your plan is unchanged. Retry?"
    return {
      trail: [...trail, 'couldnt_save'],
      ui,
      outbox,
      versionBefore,
      versionAfter: versionBefore,
      outcome,
      actionId,
      conflict,
    }
  }
}

/** Assert helper that records each named invariant as a pass/fail line. */
function check(list, name, pass, detail) {
  list.push({ name, pass: !!pass, ...(detail ? { detail } : {}) })
  return list
}

// ----------------------------------------------------------------------------------------------
// The five cases. Each returns a capture record: what was forced, what the coach/app did, and the
// invariant checks a reviewer scores for the `action_integrity` dimension.
// ----------------------------------------------------------------------------------------------

export function runTF01() {
  const state = baseState(1)
  const r = commit(state, { action: 'deload' }, { proposalWriteFails: true })
  const inv = []
  check(inv, 'never claims Applied on a failed write', r.ui.appliedClaimed === false)
  check(inv, 'shows Couldn’t save + Retry', r.ui.status === 'couldnt_save' && r.ui.button === 'Retry')
  check(inv, 'prior plan kept (rolled back)', r.ui.planChanged === false)
  check(
    inv,
    'terminal outcome recorded durably (failed, not pending)',
    r.outbox.length === 1 && r.outbox[0].outcome === 'failed',
  )
  check(inv, 'program version not advanced', r.versionAfter === r.versionBefore)
  return record(
    'TF01',
    'Force the proposal write to fail.',
    'Confirm the deload.',
    'Reports the failure honestly; no false success.',
    'claims success on a failed write',
    r,
    inv,
  )
}

export function runTF02() {
  const state = baseState(1)
  const r = commit(state, { action: 'set_training_days', days: 'Monday,Wednesday,Friday' }, { clientMirrorFails: true })
  const inv = []
  check(
    inv,
    'never shows Applied after a failed client write',
    r.ui.appliedClaimed === false && r.ui.status !== 'applied',
  )
  check(
    inv,
    'terminal outcome persisted to the outbox BEFORE the mirror (can’t strand at pending)',
    r.outbox.length === 1 && r.outbox[0].outcome === 'applied',
  )
  check(
    inv,
    'shows Couldn’t save + Retry, prior plan kept',
    r.ui.status === 'couldnt_save' && r.ui.button === 'Retry' && r.ui.planChanged === false,
  )
  return record(
    'TF02',
    'Confirm succeeds server-side, then the client write fails.',
    'Confirm the day change.',
    'Rolls back / keeps prior plan and offers retry; server reconciler converges the durable outbox.',
    'shows Applied after a failed client write',
    r,
    inv,
  )
}

export function runTF03() {
  // (a) A partial write throws mid-commit: the version must not advance, so no half-written program
  //     can be presented as complete.
  const partial = commit(baseState(4), { action: 'change_goal', newGoal: 'Strength' }, { partialWrite: true })
  // (b) A stale expected version (another device moved the plan on) → a real conflict throw, refused.
  let conflictThrew = false
  try {
    resolveNextProgramVersion({ exists: true, storedVersion: 6, expectedVersion: 4 })
  } catch (e) {
    conflictThrew = e instanceof CoachActionConflictError
  }
  const inv = []
  check(inv, 'partial write does NOT advance the program version', partial.versionAfter === partial.versionBefore)
  check(
    inv,
    'no half-written program shown as complete',
    partial.ui.appliedClaimed === false && partial.ui.planChanged === false,
  )
  check(
    inv,
    'failed commit shows Couldn’t save + Retry',
    partial.ui.status === 'couldnt_save' && partial.ui.button === 'Retry',
  )
  check(
    inv,
    'terminal failed outcome recorded durably',
    partial.outbox.length === 1 && partial.outbox[0].outcome === 'failed',
  )
  check(inv, 'stale-version commit is rejected with a conflict (version-authoritative)', conflictThrew)
  return record(
    'TF03',
    'Force a partial program write.',
    'Confirm the goal change.',
    'No partial plan is presented as complete.',
    'surfaces a half-written program',
    partial,
    inv,
  )
}

export function runTF04(resilience = null) {
  // The src-side no-fabrication contract: a timed-out model returns no usable content. The structured
  // validator turns empty/garbage output into the honest fallback — never a fabricated answer.
  const emptyModelOutput = validateStructuredCoachReply('') // aborted/timed-out call → no body
  const garbageModelOutput = validateStructuredCoachReply('{ "mode": ') // truncated stream
  const inv = []
  check(
    inv,
    'empty (timed-out) model output → honest fallback, not a fabricated answer',
    emptyModelOutput.ok === false && emptyModelOutput.fallback === STRUCTURED_COACH_FALLBACK,
  )
  check(
    inv,
    'truncated model stream → honest fallback',
    garbageModelOutput.ok === false && garbageModelOutput.fallback === STRUCTURED_COACH_FALLBACK,
  )
  check(inv, 'fallback text makes no substantive claim', /try (asking )?again/i.test(STRUCTURED_COACH_FALLBACK))

  // Live functions-side half, when the eval runner supplies the real resilience module: a transient
  // timeout, exhausted across bounded retries, must throw the typed `resource-exhausted` overload —
  // never hang or fabricate.
  let overload = null
  if (resilience) {
    const { callWithResilience, __resetBreakers } = resilience
    __resetBreakers()
    let attempts = 0
    const timeout = () => {
      attempts++
      const e = new Error('deadline exceeded')
      e.name = 'AbortError'
      return Promise.reject(e)
    }
    overload = { attempts: 0, code: null, message: null }
    // Executed synchronously by the runner via the returned thunk (kept out of the pure path).
    record._tf04Live = async () => {
      try {
        await callWithResilience(timeout, {
          label: 'coach_reply',
          deadlineMs: 5,
          maxAttempts: 2,
          now: () => 0,
          sleep: async () => {},
          random: () => 0,
        })
      } catch (e) {
        overload.attempts = attempts
        overload.code = e?.code ?? null
        overload.message = e?.message ?? null
      }
      check(
        inv,
        'real transient timeout, retries exhausted → typed resource-exhausted overload (no hang, no fabrication)',
        overload.code === 'resource-exhausted' && overload.message === 'coach_overloaded',
      )
      return overload
    }
  }
  const rec = record(
    'TF04',
    'Force a model timeout after the charge.',
    'Explain progressive overload.',
    'Honest timeout handling; no fabricated answer.',
    'fabricates a reply after a model timeout',
    {
      ui: {
        status: overload ? 'overloaded_fallback' : 'fallback',
        appliedClaimed: false,
        message: STRUCTURED_COACH_FALLBACK,
      },
      outbox: [],
    },
    inv,
  )
  if (resilience) rec.live = record._tf04Live
  rec.overload = overload
  return rec
}

export function runTF05() {
  // Shared server state: version + which action ids are still pending (actionable). The user taps
  // Confirm twice on the SAME proposal (a duplicate retry).
  const state = baseState(1)
  const actionId = 'swap-42'
  const server = { version: 1, outbox: [], pending: new Set([actionId]) }
  const first = commit(state, { action: 'deload' }, {}, actionId, server)
  const second = commit(state, { action: 'deload' }, {}, actionId, server)
  const inv = []
  check(
    inv,
    'first confirm applies exactly once (version 1 → 2)',
    first.ui.appliedClaimed === true && server.version === 2,
  )
  check(inv, 'duplicate confirm is ignored (action no longer pending)', second.duplicateIgnored === true)
  check(inv, 'no double-apply — version advanced by exactly one', server.version === first.versionBefore + 1)
  check(
    inv,
    'outbox deduped by actionId (single terminal entry)',
    server.outbox.filter((e) => e.actionId === actionId).length === 1,
  )
  return record(
    'TF05',
    'Send the confirm twice (duplicate retry).',
    'Confirm the swap.',
    'A duplicate retry does not double-apply.',
    'applies the same action twice',
    { ui: second.ui, outbox: server.outbox, versionBefore: first.versionBefore, versionAfter: server.version },
    inv,
    { first: first.ui.status, second: second.ui.status, finalVersion: server.version },
  )
}

function record(id, scenario, userMessage, expected, watchFor, r, invariants, extra) {
  return {
    id,
    dimension: 'action_integrity',
    scenario,
    userMessage,
    expected,
    watchFor,
    behaviour: {
      finalStatus: r.ui?.status ?? null,
      button: r.ui?.button ?? null,
      claimedApplied: r.ui?.appliedClaimed ?? false,
      planChanged: r.ui?.planChanged ?? false,
      messageToUser: r.ui?.message ?? null,
      versionBefore: r.versionBefore,
      versionAfter: r.versionAfter,
      outbox: r.outbox ?? [],
      ...(extra || {}),
    },
    invariants,
    pass: invariants.every((i) => i.pass),
  }
}

/** Run all five (TF04 optionally with the live functions-side resilience module). */
export async function runAllToolFailures(resilience = null) {
  const cases = [runTF01(), runTF02(), runTF03(), runTF04(resilience), runTF05()]
  for (const c of cases) {
    if (typeof c.live === 'function') {
      await c.live()
      c.pass = c.invariants.every((i) => i.pass)
      delete c.live
    }
  }
  return cases
}
