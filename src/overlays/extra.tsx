import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { View, Text, Pressable, Image, TextInput, Animated, Easing, ScrollView, FlatList, KeyboardAvoidingView, Platform, PanResponder, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  Sparkles, Check, CheckCheck, ChevronRight, ChevronDown, ChevronLeft, Salad, Trophy, Flame,
  GraduationCap, Dumbbell, Lightbulb, ShieldQuestion, Share2, Plus, MapPin, Phone,
  Send, Video, Lock, Crown, Clock, Repeat, Heart, MessageCircle, Award, Swords, Users, X,
  Search, Minus, Trash2, Play, Activity, Reply, Brain,
} from 'lucide-react-native'
import { Sheet } from '../components/Sheet'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { Chip, ProgressBar } from '../components/ui'
import { TechniqueClip } from '../components/TechniqueClip'
import { posterOverrideUrl } from '../lib/media'
import { useDispatch, useStore } from '../store/store'
import { useToast } from '../components/Toast'
import { useNav } from '../nav'
import {
  BEGINNER_LESSONS, exerciseDetail, REP_TARGETS, BASE_WEIGHTS, SET_TARGETS,
  ACTIVITY_PRESETS, activityPreset, INTENSITY_MULT, EXERCISES, exById,
} from '../data/catalog'
import { useBudgetMeals } from '../data/recipes'
import { useExerciseInfo } from '../data/exerciseInfo'
import { fmtWeight } from '../lib/format'
import { ActivityIcon } from '../components/ActivityIcon'
import { exerciseView, imageForMuscle, buildCustomSession } from '../store/programSession'
import { ACTIVE_EXERCISES, type Exercise } from '../backend/data'
import { nextSetRecommendation } from '../store/training'
import { coachThreadView, recentPR } from '../store/coach'
import { coachReply } from '../lib/coachChat'
import { askCoachServer } from '../lib/coachServer'
import { newCoachRequestKey } from '../lib/coachRequestKey'
import { fetchCoachWorkspace, readCachedCoachWorkspace, respondToCoachProposal } from '../lib/coachWorkspace'
import { useAuth } from '../auth/AuthProvider'
import { writeBackendUser } from '../backend/repo/userRepo'
import { writeActiveProgram } from '../backend/repo/programRepo'
import { resolveCoachAction, applyCoachSwapChoice, type SwapOption, type CoachActionOutcome } from '../backend/runtime/coachActionResolver'
import { deriveLocalProfile } from '../backend/mapping/projection'
import { newPeriodDraft, periodModeForAbsence, plannedPeriods } from '../store/periods'
import { CoachMemoryView } from '../components/CoachMemoryView'
import { coachContext, coachOperational, COACH_PREVIEW, COACH_ACTIONING, coachPrecheckAsync, newSafetySession } from '../lib/coachSafety'
import { SafetyContactButtons } from '../components/SafetyContactButtons'
import { CoachSafetyStrip } from '../components/CoachSafetyStrip'
import { CoachComingSoon } from '../components/CoachComingSoon'
import { todaySession, leaderboardSorted, youRank } from '../store/selectors'
import { relativeLabel, todayKey } from '../lib/date'
import { CHART_METRICS, MAX_DASHBOARD_STATS, STAT_METRICS, STAT_TIMEFRAMES, dashboardStatIds, dashboardTimeframe, progressMetricId } from '../lib/metrics'
import { brand, useColors, accentFor, type AccentKey } from '../theme'
import { AppModal, IS_WEB, WEB_SCREEN } from '../components/WebFrame'
import { thud } from '../lib/haptics'
import type { ReactNode } from 'react'
import type { CoachKind, TemplateExercise, ChatMessage, ProgramSnapshot, PlannedPeriod, CommunityScope } from '../store/types'
import type { CoachActionProposal } from '../backend/coach/contracts'

type Props = { open: boolean; onClose: () => void; params?: Record<string, unknown> }

/* ============================ Your Coach ============================ */
const coachIcon: Record<CoachKind, ReactNode> = {
  checkin: <Sparkles size={16} color={brand[400]} />,
  nudge: <Flame size={16} color={brand[400]} />,
  celebration: <Trophy size={16} color={brand[400]} />,
  exam: <GraduationCap size={16} color={brand[400]} />,
  qa: <ShieldQuestion size={16} color={brand[400]} />,
}

export function CoachSheet({ open, onClose }: Props) {
  const { state } = useStore()
  const nav = useNav()
  const thread = coachThreadView(state)

  if (!coachOperational() && !COACH_PREVIEW) {
    return (
      <Sheet open={open} onClose={onClose} title="Your coach">
        <CoachComingSoon />
      </Sheet>
    )
  }

  return (
    <Sheet open={open} onClose={onClose} title="Your coach">
      <View className="mb-4 flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-3.5">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-brand-400"><Sparkles size={20} color="#000" /></View>
        <View>
          <Text className="font-bold leading-tight text-white">Coach</Text>
          <Text className="text-[12px] text-white/50">Reads your logs. Checks in, not chats.</Text>
        </View>
      </View>

      <View className="gap-3">
        {thread.map((m, i) => (
          <View key={m.id} className={`rounded-2xl border p-4 ${i === 0 ? 'border-brand-400/30 bg-brand-400/5' : 'border-white/5 bg-ink-800'}`}>
            <View className="mb-1 flex-row items-center gap-2">
              <View className="h-6 w-6 items-center justify-center rounded-full bg-white/5">{coachIcon[m.kind]}</View>
              <Text className="font-bold leading-tight text-white">{m.title}</Text>
              <Text className="ml-auto text-[11px] text-white/35">{i === 0 ? 'Today' : relativeLabel(m.dateKey)}</Text>
            </View>
            <Text className="text-[14px] leading-snug text-white/70">{m.body}</Text>
            {m.cta && (
              <Pressable
                onPress={() => nav.open(m.cta!.overlay as Parameters<typeof nav.open>[0])}
                className="mt-3 flex-row items-center gap-1 self-start rounded-full bg-brand-400 px-3.5 py-1.5 active:opacity-90"
              >
                <Text className="text-sm font-bold text-black">{m.cta.label}</Text>
                <ChevronRight size={15} color="#000" />
              </Pressable>
            )}
          </View>
        ))}
      </View>
    </Sheet>
  )
}

/* ====================== New to the Gym track ====================== */
export function BeginnerSheet({ open, onClose }: Props) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const done = state.beginnerProgress
  const total = BEGINNER_LESSONS.length
  const firstUnread = BEGINNER_LESSONS.find((l) => !done.includes(l.id))
  const [openId, setOpenId] = useState<string | null>(firstUnread?.id ?? BEGINNER_LESSONS[0]?.id ?? null)

  const left = total - done.length
  const headline = left === 0 ? 'You have read them all' : 'Your first 90 days'
  const note = left === 0
    ? 'Come back to any of these whenever you want a refresher.'
    : left === total
      ? `${total} short reads. Start wherever you like.`
      : `${left} left · about a minute each`

  return (
    <Sheet open={open} onClose={onClose} full>
      <Text className="text-[25px] font-extrabold tracking-[-0.03em] leading-[1.15] text-white">New to the gym</Text>
      <Text className="mt-2.5 text-[13.5px] leading-5 text-white/55">A calm, step by step path into your first 90 days. Nothing here assumes you know anything yet.</Text>

      <View className="mt-4 rounded-[20px] border border-white/[0.06] bg-ink-800 p-4">
        <View className="flex-row items-center justify-between gap-3">
          <Text className="text-[13px] font-bold text-white">{headline}</Text>
          <Text className="text-[12px] font-bold text-brand-400">{done.length}/{total} read</Text>
        </View>
        <View className="mt-[11px]"><ProgressBar value={(done.length / total) * 100} /></View>
        <Text className="mt-[9px] text-[11.5px] text-white/45">{note}</Text>
      </View>

      <View className="mb-3 mt-[22px] flex-row items-center justify-between px-0.5">
        <Text className="text-[11px] font-bold uppercase tracking-wider text-white/35">The basics</Text>
        <Text className="text-[11.5px] text-white/30">Read in any order</Text>
      </View>

      <View className="gap-2.5">
        {BEGINNER_LESSONS.map((l, i) => {
          const isOpen = openId === l.id
          const isDone = done.includes(l.id)
          const isNext = !isDone && firstUnread?.id === l.id
          return (
            <View key={l.id} className={`overflow-hidden rounded-[20px] border bg-ink-800 ${isDone ? 'border-white/[0.04]' : 'border-white/[0.07]'}`}>
              <Pressable onPress={() => setOpenId(isOpen ? null : l.id)} className="w-full flex-row items-center gap-[13px] p-[15px] active:opacity-90">
                {isDone ? (
                  <View className="h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-brand-400"><Check size={15} strokeWidth={3.4} color="#000" /></View>
                ) : (
                  <View className="h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-white/[0.14]"><Text className="text-[12.5px] font-bold text-white/50">{i + 1}</Text></View>
                )}
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-center gap-1.5">
                    <Text className={`text-[14.5px] font-bold leading-tight ${isDone ? 'text-white/55' : 'text-white'}`}>{l.title}</Text>
                    {isNext && (
                      <View className="rounded-full bg-brand-400/[0.16] px-2 py-0.5">
                        <Text className="text-[9.5px] font-bold uppercase tracking-wide text-brand-300">Start here</Text>
                      </View>
                    )}
                  </View>
                  <Text numberOfLines={1} className="mt-[3px] text-[12px] leading-tight text-white/50">{l.summary}</Text>
                </View>
                <ChevronDown size={17} color="rgba(255,255,255,0.3)" style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }} />
              </Pressable>
              {isOpen && (
                <View className="px-[15px] pb-[15px]">
                  <View className="mb-[13px] h-px bg-white/[0.06]" />
                  <View className="gap-2.5">
                    {l.body.map((para, j) => <Text key={j} className="text-[13.5px] leading-[1.6] text-white/70">{para}</Text>)}
                  </View>
                  {!isDone ? (
                    <Pressable onPress={() => { dispatch({ type: 'COMPLETE_LESSON', id: l.id }); const next = BEGINNER_LESSONS.find((x) => x.id !== l.id && !done.includes(x.id)); setOpenId(next?.id ?? null); toast(next ? 'Read. Next one is open below.' : 'That is the whole guide. Nice work.') }} className="mt-[15px] flex-row items-center justify-center gap-1.5 rounded-full bg-brand-400 py-2.5 active:opacity-90">
                      <Check size={13} strokeWidth={3.2} color="#000" />
                      <Text className="text-[13.5px] font-bold text-black">Mark as read</Text>
                    </Pressable>
                  ) : (
                    <View className="mt-3.5 flex-row items-center gap-1.5">
                      <Check size={13} strokeWidth={3} color={brand[400]} />
                      <Text className="text-[12.5px] font-semibold text-brand-400">Read</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )
        })}
      </View>

      <Text className="mt-5 px-3 text-center text-[12px] leading-[1.55] text-white/35">Nobody is watching you as closely as you think. Take these one at a time.</Text>
    </Sheet>
  )
}

/* ======================== Budget eats ============================= */
export function BudgetEatsSheet({ open, onClose }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  const BUDGET_MEALS = useBudgetMeals()

  return (
    <Sheet open={open} onClose={onClose} title="Easy recipes">
      <View className="rounded-3xl border border-white/8 bg-ink-800 p-5">
        <Salad size={26} color={brand[400]} />
        <Text className="mt-2 text-xl font-extrabold tracking-tight text-white">Tasty, simple, cheap</Text>
        <Text className="mt-1 text-[14px] leading-snug text-white/60">Easy meals with every step laid out. Pick one and cook along.</Text>
      </View>

      <View className="mt-4 gap-2.5">
        {BUDGET_MEALS.map((m) => {
          const isOpen = openId === m.id
          return (
            <View key={m.id} className="overflow-hidden rounded-2xl border border-white/5 bg-ink-800">
              <Pressable onPress={() => setOpenId(isOpen ? null : m.id)} className="w-full flex-row items-center gap-3 p-3 active:opacity-80">
                <Image source={{ uri: m.image }} resizeMode="cover" className="h-14 w-14 rounded-xl" />
                <View className="min-w-0 flex-1">
                  <Text className="font-bold leading-tight text-white">{m.name}</Text>
                  <Text className="text-[12px] text-white/50">{m.minutes} min · serves {m.serves}</Text>
                  <View className="mt-1 flex-row flex-wrap gap-1">{m.tags.slice(0, 2).map((t) => <Chip key={t} color="green">{t}</Chip>)}</View>
                </View>
                <ChevronDown size={18} color="rgba(255,255,255,0.3)" style={{ flexShrink: 0, transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }} />
              </Pressable>
              {isOpen && (
                <View className="gap-3 border-t border-white/5 px-4 py-3">
                  <View>
                    <Text className="mb-1 text-[12px] font-bold uppercase tracking-wide text-white/40">Ingredients</Text>
                    <View className="gap-1">
                      {m.ingredients.map((ing) => (
                        <View key={ing} className="flex-row items-start gap-2">
                          <View className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-400" />
                          <Text className="flex-1 text-[14px] text-white/70">{ing}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <View>
                    <Text className="mb-1 text-[12px] font-bold uppercase tracking-wide text-white/40">Method</Text>
                    <View className="gap-1 pl-1">{m.steps.map((s, i) => <Text key={i} className="text-[14px] text-white/70">{i + 1}. {s}</Text>)}</View>
                  </View>
                  {m.cookOnce && (
                    <View className="flex-row gap-2 rounded-xl bg-brand-400/10 p-3">
                      <Lightbulb size={16} color={brand[400]} style={{ flexShrink: 0 }} />
                      <Text className="flex-1 text-[13px] text-white/70">{m.cookOnce}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )
        })}
      </View>
    </Sheet>
  )
}

/* ===================== Exercise technique ========================= */
export function ExerciseDetailSheet({ open, onClose, params }: Props) {
  const { state } = useStore()
  const units = state.settings.units
  const defId = (params?.defId as string) ?? 'bench'
  const library = !!params?.library
  // Subscribe to the exercise-info overlay so the sheet re-renders if the cloud
  // copy (edited via the workbook) loads after open.
  useExerciseInfo()
  // Resolve the demo catalogue first, then the 113-exercise Database so a generated-program
  // row (backend id like CH02) opens with real technique copy instead of a blank sheet.
  const view = exerciseView(defId)
  const detail = view?.detail ?? exerciseDetail(defId)
  const target = REP_TARGETS[defId] ?? '8-12'
  const sessionEx = todaySession(state)?.exercises.find((e) => e.defId === defId)
  const fallback = sessionEx ? Math.max(...sessionEx.sets.map((s) => s.weightKg)) : BASE_WEIGHTS[defId] ?? 20
  const rec = nextSetRecommendation(state, defId, sessionEx?.targetReps ?? target, fallback)

  const sets = sessionEx?.targetSets ?? SET_TARGETS[defId] ?? 3
  const reps = sessionEx?.targetReps ?? target
  const level = detail.beginnerFriendly ? 'Beginner' : 'Advanced'

  if (!view) return null
  return (
    <Sheet open={open} onClose={onClose} title={view.name}>
      <TechniqueClip exerciseId={defId} poster={posterOverrideUrl(defId) ?? view.image} label="Form clip coming soon" />

      <View className="mt-3 flex-row flex-wrap items-center gap-2">
        <Chip color="gray">{view.muscle}</Chip>
        <Chip color={detail.beginnerFriendly ? 'blue' : 'orange'}>{level}</Chip>
      </View>

      <Text className="mt-4 text-[13.5px] leading-[1.55] text-white/65">{detail.desc}</Text>

      {/* Target + working weight (hidden when browsing the library, no session context). */}
      {!library && (
        <View className="mt-4 flex-row gap-2.5">
          <View className="flex-1 rounded-2xl bg-white/[0.04] px-3.5 py-3">
            <Text className="text-[10.5px] font-bold uppercase tracking-wider text-white/35">Target</Text>
            <Text className="mt-1 text-[14.5px] font-bold text-white">{sets} × {reps} reps</Text>
          </View>
          <View className="flex-1 rounded-2xl bg-white/[0.04] px-3.5 py-3">
            <Text className="text-[10.5px] font-bold uppercase tracking-wider text-white/35">Working weight</Text>
            <Text className="mt-1 text-[14.5px] font-bold text-white">{fmtWeight(fallback, units, units === 'imperial' ? 0 : 1)}</Text>
          </View>
        </View>
      )}

      <Text className="mb-2.5 mt-5 text-[13px] font-bold text-white">How to do it</Text>
      <View className="gap-2.5">
        {detail.cues.map((c, i) => (
          <View key={i} className="flex-row items-start gap-3">
            <View className="h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-brand-400/15"><Text className="text-[11.5px] font-bold text-brand-300">{i + 1}</Text></View>
            <Text className="flex-1 text-[13.5px] leading-[1.5] text-white/80">{c}</Text>
          </View>
        ))}
      </View>

      <View className="mt-[18px] rounded-2xl border border-accent-orange/20 bg-accent-orange/[0.07] p-3">
        <Text className="text-[11px] font-bold uppercase tracking-wider text-accent-orange">Common mistake</Text>
        <Text className="mt-[5px] text-[13px] leading-[1.5] text-white/70">{detail.commonMistake}</Text>
      </View>

      <View className="mt-2.5 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
        <Text className="text-[11px] font-bold uppercase tracking-wider text-white/40">If the station is taken</Text>
        <Text className="mt-[5px] text-[13px] leading-[1.5] text-white/70">{detail.ifTaken}</Text>
      </View>

      {!library && rec.hasHistory && (
        <View className="mt-2.5 flex-row gap-2.5 rounded-2xl border border-brand-400/20 bg-brand-400/5 p-3.5">
          <Sparkles size={18} color={brand[400]} style={{ flexShrink: 0 }} />
          <View className="flex-1">
            <Text className="text-[13px] font-bold text-brand-400">Coach's call next time</Text>
            <Text className="text-[13px] leading-snug text-white/70">{rec.reason}</Text>
          </View>
        </View>
      )}
    </Sheet>
  )
}

/* ===================== Training partner matcher =================== */
const levelLabel: Record<string, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' }

export function PartnerMatchSheet({ open, onClose }: Props) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const candidates = [...state.partners].sort((a, b) => b.matchPct - a.matchPct)

  return (
    <Sheet open={open} onClose={onClose} title="Find a training partner">
      <View className="rounded-3xl border border-white/8 bg-ink-800 p-5">
        <MapPin size={24} color={brand[400]} />
        <Text className="mt-2 text-xl font-extrabold tracking-tight text-white">People on your campus</Text>
        <Text className="mt-1 text-[14px] leading-snug text-white/60">Matched by your hall, level and goal. Training with someone at your stage is the easiest way to keep showing up.</Text>
      </View>

      <View className="mt-4 gap-2.5">
        {candidates.map((c) => {
          const sameDorm = c.dorm === state.profile.dorm
          return (
            <View key={c.id} className="rounded-2xl border border-white/5 bg-ink-800 p-3.5">
              <View className="flex-row items-center gap-3">
                <Avatar name={c.name} size={44} />
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="font-bold leading-tight text-white">{c.name}</Text>
                    {sameDorm && <Chip color="green">Your hall</Chip>}
                  </View>
                  <Text className="text-[12px] text-white/50">{levelLabel[c.level]} · {c.dorm}</Text>
                </View>
                <View className="items-end">
                  <Text className="font-extrabold text-brand-400">{c.matchPct}%</Text>
                  <Text className="text-[10px] text-white/40">match</Text>
                </View>
              </View>
              <Text className="mt-2 text-[13px] leading-snug text-white/65">{c.blurb}</Text>
              <Text className="mt-1 text-[12px] text-white/40">Free: {c.availability}</Text>
              <Pressable
                onPress={() => { dispatch({ type: 'CONNECT_PARTNER', id: c.id }); toast(c.connected ? 'Preview request cancelled' : 'Preview only — partner matching isn’t live yet, no request was sent') }}
                className={`mt-3 w-full items-center rounded-full py-2.5 active:opacity-90 ${c.connected ? 'bg-ink-700' : 'bg-brand-400'}`}
              >
                <Text className={`text-sm font-bold ${c.connected ? 'text-white/70' : 'text-black'}`}>{c.connected ? 'Request sent' : 'Connect'}</Text>
              </Pressable>
            </View>
          )
        })}
      </View>
    </Sheet>
  )
}

/* ====================== PR celebration =========================== */
export function PRCelebrationSheet({ open, onClose, params }: Props) {
  const dispatch = useDispatch()
  const toast = useToast()
  const lift = (params?.lift as string) ?? 'a lift'
  const weight = (params?.weight as string) ?? ''
  const reps = (params?.reps as number) ?? 0

  function share() {
    dispatch({ type: 'ADD_POST', text: `New ${lift} best, ${weight} for ${reps}. Proof that turning up works.` })
    toast('Shared to your campus feed')
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Personal best">
      <View className="items-center py-4">
        <View className="h-20 w-20 items-center justify-center rounded-3xl bg-brand-400">
          <Trophy size={38} color="#000" />
        </View>
        <Text className="mt-5 text-[13px] font-semibold uppercase tracking-wide text-brand-400">New personal best</Text>
        <Text className="mt-1 text-3xl font-extrabold tracking-tight text-white">{lift}</Text>
        <Text className="mt-1 text-lg font-bold text-white/80">{weight} for {reps} reps</Text>
        <Text className="mt-3 max-w-[260px] text-center text-[14px] leading-snug text-white/55">That is the strongest you have logged on this lift. Quietly huge. Your cohort would love to see it.</Text>
      </View>
      <Pressable onPress={share} className="btn-primary w-full flex-row items-center justify-center gap-1.5 active:opacity-90"><Share2 size={16} color="#000" /><Text className="font-semibold text-black">Share with your cohort</Text></Pressable>
      <Pressable onPress={onClose} className="mt-2 w-full items-center rounded-full bg-ink-700 py-3 active:opacity-90"><Text className="text-sm font-semibold text-white/70">Keep it to myself</Text></Pressable>
    </Sheet>
  )
}

/* ===================== Coach messenger (1:1 chat) ================== */

// Suggestion topics for the empty-thread grid (design: category + coloured dot).
const COACH_TOPICS: { label: string; cat: string; tone: 'green' | 'orange' | 'blue' | 'purple' }[] = [
  { label: 'Why did I train chest today?', cat: 'Training', tone: 'green' },
  { label: 'Why do I feel so sore?', cat: 'Recovery', tone: 'orange' },
  { label: 'Am I on track for my goal?', cat: 'Progress', tone: 'blue' },
  { label: 'What should I eat tonight?', cat: 'Nutrition', tone: 'purple' },
]

function toneColorFor(tone: 'green' | 'orange' | 'blue' | 'purple', c: ReturnType<typeof useColors>): string {
  return tone === 'green' ? c.brand400 : tone === 'orange' ? c.accentOrange : tone === 'blue' ? c.accentBlue : c.accentPurple
}

/** Hex → rgba so the theme's --fg / --brand can be tinted at low opacity (RN can't do CSS-var alpha). */
function withAlpha(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

/* Three bouncing dots while the coach "types" (Animated loop, no CSS). */
function TypingDots() {
  const dots = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current
  useEffect(() => {
    const loops = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(d, { toValue: -4, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(d, { toValue: 0, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.delay((dots.length - 1 - i) * 150),
        ]),
      ),
    )
    loops.forEach((l) => l.start())
    return () => loops.forEach((l) => l.stop())
  }, [dots])
  return (
    <View className="flex-row justify-start">
      <View className="flex-row items-center gap-1.5 rounded-[18px] bg-ink-800 px-4 py-3.5">
        {dots.map((d, i) => (
          <Animated.View key={i} style={{ transform: [{ translateY: d }] }} className="h-[7px] w-[7px] rounded-full bg-white/45" />
        ))}
      </View>
    </View>
  )
}

/**
 * One message row. Adopts the design's two swipe gestures on core PanResponder:
 *   • drag LEFT  → reveal every row's timestamp (a SHARED offset so the whole
 *     thread shifts together, like iMessage).
 *   • drag RIGHT → reply to this message (a reply glyph fades in; past the
 *     threshold it arms the reply banner). Vertical scroll still passes through.
 */
function CoachMessageRow({ m, revealX, colors, onReply, onProposalConfirmed, undoActive, onUndo, swapOptions, onChooseSwap, shareText, onPublishShare, onCancelShare }: {
  m: ChatMessage
  revealX: Animated.Value
  colors: ReturnType<typeof useColors>
  onReply: (m: ChatMessage) => void
  onProposalConfirmed: (proposal: CoachActionProposal) => void
  /** Coach Capability Plan: true while this action's undo window is open. */
  undoActive?: boolean
  onUndo?: () => void
  /** Coach Capability Plan: alternatives to choose from for a multi-option swap. */
  swapOptions?: SwapOption[]
  onChooseSwap?: (option: SwapOption) => void
  /** Coach Capability Plan: a drafted PR post awaiting the second (publish) confirm. */
  shareText?: string
  onPublishShare?: () => void
  onCancelShare?: () => void
}) {
  const user = m.role === 'user'
  const [proposalStatus, setProposalStatus] = useState(m.proposal?.status ?? null)
  const [resolvingProposal, setResolvingProposal] = useState(false)
  const replyX = useRef(new Animated.Value(0)).current
  const iconOpacity = useRef(new Animated.Value(0)).current
  const enter = useRef(new Animated.Value(0)).current
  const mode = useRef<null | 'reveal' | 'reply'>(null)
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 300, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: !IS_WEB }).start()
  }, [enter])

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > Math.abs(g.dy) * 1.4 && Math.abs(g.dx) > 8,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => { mode.current = null },
      onPanResponderMove: (_e, g) => {
        if (!mode.current) {
          if (Math.abs(g.dx) < 6) return
          mode.current = g.dx < 0 ? 'reveal' : 'reply'
        }
        if (mode.current === 'reveal') {
          revealX.setValue(Math.max(g.dx, -72))
        } else {
          const off = Math.min(Math.max(g.dx, 0), 80)
          replyX.setValue(off)
          iconOpacity.setValue(Math.min(off / 48, 1))
        }
      },
      onPanResponderRelease: (_e, g) => {
        if (mode.current === 'reveal') {
          Animated.spring(revealX, { toValue: 0, tension: 120, friction: 14, useNativeDriver: !IS_WEB }).start()
        } else if (mode.current === 'reply') {
          if (g.dx >= 48) { thud(); onReply(m) }
          Animated.spring(replyX, { toValue: 0, tension: 120, friction: 14, useNativeDriver: !IS_WEB }).start()
          Animated.timing(iconOpacity, { toValue: 0, duration: 150, useNativeDriver: !IS_WEB }).start()
        }
        mode.current = null
      },
      onPanResponderTerminate: () => {
        Animated.spring(revealX, { toValue: 0, tension: 120, friction: 14, useNativeDriver: !IS_WEB }).start()
        Animated.spring(replyX, { toValue: 0, tension: 120, friction: 14, useNativeDriver: !IS_WEB }).start()
        iconOpacity.setValue(0)
        mode.current = null
      },
    }),
  ).current

  const translateX = Animated.add(revealX, replyX)

  const resolveProposal = useCallback(async (decision: 'confirm' | 'reject') => {
    if (!m.proposal || resolvingProposal || proposalStatus !== 'pending') return
    setResolvingProposal(true)
    try {
      const result = await respondToCoachProposal(m.proposal.id, decision)
      setProposalStatus(result.status as CoachActionProposal['status'])
      // Haptics only on a CONFIRMED action (final plan Phase 5) — declining is silent.
      if (decision === 'confirm') { thud(); onProposalConfirmed({ ...m.proposal, status: 'confirmed' }) }
    } catch {
      setProposalStatus('expired')
    } finally {
      setResolvingProposal(false)
    }
  }, [m.proposal, onProposalConfirmed, proposalStatus, resolvingProposal])

  return (
    <Animated.View
      {...pan.panHandlers}
      style={{
        position: 'relative',
        width: '100%',
        alignItems: user ? 'flex-end' : 'flex-start',
        opacity: enter,
        transform: [{ translateX }, { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
      }}
    >
      {/* Reply glyph, off the left edge — revealed by a rightward drag. */}
      <Animated.View pointerEvents="none" style={{ position: 'absolute', right: '100%', top: 0, bottom: 0, justifyContent: 'center', paddingRight: 10, opacity: iconOpacity }}>
        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: withAlpha(colors.brand400, 0.18), alignItems: 'center', justifyContent: 'center' }}>
          <Reply size={16} color={colors.brand400} strokeWidth={2} />
        </View>
      </Animated.View>

      {/* Quoted message this one replies to. */}
      {m.replyTo && (
        <View style={{ maxWidth: '72%', backgroundColor: withAlpha(colors.fg, 0.06), borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 4 }}>
          <Text style={{ fontSize: 10.5, fontWeight: '700', color: withAlpha(colors.fg, 0.5), marginBottom: 1 }}>{m.replyTo.role === 'user' ? 'You' : 'Coach'}</Text>
          <Text numberOfLines={2} style={{ fontSize: 12, lineHeight: 16, color: withAlpha(colors.fg, 0.55) }}>{m.replyTo.text}</Text>
        </View>
      )}

      {/* Bubble. */}
      <View style={{ maxWidth: '82%', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 18, backgroundColor: user ? colors.brand400 : colors.ink800 }}>
        <Text style={{ fontSize: 15, lineHeight: 22, color: user ? '#0a0a0b' : colors.fg, fontWeight: user ? '500' : '400' }}>{m.text}</Text>
        {m.role === 'coach' && m.buttons && <SafetyContactButtons buttons={m.buttons} />}
        {m.role === 'coach' && m.mode && m.mode !== 'safety' && (
          <Text style={{ marginTop: 8, fontSize: 10.5, fontWeight: '700', color: withAlpha(colors.fg, 0.38) }}>
            {m.mode === 'personalised' ? 'BASED ON YOUR STRENGTHHUB DATA' : m.mode === 'app_help' ? 'STRENGTHHUB HELP' : 'GENERAL GUIDANCE'}
          </Text>
        )}
        {/* Citations: quiet, and only worth surfacing for evidence-dependent claims (Phase 5). */}
        {m.role === 'coach' && !!m.citations?.length && (
          <Text style={{ marginTop: 5, fontSize: 10.5, lineHeight: 15, color: withAlpha(colors.fg, 0.38) }}>
            Source: {m.citations.map((citation) => citation.title).join(' · ')}
          </Text>
        )}
        {/* Memory: a quiet, natural confirmation, not a loud badge (Phase 5). Manage/remove lives in
            the coach memory view. */}
        {m.role === 'coach' && m.learnedMemory && (
          <View style={{ marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Check size={12} color={withAlpha(colors.fg, 0.4)} strokeWidth={2.4} />
            <Text style={{ flex: 1, fontSize: 11.5, lineHeight: 16, color: withAlpha(colors.fg, 0.5) }}>
              I'll keep that in mind{m.learnedMemory.value ? ` — ${m.learnedMemory.value}` : ''}.
            </Text>
          </View>
        )}
        {m.role === 'coach' && m.proposal && (
          <View style={{ marginTop: 10, borderRadius: 14, borderWidth: 1, borderColor: withAlpha(colors.brand400, 0.2), padding: 11 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.fg }}>{m.proposal.title}</Text>
            <Text style={{ marginTop: 3, fontSize: 12, lineHeight: 17, color: withAlpha(colors.fg, 0.55) }}>{m.proposal.summary}</Text>
            {proposalStatus === 'pending' ? (
              <View style={{ marginTop: 9, flexDirection: 'row', gap: 8 }}>
                <Pressable disabled={resolvingProposal} onPress={() => void resolveProposal('confirm')} style={({ pressed }) => ({ minHeight: 44, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.brand400, opacity: resolvingProposal ? 0.5 : pressed ? 0.75 : 1 })}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#0a0a0b' }}>{resolvingProposal ? 'Saving…' : 'Confirm'}</Text>
                </Pressable>
                <Pressable disabled={resolvingProposal} onPress={() => void resolveProposal('reject')} style={({ pressed }) => ({ minHeight: 44, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: withAlpha(colors.fg, 0.07), opacity: pressed ? 0.65 : 1 })}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: withAlpha(colors.fg, 0.7) }}>Not now</Text>
                </Pressable>
              </View>
            ) : proposalStatus === 'confirmed' && shareText && onPublishShare ? (
              // Coach Capability Plan: outward PR post — show the draft and require a second,
              // explicit publish tap before anything leaves the app.
              <View style={{ marginTop: 9, gap: 8 }}>
                <View style={{ borderRadius: 12, backgroundColor: withAlpha(colors.fg, 0.05), padding: 10 }}>
                  <Text style={{ fontSize: 12, lineHeight: 17, color: colors.fg }}>{shareText}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable onPress={onPublishShare} style={({ pressed }) => ({ minHeight: 44, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.brand400, opacity: pressed ? 0.75 : 1 })}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#0a0a0b' }}>Publish to feed</Text>
                  </Pressable>
                  <Pressable onPress={onCancelShare} style={({ pressed }) => ({ minHeight: 44, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: withAlpha(colors.fg, 0.07), opacity: pressed ? 0.65 : 1 })}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: withAlpha(colors.fg, 0.7) }}>Not now</Text>
                  </Pressable>
                </View>
              </View>
            ) : proposalStatus === 'confirmed' && swapOptions && onChooseSwap ? (
              // Coach Capability Plan: a swap with ≥2 alternatives — the user picks one.
              <View style={{ marginTop: 9, gap: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: withAlpha(colors.fg, 0.45) }}>Pick a replacement</Text>
                {swapOptions.map((option) => (
                  <Pressable key={option.id} onPress={() => onChooseSwap(option)} style={({ pressed }) => ({ minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: withAlpha(colors.brand400, 0.35), paddingVertical: 9, paddingHorizontal: 12, backgroundColor: withAlpha(colors.brand400, pressed ? 0.16 : 0.08) })}>
                    <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.fg }}>{option.name}</Text>
                    {!!option.muscleGroup && <Text style={{ marginTop: 1, fontSize: 11, color: withAlpha(colors.fg, 0.5) }}>{option.muscleGroup}</Text>}
                  </Pressable>
                ))}
              </View>
            ) : proposalStatus === 'confirmed' && undoActive && onUndo ? (
              // Coach Capability Plan: the change is applied — offer a one-tap revert while
              // the undo window is open.
              <View style={{ marginTop: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.brand400 }}>Applied</Text>
                <Pressable onPress={onUndo} hitSlop={8} style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 12, backgroundColor: withAlpha(colors.fg, 0.07), opacity: pressed ? 0.65 : 1 })}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: withAlpha(colors.fg, 0.7) }}>Undo</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={{ marginTop: 8, fontSize: 11.5, fontWeight: '700', color: proposalStatus === 'confirmed' ? colors.brand400 : withAlpha(colors.fg, 0.4) }}>
                {proposalStatus === 'confirmed' ? 'Confirmed' : proposalStatus === 'rejected' ? 'Not now' : 'Proposal expired'}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Timestamp, off the right edge — revealed by a leftward drag. */}
      <View pointerEvents="none" style={{ position: 'absolute', left: '100%', top: 0, bottom: 0, justifyContent: 'center', paddingLeft: 20 }}>
        <Text numberOfLines={1} style={{ fontSize: 12, color: withAlpha(colors.fg, 0.4) }}>{m.time}</Text>
      </View>
    </Animated.View>
  )
}

export function CoachChatSheet({ open, onClose }: Props) {
  const { state, dispatch } = useStore()
  const nav = useNav()
  const { user } = useAuth()
  const toast = useToast()
  const colors = useColors()
  // Coach Capability Plan: the most recent coach-actioned change, kept so the user can UNDO
  // it from its proposal card. One-level (last action) undo; cleared when the sheet closes.
  const [undoTarget, setUndoTarget] = useState<{ proposalId: string; snapshot: ProgramSnapshot } | null>(null)
  // A pending swap that offered ≥2 alternatives — the user picks one on the proposal card.
  const [swapChoice, setSwapChoice] = useState<{ proposalId: string; fromExerciseId: string; reason: string; options: SwapOption[] } | null>(null)
  // A drafted PR post awaiting the SECOND explicit confirm before it is published (outward).
  const [shareDraft, setShareDraft] = useState<{ proposalId: string; text: string; pr: { lift: string; weight: string }; scope: CommunityScope } | null>(null)
  const insets = useSafeAreaInsets()
  const listRef = useRef<FlatList<ChatMessage>>(null)
  const [text, setText] = useState('')
  const [typing, setTyping] = useState(false)
  const [focused, setFocused] = useState(false)
  const [replyingTo, setReplyingTo] = useState<{ role: 'user' | 'coach'; text: string } | null>(null)
  const [coachConsented, setCoachConsented] = useState<boolean | null>(null)
  const [showMemory, setShowMemory] = useState(false)
  // Failed-turn recovery (audit F-028): the message that failed, for one-tap
  // retry, and a send sequence so Cancel/supersede drops a stale response.
  const [retryMsg, setRetryMsg] = useState<string | null>(null)
  const sendSeqRef = useRef(0)
  // Idempotency key for the in-flight coach turn, reused across retries (audit SA-011).
  const requestKeyRef = useRef<string | null>(null)
  // Shared offset: dragging any row left reveals every row's timestamp together.
  const revealX = useRef(new Animated.Value(0)).current
  // Per-conversation safety state (persistence + retraction across messages, spec §2).
  const safety = useRef(newSafetySession())
  const messages = state.chat
  const hasHistory = messages.some((m) => m.role === 'user')
  const showGrid = !hasHistory && !focused
  const hasText = text.trim().length > 0

  // The undo / swap-choice / share-draft affordances are session-scoped — drop on close.
  useEffect(() => { if (!open) { setUndoTarget(null); setSwapChoice(null); setShareDraft(null) } }, [open])

  // Mark coach messages read whenever the thread is open and grows.
  useEffect(() => {
    if (open) dispatch({ type: 'MARK_CHAT_READ' })
  }, [open, messages.length, typing, dispatch])

  useEffect(() => {
    if (!open || !coachOperational() || COACH_PREVIEW) return
    let active = true
    void (async () => {
      const cached = await readCachedCoachWorkspace()
      if (active && cached) setCoachConsented(cached.consentVersion === 1)
      try {
        const workspace = await fetchCoachWorkspace()
        if (active) setCoachConsented(workspace.consentVersion === 1)
      } catch {
        if (active && !cached) setCoachConsented(false)
      }
    })()
    return () => { active = false }
  }, [open])

  async function send(t?: string, opts?: { resend?: boolean }) {
    if (!coachOperational() && !COACH_PREVIEW) return // HARD gate + server-side kill switch (spec §20).
    const msg = (t ?? text).trim()
    if (!msg || typing) return
    const replyTo = replyingTo ?? undefined
    setText('')
    setReplyingTo(null)
    // Show the user's message immediately (with any reply quote), then a typing
    // indicator. A RETRY re-sends the already-visible message (F-028) — no
    // duplicate bubble.
    if (!opts?.resend) dispatch({ type: 'PUSH_CHAT', role: 'user', text: msg, replyTo })
    // DEV DESIGN PREVIEW only: reply with the on-device scripted coach ONLY — never the live AI or the
    // safety classifier (both stay gated) — so the coach can be redesigned without the crisis detector.
    if (COACH_PREVIEW && !coachOperational()) {
      setTyping(true)
      const scripted = coachReply(state, msg)
      setTimeout(() => { dispatch({ type: 'PUSH_CHAT', role: 'coach', text: scripted }); setTyping(false) }, 1100)
      return
    }
    // SAFETY: one shared precheck runs BEFORE any reply — the safety guard first (a crisis is never
    // gated by the daily limit), then the limit — enforcing identically on the live-AI and fallback
    // paths (spec §2/§7/§21). A blocked message reaches neither the model nor the rules engine.
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
    // Idempotency key (audit SA-011): a fresh key per NEW message, REUSED on a
    // retry of the same message, so a retry returns the first turn server-side
    // rather than paying for a second model call + stored turn.
    const requestKey = opts?.resend && requestKeyRef.current ? requestKeyRef.current : newCoachRequestKey()
    requestKeyRef.current = requestKey
    try {
      // TRUSTED BACKEND coach: the server re-runs the precheck (authoritative), the
      // model call, and the validator, so a modified client can't bypass safety
      // (§4.4). It may BLOCK even though the client's fast precheck allowed the turn.
      const res = await askCoachServer({ message: msg, requestKey, allowActions: COACH_ACTIONING })
      if (seq !== sendSeqRef.current) return // cancelled / superseded — drop stale reply
      // Server already ran guardOutgoing; blocked replies carry crisis buttons.
      dispatch({
        type: 'PUSH_CHAT', role: 'coach', text: res.text,
        ...(res.blocked ? { buttons: res.buttons } : {}),
        mode: res.mode,
        citations: res.citations,
        learnedMemory: res.memory ?? undefined,
        proposal: res.proposal ?? undefined,
      })
    } catch (e: unknown) {
      if (seq !== sendSeqRef.current) return
      // Distinguish WHY it failed (audit F-028) — calm copy per category, the
      // user's message stays in the thread, and a one-tap Retry appears. We
      // never answer training questions without the server-authoritative
      // safety layer, so there is no local fallback answer.
      const code = String((e as { code?: string })?.code ?? '')
      const detail = String((e as { message?: string })?.message ?? '')
      const isLimit = code.includes('resource-exhausted')
      const isGate = code.includes('failed-precondition') || detail.includes('coach_disabled') || detail.includes('coach_unavailable')
      const isAuth = code.includes('unauthenticated')
      const isTimeout = code.includes('deadline-exceeded') || detail.toLowerCase().includes('timeout')
      const text = isLimit
        ? "You've reached today's coach limit — it resets tomorrow. Your message is still here if you want to send it then."
        : isGate
          ? 'The coach is paused right now. Your message is saved here and nothing was lost.'
          : isAuth
            ? 'Please sign in again to keep chatting — your message is still here.'
            : isTimeout
              ? 'That took too long to answer, so I stopped rather than guess. Tap retry and I’ll try again.'
              : "I couldn't reach the coach service just now, so I haven't answered yet — your message is still here. Tap retry when you're back online."
      if (!isLimit && !isGate) setRetryMsg(msg)
      dispatch({ type: 'PUSH_CHAT', role: 'coach', text, mode: 'safety' })
    } finally {
      if (seq === sendSeqRef.current) setTyping(false)
    }
  }

  /** Cancel the in-flight turn (audit F-028): the response, if it ever lands,
   *  is dropped; the user's message stays and can be retried. */
  function cancelPending() {
    const msg = [...state.chat].reverse().find((m) => m.role === 'user')?.text ?? null
    sendSeqRef.current += 1
    setTyping(false)
    if (msg) setRetryMsg(msg)
  }

  // Apply a program-mutating outcome (a swap patch or a full regen): snapshot the current
  // state for undo, dispatch, persist to Firestore (no-op in demo), and arm the undo card.
  const commitProgramOutcome = useCallback((outcome: Extract<CoachActionOutcome, { apply: 'patch' | 'regen' }>, proposalId: string) => {
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
    if (outcome.apply === 'patch') {
      dispatch({ type: 'APPLY_COACH_SWAP', backendUser: outcome.nextUser, generatedProgram: outcome.program, workoutInstances: outcome.instances })
      if (uid && uid !== 'local') {
        void writeBackendUser(uid, outcome.nextUser).catch(() => {})
        // A swap leaves the split/schedule (programDoc) unchanged; persist the updated
        // instances against the existing programDoc when we have it.
        if (state.programDoc) void writeActiveProgram(uid, state.programDoc, outcome.instances).catch(() => {})
      }
    } else {
      // 'regen' — goal / days / session length / deload produced a whole new program.
      dispatch({
        type: 'APPLY_TRAINING_PROFILE',
        profilePatch: deriveLocalProfile(outcome.nextUser),
        backendUser: outcome.nextUser,
        generatedProgram: outcome.program,
        programStatus: outcome.status,
        programDoc: outcome.programDoc,
        workoutInstances: outcome.instances,
      })
      if (uid && uid !== 'local') {
        void writeBackendUser(uid, outcome.nextUser).catch(() => {})
        void writeActiveProgram(uid, outcome.programDoc, outcome.instances).catch(() => {})
      }
    }
    thud()
    setSwapChoice(null)
    setUndoTarget({ proposalId, snapshot })
    toast(outcome.message)
  }, [state, dispatch, user, toast])

  const handleProposalConfirmed = useCallback((proposal: CoachActionProposal) => {
    if (proposal.kind === 'navigation') {
      const overlay = proposal.payload.overlay
      const allowed = ['activeWorkout', 'workout', 'nutrition', 'progress', 'logHabit', 'logWeight', 'logActivity', 'budgetEats', 'beginner']
      if (typeof overlay !== 'string' || !allowed.includes(overlay)) return
      if (overlay === 'workout' || overlay === 'nutrition' || overlay === 'progress') nav.goTab(overlay)
      else nav.open(overlay as 'activeWorkout' | 'logHabit' | 'logWeight' | 'logActivity' | 'budgetEats' | 'beginner')
      return
    }

    // Coach Capability Plan: a confirmed workout_action runs the deterministic engine
    // (which re-clamps against the Safety Rules) and applies the result to the store,
    // then persists and offers an undo. Gated by COACH_ACTIONING — a no-op when off.
    if (proposal.kind === 'workout_action') {
      if (!COACH_ACTIONING) return
      const backendUser = state.backendUser
      if (!backendUser) { toast("You don't have a program set up yet."); return }

      const outcome = resolveCoachAction(
        { backendUser, program: state.generatedProgram ?? null, instances: state.workoutInstances ?? [], programDoc: state.programDoc ?? null },
        proposal.payload,
      )
      if (!outcome.ok) { toast(outcome.message); return }

      // Navigation / nudge outcomes change no program state — just route + inform.
      if (outcome.apply === 'navigate') {
        if (outcome.target === 'quickWorkout') nav.open('quick')
        else nav.open(outcome.target)
        toast(outcome.message)
        return
      }
      if (outcome.apply === 'nudge') {
        nav.open(outcome.kind === 'weight' ? 'logWeight' : 'logHabit')
        toast(outcome.message)
        return
      }
      // A swap with ≥2 alternatives — let the user pick one on the card.
      if (outcome.apply === 'choose_swap') {
        setUndoTarget(null)
        setSwapChoice({ proposalId: proposal.id, fromExerciseId: outcome.fromExerciseId, reason: outcome.reason, options: outcome.options })
        toast(outcome.message)
        return
      }
      // Declare a busy period / exam mode via the existing periods store.
      if (outcome.apply === 'period') {
        const snapshot: ProgramSnapshot = {
          backendUser,
          generatedProgram: state.generatedProgram ?? null,
          programStatus: state.programStatus ?? null,
          programDoc: state.programDoc ?? null,
          workoutInstances: state.workoutInstances,
          // Effective list (handles legacy exam dates) so undo restores exactly, even from none.
          plannedPeriods: plannedPeriods(state),
        }
        const period: PlannedPeriod = {
          ...newPeriodDraft(),
          id: `coach_${Date.now()}`,
          start: outcome.startDate,
          end: outcome.endDate,
          mode: periodModeForAbsence(outcome.mode),
          note: outcome.label,
        }
        dispatch({ type: 'SAVE_PERIOD', period })
        thud()
        setSwapChoice(null)
        setUndoTarget({ proposalId: proposal.id, snapshot })
        toast(outcome.message)
        return
      }
      // OUTWARD: draft a PR post grounded in a REAL logged PR; require a second explicit confirm.
      if (outcome.apply === 'share_pr') {
        const pr = recentPR(state)
        if (!pr) { toast("I don't see a fresh PR to celebrate yet — log a session and I'll spot it."); return }
        const weight = fmtWeight(pr.weightKg, state.settings.units)
        const text = `New ${pr.name} best — ${weight} for ${pr.reps} reps. Proof that showing up works. 💪`
        setUndoTarget(null); setSwapChoice(null)
        setShareDraft({ proposalId: proposal.id, text, pr: { lift: pr.name, weight }, scope: 'campus' })
        toast('Draft ready — publish it when you’re happy.')
        return
      }
      // patch / regen — apply, persist and arm undo.
      commitProgramOutcome(outcome, proposal.id)
    }
  }, [nav, state, dispatch, toast, commitProgramOutcome])

  // The SECOND confirm for an outward PR post: publish it (community is a local preview feed today).
  const handlePublishShare = useCallback((draft: { text: string; pr: { lift: string; weight: string }; scope: CommunityScope }) => {
    dispatch({ type: 'ADD_POST', text: draft.text, pr: draft.pr, scope: draft.scope })
    setShareDraft(null)
    thud()
    toast("Posted to your preview feed — community isn't live yet, so only you can see it for now.")
  }, [dispatch, toast])

  // The user picked one of the offered swap alternatives — apply that specific option.
  const handleChooseSwap = useCallback((choice: { proposalId: string; fromExerciseId: string; reason: string }, option: SwapOption) => {
    if (!COACH_ACTIONING) return
    const backendUser = state.backendUser
    if (!backendUser) { toast("You don't have a program set up yet."); return }
    const outcome = applyCoachSwapChoice(
      { backendUser, program: state.generatedProgram ?? null, instances: state.workoutInstances ?? [], programDoc: state.programDoc ?? null },
      choice.fromExerciseId, choice.reason, option.id,
    )
    if (!outcome.ok) { toast(outcome.message); return }
    if (outcome.apply === 'patch') commitProgramOutcome(outcome, choice.proposalId)
  }, [state, toast, commitProgramOutcome])

  // Undo the last coach-actioned change: restore the snapshot and re-persist the prior docs.
  const handleUndo = useCallback((snapshot: ProgramSnapshot) => {
    dispatch({ type: 'RESTORE_PROGRAM_SNAPSHOT', snapshot })
    const uid = user?.uid
    if (uid && uid !== 'local') {
      void writeBackendUser(uid, snapshot.backendUser).catch(() => {})
      if (snapshot.programDoc) void writeActiveProgram(uid, snapshot.programDoc, snapshot.workoutInstances ?? []).catch(() => {})
    }
    setUndoTarget(null)
    thud()
    toast('Reverted — your plan is back to how it was.')
  }, [dispatch, user, toast])

  const renderMessage = useCallback(({ item, index }: { item: ChatMessage; index: number }) => {
    const showDay = index === 0 || messages[index - 1]?.dateKey !== item.dateKey
    const rowUndo = undoTarget && item.proposal && undoTarget.proposalId === item.proposal.id ? undoTarget : null
    const rowChoice = swapChoice && item.proposal && swapChoice.proposalId === item.proposal.id ? swapChoice : null
    const rowShare = shareDraft && item.proposal && shareDraft.proposalId === item.proposal.id ? shareDraft : null
    return (
      <View style={{ gap: 12 }}>
        {showDay && (
          <View style={{ alignItems: 'center', paddingVertical: 2 }}>
            <Text style={{ fontSize: 11.5, color: withAlpha(colors.fg, 0.4) }}>
              <Text style={{ fontWeight: '700', color: withAlpha(colors.fg, 0.55) }}>{relativeLabel(item.dateKey)}</Text>  {item.time}
            </Text>
          </View>
        )}
        <CoachMessageRow
          m={item}
          revealX={revealX}
          colors={colors}
          onReply={(message) => setReplyingTo({ role: message.role, text: message.text })}
          onProposalConfirmed={handleProposalConfirmed}
          undoActive={!!rowUndo}
          onUndo={rowUndo ? () => handleUndo(rowUndo.snapshot) : undefined}
          swapOptions={rowChoice ? rowChoice.options : undefined}
          onChooseSwap={rowChoice ? (option) => handleChooseSwap(rowChoice, option) : undefined}
          shareText={rowShare ? rowShare.text : undefined}
          onPublishShare={rowShare ? () => handlePublishShare(rowShare) : undefined}
          onCancelShare={rowShare ? () => { setShareDraft(null); toast('No worries — nothing was posted.') } : undefined}
        />
      </View>
    )
  }, [colors, handleProposalConfirmed, handleUndo, handleChooseSwap, handlePublishShare, toast, messages, revealX, undoTarget, swapChoice, shareDraft])

  if (!coachOperational() && !COACH_PREVIEW) {
    return (
      <Sheet open={open} onClose={onClose} title="Coach">
        <CoachComingSoon />
      </Sheet>
    )
  }

  if (!COACH_PREVIEW && (showMemory || coachConsented !== true)) {
    return (
      <Sheet open={open} onClose={onClose} title="Coach profile" full bare>
        <CoachMemoryView
          onClose={() => coachConsented ? setShowMemory(false) : onClose()}
          onConsentChanged={setCoachConsented}
        />
      </Sheet>
    )
  }

  return (
    <Sheet open={open} onClose={onClose} title="Coach" full bare>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, paddingTop: insets.top }}>
          {/* Header — centered avatar + name, back arrow on the left */}
          <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: withAlpha(colors.fg, 0.05) }}>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close chat" style={{ position: 'absolute', left: 16, top: 4, width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }} className="active:opacity-60">
              <ChevronLeft size={22} color={colors.fg} strokeWidth={2.2} />
            </Pressable>
            {!COACH_PREVIEW && (
              <Pressable onPress={() => setShowMemory(true)} hitSlop={8} accessibilityLabel="Open coach memory" style={{ position: 'absolute', right: 16, top: 4, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }} className="active:opacity-60">
                <Brain size={20} color={colors.fg} strokeWidth={2} />
              </Pressable>
            )}
            <View style={{ alignItems: 'center', gap: 6 }}>
              <View style={{ width: 40, height: 40 }}>
                <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-400">
                  <Activity size={22} color="#0a0a0b" strokeWidth={2.4} />
                </View>
                <View style={{ position: 'absolute', right: -1, bottom: -1, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.brand400, borderWidth: 2.5, borderColor: colors.ink900 }} />
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.fg }}>Coach</Text>
                <Text style={{ fontSize: 11.5, color: withAlpha(colors.fg, 0.45) }}>Active now</Text>
              </View>
            </View>
          </View>

          {/* Always-on crisis affordance (Option B): persistent, detection-independent access to help */}
          <CoachSafetyStrip isAustralia={coachContext(state).isAustralia} fg={colors.fg} brand={colors.brand400} />

          {/* Thread — fills the space, scrolls, sticks to newest */}
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            className="flex-1"
            contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 8, gap: 12 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListFooterComponent={typing ? <TypingDots /> : null}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          />

          {/* Footer: suggestion grid, reply banner and the input pill (design: padding 10px 18px 12px) */}
          <View style={{ paddingTop: 10, paddingHorizontal: 18, paddingBottom: insets.bottom + 12 }}>
            {showGrid && (
              <View style={{ marginBottom: 12, borderRadius: 18, borderWidth: 1, borderColor: withAlpha(colors.fg, 0.05), backgroundColor: colors.ink800, padding: 14 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.fg }}>What can I help with?</Text>
                <Text style={{ fontSize: 12, color: withAlpha(colors.fg, 0.45), marginTop: 2, marginBottom: 12 }}>Pick a topic or type your own</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {COACH_TOPICS.map((topic) => (
                    <Pressable
                      key={topic.label}
                      onPress={() => send(topic.label)}
                      style={{ width: '48%', gap: 9, backgroundColor: colors.ink700, borderWidth: 1, borderColor: withAlpha(colors.fg, 0.06), borderRadius: 14, padding: 12 }}
                      className="active:opacity-80"
                    >
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: toneColorFor(topic.tone, colors) }} />
                      <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase', color: withAlpha(colors.fg, 0.4) }}>{topic.cat}</Text>
                      <Text style={{ fontSize: 13, lineHeight: 17.5, color: colors.fg }}>{topic.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {typing && (
              <Pressable
                onPress={cancelPending}
                accessibilityRole="button"
                accessibilityLabel="Cancel waiting for the coach"
                style={{ alignSelf: 'center', marginBottom: 10, paddingVertical: 7, paddingHorizontal: 16, borderRadius: 999, backgroundColor: withAlpha(colors.fg, 0.08) }}
                className="active:opacity-70"
              >
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: withAlpha(colors.fg, 0.65) }}>Cancel</Text>
              </Pressable>
            )}
            {!typing && retryMsg && (
              <Pressable
                onPress={() => void send(retryMsg, { resend: true })}
                accessibilityRole="button"
                accessibilityLabel="Retry your last message"
                style={{ alignSelf: 'center', marginBottom: 10, paddingVertical: 7, paddingHorizontal: 16, borderRadius: 999, backgroundColor: withAlpha(colors.brand400, 0.14), borderWidth: 1, borderColor: withAlpha(colors.brand400, 0.4) }}
                className="active:opacity-80"
              >
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.brand400 }}>Retry last message</Text>
              </Pressable>
            )}
            {replyingTo && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, paddingVertical: 8, paddingLeft: 10, paddingRight: 8, backgroundColor: colors.ink800, borderRadius: 12, borderLeftWidth: 3, borderLeftColor: colors.brand400 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.brand400, marginBottom: 1 }}>Replying to {replyingTo.role === 'user' ? 'You' : 'Coach'}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 12.5, color: withAlpha(colors.fg, 0.6) }}>{replyingTo.text}</Text>
                </View>
                <Pressable onPress={() => setReplyingTo(null)} hitSlop={6} style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(colors.fg, 0.08) }} className="active:opacity-70">
                  <X size={14} color={withAlpha(colors.fg, 0.6)} />
                </Pressable>
              </View>
            )}

            {/* Input — a single rounded pill with the send button inside */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: withAlpha(colors.fg, 0.1), backgroundColor: colors.ink800, borderRadius: 22, paddingLeft: 14, paddingRight: 6, paddingVertical: 6 }}>
              <TextInput
                value={text}
                onChangeText={setText}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                multiline
                placeholder="Message your coach…"
                placeholderTextColor={withAlpha(colors.fg, 0.38)}
                onSubmitEditing={() => send()}
                style={{ flex: 1, maxHeight: 112, paddingVertical: 6, fontSize: 15, color: colors.fg }}
              />
              <Pressable onPress={() => send()} disabled={!hasText || typing} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: hasText ? colors.brand400 : withAlpha(colors.fg, 0.1) }} className="active:opacity-90">
                <Send size={19} color={hasText ? '#0a0a0b' : withAlpha(colors.fg, 0.35)} />
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Sheet>
  )
}

/* ===================== Log a self-chosen activity ================= */
export function LogActivitySheet({ open, onClose }: Props) {
  const dispatch = useDispatch()
  const toast = useToast()
  const [key, setKey] = useState('run')
  const [customName, setCustomName] = useState('')
  const [minutes, setMinutes] = useState('30')
  const [intensity, setIntensity] = useState<'easy' | 'moderate' | 'hard'>('moderate')
  const [weekly, setWeekly] = useState(false)

  const preset = activityPreset(key) ?? ACTIVITY_PRESETS[0]
  const isCustom = key === 'other'
  const name = isCustom ? customName.trim() || 'Activity' : preset.name
  const mins = parseInt(minutes) || 0
  const kcal = Math.round(mins * preset.kcalPerMin * INTENSITY_MULT[intensity])

  function save() {
    if (mins <= 0) { toast('Add a duration first'); return }
    dispatch({ type: 'ADD_ACTIVITY', activity: { type: key, name, icon: isCustom ? 'other' : key, minutes: mins, intensity, calories: kcal, weekly } })
    toast(`${name} logged`)
    setKey('run'); setCustomName(''); setMinutes('30'); setIntensity('moderate'); setWeekly(false)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Log an activity">
      <Text className="mb-1 text-[12.5px] text-white/50">Anything the app didn't prescribe still counts.</Text>

      <View className="mt-3 flex-row flex-wrap gap-2">
        {ACTIVITY_PRESETS.map((a) => {
          const active = key === a.key
          return (
            <Pressable
              key={a.key}
              onPress={() => setKey(a.key)}
              style={{ width: '22.5%' }}
              className={`items-center gap-1.5 rounded-2xl border py-[11px] active:opacity-90 ${active ? 'border-brand-400 bg-brand-400/[0.12]' : 'border-white/[0.07] bg-white/[0.04]'}`}
            >
              <ActivityIcon name={a.key} size={20} color={active ? brand[400] : 'rgba(255,255,255,0.7)'} />
              <Text className={`text-[10.5px] font-semibold leading-none ${active ? 'text-brand-400' : 'text-white/70'}`}>{a.name}</Text>
            </Pressable>
          )
        })}
      </View>

      {isCustom && (
        <TextInput
          autoFocus
          value={customName}
          onChangeText={setCustomName}
          placeholder="Name your activity (e.g. Padel, Surfing, Netball)"
          placeholderTextColor="rgba(255,255,255,0.35)"
          className="mt-3 w-full rounded-xl border border-white/8 bg-ink-800 px-4 py-3 text-white"
        />
      )}

      <Text className="mb-2.5 mt-[22px] text-[11px] font-bold uppercase tracking-wider text-white/35">Duration</Text>
      <View className="flex-row items-center gap-2">
        {['15', '30', '45', '60'].map((m) => {
          const on = minutes === m
          return (
            <Pressable key={m} onPress={() => setMinutes(m)} className={`flex-1 items-center rounded-full border py-2.5 active:opacity-90 ${on ? 'border-brand-400 bg-brand-400' : 'border-white/[0.08] bg-white/[0.04]'}`}><Text className={`text-[13px] font-bold ${on ? 'text-black' : 'text-white/60'}`}>{m}m</Text></Pressable>
          )
        })}
        <View className="flex-row items-center gap-1.5">
          <TextInput
            keyboardType="numeric"
            value={minutes}
            onChangeText={(t) => setMinutes(t.replace(/\D/g, '').slice(0, 3))}
            className="w-[52px] rounded-full border border-white/10 bg-white/[0.03] px-1 py-2.5 text-center text-[13px] font-bold text-white"
          />
          <Text className="text-[12px] text-white/45">min</Text>
        </View>
      </View>

      <Text className="mb-2.5 mt-[22px] text-[11px] font-bold uppercase tracking-wider text-white/35">Intensity</Text>
      <View className="flex-row gap-2">
        {(['easy', 'moderate', 'hard'] as const).map((i) => {
          const on = intensity === i
          return (
            <Pressable key={i} onPress={() => setIntensity(i)} className={`flex-1 items-center rounded-2xl border py-[11px] active:opacity-90 ${on ? 'border-brand-400/45 bg-brand-400/[0.16]' : 'border-white/[0.08] bg-white/[0.04]'}`}><Text className={`text-[13px] font-semibold capitalize ${on ? 'text-brand-300' : 'text-white/60'}`}>{i}</Text></Pressable>
          )
        })}
      </View>

      <View className="mt-[18px] flex-row items-center justify-between rounded-2xl border border-brand-400/[0.18] bg-brand-400/[0.06] px-4 py-3">
        <Text className="text-[13px] text-white/60">Estimated burn</Text>
        <Text className="text-[17px] font-extrabold text-brand-400">≈ {kcal} kcal</Text>
      </View>

      {/* Weekly activity: only these count toward "workouts this week" */}
      <View className="mt-2.5 flex-row items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-3">
        <View className="min-w-0 flex-1">
          <Text className="text-[13.5px] font-bold text-white">Repeat weekly</Text>
          <Text className="mt-0.5 text-[11.5px] text-white/45">Shows up every week automatically</Text>
        </View>
        <Pressable onPress={() => setWeekly((v) => !v)} className={`h-7 w-12 shrink-0 justify-center rounded-full px-[3px] active:opacity-90 ${weekly ? 'bg-brand-400' : 'bg-white/15'}`}>
          <View className="h-[22px] w-[22px] rounded-full bg-white" style={{ transform: [{ translateX: weekly ? 20 : 0 }] }} />
        </Pressable>
      </View>

      <Pressable onPress={save} className="btn-primary mt-5 w-full active:opacity-90"><Text className="font-semibold text-black">Log {name.toLowerCase()} · {mins} min</Text></Pressable>
    </Sheet>
  )
}

/* ===================== Post detail + comment thread =============== */
export function PostDetailSheet({ open, onClose, params }: Props) {
  const { state, dispatch } = useStore()
  const postId = params?.postId as string | undefined
  const post = state.posts.find((p) => p.id === postId)
  const comments = (state.postComments ?? []).filter((c) => c.postId === postId)
  const [text, setText] = useState('')

  function send() {
    if (!text.trim() || !postId) return
    dispatch({ type: 'ADD_COMMENT', postId, text: text.trim() })
    setText('')
  }

  return (
    <Sheet open={open} onClose={onClose} title="Post">
      {post && (
        <>
          <View className="flex-row items-center gap-2.5">
            <Avatar name={post.author} size={40} />
            <View className="flex-1"><Text className="font-bold leading-tight text-white">{post.author}</Text><Text className="text-[12px] text-white/45">{post.time}</Text></View>
          </View>
          {post.pr && (
            <View className="mt-2 flex-row items-center gap-1.5 self-start rounded-full bg-brand-400/15 px-2.5 py-1">
              <Award size={13} color={brand[400]} />
              <Text className="text-[11px] font-bold text-brand-300">Personal best · {post.pr.lift} {post.pr.weight}</Text>
            </View>
          )}
          <Text className="mt-2 text-[15px] leading-snug text-white">{post.text}</Text>
          {post.image && <Image source={{ uri: post.image }} resizeMode="cover" className="mt-3 h-56 w-full rounded-2xl" />}
          <View className="mt-3 flex-row items-center gap-4 border-b border-white/8 pb-4">
            <View className="flex-row items-center gap-1.5"><Heart size={16} color="rgba(255,255,255,0.55)" /><Text className="text-[13px] text-white/55">{post.likes}</Text></View>
            <View className="flex-row items-center gap-1.5"><MessageCircle size={16} color="rgba(255,255,255,0.55)" /><Text className="text-[13px] text-white/55">{post.comments}</Text></View>
          </View>

          <Text className="mb-3 mt-4 text-[12px] font-bold uppercase tracking-wide text-white/40">{comments.length} comment{comments.length === 1 ? '' : 's'}</Text>
          <View className="gap-3">
            {comments.map((c) => (
              <View key={c.id} className="flex-row items-start gap-2.5">
                <Avatar name={c.author} size={32} />
                <View className="flex-1 rounded-2xl rounded-tl-md bg-ink-800 px-3 py-2">
                  <View className="flex-row items-center gap-2"><Text className="text-[13px] font-bold leading-tight text-white">{c.author}</Text><Text className="text-[11px] text-white/35">{c.time}</Text></View>
                  <Text className="mt-0.5 text-[14px] leading-snug text-white/80">{c.text}</Text>
                </View>
              </View>
            ))}
            {comments.length === 0 && <Text className="py-2 text-center text-[13px] text-white/40">Be the first to comment.</Text>}
          </View>

          <View className="mt-4 flex-row items-center gap-2 rounded-2xl border border-white/8 bg-ink-800 p-1.5">
            <TextInput
              value={text}
              onChangeText={setText}
              onSubmitEditing={send}
              placeholder="Add a comment…"
              placeholderTextColor="rgba(255,255,255,0.3)"
              className="min-w-0 flex-1 px-3 py-2 text-[15px] text-white"
            />
            <Pressable onPress={send} disabled={!text.trim()} className={`h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-400 active:opacity-90 ${!text.trim() ? 'opacity-40' : ''}`}><Send size={17} color="#000" /></Pressable>
          </View>
        </>
      )}
    </Sheet>
  )
}

/* ===================== Challenge detail + standings =============== */
export function ChallengeDetailSheet({ open, onClose, params }: Props) {
  const { state } = useStore()
  const id = params?.id as string | undefined
  const c = state.challenges.find((x) => x.id === id)
  const rows = leaderboardSorted(state)
  const yr = youRank(state)

  return (
    <Sheet open={open} onClose={onClose} title="Challenge">
      {c && (
        <>
          <View className="rounded-3xl border border-brand-400/20 bg-brand-400/[0.06] p-5">
            <Trophy size={26} color={brand[400]} />
            <Text className="mt-2 text-xl font-extrabold tracking-tight text-white">{c.title}</Text>
            <View className="mt-2 flex-row items-center gap-4">
              <View className="flex-row items-center gap-1.5"><Users size={14} color="rgba(255,255,255,0.6)" /><Text className="text-[13px] text-white/60">{c.participants} in</Text></View>
              <Text className="text-[13px] text-white/60">Week {c.currentWeek} of {c.totalWeeks}</Text>
              {c.rank != null && <Text className="ml-auto text-[13px] font-bold text-brand-400">You're #{c.rank}</Text>}
            </View>
          </View>

          {c.vsLabel && c.yourSide && (
            <View className="mt-4 rounded-2xl border border-white/5 bg-ink-800 p-4">
              <View className="mb-1.5 flex-row items-center justify-between">
                <View className="flex-row items-center gap-1"><Swords size={14} color={brand[400]} /><Text className="text-[13px] font-semibold text-brand-400">{c.yourSide}</Text></View>
                <Text className="text-[13px] font-semibold text-white/45">{c.rivalSide}</Text>
              </View>
              <View className="h-3 flex-row overflow-hidden rounded-full bg-ink-700"><View className="h-full rounded-l-full bg-brand-400" style={{ width: `${c.yourSidePct ?? 50}%` }} /></View>
              <View className="mt-1 flex-row items-center justify-between"><Text className="text-[12px] text-white/50">{c.yourSidePct}%</Text><Text className="text-[12px] text-white/50">{c.rivalSidePct}%</Text></View>
            </View>
          )}

          <Text className="mb-2 mt-5 text-[12px] font-bold uppercase tracking-wide text-white/40">Standings</Text>
          <View className="gap-2">
            {rows.map((u, i) => (
              <View key={u.id} className={`flex-row items-center gap-3 rounded-2xl border p-3 ${u.isYou ? 'border-brand-400/40 bg-brand-400/10' : 'border-white/5 bg-ink-800'}`}>
                <Text className={`w-6 text-center text-sm font-extrabold ${i < 3 ? 'text-brand-400' : 'text-white/40'}`}>{i + 1}</Text>
                <Avatar name={u.name} size={36} />
                <View className="flex-1"><Text className="font-bold leading-tight text-white">{u.name}</Text><Text className="text-[12px] text-white/45">{u.workouts} workouts · {u.streak}d streak</Text></View>
                <Text className="font-extrabold text-brand-400">{u.points.toLocaleString()}</Text>
              </View>
            ))}
          </View>
          <Text className="mt-3 text-center text-[12px] text-white/40">You're ranked #{yr} of {rows.length}.</Text>
        </>
      )}
    </Sheet>
  )
}

/* ===================== Customise dashboard ======================== */

const CUST_EASE = Easing.bezier(0.22, 1, 0.36, 1)

/** The design's stat toggle: a spring-eased knob in a pill track. */
function StatSwitch({ on, colors, big = false }: { on: boolean; colors: ReturnType<typeof useColors>; big?: boolean }) {
  const p = useRef(new Animated.Value(on ? 1 : 0)).current
  useEffect(() => {
    Animated.timing(p, { toValue: on ? 1 : 0, duration: 200, easing: CUST_EASE, useNativeDriver: !IS_WEB }).start()
  }, [on, p])
  const w = big ? 50 : 46
  const h = big ? 30 : 28
  const knob = big ? 24 : 22
  return (
    <View style={{ width: w, height: h, borderRadius: 999, padding: 3, justifyContent: 'center', backgroundColor: on ? colors.brand400 : `${colors.fg}26` }}>
      <Animated.View
        style={{
          width: knob, height: knob, borderRadius: knob / 2, backgroundColor: '#fff',
          shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
          transform: [{ translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, w - knob - 6] }) }],
        }}
      />
    </View>
  )
}

/** The Progress tab's "Top stat" presets — one drives the featured chart. */
const TOP_STATS: { id: string; label: string; icon: string; accent: AccentKey }[] = [
  { id: 'weight', label: 'Body weight', icon: 'scale', accent: 'blue' },
  { id: 'nutrition', label: 'Eating quality', icon: 'leaf', accent: 'orange' },
  { id: 'water', label: 'Water', icon: 'droplet', accent: 'blue' },
]

/**
 * The "Customise" bottom sheet, 1:1 with the Claude design. From the dashboard
 * it's a "Your stats" list of toggle switches (pick up to three). From the
 * Progress tab (`context: 'progress'`) it's the "My Progress" design: a single
 * "Top stat" to feature in the chart, plus a search to pin any exercise.
 */
export function CustomizeSheet({ open, onClose, params }: Props) {
  const { state, dispatch } = useStore()
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const win = useWindowDimensions()
  const screenH = IS_WEB ? WEB_SCREEN.height : win.height

  const isProgress = params?.context === 'progress'
  const metric = progressMetricId(state)
  const stats = dashboardStatIds(state)
  const timeframe = dashboardTimeframe(state)
  const atMax = stats.length >= MAX_DASHBOARD_STATS

  // Progress tab: the featured metric, and any exercise pinned via search.
  const [query, setQuery] = useState('')
  const pinnedEx = exById(metric)
  const q = query.trim().toLowerCase()
  const results = q ? EXERCISES.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 7) : []

  function pickMetric(id: string) {
    dispatch({ type: 'SET_SETTINGS', patch: { progressMetric: id } })
  }

  // Design behaviour: enabling is blocked once three are on (the row dims);
  // turn one off first. Disabling stops at one so the grid never goes empty.
  function toggleStat(id: string) {
    const has = stats.includes(id)
    if (has) {
      if (stats.length <= 1) return
      dispatch({ type: 'SET_SETTINGS', patch: { dashboardStats: stats.filter((x) => x !== id) } })
    } else {
      if (stats.length >= MAX_DASHBOARD_STATS) return
      dispatch({ type: 'SET_SETTINGS', patch: { dashboardStats: [...stats, id] } })
    }
  }

  // Bottom-sheet slide (the design's `cs_up`), kept mounted through the exit.
  const [render, setRender] = useState(open)
  const [panelH, setPanelH] = useState(560)
  const progress = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (open) {
      setRender(true)
      setQuery('')
      Animated.timing(progress, { toValue: 1, duration: 360, easing: CUST_EASE, useNativeDriver: !IS_WEB }).start()
    } else if (render) {
      Animated.timing(progress, { toValue: 0, duration: 260, easing: CUST_EASE, useNativeDriver: !IS_WEB }).start(({ finished }) => {
        if (finished) setRender(false)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const tabStyle = (on: boolean) => ({
    flex: 1, alignItems: 'center' as const, paddingVertical: isProgress ? 10 : 9, borderRadius: 10,
    backgroundColor: on ? colors.brand400 : 'transparent',
  })

  return (
    <AppModal visible={render} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', opacity: progress }}>
          <Pressable accessibilityLabel="Close" onPress={onClose} style={{ flex: 1 }} />
        </Animated.View>

        <Animated.View
          onLayout={(e) => setPanelH(e.nativeEvent.layout.height)}
          style={{
            maxHeight: screenH * 0.92,
            backgroundColor: colors.ink800,
            borderTopLeftRadius: 28, borderTopRightRadius: 28,
            paddingHorizontal: isProgress ? 20 : 18, paddingTop: 10, paddingBottom: 22 + insets.bottom,
            shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 60, shadowOffset: { width: 0, height: -24 }, elevation: 24,
            transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [panelH, 0] }) }],
          }}
        >
          <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: `${colors.fg}33`, alignSelf: 'center', marginTop: 0, marginBottom: 16 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: isProgress ? 22 : 19, fontWeight: '800', letterSpacing: -0.22, color: colors.fg }}>Customise</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Done">
              <Text style={{ fontSize: isProgress ? 16 : 15, fontWeight: '700', color: colors.brand400 }}>Done</Text>
            </Pressable>
          </View>
          <Text style={{ marginTop: isProgress ? 4 : 3, fontSize: isProgress ? 13 : 12.5, color: `${colors.fg}80` }}>
            {isProgress ? 'Choose the time window, then pick one stat to feature.' : 'Choose the time window, then pick up to three stats.'}
          </Text>

          {/* Time window */}
          <View style={{ flexDirection: 'row', gap: 4, marginTop: isProgress ? 18 : 16, padding: 4, borderRadius: 13, backgroundColor: colors.ink700 }}>
            {STAT_TIMEFRAMES.map((t) => {
              const on = timeframe === t
              return (
                <Pressable key={t} onPress={() => dispatch({ type: 'SET_SETTINGS', patch: { dashboardTimeframe: t } })} style={tabStyle(on)}>
                  <Text style={{ fontSize: isProgress ? 13.5 : 13, fontWeight: '700', color: on ? '#0a0a0b' : `${colors.fg}8c` }}>{t}</Text>
                </Pressable>
              )
            })}
          </View>

          <ScrollView
            style={IS_WEB ? { maxHeight: screenH * 0.92 - (isProgress ? 200 : 190) } : undefined}
            contentContainerStyle={{ paddingBottom: 4 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {isProgress ? (
              <>
                {/* Top stat — a single featured metric drives the chart. */}
                <Text style={{ marginTop: 22, marginBottom: 4, fontSize: 12, fontWeight: '700', letterSpacing: 0.72, textTransform: 'uppercase', color: `${colors.fg}73` }}>Top stat</Text>
                {TOP_STATS.map((m) => {
                  const on = metric === m.id
                  const accent = accentFor(m.accent, colors)
                  return (
                    <Pressable key={m.id} onPress={() => pickMetric(m.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: `${colors.fg}0f` }}>
                      <View style={{ width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: `${accent}26` }}>
                        <Icon name={m.icon} size={17} color={accent} />
                      </View>
                      <Text style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: '700', color: colors.fg }}>{m.label}</Text>
                      <StatSwitch on={on} colors={colors} big />
                    </Pressable>
                  )
                })}

                <View style={{ height: 1, backgroundColor: `${colors.fg}0f`, marginTop: 22 }} />

                {/* Feature an exercise — search the library and pin one. */}
                <Text style={{ marginTop: 22, fontSize: 12, fontWeight: '700', letterSpacing: 0.72, textTransform: 'uppercase', color: `${colors.fg}73` }}>Feature an exercise</Text>
                <Text style={{ marginTop: 5, fontSize: 13, color: `${colors.fg}80` }}>Search the exercise library and feature one on your top progress chart.</Text>

                {pinnedEx && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 14, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 16, backgroundColor: `${colors.brand400}1f`, borderWidth: 1, borderColor: `${colors.brand400}73` }}>
                    <View style={{ width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: `${colors.brand400}33` }}>
                      <Icon name="dumbbell" size={20} color={colors.brand400} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: colors.fg }}>{pinnedEx.name}</Text>
                      <Text style={{ marginTop: 1, fontSize: 12, fontWeight: '600', color: colors.brand300 }}>Featured on your progress chart</Text>
                    </View>
                    <Pressable onPress={() => pickMetric('weight')} hitSlop={6} accessibilityLabel="Unpin" style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink700 }}>
                      <X size={15} color={`${colors.fg}99`} />
                    </Pressable>
                  </View>
                )}

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.ink700, borderWidth: 1, borderColor: `${colors.fg}14` }}>
                  <Search size={18} color={`${colors.fg}66`} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search exercises"
                    placeholderTextColor={`${colors.fg}59`}
                    style={{ flex: 1, minWidth: 0, fontSize: 15, color: colors.fg, paddingVertical: 0 }}
                  />
                  {query.length > 0 && (
                    <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
                      <X size={15} color={`${colors.fg}73`} />
                    </Pressable>
                  )}
                </View>

                {results.length > 0 && (
                  <View style={{ marginTop: 10, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.ink700, borderWidth: 1, borderColor: `${colors.fg}0f` }}>
                    {results.map((e, i) => {
                      const on = e.id === metric
                      return (
                        <Pressable key={e.id} onPress={() => { pickMetric(e.id); setQuery('') }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 14, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: `${colors.fg}0f` }}>
                          <Text style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: '600', color: colors.fg }}>{e.name}</Text>
                          {on ? <Check size={18} strokeWidth={2.4} color={colors.brand400} /> : <Plus size={18} color={`${colors.fg}59`} />}
                        </Pressable>
                      )
                    })}
                  </View>
                )}

                {q.length > 0 && results.length === 0 && (
                  <Text style={{ marginTop: 12, textAlign: 'center', fontSize: 13, color: `${colors.fg}73`, padding: 8 }}>No exercises match your search.</Text>
                )}
              </>
            ) : (
              <>
                {/* Your stats */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 2 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 0.72, textTransform: 'uppercase', color: `${colors.fg}73` }}>Your stats</Text>
                  <View style={{ paddingHorizontal: 10, paddingVertical: 2, borderRadius: 999, backgroundColor: atMax ? `${colors.brand400}26` : `${colors.fg}14` }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: atMax ? colors.brand300 : `${colors.fg}80` }}>{stats.length} of {MAX_DASHBOARD_STATS}</Text>
                  </View>
                </View>

                {STAT_METRICS.map((m) => {
                  const on = stats.includes(m.id)
                  const disabled = !on && atMax
                  const accent = accentFor(m.accent, colors)
                  return (
                    <Pressable
                      key={m.id}
                      onPress={() => toggleStat(m.id)}
                      disabled={disabled}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: `${colors.fg}0d`, opacity: disabled ? 0.4 : 1 }}
                    >
                      <View style={{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: `${accent}26` }}>
                        <Icon name={m.icon} size={15} color={accent} />
                      </View>
                      <Text style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: '700', color: colors.fg }}>{m.label}</Text>
                      <StatSwitch on={on} colors={colors} />
                    </Pressable>
                  )
                })}
              </>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </AppModal>
  )
}

/* ===================== Build your own session (#2) =============== */
const REP_OPTIONS = ['5', '6-8', '8-10', '8-12', '10-12', '12-15']
const muscleFor = (defId: string) => ACTIVE_EXERCISES.find((e) => e.id === defId)?.muscleGroup ?? ''

export function CreateSessionSheet({ open, onClose, params }: Props) {
  const { state, dispatch } = useStore()
  const nav = useNav()
  const toast = useToast()
  const [name, setName] = useState('')
  const [items, setItems] = useState<TemplateExercise[]>([])
  const [catalogOpen, setCatalogOpen] = useState(true)
  const [q, setQ] = useState('')
  const [repsOpen, setRepsOpen] = useState<string | null>(null)
  const editId = params?.templateId as string | undefined

  // Fresh each open; prefill when started/edited from a saved template.
  useEffect(() => {
    if (!open) return
    const tpl = editId ? (state.templates ?? []).find((t) => t.id === editId) : undefined
    setName(tpl?.name ?? '')
    setItems(tpl ? tpl.exercises.map((e) => ({ ...e })) : [])
    setCatalogOpen(!tpl); setQ(''); setRepsOpen(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const catalog = useMemo(() => {
    const term = q.trim().toLowerCase()
    return ACTIVE_EXERCISES.filter((e) =>
      !term ||
      e.name.toLowerCase().includes(term) ||
      e.muscleGroup.toLowerCase().includes(term) ||
      e.movementPattern.toLowerCase().includes(term),
    ).slice(0, 60)
  }, [q])

  function toggleExercise(ex: Exercise) {
    setItems((prev) =>
      prev.some((i) => i.defId === ex.id)
        ? prev.filter((i) => i.defId !== ex.id)
        : [...prev, { defId: ex.id, name: ex.name, image: imageForMuscle(ex.muscleGroup), targetSets: 3, targetReps: '8-12' }],
    )
  }
  function removeItem(defId: string) {
    setItems((prev) => prev.filter((i) => i.defId !== defId))
  }
  function patchItem(defId: string, patch: Partial<TemplateExercise>) {
    setItems((prev) => prev.map((i) => (i.defId === defId ? { ...i, ...patch } : i)))
  }

  const totalSets = items.reduce((a, i) => a + i.targetSets, 0)
  const estMinutes = Math.max(15, items.length * 8)

  function start() {
    if (items.length === 0) { toast('Add at least one exercise'); return }
    const session = buildCustomSession(name, items, todayKey)
    dispatch({ type: 'SAVE_SESSION', session })
    nav.open('activeWorkout', { sessionId: session.id })
  }

  function saveForLater() {
    if (items.length === 0) { toast('Add at least one exercise'); return }
    const n = name.trim() || 'My Workout'
    if (editId) dispatch({ type: 'REMOVE_TEMPLATE', id: editId })
    dispatch({ type: 'SAVE_TEMPLATE', template: { id: `tpl-${Date.now()}`, name: n, createdAtKey: todayKey, exercises: items } })
    toast(editId ? `${n} updated` : 'Saved to your workouts')
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={editId ? 'Edit workout' : 'New workout'} full>
      <Text className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/35">Workout name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Friday Arms"
        placeholderTextColor="rgba(255,255,255,0.35)"
        className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-[14px] text-white"
      />

      <Text className="mb-2 mt-[22px] text-[11px] font-bold uppercase tracking-wider text-white/35">Exercises</Text>

      {/* Catalog toggle */}
      <Pressable onPress={() => setCatalogOpen((v) => !v)} className="flex-row items-center gap-3 rounded-2xl border border-brand-400/25 bg-brand-400/[0.06] px-3.5 py-3 active:opacity-90">
        <Dumbbell size={18} color={brand[400]} />
        <Text className="flex-1 text-[14px] font-bold text-white">All exercises · {ACTIVE_EXERCISES.length}</Text>
        <ChevronDown size={17} color={brand[400]} style={{ transform: [{ rotate: catalogOpen ? '180deg' : '0deg' }] }} />
      </Pressable>

      {catalogOpen && (
        <View className="mt-2.5 rounded-[20px] border border-white/[0.07] bg-white/[0.02] p-3">
          <View className="relative">
            <View className="absolute left-3 top-2.5 z-10"><Search size={16} color="rgba(255,255,255,0.4)" /></View>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search all exercises…"
              placeholderTextColor="rgba(255,255,255,0.35)"
              className="w-full rounded-[14px] border border-white/[0.08] bg-ink-800 py-2.5 pl-9 pr-3 text-[13px] text-white"
            />
          </View>
          <View className="mt-2.5 gap-1.5">
            {catalog.map((e) => {
              const on = items.some((i) => i.defId === e.id)
              return (
                <Pressable key={e.id} onPress={() => toggleExercise(e)} className={`flex-row items-center gap-[11px] rounded-[14px] p-2 active:opacity-90 ${on ? 'bg-brand-400/[0.1]' : 'bg-white/[0.03]'}`}>
                  <Image source={{ uri: imageForMuscle(e.muscleGroup) }} resizeMode="cover" className="h-[38px] w-[38px] rounded-[11px] bg-ink-700" />
                  <View className="min-w-0 flex-1">
                    <Text numberOfLines={1} className="text-[13.5px] font-semibold leading-tight text-white">{e.name}</Text>
                    <Text numberOfLines={1} className="mt-px text-[11.5px] text-white/45">{e.muscleGroup} · {e.type}</Text>
                  </View>
                  <View className={`h-[26px] w-[26px] items-center justify-center rounded-full ${on ? 'bg-brand-400' : 'border-2 border-white/20'}`}>
                    {on ? <Check size={14} strokeWidth={3} color="#000" /> : <Plus size={14} strokeWidth={3} color="rgba(255,255,255,0.5)" />}
                  </View>
                </Pressable>
              )
            })}
            {catalog.length === 0 && <Text className="py-5 text-center text-[13px] text-white/40">No exercises found.</Text>}
          </View>
        </View>
      )}

      {/* Picks */}
      {items.length === 0 ? (
        <View className="mt-3.5 items-center rounded-[18px] border border-dashed border-white/15 px-6 py-[22px]">
          <Text className="text-[13.5px] font-semibold text-white/55">No exercises yet</Text>
          <Text className="mt-[3px] text-center text-[12px] text-white/40">Pick a few from the list above to build your session</Text>
        </View>
      ) : (
        <View className="mt-3.5 gap-2.5">
          {items.map((it, idx) => {
            const repsMenu = repsOpen === it.defId
            return (
              <View key={it.defId} className="rounded-[18px] border border-white/[0.06] bg-white/[0.03] p-3">
                <View className="flex-row items-center gap-[11px]">
                  <View className="h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-400/15"><Text className="text-[11.5px] font-bold text-brand-300">{idx + 1}</Text></View>
                  <View className="min-w-0 flex-1">
                    <Text numberOfLines={1} className="text-[14px] font-bold leading-tight text-white">{it.name}</Text>
                    <Text numberOfLines={1} className="mt-px text-[11.5px] text-white/45">{muscleFor(it.defId)}</Text>
                  </View>
                  <Pressable onPress={() => removeItem(it.defId)} hitSlop={6} className="h-7 w-7 items-center justify-center rounded-full bg-white/5 active:opacity-80">
                    <X size={13} strokeWidth={2.6} color="rgba(255,255,255,0.45)" />
                  </Pressable>
                </View>

                <View className="mt-3 flex-row items-start gap-2.5">
                  {/* Sets */}
                  <View className="flex-1">
                    <Text className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-white/35">Sets</Text>
                    <View className="flex-row items-center gap-2">
                      <Pressable onPress={() => patchItem(it.defId, { targetSets: Math.max(1, it.targetSets - 1) })} className="h-[34px] w-[34px] items-center justify-center rounded-xl bg-white/[0.06] active:opacity-80"><Minus size={15} color="rgba(255,255,255,0.7)" /></Pressable>
                      <Text className="flex-1 text-center text-[15px] font-bold text-white">{it.targetSets}</Text>
                      <Pressable onPress={() => patchItem(it.defId, { targetSets: Math.min(8, it.targetSets + 1) })} className="h-[34px] w-[34px] items-center justify-center rounded-xl bg-white/[0.06] active:opacity-80"><Plus size={15} color="rgba(255,255,255,0.7)" /></Pressable>
                    </View>
                  </View>
                  {/* Target reps */}
                  <View className="flex-1">
                    <Text className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-white/35">Target reps</Text>
                    <Pressable onPress={() => setRepsOpen(repsMenu ? null : it.defId)} className="h-[34px] flex-row items-center justify-between rounded-xl border border-white/[0.08] bg-ink-700 px-2.5 active:opacity-80">
                      <Text className="text-[13.5px] font-semibold text-white">{it.targetReps} reps</Text>
                      <ChevronDown size={15} color="rgba(255,255,255,0.5)" style={{ transform: [{ rotate: repsMenu ? '180deg' : '0deg' }] }} />
                    </Pressable>
                  </View>
                </View>

                {repsMenu && (
                  <View className="mt-2 flex-row flex-wrap gap-1.5">
                    {REP_OPTIONS.map((r) => {
                      const on = it.targetReps === r
                      return (
                        <Pressable key={r} onPress={() => { patchItem(it.defId, { targetReps: r }); setRepsOpen(null) }} className={`rounded-full px-3 py-1.5 active:opacity-90 ${on ? 'bg-brand-400' : 'bg-white/[0.06]'}`}>
                          <Text className={`text-[12px] font-bold ${on ? 'text-black' : 'text-white/65'}`}>{r} reps</Text>
                        </Pressable>
                      )
                    })}
                  </View>
                )}
              </View>
            )
          })}

          {/* Summary + actions */}
          <View className="mt-1 flex-row items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-3">
            <Text className="text-[13px] text-white/55">{items.length} exercise{items.length === 1 ? '' : 's'} · {totalSets} sets</Text>
            <Text className="text-[13px] font-bold text-brand-400">≈ {estMinutes} min</Text>
          </View>

          <Pressable onPress={start} className="mt-3.5 flex-row items-center justify-center gap-1.5 rounded-full bg-brand-400 py-3.5 active:opacity-90">
            <Play size={14} color="#000" fill="#000" />
            <Text className="text-[15px] font-bold text-black">Start workout</Text>
          </Pressable>
          <Pressable onPress={saveForLater} className="mt-2.5 items-center rounded-full bg-white/[0.06] py-3 active:opacity-90">
            <Text className="text-[14px] font-semibold text-white/75">{editId ? 'Save changes' : 'Save for later'}</Text>
          </Pressable>
        </View>
      )}
      <View className="h-2" />
    </Sheet>
  )
}
