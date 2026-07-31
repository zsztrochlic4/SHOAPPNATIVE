# Crash / error reporting

The app has an **error boundary** (`src/components/ErrorBoundary.tsx`) at the root
that catches uncaught render errors and shows a recovery screen instead of a blank
white screen. Every unexpected error flows through **`src/lib/reportError.ts`**.

Right now `reportError` just logs. There is **no crash service wired** — that needs
an owner decision (which service) and, for Sentry, a native module + a DSN.

## Wiring a service (owner, when ready)

`reportError` is a seam: register a reporter once at startup and every existing
call site starts reporting, no other code changes.

### Sentry (recommended)
1. `npx expo install @sentry/react-native` *(native module → needs a fresh dev/EAS build, like reanimated/netinfo).*
2. Create a project at sentry.io, get the DSN, put it in `.env` as
   `EXPO_PUBLIC_SENTRY_DSN`.
3. In `App.tsx` (top, before render):
   ```ts
   import * as Sentry from '@sentry/react-native'
   import { setErrorReporter } from './lib/reportError'
   if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
     Sentry.init({ dsn: process.env.EXPO_PUBLIC_SENTRY_DSN, tracesSampleRate: 0.1 })
     setErrorReporter((err, ctx) => Sentry.captureException(err, { extra: ctx }))
   }
   ```
4. Optionally wrap the export with `Sentry.wrap(App)` for native crash + perf.

### Lighter option (no native module)
Point `setErrorReporter` at a Cloud Function that appends to a `clientErrors`
collection (App-Check-gated). Web-only crash capture; no dev build required.

## Privacy
Scrub PII before sending. The current `reportError` context is limited to the
error + component stack. If you add breadcrumbs, keep health/personal fields out —
see `docs/PRIVACY.md`.
