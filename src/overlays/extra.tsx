import { useState, useEffect, useRef, useMemo } from 'react'
import { View, Text, Pressable, Image, TextInput, Animated, Easing, ScrollView, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  Sparkles, Check, CheckCheck, ChevronRight, ChevronDown, ChevronLeft, Salad, Trophy, Flame,
  GraduationCap, Dumbbell, Lightbulb, ShieldQuestion, Share2, Plus, MapPin, Phone,
  Send, Video, Lock, Crown, Clock, Repeat, Heart, MessageCircle, Award, Swords, Users, X,
  Search, Minus, Trash2, Play, Activity, Reply, Brain, Ban,
} from 'lucide-react-native'
import { Sheet } from '../components/Sheet'
import { Icon } from '../components/Icon'
import { Chip, ProgressBar } from '../components/ui'
import { TechniqueClip } from '../components/TechniqueClip'
import { posterOverrideUrl } from '../lib/media'
import { useDispatch, useStore } from '../store/store'
import { useToast } from '../components/Toast'
import { useNav } from '../nav'
import { BEGINNER_LESSONS, exerciseDetail, REP_TARGETS, BASE_WEIGHTS, SET_TARGETS, ACTIVITY_PRESETS, activityPreset, INTENSITY_MULT, EXERCISES, exById } from '../data/catalog'
import { useBudgetMeals } from '../data/recipes'
import { useExerciseInfo } from '../data/exerciseInfo'
import { fmtWeight } from '../lib/format'
import { ActivityIcon } from '../components/ActivityIcon'
import { exerciseView, imageForMuscle, buildCustomSession } from '../store/programSession'
import { ACTIVE_EXERCISES, type Exercise } from '../backend/data'
import { nextSetRecommendation } from '../store/training'
import { coachThreadView, coachDisplayName } from '../store/coach'
import { CoachMemoryView } from '../components/CoachMemoryView'
import { coachOperational, COACH_PREVIEW } from '../lib/coachSafety'
import { CoachComingSoon } from '../components/CoachComingSoon'
import { todaySession, leaderboardSorted, youRank } from '../store/selectors'
import { relativeLabel, todayKey, deviceTimezone } from '../lib/date'
import { CHART_METRICS, DASHBOARD_FEATURED, MAX_DASHBOARD_STATS, PROGRESS_LIFT_PERIODS, STAT_METRICS, STAT_TIMEFRAMES, dashboardFeaturedId, dashboardLiftPeriod, dashboardStatIds, dashboardTimeframe, dashboardTrackedIds, progressMetricId } from '../lib/metrics'
import type { ProgressLiftPeriod } from '../store/types'
import { brand, useColors, accentFor, type AccentKey } from '../theme'
import { AppModal, IS_WEB, WEB_SCREEN } from '../components/WebFrame'
import { CoachScreen } from '../coach/CoachScreen'
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
  // Coach profile & memory (formerly the brain icon in the chat header) now lives here, under
  // Menu → Your coach — the chat itself carries no settings.
  const [showSettings, setShowSettings] = useState(false)

  if (!coachOperational() && !COACH_PREVIEW) {
    return (
      <Sheet open={open} onClose={onClose} title="Your coach">
        <CoachComingSoon />
      </Sheet>
    )
  }

  if (showSettings) {
    return (
      <Sheet open={open} onClose={onClose} title="Coach profile" full bare>
        <CoachMemoryView onClose={() => setShowSettings(false)} />
      </Sheet>
    )
  }

  return (
    <Sheet open={open} onClose={onClose} title="Your coach">
      <View className="mb-4 flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-3.5">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-brand-400"><Sparkles size={20} color="#000" /></View>
        <View>
          <Text className="font-bold leading-tight text-white">{coachDisplayName(state.profile.coachName)}</Text>
          <Text className="text-[12px] text-secondary">Reads your logs. Checks in, not chats.</Text>
        </View>
      </View>

      <Pressable onPress={() => setShowSettings(true)} accessibilityRole="button" accessibilityLabel="Coach profile and memory" className="mb-4 flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-3.5 active:opacity-90">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-white/5"><Brain size={19} color={brand[400]} strokeWidth={2} /></View>
        <View className="flex-1">
          <Text className="font-bold leading-tight text-white">Coach profile &amp; memory</Text>
          <Text className="text-[12px] text-secondary">What the coach remembers, and its style</Text>
        </View>
        <ChevronRight size={18} color="rgba(255,255,255,0.3)" />
      </Pressable>

      <View className="gap-3">
        {thread.map((m, i) => (
          <View key={m.id} className={`rounded-2xl border p-4 ${i === 0 ? 'border-brand-400/30 bg-brand-400/5' : 'border-white/5 bg-ink-800'}`}>
            <View className="mb-1 flex-row items-center gap-2">
              <View className="h-6 w-6 items-center justify-center rounded-full bg-white/5">{coachIcon[m.kind]}</View>
              <Text className="font-bold leading-tight text-white">{m.title}</Text>
              <Text className="ml-auto text-[11px] text-tertiary">{i === 0 ? 'Today' : relativeLabel(m.dateKey)}</Text>
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
      <Text className="mt-2.5 text-[13.5px] leading-5 text-secondary">A calm, step by step path into your first 90 days. Nothing here assumes you know anything yet.</Text>

      <View className="mt-4 rounded-[20px] border border-white/[0.06] bg-ink-800 p-4">
        <View className="flex-row items-center justify-between gap-3">
          <Text className="text-[13px] font-bold text-white">{headline}</Text>
          <Text className="text-[12px] font-bold text-brand-400">{done.length}/{total} read</Text>
        </View>
        <View className="mt-[11px]"><ProgressBar value={(done.length / total) * 100} /></View>
        <Text className="mt-[9px] text-[11.5px] text-secondary">{note}</Text>
      </View>

      <View className="mb-3 mt-[22px] flex-row items-center justify-between px-0.5">
        <Text className="text-[11px] font-bold uppercase tracking-wider text-tertiary">The basics</Text>
        <Text className="text-[11.5px] text-tertiary">Read in any order</Text>
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
                  <View className="h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-white/[0.14]"><Text className="text-[12.5px] font-bold text-secondary">{i + 1}</Text></View>
                )}
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-center gap-1.5">
                    <Text className={`text-[14.5px] font-bold leading-tight ${isDone ? 'text-secondary' : 'text-white'}`}>{l.title}</Text>
                    {isNext && (
                      <View className="rounded-full bg-brand-400/[0.16] px-2 py-0.5">
                        <Text className="text-[9.5px] font-bold uppercase tracking-wide text-brand-300">Start here</Text>
                      </View>
                    )}
                  </View>
                  <Text numberOfLines={1} className="mt-[3px] text-[12px] leading-tight text-secondary">{l.summary}</Text>
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

      <Text className="mt-5 px-3 text-center text-[12px] leading-[1.55] text-tertiary">Nobody is watching you as closely as you think. Take these one at a time.</Text>
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
        <Text className="mt-1 text-[14px] leading-snug text-secondary">Easy meals with every step laid out. Pick one and cook along.</Text>
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
                  <Text className="text-[12px] text-secondary">{m.minutes} min · serves {m.serves}</Text>
                  <View className="mt-1 flex-row flex-wrap gap-1">{m.tags.slice(0, 2).map((t) => <Chip key={t} color="green">{t}</Chip>)}</View>
                </View>
                <ChevronDown size={18} color="rgba(255,255,255,0.3)" style={{ flexShrink: 0, transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }} />
              </Pressable>
              {isOpen && (
                <View className="gap-3 border-t border-white/5 px-4 py-3">
                  <View>
                    <Text className="mb-1 text-[12px] font-bold uppercase tracking-wide text-tertiary">Ingredients</Text>
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
                    <Text className="mb-1 text-[12px] font-bold uppercase tracking-wide text-tertiary">Method</Text>
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
            <Text className="text-[10.5px] font-bold uppercase tracking-wider text-tertiary">Target</Text>
            <Text className="mt-1 text-[14.5px] font-bold text-white">{sets} × {reps} reps</Text>
          </View>
          <View className="flex-1 rounded-2xl bg-white/[0.04] px-3.5 py-3">
            <Text className="text-[10.5px] font-bold uppercase tracking-wider text-tertiary">Working weight</Text>
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
        <Text className="text-[11px] font-bold uppercase tracking-wider text-tertiary">If the station is taken</Text>
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
        <Text className="mt-3 max-w-[260px] text-center text-[14px] leading-snug text-secondary">That is the strongest you have logged on this lift. Quietly huge. Your cohort would love to see it.</Text>
      </View>
      <Pressable onPress={share} className="btn-primary w-full flex-row items-center justify-center gap-1.5 active:opacity-90"><Share2 size={16} color="#000" /><Text className="font-semibold text-black">Share with your cohort</Text></Pressable>
      <Pressable onPress={onClose} className="mt-2 w-full items-center rounded-full bg-ink-700 py-3 active:opacity-90"><Text className="text-sm font-semibold text-white/70">Keep it to myself</Text></Pressable>
    </Sheet>
  )
}

/* ===================== Coach messenger (1:1 chat) ================== */
// The 1:1 coach chat is now the first-class Coach TAB. This thin wrapper keeps the legacy overlay
// entry (`nav.open('coachChat')`, e.g. dashboard check-in CTAs / deep links) working by presenting
// the SAME shared body + engine (CoachScreen / useCoachChat) as a full-screen sheet — no second copy
// of the safety-critical send path.
export function CoachChatSheet({ open, onClose }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title="Coach" full bare>
      <CoachScreen chrome="sheet" active={open} onClose={onClose} />
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
      <Text className="mb-1 text-[12.5px] text-secondary">Anything the app didn't prescribe still counts.</Text>

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

      <Text className="mb-2.5 mt-[22px] text-[11px] font-bold uppercase tracking-wider text-tertiary">Duration</Text>
      <View className="flex-row items-center gap-2">
        {['15', '30', '45', '60'].map((m) => {
          const on = minutes === m
          return (
            <Pressable key={m} onPress={() => setMinutes(m)} className={`flex-1 items-center rounded-full border py-2.5 active:opacity-90 ${on ? 'border-brand-400 bg-brand-400' : 'border-white/[0.08] bg-white/[0.04]'}`}><Text className={`text-[13px] font-bold ${on ? 'text-black' : 'text-secondary'}`}>{m}m</Text></Pressable>
          )
        })}
        <View className="flex-row items-center gap-1.5">
          <TextInput
            keyboardType="numeric"
            value={minutes}
            onChangeText={(t) => setMinutes(t.replace(/\D/g, '').slice(0, 3))}
            className="w-[52px] rounded-full border border-white/10 bg-white/[0.03] px-1 py-2.5 text-center text-[13px] font-bold text-white"
          />
          <Text className="text-[12px] text-secondary">min</Text>
        </View>
      </View>

      <Text className="mb-2.5 mt-[22px] text-[11px] font-bold uppercase tracking-wider text-tertiary">Intensity</Text>
      <View className="flex-row gap-2">
        {(['easy', 'moderate', 'hard'] as const).map((i) => {
          const on = intensity === i
          return (
            <Pressable key={i} onPress={() => setIntensity(i)} className={`flex-1 items-center rounded-2xl border py-[11px] active:opacity-90 ${on ? 'border-brand-400/45 bg-brand-400/[0.16]' : 'border-white/[0.08] bg-white/[0.04]'}`}><Text className={`text-[13px] font-semibold capitalize ${on ? 'text-brand-300' : 'text-secondary'}`}>{i}</Text></Pressable>
          )
        })}
      </View>

      <View className="mt-[18px] flex-row items-center justify-between rounded-2xl border border-brand-400/[0.18] bg-brand-400/[0.06] px-4 py-3">
        <Text className="text-[13px] text-secondary">Estimated burn</Text>
        <Text className="text-[17px] font-extrabold text-brand-400">≈ {kcal} kcal</Text>
      </View>

      {/* Weekly activity: only these count toward "workouts this week" */}
      <View className="mt-2.5 flex-row items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-3">
        <View className="min-w-0 flex-1">
          <Text className="text-[13.5px] font-bold text-white">Repeat weekly</Text>
          <Text className="mt-0.5 text-[11.5px] text-secondary">Shows up every week automatically</Text>
        </View>
        <Pressable onPress={() => setWeekly((v) => !v)} className={`h-7 w-12 shrink-0 justify-center rounded-full px-[3px] active:opacity-90 ${weekly ? 'bg-brand-400' : 'bg-white/15'}`}>
          <View className="h-[22px] w-[22px] rounded-full bg-white" style={{ transform: [{ translateX: weekly ? 20 : 0 }] }} />
        </Pressable>
      </View>

      <Pressable onPress={save} className="btn-primary mt-5 w-full active:opacity-90"><Text className="font-semibold text-black">Log {name.toLowerCase()} · {mins} min</Text></Pressable>
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
  const featured = dashboardFeaturedId(state)
  const atMax = stats.length >= MAX_DASHBOARD_STATS

  function pickFeatured(id: string) {
    dispatch({ type: 'SET_SETTINGS', patch: { dashboardFeatured: id } })
  }

  // Dashboard "Training progress" card config (independent of the Progress screen).
  const trackedIds = dashboardTrackedIds(state)
  const liftPeriod = dashboardLiftPeriod(state)
  const trackedRows = trackedIds.map((id) => ({ id, name: exById(id)?.name ?? id, muscle: exById(id)?.muscle ?? '' }))
  const [liftQuery, setLiftQuery] = useState('')
  const lq = liftQuery.trim().toLowerCase()
  const liftResults = lq
    ? EXERCISES.filter((e) => e.name.toLowerCase().includes(lq) || e.muscle.toLowerCase().includes(lq)).slice(0, 8)
    : []
  function setLiftPeriod(p: ProgressLiftPeriod) {
    dispatch({ type: 'SET_SETTINGS', patch: { dashboardLiftPeriod: p } })
  }
  function toggleTracked(id: string) {
    const has = trackedIds.includes(id)
    // Removing the last lift is allowed — an empty list hides the card entirely.
    if (has) dispatch({ type: 'SET_SETTINGS', patch: { dashboardTrackedIds: trackedIds.filter((x) => x !== id) } })
    else dispatch({ type: 'SET_SETTINGS', patch: { dashboardTrackedIds: [...trackedIds, id] } })
  }

  // Progress tab: the featured metric, and any exercise pinned via search.
  const [query, setQuery] = useState('')
  const pinnedEx = exById(metric)
  const q = query.trim().toLowerCase()
  const results = q ? EXERCISES.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 7) : []

  function pickMetric(id: string) {
    dispatch({ type: 'SET_SETTINGS', patch: { progressMetric: id } })
  }

  // Design behaviour: enabling is blocked once three are on (the row dims);
  // turn one off first. All stats can be turned off — an empty grid hides the
  // overview cards entirely (the user's choice).
  function toggleStat(id: string) {
    const has = stats.includes(id)
    if (has) {
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
      setLiftQuery('')
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
            {isProgress ? 'Choose the time window, then pick one stat to feature.' : 'Choose the time window, then pick up to four stats.'}
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
                {/* Featured stat — the big composition card under "Progress overview". */}
                <Text style={{ marginTop: 20, marginBottom: 4, fontSize: 12, fontWeight: '700', letterSpacing: 0.72, textTransform: 'uppercase', color: `${colors.fg}73` }}>Featured stat</Text>
                <Text style={{ marginBottom: 12, fontSize: 13, color: `${colors.fg}80` }}>The large card under Progress overview.</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
                  {DASHBOARD_FEATURED.map((m) => {
                    const on = featured === m.id
                    const accent = accentFor(m.accent, colors)
                    return (
                      <Pressable
                        key={m.id}
                        onPress={() => pickFeatured(m.id)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={`Feature ${m.label}`}
                        style={{ width: '47.8%', flexGrow: 1, gap: 12, padding: 14, borderRadius: 16, backgroundColor: on ? `${colors.brand400}1a` : colors.ink700, borderWidth: 1, borderColor: on ? `${colors.brand400}73` : `${colors.fg}10` }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 24 }}>
                          <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: `${accent}26` }}>
                            <Icon name={m.icon} size={18} color={accent} />
                          </View>
                          {on && (
                            <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand400 }}>
                              <Check size={14} strokeWidth={3} color="#0a0a0b" />
                            </View>
                          )}
                        </View>
                        <Text style={{ fontWeight: '700', fontSize: 14.5, color: colors.fg }}>{m.label}</Text>
                      </Pressable>
                    )
                  })}
                  {/* None — hides the featured card entirely. */}
                  {(() => {
                    const on = featured === 'none'
                    return (
                      <Pressable
                        key="none"
                        onPress={() => pickFeatured('none')}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel="No featured stat"
                        style={{ width: '47.8%', flexGrow: 1, gap: 12, padding: 14, borderRadius: 16, backgroundColor: on ? `${colors.brand400}1a` : colors.ink700, borderWidth: 1, borderColor: on ? `${colors.brand400}73` : `${colors.fg}10` }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 24 }}>
                          <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: `${colors.fg}12` }}>
                            <Ban size={18} color={`${colors.fg}8c`} />
                          </View>
                          {on && (
                            <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand400 }}>
                              <Check size={14} strokeWidth={3} color="#0a0a0b" />
                            </View>
                          )}
                        </View>
                        <Text style={{ fontWeight: '700', fontSize: 14.5, color: colors.fg }}>None</Text>
                      </Pressable>
                    )
                  })()}
                </View>

                <View style={{ height: 1, backgroundColor: `${colors.fg}0f`, marginTop: 22 }} />

                {/* Your stats */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 2 }}>
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

                <View style={{ height: 1, backgroundColor: `${colors.fg}0f`, marginTop: 22 }} />

                {/* Training progress — configures the dashboard's ranked-lifts card,
                    independently of the Progress screen's own tracked lifts. */}
                <Text style={{ marginTop: 22, marginBottom: 4, fontSize: 12, fontWeight: '700', letterSpacing: 0.72, textTransform: 'uppercase', color: `${colors.fg}73` }}>Training progress</Text>
                <Text style={{ marginBottom: 16, fontSize: 13, color: `${colors.fg}80` }}>The ranked lifts card under Progress overview.</Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.55, textTransform: 'uppercase', color: `${colors.fg}66` }}>Tracked lifts</Text>
                  <View style={{ paddingHorizontal: 9, paddingVertical: 2, borderRadius: 999, backgroundColor: trackedIds.length ? `${colors.brand400}26` : `${colors.fg}14` }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: trackedIds.length ? colors.brand300 : `${colors.fg}80` }}>{trackedIds.length}</Text>
                  </View>
                </View>

                {trackedRows.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 22, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: `${colors.fg}1a`, borderStyle: 'dashed', backgroundColor: `${colors.fg}06` }}>
                    <Text style={{ fontSize: 13.5, fontWeight: '700', color: `${colors.fg}99` }}>No lifts tracked</Text>
                    <Text style={{ marginTop: 3, fontSize: 12.5, color: `${colors.fg}66`, textAlign: 'center' }}>The card is hidden. Search below to add one.</Text>
                  </View>
                ) : (
                  <View style={{ gap: 8 }}>
                    {trackedRows.map((t) => (
                      <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 14, backgroundColor: colors.ink700, borderWidth: 1, borderColor: `${colors.fg}10` }}>
                        <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: `${colors.brand400}1f` }}>
                          <Icon name="dumbbell" size={17} color={colors.brand400} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: '700', color: colors.fg }}>{t.name}</Text>
                          {!!t.muscle && <Text style={{ fontSize: 11.5, color: `${colors.fg}73`, marginTop: 1 }}>{t.muscle}</Text>}
                        </View>
                        <Pressable onPress={() => toggleTracked(t.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${t.name}`} style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: `${colors.fg}12` }}>
                          <X size={14} color={`${colors.fg}8c`} strokeWidth={2.4} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}

                <Text style={{ marginTop: 20, marginBottom: 9, fontSize: 11, fontWeight: '700', letterSpacing: 0.55, textTransform: 'uppercase', color: `${colors.fg}66` }}>Trend range</Text>
                <View style={{ flexDirection: 'row', gap: 4, backgroundColor: colors.ink700, padding: 4, borderRadius: 13 }}>
                  {PROGRESS_LIFT_PERIODS.map((pp) => {
                    const on = liftPeriod === pp
                    const label = pp === '4 weeks' ? '4 Weeks' : pp === '3 months' ? '3 Months' : '6 Months'
                    return (
                      <Pressable key={pp} onPress={() => setLiftPeriod(pp)} accessibilityRole="button" accessibilityState={{ selected: on }} style={tabStyle(on)}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: on ? '#0a0a0b' : `${colors.fg}8c` }}>{label}</Text>
                      </Pressable>
                    )
                  })}
                </View>

                <Text style={{ marginTop: 20, marginBottom: 9, fontSize: 11, fontWeight: '700', letterSpacing: 0.55, textTransform: 'uppercase', color: `${colors.fg}66` }}>Add a lift</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, backgroundColor: colors.ink700, borderWidth: 1, borderColor: `${colors.fg}14` }}>
                  <Search size={18} color={`${colors.fg}66`} />
                  <TextInput value={liftQuery} onChangeText={setLiftQuery} placeholder="Search exercises" placeholderTextColor={`${colors.fg}59`} style={{ flex: 1, minWidth: 0, fontSize: 15, color: colors.fg, paddingVertical: 0 }} />
                  {liftQuery.length > 0 && <Pressable onPress={() => setLiftQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search"><X size={15} color={`${colors.fg}73`} /></Pressable>}
                </View>
                {lq.length > 0 && (
                  <View style={{ marginTop: 10, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.ink700, borderWidth: 1, borderColor: `${colors.fg}10` }}>
                    {liftResults.map((e, i) => {
                      const on = trackedIds.includes(e.id)
                      return (
                        <Pressable key={e.id} onPress={() => toggleTracked(e.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, paddingVertical: 11, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: `${colors.fg}10` }}>
                          <View style={{ width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: `${colors.fg}0f` }}>
                            <Icon name="dumbbell" size={16} color={on ? colors.brand400 : `${colors.fg}8c`} />
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.fg }}>{e.name}</Text>
                            <Text style={{ fontSize: 12, color: `${colors.fg}73`, marginTop: 1 }}>{e.muscle}</Text>
                          </View>
                          {on ? (
                            <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand400 }}><Check size={15} strokeWidth={3} color="#0a0a0b" /></View>
                          ) : (
                            <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: `${colors.fg}14`, borderWidth: 1, borderColor: `${colors.fg}26` }}><Plus size={15} color={`${colors.fg}73`} /></View>
                          )}
                        </Pressable>
                      )
                    })}
                    {liftResults.length === 0 && <Text style={{ textAlign: 'center', fontSize: 13, color: `${colors.fg}73`, padding: 14 }}>No exercises match your search.</Text>}
                  </View>
                )}
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
      <Text className="mb-2 text-[11px] font-bold uppercase tracking-wider text-tertiary">Workout name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Friday Arms"
        placeholderTextColor="rgba(255,255,255,0.35)"
        className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-[14px] text-white"
      />

      <Text className="mb-2 mt-[22px] text-[11px] font-bold uppercase tracking-wider text-tertiary">Exercises</Text>

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
                    <Text numberOfLines={1} className="mt-px text-[11.5px] text-secondary">{e.muscleGroup} · {e.type}</Text>
                  </View>
                  <View className={`h-[26px] w-[26px] items-center justify-center rounded-full ${on ? 'bg-brand-400' : 'border-2 border-white/20'}`}>
                    {on ? <Check size={14} strokeWidth={3} color="#000" /> : <Plus size={14} strokeWidth={3} color="rgba(255,255,255,0.5)" />}
                  </View>
                </Pressable>
              )
            })}
            {catalog.length === 0 && <Text className="py-5 text-center text-[13px] text-tertiary">No exercises found.</Text>}
          </View>
        </View>
      )}

      {/* Picks */}
      {items.length === 0 ? (
        <View className="mt-3.5 items-center rounded-[18px] border border-dashed border-white/15 px-6 py-[22px]">
          <Text className="text-[13.5px] font-semibold text-secondary">No exercises yet</Text>
          <Text className="mt-[3px] text-center text-[12px] text-tertiary">Pick a few from the list above to build your session</Text>
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
                    <Text numberOfLines={1} className="mt-px text-[11.5px] text-secondary">{muscleFor(it.defId)}</Text>
                  </View>
                  <Pressable onPress={() => removeItem(it.defId)} hitSlop={6} className="h-7 w-7 items-center justify-center rounded-full bg-white/5 active:opacity-80">
                    <X size={13} strokeWidth={2.6} color="rgba(255,255,255,0.45)" />
                  </Pressable>
                </View>

                <View className="mt-3 flex-row items-start gap-2.5">
                  {/* Sets */}
                  <View className="flex-1">
                    <Text className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-tertiary">Sets</Text>
                    <View className="flex-row items-center gap-2">
                      <Pressable onPress={() => patchItem(it.defId, { targetSets: Math.max(1, it.targetSets - 1) })} className="h-[34px] w-[34px] items-center justify-center rounded-xl bg-white/[0.06] active:opacity-80"><Minus size={15} color="rgba(255,255,255,0.7)" /></Pressable>
                      <Text className="flex-1 text-center text-[15px] font-bold text-white">{it.targetSets}</Text>
                      <Pressable onPress={() => patchItem(it.defId, { targetSets: Math.min(8, it.targetSets + 1) })} className="h-[34px] w-[34px] items-center justify-center rounded-xl bg-white/[0.06] active:opacity-80"><Plus size={15} color="rgba(255,255,255,0.7)" /></Pressable>
                    </View>
                  </View>
                  {/* Target reps */}
                  <View className="flex-1">
                    <Text className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-tertiary">Target reps</Text>
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
            <Text className="text-[13px] text-secondary">{items.length} exercise{items.length === 1 ? '' : 's'} · {totalSets} sets</Text>
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
