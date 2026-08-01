import { useMemo } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import Svg, { Path, Ellipse, Rect, Line, G, Defs, RadialGradient, Stop, Circle } from 'react-native-svg'
import { LinearGradient } from 'expo-linear-gradient'
import { Play } from 'lucide-react-native'
import { useFonts, Poppins_600SemiBold } from '@expo-google-fonts/poppins'
import { useColors, type Palette } from '../theme'
import { exerciseView } from '../store/programSession'
import { fromKey, todayKey } from '../lib/date'
import type { WorkoutSession } from '../store/types'

/**
 * Today's-plan hero as an anatomical muscle map. Replaces the photo background with
 * two SVG figures (front + back) whose worked muscle groups light up: bright brand
 * green = primary movers, deep green = secondary, everything else recedes into the
 * card. Male / female geometry is chosen from the profile (other → female). Design
 * handoff: "Today's Workout Card — muscle map" (confirmed 2a/2b).
 */

const BRAND_700 = '#377322' // secondary movers (deep green) — not in the JS palette

/** hex → rgba string, so the theme's --fg / --ink-900 can be tinted like the design. */
function withA(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

/* ---- Muscle derivation: session exercises → figure group ids -------------- */

// App muscle-group label (catalogue + 113-exercise DB) → anatomy figure group ids.
const MUSCLE_TO_IDS: Record<string, string[]> = {
  chest: ['chest'],
  back: ['lats', 'traps'],
  lats: ['lats'],
  shoulders: ['shoulders'],
  deltoids: ['shoulders'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  forearms: ['forearms'],
  legs: ['quads'],
  quads: ['quads'],
  hamstrings: ['hamstrings', 'glutes'],
  'hamstrings & glutes': ['hamstrings', 'glutes'],
  glutes: ['glutes'],
  calves: ['calves'],
  core: ['abs', 'obliques'],
  abs: ['abs', 'obliques'],
  traps: ['traps'],
  'lower back': ['lowerback'],
  'full body & conditioning': ['chest', 'quads', 'shoulders', 'abs'],
}

// Synergists lightly worked alongside each primary group (for the secondary tint).
const SYNERGISTS: Record<string, string[]> = {
  chest: ['shoulders', 'triceps'],
  shoulders: ['traps', 'triceps'],
  triceps: ['shoulders'],
  biceps: ['forearms'],
  lats: ['biceps', 'traps'],
  traps: ['shoulders'],
  quads: ['glutes', 'calves'],
  hamstrings: ['glutes', 'calves'],
  glutes: ['hamstrings', 'lowerback'],
  lowerback: ['glutes'],
}

function deriveGroups(session: WorkoutSession): { active: Set<string>; secondary: Set<string> } {
  const active = new Set<string>()
  for (const ex of session.exercises) {
    const m = (exerciseView(ex.defId)?.muscle ?? '').toLowerCase()
    for (const id of MUSCLE_TO_IDS[m] ?? []) active.add(id)
  }
  const secondary = new Set<string>()
  active.forEach((a) => (SYNERGISTS[a] ?? []).forEach((s) => secondary.add(s)))
  // Core braces most upper-body lifts.
  if ([...active].some((a) => ['chest', 'shoulders', 'triceps', 'lats', 'biceps'].includes(a))) secondary.add('abs')
  active.forEach((a) => secondary.delete(a))
  return { active, secondary }
}

/* ---- Figures -------------------------------------------------------------- */

type FigProps = { active: Set<string>; secondary: Set<string>; c: Palette }

function useFill(active: Set<string>, secondary: Set<string>, c: Palette) {
  const base = withA(c.fg, 0.155)
  return (id: string) => (active.has(id) ? c.brand400 : secondary.has(id) ? BRAND_700 : base)
}

function FrontMale({ active, secondary, c }: FigProps) {
  const f = useFill(active, secondary, c)
  const sil = withA(c.fg, 0.105)
  return (
    <Svg viewBox="0 0 120 300" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <G fill={sil} stroke={sil} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round">
        <Ellipse cx={60} cy={24} rx={11.5} ry={14.5} />
        <Path d="M60,38 L60,58" fill="none" strokeWidth={13} />
        <Path d="M38,62 L82,62 L75,106 L78,132 L42,132 L45,106 Z" />
        <Path d="M36,66 L29,108" fill="none" strokeWidth={17} />
        <Path d="M29,108 L23,150" fill="none" strokeWidth={13} />
        <Path d="M84,66 L91,108" fill="none" strokeWidth={17} />
        <Path d="M91,108 L97,150" fill="none" strokeWidth={13} />
        <Ellipse cx={22} cy={160} rx={5.5} ry={9} />
        <Ellipse cx={98} cy={160} rx={5.5} ry={9} />
        <Path d="M50,124 L49,196" fill="none" strokeWidth={25} />
        <Path d="M49,196 L48,258" fill="none" strokeWidth={17} />
        <Path d="M70,124 L71,196" fill="none" strokeWidth={25} />
        <Path d="M71,196 L72,258" fill="none" strokeWidth={17} />
        <Path d="M42,266 L54,266" fill="none" strokeWidth={11} />
        <Path d="M66,266 L78,266" fill="none" strokeWidth={11} />
      </G>
      <G stroke={withA(c.ink900, 0.5)} strokeWidth={0.9} strokeLinejoin="round">
        <Path d="M42,57 C48,51 54,47 60,47 C66,47 72,51 78,57 L75,64 L45,64 Z" fill={f('traps')} />
        <Ellipse cx={36} cy={68} rx={10.5} ry={10.5} fill={f('shoulders')} />
        <Ellipse cx={84} cy={68} rx={10.5} ry={10.5} fill={f('shoulders')} />
        <Path d="M47,59 L58.5,62 L58.5,81 L49,81 C42,81 39,75 39,69 C39,63 42,60 47,59 Z" fill={f('chest')} />
        <Path d="M73,59 L61.5,62 L61.5,81 L71,81 C78,81 81,75 81,69 C81,63 78,60 73,59 Z" fill={f('chest')} />
        <Ellipse cx={31} cy={90} rx={7.5} ry={15} fill={f('biceps')} />
        <Ellipse cx={89} cy={90} rx={7.5} ry={15} fill={f('biceps')} />
        <Ellipse cx={25} cy={128} rx={6} ry={17} fill={f('forearms')} />
        <Ellipse cx={95} cy={128} rx={6} ry={17} fill={f('forearms')} />
        <Path d="M48,85 C44,90 43,100 44,113 L49,119 L49,85 Z" fill={f('obliques')} />
        <Path d="M72,85 C76,90 77,100 76,113 L71,119 L71,85 Z" fill={f('obliques')} />
        <Rect x={50} y={83} width={20} height={36} rx={7} fill={f('abs')} />
        <Ellipse cx={49} cy={162} rx={11} ry={34} fill={f('quads')} />
        <Ellipse cx={71} cy={162} rx={11} ry={34} fill={f('quads')} />
        <Ellipse cx={48} cy={234} rx={7.5} ry={24} fill={f('calves')} />
        <Ellipse cx={72} cy={234} rx={7.5} ry={24} fill={f('calves')} />
      </G>
      <G stroke={withA(c.ink900, 0.45)} strokeWidth={1} fill="none">
        <Line x1={60} y1={85} x2={60} y2={117} />
        <Line x1={52} y1={94} x2={68} y2={94} />
        <Line x1={52} y1={103} x2={68} y2={103} />
        <Line x1={52} y1={112} x2={68} y2={112} />
      </G>
    </Svg>
  )
}

function BackMale({ active, secondary, c }: FigProps) {
  const f = useFill(active, secondary, c)
  const sil = withA(c.fg, 0.105)
  return (
    <Svg viewBox="0 0 120 300" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <G fill={sil} stroke={sil} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round">
        <Ellipse cx={60} cy={24} rx={11.5} ry={14.5} />
        <Path d="M60,38 L60,58" fill="none" strokeWidth={13} />
        <Path d="M38,62 L82,62 L75,106 L78,132 L42,132 L45,106 Z" />
        <Path d="M36,66 L29,108" fill="none" strokeWidth={17} />
        <Path d="M29,108 L23,150" fill="none" strokeWidth={13} />
        <Path d="M84,66 L91,108" fill="none" strokeWidth={17} />
        <Path d="M91,108 L97,150" fill="none" strokeWidth={13} />
        <Ellipse cx={22} cy={160} rx={5.5} ry={9} />
        <Ellipse cx={98} cy={160} rx={5.5} ry={9} />
        <Path d="M50,124 L49,196" fill="none" strokeWidth={25} />
        <Path d="M49,196 L48,258" fill="none" strokeWidth={17} />
        <Path d="M70,124 L71,196" fill="none" strokeWidth={25} />
        <Path d="M71,196 L72,258" fill="none" strokeWidth={17} />
        <Path d="M42,266 L54,266" fill="none" strokeWidth={11} />
        <Path d="M66,266 L78,266" fill="none" strokeWidth={11} />
      </G>
      <G stroke={withA(c.ink900, 0.5)} strokeWidth={0.9} strokeLinejoin="round">
        <Path d="M60,50 L43,58 L49,78 L60,70 L71,78 L77,58 Z" fill={f('traps')} />
        <Ellipse cx={36} cy={68} rx={10.5} ry={10.5} fill={f('shoulders')} />
        <Ellipse cx={84} cy={68} rx={10.5} ry={10.5} fill={f('shoulders')} />
        <Path d="M49,69 L58,88 L58,112 L45,100 C42,90 44,77 49,69 Z" fill={f('lats')} />
        <Path d="M71,69 L62,88 L62,112 L75,100 C78,90 76,77 71,69 Z" fill={f('lats')} />
        <Ellipse cx={31} cy={90} rx={7.5} ry={15} fill={f('triceps')} />
        <Ellipse cx={89} cy={90} rx={7.5} ry={15} fill={f('triceps')} />
        <Ellipse cx={25} cy={128} rx={6} ry={17} fill={f('forearms')} />
        <Ellipse cx={95} cy={128} rx={6} ry={17} fill={f('forearms')} />
        <Path d="M52,104 L68,104 L70,122 L50,122 Z" fill={f('lowerback')} />
        <Ellipse cx={51} cy={133} rx={11} ry={10} fill={f('glutes')} />
        <Ellipse cx={69} cy={133} rx={11} ry={10} fill={f('glutes')} />
        <Ellipse cx={49} cy={168} rx={11} ry={30} fill={f('hamstrings')} />
        <Ellipse cx={71} cy={168} rx={11} ry={30} fill={f('hamstrings')} />
        <Ellipse cx={48} cy={234} rx={7.5} ry={24} fill={f('calves')} />
        <Ellipse cx={72} cy={234} rx={7.5} ry={24} fill={f('calves')} />
      </G>
      <G stroke={withA(c.ink900, 0.45)} strokeWidth={1} fill="none">
        <Line x1={60} y1={72} x2={60} y2={120} />
      </G>
    </Svg>
  )
}

function FrontFemale({ active, secondary, c }: FigProps) {
  const f = useFill(active, secondary, c)
  const sil = withA(c.fg, 0.105)
  return (
    <Svg viewBox="0 0 120 300" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <G transform="translate(60,0) scale(1.07,1) translate(-60,0)">
        <G fill={sil} stroke={sil} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round">
          <Ellipse cx={60} cy={24} rx={10.5} ry={13.5} />
          <Path d="M60,38 L60,58" fill="none" strokeWidth={11} />
          <Path d="M42,62 L78,62 L69,104 L83,134 L37,134 L51,104 Z" />
          <Path d="M38,66 L32,108" fill="none" strokeWidth={15} />
          <Path d="M32,108 L27,150" fill="none" strokeWidth={11.5} />
          <Path d="M82,66 L88,108" fill="none" strokeWidth={15} />
          <Path d="M88,108 L93,150" fill="none" strokeWidth={11.5} />
          <Ellipse cx={26} cy={159} rx={5} ry={8.5} />
          <Ellipse cx={94} cy={159} rx={5} ry={8.5} />
          <Path d="M50,128 L48,196" fill="none" strokeWidth={24} />
          <Path d="M48,196 L47,258" fill="none" strokeWidth={16} />
          <Path d="M70,128 L72,196" fill="none" strokeWidth={24} />
          <Path d="M72,196 L73,258" fill="none" strokeWidth={16} />
          <Path d="M41,266 L53,266" fill="none" strokeWidth={11} />
          <Path d="M67,266 L79,266" fill="none" strokeWidth={11} />
        </G>
        <G stroke={withA(c.ink900, 0.5)} strokeWidth={0.9} strokeLinejoin="round">
          <Path d="M45,58 C50,52 55,48 60,48 C65,48 70,52 75,58 L72,64 L48,64 Z" fill={f('traps')} />
          <Ellipse cx={37} cy={68} rx={10} ry={10} fill={f('shoulders')} />
          <Ellipse cx={83} cy={68} rx={10} ry={10} fill={f('shoulders')} />
          <Path d="M48,60 L58.5,63 L58.5,80 L50,80 C44,80 41,75 41,70 C41,65 44,61 48,60 Z" fill={f('chest')} />
          <Path d="M72,60 L61.5,63 L61.5,80 L70,80 C76,80 79,75 79,70 C79,65 76,61 72,60 Z" fill={f('chest')} />
          <Ellipse cx={32} cy={90} rx={6.5} ry={14} fill={f('biceps')} />
          <Ellipse cx={88} cy={90} rx={6.5} ry={14} fill={f('biceps')} />
          <Ellipse cx={27} cy={127} rx={5.5} ry={16} fill={f('forearms')} />
          <Ellipse cx={93} cy={127} rx={5.5} ry={16} fill={f('forearms')} />
          <Path d="M49,85 C46,90 45,100 46,112 L50,118 L50,85 Z" fill={f('obliques')} />
          <Path d="M71,85 C74,90 75,100 74,112 L70,118 L70,85 Z" fill={f('obliques')} />
          <Rect x={51} y={83} width={18} height={34} rx={7} fill={f('abs')} />
          <Ellipse cx={48} cy={163} rx={11} ry={33} fill={f('quads')} />
          <Ellipse cx={72} cy={163} rx={11} ry={33} fill={f('quads')} />
          <Ellipse cx={47} cy={234} rx={7} ry={23} fill={f('calves')} />
          <Ellipse cx={73} cy={234} rx={7} ry={23} fill={f('calves')} />
        </G>
        <G stroke={withA(c.ink900, 0.45)} strokeWidth={1} fill="none">
          <Line x1={60} y1={85} x2={60} y2={115} />
          <Line x1={53} y1={94} x2={67} y2={94} />
          <Line x1={53} y1={103} x2={67} y2={103} />
          <Line x1={53} y1={111} x2={67} y2={111} />
        </G>
      </G>
    </Svg>
  )
}

function BackFemale({ active, secondary, c }: FigProps) {
  const f = useFill(active, secondary, c)
  const sil = withA(c.fg, 0.105)
  return (
    <Svg viewBox="0 0 120 300" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <G transform="translate(60,0) scale(1.07,1) translate(-60,0)">
        <G fill={sil} stroke={sil} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round">
          <Ellipse cx={60} cy={24} rx={10.5} ry={13.5} />
          <Path d="M60,38 L60,58" fill="none" strokeWidth={11} />
          <Path d="M42,62 L78,62 L69,104 L83,134 L37,134 L51,104 Z" />
          <Path d="M38,66 L32,108" fill="none" strokeWidth={15} />
          <Path d="M32,108 L27,150" fill="none" strokeWidth={11.5} />
          <Path d="M82,66 L88,108" fill="none" strokeWidth={15} />
          <Path d="M88,108 L93,150" fill="none" strokeWidth={11.5} />
          <Ellipse cx={26} cy={159} rx={5} ry={8.5} />
          <Ellipse cx={94} cy={159} rx={5} ry={8.5} />
          <Path d="M50,128 L48,196" fill="none" strokeWidth={24} />
          <Path d="M48,196 L47,258" fill="none" strokeWidth={16} />
          <Path d="M70,128 L72,196" fill="none" strokeWidth={24} />
          <Path d="M72,196 L73,258" fill="none" strokeWidth={16} />
          <Path d="M41,266 L53,266" fill="none" strokeWidth={11} />
          <Path d="M67,266 L79,266" fill="none" strokeWidth={11} />
        </G>
        <G stroke={withA(c.ink900, 0.5)} strokeWidth={0.9} strokeLinejoin="round">
          <Path d="M60,52 L46,59 L51,78 L60,71 L69,78 L74,59 Z" fill={f('traps')} />
          <Ellipse cx={37} cy={68} rx={10} ry={10} fill={f('shoulders')} />
          <Ellipse cx={83} cy={68} rx={10} ry={10} fill={f('shoulders')} />
          <Path d="M50,70 L58,88 L58,110 L47,99 C44,90 46,77 50,70 Z" fill={f('lats')} />
          <Path d="M70,70 L62,88 L62,110 L73,99 C76,90 74,77 70,70 Z" fill={f('lats')} />
          <Ellipse cx={32} cy={90} rx={6.5} ry={14} fill={f('triceps')} />
          <Ellipse cx={88} cy={90} rx={6.5} ry={14} fill={f('triceps')} />
          <Ellipse cx={27} cy={127} rx={5.5} ry={16} fill={f('forearms')} />
          <Ellipse cx={93} cy={127} rx={5.5} ry={16} fill={f('forearms')} />
          <Path d="M53,103 L67,103 L69,121 L51,121 Z" fill={f('lowerback')} />
          <Ellipse cx={50} cy={135} rx={11.5} ry={10.5} fill={f('glutes')} />
          <Ellipse cx={70} cy={135} rx={11.5} ry={10.5} fill={f('glutes')} />
          <Ellipse cx={48} cy={169} rx={11} ry={29} fill={f('hamstrings')} />
          <Ellipse cx={72} cy={169} rx={11} ry={29} fill={f('hamstrings')} />
          <Ellipse cx={47} cy={234} rx={7} ry={23} fill={f('calves')} />
          <Ellipse cx={73} cy={234} rx={7} ry={23} fill={f('calves')} />
        </G>
        <G stroke={withA(c.ink900, 0.45)} strokeWidth={1} fill="none">
          <Line x1={60} y1={72} x2={60} y2={119} />
        </G>
        {/* ponytail */}
        <G fill={withA(c.fg, 0.22)} stroke={withA(c.ink900, 0.5)} strokeWidth={0.9}>
          <Path d="M56.5,40 L63.5,40 L64,80 a4,4 0 0 1 -8,0 Z" />
        </G>
      </G>
    </Svg>
  )
}

/**
 * The front + back anatomy pair for a session, highlighted for the muscles it
 * trains and filling its parent. Reused by the full today card and the compact
 * past-day card so both share one source of truth for the figures.
 */
export function MuscleFigures({ session, sex, c }: { session?: WorkoutSession; sex: 'male' | 'female' | 'other'; c: Palette }) {
  // No session (a rest day) → render the body with nothing highlighted.
  const { active, secondary } = useMemo(
    () => (session ? deriveGroups(session) : { active: new Set<string>(), secondary: new Set<string>() }),
    [session],
  )
  const female = sex !== 'male'
  const Front = female ? FrontFemale : FrontMale
  const Back = female ? BackFemale : BackMale
  return (
    <View style={{ flexDirection: 'row', alignItems: 'stretch', width: '100%', height: '100%' }} pointerEvents="none">
      <View style={{ flex: 1, height: '100%' }}><Front active={active} secondary={secondary} c={c} /></View>
      <View style={{ flex: 1, height: '100%' }}><Back active={active} secondary={secondary} c={c} /></View>
    </View>
  )
}

/* ---- Card ----------------------------------------------------------------- */

const WEEKDAY = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']

export function MuscleMapCard({
  session,
  sex,
  ctaLabel,
  onPress,
}: {
  session: WorkoutSession
  sex: 'male' | 'female' | 'other'
  ctaLabel: string
  onPress: () => void
}) {
  const c = useColors()
  // Poppins for the CTA label only; falls back to the system font until it loads.
  const [fontsLoaded] = useFonts({ Poppins_600SemiBold })
  const { active, secondary } = useMemo(() => deriveGroups(session), [session])
  const female = sex !== 'male'
  const Front = female ? FrontFemale : FrontMale
  const Back = female ? BackFemale : BackMale
  // Completed reads as a status, not an action: deeper green, light text, no arrow.
  const completed = ctaLabel === 'Completed'

  const weekday = WEEKDAY[fromKey(todayKey).getDay()]
  const chips = (session.focus ?? '')
    .split('·')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4)

  return (
    <View
      style={{
        position: 'relative', height: 198, borderRadius: 20, overflow: 'hidden',
        backgroundColor: c.ink800, borderWidth: 1, borderColor: withA(c.fg, 0.05),
        shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4,
      }}
    >
      {/* 1 · green ambient glow */}
      <View style={{ position: 'absolute', right: 14, top: 8, width: 150, height: 150 }} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="mmGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={c.brand400} stopOpacity={0.13} />
              <Stop offset="0.7" stopColor={c.brand400} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx="50%" cy="50%" r="50%" fill="url(#mmGlow)" />
        </Svg>
      </View>

      {/* 2 · anatomy pair (front then back) */}
      <View style={{ position: 'absolute', right: 4, top: 6, width: 168, height: 172, flexDirection: 'row', alignItems: 'stretch' }} pointerEvents="none">
        <View style={{ width: 84, height: '100%' }}><Front active={active} secondary={secondary} c={c} /></View>
        <View style={{ width: 84, height: '100%' }}><Back active={active} secondary={secondary} c={c} /></View>
      </View>

      {/* 3 · legibility scrim */}
      <LinearGradient
        colors={[c.ink800, withA(c.ink800, 0.6), withA(c.ink800, 0)]}
        locations={[0.25, 0.47, 0.74]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* 4 · content */}
      <View style={{ position: 'relative', flex: 1, paddingVertical: 15, paddingHorizontal: 20, justifyContent: 'space-between' }}>
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: '700', color: withA(c.fg, 0.42) }}>Today · {weekday}</Text>
          <Text numberOfLines={1} style={{ fontSize: 27, fontWeight: '800', letterSpacing: -0.5, lineHeight: 36, paddingBottom: 2, color: c.fg }}>{session.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: withA(c.fg, 0.75) }}>{session.exercises.length} exercises</Text>
            <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: withA(c.fg, 0.3) }} />
            <Text style={{ fontSize: 15, fontWeight: '800', color: c.fg }}>{session.durationMin} min</Text>
          </View>
          {chips.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 1 }}>
              {chips.map((m) => (
                <View key={m} style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: withA(c.brand400, 0.15) }}>
                  <Text style={{ fontSize: 11, fontWeight: '500', color: c.brand300 }}>{m}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <Pressable onPress={onPress} className="btn-primary self-start active:opacity-90" style={{ paddingVertical: 7, paddingHorizontal: 16, backgroundColor: completed ? BRAND_700 : c.brand400 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', fontFamily: fontsLoaded ? 'Poppins_600SemiBold' : undefined, color: completed ? 'rgba(255,255,255,0.9)' : '#000' }}>{ctaLabel}</Text>
          {!completed && <Play size={14} color="#000" fill="#000" style={{ marginLeft: 8 }} />}
        </Pressable>
      </View>
    </View>
  )
}
