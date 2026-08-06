# StrengthHub — Data Schema & Security Contract

This is the short schema/security document required by Hardening Plan v3 §11. It
is the human-readable companion to [`firestore.rules`](../../firestore.rules) and
[`storage.rules`](../../storage.rules). **Security Rules are the database schema:**
a new collection or top-level field cannot ship without adding its rule *and* its
test here and in [`test/rules/`](../../test/rules) (plan §1 note, §13).

## Trust zones (plan §3)

| Zone | Contents | Policy |
|------|----------|--------|
| **A — client-owned** | Profile, settings, workout/weight/meal/habit logs, chat, coach thread, self-reported screening. | Client may write, but rules validate structure + isolate by UID. A backend must never treat this as verified. |
| **B — server-owned** | `entitlements/{uid}`, future billing/admin/eligibility state. | Owner may read their own; **all client writes denied**. Admin SDK only. |
| **C — public immutable** | Exercise images / form clips (`exercises/**`). | Public read, no client write, console-administered. |

## Firestore layout

```
users/{uid}                      Zone A — singleton root document
users/{uid}/{collection}/{id}    Zone A — allowlisted per-entry logs
entitlements/{uid}               Zone B — authoritative paid entitlement (server-only writes)
config/coach                     global coach runtime config (auth read-only)
communityProfiles/{uid}          Zone B — league profile (server-only writes, owner read)
communityProfiles/{uid}/scoreDays/{dayKey}   Zone B — F-003 per-day scoring inputs (server-write, owner read)
communityProfiles/{uid}/scoreEvents/{id}     Zone B — F-003 append-only immutable change trail
leagueStandings/…/members/{uid}  Zone B — weekly standings (server-write, signed-in read)
<everything else>                default-deny
```

### Community competitive integrity (F-003)

The competition hub's scoring inputs and standings are **Zone B (server-owned)**:
all client writes are denied, and the community Cloud Functions
([`functions/src/community.ts`](../../functions/src/community.ts)) are the only
writers. `syncCommunityStats` no longer trusts client-computed metrics — it stores
raw daily inputs in an immutable, server-timestamped log and **recomputes** league
/group points itself with the shared scoring core
([`src/community/scoring.ts`](../../src/community/scoring.ts)), stamping a
`calcVersion` + provenance + integrity `status` on each standing. The per-day log
(`scoreDays`/`scoreEvents`) is **owner-readable** for transparency/export and
carries no bodies or free text — only activity counts, habit values and timestamps.
See [`COMMUNITY_INTEGRITY_F003.md`](COMMUNITY_INTEGRITY_F003.md).

### Root document `users/{uid}`

- **Access:** `get` owner-only; **`list` denied**; `create`/`update` owner-only and
  validated; **`delete` denied** (account deletion is a controlled backend workflow, plan §4.2).
- **Structural allowlist:** `keys().hasOnly(...)` over the AppState top-level fields
  (`src/store/types.ts`) minus the subcollection arrays, plus server-written
  `updatedAt`. Unknown top-level fields are rejected. This replaced the old
  `size() < 60` heuristic (plan §4.5 note).
- **Entitlement guard:** `profile.premium` is a **display cache only** — may be
  created as `false`, may never be flipped by a client. Authoritative entitlement
  is Zone B `entitlements/{uid}`.
- **No plaintext tokens:** top-level `accessToken`/`refreshToken` rejected (plan §6);
  nested integration tokens stripped by the sanitiser.
- **Free-text caps:** `profile.motivation`/`injuries` ≤ 2000, `profile.name` ≤ 200,
  `backendUser.notes` ≤ 4000, `backendUser.motivation` ≤ 2000.

### Allowlisted subcollections (plan §4.3–4.5)

Each has its own typed rule (no shared `entryValid()`), owner-only, with an
identifier/ownership invariant and free-text caps:

| Collection | Doc id | Invariant | Text caps |
|-----------|--------|-----------|-----------|
| `sessions` | `id` | `data.id == docId` | name/focus ≤ 200 |
| `weights` | `dateKey` | `dateKey == docId`, `YYYY-MM-DD` | — |
| `habits` | `dateKey` | `dateKey == docId`, `YYYY-MM-DD` | — |
| `meals` | `id` | `data.id == docId` | name ≤ 200 |
| `activities` | `id` | `data.id == docId` | name ≤ 200, note ≤ 1000 |
| `foodReviews` | `dateKey` | `dateKey == docId`, `YYYY-MM-DD` | text ≤ 4000 |
| `chat` | `id` | `data.id == docId` | text ≤ 8000 |
| `coachThread` | `id` | `data.id == docId` | title ≤ 200, body ≤ 8000 |
| `notifications` | `id` | `data.id == docId` | title ≤ 200, body ≤ 1000 |
| `programs` | `program_id` | `uid == path`, `program_id == docId` | — |
| `workout_instances` | `instance_id` | `uid == path`, `instance_id == docId` | — |
| `set_logs` | `log_id` | `uid == path`, `log_id == docId` | — |
| `progression_state` | `${uid}_${exercise_id}` | `uid == path`, `docId == uid_exercise_id` | — |
| `pushTokens` | `token` | `token == docId`, `platform` ∈ ios/android/web/windows/macos | — |

All entries also pass a `size() < 100` key-count cap (defence in depth, **not** the
primary control — plan §4.5 note).

## Storage layout (plan §5)

```
exercises/**   Zone C — public read, no client write
users/**       Zone A — LOCKED (deny) until the progress-photo feature ships
<else>         default-deny
```

When progress-photo uploads are built, add only the precise validated path
`users/{uid}/progressPhotos/{photoId}` (scaffold in `storage.rules`). The
`Thumbnails/squating.avif` long-lived-token asset should be migrated into the
public `exercises/` namespace and its token revoked (see `src/lib/media.ts`).

## Application-layer security (plan §7, §8)

- **Canonical sanitiser** — [`src/lib/sanitize.ts`](../../src/lib/sanitize.ts): one
  routine (Unicode NFC; strip control/zero-width/bidi/unpaired-surrogate; caps;
  reject NaN/Infinity; strip integration secrets) runs at the persist boundary
  (`src/store/cloudRepo.ts`) and before any AI prompt (`sanitizeForPrompt`). Pure
  and dependency-free so the **same code must run server-side** when a backend
  exists — that is the real enforcement point (plan §7.6).
- **Coach response schema** — [`src/backend/coach/responseSchema.ts`](../../src/backend/coach/responseSchema.ts):
  strict validation of structured coach output with a single safe fallback; every
  parse/schema failure resolves safely with no partial write. The coach only
  **proposes**; the deterministic safety engine validates and performs the write
  through the same validated paths — there is no AI-privileged write path (plan §8.2).

## Tests

- `npm run test:rules` — Firestore + Storage emulator rule tests (`test/rules/`).
- `npm run test:unit` — sanitiser + AI-response unit tests (`test/unit/`).
- `npm run test:safety` — coach safety router/validator tests (`test/safety/`).

The CI gate ([`.github/workflows/security-rules.yml`](../../.github/workflows/security-rules.yml))
runs `test:unit` + `test:rules` on every PR touching rules/tests/sanitiser and
gates the manual production rules-deploy job on them passing.
