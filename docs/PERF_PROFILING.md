# Performance: measure a release build before the big refactor

**Status today:** the safe, behaviour-preserving perf wins are done (memoized the hottest Dashboard
and community selectors). The larger changes the audit identified — migrating heavy screens from
`useStore()` to narrow `useStoreSelector` subscriptions, moving the `IndexGauge` animation to
reanimated, lazy-loading the ~580 KB of bundled data (`exercises.ts`, `substitutions.ts`,
`recipes.generated.ts`), and adopting `expo-image` — are deliberately **measurement-gated**: take a
release-build baseline first, then let the traces decide, rather than optimizing on a hunch (dev-mode
timings and source-file size both mislead). This needs a real device + a release build, so it's owner
work, not a code-only change.

## 1. Set targets (define "fast" before measuring)
Pick device tiers (e.g. a low-end Android and a mid iPhone) and budgets: cold start, time-to-interactive,
p95 tap response, JS/UI frame rate, memory, and render time of the Dashboard/Workout screens.

## 2. Baseline the JS bundle with Expo Atlas
```bash
# generates .expo/atlas.jsonl during an export you can open in the Atlas UI
EXPO_ATLAS=1 npx expo export --platform ios   # (and android)
npx expo-atlas .expo/atlas.jsonl
```
This shows which modules dominate the bundle — confirm the three big data files before splitting them,
and re-measure after, so a change is accepted only if Atlas shows the win.

## 3. Profile the running app (release build, Hermes)
- Make a **release** dev-client/build (dev mode has extra work that hides the real picture).
- Use the Hermes sampling profiler: open the dev menu → *Enable Sampling Profiler*, exercise the app,
  disable it, then load the profile into Chrome DevTools → Performance. See the RN "Profiling with
  Hermes" guide.
- For production/release traces on-device, `react-native-release-profiler` records Hermes traces you
  can open the same way.
- Use the React DevTools **Profiler** to see which components re-render on a trivial dispatch (this is
  how you confirm the `useStore()` → `useStoreSelector` migration actually reduces re-renders).

## 4. Then do the refactor, one screen at a time, re-measuring
- Convert `Dashboard`, `Nutrition`, `Workout`, `ActiveWorkout`, `Coach`, and `src/community/*` from
  `useStore()` (full-state) to `useStoreSelector(narrowSelector)` — the infra already exists in
  `src/store/store.tsx`. Verify with the Profiler that hidden tabs stop re-rendering on unrelated updates.
- Replace `IndexGauge`'s per-frame `setState` with reanimated `useAnimatedProps` (keep the web path).
- Lazy-`require()` the three large data modules off the boot path.
- Adopt `expo-image` for remote recipe/exercise thumbnails.
Accept each change only when a trace shows an improvement on the target devices.

## Links
- Expo — Analyzing bundles with Atlas: https://docs.expo.dev/guides/analyzing-bundles/
- Expo Atlas (repo): https://github.com/expo/atlas
- React Native — Performance overview: https://reactnative.dev/docs/performance
- React Native — Profiling with Hermes: https://reactnative.dev/docs/profile-hermes
- react-native-release-profiler: https://github.com/margelo/react-native-release-profiler
- React — Profiler API: https://react.dev/reference/react/Profiler
