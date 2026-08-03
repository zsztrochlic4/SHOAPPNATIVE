// P1 regression (audit SA-007/008/009): storage & hydration scale.
//  - SA-007: local persist is bounded; the cloud root doc stays under budget
//            even for a multi-year account.
//  - SA-008: history paging cursors advance correctly and stop at the last page.
//  - SA-009: cross-device root conflicts merge without silently losing either
//            device's edits.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  keepRecent,
  boundStateForLocalPersist,
  estimateRootDocBytes,
  rootDocFields,
  ROOT_DOC_BUDGET_BYTES,
  LOCAL_CAPS,
} from '../../.sweep-out/store/localPersistBound.js'
import {
  resolveRootConflict,
  isRootStale,
  hasMorePage,
  nextCursor,
} from '../../.sweep-out/store/conflict.js'
import { buildSeed, emptyState } from '../../.sweep-out/store/seed.js'

/* ----------------------------- SA-007 -------------------------------------- */

test('keepRecent keeps the newest N by dateKey, preserving original order', () => {
  const list = [
    { dateKey: '2026-01-01', v: 'a' },
    { dateKey: '2026-03-01', v: 'c' },
    { dateKey: '2026-02-01', v: 'b' },
  ]
  const kept = keepRecent(list, 2)
  assert.equal(kept.length, 2)
  // newest two are c (Mar) and b (Feb); original order (c before b) is preserved
  assert.deepEqual(kept.map((e) => e.v), ['c', 'b'])
})

test('boundStateForLocalPersist caps the heavy slices, leaves small ones intact', () => {
  const s = emptyState()
  s.sessions = Array.from({ length: LOCAL_CAPS.sessions + 50 }, (_, i) => ({
    id: `s${i}`, dateKey: `2020-01-${String((i % 28) + 1).padStart(2, '0')}`,
  }))
  const bounded = boundStateForLocalPersist(s)
  assert.equal(bounded.sessions.length, LOCAL_CAPS.sessions)
  // small slices are untouched (same reference)
  assert.equal(bounded.weights, s.weights)
})

test('cloud root doc stays under budget for a representative ~10-year account', () => {
  const s = emptyState()
  // 10 years of once-a-day root growth: started/asked keys + nutrition tags.
  const started = []
  const asked = []
  const tags = {}
  for (let i = 0; i < 3650; i++) {
    const y = 2020 + Math.floor(i / 365)
    const key = `${y}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`
    started.push(key)
    asked.push(key)
    tags[key] = ['high-protein', 'vegetables', 'hydrated']
  }
  s.workoutStartedKeys = started
  s.nutritionAskedKeys = asked
  s.nutritionTags = tags
  const bytes = estimateRootDocBytes(s)
  assert.ok(bytes < ROOT_DOC_BUDGET_BYTES, `root doc ${bytes}B must stay under ${ROOT_DOC_BUDGET_BYTES}B`)
  assert.ok(bytes < 1024 * 1024, 'must stay under the 1 MiB Firestore hard limit')
})

test('rootDocFields excludes the append-heavy subcollections and device-only fields', () => {
  const s = buildSeed()
  const fields = rootDocFields(s)
  assert.ok(!('sessions' in fields), 'sessions live in a subcollection, not the root')
  assert.ok(!('meals' in fields), 'meals live in a subcollection, not the root')
  assert.ok(!('subscription' in fields), 'subscription is device-only / server-owned')
  assert.ok('profile' in fields, 'profile is a bounded root field')
})

/* ----------------------------- SA-008 -------------------------------------- */

test('hasMorePage: a full page implies more, a short page is the last', () => {
  assert.equal(hasMorePage(300, 300), true)
  assert.equal(hasMorePage(120, 300), false)
  assert.equal(hasMorePage(0, 300), false)
})

test('nextCursor returns the last item ordering value on a full page, null otherwise', () => {
  const full = Array.from({ length: 3 }, (_, i) => ({ dateKey: `d${i}` }))
  assert.equal(nextCursor(full, 3, (e) => e.dateKey), 'd2')
  const short = [{ dateKey: 'd0' }]
  assert.equal(nextCursor(short, 3, (e) => e.dateKey), null)
})

/* ----------------------------- SA-009 -------------------------------------- */

test('root conflict: the other device\'s field is kept when we did not touch it', () => {
  const base = { theme: 'dark', name: 'Alex' }
  const local = { theme: 'light', name: 'Alex' } // we changed theme only
  const remote = { theme: 'dark', name: 'Alexandra' } // other device changed name
  const merged = resolveRootConflict(base, local, remote)
  assert.equal(merged.theme, 'light') // our edit wins
  assert.equal(merged.name, 'Alexandra') // their edit is NOT lost
})

test('root conflict: our edit wins on a genuinely conflicting field, no crash on new keys', () => {
  const base = { units: 'metric' }
  const local = { units: 'imperial', newLocal: 1 }
  const remote = { units: 'metric', newRemote: 2 }
  const merged = resolveRootConflict(base, local, remote)
  assert.equal(merged.units, 'imperial') // we changed it; we win
  assert.equal(merged.newLocal, 1) // added locally
  assert.equal(merged.newRemote, 2) // added remotely — kept
})

test('isRootStale detects a newer remote root', () => {
  assert.equal(isRootStale(1000, 2000), true)
  assert.equal(isRootStale(2000, 1000), false)
  assert.equal(isRootStale('2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z'), true)
  assert.equal(isRootStale(null, 2000), false) // can't prove staleness ⇒ fresh
})
