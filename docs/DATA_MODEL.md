# Data model & scaling (Firestore)

How each user's data is stored and why it scales. (For the AI-coach Cloud
Function, see [BACKEND.md](./BACKEND.md).)

The backend is **Firebase** (Auth + Firestore + Cloud Storage). There is no
custom server to run or scale — Firestore shards data per user and scales
horizontally, so the *number* of users is not the bottleneck. What needs care is
how each user's data is modelled, which is what this document covers.

## Structure

Each user's state is split between one small root document and a set of per-entry
subcollections:

```
users/{uid}                     ← singleton doc: profile, settings, program,
                                  badges, meal plan, and other bounded fields
users/{uid}/sessions/{id}       ← one document per workout session
users/{uid}/weights/{dateKey}   ← one document per day
users/{uid}/habits/{dateKey}    ← one document per day
users/{uid}/meals/{id}          ← one document per logged meal
users/{uid}/activities/{id}     ← one document per logged activity
users/{uid}/foodReviews/{dateKey}
users/{uid}/chat/{id}
users/{uid}/coachThread/{id}
users/{uid}/notifications/{id}
```

## Why not one document per user?

The obvious design — store the whole app state in `users/{uid}` and rewrite it on
every change — does not scale *per user*:

1. **1 MB document limit.** A committed user's history (workout sessions with
   per-set logs, chat, food/weight/habit logs) grows without bound and eventually
   crosses Firestore's hard 1 MB per-document ceiling. At that point every write
   fails and data silently stops saving.
2. **Write amplification.** Rewriting the entire document on every tiny change
   (logging one glass of water re-sends the user's whole history) makes write cost
   and latency grow with account age — lag that hits your *most engaged* users
   first.

Splitting the unbounded logs into subcollections fixes both: no single document
approaches the size limit, and a save only writes the entries that actually
changed.

## How it works in code

`src/store/cloudRepo.ts` owns persistence:

- **Load** (`loadUserState`) reads the root doc and every subcollection in
  parallel and assembles the full state to hydrate the local store.
- **Save** (`saveUserState`) diffs the current state against the last-saved state
  and writes only added/changed entries (and deletes removed ones) using atomic
  Firestore batches. Per-save cost is **O(entries changed)**, not O(entire
  history). The small root doc is rewritten each time (cheap, bounded).

`src/store/CloudSync.tsx` is the bridge: it loads on sign-in, debounces saves
(800 ms) while signed in, and keeps a baseline of what's in the cloud so each save
diffs correctly. Progress photos stay on-device (base64 image data is too large
for Firestore documents).

### Legacy migration

Accounts created before this split stored their arrays inside the root document.
On first load those arrays are read back (so nothing is lost); the next save moves
them into subcollections and rewrites the root document without them. This is
automatic and one-time per account.

## Security rules

`firestore.rules` and `storage.rules` enforce **owner-only** access: a signed-in
user can read and write only their own tree under `users/{uid}` (at any depth),
and only their own media under `users/{uid}/…` in Storage. Everything else is
denied by default. This per-uid scoping is what makes it safe to ship the
(non-secret) Firebase web config in the client, and it holds regardless of how
many users exist.

Deploy rules with:

```
firebase deploy --only firestore:rules,storage
```

## Future scaling steps (not yet needed)

- **Paginate history reads.** Load currently fetches whole subcollections on
  sign-in. For a user with thousands of entries, switch to `limit()` +
  `orderBy(dateKey)` windows and lazy-load older history. (Adds a composite index
  per ordered query.)
- **Move remaining growable fields out of the root doc.** `posts`, `postComments`,
  `foods` and `nutritionTags` still live in the root document. They are bounded in
  practice today, but are the next candidates for subcollections if they grow.
