# Backend rate limits + TTL cleanup

Server-side callables that cost money or invite abuse are capped per user per day
via `functions/src/lib/rateLimit.ts` (`enforceDailyLimit`). Counters live in a
server-only `rateLimits` collection (not in the client allowlist, so
firestore.rules default-denies clients; the Admin SDK bypasses rules).

Current caps: **meal scan — 40/user/day** (`analyzeMeal`).

## TTL policy (owner — one-time)

Each counter doc carries an **`expiresAt`** timestamp. Without a TTL policy the
collection grows by one doc per active user per day forever. Create the policy
once so Firestore auto-deletes expired buckets:

**Console:** Firestore → **TTL** → *Create policy* → Collection `rateLimits`,
Timestamp field `expiresAt`.

**gcloud:**
```
gcloud firestore fields ttls update expiresAt \
  --collection-group=rateLimits --enable-ttl --project=strengthhub-2ab33
```

TTL deletes run within ~24h of expiry (not instant) — that's fine; `expiresAt` is
set ~2 days out so a live bucket is never reaped mid-use.

## Notes
- Day bucket is **UTC**. A per-user local day would only matter to someone hitting
  the cap right around their local midnight — the generous caps make that rare, so
  it's kept simple. To localise later, thread the client's `getTimezoneOffset()`
  into `dayBucket`.
- To add a new limited action: call `enforceDailyLimit('<key>', uid, <max>)` at the
  top of the callable. The same TTL policy covers every key.
