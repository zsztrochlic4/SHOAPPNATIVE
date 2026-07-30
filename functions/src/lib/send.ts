import { FieldValue, type Firestore, type DocumentReference } from 'firebase-admin/firestore'
import {
  chunk,
  filterRecipients,
  classifyTickets,
  type RecipientToken,
  type PushCategory,
  type ExpoTicket,
} from './notify'

/**
 * Notification-sender orchestration (Phase D): resolve an audience to device
 * tokens, honour each user's prefs + quiet hours (via ./notify), fan out to the
 * Expo Push API in batches, prune dead tokens, and record an idempotent audit.
 *
 * Dependencies are injected so the whole flow is unit-testable with a fake
 * Firestore + fetch and no network. See functions/test/notify.test.mjs.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const EXPO_BATCH = 100
const PAGE = 500

/** Quiet-hours defaults applied when a user never opened notification settings
 *  (mirrors DEFAULT_NOTIF_PREFS in src/lib/notifications.ts). */
const DEFAULT_PREFS = { quiet: true, quietStartHour: 22, quietEndHour: 7 }

export type Audience = { uid: string } | { all: true }

export interface SendParams {
  audience: Audience
  title: string
  body: string
  /** Extra payload (e.g. a deep link) delivered with the push. */
  data?: Record<string, unknown>
  category?: PushCategory
  /** Deliver even inside a device's quiet window. */
  override?: boolean
  dryRun?: boolean
  /** Idempotency key — a repeated committed send with the same id is a no-op. */
  sendId: string
  maxRecipients?: number
}

export interface SendResult {
  sendId: string
  dryRun: boolean
  /** Deliverable devices after filtering. */
  recipients: number
  skipped: number
  sent: number
  errors: number
  pruned: number
}

export interface SendDeps {
  db: Firestore
  fetchFn: typeof fetch
  now: Date
}

interface TokenRow extends RecipientToken {
  ref: DocumentReference
}

export async function sendToAudience(deps: SendDeps, params: SendParams): Promise<SendResult> {
  const { db, fetchFn, now } = deps
  const dryRun = params.dryRun ?? false
  const cap = params.maxRecipients ?? 50000

  // Idempotency: a prior COMMITTED send with this id returns its stored result
  // (dry runs are previews and are never deduped).
  const auditRef = db.collection('notificationSends').doc(params.sendId)
  if (!dryRun) {
    const prior = await auditRef.get()
    if (prior.exists && prior.get('dryRun') === false) return prior.get('result') as SendResult
  }

  const rows = await resolveTokens(db, params.audience, cap)
  const nowUtcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes()
  const { send, skipped } = filterRecipients(rows, { nowUtcMinutes, category: params.category, override: params.override })

  if (dryRun) {
    return { sendId: params.sendId, dryRun: true, recipients: send.length, skipped, sent: 0, errors: 0, pruned: 0 }
  }

  const refByToken = new Map<string, DocumentReference>()
  for (const r of rows) refByToken.set(r.token, r.ref)

  let sent = 0
  let errors = 0
  const toPrune: string[] = []
  for (const batch of chunk(send, EXPO_BATCH)) {
    const messages = batch.map((r) => ({ to: r.token, title: params.title, body: params.body, data: params.data }))
    const tickets = await postExpo(fetchFn, messages)
    const tokens = batch.map((r) => r.token)
    if (tickets) {
      const c = classifyTickets(tokens, tickets)
      sent += c.ok
      errors += c.errors
      toPrune.push(...c.prune)
    } else {
      errors += batch.length // request-level failure: none delivered, prune nothing
    }
  }

  const pruned = await pruneTokens(db, toPrune, refByToken)

  const result: SendResult = { sendId: params.sendId, dryRun: false, recipients: send.length, skipped, sent, errors, pruned }
  await auditRef.set({
    audience: params.audience,
    title: params.title,
    category: params.category ?? 'general',
    result,
    dryRun: false,
    at: FieldValue.serverTimestamp(),
  })
  return result
}

async function resolveTokens(db: Firestore, audience: Audience, cap: number): Promise<TokenRow[]> {
  let rows: TokenRow[]
  if ('uid' in audience) {
    const snap = await db.collection('users').doc(audience.uid).collection('pushTokens').get()
    rows = snap.docs.map((d) => toRow(d.ref, audience.uid, d.data())).slice(0, cap)
  } else {
    // Broadcast: paginate the pushTokens collection group (bounded reads, not one scan).
    rows = []
    let last: FirebaseFirestore.QueryDocumentSnapshot | null = null
    while (rows.length < cap) {
      let q = db.collectionGroup('pushTokens').limit(PAGE)
      if (last) q = q.startAfter(last)
      const snap = await q.get()
      if (snap.empty) break
      for (const d of snap.docs) {
        const uid = d.ref.parent.parent?.id
        if (uid) rows.push(toRow(d.ref, uid, d.data()))
      }
      last = snap.docs[snap.docs.length - 1]
      if (snap.size < PAGE) break
    }
    rows = rows.slice(0, cap)
  }
  await joinPrefs(db, rows)
  return rows
}

function toRow(ref: DocumentReference, uid: string, data: FirebaseFirestore.DocumentData): TokenRow {
  return {
    ref,
    uid,
    token: String(data.token ?? ref.id),
    utcOffsetMinutes: typeof data.utcOffsetMinutes === 'number' ? data.utcOffsetMinutes : 0,
  }
}

/** Attach each token's owner prefs (batched root-doc reads). Also used for the
 *  single-uid path, which resolves its one user's prefs the same way. */
async function joinPrefs(db: Firestore, rows: TokenRow[]): Promise<void> {
  const uids = [...new Set(rows.map((r) => r.uid))]
  if (uids.length === 0) return
  const refs = uids.map((u) => db.collection('users').doc(u))
  const snaps = await db.getAll(...refs)
  const byUid = new Map<string, { enabled?: boolean; prefs: RecipientToken['prefs'] }>()
  snaps.forEach((s, i) => {
    const settings = (s.get('settings') ?? {}) as Record<string, unknown>
    const rawPrefs = (settings.notificationPrefs ?? {}) as Record<string, unknown>
    byUid.set(uids[i], {
      enabled: settings.notificationsEnabled as boolean | undefined,
      prefs: { ...DEFAULT_PREFS, ...rawPrefs },
    })
  })
  for (const r of rows) {
    const info = byUid.get(r.uid)
    r.notificationsEnabled = info?.enabled
    r.prefs = info?.prefs ?? DEFAULT_PREFS
  }
}

async function postExpo(
  fetchFn: typeof fetch,
  messages: unknown[],
): Promise<ExpoTicket[] | null> {
  try {
    const res = await fetchFn(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { data?: ExpoTicket[]; errors?: unknown }
    if (json.errors || !Array.isArray(json.data)) return null
    return json.data
  } catch {
    return null
  }
}

async function pruneTokens(
  db: Firestore,
  tokens: string[],
  refByToken: Map<string, DocumentReference>,
): Promise<number> {
  let pruned = 0
  for (const group of chunk(tokens, 400)) {
    const batch = db.batch()
    let n = 0
    for (const tok of group) {
      const ref = refByToken.get(tok)
      if (ref) {
        batch.delete(ref)
        n++
      }
    }
    if (n > 0) {
      await batch.commit()
      pruned += n
    }
  }
  return pruned
}
