# Device & accessibility E2E test plan (audit — "Missing test categories")

The web E2E suite (`npm run test:e2e`) runs a single Chromium worker in demo mode
and does **not** exercise Firebase, native APIs or real data. These are the manual /
device passes the audit flags as missing-but-high-severity. Run on an EAS dev build
(not Expo Go) so native modules and real Firebase are exercised.

## Device matrix

| Axis | Cover at least |
|---|---|
| iOS | 1 small (SE-class), 1 current, 1 Pro Max; latest + n-1 iOS |
| Android | 1 low-RAM/older, 1 current flagship; latest + n-1 Android |
| Orientation | portrait + landscape on phone and tablet/iPad |
| Text size | default, and **largest** OS Dynamic Type / font scale |
| Theme | dark, light, and **Auto (follow-system)** flipping live |
| Reduce Motion | OS on/off **and** the in-app Accessibility override (system/reduced/full) |

## Critical journeys (run on each primary device)

1. **Cold start & migration** — first launch, force-quit relaunch, upgrade over an
   existing account; branded loading, no blank/white flash, state restores.
2. **Sign-up / sign-in / provider** — real email + Google; wrong password; offline;
   sign-out then sign-in as a **different account on the same device** (verify NO
   data bleed — SA-001/005/020).
3. **Account deletion** (SA-002) — delete, confirm sign-out + can't sign back in;
   with network dropped mid-delete, confirm the truthful "in progress" copy and that
   a re-open finishes it.
4. **Start/log/complete a workout** (SA-003/004) — long exercise lists; background
   mid-set and return (runtime resumes); airplane-mode on finish (the "saved on this
   device, couldn't sync yet" state appears, then syncs on reconnect).
5. **Cross-device** (SA-009) — edit profile/settings on device A while device B is
   open; confirm neither device's edit is silently lost.
6. **History edit** (SA-016) — edit/complete an **old** session; confirm today's
   streak/flag and progression are unaffected.
7. **Nutrition** — scan (real camera + failure/timeout), manual entry, meal-plan pull.
8. **Progress all-time** (SA-007/008) — a large history loads without freezing;
   charts render; scrolling is smooth.
9. **Notifications** — permission grant/deny + OS-settings recovery; a scheduled
   reminder actually fires; token rotates after reinstall.
10. **Subscription** — purchase/restore/refund/grace-period via the store sandbox.

## Screen-reader & focus traversal (SA-012)

Run with **VoiceOver (iOS)** and **TalkBack (Android)**:
- Every interactive control announces a **name + role + state** (no "button" with no
  label; tabs announce selected).
- Opening a sheet/modal **moves focus into it** (header announced) and the reader
  stays trapped inside (`accessibilityViewIsModal`); closing returns to a sane spot.
- Charts announce a **text summary** (readiness gauge, composition) — not silence.
- Full traversal of Dashboard, Workout, Progress, Nutrition, Settings with no
  unreachable or unlabelled elements.

## Large-text / layout matrix (SA-012)

At the largest font scale and in landscape/tablet: no clipped or overlapping text,
no unreachable buttons, lists and headers reflow. Capture screenshots per device.

## Longevity / performance

- **Multi-year state** — seed a large account (thousands of sessions) and confirm
  cold start + local persist stay within budget (the local cache is bounded — SA-007).
- Battery/thermal on a 20-minute active-workout session (timers/animation).

## Exit criteria

Every journey passes on the primary iOS + Android devices; screen-reader traversal
has zero unlabelled controls; the large-text matrix has zero clipping; deletion and
cross-device passes show zero data loss. File defects with device + OS + repro.
