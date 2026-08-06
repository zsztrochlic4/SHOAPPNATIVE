// Pure unit tests for the weekly-league cohort allocator helpers (audit F-005).
//   npm --prefix functions run build && node --test functions/test/cohorts.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  bandOf, tzBucketOf, segmentKeyForLevel, nextLevel, rankKeyFor,
  SPLIT_AT, COHORT_TARGET, COHORT_CAP, TIE_RULES_VERSION,
} from '../lib/lib/cohorts.js'

// A fixed instant in the Australian winter (no DST) so timezone offsets are stable.
const WINTER = Date.parse('2026-07-01T00:00:00Z')

test('cohort sizing constants are sane', () => {
  assert.ok(COHORT_TARGET <= COHORT_CAP)
  assert.equal(COHORT_TARGET, 25)
  assert.equal(COHORT_CAP, 30)
  assert.equal(TIE_RULES_VERSION, 1)
})

test('bandOf buckets by weekly session count (<3 / 3-4 / 5+)', () => {
  assert.equal(bandOf(0), 0)
  assert.equal(bandOf(2), 0)
  assert.equal(bandOf(3), 1)
  assert.equal(bandOf(4), 1)
  assert.equal(bandOf(5), 2)
  assert.equal(bandOf(20), 2)
  // Junk clamps to band 0 rather than throwing.
  assert.equal(bandOf(NaN), 0)
  assert.equal(bandOf(-5), 0)
})

test('tzBucketOf yields a coarse UTC-offset bucket', () => {
  assert.equal(tzBucketOf('Australia/Sydney', WINTER), '+1000') // AEST, standard time
  assert.equal(tzBucketOf('Australia/Adelaide', WINTER), '+0930') // half-hour offset
  assert.equal(tzBucketOf('America/New_York', WINTER), '-0400') // EDT in July
  assert.equal(tzBucketOf('UTC', WINTER), '+0000')
  // Absent tz → the app's home zone (Sydney).
  assert.equal(tzBucketOf(undefined, WINTER), '+1000')
  assert.equal(tzBucketOf(null, WINTER), '+1000')
  // Garbage zone → neutral bucket, never throws.
  assert.equal(tzBucketOf('Not/AZone', WINTER), '+0000')
})

test('segmentKeyForLevel progressively adds tz then band', () => {
  assert.equal(segmentKeyForLevel(2, '+1000', 1, 0), 't2')
  assert.equal(segmentKeyForLevel(2, '+1000', 1, 1), 't2|z+1000')
  assert.equal(segmentKeyForLevel(2, '+1000', 1, 2), 't2|z+1000|b1')
  // Level clamps at the bottom (negative → coarsest).
  assert.equal(segmentKeyForLevel(0, '+1000', 0, -1), 't0')
})

test('nextLevel splits at the threshold and caps at 2', () => {
  assert.equal(nextLevel(0, 0), 0)
  assert.equal(nextLevel(SPLIT_AT - 1, 0), 0)
  assert.equal(nextLevel(SPLIT_AT, 0), 1)
  assert.equal(nextLevel(SPLIT_AT, 1), 2)
  assert.equal(nextLevel(1000, 2), 2) // never past 2
})

test('rankKeyFor orders by points, then sessions, then join time, then uid', () => {
  const base = { points: 50, sessionsThisWeek: 3, joinedAtMillis: 1_000_000, uid: 'm' }
  const key = (o) => rankKeyFor({ ...base, ...o })

  // Higher points rank first (smaller key).
  assert.ok(key({ points: 80 }) < key({ points: 20 }))
  // Equal points: more sessions ranks first.
  assert.ok(key({ points: 50, sessionsThisWeek: 6 }) < key({ points: 50, sessionsThisWeek: 1 }))
  // Equal points + sessions: earlier joiner ranks first.
  assert.ok(key({ joinedAtMillis: 1 }) < key({ joinedAtMillis: 9_000_000 }))
  // Full tie: lower uid ranks first.
  assert.ok(key({ uid: 'aaa' }) < key({ uid: 'zzz' }))
})

test('rankKeyFor is fixed-width so lexical order == rank order', () => {
  const k = rankKeyFor({ points: 7, sessionsThisWeek: 2, joinedAtMillis: 42, uid: 'u1' })
  // 3 (points) + 2 (sessions) + 13 (joinedAt ms) + uid
  assert.equal(k.length, 3 + 2 + 13 + 'u1'.length)
  // Points/sessions/join are zero-padded; a 100-point member sorts before a 0-point one.
  assert.ok(rankKeyFor({ points: 100, sessionsThisWeek: 0, joinedAtMillis: 0, uid: 'a' })
    < rankKeyFor({ points: 0, sessionsThisWeek: 50, joinedAtMillis: 0, uid: 'a' }))
})
