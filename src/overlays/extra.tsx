import { useState, useEffect, useRef, useMemo } from 'react'
import { View, Text, Pressable, Image, TextInput, Animated, Easing } from 'react-native'
import {
  Sparkles, Check, CheckCheck, ChevronRight, ChevronDown, Salad, Trophy, Flame,
  GraduationCap, Dumbbell, Lightbulb, ShieldQuestion, Share2, Plus, MapPin, Phone,
  Send, Video, Lock, Crown, Clock, Repeat, Heart, MessageCircle, Award, Swords, Users, X,
  Search, Minus, Trash2, Play, ArrowLeft,
} from 'lucide-react-native'
import { Sheet } from '../components/Sheet'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { Chip, ProgressBar } from '../components/ui'
import { TechniqueClip } from '../components/TechniqueClip'
import { posterOverrideUrl } from '../lib/media'
import { useStore } from '../store/store'
import { useToast } from '../components/Toast'
import { useNav } from '../nav'
import {
  BUDGET_MEALS, BEGINNER_LESSONS, exerciseDetail, REP_TARGETS, BASE_WEIGHTS,
  ACTIVITY_PRESETS, activityPreset, INTENSITY_MULT,
} from '../data/catalog'
import { ActivityIcon } from '../components/ActivityIcon'
import { exerciseView, imageForMuscle, buildCustomSession } from '../store/programSession'
import { ACTIVE_EXERCISES, type Exercise } from '../backend/data'
import { nextSetRecommendation } from '../store/training'
import { coachThreadView } from '../store/coach'
import { CHAT_SUGGESTIONS, coachReply } from '../lib/coachChat'
import { askCoach } from '../lib/coachApi'
import { coachContext, coachOperational, COACH_PREVIEW, coachPrecheckAsync, guardOutgoing, newSafetySession } from '../lib/coachSafety'
import { SafetyContactButtons } from '../components/SafetyContactButtons'
import { CoachComingSoon } from '../components/CoachComingSoon'
import { todaySession, leaderboardSorted, youRank } from '../store/selectors'
import { relativeLabel, todayKey } from '../lib/date'
import { CHART_METRICS, STAT_METRICS, progressMetricId, dashboardStatIds } from '../lib/metrics'
import { weightVal, toKg, weightUnit } from '../lib/format'
import { brand, useColors } from '../theme'
import type { ReactNode } from 'react'
import type { CoachKind, TemplateExercise } from '../store/types'

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
  const [openId, setOpenId] = useState<string | null>(BEGINNER_LESSONS[0]?.id ?? null)
  const done = state.beginnerProgress
  const total = BEGINNER_LESSONS.length

  return (
    <Sheet open={open} onClose={onClose} title="New to the gym">
      <View className="rounded-3xl border border-white/8 bg-ink-800 p-5">
        <Text className="text-[13px] font-semibold text-brand-400">Your first 90 days</Text>
        <Text className="mt-1 text-xl font-extrabold tracking-tight text-white">No experience needed</Text>
        <Text className="mt-1 text-[14px] leading-snug text-white/60">A calm, step by step path into the gym. Read one when you have a spare minute. Nothing here assumes you know anything yet.</Text>
        <View className="mt-4 flex-row items-center gap-3">
          <View className="flex-1"><ProgressBar value={(done.length / total) * 100} /></View>
          <Text className="shrink-0 text-[12px] font-semibold text-white/50">{done.length}/{total}</Text>
        </View>
      </View>

      <View className="mt-4 gap-2.5">
        {BEGINNER_LESSONS.map((l) => {
          const isOpen = openId === l.id
          const isDone = done.includes(l.id)
          return (
            <View key={l.id} className="overflow-hidden rounded-2xl border border-white/5 bg-ink-800">
              <Pressable onPress={() => setOpenId(isOpen ? null : l.id)} className="w-full flex-row items-center gap-3 p-4 active:opacity-80">
                <View className={`h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isDone ? 'bg-brand-400' : 'bg-brand-400/15'}`}>
                  {isDone ? <Check size={18} strokeWidth={3} color="#000" /> : <Icon name={l.icon} size={20} color={brand[400]} />}
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="font-bold leading-tight text-white">{l.title}</Text>
                  <Text numberOfLines={1} className="text-[12px] text-white/50">{l.summary} · {l.minutes} min</Text>
                </View>
                <ChevronDown size={18} color="rgba(255,255,255,0.3)" style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }} />
              </Pressable>
              {isOpen && (
                <View className="px-4 pb-4">
                  <View className="gap-2 border-t border-white/5 pt-3">
                    {l.body.map((para, i) => <Text key={i} className="text-[14px] leading-relaxed text-white/70">{para}</Text>)}
                  </View>
                  {!isDone && (
                    <Pressable onPress={() => { dispatch({ type: 'COMPLETE_LESSON', id: l.id }); toast('Lesson done. Nice.') }} className="btn-primary mt-3 w-full py-2.5 active:opacity-90">
                      <Text className="text-sm font-semibold text-black">Mark as read</Text>
                    </Pressable>
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

/* ======================== Budget eats ============================= */
export function BudgetEatsSheet({ open, onClose }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)

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
  const defId = (params?.defId as string) ?? 'bench'
  // Resolve the demo catalogue first, then the 113-exercise Database so a generated-program
  // row (backend id like CH02) opens with real technique copy instead of a blank sheet.
  const view = exerciseView(defId)
  const detail = view?.detail ?? exerciseDetail(defId)
  const target = REP_TARGETS[defId] ?? '8-12'
  const sessionEx = todaySession(state)?.exercises.find((e) => e.defId === defId)
  const fallback = sessionEx ? Math.max(...sessionEx.sets.map((s) => s.weightKg)) : BASE_WEIGHTS[defId] ?? 20
  const rec = nextSetRecommendation(state, defId, sessionEx?.targetReps ?? target, fallback)

  if (!view) return null
  return (
    <Sheet open={open} onClose={onClose} title={view.name}>
      <TechniqueClip exerciseId={defId} poster={posterOverrideUrl(defId) ?? view.image} label="Form clip coming soon" />

      <View className="mt-3 flex-row items-center gap-2">
        <Chip color="gray">{view.muscle}</Chip>
        {detail.beginnerFriendly && <Chip color="green">Beginner friendly</Chip>}
      </View>

      <Text className="mt-4 text-[14px] leading-snug text-white/70">{detail.desc}</Text>

      <Text className="mb-2 mt-5 text-[12px] font-bold uppercase tracking-wide text-white/40">How to do it</Text>
      <View className="gap-2">
        {detail.cues.map((c, i) => (
          <View key={i} className="flex-row items-start gap-3 rounded-xl border border-white/5 bg-ink-800 p-3">
            <View className="h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-400/15"><Text className="text-[12px] font-bold text-brand-400">{i + 1}</Text></View>
            <Text className="flex-1 text-[14px] text-white/75">{c}</Text>
          </View>
        ))}
      </View>

      <View className="mt-4 flex-row gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <Lightbulb size={18} color="rgba(255,255,255,0.6)" style={{ flexShrink: 0 }} />
        <View className="flex-1">
          <Text className="text-[13px] font-bold text-white/80">Most common mistake</Text>
          <Text className="text-[13px] leading-snug text-white/70">{detail.commonMistake}</Text>
        </View>
      </View>

      <View className="mt-3 flex-row gap-2.5 rounded-2xl border border-white/5 bg-ink-800 p-4">
        <Dumbbell size={18} color={brand[400]} style={{ flexShrink: 0 }} />
        <View className="flex-1">
          <Text className="text-[13px] font-bold text-white">If it's taken</Text>
          <Text className="text-[13px] leading-snug text-white/70">{detail.ifTaken}</Text>
        </View>
      </View>

      {rec.hasHistory && (
        <View className="mt-3 flex-row gap-2.5 rounded-2xl border border-brand-400/20 bg-brand-400/5 p-4">
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
                onPress={() => { dispatch({ type: 'CONNECT_PARTNER', id: c.id }); toast(c.connected ? 'Request cancelled' : `Request sent to ${c.name.split(' ')[0]}`) }}
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
  const { dispatch } = useStore()
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
const BOOKING_SLOTS = ['Tomorrow · 6:00 PM', 'Thursday · 7:30 PM', 'Saturday · 10:00 AM']

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
      <View className="flex-row items-center gap-1 rounded-2xl rounded-bl-md border border-white/8 bg-ink-800 px-4 py-3.5">
        {dots.map((d, i) => (
          <Animated.View key={i} style={{ transform: [{ translateY: d }] }} className="h-1.5 w-1.5 rounded-full bg-white/45" />
        ))}
      </View>
    </View>
  )
}

export function CoachChatSheet({ open, onClose }: Props) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const colors = useColors()
  const [text, setText] = useState('')
  const [showBook, setShowBook] = useState(false)
  const [booked, setBooked] = useState<string | null>(null)
  const [typing, setTyping] = useState(false)
  // Per-conversation safety state (persistence + retraction across messages, spec §2).
  const safety = useRef(newSafetySession())
  const premium = state.profile.premium
  const messages = state.chat
  const showSuggestions = messages.filter((m) => m.role === 'user').length === 0

  // Mark coach messages read whenever the thread is open and grows.
  useEffect(() => {
    if (open) dispatch({ type: 'MARK_CHAT_READ' })
  }, [open, messages.length, showBook, booked, typing, dispatch])

  async function send(t?: string) {
    if (!coachOperational() && !COACH_PREVIEW) return // HARD gate + server-side kill switch (spec §20).
    const msg = (t ?? text).trim()
    if (!msg || typing) return
    setText('')
    // Show the user's message immediately, then a typing indicator.
    dispatch({ type: 'PUSH_CHAT', role: 'user', text: msg })
    // DEV DESIGN PREVIEW only: the coach is NOT operational, so reply with the on-device scripted
    // coach ONLY — never the live AI or the safety classifier (both stay gated). This lets the coach
    // be redesigned without activating the unvalidated crisis detector.
    if (COACH_PREVIEW && !coachOperational()) {
      setTyping(true)
      const scripted = coachReply(state, msg)
      setTimeout(() => { dispatch({ type: 'PUSH_CHAT', role: 'coach', text: scripted }); setTyping(false) }, 450)
      return
    }
    // SAFETY: one shared precheck runs BEFORE any reply — the safety guard first (a crisis is never
    // gated by the daily limit), then the limit — enforcing identically on the live-AI and fallback
    // paths (spec §2/§7/§21). A blocked message reaches neither the model nor the rules engine.
    const ctx = coachContext(state)
    // Recent prior turns give the classifier multi-turn context (state.chat is pre-this-message here).
    const recent = state.chat.slice(-6).map((m) => m.text)
    const pre = await coachPrecheckAsync(msg, ctx, safety.current, state.coachUsage, todayKey, recent)
    if (pre.kind !== 'allow') {
      dispatch({ type: 'PUSH_CHAT', role: 'coach', text: pre.response.text, buttons: pre.response.buttons })
      return
    }
    dispatch({ type: 'BUMP_COACH_USAGE' })
    setTyping(true)
    try {
      // Real coach (via Firebase AI Logic), then the post-response validator.
      const reply = await askCoach(state, msg)
      dispatch({ type: 'PUSH_CHAT', role: 'coach', text: guardOutgoing(reply, pre.decision, ctx, safety.current) })
    } catch {
      // Fallback to the on-device rules engine — SAME guardrails, same validator.
      dispatch({ type: 'PUSH_CHAT', role: 'coach', text: guardOutgoing(coachReply(state, msg), pre.decision, ctx, safety.current) })
    } finally {
      setTyping(false)
    }
  }

  function unlock() {
    dispatch({ type: 'SET_PROFILE', patch: { premium: true } })
    toast('Premium unlocked. Enjoy your calls')
  }

  function pickSlot(slot: string) {
    setBooked(slot)
    toast('Video call booked')
  }

  // Find the last message the user sent, to show a Seen / Delivered receipt.
  let lastUserIdx = -1
  for (let i = messages.length - 1; i >= 0; i--) { if (messages[i].role === 'user') { lastUserIdx = i; break } }
  const seen = lastUserIdx >= 0 && messages.slice(lastUserIdx + 1).some((m) => m.role === 'coach')

  if (!coachOperational() && !COACH_PREVIEW) {
    return (
      <Sheet open={open} onClose={onClose} title="Coach">
        <CoachComingSoon />
      </Sheet>
    )
  }

  return (
    <Sheet open={open} onClose={onClose} title="Coach" full>
      {/* Header row (in-sheet) */}
      <View className="mb-3 flex-row items-center gap-2.5">
        <View className="relative shrink-0">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-brand-400"><Sparkles size={18} color="#000" /></View>
          <View className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-brand-400" style={{ borderWidth: 2, borderColor: colors.ink900 }} />
        </View>
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="text-[15px] font-bold leading-tight text-white">Coach</Text>
          <Text className="text-[12px] leading-tight text-white/45">Active now</Text>
        </View>
        <Pressable className="h-9 w-9 shrink-0 items-center justify-center rounded-full active:opacity-80">
          <Phone size={20} color={brand[400]} />
        </Pressable>
        <Pressable onPress={() => setShowBook((v) => !v)} className="h-9 w-9 shrink-0 items-center justify-center rounded-full active:opacity-80">
          <Video size={21} color={brand[400]} />
        </Pressable>
      </View>

      {/* Book-a-call panel */}
      {showBook && (
        <View className="mb-3 rounded-2xl border border-white/8 bg-ink-800 px-4 py-3.5">
          {booked ? (
            <View className="flex-row items-start gap-2.5">
              <View className="h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-400"><Check size={18} strokeWidth={3} color="#000" /></View>
              <View className="flex-1">
                <Text className="font-bold leading-tight text-white">Call booked</Text>
                <Text className="text-[13px] text-white/60">{booked}. I'll send a video link to your email beforehand.</Text>
              </View>
            </View>
          ) : premium ? (
            <>
              <View className="mb-2.5 flex-row items-center gap-2">
                <Video size={16} color={brand[400]} />
                <Text className="text-sm font-bold text-white">Book a 1:1 video call</Text>
                <View className="ml-auto flex-row items-center gap-1 rounded-full bg-brand-400/15 px-2 py-0.5"><Crown size={11} color={brand[400]} /><Text className="text-[10px] font-bold text-brand-400">Premium</Text></View>
              </View>
              <View className="gap-2">
                {BOOKING_SLOTS.map((slot) => (
                  <Pressable key={slot} onPress={() => pickSlot(slot)} className="w-full flex-row items-center gap-2.5 rounded-xl border border-white/8 bg-ink-700 p-3 active:opacity-80">
                    <Clock size={15} color={brand[400]} />
                    <Text className="text-[14px] font-semibold text-white">{slot}</Text>
                    <ChevronRight size={16} color="rgba(255,255,255,0.3)" style={{ marginLeft: 'auto' }} />
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <View className="rounded-xl border border-brand-400/25 bg-brand-400/[0.06] p-4">
              <View className="flex-row items-center gap-2">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-brand-400"><Crown size={16} color="#000" /></View>
                <Text className="font-bold text-white">Video calls are Premium</Text>
                <Lock size={15} color="rgba(255,255,255,0.4)" style={{ marginLeft: 'auto' }} />
              </View>
              <Text className="mt-2 text-[13px] leading-snug text-white/65">Go Premium to book live 1:1 video calls with your coach for form checks, plan reviews and accountability. Text coaching stays free, always.</Text>
              <Pressable onPress={unlock} className="btn-primary mt-3 w-full flex-row items-center justify-center gap-1.5 py-2.5 active:opacity-90"><Crown size={15} color="#000" /><Text className="text-sm font-semibold text-black">Unlock Premium</Text></Pressable>
            </View>
          )}
        </View>
      )}

      {/* Messages */}
      <View className="gap-3">
        {messages.map((m) => (
          <View key={m.id} className={`flex-row ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <View className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 ${m.role === 'user' ? 'rounded-br-md bg-brand-400' : 'rounded-bl-md border border-white/8 bg-ink-800'}`}>
              <Text className={`text-[14px] leading-snug ${m.role === 'user' ? 'text-black' : 'text-white/85'}`}>{m.text}</Text>
              {m.role === 'coach' && m.buttons && <SafetyContactButtons buttons={m.buttons} />}
              <Text className={`mt-1 text-[10px] ${m.role === 'user' ? 'text-black/50' : 'text-white/35'}`}>{m.time}</Text>
            </View>
          </View>
        ))}
        {typing && <TypingDots />}
      </View>

      {/* Suggestions */}
      {showSuggestions && !typing && (
        <View className="mt-2 flex-row flex-wrap gap-2">
          {CHAT_SUGGESTIONS.map((s) => (
            <Pressable key={s} onPress={() => send(s)} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 active:opacity-80"><Text className="text-[12px] font-medium text-white/70">{s}</Text></Pressable>
          ))}
        </View>
      )}

      {/* Input */}
      <View className="mt-3 flex-row items-end gap-2 border-t border-white/8 pt-3">
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          placeholder="Message your coach…"
          placeholderTextColor="rgba(255,255,255,0.3)"
          className="max-h-28 min-h-[44px] flex-1 rounded-2xl border border-white/8 bg-ink-800 px-4 py-3 text-[15px] text-white"
        />
        <Pressable onPress={() => send()} disabled={!text.trim() || typing} className={`h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-400 active:opacity-90 ${!text.trim() || typing ? 'opacity-40' : ''}`}>
          <Send size={18} color="#000" />
        </Pressable>
      </View>
    </Sheet>
  )
}

/* ===================== Log a self-chosen activity ================= */
export function LogActivitySheet({ open, onClose }: Props) {
  const { dispatch } = useStore()
  const toast = useToast()
  const [key, setKey] = useState('run')
  const [customName, setCustomName] = useState('')
  const [minutes, setMinutes] = useState('30')
  const [intensity, setIntensity] = useState<'easy' | 'moderate' | 'hard'>('moderate')
  const [note, setNote] = useState('')
  const [weekly, setWeekly] = useState(false)

  const preset = activityPreset(key) ?? ACTIVITY_PRESETS[0]
  const isCustom = key === 'other'
  const name = isCustom ? customName.trim() || 'Activity' : preset.name
  const mins = parseInt(minutes) || 0
  const kcal = Math.round(mins * preset.kcalPerMin * INTENSITY_MULT[intensity])

  function save() {
    if (mins <= 0) { toast('Add a duration first'); return }
    dispatch({ type: 'ADD_ACTIVITY', activity: { type: key, name, icon: isCustom ? 'other' : key, minutes: mins, intensity, calories: kcal, note: note.trim() || undefined, weekly } })
    toast(`${name} logged`)
    setKey('run'); setCustomName(''); setMinutes('30'); setIntensity('moderate'); setNote(''); setWeekly(false)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Log an activity">
      <Text className="mb-3 text-[13px] text-white/55">Anything counts: a sport, a run, a class. Pick one or add your own.</Text>

      <View className="flex-row flex-wrap gap-2">
        {ACTIVITY_PRESETS.map((a) => {
          const active = key === a.key
          return (
            <Pressable
              key={a.key}
              onPress={() => setKey(a.key)}
              style={{ width: '22.5%' }}
              className={`items-center gap-1.5 rounded-2xl border py-3 active:opacity-90 ${active ? 'border-brand-400 bg-brand-400/10' : 'border-white/8 bg-ink-800'}`}
            >
              <ActivityIcon name={a.key} size={20} color={active ? brand[400] : 'rgba(255,255,255,0.7)'} />
              <Text className={`text-[11px] font-semibold leading-none ${active ? 'text-brand-400' : 'text-white/70'}`}>{a.name}</Text>
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

      <Text className="mb-1.5 mt-5 text-sm font-semibold text-white/70">Duration</Text>
      <View className="flex-row items-center gap-2">
        {['15', '30', '45', '60'].map((m) => (
          <Pressable key={m} onPress={() => setMinutes(m)} className={`rounded-full px-3 py-1.5 active:opacity-90 ${minutes === m ? 'bg-brand-400' : 'bg-ink-700'}`}><Text className={`text-sm font-semibold ${minutes === m ? 'text-black' : 'text-white/60'}`}>{m}m</Text></Pressable>
        ))}
        <View className="ml-auto flex-row items-center gap-1.5">
          <TextInput
            keyboardType="numeric"
            value={minutes}
            onChangeText={(t) => setMinutes(t.replace(/\D/g, '').slice(0, 3))}
            className="w-16 rounded-xl border border-white/8 bg-ink-800 px-3 py-2 text-center text-white"
          />
          <Text className="text-sm text-white/45">min</Text>
        </View>
      </View>

      <Text className="mb-1.5 mt-5 text-sm font-semibold text-white/70">Intensity</Text>
      <View className="flex-row gap-1 rounded-xl bg-ink-700 p-1">
        {(['easy', 'moderate', 'hard'] as const).map((i) => (
          <Pressable key={i} onPress={() => setIntensity(i)} className={`flex-1 items-center rounded-lg py-2.5 active:opacity-90 ${intensity === i ? 'bg-brand-400' : ''}`}><Text className={`text-sm font-semibold capitalize ${intensity === i ? 'text-black' : 'text-white/60'}`}>{i}</Text></Pressable>
        ))}
      </View>

      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Note (optional): how did it feel?"
        placeholderTextColor="rgba(255,255,255,0.35)"
        className="mt-4 w-full rounded-xl border border-white/8 bg-ink-800 px-4 py-3 text-[14px] text-white"
      />

      {/* Weekly activity: only these count toward "workouts this week" */}
      <Pressable onPress={() => setWeekly((v) => !v)} className="mt-3 w-full flex-row items-center gap-3 rounded-2xl border border-white/8 bg-ink-800 p-3.5 active:opacity-90">
        <View className="h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-400/15"><Repeat size={18} color={brand[400]} /></View>
        <View className="flex-1">
          <Text className="font-bold leading-tight text-white">Regular weekly activity</Text>
          <Text className="text-[12px] text-white/50">Counts toward your weekly workouts</Text>
        </View>
        <View className={`h-7 w-12 shrink-0 justify-center rounded-full ${weekly ? 'bg-brand-400' : 'bg-white/15'}`}>
          <View className="h-6 w-6 rounded-full bg-white" style={{ transform: [{ translateX: weekly ? 22 : 2 }] }} />
        </View>
      </Pressable>

      <View className="mt-4 flex-row items-center justify-between rounded-2xl border border-white/5 bg-ink-800 p-4">
        <Text className="text-[13px] text-white/55">Estimated burn</Text>
        <Text className="text-lg font-extrabold text-brand-400">≈ {kcal} kcal</Text>
      </View>

      <Pressable onPress={save} className="btn-primary mt-5 w-full flex-row items-center justify-center gap-1.5 active:opacity-90"><Plus size={16} color="#000" /><Text className="font-semibold text-black">Log activity</Text></Pressable>
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

/* ===================== Customise dashboard / goals ================ */
export function CustomizeSheet({ open, onClose }: Props) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const units = state.settings.units
  const p = state.profile

  const metric = progressMetricId(state)
  const stats = dashboardStatIds(state)

  const [goalW, setGoalW] = useState(() => String(Math.round(weightVal(p.goalWeightKg, units) * 10) / 10))
  const [steps, setSteps] = useState(() => String(p.stepTarget))
  const [sleep, setSleep] = useState(() => String(p.sleepTargetH))
  const [water, setWater] = useState(() => String(p.waterTargetL))
  const [days, setDays] = useState(() => String(p.daysPerWeek))

  function saveGoals() {
    dispatch({
      type: 'SET_PROFILE',
      patch: {
        goalWeightKg: Math.round(toKg(parseFloat(goalW) || weightVal(p.goalWeightKg, units), units) * 10) / 10,
        stepTarget: Math.max(0, Math.round(Number(steps) || 0)),
        sleepTargetH: Math.max(0, Math.min(14, Number(sleep) || 0)),
        waterTargetL: Math.max(0, Number(water) || 0),
        daysPerWeek: Math.max(1, Math.min(7, Math.round(Number(days) || 1))),
      },
    })
    toast('Goals updated')
  }

  function pickMetric(id: string) {
    dispatch({ type: 'SET_SETTINGS', patch: { progressMetric: id } })
  }

  function toggleStat(id: string) {
    const has = stats.includes(id)
    let next: string[]
    if (has) {
      if (stats.length <= 1) return // keep at least one
      next = stats.filter((x) => x !== id)
    } else {
      // Always keep exactly three: adding a fourth swaps out the oldest pick.
      next = stats.length >= 3 ? [...stats.slice(1), id] : [...stats, id]
    }
    dispatch({ type: 'SET_SETTINGS', patch: { dashboardStats: next } })
  }

  const inputCls = 'w-24 rounded-xl border border-white/8 bg-ink-900 px-3 py-2 text-right text-[15px] font-bold text-white'

  return (
    <Sheet open={open} onClose={onClose} title="Customise">
      {/* Goals */}
      <Text className="mb-2 text-[12px] font-bold uppercase tracking-wide text-white/40">Your goals</Text>
      <View className="gap-2 rounded-2xl border border-white/8 bg-ink-800 p-3">
        <GoalRow label="Goal weight" unit={weightUnit(units)}>
          <TextInput value={goalW} onChangeText={(v) => setGoalW(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" placeholderTextColor="rgba(148,148,148,0.6)" className={inputCls} />
        </GoalRow>
        <GoalRow label="Daily steps" unit="steps">
          <TextInput value={steps} onChangeText={(v) => setSteps(v.replace(/\D/g, ''))} keyboardType="number-pad" placeholderTextColor="rgba(148,148,148,0.6)" className={inputCls} />
        </GoalRow>
        <GoalRow label="Sleep" unit="hours">
          <TextInput value={sleep} onChangeText={(v) => setSleep(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" placeholderTextColor="rgba(148,148,148,0.6)" className={inputCls} />
        </GoalRow>
        <GoalRow label="Water" unit="litres">
          <TextInput value={water} onChangeText={(v) => setWater(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" placeholderTextColor="rgba(148,148,148,0.6)" className={inputCls} />
        </GoalRow>
        <GoalRow label="Workouts / week" unit="days">
          <TextInput value={days} onChangeText={(v) => setDays(v.replace(/\D/g, '').slice(0, 1))} keyboardType="number-pad" placeholderTextColor="rgba(148,148,148,0.6)" className={inputCls} />
        </GoalRow>
        <Pressable onPress={saveGoals} className="btn-primary mt-1 w-full py-2.5 active:opacity-90">
          <Text className="text-sm font-semibold text-black">Save goals</Text>
        </Pressable>
      </View>

      {/* Main chart metric */}
      <Text className="mb-2 mt-6 text-[12px] font-bold uppercase tracking-wide text-white/40">Top progress chart</Text>
      <View className="flex-row flex-wrap gap-2.5">
        {CHART_METRICS.map((m) => {
          const on = metric === m.id
          return (
            <Pressable key={m.id} onPress={() => pickMetric(m.id)} style={{ width: '47.5%' }} className={`items-center gap-2 rounded-2xl border p-3 active:opacity-90 ${on ? 'border-brand-400 bg-brand-400/10' : 'border-white/8 bg-ink-800'}`}>
              {on && <View className="absolute right-2 top-2"><Check size={15} strokeWidth={3} color={brand[400]} /></View>}
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-brand-400/15"><Icon name={m.icon} size={18} color={brand[400]} /></View>
              <Text className="text-[12.5px] font-semibold text-white">{m.label}</Text>
            </Pressable>
          )
        })}
      </View>

      {/* Dashboard stats */}
      <View className="mb-2 mt-6 flex-row items-center justify-between">
        <Text className="text-[12px] font-bold uppercase tracking-wide text-white/40">Dashboard stats</Text>
        <Text className="text-[11px] text-white/35">Pick 3</Text>
      </View>
      <View className="flex-row flex-wrap gap-2.5">
        {STAT_METRICS.map((m) => {
          const on = stats.includes(m.id)
          return (
            <Pressable key={m.id} onPress={() => toggleStat(m.id)} style={{ width: '47.5%' }} className={`items-center gap-2 rounded-2xl border p-3 active:opacity-90 ${on ? 'border-brand-400 bg-brand-400/10' : 'border-white/8 bg-ink-800'}`}>
              <View className={`absolute right-2 top-2 h-[18px] w-[18px] items-center justify-center rounded-md border ${on ? 'border-brand-400 bg-brand-400' : 'border-white/20'}`}>{on && <Check size={11} strokeWidth={3.5} color="#000" />}</View>
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-brand-400/15"><Icon name={m.icon} size={18} color={brand[400]} /></View>
              <Text className="text-[12.5px] font-semibold text-white">{m.label}</Text>
            </Pressable>
          )
        })}
      </View>
      <View className="h-2" />
    </Sheet>
  )
}

function GoalRow({ label, unit, children }: { label: string; unit: string; children: ReactNode }) {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-1">
        <Text className="text-[14px] font-semibold text-white">{label}</Text>
        <Text className="text-[11px] text-white/40">{unit}</Text>
      </View>
      {children}
    </View>
  )
}

/* ===================== Build your own session (#2) =============== */
const REP_PRESETS = ['5', '6-8', '8-12', '10-15', '15-20']

export function CreateSessionSheet({ open, onClose, params }: Props) {
  const { state, dispatch } = useStore()
  const nav = useNav()
  const toast = useToast()
  const [name, setName] = useState('')
  const [items, setItems] = useState<TemplateExercise[]>([])
  const [saveTpl, setSaveTpl] = useState(false)
  const [picking, setPicking] = useState(false)
  const [q, setQ] = useState('')

  // Fresh each open; prefill when started/edited from a saved template.
  useEffect(() => {
    if (!open) return
    const tplId = params?.templateId as string | undefined
    const tpl = tplId ? (state.templates ?? []).find((t) => t.id === tplId) : undefined
    setName(tpl?.name ?? '')
    setItems(tpl ? tpl.exercises.map((e) => ({ ...e })) : [])
    setSaveTpl(false); setPicking(false); setQ('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    const chosen = new Set(items.map((i) => i.defId))
    return ACTIVE_EXERCISES.filter((e) => !chosen.has(e.id))
      .filter((e) =>
        !term ||
        e.name.toLowerCase().includes(term) ||
        e.muscleGroup.toLowerCase().includes(term) ||
        e.movementPattern.toLowerCase().includes(term),
      )
      .slice(0, 60)
  }, [q, items])

  function addExercise(ex: Exercise) {
    setItems((prev) => [
      ...prev,
      { defId: ex.id, name: ex.name, image: imageForMuscle(ex.muscleGroup), targetSets: 3, targetReps: '8-12' },
    ])
    setPicking(false); setQ('')
  }
  function removeItem(defId: string) {
    setItems((prev) => prev.filter((i) => i.defId !== defId))
  }
  function patchItem(defId: string, patch: Partial<TemplateExercise>) {
    setItems((prev) => prev.map((i) => (i.defId === defId ? { ...i, ...patch } : i)))
  }

  function start() {
    if (items.length === 0) { toast('Add at least one exercise'); return }
    const session = buildCustomSession(name, items, todayKey)
    dispatch({ type: 'SAVE_SESSION', session })
    if (saveTpl) {
      dispatch({ type: 'SAVE_TEMPLATE', template: { id: `tpl-${Date.now()}`, name: session.name, createdAtKey: todayKey, exercises: items } })
    }
    nav.open('activeWorkout', { sessionId: session.id })
  }

  function saveForLater() {
    if (items.length === 0) { toast('Add at least one exercise'); return }
    dispatch({ type: 'SAVE_TEMPLATE', template: { id: `tpl-${Date.now()}`, name: name.trim() || 'My Workout', createdAtKey: todayKey, exercises: items } })
    toast('Saved to your workouts')
    onClose()
  }

  /* ---- Exercise picker ---- */
  if (picking) {
    return (
      <Sheet open={open} onClose={onClose} title="Add exercise" full>
        <View className="mb-3 flex-row items-center gap-2">
          <Pressable onPress={() => { setPicking(false); setQ('') }} hitSlop={8} className="h-10 w-10 items-center justify-center rounded-full bg-white/5 active:opacity-80">
            <ArrowLeft size={18} color="#fff" />
          </Pressable>
          <View className="flex-1 flex-row items-center gap-2 rounded-xl border border-white/8 bg-ink-800 px-3">
            <Search size={18} color="rgba(255,255,255,0.4)" />
            <TextInput
              autoFocus
              value={q}
              onChangeText={setQ}
              placeholder="Search 100+ exercises or muscle…"
              placeholderTextColor="rgba(148,148,148,0.6)"
              className="flex-1 bg-transparent py-3 text-sm text-white"
            />
          </View>
        </View>
        <View className="gap-2">
          {results.map((e) => (
            <Pressable key={e.id} onPress={() => addExercise(e)} className="w-full flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-2.5 active:opacity-90">
              <Image source={{ uri: imageForMuscle(e.muscleGroup) }} resizeMode="cover" className="h-11 w-11 rounded-xl" />
              <View className="min-w-0 flex-1">
                <Text numberOfLines={1} className="font-bold leading-tight text-white">{e.name}</Text>
                <Text numberOfLines={1} className="text-[12px] text-white/45">{e.muscleGroup} · {e.type}</Text>
              </View>
              <View className="h-7 w-7 items-center justify-center rounded-full bg-brand-400"><Plus size={16} strokeWidth={3} color="#000" /></View>
            </Pressable>
          ))}
          {results.length === 0 && <Text className="py-8 text-center text-sm text-white/40">No exercises match “{q}”.</Text>}
        </View>
      </Sheet>
    )
  }

  /* ---- Builder ---- */
  return (
    <Sheet open={open} onClose={onClose} title="New workout" full>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Name it (e.g. Push A, Leg burner)"
        placeholderTextColor="rgba(255,255,255,0.35)"
        className="w-full rounded-xl border border-white/8 bg-ink-800 px-4 py-3 text-[15px] font-semibold text-white"
      />

      <Text className="mb-2 mt-5 text-[12px] font-bold uppercase tracking-wide text-white/40">
        Exercises{items.length ? ` · ${items.length}` : ''}
      </Text>

      {items.length === 0 ? (
        <Pressable onPress={() => setPicking(true)} className="w-full items-center rounded-2xl border border-dashed border-white/15 px-6 py-10 active:opacity-90">
          <View className="mb-3 h-12 w-12 items-center justify-center rounded-2xl bg-brand-400/15"><Dumbbell size={24} color={brand[400]} /></View>
          <Text className="font-bold text-white">Build your own session</Text>
          <Text className="mt-1 max-w-[240px] text-center text-[13px] text-white/45">Add exercises, set your sets and reps, then start. Nothing off-limits.</Text>
          <View className="mt-4 flex-row items-center gap-1.5 rounded-full bg-brand-400 px-4 py-2"><Plus size={15} strokeWidth={3} color="#000" /><Text className="text-sm font-bold text-black">Add exercise</Text></View>
        </Pressable>
      ) : (
        <View className="gap-2.5">
          {items.map((it) => (
            <View key={it.defId} className="rounded-2xl border border-white/5 bg-ink-800 p-3">
              <View className="flex-row items-center gap-3">
                <Image source={{ uri: it.image }} resizeMode="cover" className="h-11 w-11 rounded-xl" />
                <Text numberOfLines={1} className="flex-1 font-bold leading-tight text-white">{it.name}</Text>
                <Pressable onPress={() => removeItem(it.defId)} hitSlop={6} className="h-8 w-8 items-center justify-center rounded-full bg-white/5 active:opacity-80">
                  <Trash2 size={15} color="rgba(255,255,255,0.5)" />
                </Pressable>
              </View>

              {/* Sets stepper */}
              <View className="mt-3 flex-row items-center gap-2">
                <Text className="w-12 text-[12px] font-semibold text-white/50">Sets</Text>
                <Pressable onPress={() => patchItem(it.defId, { targetSets: Math.max(1, it.targetSets - 1) })} className="h-9 w-9 items-center justify-center rounded-lg bg-ink-700 active:opacity-80"><Minus size={16} color="#fff" /></Pressable>
                <Text className="w-8 text-center text-[15px] font-extrabold text-white">{it.targetSets}</Text>
                <Pressable onPress={() => patchItem(it.defId, { targetSets: Math.min(8, it.targetSets + 1) })} className="h-9 w-9 items-center justify-center rounded-lg bg-brand-400/20 active:opacity-80"><Plus size={16} color={brand[400]} /></Pressable>
              </View>

              {/* Rep target presets */}
              <View className="mt-2.5 flex-row items-center gap-2">
                <Text className="w-12 text-[12px] font-semibold text-white/50">Reps</Text>
                <View className="flex-1 flex-row flex-wrap gap-1.5">
                  {REP_PRESETS.map((r) => {
                    const on = it.targetReps === r
                    return (
                      <Pressable key={r} onPress={() => patchItem(it.defId, { targetReps: r })} className={`rounded-full px-3 py-1.5 active:opacity-90 ${on ? 'bg-brand-400' : 'bg-ink-700'}`}>
                        <Text className={`text-[12px] font-bold ${on ? 'text-black' : 'text-white/60'}`}>{r}</Text>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            </View>
          ))}

          <Pressable onPress={() => setPicking(true)} className="w-full flex-row items-center justify-center gap-1.5 rounded-2xl border border-dashed border-white/15 py-3 active:opacity-80">
            <Plus size={15} color={brand[400]} />
            <Text className="text-sm font-semibold text-white/70">Add another exercise</Text>
          </Pressable>
        </View>
      )}

      {items.length > 0 && (
        <>
          {/* Save as reusable workout */}
          <Pressable onPress={() => setSaveTpl((v) => !v)} className="mt-5 w-full flex-row items-center gap-3 rounded-2xl border border-white/8 bg-ink-800 p-3.5 active:opacity-90">
            <View className="h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-400/15"><Repeat size={18} color={brand[400]} /></View>
            <View className="flex-1">
              <Text className="font-bold leading-tight text-white">Save as a reusable workout</Text>
              <Text className="text-[12px] text-white/50">Start it again any time from Workout</Text>
            </View>
            <View className={`h-7 w-12 shrink-0 justify-center rounded-full ${saveTpl ? 'bg-brand-400' : 'bg-white/15'}`}>
              <View className="h-6 w-6 rounded-full bg-white" style={{ transform: [{ translateX: saveTpl ? 22 : 2 }] }} />
            </View>
          </Pressable>

          <Pressable onPress={start} className="btn-primary mt-4 w-full flex-row items-center justify-center gap-2 active:opacity-90">
            <Play size={16} color="#000" fill="#000" />
            <Text className="font-semibold text-black">Start workout</Text>
          </Pressable>
          <Pressable onPress={saveForLater} className="mt-2 w-full items-center rounded-full bg-ink-700 py-3 active:opacity-90">
            <Text className="text-sm font-semibold text-white/70">Save for later</Text>
          </Pressable>
        </>
      )}
      <View className="h-2" />
    </Sheet>
  )
}
