# Release checklist — StrengthHub Online

Two **independent** release tracks. Know which one your change touches before you ship it.

| Track | What it is | How it ships | Reaches already‑installed apps? |
|-------|-----------|--------------|---------------------------------|
| **Server** | Coach brain (prompt / safety / validators / actions), Cloud Functions, Firestore rules | `firebase deploy` — live in seconds | ✅ **yes** — one shared backend, every client hits it |
| **Client** | App UI + apply logic, screens, navigation, on‑device state | New **EAS build + store submission** | ❌ **no** — there is **no OTA** (`expo-updates` is not installed), so a new binary is required |

> Committing to `main` makes a change *ready*, not *live*. Going live is the two deploy actions below.
> Coach code is authored in `src/backend/coach/**` and **synced** into `functions/src/_shared/**` at
> functions build time (`functions/scripts/sync-shared.mjs`) — so a server‑side coach change only takes
> effect after a **functions deploy**, never from an app reload alone.

---

## 1. Verify green (before any deploy)

```bash
npm test          # typecheck + lint + check + sweep + safety + unit — the full gate
```

Coach‑specific / when touching the coach:

```bash
npm run validate:coach       # live router + classifier check (needs GEMINI_API_KEY set)
npm run validate:holdouts    # safety holdout set
npm run benchmark:coach      # conversational quality benchmark
```

Functions build (typechecks the deployed backend after the shared sync):

```bash
npm --prefix functions run build
```

- [ ] `npm test` passes
- [ ] Coach checks pass (if the coach changed)
- [ ] `npm --prefix functions run build` clean
- [ ] Changes committed to `main`

## 2. Server deploy (coach brain + rules) — live immediately for ALL clients

```bash
firebase deploy --only functions:coachMessage   # syncs shared coach code, then deploys
firebase deploy --only firestore:rules           # only if firestore.rules changed
```

- [ ] Function deployed (`Deploy complete`)
- [ ] Rules deployed (if changed)
- [ ] Smoke‑test in the preview: ask the coach a question, confirm a goal change actually applies

## 3. Client build + store submit (the app binary)

`app.json` uses `runtimeVersion: { policy: "appVersion" }`, so bump the app **version** for each release.

```bash
# bump "version" in app.json first (e.g. 1.0.0 -> 1.0.1)
eas build  --profile production --platform all
eas submit --profile production --platform ios       # App Store Connect
eas submit --profile production --platform android   # Play Console
```

- [ ] `version` bumped in `app.json`
- [ ] Production build succeeds
- [ ] Submitted to both stores
- [ ] Server and client are contract‑compatible (older installs still call the live backend safely)

---

## Coach PUBLIC go‑live gates — MUST be cleared before a store release

The coach is currently enabled for **internal testing only** (`COACH_ENABLED = true` in
`src/backend/coach/coachGate.ts`). Do **not** ship it to the public until:

- [ ] Clinical / native‑speaker review of the safety layer **and** the machine‑translated crisis
      responses signed off
- [ ] **App Check enforced** — requires a **native app registered in Firebase** (project is currently
      web‑app‑only, so App Check is not yet enforceable on device)
- [ ] Independent **holdout eval passed** — detection classifier `validated = true`
      (`npm run validate:holdouts` / the reviewer's holdout review)
- [ ] Program / response‑eval sign‑off recorded
- [ ] `COACH_ENABLED` deliberately confirmed for the exact audience being shipped to

> Committing code does **not** clear these — they are the separate "flip the switch" decision.

## Rollback

- **Server:** re‑`firebase deploy` the previous commit's function, **or** flip a remote switch in
  Firestore with no redeploy — `config/coach.killSwitch` (disables the coach) or
  `config/coach.actionsDisabled` (disables plan‑changing actions, advisory chat still works).
- **Client:** halt the store rollout / submit the prior build (no OTA to pull back).

---

*Keep this file current when the deploy commands, build profiles, or coach gates change.*
