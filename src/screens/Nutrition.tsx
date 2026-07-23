import { useEffect, useRef, useState, type ReactNode } from 'react'
import { View, Text, Pressable, ScrollView, Image, TextInput, Animated, Easing, ActivityIndicator, Platform, KeyboardAvoidingView, LayoutAnimation, UIManager } from 'react-native'
import Svg, { Path, Circle, Text as SvgText } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import * as ImagePicker from 'expo-image-picker'
import * as Clipboard from 'expo-clipboard'
import {
  Camera, Plus, Search, Clock, ChevronRight, ChevronDown, ChevronLeft, X, Check,
  Trash2, Pencil, Share2, MessageCircle, CalendarCheck, Upload, ChefHat, LayoutGrid,
} from 'lucide-react-native'
import { AppModal } from '../components/WebFrame'
import { useStore } from '../store/store'
import { useToast } from '../components/Toast'
import { BUDGET_MEALS } from '../data/catalog'
import { NUTRITION_TAGS, type TagTone } from '../data/nutrition'
import { nutritionTagsForDay } from '../store/selectors'
import { useColors } from '../theme'
import type { MealName, MealCategory, BudgetMeal, UserMeal } from '../store/types'

/* ================================================================== */
/*  Nutrition — a 4-tab section: Overview (scan + tags), Recipes,      */
/*  Meal Plan and Guide. Rebuilt from the SHO Nutrition design.        */
/* ================================================================== */

type TabKey = 'Overview' | 'Recipes' | 'Meal Plan' | 'Guide'
const TABS: TabKey[] = ['Overview', 'Recipes', 'Meal Plan', 'Guide']

const CATS: (MealCategory | 'All')[] = ['All', 'Breakfast', 'Lunch', 'Dinner', 'Snack', 'Sweet']
const SLOTS: MealName[] = ['Breakfast', 'Lunch', 'Snack', 'Dinner']
const PLAN_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function alpha(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}
const todayShort = () => PLAN_DAYS[(new Date().getDay() + 6) % 7]

/* ---- Static guide content (educational, not backend) ---- */
type PlateSlice = { slice: 'veg' | 'protein' | 'carbs' | 'fat'; portion: string; icon: string; title: string; color: string; desc: string; examples: string[] }
const PLATE: PlateSlice[] = [
  { slice: 'veg', portion: '½', icon: '🥦', title: 'Vegetables & fruit', color: '#7ED957', desc: 'Broccoli, peppers, salad and berries provide colour, fibre and volume that help fill you up.', examples: ['Broccoli', 'Peppers', 'Leafy salad', 'Carrots', 'Berries', 'Apples'] },
  { slice: 'protein', portion: '¼', icon: '🍗', title: 'Protein', color: '#3B82F6', desc: 'Chicken, fish, eggs, tofu, beans or Greek yogurt at each meal keeps you full and helps you stay strong.', examples: ['Chicken', 'Fish', 'Eggs', 'Tofu', 'Beans', 'Greek yogurt'] },
  { slice: 'carbs', portion: '¼', icon: '🍚', title: 'Carbohydrates', color: '#F5A524', desc: 'Oats, rice, potato or wholegrain bread give steady, lasting energy through the day.', examples: ['Oats', 'Rice', 'Potato', 'Wholegrain bread', 'Pasta'] },
  { slice: 'fat', portion: '', icon: '🥑', title: 'Healthy fats', color: '#8B5CF6', desc: 'A thumb sized amount of olive oil, nuts, avocado or oily fish alongside your plate goes a long way.', examples: ['Olive oil', 'Avocado', 'Nuts', 'Nut butter', 'Oily fish'] },
]
const PORTIONS = [
  { emoji: '✋', hand: 'Palm', title: 'Protein', desc: 'Meat, fish, eggs, tofu', color: '#3B82F6' },
  { emoji: '✊', hand: 'Fist', title: 'Vegetables', desc: 'Salad, broccoli, carrots', color: '#7ED957' },
  { emoji: '🤲', hand: 'Cupped hand', title: 'Carbohydrates', desc: 'Rice, pasta, cereal', color: '#F5A524' },
  { emoji: '👍', hand: 'Thumb', title: 'Healthy fats', desc: 'Oil, nuts, nut butter', color: '#8B5CF6' },
]
const TIERS = [
  { title: 'Build meals around', color: '#7ED957', desc: 'Choose these regularly. They are filling, nutritious and useful for creating balanced meals.', items: ['Vegetables & fruit', 'Lean proteins', 'Beans, lentils & tofu', 'Yoghurt', 'Wholegrain carbs'] },
  { title: 'Enjoy in balanced portions', color: '#F5A524', desc: 'These foods can fit comfortably into a balanced diet. Portions still matter.', items: ['White rice, pasta & bread', 'Cheese & full fat dairy', 'Nuts & nut butters', 'Lean red meat'] },
  { title: 'Enjoy occasionally', color: '#f87171', desc: 'No food is banned. Enjoy these sometimes rather than making them the base of your day.', items: ['Fried & fast food', 'Sweets, cake & chocolate', 'Sugary & energy drinks', 'Processed meats'] },
]
const PRINCIPLES = [
  { emoji: '🍽️', title: 'Protein at every meal', text: 'It keeps you full for longer and helps your body repair and stay strong.' },
  { emoji: '🥬', title: 'Half your plate plants', text: 'Veg and fruit bring fibre, vitamins and volume that fill you up for very few calories.' },
  { emoji: '💧', title: 'Reach for water first', text: 'Mild thirst often feels like hunger. A glass of water settles it more often than you would think.' },
  { emoji: '🌱', title: 'Mostly whole foods', text: 'Foods close to how they grow keep you fuller and your energy steadier than processed versions.' },
  { emoji: '🧠', title: 'Slow down at meals', text: 'Fullness takes a few minutes to land. Eating a little slower helps you stop at just right.' },
  { emoji: '🎯', title: 'Nothing is off-limits', text: 'Treats fit a healthy diet. It is your everyday pattern, not any single meal, that counts.' },
]
const LESSONS = [
  { id: 'protein', emoji: '🍗', title: 'Protein made simple', summary: 'How much you really need and where to get it', body: ['Protein keeps you full and helps your body repair, whether your goal is building muscle or losing fat.', 'Aim for a palm sized portion at each main meal: chicken, fish, eggs, Greek yoghurt, beans or tofu. Shakes are just a handy backup, not a must.'], takeaway: 'A palm of protein at each meal covers most people. Real food first, supplements only if convenient.' },
  { id: 'carbs', emoji: '🍞', title: 'Carbs made simple', summary: 'Smart carbs fuel training and focus', body: ['Carbs are your body and brain’s main fuel. Cutting them out can leave you tired, hungry and unfocused.', 'Choose mostly oats, rice, potatoes, wholegrain bread and fruit. Limit highly refined and sugary options more often.'], takeaway: 'Carbs support training and concentration. Focus on the type and portion rather than avoiding them.' },
  { id: 'moderation', emoji: '🌿', title: 'A balanced approach to food', summary: 'Why "good" and "bad" food is a trap', body: ['There are no forbidden foods, only how often and how much. Chocolate, pizza and a night out can all fit a healthy diet.', 'A simple guide: build around mostly nutritious whole foods, and leave room for the things you enjoy.'], takeaway: 'No single meal makes or breaks your diet. Your everyday pattern is what counts.' },
  { id: 'budget', emoji: '💸', title: 'Eating well on a budget', summary: 'Great food does not need to be expensive', body: ['Cheap protein heroes: eggs, tinned tuna, beans, lentils, frozen chicken, milk and Greek yoghurt.', 'Frozen veg is as nutritious as fresh and lasts for weeks. Batch cook a big pot and you have lunches sorted for days.'], takeaway: 'Healthy eating can be cheap: lean on frozen veg, tinned staples and cook once, eat twice.' },
  { id: 'fibre', emoji: '🥦', title: 'Why fibre matters', summary: 'The nutrient most people miss', body: ['Fibre comes from plants like vegetables, fruit, beans, oats and wholegrains, and most people fall short.', 'It supports digestion and keeps you fuller and steadier. Keep skins on, choose wholegrain, and add beans to meals.'], takeaway: 'Aim for more plants each day, an easy way to stay full and feel steadier.' },
  { id: 'hydration', emoji: '🚰', title: 'Hydration and hunger', summary: 'Why hydration helps your diet', body: ['Mild thirst can feel like hunger. A glass of water before a snack often settles it.', 'Sip through the day, and a reusable bottle is the easiest reminder. Remember juice, fizzy drinks and coffees carry calories too.'], takeaway: 'Reach for water first. It is the free, zero-calorie default that often settles a craving.' },
]

/* Scripted meal-scan samples (no real ML) — cycle through on each scan. */
type ScanSample = { name: string; confidence: number; kcal: number; p: number; c: number; f: number; photo: string; items: string[]; rec: 'freely' | 'moderation' | 'occasional'; note: string }
const px = (id: number) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=600`
const SCAN_SAMPLES: ScanSample[] = [
  { name: 'Grilled chicken & rice bowl', confidence: 94, kcal: 645, p: 48, c: 72, f: 18, photo: px(1640777), items: ['Chicken breast', 'White rice', 'Mixed veg'], rec: 'freely', note: 'Lean protein, smart carbs and plenty of veg. A great everyday meal.' },
  { name: 'Scrambled eggs on toast', confidence: 91, kcal: 380, p: 22, c: 30, f: 18, photo: px(824635), items: ['Eggs', 'White toast', 'Butter'], rec: 'moderation', note: 'Good protein, but white toast and butter add up. Fine a few times a week.' },
  { name: 'Salmon, potatoes & greens', confidence: 88, kcal: 525, p: 42, c: 46, f: 14, photo: px(3763847), items: ['Salmon fillet', 'Baby potatoes', 'Green beans'], rec: 'freely', note: 'Omega 3s, protein and fibre. One of the best plates you can build.' },
  { name: 'Greek yogurt & berry bowl', confidence: 90, kcal: 330, p: 24, c: 38, f: 9, photo: px(1099680), items: ['Greek yogurt', 'Granola', 'Mixed berries'], rec: 'freely', note: 'High protein and light on calories. An ideal snack or breakfast.' },
]
const REC_INFO: Record<ScanSample['rec'], { label: string; color: string }> = {
  freely: { label: 'Enjoy freely', color: '#7ED957' },
  moderation: { label: 'In moderation', color: '#F5A524' },
  occasional: { label: 'Keep occasional', color: '#f87171' },
}

/* Nutrition owns its scrolling now (the app shell no longer wraps it in an outer
 * ScrollView), so each tab's scroller must leave room for the floating bottom nav. */
function useScrollPad() {
  const insets = useSafeAreaInsets()
  return { paddingBottom: insets.bottom + 96 }
}

/* The Guide's coach header pins differently per platform: native uses the ScrollView's
 * stickyHeaderIndices; web uses CSS position:sticky. The web path matters because
 * RN-Web's stickyHeader *JS* scroll handler cancels smooth programmatic scrolls — CSS
 * sticky has no such handler, so smooth "scroll the opened lesson into view" works. */
const IS_WEB = typeof document !== 'undefined'
const WEB_STICKY = IS_WEB ? ({ position: 'sticky', top: 0, zIndex: 30 } as any) : null

// Android needs LayoutAnimation turned on explicitly (iOS/web are on by default).
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}
// A gentle accordion open/close for the Go deeper lessons — animates the height
// change and fades the revealed copy, so it slides open instead of popping.
const LESSON_ANIM = { duration: 260, update: { type: 'easeInEaseOut' as const }, create: { type: 'easeInEaseOut' as const, property: 'opacity' as const }, delete: { type: 'easeInEaseOut' as const, property: 'opacity' as const } }

/* Tab entrance: fade + slight rise (design's shoFade). */
function FadeIn({ children }: { children: ReactNode }) {
  const a = useRef(new Animated.Value(0)).current
  useEffect(() => { Animated.timing(a, { toValue: 1, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start() }, [a])
  return <Animated.View style={{ flex: 1, opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }}>{children}</Animated.View>
}

/* Expand reveal: fade + rise on mount (design's shoRise) — used when a
 * Go deeper lesson or a plate's examples open. Enter-only, matching the design. */
function Rise({ children }: { children: ReactNode }) {
  const a = useRef(new Animated.Value(0)).current
  useEffect(() => { Animated.timing(a, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start() }, [a])
  return <Animated.View style={{ opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>{children}</Animated.View>
}

/* Opacity-only cross-fade — used to fade the plate's feature card content when the
 * selected slice changes (the design cross-fades the copy rather than snapping it). */
function Fade({ children }: { children: ReactNode }) {
  const a = useRef(new Animated.Value(0)).current
  useEffect(() => { a.setValue(0); Animated.timing(a, { toValue: 1, duration: 180, easing: Easing.out(Easing.ease), useNativeDriver: true }).start() }, [a])
  return <Animated.View style={{ opacity: a }}>{children}</Animated.View>
}

/* Native smooths the lesson accordion with LayoutAnimation (height); RN-Web ignores
 * LayoutAnimation, so on web we fade+rise the revealed body instead. */
function LessonReveal({ children }: { children: ReactNode }) {
  return IS_WEB ? <Rise>{children}</Rise> : <>{children}</>
}

/* A small pop-in for tick marks (design's tickPop). */
function TickPop({ children }: { children: ReactNode }) {
  const a = useRef(new Animated.Value(0)).current
  useEffect(() => { Animated.spring(a, { toValue: 1, speed: 16, bounciness: 12, useNativeDriver: true }).start() }, [a])
  return <Animated.View style={{ transform: [{ scale: a }] }}>{children}</Animated.View>
}

/* Dropdown selector — the RN stand-in for the design's styled <select>. Taps the
 * field to open a bottom-sheet option list. The sheet sits over a full-screen
 * backdrop, so tapping anywhere outside the sheet dismisses it. A short guard
 * ignores the opening tap so the sheet can't immediately re-close. */
function Dropdown({ value, placeholder, options, onSelect }: { value: string; placeholder?: string; options: { value: string; label: string }[]; onSelect: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const guard = useRef(0)
  const current = options.find((o) => o.value === value)
  const openMenu = () => { guard.current = Date.now(); setOpen(true) }
  const dismiss = () => { if (Date.now() - guard.current > 180) setOpen(false) }
  return (
    <View>
      <Pressable onPress={openMenu} className="flex-row items-center justify-between rounded-[13px] bg-ink-700 px-3.5 py-3 active:opacity-80">
        <Text numberOfLines={1} className={`flex-1 text-[14px] font-semibold ${current ? 'text-white' : 'text-white/45'}`}>{current?.label ?? placeholder}</Text>
        <ChevronDown size={18} color="rgba(255,255,255,0.5)" style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
      </Pressable>
      <AppModal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <Pressable onPress={dismiss} className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <Pressable onPress={() => {}} className="rounded-t-[24px] border-t border-white/10 bg-ink-800 px-4 pb-8 pt-3" style={{ maxHeight: '70%' }}>
            <View className="mb-2.5 h-1 w-10 self-center rounded-full bg-white/20" />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {options.length === 0 && <Text className="px-2 py-6 text-center text-[14px] text-white/45">Nothing to choose from yet.</Text>}
              {options.map((o, i) => {
                const on = o.value === value
                return (
                  <Pressable
                    key={o.value}
                    onPress={() => { onSelect(o.value); setOpen(false) }}
                    className="flex-row items-center justify-between rounded-xl px-3.5 py-3 active:opacity-80"
                    style={{ backgroundColor: on ? alpha('#7ED957', 0.12) : 'transparent', marginTop: i === 0 ? 0 : 2 }}
                  >
                    <Text className="text-[15px] font-semibold" style={{ color: on ? '#7ED957' : '#fff' }}>{o.label}</Text>
                    {on && <Check size={17} color="#7ED957" strokeWidth={3} />}
                  </Pressable>
                )
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </AppModal>
    </View>
  )
}

/* ============================ Root ============================ */
export default function Nutrition() {
  const [tab, setTab] = useState<TabKey>('Overview')
  const [recipe, setRecipe] = useState<BudgetMeal | UserMeal | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<UserMeal | null>(null)

  const openAdd = (m?: UserMeal) => { setEditing(m ?? null); setAddOpen(true) }

  return (
    <View className="flex-1 px-5">
      <Text className="mb-3.5 mt-2 text-[26px] font-extrabold tracking-tight text-white">Nutrition</Text>

      <View className="mb-5 flex-row gap-6 border-b border-white/[0.07]">
        {TABS.map((t) => {
          const active = tab === t
          return (
            <Pressable key={t} onPress={() => setTab(t)} className="relative pb-3">
              <Text className={`text-[15px] font-semibold ${active ? 'text-brand-400' : 'text-white/50'}`}>{t}</Text>
              {active && <View className="absolute -bottom-px left-[-2px] right-[-2px] h-[2.5px] rounded-full bg-brand-400" />}
            </Pressable>
          )
        })}
      </View>

      {tab === 'Overview' && <FadeIn key="Overview"><OverviewTab /></FadeIn>}
      {tab === 'Recipes' && <FadeIn key="Recipes"><RecipesTab onOpenRecipe={setRecipe} onAddMeal={() => openAdd()} /></FadeIn>}
      {tab === 'Meal Plan' && <FadeIn key="Meal Plan"><MealPlanTab /></FadeIn>}
      {tab === 'Guide' && <FadeIn key="Guide"><GuideTab /></FadeIn>}

      <RecipeModal meal={recipe} onClose={() => setRecipe(null)} onEdit={(m) => { setRecipe(null); openAdd(m) }} />
      <AddMealSheet open={addOpen} editing={editing} onClose={() => setAddOpen(false)} />
    </View>
  )
}

function toneColor(tone: TagTone, c: ReturnType<typeof useColors>): string {
  return tone === 'good' ? c.brand400 : tone === 'neutral' ? c.accentBlue : c.accentOrange
}

/* ============================ Overview ============================ */
type ScanState = 'idle' | 'analyzing' | 'result' | 'logged'
function OverviewTab() {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const c = useColors()
  const scrollPad = useScrollPad()
  const selected = nutritionTagsForDay(state)

  const [scan, setScan] = useState<ScanState>('idle')
  const [img, setImg] = useState<string | null>(null)
  const [result, setResult] = useState<ScanSample | null>(null)
  const [servings, setServings] = useState(1)
  const [nameEdit, setNameEdit] = useState<string | null>(null)
  const [logPick, setLogPick] = useState(false)
  const [loggedMsg, setLoggedMsg] = useState({ title: '', sub: '' })
  const idxRef = useRef(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  function nextSample(): ScanSample {
    const s = SCAN_SAMPLES[idxRef.current % SCAN_SAMPLES.length]
    idxRef.current += 1
    return s
  }
  async function pick(from: 'camera' | 'library') {
    try {
      const res = from === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.6 })
      if (res.canceled) return
      const sample = nextSample()
      setImg(res.assets[0].uri); setResult(sample); setServings(1); setNameEdit(null); setLogPick(false); setScan('analyzing')
      timers.current.push(setTimeout(() => setScan('result'), 1900))
    } catch {
      toast("Couldn't open the camera")
    }
  }
  function trySample() {
    const sample = nextSample()
    setImg(null); setResult(sample); setServings(1); setNameEdit(null); setLogPick(false); setScan('analyzing')
    timers.current.push(setTimeout(() => setScan('result'), 1500))
  }
  function retake() { setScan('idle'); setImg(null); setResult(null); setServings(1); setLogPick(false); setNameEdit(null) }
  const scanName = () => (nameEdit != null && nameEdit.trim() ? nameEdit.trim() : result?.name ?? '')
  function logMeal(slot: MealName) {
    if (!result) return
    const day = todayShort()
    dispatch({ type: 'ADD_PLANNED_MEAL', plan: { day, slot, name: scanName(), w: 0 } })
    setLoggedMsg({ title: `Logged to ${slot}, ${day}`, sub: 'Saved to your meal plan' })
    setLogPick(false); setScan('logged')
    toast(`Added to ${slot}, ${day}`)
    timers.current.push(setTimeout(retake, 1250))
  }
  function saveToMeals() {
    if (!result) return
    dispatch({ type: 'ADD_MY_MEAL', meal: { name: scanName(), kcal: Math.round(result.kcal * servings), p: Math.round(result.p * servings), c: Math.round(result.c * servings), f: Math.round(result.f * servings), ingredients: result.items.slice(), notes: 'Scanned meal' } })
    setLoggedMsg({ title: scanName(), sub: 'Saved to My Meals' })
    setLogPick(false); setScan('logged')
    toast('Saved to My Meals')
    timers.current.push(setTimeout(retake, 1250))
  }

  const kcal = result ? Math.round(result.kcal * servings) : 0
  const rec = result ? REC_INFO[result.rec] : REC_INFO.freely
  const macros = result
    ? (() => {
        const pk = result.p * 4 * servings, ck = result.c * 4 * servings, fk = result.f * 9 * servings, tot = pk + ck + fk || 1
        return [
          { label: 'Protein', g: Math.round(result.p * servings), color: c.accentBlue, pct: Math.round((pk / tot) * 100) },
          { label: 'Carbs', g: Math.round(result.c * servings), color: c.accentOrange, pct: Math.round((ck / tot) * 100) },
          { label: 'Fat', g: Math.round(result.f * servings), color: c.accentPurple, pct: Math.round((fk / tot) * 100) },
        ]
      })()
    : []
  const scanImg = img || (result ? result.photo : '')

  const tagCount = selected.length
  const tagCountLabel = tagCount === 0 ? 'Tap any that fit your day' : `${tagCount} logged today`

  return (
    <ScrollView className="flex-1" contentContainerStyle={scrollPad} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>

      {/* Scanner */}
      <View className="overflow-hidden rounded-[20px] border border-white/[0.06] bg-ink-800 p-3.5">
        <View className="flex-row items-center gap-2.5">
          <View className="h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: alpha('#7ED957', 0.12) }}>
            <Camera size={18} color={c.brand400} />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-[18px] font-extrabold leading-tight text-white">Snap your meal</Text>
            <Text className="mt-0.5 text-[14px] text-white/60">How healthy is your meal really?</Text>
          </View>
        </View>

        {scan === 'idle' && (
          <>
            <Pressable onPress={() => pick('camera')} className="mt-3.5 flex-row items-center justify-center gap-2.5 rounded-xl bg-brand-400 py-3.5 active:opacity-90">
              <Camera size={19} color="#0a0a0b" strokeWidth={2.4} />
              <Text className="text-[15px] font-extrabold text-black">Take a photo</Text>
            </Pressable>
            <View className="mt-3 flex-row items-center justify-center gap-4">
              <Pressable onPress={() => pick('library')} className="flex-row items-center gap-1.5 active:opacity-70">
                <Upload size={14} color="rgba(255,255,255,0.6)" />
                <Text className="text-[14px] font-semibold text-white/70">Upload from library</Text>
              </Pressable>
              <View className="h-[3px] w-[3px] rounded-full bg-white/25" />
              <Pressable onPress={trySample} className="active:opacity-70"><Text className="text-[14px] font-semibold text-brand-400">Try a sample</Text></Pressable>
            </View>
          </>
        )}

        {scan === 'analyzing' && <ScanAnalyzing img={scanImg} />}

        {scan === 'result' && result && (
          <View>
            <View className="mt-3 flex-row items-center gap-3">
              <Image source={{ uri: scanImg }} resizeMode="cover" className="h-[50px] w-[50px] rounded-xl bg-ink-700" />
              <View className="min-w-0 flex-1">
                <View className="flex-row items-center gap-1.5">
                  <Check size={13} color={c.brand400} strokeWidth={3} />
                  <Text className="text-[10.5px] font-extrabold text-brand-400">{result.confidence}% match</Text>
                </View>
                <View className="mt-0.5 flex-row items-center gap-2">
                  <TextInput
                    value={nameEdit != null ? nameEdit : result.name}
                    onChangeText={setNameEdit}
                    className="min-w-0 flex-1 p-0 text-[14.5px] font-extrabold text-white"
                  />
                  <Pencil size={14} color="rgba(255,255,255,0.35)" />
                </View>
              </View>
            </View>
            <Text className="mt-1.5 text-[10px] leading-[1.4] text-white/35">this is our best guess and may not be 100% accurate. tap the name to edit it.</Text>

            <View className="mt-3 flex-row items-end justify-between gap-3">
              <View>
                <Text className="text-[10px] font-extrabold uppercase tracking-wider text-white/40">Est. calories</Text>
                <View className="flex-row items-baseline gap-1.5">
                  <Text className="text-[30px] font-black leading-none text-brand-400">{kcal}</Text>
                  <Text className="text-[13px] font-bold text-white/50">kcal</Text>
                </View>
              </View>
              <View className="flex-row items-center overflow-hidden rounded-full border border-white/10 bg-white/[0.04]">
                <Pressable onPress={() => setServings((s) => Math.max(1, s - 1))} className="h-8 w-8 items-center justify-center active:opacity-70"><Text className="text-[16px] font-extrabold text-white">−</Text></Pressable>
                <Text className="min-w-[72px] text-center text-[11.5px] font-bold text-white/80">{servings === 1 ? '1 serving' : `${servings} servings`}</Text>
                <Pressable onPress={() => setServings((s) => Math.min(6, s + 1))} className="h-8 w-8 items-center justify-center active:opacity-70"><Text className="text-[16px] font-extrabold text-brand-400">+</Text></Pressable>
              </View>
            </View>

            <View className="mt-3 gap-2">
              {macros.map((m) => (
                <View key={m.label} className="flex-row items-center gap-2.5">
                  <Text className="w-[52px] text-[11.5px] font-bold text-white/70">{m.label}</Text>
                  <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]"><View style={{ width: `${m.pct}%`, backgroundColor: m.color }} className="h-full rounded-full" /></View>
                  <Text className="w-10 text-right text-[12px] font-extrabold text-white">{m.g}g</Text>
                </View>
              ))}
            </View>

            <View className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
              <View className="flex-row items-center gap-2">
                <View className="h-2 w-2 rounded-full" style={{ backgroundColor: rec.color }} />
                <Text className="text-[12px] font-extrabold" style={{ color: rec.color }}>{rec.label}</Text>
              </View>
              <Text className="mt-1.5 text-[12px] leading-[1.5] text-white/65">{result.note}</Text>
            </View>

            {logPick ? (
              <View className="mt-3 rounded-[13px] border p-3" style={{ borderColor: alpha('#7ED957', 0.28), backgroundColor: alpha('#7ED957', 0.06) }}>
                <Text className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-white/60">Log to {todayShort()}. Which meal?</Text>
                <View className="flex-row gap-1.5">
                  {SLOTS.map((sl) => (
                    <Pressable key={sl} onPress={() => logMeal(sl)} className="flex-1 items-center rounded-[10px] border border-white/10 bg-ink-700 px-1 py-2.5 active:opacity-80"><Text className="text-[11.5px] font-bold text-white">{sl}</Text></Pressable>
                  ))}
                </View>
                <Pressable onPress={() => setLogPick(false)} className="mt-2 items-center active:opacity-70"><Text className="text-[11.5px] font-bold text-white/45">Cancel</Text></Pressable>
              </View>
            ) : (
              <>
                <View className="mt-3 flex-row gap-2.5">
                  <Pressable onPress={() => setLogPick(true)} className="flex-[2] items-center rounded-xl bg-brand-400 py-2.5 active:opacity-90"><Text className="text-[13.5px] font-extrabold text-black">Add to today's log</Text></Pressable>
                  <Pressable onPress={retake} className="flex-1 items-center rounded-xl bg-white/[0.06] py-2.5 active:opacity-80"><Text className="text-[13.5px] font-bold text-white">Retake</Text></Pressable>
                </View>
                <Pressable onPress={saveToMeals} className="mt-2 flex-row items-center justify-center gap-1.5 rounded-xl border py-2.5 active:opacity-80" style={{ borderColor: alpha('#7ED957', 0.28), backgroundColor: alpha('#7ED957', 0.1) }}>
                  <Plus size={15} color={c.brand400} strokeWidth={2.4} />
                  <Text className="text-[13px] font-bold text-brand-400">Save to My Meals</Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        {scan === 'logged' && (
          <View className="items-center gap-2.5 px-3 pb-3.5 pt-5">
            <View className="h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: alpha('#7ED957', 0.16) }}><Check size={30} color={c.brand400} strokeWidth={3} /></View>
            <Text className="text-[14.5px] font-extrabold text-white">{loggedMsg.title}</Text>
            <Text className="text-[12px] text-white/50">{loggedMsg.sub}</Text>
          </View>
        )}
      </View>

      {/* Day tags */}
      <View className="mt-4 rounded-[22px] border border-white/5 bg-ink-800 px-[18px] py-5">
        <View className="items-center">
          <Text className="text-[18px] font-extrabold tracking-tight text-white">How did your eating today go?</Text>
          <Text className="mt-1 text-[13px] font-semibold" style={{ color: alpha('#7ED957', 0.9) }}>{tagCountLabel}</Text>
        </View>
        <View className="mt-4 flex-row flex-wrap" style={{ gap: 9 }}>
          {NUTRITION_TAGS.map((t) => {
            const on = selected.includes(t.id)
            const tint = toneColor(t.tone, c)
            return (
              <Pressable
                key={t.id}
                onPress={() => dispatch({ type: 'TOGGLE_NUTRITION_TAG', tag: t.id })}
                style={{ width: '48%', paddingVertical: 13, paddingHorizontal: 12, gap: 9, backgroundColor: on ? alpha(tint, 0.16) : 'rgba(255,255,255,0.05)', boxShadow: on ? `inset 0 0 0 1.5px ${alpha(tint, 0.55)}` : undefined }}
                className="flex-row items-center rounded-[14px] active:opacity-80"
              >
                <Text className="text-[19px] leading-none">{t.emoji}</Text>
                <Text className="min-w-0 flex-1 text-[13px] font-semibold leading-[1.15]" style={{ color: on ? tint : 'rgba(255,255,255,0.75)' }}>{t.label}</Text>
                {on && <TickPop><View className="h-[17px] w-[17px] items-center justify-center rounded-full bg-brand-400"><Check size={10} color="#0a0a0b" strokeWidth={3.6} /></View></TickPop>}
              </Pressable>
            )
          })}
        </View>
        <View className="mt-3.5 flex-row items-center justify-center gap-1.5">
          <LayoutGrid size={13} color="rgba(255,255,255,0.38)" />
          <Text className="text-[11.5px] text-white/40">These show on the Dashboard.</Text>
        </View>
      </View>
    </ScrollView>
  )
}

function ScanAnalyzing({ img }: { img: string }) {
  const scan = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(scan, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(scan, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]))
    loop.start()
    return () => loop.stop()
  }, [scan])
  const translateY = scan.interpolate({ inputRange: [0, 1], outputRange: [8, 130] })
  return (
    <View className="relative mt-3 h-[150px] overflow-hidden rounded-[15px] bg-ink-900">
      {!!img && <Image source={{ uri: img }} resizeMode="cover" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(10,10,11,0.45)' }} />
      <Animated.View style={{ position: 'absolute', left: '6%', right: '6%', height: 2, transform: [{ translateY }] }}>
        <LinearGradient colors={['transparent', '#7ED957', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, borderRadius: 2 }} />
      </Animated.View>
      <View className="absolute inset-0 items-center justify-center gap-2.5">
        <ActivityIndicator color="#7ED957" />
        <Text className="text-[12.5px] font-bold text-white">Analyzing your plate…</Text>
      </View>
    </View>
  )
}

/* ============================ Recipes ============================ */
function RecipesTab({ onOpenRecipe, onAddMeal }: { onOpenRecipe: (m: BudgetMeal | UserMeal) => void; onAddMeal: () => void }) {
  const { state } = useStore()
  const c = useColors()
  const scrollPad = useScrollPad()
  const myMeals = state.myMeals ?? []
  const [cat, setCat] = useState<(typeof CATS)[number]>('All')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const loadT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const bump = () => { setLoading(true); clearTimeout(loadT.current); loadT.current = setTimeout(() => setLoading(false), 340) }
  useEffect(() => () => clearTimeout(loadT.current), [])

  const q = query.trim().toLowerCase()
  const filtered = BUDGET_MEALS.filter((m) => (cat === 'All' || m.category === cat) && (!q || m.name.toLowerCase().includes(q) || (m.flavour ?? '').toLowerCase().includes(q)))
  const countLabel = loading ? 'Finding recipes…' : `${filtered.length} ${filtered.length === 1 ? 'recipe' : 'recipes'}`

  return (
    <ScrollView className="flex-1" contentContainerStyle={scrollPad} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>

      {/* My meals */}
      <View className="mb-2.5 flex-row items-center justify-between">
        <Text className="text-[12px] font-extrabold uppercase tracking-[1.4px] text-white/40">My meals</Text>
        <Pressable onPress={onAddMeal} className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5 active:opacity-80" style={{ backgroundColor: alpha('#7ED957', 0.14) }}>
          <Plus size={13} color={c.brand400} strokeWidth={2.6} />
          <Text className="text-[12px] font-bold text-brand-400">Add a meal</Text>
        </Pressable>
      </View>
      {myMeals.length === 0 ? (
        <Pressable onPress={onAddMeal} className="mb-1 items-center rounded-2xl border border-dashed border-white/[0.12] px-5 py-6 active:opacity-80">
          <Text className="text-center text-[13px] text-white/45">Save meals you cook often for quick planning.</Text>
        </Pressable>
      ) : (
        <View className="gap-2.5">
          {myMeals.map((m) => (
            <Pressable key={m.id} onPress={() => onOpenRecipe(m)} className="flex-row items-center gap-3 rounded-2xl border border-white/[0.06] bg-ink-800 px-3.5 py-3 active:opacity-80">
              <View className="min-w-0 flex-1">
                <Text numberOfLines={1} className="text-[14px] font-bold text-white">{m.name}</Text>
                <Text numberOfLines={1} className="mt-0.5 text-[11.5px] text-white/50">{m.ingredients.slice(0, 4).join(', ') || m.notes || 'My recipe'}</Text>
              </View>
              <Text className="text-[11px] font-bold text-brand-400">{m.kcal} kcal · {m.p}g protein</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Recipes header */}
      <View className="mt-7">
        <ChefHat size={22} color={c.brand400} />
        <Text className="mt-2 text-[20px] font-extrabold tracking-tight text-white">Easy recipes worth cooking</Text>
      </View>

      {/* Category chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5 mt-4" contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
        {CATS.map((cc) => {
          const active = cat === cc
          return (
            <Pressable key={cc} onPress={() => { setCat(cc); bump() }} className={`rounded-full px-4 py-2 active:opacity-80 ${active ? 'bg-brand-400' : 'bg-white/[0.06]'}`}>
              <Text className={`text-[13px] font-semibold ${active ? 'text-black' : 'text-white/75'}`}>{cc}</Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {/* Search */}
      <View className="mt-3 flex-row items-center gap-2.5 rounded-[14px] border border-white/[0.08] bg-ink-800 px-3.5">
        <Search size={16} color="rgba(255,255,255,0.35)" />
        <TextInput value={query} onChangeText={(t) => { setQuery(t); bump() }} placeholder="Search recipes…" placeholderTextColor="rgba(255,255,255,0.3)" className="flex-1 py-2.5 text-[14px] text-white" />
      </View>

      <Text className="mt-4 text-[12px] font-extrabold uppercase tracking-[1.6px] text-white/35">{countLabel}</Text>

      {loading ? (
        <View className="mt-2.5 gap-2.5">{[0, 1, 2].map((i) => <RecipeSkeleton key={i} />)}</View>
      ) : filtered.length > 0 ? (
        <View className="mt-2.5 gap-2.5">
          {filtered.map((m) => (
            <Pressable key={m.id} onPress={() => onOpenRecipe(m)} className="flex-row items-center gap-3 rounded-[18px] border border-white/[0.06] bg-ink-800 p-[11px] active:opacity-80">
              <Image source={{ uri: m.image }} resizeMode="cover" className="h-16 w-16 rounded-[13px] bg-ink-700" />
              <View className="min-w-0 flex-1">
                <Text numberOfLines={1} className="text-[14.5px] font-bold leading-tight text-white">{m.name}</Text>
                {!!m.flavour && <Text numberOfLines={2} className="mt-0.5 text-[12px] leading-[1.35] text-white/55">{m.flavour}</Text>}
                <View className="mt-1.5 flex-row items-center gap-1.5">
                  <Clock size={12} color={c.brand400} />
                  <Text className="text-[12px] font-bold text-brand-400">{m.minutes} min</Text>
                </View>
              </View>
              <ChevronRight size={18} color="rgba(255,255,255,0.3)" />
            </Pressable>
          ))}
        </View>
      ) : (
        <View className="mt-3 items-center rounded-[18px] border border-dashed border-white/15 px-6 py-9">
          <Text className="text-[26px]">🍽️</Text>
          <Text className="mt-2 text-[14px] font-bold text-white/65">No recipes match that</Text>
          <Text className="mt-1 text-[12px] text-white/40">Try another category or clear your search.</Text>
        </View>
      )}
    </ScrollView>
  )
}

function RecipeSkeleton() {
  const shimmer = useRef(new Animated.Value(0.4)).current
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(shimmer, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(shimmer, { toValue: 0.4, duration: 700, useNativeDriver: true }),
    ]))
    loop.start()
    return () => loop.stop()
  }, [shimmer])
  return (
    <Animated.View style={{ opacity: shimmer }} className="flex-row items-center gap-3 rounded-[18px] border border-white/[0.06] bg-ink-800 p-[11px]">
      <View className="h-16 w-16 rounded-[13px] bg-ink-600" />
      <View className="flex-1 gap-2">
        <View className="h-3 w-[68%] rounded-md bg-ink-600" />
        <View className="h-2.5 w-[88%] rounded-md bg-ink-600" />
        <View className="h-2.5 w-[34%] rounded-md bg-ink-600" />
      </View>
    </Animated.View>
  )
}

/* ============================ Meal Plan ============================ */
function MealPlanTab() {
  const { state, dispatch } = useStore()
  const scrollPad = useScrollPad()
  const toast = useToast()
  const c = useColors()
  const plan = state.mealPlan ?? []
  const myMeals = state.myMeals ?? []

  const [meal, setMeal] = useState('Overnight Oats')
  const [slot, setSlot] = useState<MealName>('Breakfast')
  const [days, setDays] = useState<string[]>(PLAN_DAYS.slice())  // repeat-on: multi-select
  const [planSearch, setPlanSearch] = useState('')
  const [weekOffset, setWeekOffset] = useState(0)
  const myMealNames = myMeals.map((m) => m.name)

  const wItems = plan.filter((p) => (p.w ?? 0) === weekOffset)
  const plannedCount = wItems.length

  const pq = planSearch.trim().toLowerCase()
  const wordStart = (name: string) => name.toLowerCase().split(/[^a-z0-9]+/).some((w) => w.startsWith(pq))
  const suggested = pq ? BUDGET_MEALS.filter((m) => wordStart(m.name)).slice(0, 6) : []

  // Days chosen, kept in week order for stable labels.
  const chosen = PLAN_DAYS.filter((d) => days.includes(d))
  const sameSet = (a: string[], b: string[]) => a.length === b.length && b.every((x) => a.includes(x))
  const scopeLabel =
    chosen.length === 0 ? '' :
    chosen.length === 7 ? 'every day' :
    sameSet(chosen, PLAN_DAYS.slice(0, 5)) ? 'Mon to Fri' :
    sameSet(chosen, PLAN_DAYS.slice(5)) ? 'the weekend' :
    chosen.length === 1 ? chosen[0] :
    `${chosen.slice(0, -1).join(', ')} & ${chosen[chosen.length - 1]}`
  const whenHint =
    !meal ? 'Pick a meal, then choose the days to repeat it on.' :
    chosen.length === 0 ? 'Pick at least one day to repeat on.' :
    `Adds ${meal} at ${slot.toLowerCase()} to ${scopeLabel}.`

  const toggleDay = (d: string) => setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))

  function addToPlan() {
    if (!meal) { toast('Pick a meal first'); return }
    if (chosen.length === 0) { toast('Pick at least one day'); return }
    let added = 0
    chosen.forEach((d) => {
      if (!wItems.some((p) => p.day === d && p.slot === slot && p.name === meal)) {
        dispatch({ type: 'ADD_PLANNED_MEAL', plan: { day: d, slot, name: meal, w: weekOffset } })
        added++
      }
    })
    setPlanSearch('')
    toast(added ? `Added to ${scopeLabel}` : 'Already planned')
  }
  function clearWeek() {
    wItems.forEach((p) => dispatch({ type: 'REMOVE_PLANNED_MEAL', id: p.id }))
    toast('Week cleared')
  }

  const now = new Date()
  const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7) + weekOffset * 7)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const fmt = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`
  const weekLabel = weekOffset === 0 ? 'This week' : weekOffset === -1 ? 'Last week' : weekOffset === 1 ? 'Next week' : weekOffset < 0 ? `${-weekOffset} weeks ago` : `In ${weekOffset} weeks`

  const QUICK: { label: string; set: string[] }[] = [
    { label: 'Every day', set: PLAN_DAYS.slice() },
    { label: 'Weekdays', set: PLAN_DAYS.slice(0, 5) },
    { label: 'Weekends', set: PLAN_DAYS.slice(5) },
  ]

  return (
    <ScrollView className="flex-1" contentContainerStyle={scrollPad} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>

      {/* Builder */}
      <View className="rounded-[22px] border border-white/[0.08] bg-ink-800 p-[18px]">
        <View className="flex-row items-center justify-between gap-2.5">
          <Text className="text-[18px] font-extrabold tracking-tight text-white">Plan your week</Text>
          <View className="flex-row items-center gap-2.5">
            <Text className="text-[11px] font-bold text-brand-400">{plannedCount} planned</Text>
            {plannedCount > 0 && <Pressable onPress={clearWeek} className="active:opacity-70"><Text className="text-[11px] font-bold text-white/45">Clear</Text></Pressable>}
          </View>
        </View>
        <Text className="mt-1.5 text-[13px] leading-[1.5] text-white/60">Pick a meal once and repeat it across the days you want. Same lunch every day is a single tap.</Text>

        <PlanLabel>My meals</PlanLabel>
        <Dropdown
          value={myMealNames.includes(meal) ? meal : ''}
          placeholder="Choose a saved meal…"
          options={myMeals.map((m) => ({ value: m.name, label: m.name }))}
          onSelect={setMeal}
        />

        <PlanLabel>Suggested meals</PlanLabel>
        <View className="flex-row items-center gap-2.5 rounded-[13px] bg-ink-700 px-3.5">
          <Search size={16} color="rgba(255,255,255,0.35)" />
          <TextInput value={planSearch} onChangeText={setPlanSearch} placeholder="Search easy recipes worth cooking…" placeholderTextColor="rgba(255,255,255,0.3)" className="flex-1 py-2.5 text-[14px] text-white" />
        </View>
        {suggested.length > 0 && (
          <View className="mt-2 gap-1.5">
            {suggested.map((m) => {
              const on = meal === m.name
              return (
                <Pressable key={m.id} onPress={() => setMeal(m.name)} className="flex-row items-center justify-between gap-2 rounded-[11px] px-3 py-2.5 active:opacity-80" style={{ backgroundColor: on ? alpha('#7ED957', 0.14) : 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: on ? alpha('#7ED957', 0.5) : 'rgba(255,255,255,0.08)' }}>
                  <Text className="text-[13px] font-semibold" style={{ color: on ? c.brand400 : 'rgba(255,255,255,0.82)' }}>{m.name}</Text>
                  {on && <Check size={16} color={c.brand400} strokeWidth={3} />}
                </Pressable>
              )
            })}
          </View>
        )}

        {/* Meal slot */}
        <PlanLabel>Meal slot</PlanLabel>
        <Dropdown value={slot} options={SLOTS.map((s) => ({ value: s, label: s }))} onSelect={(v) => setSlot(v as MealName)} />

        {/* Repeat on — tap day blocks to pick as many as you like */}
        <PlanLabel>Repeat on</PlanLabel>
        <View className="flex-row gap-2">
          {QUICK.map((q) => {
            const on = sameSet(chosen, q.set)
            return (
              <Pressable key={q.label} onPress={() => setDays(on ? [] : q.set.slice())} className="flex-1 items-center rounded-[11px] py-2.5 active:opacity-80" style={{ backgroundColor: on ? alpha('#7ED957', 0.16) : 'rgba(255,255,255,0.05)', boxShadow: on ? `inset 0 0 0 1.5px ${alpha('#7ED957', 0.55)}` : undefined }}>
                <Text className="text-[12.5px] font-bold" style={{ color: on ? c.brand400 : 'rgba(255,255,255,0.78)' }}>{q.label}</Text>
              </Pressable>
            )
          })}
        </View>
        <View className="mt-2 flex-row flex-wrap gap-2">
          {PLAN_DAYS.map((d) => {
            const on = days.includes(d)
            return (
              <Pressable key={d} onPress={() => toggleDay(d)} className="flex-row items-center gap-1.5 rounded-[11px] px-3.5 py-2 active:opacity-80" style={{ minWidth: 62, justifyContent: 'center', backgroundColor: on ? alpha('#7ED957', 0.16) : 'rgba(255,255,255,0.05)', boxShadow: on ? `inset 0 0 0 1.5px ${alpha('#7ED957', 0.55)}` : undefined }}>
                <Text className="text-[13px] font-bold" style={{ color: on ? c.brand400 : 'rgba(255,255,255,0.78)' }}>{d}</Text>
                {on && <Check size={13} color={c.brand400} strokeWidth={3.2} />}
              </Pressable>
            )
          })}
        </View>

        <View className="mt-3 flex-row items-start gap-1.5">
          <CalendarCheck size={14} color={c.brand400} style={{ marginTop: 1 }} />
          <Text className="flex-1 text-[11.5px] leading-[1.45] text-white/50">{whenHint}</Text>
        </View>

        <Pressable onPress={addToPlan} className="mt-4 flex-row items-center justify-center gap-2 rounded-[14px] bg-brand-400 py-3.5 active:opacity-90">
          <Plus size={16} color="#000" strokeWidth={2.6} />
          <Text className="text-[14.5px] font-extrabold text-black">Add to plan</Text>
        </Pressable>
      </View>

      {/* Week navigator */}
      <View className="mt-[18px] flex-row items-center justify-between gap-2.5">
        <Pressable onPress={() => setWeekOffset((w) => Math.max(-12, w - 1))} className="h-[42px] w-[42px] items-center justify-center rounded-full border border-white/[0.08] bg-ink-800 active:opacity-70" style={{ opacity: weekOffset <= -12 ? 0.3 : 1 }}><ChevronLeft size={20} color={c.brand400} strokeWidth={2.6} /></Pressable>
        <View className="min-w-0 flex-1 items-center">
          <Text className="text-[16px] font-extrabold tracking-tight text-white">{weekLabel}</Text>
          <Text className="mt-px text-[11.5px] font-semibold text-white/45">{fmt(mon)} to {fmt(sun)} · {plannedCount} planned</Text>
        </View>
        <Pressable onPress={() => setWeekOffset((w) => Math.min(6, w + 1))} className="h-[42px] w-[42px] items-center justify-center rounded-full border border-white/[0.08] bg-ink-800 active:opacity-70" style={{ opacity: weekOffset >= 6 ? 0.3 : 1 }}><ChevronRight size={20} color={c.brand400} strokeWidth={2.6} /></Pressable>
      </View>

      {/* Week */}
      <View className="mt-3 gap-2.5">
        {PLAN_DAYS.map((d) => {
          const items = wItems.filter((p) => p.day === d)
          return (
            <View key={d} className="rounded-[18px] border border-white/[0.06] bg-ink-800 px-4 py-3.5">
              <View className="mb-2 flex-row items-center justify-between">
                <Text className="text-[15px] font-extrabold text-white">{d}</Text>
                <Text className="text-[11px] font-semibold text-white/35">{items.length ? `${items.length} planned` : 'None'}</Text>
              </View>
              {items.length === 0 ? (
                <Text className="text-[12.5px] text-white/30">Nothing planned</Text>
              ) : (
                <View className="gap-2.5">
                  {items.map((it) => (
                    <View key={it.id} className="flex-row items-center gap-3">
                      <Text className="w-[66px] text-[10.5px] font-extrabold uppercase tracking-wide text-brand-400">{it.slot}</Text>
                      <Text numberOfLines={1} className="min-w-0 flex-1 text-[13px] text-white/80">{it.name}</Text>
                      <Pressable onPress={() => dispatch({ type: 'REMOVE_PLANNED_MEAL', id: it.id })} className="h-7 w-7 items-center justify-center rounded-full bg-white/5 active:opacity-70"><Trash2 size={13} color="rgba(255,255,255,0.45)" /></Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )
        })}
      </View>

      {/* Coach note */}
      <View className="mt-4 flex-row items-center gap-2.5 rounded-[16px] px-4 py-3.5" style={{ backgroundColor: alpha('#7ED957', 0.06) }}>
        <View className="h-[34px] w-[34px] items-center justify-center rounded-xl" style={{ backgroundColor: alpha('#7ED957', 0.14) }}><MessageCircle size={17} color={c.brand400} /></View>
        <Text className="flex-1 text-[13px] leading-[1.45] text-white/70">Ask your coach to review your meal plan.</Text>
      </View>
    </ScrollView>
  )
}

function PlanLabel({ children, tight }: { children: ReactNode; tight?: boolean }) {
  return <Text className={`text-[11px] font-extrabold uppercase tracking-wide text-white/40 ${tight ? 'mb-1.5' : 'mb-1.5 mt-3.5'}`}>{children}</Text>
}

/* ============================ Guide ============================ */
function GuideTab() {
  const c = useColors()
  const scrollPad = useScrollPad()
  const [plate, setPlate] = useState(0)
  const [plateEx, setPlateEx] = useState(false)
  const [lesson, setLesson] = useState<string | null>(null)
  const active = PLATE[plate]

  const scrollRef = useRef<ScrollView>(null)
  const goDeeperY = useRef(0)                       // Go deeper list offset within the scroll content
  const rowY = useRef<Record<string, number>>({})   // each lesson row's offset within that list

  /* Open/close a lesson and, on open, glide it into view just below the pinned
   * coach header (design scrolls the opened row toward the top on expand). On web
   * we animate the scroller directly (the design's approach); on native we scroll
   * to the row's captured offset. */
  function toggleLesson(id: string) {
    const willOpen = lesson !== id
    LayoutAnimation.configureNext(LESSON_ANIM)
    setLesson(willOpen ? id : null)
    if (!willOpen) return
    setTimeout(() => {
      if (IS_WEB && document.querySelector) {
        // Web: smooth browser-native scroll (works now that the header pins via CSS
        // sticky rather than RN-Web's stickyHeader JS handler, which cancelled it).
        const row = document.querySelector(`[data-lesson-id="${id}"]`) as HTMLElement | null
        if (!row) return
        row.style.scrollMarginTop = '58px'
        row.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else {
        // Native: smooth scroll to the row's captured offset within the guide scroller.
        const y = goDeeperY.current + (rowY.current[id] ?? 0)
        scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: true })
      }
    }, 140)
  }

  return (
    <ScrollView
      ref={scrollRef}
      className="flex-1"
      contentContainerStyle={scrollPad}
      showsVerticalScrollIndicator={false}
      stickyHeaderIndices={IS_WEB ? undefined : [0]}
    >
      {/* Coach header — pins to the top of the guide while it scrolls (design's sticky
          bar). Native: stickyHeaderIndices above. Web: CSS position:sticky (WEB_STICKY). */}
      <View className="flex-row items-center gap-[11px]" style={[{ marginHorizontal: -20, paddingHorizontal: 18, paddingVertical: 8, backgroundColor: '#111113', borderBottomWidth: 1, borderBottomColor: '#222225' }, WEB_STICKY]}>
        <View className="h-8 w-8 items-center justify-center rounded-[11px]" style={{ backgroundColor: alpha('#7ED957', 0.14) }}><MessageCircle size={16} color={c.brand400} /></View>
        <View className="min-w-0 flex-1">
          <Text className="text-[13.5px] font-extrabold leading-[1.1] text-white">Got a question?</Text>
          <Text className="mt-px text-[12px] text-white/70">Ask your coach from the Dashboard</Text>
        </View>
      </View>

      <View className="mt-6">
      {/* Balanced plate */}
      <View className="mb-1 flex-row items-center gap-2.5"><Text className="text-[19px]">🍽️</Text><Text className="text-[19px] font-extrabold tracking-tight text-white">The balanced plate</Text></View>
      <Text className="mb-4 text-[13px] leading-[1.5] text-white/55">Tap a section of the plate to see what goes where.</Text>

      <BalancedPlate selected={active.slice} onSelect={(i) => { setPlate(i); setPlateEx(false) }} />

      <View className="mt-3.5 flex-row items-center justify-center gap-2.5">
        <Text className="text-[20px]">🥑</Text>
        <Text className="text-[13px] font-semibold text-white/60">Add a small amount of <Text onPress={() => { setPlate(3); setPlateEx(false) }} className="font-bold" style={{ color: active.slice === 'fat' ? '#a98bf5' : '#8B5CF6' }}>healthy fat</Text> on the side</Text>
      </View>

      <View className="mt-6 flex-row flex-wrap" style={{ gap: 9 }}>
        {PLATE.map((p, i) => {
          const on = plate === i
          return (
            <Pressable key={p.slice} onPress={() => { setPlate(i); setPlateEx(false) }} style={{ width: '48%', paddingVertical: 11, paddingHorizontal: 12, gap: 9, backgroundColor: on ? alpha(p.color, 0.16) : 'rgba(255,255,255,0.05)', boxShadow: on ? `inset 0 0 0 1.5px ${alpha(p.color, 0.42)}` : undefined }} className="flex-row items-center rounded-[14px] active:opacity-80">
              <Text className="min-w-[18px] text-center text-[15px] font-black" style={{ color: p.color }}>{p.portion || p.icon}</Text>
              <Text className="min-w-0 flex-1 text-[12.5px] font-semibold leading-[1.15]" style={{ color: on ? p.color : 'rgba(255,255,255,0.82)' }}>{p.title}</Text>
              {on && <Check size={15} color={p.color} strokeWidth={3.2} />}
            </Pressable>
          )
        })}
      </View>

      {/* Feature card */}
      <View className="mt-3.5 rounded-2xl bg-white/[0.035] px-4 py-4">
        <Fade key={active.slice}>
          <View className="flex-row items-center gap-2"><View className="h-[9px] w-[9px] rounded-full" style={{ backgroundColor: active.color }} /><Text className="text-[15px] font-extrabold text-white">{active.title}</Text></View>
          <Text className="mt-1.5 text-[13px] leading-[1.55] text-white/70">{active.desc}</Text>
        </Fade>
        <Pressable onPress={() => setPlateEx((v) => !v)} className="mt-2.5 flex-row items-center gap-1 active:opacity-70">
          <Text className="text-[11.5px] font-bold" style={{ color: active.color }}>See examples</Text>
          <ChevronRight size={13} color={active.color} strokeWidth={2.6} style={{ transform: [{ rotate: plateEx ? '90deg' : '0deg' }] }} />
        </Pressable>
        {plateEx && (
          <Rise>
            <View className="mt-2.5 flex-row flex-wrap gap-1.5">
              {active.examples.map((ex) => <View key={ex} className="rounded-full bg-white/[0.06] px-3 py-1.5"><Text className="text-[12px] text-white/80">{ex}</Text></View>)}
            </View>
          </Rise>
        )}
      </View>

      {/* Portions by hand */}
      <View className="mb-1 mt-8 flex-row items-center gap-2.5"><Text className="text-[19px]">🖐️</Text><Text className="text-[19px] font-extrabold tracking-tight text-white">Portion sizes, by hand</Text></View>
      <Text className="mb-4 text-[13px] leading-[1.5] text-white/55">No scales needed. Your own hand scales with you.</Text>
      <View className="flex-row flex-wrap gap-2.5">
        {PORTIONS.map((p) => (
          <View key={p.hand} style={{ width: '47.5%' }} className="rounded-2xl border border-white/[0.06] bg-ink-800 p-3.5">
            <View className="h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: alpha(p.color, 0.16) }}><Text className="text-[24px]">{p.emoji}</Text></View>
            <View className="mt-2.5 flex-row items-center gap-1.5"><Text className="text-[14.5px] font-extrabold text-white">{p.hand}</Text><Text className="text-[12px] font-bold" style={{ color: p.color }}>· {p.title}</Text></View>
            <Text className="mt-1 text-[12.5px] leading-[1.4] text-white/55">{p.desc}</Text>
          </View>
        ))}
      </View>

      {/* Tiers */}
      <View className="mb-2.5 mt-8 flex-row items-center gap-2.5"><Text className="text-[19px]">🥗</Text><Text className="text-[19px] font-extrabold tracking-tight text-white">Eat more, and less, of</Text></View>
      <View className="gap-2.5">
        {TIERS.map((t) => (
          <View key={t.title} className="rounded-2xl bg-ink-800 px-4 py-3.5" style={{ borderLeftWidth: 3, borderLeftColor: t.color }}>
            <Text className="text-[15px] font-extrabold" style={{ color: t.color }}>{t.title}</Text>
            <Text className="mt-1 text-[12.5px] leading-[1.5] text-white/60">{t.desc}</Text>
            <View className="mt-2.5 flex-row flex-wrap gap-1.5">{t.items.map((it) => <View key={it} className="rounded-full bg-white/5 px-3 py-1.5"><Text className="text-[11px] text-white/70">{it}</Text></View>)}</View>
          </View>
        ))}
      </View>

      {/* Everyday wins */}
      <View className="mt-8 flex-row items-center gap-2.5"><Text className="text-[19px]">✨</Text><Text className="text-[19px] font-extrabold tracking-tight text-white">Simple everyday wins</Text></View>
      <Text className="mb-3 mt-1 text-[13px] leading-[1.5] text-white/55">Small habits that make healthy eating easier.</Text>
      {PRINCIPLES.map((p) => (
        <View key={p.title} className="flex-row items-start gap-3.5 border-t border-white/[0.06] py-3.5">
          <View className="h-[38px] w-[38px] items-center justify-center rounded-full" style={{ backgroundColor: alpha('#7ED957', 0.12) }}><Text className="text-[18px]">{p.emoji}</Text></View>
          <View className="min-w-0 flex-1"><Text className="text-[14px] font-extrabold text-white">{p.title}</Text><Text className="mt-0.5 text-[12.5px] leading-[1.5] text-white/60">{p.text}</Text></View>
        </View>
      ))}

      {/* Go deeper */}
      <View className="mb-2.5 mt-8 flex-row items-center gap-2.5"><Text className="text-[19px]">📚</Text><Text className="text-[19px] font-extrabold tracking-tight text-white">Go deeper</Text></View>
      <View className="gap-1" onLayout={(e) => { goDeeperY.current = e.nativeEvent.layout.y }}>
        {LESSONS.map((l) => {
          const open = lesson === l.id
          return (
            <View key={l.id} {...({ dataSet: { lessonId: l.id } } as any)} onLayout={(e) => { rowY.current[l.id] = e.nativeEvent.layout.y }} className="overflow-hidden rounded-[14px]" style={{ backgroundColor: open ? alpha('#7ED957', 0.05) : 'transparent', borderLeftWidth: open ? 3 : 0, borderLeftColor: c.brand400 }}>
              <Pressable onPress={() => toggleLesson(l.id)} className="flex-row items-center gap-3 px-3 py-3.5 active:opacity-80">
                <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: alpha('#7ED957', 0.12) }}><Text className="text-[19px]">{l.emoji}</Text></View>
                <View className="min-w-0 flex-1"><Text className="text-[14.5px] font-extrabold text-white">{l.title}</Text><Text numberOfLines={1} className="mt-px text-[12px] text-white/60">{l.summary}</Text></View>
                <ChevronDown size={18} color={open ? c.brand400 : 'rgba(255,255,255,0.35)'} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
              </Pressable>
              {open && (
                <LessonReveal>
                  <View className="gap-2.5 pb-4 pl-[54px] pr-3.5">
                    {l.body.map((para, i) => <Text key={i} className="text-[13px] leading-[1.65] text-white/70">{para}</Text>)}
                    <View className="mt-0.5 rounded-xl px-3.5 py-3" style={{ backgroundColor: alpha('#7ED957', 0.1) }}>
                      <Text className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-brand-400">Key takeaway</Text>
                      <Text className="text-[13px] leading-[1.55] text-white/85">{l.takeaway}</Text>
                    </View>
                  </View>
                </LessonReveal>
              )}
            </View>
          )
        })}
      </View>
      </View>
    </ScrollView>
  )
}

/* Smoothly transition the plate segments on selection. On web the design does this
 * with a CSS transition on the SVG paths (fill-opacity/stroke), which we mirror via a
 * style prop; on native react-native-svg snaps (no CSS), which is acceptable. */
const PATH_TRANSITION = (typeof document !== 'undefined'
  ? { style: { transition: 'fill-opacity .22s ease, stroke .22s ease, stroke-width .22s ease' } }
  : {}) as any

function BalancedPlate({ selected, onSelect }: { selected: PlateSlice['slice']; onSelect: (i: number) => void }) {
  const fill = (key: string) => (selected === key ? 1 : 0.4)
  const stroke = (key: string) => (selected === key ? 'rgba(255,255,255,0.75)' : '#131316')
  const sw = (key: string) => (selected === key ? 3 : 2.5)
  return (
    <View style={{ width: 236, height: 236, alignSelf: 'center' }}>
      <Svg viewBox="0 0 200 200" width={236} height={236}>
        <Path onPress={() => onSelect(0)} {...PATH_TRANSITION} d="M100,100 L100,188 A88,88 0 0 1 100,12 Z" fill="#7ED957" fillOpacity={fill('veg')} stroke={stroke('veg')} strokeWidth={sw('veg')} />
        <Path onPress={() => onSelect(1)} {...PATH_TRANSITION} d="M100,100 L100,12 A88,88 0 0 1 188,100 Z" fill="#3B82F6" fillOpacity={fill('protein')} stroke={stroke('protein')} strokeWidth={sw('protein')} />
        <Path onPress={() => onSelect(2)} {...PATH_TRANSITION} d="M100,100 L188,100 A88,88 0 0 1 100,188 Z" fill="#F5A524" fillOpacity={fill('carbs')} stroke={stroke('carbs')} strokeWidth={sw('carbs')} />
        <Circle cx="100" cy="100" r="96" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="1.5" />
        <SvgText x="50" y="107" textAnchor="middle" fontSize="27" fontWeight="800" fill="#fff">½</SvgText>
        <SvgText x="140" y="64" textAnchor="middle" fontSize="19" fontWeight="800" fill="#fff">¼</SvgText>
        <SvgText x="140" y="150" textAnchor="middle" fontSize="19" fontWeight="800" fill="#fff">¼</SvgText>
        <Circle cx="100" cy="100" r="27" fill="#131316" />
      </Svg>
    </View>
  )
}

/* ============================ Recipe modal ============================ */
function isUserMeal(m: BudgetMeal | UserMeal): m is UserMeal {
  return !('image' in m)
}
function RecipeModal({ meal, onClose, onEdit }: { meal: BudgetMeal | UserMeal | null; onClose: () => void; onEdit: (m: UserMeal) => void }) {
  const { dispatch } = useStore()
  const toast = useToast()
  const c = useColors()
  if (!meal) return null
  const budget = isUserMeal(meal) ? null : (meal as BudgetMeal)
  const um = isUserMeal(meal) ? meal : null
  const macroBits = [`${meal.kcal} kcal`, `${meal.p}g P`, meal.c ? `${meal.c}g C` : '', meal.f ? `${meal.f}g F` : ''].filter(Boolean)
  const macros = macroBits.join(' · ')

  async function copyRecipe() {
    if (!meal) return
    const lines = [meal.name, macros, '']
    if (meal.ingredients.length) { lines.push('INGREDIENTS', ...meal.ingredients.map((i) => `• ${i}`), '') }
    if (budget?.steps.length) { lines.push('METHOD', ...budget.steps.map((s, i) => `${i + 1}. ${s}`), '') }
    if (um?.notes) { lines.push('NOTES', um.notes, '') }
    lines.push('— via StrengthHub')
    try { await Clipboard.setStringAsync(lines.join('\n')); toast('Recipe copied to clipboard') } catch { toast("Couldn't copy") }
  }

  return (
    <AppModal visible={!!meal} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}>
        <Pressable onPress={() => {}} className="w-full max-w-[360px] overflow-hidden rounded-[26px] border border-white/10 bg-ink-800" style={{ maxHeight: '88%' }}>
          {budget ? (
            <View className="h-[158px]">
              <Image source={{ uri: budget.image }} resizeMode="cover" className="h-full w-full bg-ink-700" />
              <LinearGradient colors={['transparent', 'rgba(19,19,22,0.4)', '#131316']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
              <Pressable onPress={onClose} className="absolute right-3 top-3 h-[34px] w-[34px] items-center justify-center rounded-full active:opacity-80" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}><X size={17} color="#fff" /></Pressable>
              <View className="absolute inset-x-4 bottom-3">
                <Text className="text-[19px] font-extrabold leading-tight text-white">{budget.name}</Text>
                <View className="mt-1 flex-row items-center gap-1.5"><Clock size={13} color="#9fe264" /><Text className="text-[12.5px] font-bold text-brand-300">{budget.minutes} min · {budget.category} · serves {budget.serves}</Text></View>
              </View>
            </View>
          ) : (
            <View className="flex-row items-start justify-between gap-3 px-[18px] pb-1 pt-[18px]">
              <View className="min-w-0 flex-1"><Text className="text-[19px] font-extrabold leading-tight text-white">{meal.name}</Text><Text className="mt-1.5 text-[13px] font-bold text-brand-300">{macros}</Text></View>
              <Pressable onPress={onClose} className="h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] active:opacity-80"><X size={16} color="#fff" /></Pressable>
            </View>
          )}

          <ScrollView className="px-4 py-4" contentContainerStyle={{ gap: 16 }} showsVerticalScrollIndicator={false}>
            {budget && !!budget.flavour && <Text className="text-[13.5px] leading-[1.5] text-white/65">{budget.flavour}</Text>}
            {budget && (
              <View className="flex-row flex-wrap gap-1.5">
                {budget.tags.map((t) => <View key={t} className="rounded-full px-3 py-1" style={{ backgroundColor: alpha('#7ED957', 0.15) }}><Text className="text-[11px] font-bold text-brand-300">{t}</Text></View>)}
                <View className="rounded-full bg-white/[0.06] px-3 py-1"><Text className="text-[11px] font-bold text-white/60">{macros}</Text></View>
              </View>
            )}
            {meal.ingredients.length > 0 && (
              <View>
                <SectionHead>Ingredients</SectionHead>
                <View className="gap-1.5">{meal.ingredients.map((ing, i) => <View key={i} className="flex-row items-start gap-2.5"><View className="mt-[7px] h-[5px] w-[5px] rounded-full bg-brand-400" /><Text className="flex-1 text-[14px] leading-[1.4] text-white/80">{ing}</Text></View>)}</View>
              </View>
            )}
            {um?.notes && um.notes.trim() ? (
              <View><SectionHead>Notes</SectionHead><Text className="text-[14px] leading-[1.5] text-white/80">{um.notes}</Text></View>
            ) : null}
            {budget && budget.steps.length > 0 && (
              <View>
                <SectionHead>Method</SectionHead>
                <View className="gap-2.5">{budget.steps.map((st, i) => <View key={i} className="flex-row items-start gap-2.5"><View className="h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: alpha('#7ED957', 0.15) }}><Text className="text-[12px] font-extrabold text-brand-400">{i + 1}</Text></View><Text className="flex-1 text-[14px] leading-[1.5] text-white/80">{st}</Text></View>)}</View>
              </View>
            )}
            {budget?.cookOnce ? (
              <View className="rounded-xl px-3.5 py-3" style={{ backgroundColor: alpha('#7ED957', 0.08) }}><Text className="text-[13px] leading-[1.5] text-white/75">💡 {budget.cookOnce}</Text></View>
            ) : null}
          </ScrollView>

          <View className="flex-row gap-2.5 border-t border-white/[0.06] p-3">
            {um && (
              <>
                <Pressable onPress={() => { dispatch({ type: 'REMOVE_MY_MEAL', id: um.id }); onClose(); toast('Meal deleted') }} className="items-center justify-center rounded-[13px] px-4 py-3 active:opacity-80" style={{ backgroundColor: alpha('#f87171', 0.12), borderWidth: 1, borderColor: alpha('#f87171', 0.3) }}><Trash2 size={15} color="#f87171" /></Pressable>
                <Pressable onPress={() => onEdit(um)} className="flex-1 flex-row items-center justify-center gap-1.5 rounded-[13px] bg-white/[0.06] py-3 active:opacity-80"><Pencil size={15} color="#fff" /><Text className="text-[14px] font-bold text-white">Edit</Text></Pressable>
              </>
            )}
            <Pressable onPress={copyRecipe} className="flex-1 flex-row items-center justify-center gap-2 rounded-[13px] py-3 active:opacity-80" style={{ backgroundColor: alpha('#7ED957', 0.15) }}><Share2 size={15} color={c.brand400} /><Text className="text-[14px] font-bold text-brand-400">Copy recipe</Text></Pressable>
          </View>
        </Pressable>
      </Pressable>
    </AppModal>
  )
}

function SectionHead({ children }: { children: ReactNode }) {
  return <Text className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-white/40">{children}</Text>
}

/* ============================ Add / edit meal sheet ============================ */
function AddMealSheet({ open, editing, onClose }: { open: boolean; editing: UserMeal | null; onClose: () => void }) {
  const { dispatch } = useStore()
  const toast = useToast()
  const [name, setName] = useState('')
  const [ing, setIng] = useState('')
  const [notes, setNotes] = useState('')
  const [kcal, setKcal] = useState('')
  const [pro, setPro] = useState('')

  useEffect(() => {
    if (!open) return
    setName(editing?.name ?? '')
    setIng((editing?.ingredients ?? []).join('\n'))
    setNotes(editing?.notes ?? '')
    setKcal(editing?.kcal != null ? String(editing.kcal) : '')
    setPro(editing?.p != null ? String(editing.p) : '')
  }, [open, editing])

  function save() {
    if (!name.trim()) return
    const fields = {
      name: name.trim(),
      kcal: kcal ? parseInt(kcal) || 0 : 0,
      p: pro ? parseInt(pro) || 0 : 0,
      c: editing?.c ?? 0,
      f: editing?.f ?? 0,
      ingredients: ing.split('\n').map((x) => x.trim()).filter(Boolean),
      notes: notes.trim(),
    }
    if (editing) {
      dispatch({ type: 'REMOVE_MY_MEAL', id: editing.id })
      dispatch({ type: 'ADD_MY_MEAL', meal: fields })
      toast('Meal updated')
    } else {
      dispatch({ type: 'ADD_MY_MEAL', meal: fields })
      toast('Meal saved')
    }
    onClose()
  }

  const canSave = !!name.trim()
  return (
    <AppModal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
        <Pressable onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <View className="rounded-t-[26px] border-t border-white/10 bg-ink-800" style={{ maxHeight: '94%' }}>
          <View className="flex-row items-center justify-between px-[18px] pb-2 pt-[18px]">
            <View>
              <Text className="text-[18px] font-extrabold text-white">{editing ? 'Edit your meal' : 'Add your meal'}</Text>
              <Text className="mt-px text-[12px] text-white/50">{editing ? 'Update the details below.' : 'Save a recipe you cook often.'}</Text>
            </View>
            <Pressable onPress={onClose} className="h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] active:opacity-80"><X size={16} color="#fff" /></Pressable>
          </View>
          <ScrollView className="px-[18px]" contentContainerStyle={{ paddingBottom: 40, paddingTop: 12, gap: 14 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
            <Field label="Meal name">
              <TextInput value={name} onChangeText={setName} placeholder="e.g. My chicken rice bowl" placeholderTextColor="rgba(255,255,255,0.3)" className="rounded-[12px] bg-ink-700 px-[13px] py-3 text-[14px] text-white" />
            </Field>
            <Field label="Ingredients" optional>
              <TextInput value={ing} onChangeText={setIng} multiline placeholder={'2 chicken breasts\n1 cup rice\nHandful of veg'} placeholderTextColor="rgba(255,255,255,0.3)" style={{ minHeight: 84, textAlignVertical: 'top' }} className="rounded-[12px] bg-ink-700 px-[13px] py-3 text-[14px] leading-[1.5] text-white" />
            </Field>
            <Field label="Notes" optional>
              <TextInput value={notes} onChangeText={setNotes} multiline placeholder="Anything worth remembering about this meal" placeholderTextColor="rgba(255,255,255,0.3)" style={{ minHeight: 64, textAlignVertical: 'top' }} className="rounded-[12px] bg-ink-700 px-[13px] py-3 text-[14px] leading-[1.5] text-white" />
            </Field>
            <View className="flex-row gap-2.5">
              <View className="flex-1"><Field label="Calories" optional><TextInput value={kcal} onChangeText={setKcal} keyboardType="numeric" placeholder="645" placeholderTextColor="rgba(255,255,255,0.3)" className="rounded-[12px] bg-ink-700 px-[13px] py-3 text-[14px] text-white" /></Field></View>
              <View className="flex-1"><Field label="Protein g" optional><TextInput value={pro} onChangeText={setPro} keyboardType="numeric" placeholder="48" placeholderTextColor="rgba(255,255,255,0.3)" className="rounded-[12px] bg-ink-700 px-[13px] py-3 text-[14px] text-white" /></Field></View>
            </View>
          </ScrollView>
          <View className="flex-row gap-2.5 border-t border-white/[0.06] px-[18px] pb-5 pt-3">
            <Pressable onPress={onClose} className="flex-1 items-center rounded-[13px] bg-white/[0.06] py-3.5 active:opacity-80"><Text className="text-[14px] font-bold text-white">Cancel</Text></Pressable>
            <Pressable onPress={save} disabled={!canSave} className="flex-[2] items-center rounded-[13px] py-3.5 active:opacity-90" style={{ backgroundColor: canSave ? '#7ED957' : alpha('#7ED957', 0.35) }}><Text className="text-[14px] font-extrabold text-black">{editing ? 'Save changes' : 'Save meal'}</Text></Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </AppModal>
  )
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: ReactNode }) {
  return (
    <View>
      <Text className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-white/40">{label}{optional && <Text className="font-semibold normal-case tracking-normal text-white/35"> · optional</Text>}</Text>
      {children}
    </View>
  )
}
