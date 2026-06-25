import { useMemo, useState, type ReactNode } from 'react'
import { View, Text, Pressable, ScrollView, TextInput, Image, Share } from 'react-native'
import {
  Sparkles, Send, Check, ArrowRight, ChevronDown, Droplet, Plus, Trash2, Share2,
  Wallet, Search, Lightbulb, HelpCircle, Salad,
} from 'lucide-react-native'
import { Icon } from '../components/Icon'
import { ProgressRing, SegmentedTabs, ScreenHeader } from '../components/ui'
import { useToast } from '../components/Toast'
import { useStore } from '../store/store'
import {
  PLATE_GUIDE, FOOD_TIERS, GOAL_GUIDES, NUTRITION_LESSONS,
} from '../data/nutrition'
import { BUDGET_MEALS, FOODS } from '../data/catalog'
import { foodReviewForDay, todayHabit } from '../store/selectors'
import { dailyTargets } from '../store/training'
import { fmtFluid, pct } from '../lib/format'
import {
  reviewDay, answerQuestion, answerForQuestion, STARTER_QUESTIONS,
  type DayReview, type QAResult,
} from '../lib/nutritionCoach'
import type { Goal, MealName } from '../store/types'
import { brand, accent } from '../theme'

const PLACEHOLDER = 'rgba(148,148,148,0.6)'

const TABS = ['Coach', 'Learn', 'Budget Eats', 'Plan']
const PLAN_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const SLOTS: MealName[] = ['Breakfast', 'Lunch', 'Snack', 'Dinner']

export default function Nutrition() {
  const [tab, setTab] = useState('Coach')
  return (
    <View className="px-5 pt-2">
      <ScreenHeader title="Nutrition" />
      <SegmentedTabs tabs={TABS} active={tab} onChange={setTab} />
      <View className="mt-5">
        {tab === 'Coach' && <CoachTab />}
        {tab === 'Learn' && <LearnTab />}
        {tab === 'Budget Eats' && <BudgetTab />}
        {tab === 'Plan' && <PlanTab />}
      </View>
    </View>
  )
}

/* ============================ Coach tab ============================ */
function CoachTab() {
  const { state, dispatch } = useStore()
  const goal = state.profile.goal
  const saved = foodReviewForDay(state)
  const guide = GOAL_GUIDES[goal]

  const [text, setText] = useState(saved?.text ?? '')
  const [review, setReview] = useState<DayReview | null>(() => (saved?.text ? reviewDay(saved.text, goal) : null))

  function runReview() {
    const r = reviewDay(text, goal)
    setReview(r)
    if (!r.empty) dispatch({ type: 'SAVE_FOOD_REVIEW', text: text.trim(), score: r.score })
  }

  return (
    <>
      {/* Goal banner */}
      <View className="overflow-hidden rounded-2xl border border-brand-400/20 bg-brand-400/[0.06] p-4">
        <View className="flex-row items-center gap-2">
          <View className="h-7 w-7 items-center justify-center rounded-full bg-brand-400"><Sparkles size={15} color="#000" /></View>
          <Text className="text-[13px] font-bold text-brand-400">{guide.headline}</Text>
        </View>
        <Text className="mt-2 text-[14px] leading-snug text-white/70">
          Tell me what you ate today and I'll give you honest, friendly feedback for your goal, no calorie counting needed.
        </Text>
      </View>

      {/* Water quick-log */}
      <WaterCard />

      {/* Free-text food log */}
      <View className="mt-4">
        <Text className="mb-2 text-[12px] font-bold uppercase tracking-[0.14em] text-white/40">What did you eat today?</Text>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          numberOfLines={5}
          placeholder={'e.g. Porridge with banana, chicken wrap and salad, pasta bolognese, a chocolate bar and lots of water…'}
          placeholderTextColor={PLACEHOLDER}
          textAlignVertical="top"
          className="min-h-[120px] w-full rounded-2xl border border-white/8 bg-ink-800 p-4 text-[15px] leading-relaxed text-white"
        />
        <Pressable
          onPress={runReview}
          disabled={!text.trim()}
          className={`btn-primary mt-3 w-full active:opacity-90 ${!text.trim() ? 'opacity-40' : ''}`}
        >
          <Sparkles size={16} color="#000" />
          <Text className="ml-2 font-semibold text-black">Review my day</Text>
        </Pressable>
      </View>

      {review && !review.empty && <ReviewCard review={review} />}

      {/* Ask anything */}
      <AskBox />
      <View className="h-2" />
    </>
  )
}

function ReviewCard({ review }: { review: DayReview }) {
  const tierColor: Record<string, string> = { great: brand[500], good: brand[400], moderate: accent.orange, limit: '#F87171' }
  return (
    <View className="mt-4 rounded-2xl border border-white/8 bg-ink-800 p-5">
      <View className="flex-row items-center gap-4">
        <ProgressRing value={review.score * 10} size={84} stroke={8} color={review.score >= 5 ? '#7ED957' : '#F5A524'}>
          <Text className="text-2xl font-extrabold leading-none text-white">{review.score}</Text>
          <Text className="text-[10px] text-white/45">/ 10</Text>
        </ProgressRing>
        <View className="min-w-0 flex-1">
          <Text className="text-lg font-extrabold leading-tight text-white">{review.verdict}</Text>
          <Text className="mt-1 text-[13px] leading-snug text-white/60">{review.summary}</Text>
        </View>
      </View>

      {review.found.length > 0 && (
        <View className="mt-4 flex-row flex-wrap gap-1.5">
          {review.found.map((f, i) => (
            <View key={i} className="rounded-full px-2.5 py-1" style={{ backgroundColor: `${tierColor[f.tier]}1f` }}>
              <Text className="text-[11px] font-semibold" style={{ color: tierColor[f.tier] }}>{f.label}</Text>
            </View>
          ))}
        </View>
      )}

      {review.highlights.length > 0 && (
        <View className="mt-4">
          <Text className="mb-2 text-[12px] font-bold uppercase tracking-wide text-white/40">What went well</Text>
          <View className="gap-2">
            {review.highlights.map((h, i) => (
              <View key={i} className="flex-row items-start gap-2.5">
                <Check size={16} strokeWidth={3} color={brand[400]} style={{ marginTop: 2 }} />
                <Text className="flex-1 text-[13px] leading-snug text-white/75">{h}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {review.improvements.length > 0 && (
        <View className="mt-4">
          <Text className="mb-2 text-[12px] font-bold uppercase tracking-wide text-white/40">Try this next</Text>
          <View className="gap-2">
            {review.improvements.map((h, i) => (
              <View key={i} className="flex-row items-start gap-2.5">
                <ArrowRight size={16} strokeWidth={2.5} color={accent.orange} style={{ marginTop: 2 }} />
                <Text className="flex-1 text-[13px] leading-snug text-white/75">{h}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View className="mt-4 flex-row items-start gap-2.5 rounded-xl bg-brand-400/10 p-3">
        <Sparkles size={16} color={brand[400]} style={{ marginTop: 2 }} />
        <Text className="flex-1 text-[13px] font-medium leading-snug text-white/80">{review.encouragement}</Text>
      </View>
    </View>
  )
}

function AskBox() {
  const [q, setQ] = useState('')
  const [result, setResult] = useState<QAResult | null>(null)

  function ask(question?: string) {
    const text = question ?? q
    if (!text.trim()) return
    setResult(question ? answerForQuestion(question) : answerQuestion(text))
    if (question) setQ(question)
  }

  return (
    <View className="mt-7">
      <View className="mb-2 flex-row items-center gap-2">
        <HelpCircle size={16} color={brand[400]} />
        <Text className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/40">Ask anything about food</Text>
      </View>
      <View className="flex-row items-center gap-2 rounded-2xl border border-white/8 bg-ink-800 p-1.5">
        <TextInput
          value={q}
          onChangeText={setQ}
          onSubmitEditing={() => ask()}
          returnKeyType="send"
          placeholder="How much protein do I need?"
          placeholderTextColor={PLACEHOLDER}
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-[15px] text-white"
        />
        <Pressable onPress={() => ask()} disabled={!q.trim()} className={`h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-400 active:opacity-90 ${!q.trim() ? 'opacity-40' : ''}`}>
          <Send size={17} color="#000" />
        </Pressable>
      </View>

      {result && (
        <View className="mt-3 rounded-2xl border border-white/8 bg-ink-800 p-4">
          {result.question && <Text className="mb-1.5 text-[13px] font-bold text-brand-400">{result.question}</Text>}
          <Text className="text-[14px] leading-relaxed text-white/80">{result.answer}</Text>
        </View>
      )}

      <View className="mt-3 flex-row flex-wrap gap-2">
        {STARTER_QUESTIONS.map((sq) => (
          <Pressable key={sq} onPress={() => ask(sq)} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 active:opacity-80">
            <Text className="text-[12px] font-medium text-white/70">{sq}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

/* ============================ Learn tab ============================ */
function LearnTab() {
  const { state } = useStore()
  const goal = state.profile.goal
  const guide = GOAL_GUIDES[goal]
  const [openLesson, setOpenLesson] = useState<string | null>(null)

  return (
    <View className="gap-6">
      {/* Goal guidance */}
      <View>
        <SectionLabel>For your goal</SectionLabel>
        <View className="rounded-2xl border border-brand-400/20 bg-brand-400/[0.06] p-4">
          <Text className="font-extrabold text-brand-400">{guide.headline}</Text>
          <View className="mt-2.5 gap-2">
            {guide.points.map((p, i) => (
              <View key={i} className="flex-row items-start gap-2.5">
                <Check size={16} strokeWidth={3} color={brand[400]} style={{ marginTop: 2 }} />
                <Text className="flex-1 text-[13px] leading-snug text-white/75">{p}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Build your plate */}
      <View>
        <SectionLabel>Build your plate</SectionLabel>
        <View className="gap-2.5">
          {PLATE_GUIDE.map((s) => (
            <View key={s.title} className="flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-3.5">
              <View className="h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/5">
                <Text className="text-[11px] font-black uppercase" style={{ color: s.color }}>{s.portion.split(' ')[0]}</Text>
              </View>
              <View className="min-w-0 flex-1">
                <Text className="font-bold leading-tight" style={{ color: s.color }}>{s.title}</Text>
                <Text className="mt-0.5 text-[12px] leading-snug text-white/55">{s.examples}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Good / moderation / limit */}
      <View>
        <SectionLabel>Good · in moderation · occasional</SectionLabel>
        <View className="gap-2.5">
          {FOOD_TIERS.map((t) => (
            <View key={t.tier} className="rounded-2xl border border-white/5 bg-ink-800 p-4">
              <View className="flex-row items-center gap-2">
                <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                <Text className="font-bold" style={{ color: t.color }}>{t.title}</Text>
              </View>
              <Text className="mt-1 text-[12px] leading-snug text-white/55">{t.desc}</Text>
              <View className="mt-2.5 flex-row flex-wrap gap-1.5">
                {t.items.map((it) => (
                  <View key={it} className="rounded-full bg-white/[0.05] px-2.5 py-1">
                    <Text className="text-[11px] font-medium text-white/70">{it}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Lessons */}
      <View>
        <SectionLabel>Quick lessons</SectionLabel>
        <View className="gap-2.5">
          {NUTRITION_LESSONS.map((l) => {
            const open = openLesson === l.id
            return (
              <View key={l.id} className="overflow-hidden rounded-2xl border border-white/5 bg-ink-800">
                <Pressable onPress={() => setOpenLesson(open ? null : l.id)} className="flex-row items-center gap-3 p-4 active:opacity-80">
                  <View className="h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-purple/15"><Icon name={l.icon} size={20} color="#8B5CF6" /></View>
                  <View className="min-w-0 flex-1">
                    <Text className="font-bold leading-tight text-white">{l.title}</Text>
                    <Text numberOfLines={1} className="text-[12px] text-white/55">{l.summary}</Text>
                    <Text className="mt-0.5 text-[11px] text-white/35">{l.minutes} min read</Text>
                  </View>
                  <ChevronDown size={18} color="rgba(255,255,255,0.3)" style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
                </Pressable>
                {open && (
                  <View className="gap-2.5 border-t border-white/5 px-4 py-3.5">
                    {l.body.map((para, i) => (
                      <Text key={i} className="text-[13px] leading-relaxed text-white/70">{para}</Text>
                    ))}
                  </View>
                )}
              </View>
            )
          })}
        </View>
      </View>
      <View className="h-2" />
    </View>
  )
}

/* ============================ Budget tab ============================ */
const GOAL_FILTERS: { label: string; goal: Goal | 'all' }[] = [
  { label: 'All', goal: 'all' },
  { label: 'Build muscle', goal: 'build-muscle' },
  { label: 'Lose fat', goal: 'lose-fat' },
  { label: 'Strength', goal: 'gain-strength' },
  { label: 'Healthy', goal: 'stay-healthy' },
]

function BudgetTab() {
  const { state } = useStore()
  const toast = useToast()
  const [filter, setFilter] = useState<Goal | 'all'>(state.profile.goal)
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const meals = useMemo(() => {
    return BUDGET_MEALS.filter((m) => {
      const goalOk = filter === 'all' || (m.goals?.includes(filter) ?? false)
      const qOk = !q || m.name.toLowerCase().includes(q.toLowerCase()) || (m.flavour ?? '').toLowerCase().includes(q.toLowerCase())
      return goalOk && qOk
    })
  }, [filter, q])

  const grocery = useMemo(() => {
    const map = new Map<string, number>()
    for (const m of meals) for (const ing of m.ingredients) map.set(ing.item, (map.get(ing.item) ?? 0) + ing.cost)
    return [...map.entries()]
  }, [meals])
  const [showList, setShowList] = useState(false)
  const weekTotal = grocery.reduce((a, [, c]) => a + c, 0)

  async function exportList() {
    const lines = grocery.map(([item, cost]) => `• ${item}: $${cost.toFixed(2)}`).join('\n')
    const txt = `🛒 Shopping list (${meals.length} meals) · ~$${weekTotal.toFixed(2)}\n\n${lines}`
    try {
      await Share.share({ message: txt })
    } catch {
      toast('Shopping list copied')
    }
  }

  return (
    <>
      <View className="rounded-2xl border border-white/8 bg-ink-800 p-4">
        <Wallet size={22} color={brand[400]} />
        <Text className="mt-2 text-lg font-extrabold tracking-tight text-white">Cheap food that tastes great</Text>
        <Text className="mt-1 text-[13px] leading-snug text-white/60">Real meals on a student budget, matched to your goal. Cook once, eat for days.</Text>
      </View>

      {/* Goal filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5 mt-4 px-5" contentContainerStyle={{ flexDirection: 'row', gap: 8 }}>
        {GOAL_FILTERS.map((g) => {
          const active = filter === g.goal
          return (
            <Pressable key={g.label} onPress={() => setFilter(g.goal)} className={`shrink-0 rounded-full px-3.5 py-2 active:opacity-80 ${active ? 'bg-brand-400' : 'border border-white/10 bg-white/[0.04]'}`}>
              <Text className={`text-[13px] font-semibold ${active ? 'text-black' : 'text-white/70'}`}>{g.label}</Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {/* Search */}
      <View className="mt-3 flex-row items-center gap-2 rounded-xl border border-white/8 bg-ink-800 px-3">
        <Search size={16} color="rgba(255,255,255,0.35)" />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search meals…"
          placeholderTextColor={PLACEHOLDER}
          className="w-full flex-1 bg-transparent py-2.5 text-sm text-white"
        />
      </View>

      {/* Grocery list */}
      {meals.length > 0 && (
        <>
          <Pressable onPress={() => setShowList((v) => !v)} className="mt-3 w-full flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-3.5 active:opacity-80">
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-brand-400/15"><Text className="text-sm font-bold text-brand-400">${weekTotal.toFixed(0)}</Text></View>
            <View className="flex-1"><Text className="text-sm font-bold leading-tight text-white">Shopping list for these meals</Text><Text className="text-[12px] text-white/50">Rough total for everything below</Text></View>
            <ChevronDown size={18} color="rgba(255,255,255,0.3)" style={{ transform: [{ rotate: showList ? '180deg' : '0deg' }] }} />
          </Pressable>
          {showList && (
            <View className="mt-2 rounded-2xl border border-white/5 bg-ink-800 p-4">
              {grocery.map(([item, cost], i) => (
                <View key={item} className={`flex-row items-center justify-between py-2 ${i === grocery.length - 1 ? '' : 'border-b border-white/5'}`}>
                  <Text className="text-[13px] text-white/70">{item}</Text><Text className="text-[13px] font-semibold text-white/50">${cost.toFixed(2)}</Text>
                </View>
              ))}
              <View className="mt-2 flex-row items-center justify-between"><Text className="text-[14px] font-bold text-white">Estimated total</Text><Text className="text-[14px] font-bold text-brand-400">${weekTotal.toFixed(2)}</Text></View>
              <Pressable onPress={exportList} className="mt-3 w-full flex-row items-center justify-center gap-2 rounded-xl bg-brand-400/15 py-2.5 active:opacity-80">
                <Share2 size={15} color={brand[400]} />
                <Text className="text-sm font-semibold text-brand-400">Copy / share list</Text>
              </Pressable>
            </View>
          )}
        </>
      )}

      {/* Meal cards */}
      <Text className="mt-4 text-[12px] font-bold uppercase tracking-[0.14em] text-white/35">{meals.length} {meals.length === 1 ? 'meal' : 'meals'}</Text>
      <View className="mt-2 gap-2.5">
        {meals.map((m) => {
          const open = openId === m.id
          return (
            <View key={m.id} className="overflow-hidden rounded-2xl border border-white/5 bg-ink-800">
              <Pressable onPress={() => setOpenId(open ? null : m.id)} className="flex-row items-center gap-3 p-3 active:opacity-80">
                <Image source={{ uri: m.image }} resizeMode="cover" className="h-16 w-16 rounded-xl" />
                <View className="min-w-0 flex-1">
                  <Text className="font-bold leading-tight text-white">{m.name}</Text>
                  {m.flavour && <Text numberOfLines={2} className="mt-0.5 text-[12px] leading-snug text-white/55">{m.flavour}</Text>}
                  <Text className="mt-1 text-[12px] font-semibold text-brand-400">{m.kcal} kcal · {m.p}g protein</Text>
                </View>
                <View className="items-end">
                  <Text className="font-extrabold text-brand-400">${m.cost.toFixed(2)}</Text>
                  <Text className="text-[10px] text-white/40">per serve</Text>
                </View>
              </Pressable>
              {open && (
                <View className="gap-3 border-t border-white/5 px-4 py-3.5">
                  <View className="flex-row flex-wrap gap-1.5">
                    {m.tags.map((t) => <View key={t} className="rounded-full bg-brand-400/15 px-2.5 py-1"><Text className="text-[11px] font-semibold text-brand-300">{t}</Text></View>)}
                  </View>
                  <View>
                    <Text className="mb-1 text-[12px] font-bold uppercase tracking-wide text-white/40">Ingredients</Text>
                    {m.ingredients.map((ing) => (
                      <View key={ing.item} className="flex-row justify-between py-0.5"><Text className="text-[14px] text-white/70">{ing.item}</Text><Text className="text-[14px] text-white/45">${ing.cost.toFixed(2)}</Text></View>
                    ))}
                  </View>
                  <View>
                    <Text className="mb-1 text-[12px] font-bold uppercase tracking-wide text-white/40">Method</Text>
                    <View className="gap-1 pl-1">{m.steps.map((s, i) => (
                      <View key={i} className="flex-row gap-2">
                        <Text className="text-[14px] text-white/70">{i + 1}.</Text>
                        <Text className="flex-1 text-[14px] text-white/70">{s}</Text>
                      </View>
                    ))}</View>
                  </View>
                  {m.cookOnce && (
                    <View className="flex-row gap-2 rounded-xl bg-brand-400/10 p-3">
                      <Lightbulb size={16} color={brand[400]} style={{ marginTop: 1 }} />
                      <Text className="flex-1 text-[13px] text-white/70">{m.cookOnce}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )
        })}
        {meals.length === 0 && (
          <View className="items-center rounded-2xl border border-dashed border-white/12 px-6 py-10">
            <Salad size={26} color="rgba(255,255,255,0.3)" />
            <Text className="mt-2 text-sm font-semibold text-white/60">No meals match that</Text>
            <Text className="mt-1 text-center text-[12px] text-white/40">Try another goal filter or clear your search.</Text>
          </View>
        )}
      </View>
      <View className="h-2" />
    </>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <Text className="mb-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-white/40">{children}</Text>
}

/* ============================ Water quick-log ============================ */
function WaterCard() {
  const { state, dispatch } = useStore()
  const units = state.settings.units
  const h = todayHabit(state)
  const t = dailyTargets(state)
  const step = units === 'imperial' ? 8 / 33.814 : 0.25
  return (
    <View className="mt-4 rounded-2xl border border-white/5 bg-ink-800 p-4">
      <View className="flex-row items-center gap-2">
        <Droplet size={18} color={brand[400]} />
        <Text className="flex-1 font-bold text-white">Water</Text>
        <Text className="font-extrabold text-white">
          {fmtFluid(h.waterL, units)} <Text className="text-[12px] font-medium text-white/40">/ {fmtFluid(t.waterL, units)}</Text>
        </Text>
      </View>
      <View className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/8">
        <View className="h-full rounded-full bg-brand-400" style={{ width: `${pct(h.waterL, t.waterL)}%` }} />
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
  const mealNames = useMemo(() => [...BUDGET_MEALS.map((m) => m.name), ...FOODS.map((f) => f.name)], [])
  const [day, setDay] = useState('Mon')
  const [slot, setSlot] = useState<MealName>('Breakfast')
  const [meal, setMeal] = useState(mealNames[0])

  function add() {
    dispatch({ type: 'ADD_PLANNED_MEAL', plan: { day, slot, name: meal } })
    toast(`Added to ${day}`)
  }

  return (
    <>
      <View className="rounded-2xl border border-white/8 bg-ink-800 p-4">
        <Text className="text-lg font-extrabold tracking-tight text-white">Plan your week</Text>
        <Text className="mt-1 text-[13px] leading-snug text-white/60">Map meals to days so shopping and cooking are sorted ahead of time.</Text>

        <Text className="mb-2 mt-3 text-[11px] font-bold uppercase tracking-wide text-white/40">Day</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 8 }}>
          {PLAN_DAYS.map((d) => {
            const active = day === d
            return (
              <Pressable key={d} onPress={() => setDay(d)} className={`shrink-0 rounded-full px-3.5 py-2 active:opacity-80 ${active ? 'bg-brand-400' : 'border border-white/10 bg-white/[0.04]'}`}>
                <Text className={`text-[13px] font-semibold ${active ? 'text-black' : 'text-white/70'}`}>{d}</Text>
              </Pressable>
            )
          })}
        </ScrollView>

        <Text className="mb-2 mt-3 text-[11px] font-bold uppercase tracking-wide text-white/40">Meal slot</Text>
        <View className="flex-row gap-2">
          {SLOTS.map((s) => {
            const active = slot === s
            return (
              <Pressable key={s} onPress={() => setSlot(s)} className={`flex-1 items-center rounded-xl px-2 py-2 active:opacity-80 ${active ? 'bg-brand-400' : 'border border-white/10 bg-white/[0.04]'}`}>
                <Text className={`text-[12px] font-semibold ${active ? 'text-black' : 'text-white/70'}`}>{s}</Text>
              </Pressable>
            )
          })}
        </View>

        <Text className="mb-2 mt-3 text-[11px] font-bold uppercase tracking-wide text-white/40">Meal</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 8 }}>
          {mealNames.map((n) => {
            const active = meal === n
            return (
              <Pressable key={n} onPress={() => setMeal(n)} className={`shrink-0 rounded-full px-3.5 py-2 active:opacity-80 ${active ? 'bg-brand-400' : 'border border-white/10 bg-white/[0.04]'}`}>
                <Text className={`text-[13px] font-semibold ${active ? 'text-black' : 'text-white/70'}`}>{n}</Text>
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
