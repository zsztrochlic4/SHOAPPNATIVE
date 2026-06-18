# StrengthHub Online — React Native

A **React Native (Expo)** port of [StrengthHub Online](https://github.com/Zaggy887/SHO-app),
the mobile-first fitness app for university students. Train, eat, track progress
and stay accountable with friends — now as a native iOS/Android app.

This is a faithful conversion of the original **React + Vite + Tailwind PWA**.
All of the app's behaviour is preserved: it's driven by a persistent store
seeded with a realistic **40-day demo history** (Alex, 21, lean-recomp, PPL
split), so stats are computed live and logging anything updates the whole app.

## Stack

| Concern | Web original | This app |
|---|---|---|
| Framework | React 18 + Vite | React 18 / Expo SDK 56 + React Native |
| Styling | Tailwind CSS | **NativeWind v4** (same Tailwind classes) |
| Theming | CSS variables (`--fg`, `--ink-*`) | NativeWind `vars()` — same light/dark scale |
| Icons | `lucide-react` | `lucide-react-native` |
| Charts | Recharts | `react-native-svg` (hand-built) |
| Persistence | `localStorage` | `@react-native-async-storage/async-storage` |
| Image upload | `<input type=file>` / `FileReader` | `expo-image-picker` |
| Gradients | `bg-gradient-to-*` | `expo-linear-gradient` |

## Getting started

```bash
npm install
npm start          # Expo dev server — scan the QR code with Expo Go
npm run ios        # open in the iOS simulator (macOS)
npm run android    # open in an Android emulator
npm run typecheck  # tsc --noEmit
```

> Native dependency versions are pinned to **Expo SDK 56**. Run the project with
> a matching Expo Go client (or `npx expo run:ios` / `run:android` for a dev build).

## Project structure

```
App.tsx                     # re-exports src/App
src/
├── App.tsx                 # providers, theme root, hydration gate, tab routing, overlays
├── nav.tsx                 # overlay/tab navigation context (unchanged from web)
├── theme.tsx               # light/dark CSS-variable themes via NativeWind vars() + raw palette
├── lib/                    # rng, date, unit-format, coach helpers (ported as-is)
├── store/                  # types, seed, reducer+AsyncStorage, selectors, training, coach
├── data/                   # exercises, foods, program, quick workouts (ported as-is)
├── components/             # Card, ProgressRing, Sheet, BottomNav, Hero, Avatar, Icon, Toast…
├── overlays/               # all secondary sheets (settings, logging, recap, coach, …)
└── screens/                # Dashboard, Workout, Nutrition, Progress, Community,
                            # Onboarding, ActiveWorkout
```

## Notes on the port

- The **business logic is untouched** — `lib/`, `data/`, and most of `store/`
  came over verbatim. Only the persistence layer (`store/store.tsx`) was
  rewritten to hydrate asynchronously from AsyncStorage.
- The UI layer was rewritten from web DOM (`div`/`span`/`button`) to RN
  primitives (`View`/`Text`/`Pressable`), keeping the original Tailwind classes
  via NativeWind so the visual design and light/dark theming carry over.
- CSS keyframe animations and the service-worker/PWA install layer were dropped;
  the rest-timer ring and progress rings are drawn with `react-native-svg`.
- Browser-only simulations (barcode scan, push permission) degrade gracefully on
  native and are ready to wire to real services.
