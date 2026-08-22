/**
 * The coach conversation ENGINE, extracted so the first-class Coach tab and the
 * legacy coach sheet share ONE implementation of send / safety precheck /
 * proposal confirm-undo — never a second, divergable copy of a safety-critical
 * path. Presentation lives in CoachScreen / CoachMessageRow; this hook is logic
 * only. Lifted verbatim from the original CoachChatSheet.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated } from 'react-native'
import { useStore } from '../store/store'
import { useNav } from '../nav'
import { useAuth } from '../auth/AuthProvider'
import { useToast } from '../components/Toast'
import { useColors } from '../theme'
import { IS_WEB } from '../components/WebFrame'
import { coachDisplayName, recentPR } from '../store/coach'
import { coachReply } from '../lib/coachChat'
import { askCoachServer } from '../lib/coachServer'
import { coachOutputLanguage } from '../lib/i18n'
import { newCoachRequestKey } from '../lib/coachRequestKey'
import {
  fetchCoachWorkspace,
  readCachedCoachWorkspace,
  respondToCoachProposal,
  recordCoachActionOutcome,
  recordCoachFeedback,
  flushCoachActionOutcomeOutbox,
} from '../lib/coachWorkspace'
import { writeBackendUser } from '../backend/repo/userRepo'
import { commitCoachAction, CoachActionConflictError } from '../backend/repo/programRepo'
import { commitCoachPeriods, commitCoachProfilePatch } from '../store/cloudRepo'
import {
  resolveCoachAction,
  applyCoachSwapChoice,
  type SwapOption,
  type CoachActionOutcome,
} from '../backend/runtime/coachActionResolver'
import { deriveLocalProfile } from '../backend/mapping/projection'
import { newPeriodDraft, periodModeForAbsence, plannedPeriods } from '../store/periods'
import {
  coachContext,
  coachOperational,
  COACH_PREVIEW,
  COACH_ACTIONING,
  coachPrecheckAsync,
  newSafetySession,
} from '../lib/coachSafety'
import { fmtWeight } from '../lib/format'
import { firebaseEnabled } from '../lib/firebase'
import { todayKey, deviceTimezone } from '../lib/date'
import type {
  ChatMessage,
  ProgramSnapshot,
  PlannedPeriod,
  CommunityScope,
  Profile,
} from '../store/types'
import type { CoachActionProposal } from '../backend/coach/contracts'
import { resolveNavExerciseId, isProofRequest } from './proposal'

/**
 * "Scripted" mode: reply from the on-device canned coach and skip the consent + server round-trips.
 * True for the dev design preview (COACH_PREVIEW) OR whenever there's no backend at all
 * (`!firebaseEnabled`, i.e. demo mode) — so the coach is fully usable in a no-Firebase preview. In a
 * real build `firebaseEnabled` is always true, so this collapses to COACH_PREVIEW (off in production)
 * and the real, safety-gated server path is untouched.
 */
export const COACH_SCRIPTED = COACH_PREVIEW || !firebaseEnabled

export type CoachChat = ReturnType<typeof useCoachChat>

/**
 * @param active whether the coach surface is currently on screen (drives mark-read,
 *   workspace fetch and the session-scoped affordance cleanup).
 */
export function useCoachChat({ active }: { active: boolean }) {
  const { state, dispatch } = useStore()
  const nav = useNav()
  const { user } = useAuth()
  const toast = useToast()
  const colors = useColors()

  // The most recent coach-actioned change, kept so the user can UNDO it from its card.
  const [undoTarget, setUndoTarget] = useState<{ proposalId: string; snapshot: ProgramSnapshot; actionId?: string; appliedVersion?: number } | null>(null)
  const [applyingProposalId, setApplyingProposalId] = useState<string | null>(null)
  const [failedApply, setFailedApply] = useState<{ proposalId: string; retry: () => void } | null>(null)
  const [swapChoice, setSwapChoice] = useState<{ proposalId: string; actionId?: string; fromExerciseId: string; reason: string; options: SwapOption[] } | null>(null)
  const [shareDraft, setShareDraft] = useState<{ proposalId: string; actionId?: string; text: string; pr: { lift: string; weight: string }; scope: CommunityScope } | null>(null)

  const [text, setText] = useState('')
  const [typing, setTyping] = useState(false)
  const [focused, setFocused] = useState(false)
  const [replyingTo, setReplyingTo] = useState<{ role: 'user' | 'coach'; text: string } | null>(null)
  const [coachConsented, setCoachConsented] = useState<boolean | null>(null)
  const [retryMsg, setRetryMsg] = useState<string | null>(null)
  const [feedbackGiven, setFeedbackGiven] = useState(false)

  const sendSeqRef = useRef(0)
  const requestKeyRef = useRef<string | null>(null)
  // Shared offset: dragging any row left reveals every row's timestamp together.
  const revealX = useRef(new Animated.Value(0)).current
  const safety = useRef(newSafetySession())

  const messages = state.chat
  const hasHistory = messages.some((m) => m.role === 'user')
  const hasText = text.trim().length > 0
  const coachName = coachDisplayName(state.profile.coachName)

  // One end-of-chat rating (live coach only): shown once the user has exchanged messages and a coach
  // reply exists, recorded best-effort, then dismissed for the rest of this session. A "not helpful"
  // rating is what the review pass turns into a new coach eval case (the accuracy flywheel).
  const showFeedback = hasHistory && messages.some((m) => m.role === 'coach') && !feedbackGiven && !typing && !COACH_SCRIPTED
  const submitFeedback = useCallback((helpful: boolean) => {
    setFeedbackGiven(true)
    void recordCoachFeedback(helpful ? 'helpful' : 'not_helpful')
    toast('Thanks, that helps me improve.')
  }, [toast])

  // Session-scoped affordances drop when the surface is dismissed. A confirmed action left
  // unresolved is terminalised as failed so its journal entry can't sit at pending forever.
  useEffect(() => {
    if (active) return
    if (swapChoice?.actionId) void recordCoachActionOutcome(swapChoice.actionId, 'failed', 'swap_choice_abandoned')
    if (shareDraft?.actionId) void recordCoachActionOutcome(shareDraft.actionId, 'failed', 'share_abandoned')
    setUndoTarget(null); setSwapChoice(null); setShareDraft(null); setApplyingProposalId(null); setFailedApply(null)
  }, [active, swapChoice, shareDraft])

  // Mark coach messages read whenever the thread is on screen and grows.
  useEffect(() => {
    if (active) dispatch({ type: 'MARK_CHAT_READ' })
  }, [active, messages.length, typing, dispatch])

  useEffect(() => {
    if (!active || !coachOperational() || COACH_SCRIPTED) return
    let live = true
    void (async () => {
      const cached = await readCachedCoachWorkspace()
      if (live && cached) setCoachConsented(cached.consentVersion === 1)
      try {
        const workspace = await fetchCoachWorkspace()
        if (live) setCoachConsented(workspace.consentVersion === 1)
      } catch {
        if (live && !cached) setCoachConsented(false)
      }
      void flushCoachActionOutcomeOutbox()
    })()
    return () => { live = false }
  }, [active])

  const send = useCallback(async (t?: string, opts?: { resend?: boolean }) => {
    if (!coachOperational() && !COACH_SCRIPTED) return
    const msg = (t ?? text).trim()
    if (!msg || typing) return
    const replyTo = replyingTo ?? undefined
    setText('')
    setReplyingTo(null)
    if (!opts?.resend) dispatch({ type: 'PUSH_CHAT', role: 'user', text: msg, replyTo })

    // Scripted mode (dev preview / no-backend demo): reply with the on-device canned coach ONLY —
    // never the live AI or the safety classifier (both stay gated) — so the coach is usable without a
    // backend for design work. In a real build firebaseEnabled is true so this branch never runs.
    if (COACH_SCRIPTED) {
      setTyping(true)
      const scripted = coachReply(state, msg)
      setTimeout(() => { dispatch({ type: 'PUSH_CHAT', role: 'coach', text: scripted }); setTyping(false) }, 1100)
      return
    }

    // SAFETY: one shared precheck runs BEFORE any reply — the safety guard first, then the limit —
    // enforcing identically on the live-AI and fallback paths. A blocked message reaches neither.
    const ctx = coachContext(state)
    const recent = state.chat.slice(-6).map((m) => m.text)
    const pre = await coachPrecheckAsync(msg, ctx, safety.current, state.coachUsage, todayKey, recent)
    if (pre.kind !== 'allow') {
      dispatch({ type: 'PUSH_CHAT', role: 'coach', text: pre.response.text, buttons: pre.response.buttons })
      return
    }
    dispatch({ type: 'BUMP_COACH_USAGE' })
    const seq = ++sendSeqRef.current
    setRetryMsg(null)
    setTyping(true)
    const requestKey = opts?.resend && requestKeyRef.current ? requestKeyRef.current : newCoachRequestKey()
    requestKeyRef.current = requestKey
    try {
      const res = await askCoachServer({ message: msg, requestKey, allowActions: COACH_ACTIONING, timezone: deviceTimezone() ?? undefined, language: coachOutputLanguage(state.settings.language ?? 'en') })
      if (seq !== sendSeqRef.current) return
      dispatch({
        type: 'PUSH_CHAT', role: 'coach', text: res.text,
        ...(res.blocked ? { buttons: res.buttons } : {}),
        mode: res.mode,
        citations: res.citations,
        learnedMemory: res.memory ?? undefined,
        proposal: res.proposal ?? undefined,
      })
      // CITATIONS: never shown inline. Surface the evidence as a quiet FOLLOW-UP only when the user
      // explicitly asked for proof (CLAUDE.md rule).
      if (isProofRequest(msg) && res.citations?.length) {
        dispatch({ type: 'PUSH_CHAT', role: 'coach', text: `Here's what that's based on: ${res.citations.map((c) => c.title).join(' · ')}.` })
      }
    } catch (e: unknown) {
      if (seq !== sendSeqRef.current) return
      const code = String((e as { code?: string })?.code ?? '')
      const detail = String((e as { message?: string })?.message ?? '')
      const isLimit = code.includes('resource-exhausted')
      const isGate = code.includes('failed-precondition') || detail.includes('coach_disabled') || detail.includes('coach_unavailable')
      const isAuth = code.includes('unauthenticated')
      const isTimeout = code.includes('deadline-exceeded') || detail.toLowerCase().includes('timeout')
      const replyText = isLimit
        ? "You've reached today's coach limit — it resets tomorrow. Your message is still here if you want to send it then."
        : isGate
          ? 'The coach is paused right now. Your message is saved here and nothing was lost.'
          : isAuth
            ? 'Please sign in again to keep chatting — your message is still here.'
            : isTimeout
              ? 'That took too long to answer, so I stopped rather than guess. Tap retry and I’ll try again.'
              : "I couldn't reach the coach service just now, so I haven't answered yet — your message is still here. Tap retry when you're back online."
      if (!isLimit && !isGate) setRetryMsg(msg)
      dispatch({ type: 'PUSH_CHAT', role: 'coach', text: replyText, mode: 'safety' })
    } finally {
      if (seq === sendSeqRef.current) setTyping(false)
    }
  }, [text, typing, replyingTo, dispatch, state])

  const cancelPending = useCallback(() => {
    const msg = [...state.chat].reverse().find((m) => m.role === 'user')?.text ?? null
    sendSeqRef.current += 1
    setTyping(false)
    if (msg) setRetryMsg(msg)
  }, [state.chat])

  const commitProgramOutcome = useCallback(async (outcome: Extract<CoachActionOutcome, { apply: 'patch' | 'regen' }>, proposalId: string, actionId?: string) => {
    const backendUser = state.backendUser
    if (!backendUser) return
    const snapshot: ProgramSnapshot = {
      backendUser,
      generatedProgram: state.generatedProgram ?? null,
      programStatus: state.programStatus ?? null,
      programDoc: state.programDoc ?? null,
      workoutInstances: state.workoutInstances,
      plannedPeriods: state.plannedPeriods,
    }
    const uid = user?.uid

    const applyToStore = () => {
      if (outcome.apply === 'patch') {
        dispatch({ type: 'APPLY_COACH_SWAP', backendUser: outcome.nextUser, generatedProgram: outcome.program, workoutInstances: outcome.instances })
      } else {
        dispatch({
          type: 'APPLY_TRAINING_PROFILE',
          profilePatch: deriveLocalProfile(outcome.nextUser),
          backendUser: outcome.nextUser,
          generatedProgram: outcome.program,
          programStatus: outcome.status,
          programDoc: outcome.programDoc,
          workoutInstances: outcome.instances,
        })
      }
    }
    const succeed = (appliedVersion?: number) => {
      setSwapChoice(null); setFailedApply(null)
      setUndoTarget({ proposalId, snapshot, actionId, appliedVersion })
      toast(outcome.message)
      if (actionId) void recordCoachActionOutcome(actionId, 'applied')
    }

    if (!uid || uid === 'local') { applyToStore(); succeed(); return }

    setFailedApply(null)
    setApplyingProposalId(proposalId)
    try {
      const programDocToWrite = outcome.apply === 'patch' ? state.programDoc : outcome.programDoc
      if (programDocToWrite) {
        const newVersion = await commitCoachAction(uid, outcome.nextUser, programDocToWrite, outcome.instances, state.programDoc?.version)
        applyToStore()
        if (newVersion != null) dispatch({ type: 'SET_PROGRAM_VERSION', version: newVersion })
        succeed(newVersion)
      } else {
        await writeBackendUser(uid, outcome.nextUser)
        applyToStore()
        succeed()
      }
    } catch (e: unknown) {
      setApplyingProposalId(null)
      setSwapChoice(null)
      if (e instanceof CoachActionConflictError) {
        toast('Your plan was changed on another device, so I didn’t apply this — reopen the coach and try again.')
        if (actionId) void recordCoachActionOutcome(actionId, 'failed', 'version_conflict')
        return
      }
      setFailedApply({ proposalId, retry: () => { void commitProgramOutcome(outcome, proposalId, actionId) } })
      toast("That didn't save, so I've left your plan unchanged — tap retry to try again.")
      return
    }
    setApplyingProposalId(null)
  }, [state, dispatch, user, toast])

  const commitProfileOutcome = useCallback(async (outcome: Extract<CoachActionOutcome, { apply: 'profile_patch' }>, proposalId: string, actionId?: string) => {
    const patch = outcome.patch as Partial<Profile>
    const uid = user?.uid
    const apply = () => {
      dispatch({ type: 'SET_PROFILE', patch })
      setSwapChoice(null); setFailedApply(null)
      toast(outcome.message)
      if (actionId) void recordCoachActionOutcome(actionId, 'applied')
    }
    if (!uid || uid === 'local') { apply(); return }
    setFailedApply(null); setApplyingProposalId(proposalId)
    try {
      await commitCoachProfilePatch(uid, patch)
      apply()
    } catch {
      setFailedApply({ proposalId, retry: () => { void commitProfileOutcome(outcome, proposalId, actionId) } })
      toast("That didn't save, so I left your target unchanged — tap retry to try again.")
    } finally {
      setApplyingProposalId(null)
    }
  }, [dispatch, toast, user])

  const commitPeriodOutcome = useCallback(async (outcome: Extract<CoachActionOutcome, { apply: 'period' }>, proposalId: string, actionId?: string) => {
    const current = plannedPeriods(state)
    const snapshot: ProgramSnapshot = {
      backendUser: state.backendUser!,
      generatedProgram: state.generatedProgram ?? null,
      programStatus: state.programStatus ?? null,
      programDoc: state.programDoc ?? null,
      workoutInstances: state.workoutInstances,
      plannedPeriods: current,
    }
    const period: PlannedPeriod = {
      ...newPeriodDraft(), id: `coach_${Date.now()}`,
      start: outcome.startDate, end: outcome.endDate,
      mode: periodModeForAbsence(outcome.mode), note: outcome.label,
    }
    const next = [...current.filter((p) => p.id !== period.id), period]
      .sort((a, b) => a.start.localeCompare(b.start))
    const uid = user?.uid
    const apply = () => {
      dispatch({ type: 'SAVE_PERIOD', period })
      setSwapChoice(null); setFailedApply(null)
      setUndoTarget({ proposalId, snapshot, actionId })
      toast(outcome.message)
      if (actionId) void recordCoachActionOutcome(actionId, 'applied')
    }
    if (!uid || uid === 'local') { apply(); return }
    setFailedApply(null); setApplyingProposalId(proposalId)
    try {
      await commitCoachPeriods(uid, next)
      apply()
    } catch {
      setFailedApply({ proposalId, retry: () => { void commitPeriodOutcome(outcome, proposalId, actionId) } })
      toast("That didn't save, so I left your schedule unchanged — tap retry to try again.")
    } finally {
      setApplyingProposalId(null)
    }
  }, [dispatch, state, toast, user])

  const handleProposalConfirmed = useCallback((proposal: CoachActionProposal, actionId?: string) => {
    if (proposal.kind === 'navigation') {
      const overlay = proposal.payload.overlay
      const allowed = ['activeWorkout', 'workout', 'nutrition', 'progress', 'logProgress', 'logWeight', 'logActivity', 'beginner', 'exerciseDetail']
      if (typeof overlay !== 'string' || !allowed.includes(overlay)) return
      if (overlay === 'exerciseDetail') {
        const defId = resolveNavExerciseId(proposal.payload)
        if (defId) nav.open('exerciseDetail', { defId })
        else toast("I couldn't find that exercise to open — try naming the lift as it appears in your program.")
        return
      }
      // The standalone Progress tab is intentionally blank; its progress cards live on the
      // Dashboard, so a coach "show me my progress" navigation goes there instead of a blank screen.
      if (overlay === 'progress') nav.goTab('dashboard')
      else if (overlay === 'workout' || overlay === 'nutrition') nav.goTab(overlay)
      else nav.open(overlay as 'activeWorkout' | 'logProgress' | 'logWeight' | 'logActivity' | 'beginner')
      return
    }

    if (proposal.kind === 'workout_action') {
      if (!COACH_ACTIONING) return
      const backendUser = state.backendUser
      if (!backendUser) { toast("You don't have a program set up yet."); return }

      const outcome = resolveCoachAction(
        { backendUser, program: state.generatedProgram ?? null, instances: state.workoutInstances ?? [], programDoc: state.programDoc ?? null },
        proposal.payload,
      )
      if (!outcome.ok) { toast(outcome.message); if (actionId) void recordCoachActionOutcome(actionId, 'failed', 'resolver_rejected'); return }

      if (outcome.apply === 'navigate') {
        if (outcome.target === 'quickWorkout') nav.open('quick')
        else nav.open(outcome.target)
        toast(outcome.message)
        if (actionId) void recordCoachActionOutcome(actionId, 'applied')
        return
      }
      if (outcome.apply === 'nudge') {
        nav.open(outcome.kind === 'weight' ? 'logWeight' : 'logProgress')
        toast(outcome.message)
        if (actionId) void recordCoachActionOutcome(actionId, 'applied')
        return
      }
      if (outcome.apply === 'profile_patch') {
        void commitProfileOutcome(outcome, proposal.id, actionId)
        return
      }
      if (outcome.apply === 'choose_swap') {
        setUndoTarget(null)
        setSwapChoice({ proposalId: proposal.id, actionId, fromExerciseId: outcome.fromExerciseId, reason: outcome.reason, options: outcome.options })
        toast(outcome.message)
        return
      }
      if (outcome.apply === 'period') {
        void commitPeriodOutcome(outcome, proposal.id, actionId)
        return
      }
      if (outcome.apply === 'share_pr') {
        const pr = recentPR(state)
        if (!pr) { toast("I don't see a fresh PR to celebrate yet — log a session and I'll spot it."); if (actionId) void recordCoachActionOutcome(actionId, 'failed', 'no_pr'); return }
        const weight = fmtWeight(pr.weightKg, state.settings.units)
        const shareText = `New ${pr.name} best — ${weight} for ${pr.reps} reps. Proof that showing up works. 💪`
        setUndoTarget(null); setSwapChoice(null)
        setShareDraft({ proposalId: proposal.id, actionId, text: shareText, pr: { lift: pr.name, weight }, scope: 'campus' })
        toast('Draft ready — publish it when you’re happy.')
        return
      }
      void commitProgramOutcome(outcome, proposal.id, actionId)
    }
  }, [nav, state, toast, commitProgramOutcome, commitProfileOutcome, commitPeriodOutcome])

  const handlePublishShare = useCallback((draft: { actionId?: string; text: string; pr: { lift: string; weight: string }; scope: CommunityScope }) => {
    dispatch({ type: 'ADD_POST', text: draft.text, pr: draft.pr, scope: draft.scope })
    setShareDraft(null)
    toast("Posted to your preview feed — community isn't live yet, so only you can see it for now.")
    if (draft.actionId) void recordCoachActionOutcome(draft.actionId, 'applied')
  }, [dispatch, toast])

  const handleChooseSwap = useCallback((choice: { proposalId: string; actionId?: string; fromExerciseId: string; reason: string }, option: SwapOption) => {
    if (!COACH_ACTIONING) return
    const backendUser = state.backendUser
    if (!backendUser) { toast("You don't have a program set up yet."); return }
    const outcome = applyCoachSwapChoice(
      { backendUser, program: state.generatedProgram ?? null, instances: state.workoutInstances ?? [], programDoc: state.programDoc ?? null },
      choice.fromExerciseId, choice.reason, option.id,
    )
    if (!outcome.ok) { toast(outcome.message); return }
    if (outcome.apply === 'patch') void commitProgramOutcome(outcome, choice.proposalId, choice.actionId)
  }, [state, toast, commitProgramOutcome])

  const handleUndo = useCallback((snapshot: ProgramSnapshot, actionId?: string, appliedVersion?: number) => {
    const uid = user?.uid
    const periodsChanged = JSON.stringify(plannedPeriods(state)) !== JSON.stringify(snapshot.plannedPeriods ?? [])
    const programChanged = JSON.stringify({
      backendUser: state.backendUser,
      generatedProgram: state.generatedProgram,
      programDoc: state.programDoc,
      workoutInstances: state.workoutInstances,
    }) !== JSON.stringify({
      backendUser: snapshot.backendUser,
      generatedProgram: snapshot.generatedProgram,
      programDoc: snapshot.programDoc,
      workoutInstances: snapshot.workoutInstances,
    })
    const persist = async () => {
      if (!uid || uid === 'local') return
      if (programChanged) {
        if (snapshot.programDoc) {
          await commitCoachAction(uid, snapshot.backendUser, snapshot.programDoc, snapshot.workoutInstances ?? [], appliedVersion)
        } else {
          await writeBackendUser(uid, snapshot.backendUser)
        }
      }
      if (periodsChanged) await commitCoachPeriods(uid, snapshot.plannedPeriods ?? [])
    }
    const finish = () => {
      dispatch({ type: 'RESTORE_PROGRAM_SNAPSHOT', snapshot })
      if (actionId) void recordCoachActionOutcome(actionId, 'rolled_back')
      setUndoTarget(null)
      toast('Reverted — your plan is back to how it was.')
    }
    if (!uid || uid === 'local') { finish(); return }
    setApplyingProposalId(undoTarget?.proposalId ?? 'undo')
    void persist()
      .then(finish)
      .catch((e: unknown) => {
        if (e instanceof CoachActionConflictError) {
          toast('Your plan was changed on another device, so I couldn’t undo this here — reopen the coach and try again.')
          return
        }
        toast("That didn't save, so I left the applied change in place — try undo again when you're back online.")
      })
      .finally(() => setApplyingProposalId(null))
  }, [dispatch, user, toast, state, undoTarget])

  return {
    colors,
    coachName,
    messages,
    hasHistory,
    hasText,
    text, setText,
    typing,
    focused, setFocused,
    replyingTo, setReplyingTo,
    retryMsg,
    coachConsented, setCoachConsented,
    revealX,
    send,
    cancelPending,
    handleProposalConfirmed,
    handlePublishShare,
    handleChooseSwap,
    handleUndo,
    undoTarget,
    swapChoice,
    shareDraft,
    applyingProposalId,
    failedApply,
    showFeedback,
    submitFeedback,
  }
}
