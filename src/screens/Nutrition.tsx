import { useMemo, useState, useRef, useEffect, type ReactNode } from 'react'
import {
  View, Text, Pressable, ScrollView, TextInput, Image,
  KeyboardAvoidingView, Platform, Share, Animated, Easing,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Circle, G } from 'react-native-svg'
import {
  Sparkles, Send, Check, ArrowRight, ChevronDown, ChevronRight, Clock,
  Droplet, Plus, Trash2, Share2, Search, Lightbulb, Salad, X,
} from 'lucide-react-native'
import { Icon } from '../components/Icon'
import { AppModal } from '../components/WebFrame'
import { ProgressRing, SegmentedTabs, ScreenHeader } from '../components/ui'
import { useStore } from '../store/store'
import { useToast } from '../components/Toast'
import {
  PLATE_GUIDE, FOOD_TIERS, PORTION_GUIDE, EATING_PRINCIPLES, NUTRITION_LESSONS, NUTRITION_TAGS, TAG_TONE_VAR,
} from '../data/nutrition'
import { BUDGET_MEALS, FOODS } from '../data/catalog'
import { todayHabit, nutritionTagsForDay } from '../store/selectors'
import { dailyTargets } from '../store/training'
import { fmtFluid, pct } from '../lib/format'
import { coachRespond, STARTER_QUESTIONS, type DayReview } from '../lib/nutritionCoach'
import type { MealName, MealCategory, BudgetMeal } from '../store/types'
import { brand, accent, useColors } from '../theme'

const PLACEHOLDER = 'rgba(148,148,148,0.6)'

const TABS = ['Coach', 'Help', 'Eats', 'My Meal Plan']
const PLAN_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const SLOTS: MealName[] = ['Breakfast', 'Lunch', 'Snack', 'Dinner']

/* ---- Colour helpers: resolve the data files' `rgb(var(--x))` strings ---- */
type Colors = ReturnType<typeof useColors>
function resolveColor(colors: Colors, css: string): string {
  const key = css.match(/--[a-z0-9-]+/i)?.[0]
  switch (key) {
    case '--brand-300': return colors.brand300
    case '--brand-400': return colors.brand400
    case '--brand-500': return colors.brand500
    case '--accent-blue': return colors.accentBlue
    case '--accent-purple': return colors.accentPurple
    case '--accent-orange': return colors.accentOrange
    case '--accent-yellow': return colors.accentYellow
    case '--danger': return colors.danger
    default: return colors.fg
  }
}
function alpha(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

export default function Nutrition() {
  const [tab, setTab] = useState('Coach')
  return (
    <View className="px-5 pt-2">
      <ScreenHeader title="Nutrition" />
      <SegmentedTabs tabs={TABS} active={tab} onChange={setTab} />
      <View className="mt-5">
        {tab === 'Coach' && <CoachTab />}
        {tab === 'Help' && <LearnTab />}
        {tab === 'Eats' && <BudgetTab />}
        {tab === 'My Meal Plan' && <PlanTab />}
      </View>
    </View>
  )
}

/* ============================ Coach tab ============================ */
interface ChatMsg {
  id: string
  role: 'user' | 'coach'
  text?: string
  topic?: string
  review?: DayReview
  status?: 'sending' | 'sent'
}

let msgSeq = 0
const nextId = () => `nc${++msgSeq}`

/* Green gradient coach avatar, optionally with an "online" dot. */
function CoachAvatar({ size = 36, dot = false, ringColor = '#121214' }: { size?: number; dot?: boolean; ringColor?: string }) {
  return (
    <View>
      <LinearGradient
        colors={[brand[300], brand[500]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}
      >
        <Salad size={Math.round(size * 0.5)} color="#000" />
      </LinearGradient>
      {dot && (
        <View
          style={{
            position: 'absolute', bottom: -2, right: -2,
            width: 12, height: 12, borderRadius: 6,
            backgroundColor: brand[400], borderWidth: 2, borderColor: ringColor,
          }}
        />
      )}
    </View>
  )
}

function CoachTab() {
  const { state, dispatch } = useStore()
  const goal = state.profile.goal
  const insets = useSafeAreaInsets()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const scrollRef = useRef<ScrollView>(null)
  const inputRef = useRef<TextInput>(null)

  function handleClose() {
    setOpen(false)
  }

  // Focus the input once the open transition has settled.
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => inputRef.current?.focus(), 340)
    return () => clearTimeout(t)
  }, [open])

  function send(raw?: string) {
    const msg = (raw ?? input).trim()
    if (!msg || typing) return
    setInput('')

    // Asking the coach ticks the dashboard "Ask a Q" goal for today.
    dispatch({ type: 'MARK_NUTRITION_ASKED' })

    const id = nextId()
    setMessages((m) => [...m, { id, role: 'user', text: msg, status: 'sending' }])
    // A beat later the message reads as sent, the way a tick lands in WhatsApp.
    setTimeout(() => {
      setMessages((m) => m.map((x) => (x.id === id ? { ...x, status: 'sent' } : x)))
    }, 480)

    setTyping(true)
    const reply = coachRespond(msg, goal)
    // Keep saving day reviews so the dashboard food check-in stays in sync.
    if (reply.kind === 'review' && !reply.review.empty) {
      dispatch({ type: 'SAVE_FOOD_REVIEW', text: msg, score: reply.review.score })
    }
    const delay = 850 + Math.min(900, msg.length * 11)
    setTimeout(() => {
      setTyping(false)
      setMessages((m) => [
        ...m,
        reply.kind === 'review'
          ? { id: nextId(), role: 'coach', review: reply.review }
          : { id: nextId(), role: 'coach', text: reply.answer.answer, topic: reply.answer.matched ? reply.answer.question : undefined },
      ])
    }, delay)
  }

  function openChat(initial?: string) {
    setOpen(true)
    if (initial) send(initial)
  }

  const showSuggestions = messages.length === 0 && !typing
  const canSend = !!input.trim() && !typing

  return (
    <>
      {/* Quick day tags: fast, tap-only "how did your eating today go" */}
      <DayTagsCard />

      {/* Unified nutrition coach: one chat for "what I ate" and "ask anything" */}
      <NutritionCoachCard onOpen={() => openChat()} onAsk={(q) => openChat(q)} />

      {/* Water quick-log */}
      <WaterCard />
      <View className="h-2" />

      {/* Full-screen chat experience */}
      <AppModal visible={open} animationType="slide" onRequestClose={handleClose}>
        <View className="flex-1 bg-ink-900" style={{ paddingTop: insets.top }}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {/* Header */}
            <View className="flex-row items-center gap-2.5 px-3 py-2.5">
              <Pressable onPress={handleClose} className="h-9 w-9 shrink-0 items-center justify-center rounded-full active:opacity-70">
                <X size={22} color={brand[400]} />
              </Pressable>
              <CoachAvatar size={36} dot ringColor="#0a0a0b" />
              <View className="min-w-0 flex-1">
                <Text numberOfLines={1} className="text-[15px] font-bold leading-tight text-white">Nutrition coach</Text>
                <Text className="text-[12px] leading-tight text-white/45">Active now</Text>
              </View>
            </View>
            <View className="h-px bg-white/[0.06]" />

            {/* Messages */}
            <ScrollView
              ref={scrollRef}
              className="flex-1 px-3"
              contentContainerStyle={{ paddingTop: 8, paddingBottom: 12 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            >
              {/* Thread intro */}
              <View className="items-center px-6 pb-5 pt-4">
                <CoachAvatar size={68} dot ringColor="#0a0a0b" />
                <Text className="mt-3 text-[17px] font-bold text-white">Nutrition coach</Text>
                <Text className="mt-0.5 max-w-[16rem] text-center text-[13px] leading-snug text-white/45">
                  Tell me what you ate today for an honest review, or ask me anything about food. No calorie counting.
                </Text>
              </View>

              {messages.map((m) => {
                const isUser = m.role === 'user'

                if (m.review) {
                  return (
                    <View key={m.id} className="mt-2.5 flex-row items-end justify-start gap-1.5">
                      <View className="self-end"><CoachAvatar size={24} /></View>
                      <View style={{ maxWidth: '92%' }}>
                        <ReviewBubble review={m.review} />
                      </View>
                    </View>
                  )
                }

                return (
                  <View key={m.id}>
                    <View className={`mt-2.5 flex-row items-end gap-1.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                      {!isUser && <View className="self-end"><CoachAvatar size={24} /></View>}
                      <View
                        style={{ maxWidth: '82%' }}
                        className={`px-3.5 py-2.5 ${isUser ? 'rounded-[20px] rounded-br-md bg-brand-400' : 'rounded-[20px] rounded-bl-md bg-ink-700'}`}
                      >
                        {!isUser && m.topic && <Text className="mb-1 text-[12.5px] font-bold text-brand-400">{m.topic}</Text>}
                        <Text className={`text-[14.5px] leading-snug ${isUser ? 'text-black' : 'text-white'}`}>{m.text}</Text>
                      </View>
                    </View>
                    {isUser && (
                      <View className="mt-1 flex-row items-center justify-end gap-1 pr-1">
                        {m.status === 'sending' ? (
                          <>
                            <Clock size={11} color="rgba(255,255,255,0.35)" />
                            <Text className="text-[10.5px] font-medium text-white/35">Sending</Text>
                          </>
                        ) : (
                          <>
                            <Check size={12} color={brand[400]} />
                            <Text className="text-[10.5px] font-medium text-white/35">Sent</Text>
                          </>
                        )}
                      </View>
                    )}
                  </View>
                )
              })}

              {typing && (
                <View className="mt-2.5 flex-row items-end justify-start gap-1.5">
                  <View className="self-end"><CoachAvatar size={24} /></View>
                  <View className="flex-row items-center gap-1 rounded-[20px] rounded-bl-md bg-ink-700 px-4 py-3.5">
                    <TypingDots />
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Quick-start chips */}
            {showSuggestions && (
              <View className="px-3 pb-2">
                <Text className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-white/35">Try asking</Text>
                <View className="gap-1.5">
                  <Pressable
                    onPress={() => inputRef.current?.focus()}
                    className="flex-row items-center gap-2.5 rounded-2xl border border-white/[0.08] bg-ink-800 px-3.5 py-2.5 active:opacity-80"
                  >
                    <Salad size={15} color={brand[400]} />
                    <Text className="flex-1 text-[13.5px] font-medium text-white/85">Tell me what I ate today</Text>
                    <ChevronRight size={15} color="rgba(255,255,255,0.25)" />
                  </Pressable>
                  {STARTER_QUESTIONS.slice(0, 4).map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => send(s)}
                      className="flex-row items-center gap-2.5 rounded-2xl border border-white/[0.08] bg-ink-800 px-3.5 py-2.5 active:opacity-80"
                    >
                      <Sparkles size={15} color={brand[400]} />
                      <Text className="flex-1 text-[13.5px] font-medium text-white/85">{s}</Text>
                      <ChevronRight size={15} color="rgba(255,255,255,0.25)" />
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Input */}
            <View className="flex-row items-end gap-2 px-3 pt-1.5" style={{ paddingBottom: insets.bottom + 12 }}>
              <View className="flex-1 flex-row items-end rounded-[22px] bg-ink-800 px-1 py-1">
                <TextInput
                  ref={inputRef}
                  value={input}
                  onChangeText={setInput}
                  multiline
                  placeholder="Tell me what you ate, or ask…"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  className="max-h-28 min-h-[40px] flex-1 bg-transparent px-3.5 py-2 text-[15px] text-white"
                />
              </View>
              <Pressable
                onPress={() => send()}
                disabled={!canSend}
                className={`h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-400 active:opacity-90 ${canSend ? '' : 'opacity-50'}`}
              >
                <Send size={18} color="#000" />
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </AppModal>
    </>
  )
}

/* Entry point in the Coach tab: a compact DM-style preview that opens the
   full-screen chat when tapped. */
function NutritionCoachCard({ onOpen, onAsk }: { onOpen: () => void; onAsk: (q: string) => void }) {
  return (
    <View className="mt-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-800 p-4">
      <View className="flex-row items-center gap-3">
        <CoachAvatar size={44} dot ringColor="#121214" />
        <View className="min-w-0 flex-1">
          <Text className="text-[14.5px] font-semibold leading-snug text-white/90">Tell me what you ate, or ask me anything</Text>
        </View>
      </View>

      <Pressable
        onPress={onOpen}
        className="mt-4 w-full flex-row items-center gap-2 rounded-full border border-white/[0.08] bg-ink-900/60 px-4 py-3 active:opacity-90"
      >
        <Text className="flex-1 text-[14.5px] text-white/35">Message your coach…</Text>
        <View className="h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-400"><Send size={15} color="#000" /></View>
      </Pressable>

      <View className="mt-3 flex-row flex-wrap gap-2">
        <Pressable onPress={() => onAsk('Are sandwiches healthy?')} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 active:opacity-80">
          <Text className="text-[12.5px] font-medium text-white/70">Are sandwiches healthy?</Text>
        </Pressable>
        {STARTER_QUESTIONS.slice(0, 3).map((q) => (
          <Pressable key={q} onPress={() => onAsk(q)} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 active:opacity-80">
            <Text className="text-[12.5px] font-medium text-white/70">{q}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

function DayTagsCard() {
  const { state, dispatch } = useStore()
  const colors = useColors()
  const selected = nutritionTagsForDay(state)

  return (
    <View className="rounded-2xl bg-ink-800 p-5">
      <Text className="text-center text-[17px] font-bold leading-tight text-white">How did your eating today go?</Text>
      <View className="mt-4 flex-row flex-wrap justify-between">
        {NUTRITION_TAGS.map((tag) => {
          const on = selected.includes(tag.id)
          const c = resolveColor(colors, TAG_TONE_VAR[tag.tone])
          return (
            <Pressable
              key={tag.id}
              onPress={() => dispatch({ type: 'TOGGLE_NUTRITION_TAG', tag: tag.id })}
              className="items-center gap-1 rounded-xl py-3 active:opacity-80"
              style={{
                width: '32%',
                marginBottom: 8,
                borderWidth: 1,
                backgroundColor: on ? alpha(c, 0.16) : 'rgba(255,255,255,0.05)',
                borderColor: on ? alpha(c, 0.35) : 'rgba(255,255,255,0.08)',
              }}
            >
              <Text className="text-[18px] leading-none">{tag.emoji}</Text>
              <Text className="text-center text-[12px] font-semibold leading-tight" style={{ color: on ? c : alpha(colors.fg, 0.65) }}>{tag.label}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

/* Compact day-review rendered as a coach chat bubble. */
function ReviewBubble({ review }: { review: DayReview }) {
  const colors = useColors()
  const tierVar: Record<string, string> = { great: '--brand-500', good: '--brand-400', moderate: '--accent-orange', limit: '--danger' }
  return (
    <View className="rounded-[20px] rounded-bl-md bg-ink-700 p-3.5">
      <View className="flex-row items-center gap-3">
        <ProgressRing value={review.score * 10} size={58} stroke={6} color={review.score >= 5 ? brand[400] : accent.orange}>
          <Text className="text-lg font-extrabold leading-none text-white">{review.score}</Text>
        </ProgressRing>
        <View className="min-w-0 flex-1">
          <Text className="text-[15px] font-extrabold leading-tight text-white">{review.verdict}</Text>
          <Text className="mt-0.5 text-[12.5px] leading-snug text-white/60">{review.summary}</Text>
        </View>
      </View>

      {review.found.length > 0 && (
        <View className="mt-3 flex-row flex-wrap gap-1.5">
          {review.found.map((f, i) => {
            const c = resolveColor(colors, tierVar[f.tier])
            return (
              <View key={i} className="rounded-full px-2.5 py-1" style={{ backgroundColor: alpha(c, 0.14) }}>
                <Text className="text-[11px] font-semibold" style={{ color: c }}>{f.label}</Text>
              </View>
            )
          })}
        </View>
      )}

      {review.highlights.length > 0 && (
        <View className="mt-3">
          <Text className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-white/40">What went well</Text>
          <View className="gap-1.5">
            {review.highlights.map((h, i) => (
              <View key={i} className="flex-row items-start gap-2">
                <Check size={15} strokeWidth={3} color={brand[400]} style={{ marginTop: 2 }} />
                <Text className="flex-1 text-[12.5px] leading-snug text-white/75">{h}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {review.improvements.length > 0 && (
        <View className="mt-3">
          <Text className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-white/40">Try this next</Text>
          <View className="gap-1.5">
            {review.improvements.map((h, i) => (
              <View key={i} className="flex-row items-start gap-2">
                <ArrowRight size={15} strokeWidth={2.5} color={accent.orange} style={{ marginTop: 2 }} />
                <Text className="flex-1 text-[12.5px] leading-snug text-white/75">{h}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View className="mt-3 flex-row items-start gap-2 rounded-xl bg-brand-400/10 p-2.5">
        <Sparkles size={15} color={brand[400]} style={{ marginTop: 2 }} />
        <Text className="flex-1 text-[12.5px] font-medium leading-snug text-white/80">{review.encouragement}</Text>
      </View>
    </View>
  )
}

/* ============================ Learn tab ============================ */
function LearnTab() {
  const colors = useColors()
  const [openLesson, setOpenLesson] = useState<string | null>(null)

  return (
    <View className="gap-9 pb-2">

      {/* The balanced plate: a big, tappable visual that does the explaining */}
      <View>
        <SectionLabel>The balanced plate</SectionLabel>
        <BalancedPlate />
      </View>

      {/* Portion sizes by hand */}
      <View>
        <SectionLabel>Portion sizes, by hand</SectionLabel>
        <Text className="-mt-1 text-[12.5px] leading-snug text-white/50">No scales needed. Your own hand is a guide that scales with you.</Text>
        <View className="mt-1">
          {PORTION_GUIDE.map((p, i) => {
            const c = resolveColor(colors, p.color)
            return (
              <View key={p.title} className={`flex-row items-center gap-3.5 py-3.5 ${i === 0 ? '' : 'border-t border-white/[0.06]'}`}>
                <View className="h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: alpha(c, 0.12) }}>
                  <Text className="text-[24px]">{p.emoji}</Text>
                </View>
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-baseline gap-2">
                    <Text className="text-[14px] font-bold" style={{ color: c }}>{p.title}</Text>
                    <Text className="text-[11px] font-semibold uppercase tracking-wide text-white/35">{p.hand}</Text>
                  </View>
                  <Text className="mt-0.5 text-[12.5px] leading-snug text-white/60">{p.desc}</Text>
                </View>
              </View>
            )
          })}
        </View>
      </View>

      {/* Eat more / balance / sometimes */}
      <View>
        <SectionLabel>What to eat more, and less, of</SectionLabel>
        <View>
          {FOOD_TIERS.map((t, i) => {
            const c = resolveColor(colors, t.color)
            return (
              <View key={t.tier} className={`flex-row gap-3 py-4 ${i === 0 ? '' : 'border-t border-white/[0.06]'}`}>
                <View className="w-1 shrink-0 self-stretch rounded-full" style={{ backgroundColor: c }} />
                <View className="min-w-0 flex-1">
                  <Text className="font-bold" style={{ color: c }}>{t.title}</Text>
                  <Text className="mt-1 text-[12.5px] leading-snug text-white/60">{t.desc}</Text>
                  <View className="mt-2.5 flex-row flex-wrap gap-1.5">
                    {t.items.map((it) => (
                      <View key={it} className="rounded-full bg-white/[0.05] px-2.5 py-1">
                        <Text className="text-[11px] font-medium text-white/70">{it}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )
          })}
        </View>
      </View>

      {/* Simple everyday wins */}
      <View>
        <SectionLabel>Simple everyday wins</SectionLabel>
        <View>
          {EATING_PRINCIPLES.map((p, i) => (
            <View key={p.title} className={`flex-row items-start gap-3.5 py-3.5 ${i === 0 ? '' : 'border-t border-white/[0.06]'}`}>
              <View className="h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-400/[0.12]"><Icon name={p.icon} size={18} color={brand[400]} /></View>
              <View className="min-w-0 flex-1">
                <Text className="text-[14px] font-bold leading-tight text-white">{p.title}</Text>
                <Text className="mt-0.5 text-[12.5px] leading-snug text-white/60">{p.text}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Go deeper: short reads */}
      <View>
        <SectionLabel>Go deeper</SectionLabel>
        <View>
          {NUTRITION_LESSONS.map((l, i) => {
            const open = openLesson === l.id
            return (
              <View key={l.id} className={i === 0 ? '' : 'border-t border-white/[0.06]'}>
                <Pressable onPress={() => setOpenLesson(open ? null : l.id)} className="flex-row items-center gap-3 py-3.5 active:opacity-80">
                  <View className="h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-400/[0.12]"><Icon name={l.icon} size={19} color={brand[400]} /></View>
                  <View className="min-w-0 flex-1">
                    <Text className="font-bold leading-tight text-white">{l.title}</Text>
                    <Text numberOfLines={1} className="text-[12px] text-white/50">{l.summary} · {l.minutes} min</Text>
                  </View>
                  <ChevronDown size={18} color="rgba(255,255,255,0.3)" style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
                </Pressable>
                {open && (
                  <View className="gap-2.5 pb-4 pr-1" style={{ paddingLeft: 52 }}>
                    {l.body.map((para, j) => (
                      <Text key={j} className="text-[13px] leading-relaxed text-white/70">{para}</Text>
                    ))}
                  </View>
                )}
              </View>
            )
          })}
        </View>
      </View>
    </View>
  )
}

/* The big, tappable balanced-plate donut. Tap a colour (or a legend chip) to
   see how much of that food group to aim for, plus what counts. */
const PLATE_SEGMENTS = [
  { len: 50, start: 0 },  // veg
  { len: 25, start: 50 }, // protein
  { len: 25, start: 75 }, // carbs
]

function BalancedPlate() {
  const colors = useColors()
  const [sel, setSel] = useState(0)

  const active = PLATE_GUIDE[sel]
  const activeColor = resolveColor(colors, active.color)

  return (
    <View>
      {/* Donut */}
      <View style={{ width: 230, height: 230, alignSelf: 'center', marginTop: 4 }}>
        <Svg viewBox="0 0 42 42" width={230} height={230}>
          <G rotation={-90} originX={21} originY={21}>
            <Circle cx={21} cy={21} r={15.915} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={5} />
            {PLATE_SEGMENTS.map((s, i) => {
              const isSel = sel === i
              return (
                <Circle
                  key={i}
                  cx={21} cy={21} r={15.915} fill="none"
                  stroke={resolveColor(colors, PLATE_GUIDE[i].color)}
                  strokeWidth={isSel ? 6.6 : 4.6}
                  strokeDasharray={`${s.len} ${100 - s.len}`}
                  strokeDashoffset={-s.start}
                  onPress={() => setSel(i)}
                />
              )
            })}
          </G>
        </Svg>
        {/* Centre read-out */}
        <View pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Text className="text-[52px] font-black leading-none" style={{ color: activeColor }}>{active.portion}</Text>
          <Text className="mt-1.5 max-w-[8rem] text-center text-[13px] font-bold leading-tight text-white/85">{active.title}</Text>
        </View>
      </View>

      {/* Tappable legend */}
      <View className="mt-5 flex-row flex-wrap justify-between">
        {PLATE_GUIDE.map((s, i) => {
          const on = sel === i
          const c = resolveColor(colors, s.color)
          return (
            <Pressable
              key={s.title}
              onPress={() => setSel(i)}
              className="mb-2 flex-row items-center gap-2 rounded-full px-3 py-2 active:opacity-80"
              style={{
                width: '49%',
                borderWidth: 1,
                borderColor: on ? alpha(c, 0.45) : 'transparent',
                backgroundColor: on ? alpha(c, 0.14) : 'rgba(255,255,255,0.045)',
              }}
            >
              <Text className="text-[13px] font-black" style={{ color: c }}>{s.portion}</Text>
              <Text numberOfLines={1} className="flex-1 text-[12.5px] font-semibold" style={{ color: on ? c : alpha(colors.fg, 0.7) }}>{s.title}</Text>
            </Pressable>
          )
        })}
      </View>

      {/* Examples for the selected group */}
      <Text className="mt-3 text-[12.5px] leading-snug text-white/60">{active.examples}</Text>
      <Text className="mt-2.5 text-[11.5px] leading-snug text-white/35">Tap a colour to see what goes where. Not every meal needs to be perfect, it is just a rough aim.</Text>
    </View>
  )
}

/* ============================ Eats tab ============================ */
const MEAL_CATEGORIES: (MealCategory | 'All')[] = ['All', 'Breakfast', 'Lunch', 'Dinner', 'Snack', 'Sweet']

function BudgetTab() {
  const [cat, setCat] = useState<MealCategory | 'All'>('All')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const meals = useMemo(() => {
    return BUDGET_MEALS.filter((m) => {
      const catOk = cat === 'All' || m.category === cat
      const qOk = !q || m.name.toLowerCase().includes(q.toLowerCase()) || (m.flavour ?? '').toLowerCase().includes(q.toLowerCase())
      return catOk && qOk
    })
  }, [cat, q])

  const openMeal = BUDGET_MEALS.find((m) => m.id === openId) ?? null

  return (
    <>
      <MyMealsTab />

      <View className="mt-6">
        <Salad size={22} color={brand[400]} />
        <Text className="mt-2 text-xl font-extrabold tracking-tight text-white">Easy recipes worth cooking</Text>
      </View>

      {/* Category filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5 mt-4 px-5" contentContainerStyle={{ flexDirection: 'row', gap: 8 }}>
        {MEAL_CATEGORIES.map((c) => {
          const activeCat = cat === c
          return (
            <Pressable key={c} onPress={() => setCat(c)} className={`shrink-0 rounded-full px-3.5 py-2 active:opacity-80 ${activeCat ? 'bg-brand-400' : 'border border-white/10 bg-white/[0.04]'}`}>
              <Text className={`text-[13px] font-semibold ${activeCat ? 'text-black' : 'text-white/70'}`}>{c}</Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {/* Search */}
      <View className="mt-3 flex-row items-center gap-2 rounded-xl border border-white/[0.08] bg-ink-800 px-3">
        <Search size={16} color="rgba(255,255,255,0.35)" />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search recipes…"
          placeholderTextColor={PLACEHOLDER}
          className="w-full flex-1 bg-transparent py-2.5 text-sm text-white"
        />
      </View>

      {/* Recipe cards */}
      <Text className="mt-4 text-[12px] font-bold uppercase tracking-[0.14em] text-white/35">{meals.length} {meals.length === 1 ? 'recipe' : 'recipes'}</Text>
      <View className="mt-2 gap-2.5">
        {meals.map((m) => (
          <Pressable key={m.id} onPress={() => setOpenId(m.id)} className="w-full flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-3 active:opacity-90">
            <Image source={{ uri: m.image }} resizeMode="cover" className="h-16 w-16 rounded-xl" />
            <View className="min-w-0 flex-1">
              <Text className="font-bold leading-tight text-white">{m.name}</Text>
              {m.flavour && <Text numberOfLines={2} className="mt-0.5 text-[12px] leading-snug text-white/55">{m.flavour}</Text>}
              <View className="mt-1 flex-row items-center gap-1">
                <Clock size={12} color={brand[400]} />
                <Text className="text-[12px] font-semibold text-brand-400">{m.minutes} min</Text>
              </View>
            </View>
            <ChevronRight size={18} color="rgba(255,255,255,0.3)" />
          </Pressable>
        ))}
        {meals.length === 0 && (
          <View className="items-center rounded-2xl border border-dashed border-white/[0.12] px-6 py-10" style={{ borderStyle: 'dashed' }}>
            <Salad size={26} color="rgba(255,255,255,0.3)" />
            <Text className="mt-2 text-sm font-semibold text-white/60">No recipes match that</Text>
            <Text className="mt-1 text-center text-[12px] text-white/40">Try another category or clear your search.</Text>
          </View>
        )}
      </View>
      <View className="h-2" />

      <RecipeModal meal={openMeal} onClose={() => setOpenId(null)} />
    </>
  )
}

/* A floating recipe card that pops over the screen, dimming what's behind it. */
function RecipeModal({ meal, onClose }: { meal: BudgetMeal | null; onClose: () => void }) {
  const toast = useToast()
  const insets = useSafeAreaInsets()

  async function copyRecipe() {
    if (!meal) return
    const txt = `${meal.name}\n\nIngredients\n${meal.ingredients.map((i) => `- ${i}`).join('\n')}\n\nMethod\n${meal.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
    try {
      await Share.share({ message: txt })
    } catch {
      toast('Recipe copied')
    }
  }

  return (
    <AppModal visible={!!meal} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.62)' }}>
        {meal && (
          <Pressable onPress={() => {}} className="w-full max-w-[400px] overflow-hidden rounded-3xl border border-white/10 bg-ink-800" style={{ maxHeight: '86%' }}>
            {/* Hero */}
            <View className="h-40">
              <Image source={{ uri: meal.image }} resizeMode="cover" className="h-full w-full" />
              <LinearGradient
                colors={['transparent', 'rgba(18,18,20,0.3)', '#121214']}
                style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
              />
              <Pressable onPress={onClose} className="absolute right-3 top-3 h-9 w-9 items-center justify-center rounded-full active:opacity-80" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
                <X size={18} color="#fff" />
              </Pressable>
              <View className="absolute inset-x-4 bottom-3">
                <Text className="text-[19px] font-extrabold leading-tight text-white">{meal.name}</Text>
                <View className="mt-1 flex-row items-center gap-1">
                  <Clock size={13} color={brand[300]} />
                  <Text className="text-[12.5px] font-semibold text-brand-300">{meal.minutes} min</Text>
                </View>
              </View>
            </View>

            {/* Scrollable detail */}
            <ScrollView className="px-4 py-4" contentContainerStyle={{ gap: 16 }} showsVerticalScrollIndicator={false}>
              {meal.flavour && <Text className="text-[13.5px] leading-snug text-white/65">{meal.flavour}</Text>}

              <View className="flex-row flex-wrap gap-1.5">
                {meal.tags.map((t) => (
                  <View key={t} className="rounded-full bg-brand-400/15 px-2.5 py-1"><Text className="text-[11px] font-semibold text-brand-300">{t}</Text></View>
                ))}
              </View>

              <View>
                <Text className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-white/40">Ingredients</Text>
                <View className="gap-1">
                  {meal.ingredients.map((ing) => (
                    <View key={ing} className="flex-row items-start gap-2">
                      <View className="mt-1.5 h-1 w-1 rounded-full bg-brand-400" />
                      <Text className="flex-1 text-[14px] text-white/75">{ing}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View>
                <Text className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-white/40">Method</Text>
                <View className="gap-2.5">
                  {meal.steps.map((s, i) => (
                    <View key={i} className="flex-row items-start gap-2.5">
                      <View className="h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-400/15"><Text className="text-[12px] font-bold text-brand-400">{i + 1}</Text></View>
                      <Text className="flex-1 text-[14px] leading-snug text-white/80">{s}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {meal.cookOnce && (
                <View className="flex-row gap-2 rounded-xl bg-brand-400/10 p-3">
                  <Lightbulb size={16} color={brand[400]} style={{ marginTop: 1 }} />
                  <Text className="flex-1 text-[13px] text-white/70">{meal.cookOnce}</Text>
                </View>
              )}
            </ScrollView>

            {/* Footer */}
            <View className="p-3" style={{ paddingBottom: insets.bottom + 12 }}>
              <Pressable onPress={copyRecipe} className="w-full flex-row items-center justify-center gap-2 rounded-xl bg-brand-400/15 py-3 active:opacity-80">
                <Share2 size={15} color={brand[400]} />
                <Text className="text-sm font-semibold text-brand-400">Copy recipe</Text>
              </Pressable>
            </View>
          </Pressable>
        )}
      </Pressable>
    </AppModal>
  )
}

/* ============================ Water quick-log ============================ */
function WaterCard() {
  const { state, dispatch } = useStore()
  const units = state.settings.units
  const h = todayHabit(state)
  const t = dailyTargets(state)
  const step = units === 'imperial' ? 8 / 33.814 : 0.25
  const filled = pct(h.waterL, t.waterL)
  const done = h.waterL >= t.waterL
  return (
    <View className="mt-4 rounded-2xl border border-white/5 bg-ink-800 p-4">
      <View className="flex-row items-center gap-4">
        {/* Ring visual instead of a flat bar — glanceable progress at a glance. */}
        <ProgressRing value={filled} size={72} stroke={7} color={brand[400]}>
          <Droplet size={20} color={brand[400]} fill={done ? brand[400] : 'none'} />
        </ProgressRing>
        <View className="min-w-0 flex-1">
          <Text className="font-bold text-white">Water</Text>
          <Text className="mt-0.5">
            <Text className="text-[22px] font-extrabold text-white">{fmtFluid(h.waterL, units)}</Text>
            <Text className="text-[13px] font-medium text-white/40"> / {fmtFluid(t.waterL, units)}</Text>
          </Text>
          <Text className="mt-0.5 text-[12px] font-semibold" style={{ color: done ? brand[400] : 'rgba(255,255,255,0.4)' }}>
            {done ? 'Goal hit — nice.' : `${Math.round(filled)}% of today's goal`}
          </Text>
        </View>
      </View>
      <View className="mt-3 flex-row gap-2">
        <Pressable onPress={() => dispatch({ type: 'ADJUST_WATER', deltaL: -step })} className="flex-1 items-center rounded-xl bg-ink-700 py-2.5 active:opacity-80">
          <Text className="font-bold text-white">−</Text>
        </Pressable>
        <Pressable onPress={() => dispatch({ type: 'ADJUST_WATER', deltaL: step })} className="flex-[2] items-center rounded-xl bg-brand-400/20 py-2.5 active:opacity-80">
          <Text className="font-bold text-brand-400">+ {units === 'imperial' ? '8 oz' : '250 ml'}</Text>
        </Pressable>
      </View>
    </View>
  )
}

/* ============================ Meal planner ============================ */
function PlanTab() {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const plan = state.mealPlan ?? []
  const mealNames = useMemo(() => [
    ...BUDGET_MEALS.map((m) => m.name),
    ...FOODS.map((f) => f.name),
    ...(state.myMeals ?? []).map((m) => m.name),
  ], [state.myMeals])
  const [day, setDay] = useState('Mon')
  const [slot, setSlot] = useState<MealName>('Breakfast')
  const [meal, setMeal] = useState(mealNames[0])

  function add() {
    dispatch({ type: 'ADD_PLANNED_MEAL', plan: { day, slot, name: meal } })
    toast(`Added to ${day}`)
  }

  return (
    <>
      <View className="rounded-2xl border border-white/[0.08] bg-ink-800 p-4">
        <Text className="text-lg font-extrabold tracking-tight text-white">Plan your week</Text>
        <Text className="mt-1 text-[13px] leading-snug text-white/60">Map meals to days so shopping and cooking are sorted ahead of time.</Text>

        <Text className="mb-2 mt-3 text-[11px] font-bold uppercase tracking-wide text-white/40">Day</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 8 }}>
          {PLAN_DAYS.map((d) => {
            const activeDay = day === d
            return (
              <Pressable key={d} onPress={() => setDay(d)} className={`shrink-0 rounded-full px-3.5 py-2 active:opacity-80 ${activeDay ? 'bg-brand-400' : 'border border-white/10 bg-white/[0.04]'}`}>
                <Text className={`text-[13px] font-semibold ${activeDay ? 'text-black' : 'text-white/70'}`}>{d}</Text>
              </Pressable>
            )
          })}
        </ScrollView>

        <Text className="mb-2 mt-3 text-[11px] font-bold uppercase tracking-wide text-white/40">Meal slot</Text>
        <View className="flex-row gap-2">
          {SLOTS.map((s) => {
            const activeSlot = slot === s
            return (
              <Pressable key={s} onPress={() => setSlot(s)} className={`flex-1 items-center rounded-xl px-2 py-2 active:opacity-80 ${activeSlot ? 'bg-brand-400' : 'border border-white/10 bg-white/[0.04]'}`}>
                <Text className={`text-[12px] font-semibold ${activeSlot ? 'text-black' : 'text-white/70'}`}>{s}</Text>
              </Pressable>
            )
          })}
        </View>

        <Text className="mb-2 mt-3 text-[11px] font-bold uppercase tracking-wide text-white/40">Meal</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 8 }}>
          {mealNames.map((n) => {
            const activeMeal = meal === n
            return (
              <Pressable key={n} onPress={() => setMeal(n)} className={`shrink-0 rounded-full px-3.5 py-2 active:opacity-80 ${activeMeal ? 'bg-brand-400' : 'border border-white/10 bg-white/[0.04]'}`}>
                <Text className={`text-[13px] font-semibold ${activeMeal ? 'text-black' : 'text-white/70'}`}>{n}</Text>
              </Pressable>
            )
          })}
        </ScrollView>

        <Pressable onPress={add} className="btn-primary mt-4 w-full active:opacity-90">
          <Plus size={16} color="#000" />
          <Text className="ml-2 font-semibold text-black">Add to plan</Text>
        </Pressable>
      </View>

      <View className="mt-4 gap-2.5">
        {PLAN_DAYS.map((d) => {
          const items = plan.filter((p) => p.day === d)
          return (
            <View key={d} className="rounded-2xl border border-white/5 bg-ink-800 p-3.5">
              <View className="mb-1.5 flex-row items-center justify-between">
                <Text className="font-bold text-white">{d}</Text>
                <Text className="text-[11px] text-white/35">{items.length ? `${items.length} planned` : '-'}</Text>
              </View>
              {items.length === 0 ? (
                <Text className="text-[12px] text-white/35">Nothing planned</Text>
              ) : (
                <View className="gap-1.5">
                  {items.map((it) => (
                    <View key={it.id} className="flex-row items-center gap-2.5">
                      <Text className="w-16 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-brand-400">{it.slot}</Text>
                      <Text numberOfLines={1} className="min-w-0 flex-1 text-[13px] text-white/80">{it.name}</Text>
                      <Pressable onPress={() => dispatch({ type: 'REMOVE_PLANNED_MEAL', id: it.id })} className="h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/5 active:opacity-80">
                        <Trash2 size={13} color="rgba(255,255,255,0.4)" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )
        })}
      </View>
      <View className="h-2" />
    </>
  )
}

/* ============================ My Meals tab ============================ */
function MyMealsTab() {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const meals = state.myMeals ?? []
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [ingLine, setIngLine] = useState('')

  function resetForm() {
    setName(''); setNotes(''); setIngLine('')
    setCreating(false)
  }

  function save() {
    const n = name.trim()
    if (!n) return
    dispatch({
      type: 'ADD_MY_MEAL',
      meal: {
        name: n,
        notes: notes.trim() || undefined,
        kcal: 0,
        p: 0,
        c: 0,
        f: 0,
        ingredients: ingLine.split('\n').map((s) => s.trim()).filter(Boolean),
      },
    })
    toast(`"${n}" added`)
    resetForm()
  }

  const inputCls = 'w-full rounded-xl border border-white/[0.08] bg-ink-900/60 px-3 py-2.5 text-sm text-white'

  return (
    <View className="overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-800">
      {/* Clickable header */}
      <Pressable
        onPress={() => { setOpen((v) => !v); if (open) resetForm() }}
        className="w-full flex-row items-center gap-3 p-4 active:opacity-90"
      >
        <View className="min-w-0 flex-1">
          <Text className="text-[15px] font-extrabold tracking-tight text-white">My Recipes</Text>
          <Text className="mt-0.5 text-[13px] leading-snug text-white/60">
            {meals.length === 0 ? 'Save your own recipes and use them in the meal planner.' : `${meals.length} saved recipe${meals.length === 1 ? '' : 's'} · tap to manage`}
          </Text>
        </View>
        <ChevronDown size={18} color="rgba(255,255,255,0.3)" style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
      </Pressable>

      {open && (
        <View className="border-t border-white/5">
          {/* Saved meals list */}
          {meals.length === 0 ? (
            <View className="items-center px-6 py-8">
              <Salad size={26} color="rgba(255,255,255,0.25)" />
              <Text className="mt-2 text-[14px] font-semibold text-white/50">No saved meals yet</Text>
              <Text className="mt-1 text-center text-[12px] leading-snug text-white/35">Add a recipe below and it shows up in the Plan tab too.</Text>
            </View>
          ) : (
            <View>
              {meals.map((m, i) => (
                <View key={m.id} className={`flex-row items-start gap-3 px-4 py-3.5 ${i === 0 ? '' : 'border-t border-white/5'}`}>
                  <View className="min-w-0 flex-1">
                    <Text className="font-bold leading-tight text-white">{m.name}</Text>
                    {m.notes && <Text className="mt-0.5 text-[12px] leading-snug text-white/50">{m.notes}</Text>}
                    {m.ingredients.length > 0 && (
                      <View className="mt-1.5 flex-row flex-wrap gap-1">
                        {m.ingredients.map((ing, j) => (
                          <View key={j} className="rounded-full bg-white/[0.05] px-2.5 py-1"><Text className="text-[11px] text-white/55">{ing}</Text></View>
                        ))}
                      </View>
                    )}
                  </View>
                  <Pressable onPress={() => dispatch({ type: 'REMOVE_MY_MEAL', id: m.id })} className="h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 active:opacity-80">
                    <Trash2 size={14} color="rgba(255,255,255,0.4)" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {/* Add meal form */}
          {creating ? (
            <View className="gap-2.5 border-t border-white/5 p-4">
              <Text className="text-[12px] font-bold uppercase tracking-wide text-white/40">New recipe</Text>
              <TextInput value={name} onChangeText={setName} placeholder="Meal name *" placeholderTextColor={PLACEHOLDER} className={inputCls} />
              <TextInput value={notes} onChangeText={setNotes} placeholder="Description (optional)" placeholderTextColor={PLACEHOLDER} multiline numberOfLines={2} textAlignVertical="top" className={inputCls} />
              <TextInput value={ingLine} onChangeText={setIngLine} placeholder={'Ingredients (one per line)\ne.g. 2 eggs\n100g oats'} placeholderTextColor={PLACEHOLDER} multiline numberOfLines={4} textAlignVertical="top" className={inputCls} />
              <View className="flex-row gap-2">
                <Pressable onPress={save} disabled={!name.trim()} className={`btn-primary flex-1 active:opacity-90 ${!name.trim() ? 'opacity-40' : ''}`}>
                  <Plus size={15} color="#000" />
                  <Text className="ml-2 font-semibold text-black">Save meal</Text>
                </Pressable>
                <Pressable onPress={resetForm} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 active:opacity-80">
                  <Text className="text-sm font-semibold text-white/60">Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View className="border-t border-white/5 p-3">
              <Pressable onPress={() => setCreating(true)} className="w-full flex-row items-center justify-center gap-2 rounded-xl bg-brand-400/15 py-2.5 active:opacity-80">
                <Plus size={15} color={brand[400]} />
                <Text className="text-[13px] font-semibold text-brand-400">Add a meal</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <Text className="mb-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-white/40">{children}</Text>
}

/* Three dots that rise in sequence — the small "someone's replying" cue that
 * makes the coach feel present rather than canned. */
function TypingDots() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current]
  useEffect(() => {
    const loops = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(d, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(d, { toValue: 0, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.delay((2 - i) * 160),
        ]),
      ),
    )
    loops.forEach((l) => l.start())
    return () => loops.forEach((l) => l.stop())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <>
      {dots.map((d, i) => (
        <Animated.View
          key={i}
          style={{
            width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)',
            opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
            transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
          }}
        />
      ))}
    </>
  )
}
