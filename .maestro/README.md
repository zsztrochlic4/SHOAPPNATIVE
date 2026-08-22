# Native E2E + accessibility (Maestro) — Step 7 / R5-013

**Status: CI-wired for Android emulator; physical iOS/Android accessibility review remains required.** These are native
(iOS/Android) device-lab work. They have never been executed — selectors were derived from the
codebase and the Playwright web e2e, so expect to refine a few labels on first run (each flow marks
those spots with `TODO (on device)`). The existing `e2e/*.spec.ts` are **web** (Playwright); these
`.maestro` flows are the **native** counterpart the audit's R5-013 asks for.

We chose **Maestro** over Detox: YAML flows, no native test-runner build config, runs against a
plain EAS dev/release build, and it's the lightest path to a device lab for an Expo app.

## Prerequisites

1. **Maestro CLI** — `curl -fsSL "https://get.maestro.mobile.dev" | bash` (macOS/Linux; Windows via WSL).
2. **A build on a device/emulator:**
   - Bundle id `com.zaggy887.strengthhub` (same for iOS + Android — see `app.json`).
   - **Demo-mode build recommended for the smoke/nav/lifecycle flows:** build with
     `EXPO_PUBLIC_DEMO_MODE=1` so the seeded, onboarded, auto-entitled user lands straight on the
     tabs (exactly like the web e2e). Without it, replace `subflows/boot.yaml` with a real sign-in
     subflow (see **Auth** below).
   - Not Expo Go — an EAS **dev build** (`eas build --profile development`) or a release build.

## Run

```bash
# whole suite
maestro test .maestro

# a single flow
maestro test .maestro/flows/01_smoke_boot_tabs.yaml

# only smoke-tagged flows
maestro test .maestro --include-tags smoke

# override the app id without editing files
maestro test .maestro -e APP_ID=com.zaggy887.strengthhub   # (then use ${APP_ID} in headers)
```

## Coverage (this pass) vs. the R5-013 matrix

| Journey | Flow | Notes |
|---|---|---|
| Happy boot | `01_smoke_boot_tabs` | all 5 tabs present |
| Navigation | `02_tab_navigation` | per-tab unique control visible |
| Permission | `03_nutrition_meal_permission` | camera/photos grant path; **deny path = TODO** |
| Workout | `04_workout_flow` | start today's session; rest-day guarded |
| Community | `05_community_groups` | inner segments + settings |
| Background / restart | `06_background_restart` | resume + cold restart persistence |
| Accessibility labels | `07_accessibility_labels` | controls reachable by accessibilityLabel |
| First-run Welcome tour | `08_welcome_tour` | four cards, name/goal personalisation, tap + swipe nav, dismissal + shows-once persistence |

> **Note:** the first-run Welcome tour (`screens/WelcomeTour`) now floats over the dashboard on a
> clean-state launch, so `subflows/boot.yaml` dismisses it (taps **Skip tour** when present) before
> handing control to a flow. `08_welcome_tour` launches directly instead, so it can drive the tour.

**Still TODO to complete the 18-journey matrix** (need a device + fixtures): empty / loading / error
/ offline (airplane-mode toggle) / large-dataset / write-conflict states, plus the full a11y passes
Maestro can't do directly — **VoiceOver/TalkBack** swipe order, **200% dynamic type**, **contrast**,
and **reduced-motion** (use Xcode Accessibility Inspector / Android Accessibility Scanner + an
XCUITest/Espresso audit for those).

### Welcome tour — manual on-device checklist

`08_welcome_tour` proves the structure (appears, personalises, tap + swipe navigation, dismissal,
shows-once). Maestro **cannot** verify these — check them by hand on a device once:

- **Haptics** — a light `tick` on Next/swipe-commit and a firmer `thud` on finish/skip.
- **Radial overlay** — each card's SVG dark radial overlay renders (text stays legible toward the
  bottom-right) and the per-step base colour cross-fades on step change.
- **Scrim** — the dashboard is dimmed behind the card in **both** the dark and the light theme.
- **Reduced motion** — with the OS "Reduce Motion" on, the entrance/step/dot animations collapse to
  their final state instantly (no card rise, no cross-fade), and navigation still works.
- **Entrance from checkout** — after a real Stripe checkout the card rises over an already-painted
  dashboard (no flash, no extra screen).

## Auth (non-demo builds)

If you test a real (non-demo) build, create `subflows/signin.yaml` that enters test credentials and
waits for `Dashboard`, and swap the `runFlow: ../subflows/boot.yaml` line in each flow for it. Never
commit real credentials — pass them via `-e EMAIL=... -e PASSWORD=...` and reference `${EMAIL}`.

## CI

`.github/workflows/native-e2e.yml` builds a demo-mode Android debug APK, boots an emulator and runs
the smoke-tagged Maestro suite on every pull request to `main`. Keep this job required in branch
protection. Physical-device VoiceOver/TalkBack, large text and reduced-motion review remains a named
release sign-off rather than something Maestro can prove.
