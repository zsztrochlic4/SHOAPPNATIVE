#!/usr/bin/env bash
#
# Cloud Logging alert setup for the remote crash / SLO signals (audit SA-014).
#
# functions/src/observability.ts emits two structured, alertable log entries:
#   • severity=ERROR jsonPayload.event="client_error"  — every client crash
#   • severity=ERROR jsonPayload.event="slo_breach"     — daily error rate over SLO
#
# This creates a log-based counter metric for each, an email notification channel,
# and an alert policy that pages on them — so a production crash or elevated error
# rate is VISIBLE without anyone watching dashboards.
#
# Usage (owner, once):
#   gcloud auth login
#   PROJECT_ID=strengthhub-2ab33 ALERT_EMAIL=you@example.com bash scripts/setup-monitoring.sh
#
# Idempotent-ish: re-running reports "already exists" for metrics/channels; safe.
set -euo pipefail

PROJECT_ID="${PROJECT_ID:?set PROJECT_ID, e.g. strengthhub-2ab33}"
ALERT_EMAIL="${ALERT_EMAIL:?set ALERT_EMAIL, e.g. you@example.com}"
# Daily client-error count above which to alert. Keep in step with
# SLO_DAILY_ERROR_THRESHOLD in functions/src/observability.ts.
CLIENT_ERROR_THRESHOLD="${CLIENT_ERROR_THRESHOLD:-50}"

echo "▶ Project: $PROJECT_ID  Alert email: $ALERT_EMAIL"
gcloud config set project "$PROJECT_ID" >/dev/null

# 1. Log-based counter metrics ------------------------------------------------
echo "▶ Creating log-based metrics…"
gcloud logging metrics create sho_client_errors \
  --description="StrengthHub client crashes (audit SA-014)" \
  --log-filter='jsonPayload.event="client_error" AND severity>=ERROR' \
  2>/dev/null && echo "  created sho_client_errors" || echo "  sho_client_errors exists (skipped)"

gcloud logging metrics create sho_slo_breach \
  --description="StrengthHub SLO breach (audit SA-014)" \
  --log-filter='jsonPayload.event="slo_breach" AND severity>=ERROR' \
  2>/dev/null && echo "  created sho_slo_breach" || echo "  sho_slo_breach exists (skipped)"

# 2. Email notification channel ----------------------------------------------
echo "▶ Ensuring email notification channel…"
CHANNEL_ID="$(gcloud beta monitoring channels list \
  --filter="type=email AND labels.email_address=$ALERT_EMAIL" \
  --format='value(name)' | head -n1 || true)"
if [ -z "$CHANNEL_ID" ]; then
  CHANNEL_ID="$(gcloud beta monitoring channels create \
    --display-name="StrengthHub alerts ($ALERT_EMAIL)" \
    --type=email \
    --channel-labels="email_address=$ALERT_EMAIL" \
    --format='value(name)')"
  echo "  created channel $CHANNEL_ID (check your inbox to verify it)"
else
  echo "  reusing channel $CHANNEL_ID"
fi

# 3. Alert policies -----------------------------------------------------------
make_policy () { # $1=displayName $2=metric $3=threshold $4=alignSec
  cat <<JSON
{
  "displayName": "$1",
  "combiner": "OR",
  "conditions": [{
    "displayName": "$1 condition",
    "conditionThreshold": {
      "filter": "metric.type=\"logging.googleapis.com/user/$2\"",
      "comparison": "COMPARISON_GT",
      "thresholdValue": $3,
      "duration": "0s",
      "aggregations": [{ "alignmentPeriod": "${4}s", "perSeriesAligner": "ALIGN_SUM" }]
    }
  }],
  "notificationChannels": ["$CHANNEL_ID"],
  "alertStrategy": { "autoClose": "1800s" }
}
JSON
}

echo "▶ Creating alert policies…"
tmp="$(mktemp)"
# Any SLO breach at all should page.
make_policy "StrengthHub — SLO breach" "sho_slo_breach" 0 300 > "$tmp"
gcloud alpha monitoring policies create --policy-from-file="$tmp" >/dev/null && echo "  created SLO-breach policy"
# Client crashes: page if more than N in a 5-minute window.
make_policy "StrengthHub — client crash rate" "sho_client_errors" "$CLIENT_ERROR_THRESHOLD" 300 > "$tmp"
gcloud alpha monitoring policies create --policy-from-file="$tmp" >/dev/null && echo "  created client-crash policy"
rm -f "$tmp"

echo "✔ Done. Verify the email channel from your inbox, then trigger a test:"
echo "    the ErrorBoundary / a thrown client error → 'client_error' log → alert."
