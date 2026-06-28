# Backend — AI coach (Firebase Cloud Function)

The in-app coach works offline with an on-device rules engine. To make it give
real **Claude** replies, deploy this one Cloud Function. It holds your Anthropic
API key as a secret (never in the app), and the app falls back to the rules
engine whenever the function is unreachable — so nothing ever breaks.

```
functions/index.js   → the `coach` HTTPS function (mirrors api/coach.ts)
functions/package.json
firebase.json        → tells Firebase to deploy functions/
```

## Prerequisites
- A **Firebase project** (you already have one connected).
- **Firebase CLI**: `npm install -g firebase-tools` then `firebase login`.
- An **Anthropic API key**: https://console.anthropic.com → API Keys.
- Cloud Functions need the project on the **Blaze (pay-as-you-go)** plan. The AI
  coach is cheap (scales to zero; you pay per message), but Blaze is required.

## Deploy

```bash
# from the repo root
firebase use --add                      # pick your Firebase project

cd functions && npm install && cd ..    # install function deps

# store your Anthropic key as a secret (you'll be prompted to paste it)
firebase functions:secrets:set ANTHROPIC_API_KEY

# deploy just the function
firebase deploy --only functions
```

After deploy the CLI prints the function URL, e.g.
`https://us-central1-YOUR_PROJECT.cloudfunctions.net/coach`.

## Point the app at it

The app reads the endpoint from `EXPO_PUBLIC_COACH_API`. Set it so the coach
goes live (create a `.env` in the repo root, or set it in your EAS build env):

```
EXPO_PUBLIC_COACH_API=https://us-central1-YOUR_PROJECT.cloudfunctions.net/coach
```

- Local/dev: with `.env` present, `npx expo start` picks it up.
- Production builds: add it in EAS → Project → Environment variables, or under
  `build.production.env` in `eas.json`, so the released app talks to your coach.

Rebuild the app after setting it. Without it, the coach silently uses the
on-device fallback.

## Test it

```bash
curl -X POST https://us-central1-YOUR_PROJECT.cloudfunctions.net/coach \
  -H 'Content-Type: application/json' \
  -d '{"message":"I'm sore after legs, should I train today?","profile":{"name":"Alex","goal":"build-muscle"}}'
# → {"reply":"..."}
```

## Cost control
- The function uses `claude-opus-4-8`. To cut cost/latency, change `model` in
  `functions/index.js` to a smaller model (e.g. `claude-haiku-4-5`) and redeploy.
- History is capped to the last 10 turns and `max_tokens` to 400.

## Why not Firebase App Hosting?
App Hosting runs an always-on Cloud Run container and is aimed at full web
frameworks. A single HTTPS function is simpler, cheaper (scales to zero), and is
all this endpoint needs. You can leave the App Hosting backend disconnected.
