# Web → React Native conversion guide

We are porting the **StrengthHub Online** web app (Vite + React + Tailwind, in
`/tmp/SHO-app/src`) to **React Native** (Expo + NativeWind v4) in this repo
(`/home/user/sho-app-native/src`). The shared logic (`lib/`, `data/`, `store/`,
`nav.tsx`) is already ported and unchanged — **do not touch it**. Only the
presentation layer changes.

**Reference implementation:** `src/screens/Dashboard.tsx` is a fully converted
screen. Match its style exactly. Read it first.

## Golden rules
1. **Keep all business logic, selectors, store dispatches, copy/text, numbers,
   and conditionals identical to the source.** Only JSX/markup/styling changes.
2. **NativeWind**: keep using Tailwind `className` strings on RN components
   (`View`, `Text`, `Pressable`, `ScrollView`, `TextInput`, `Image`). The
   theme color classes (`bg-ink-800`, `text-white`, `text-white/50`,
   `border-white/5`, `bg-brand-400`, `text-accent-purple`, etc.) all work and
   auto-flip with light/dark — keep them.

## Element mapping
| web | React Native |
|---|---|
| `<div>` | `<View>` |
| `<button onClick>` | `<Pressable onPress>` |
| `<span> <p> <h1..h3> <sup>` | `<Text>` |
| `<img src=.. />` | `<Image source={{ uri }} resizeMode="cover" />` |
| `<input>` | `<TextInput>` |
| `<textarea>` | `<TextInput multiline>` |
| `<video>` | use existing `TechniqueClip` component |

## Critical RN differences
- **Every string must be inside `<Text>`.** No bare text in a `View`.
- **Flex direction defaults to `column` in RN** (web defaults to `row`). The
  web class `flex items-center` means a ROW. So convert `flex` → `flex-row`
  wherever the web layout was horizontal. Vertical stacks need no `flex` class.
- `space-y-N` / `space-x-N` → put `gap-N` on the flex parent instead.
- `grid grid-cols-3 gap-3` → `<View className="flex-row gap-3">` with each child
  `className="flex-1 ..."`.
- `divide-y divide-white/5` → no equivalent; add `border-t border-white/5` to
  every child except the first (pass a `first` prop like Dashboard's `TaskRow`).
- `truncate` → `numberOfLines={1}` on the `<Text>`.
- `place-items-center` / `grid place-items-center` → `items-center justify-center`.
- Drop `hover:*`, `active:scale-*`, `transition*`, `animate-*`, `backdrop-blur`,
  `shadow-*`, `ring-*` (use a `border` if a ring mattered). For press feedback
  use `active:opacity-80` (or `active:opacity-90`).
- `e.stopPropagation()` → remove; nested `Pressable` already captures the touch.
- Remove `aria-*`/`role`/`htmlFor`; use `accessibilityLabel` only if useful.

## Icons
Import from **`lucide-react-native`** (same names as `lucide-react`). Pass
`size` and `color` props (NOT className for color). For a theme-aware color use
`useColors().fg` or an explicit `rgba(...)`. Example:
`<ChevronRight size={18} color="rgba(148,148,148,0.6)" />`.

## Shared building blocks (already built — import & reuse)
- `import { Card, ProgressRing, ProgressBar, SectionHeader, SegmentedTabs, Chip, ScreenHeader } from '../components/ui'`
  - `Card` = the `.card` surface (rounded-2xl bg-ink-800 border). Use it instead
    of `<div className="card">` → `<Card className="p-4">`.
  - `ProgressRing` props: `value` (0–100), `size`, `stroke`, `color`, children centered.
  - `Chip` renders its own `<Text>`; just pass a string child.
- `import { Sheet, EmptyState } from '../components/Sheet'` — bottom-sheet modal.
  Props: `{ open, onClose, title?, children, full? }`. It already provides a
  scrollable, padded body — **do not wrap content in another ScrollView**.
- `import { Icon } from '../components/Icon'` — name-based icon, pass `color`.
- `import { Avatar, AvatarStack } from '../components/Avatar'`
- `import { LogoMark, Wordmark } from '../components/Logo'`
- `import { Hero } from '../components/Hero'` — image banner w/ ink gradient
  (replaces `bg-gradient-to-r` hero cards). Props `{ image?, rounded?, children }`.
- `import { useToast } from '../components/Toast'` → `const toast = useToast(); toast('Saved')`.
- For any other gradient: `import { LinearGradient } from 'expo-linear-gradient'`.

## Hooks / data
- `const { state, dispatch } = useStore()` (from `../store/store`), or
  `const dispatch = useDispatch()`.
- `const nav = useNav()` → `nav.open(overlay, params?)`, `nav.close()`,
  `nav.goTab(tab)`.
- Theme: `import { brand, accent, useColors } from '../theme'`.
  `brand[400]='#7ED957'`; `accent.blue/purple/orange/yellow`;
  `useColors()` → `{ fg, ink900, ink800, track, grid, tick, ringTrack, ... }`.

## Screens vs overlays
- **Screens** (`screens/*.tsx`) render inside the app's parent `ScrollView`.
  Return a root `<View className="px-5 pt-2">` (like Dashboard). **Never** wrap
  the screen root in a vertical `ScrollView`. Horizontal lists use
  `<ScrollView horizontal showsHorizontalScrollIndicator={false}>`.
- **Overlays** (`overlays/*.tsx`) are `Sheet`-based. Signature:
  `function XSheet({ open, onClose, params }: Props)`. Keep the same export
  names. `overlays/index.tsx` must keep `export * from './extra'` at the top.

## TextInput pattern
```tsx
<TextInput
  value={text}
  onChangeText={setText}
  placeholder="Add a comment"
  placeholderTextColor="rgba(148,148,148,0.6)"
  keyboardType="numeric"   // or "decimal-pad" for weights; omit for text
  className="rounded-xl bg-ink-700 px-4 py-3 text-white"
/>
```
Numbers: parse with `Number(text)` / `parseFloat`. Keep the source's validation.

## Image upload / camera (only in overlays: photos, create-post)
Use `expo-image-picker`:
```tsx
import * as ImagePicker from 'expo-image-picker'
const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.6 })
if (!res.canceled) dispatch({ type: 'ADD_PHOTO', dataUrl: res.assets[0].uri })
```
Stored values are URIs; render with `<Image source={{ uri }} />`.

## Charts (only `Progress.tsx`)
There is **no Recharts**. Build charts with `react-native-svg`
(`Svg, Path, Line, Polyline, Circle, Rect, Text as SvgText, G`). Keep it clean
and readable; use `useColors().grid` / `.tick` for axes. A simple line/area for
the weight trend, bars for strength %, and `ProgressRing`s for habit
consistency are sufficient — preserve the same data and toggles (4/12-week).

## When done
The file must pass `npx tsc --noEmit` with no new errors. Prefer obvious,
faithful conversions over clever ones.
