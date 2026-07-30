// Pure tests for the bounded-read / lazy-history merge (Phase C). These pin the
// invariants the save path relies on: the merge is loss-free, de-duplicated,
// idempotent, and the recent copy wins on collision (so a just-made edit is
// never clobbered by a lazy history fetch).
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeById } from '../../.sweep-out/store/historyMerge.js'

const e = (id, dateKey, extra = {}) => ({ id, dateKey, ...extra })

test('union is de-duplicated by id', () => {
  const recent = [e('b', '2026-02-01'), e('c', '2026-03-01')]
  const older = [e('a', '2026-01-01'), e('b', '2026-02-01')]
  const out = mergeById(recent, older)
  assert.deepEqual(out.map((x) => x.id), ['a', 'b', 'c'])
})

test('result is sorted chronologically (dateKey asc, then id)', () => {
  const recent = [e('z', '2026-05-01'), e('a', '2026-05-01')]
  const older = [e('m', '2026-01-15'), e('k', '2026-03-20')]
  const out = mergeById(recent, older)
  assert.deepEqual(
    out.map((x) => `${x.dateKey}#${x.id}`),
    ['2026-01-15#m', '2026-03-20#k', '2026-05-01#a', '2026-05-01#z'],
  )
})

test('recent copy wins on id collision (edits survive a lazy fetch)', () => {
  const recent = [e('x', '2026-04-01', { kcal: 999 })] // user just edited this
  const older = [e('x', '2026-04-01', { kcal: 100 })] // stale server copy
  const out = mergeById(recent, older)
  assert.equal(out.length, 1)
  assert.equal(out[0].kcal, 999)
})

test('loss-free: every input id appears exactly once', () => {
  const recent = [e('r1', '2026-06-01'), e('r2', '2026-06-02')]
  const older = [e('o1', '2026-01-01'), e('o2', '2026-01-02'), e('r1', '2026-06-01')]
  const out = mergeById(recent, older)
  const ids = out.map((x) => x.id).sort()
  assert.deepEqual(ids, ['o1', 'o2', 'r1', 'r2'])
  assert.equal(new Set(ids).size, ids.length) // no duplicates
})

test('idempotent: merging the result with either input changes nothing', () => {
  const recent = [e('b', '2026-02-01'), e('c', '2026-03-01')]
  const older = [e('a', '2026-01-01')]
  const once = mergeById(recent, older)
  const twice = mergeById(once, older)
  assert.deepEqual(twice, once)
  const reMerged = mergeById(once, recent)
  assert.deepEqual(reMerged, once)
})

test('baseline-superset invariant: merged ⊇ recent (no recent id ever dropped)', () => {
  const recent = [e('b', '2026-02-01'), e('c', '2026-03-01'), e('d', '2026-04-01')]
  const older = [e('a', '2026-01-01')]
  const out = mergeById(recent, older)
  const outIds = new Set(out.map((x) => x.id))
  for (const r of recent) assert.ok(outIds.has(r.id), `recent id ${r.id} present`)
})

test('empty older is a no-op sort of recent', () => {
  const recent = [e('c', '2026-03-01'), e('a', '2026-01-01')]
  const out = mergeById(recent, [])
  assert.deepEqual(out.map((x) => x.id), ['a', 'c'])
})

test('entries without an id are ignored (never crash)', () => {
  const recent = [e('a', '2026-01-01'), { dateKey: '2026-02-01' }]
  const out = mergeById(recent, [])
  assert.deepEqual(out.map((x) => x.id), ['a'])
})
