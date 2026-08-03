# Remote crash & SLO alerting (audit SA-014)

The app no longer holds errors only in an on-device buffer. Production crashes and
an elevated error rate now produce **alertable Cloud Logging signals**, and this
runbook attaches an alert policy so the team is paged automatically.

## The signals (already emitted by the backend)

`functions/src/observability.ts` writes two structured, ERROR-severity log lines:

| Signal | Log filter | Meaning |
|---|---|---|
| Client crash | `jsonPayload.event="client_error"` | A crash reached the `reportError` seam and was sent by `src/lib/remoteErrorReporter.ts` (redacted, throttled). |
| SLO breach | `jsonPayload.event="slo_breach"` | The scheduled `monitorSlo` found the day's client-error count over `SLO_DAILY_ERROR_THRESHOLD`. |

Both carry only redacted fields (error name, truncated message, tag, time) — never
user content or health data.

## One-time setup (owner)

Requires the `gcloud` CLI and Owner/Editor on the Firebase project.

```bash
gcloud auth login
PROJECT_ID=strengthhub-2ab33 ALERT_EMAIL=you@example.com bash scripts/setup-monitoring.sh
```

This creates:
1. two **log-based metrics** — `sho_client_errors`, `sho_slo_breach`;
2. an **email notification channel** (verify it from your inbox);
3. two **alert policies** — SLO breach pages on any occurrence; client-crash pages
   when more than `CLIENT_ERROR_THRESHOLD` (default 50) occur in 5 minutes.

Tune the crash threshold with `CLIENT_ERROR_THRESHOLD=... bash scripts/setup-monitoring.sh`,
and keep `SLO_DAILY_ERROR_THRESHOLD` in `functions/src/observability.ts` in step
with your expected volume.

## Verify it works (the audit's acceptance test)

1. **Client crash → alert:** trigger a JS error in a build (e.g. the ErrorBoundary
   fallback, or throw in a screen). Within a minute a `client_error` line appears
   in Logs Explorer and, above threshold, the alert fires.
2. **Backend/SLO → alert:** let the day's `sho_client_errors` exceed the threshold
   (or lower it temporarily); `monitorSlo` (every 15 min) emits `slo_breach` and
   the SLO policy pages immediately.

## Console alternative (no CLI)

Logs Explorer → run the filter above → **Create alert** → set the threshold and
the email channel. Same result as the script.

## Optional: swap in a crash SDK later

The `setErrorReporter` seam (`src/lib/reportError.ts`) is provider-agnostic. To add
Sentry/Crashlytics later, register it there instead of — or alongside —
`installRemoteErrorReporter()`; the redaction and throttle already apply.
