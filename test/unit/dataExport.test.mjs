// Pure tests for "Download my data" serialisation: deterministic output, ISO
// timestamps, undefined stripped, a manifest with per-collection counts, and the
// local-state split. The delivery (web download / native share) is untested here.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  serializeUserExport,
  normalizeForExport,
  splitLocalState,
  buildExportFilename,
  EXPORT_VERSION,
} from '../../.sweep-out/lib/dataExport.js'

const NOW = new Date('2026-07-31T09:15:00.000Z')

test('serializeUserExport: manifest carries version, timestamp, source and counts', () => {
  const out = JSON.parse(
    serializeUserExport({ profile: { name: 'Alex' }, collections: { sessions: [{}, {}], weights: [{}] }, source: 'cloud' }, NOW),
  )
  assert.equal(out._manifest.exportVersion, EXPORT_VERSION)
  assert.equal(out._manifest.exportedAt, '2026-07-31T09:15:00.000Z')
  assert.equal(out._manifest.source, 'cloud')
  assert.deepEqual(out._manifest.counts, { sessions: 2, weights: 1 })
  assert.equal(out.profile.name, 'Alex')
})

test('serializeUserExport: is deterministic — same input + now is byte-identical, key order and all', () => {
  const a = serializeUserExport({ profile: { b: 2, a: 1 }, collections: { z: [], a: [] } }, NOW)
  const b = serializeUserExport({ profile: { a: 1, b: 2 }, collections: { a: [], z: [] } }, NOW)
  assert.equal(a, b)
})

test('normalizeForExport: Date and Firestore Timestamp shapes become ISO strings', () => {
  const clientTs = { seconds: 1690794000, nanoseconds: 0 } // 2023-07-31T09:00:00Z
  const adminTs = { _seconds: 1690794000, _nanoseconds: 0 }
  const withToDate = { toDate: () => new Date('2026-01-02T03:04:05.000Z') }
  const out = normalizeForExport({
    when: new Date('2026-07-31T00:00:00.000Z'),
    createdAt: clientTs,
    updatedAt: adminTs,
    edited: withToDate,
  })
  assert.equal(out.when, '2026-07-31T00:00:00.000Z')
  assert.equal(out.createdAt, '2023-07-31T09:00:00.000Z')
  assert.equal(out.updatedAt, '2023-07-31T09:00:00.000Z')
  assert.equal(out.edited, '2026-01-02T03:04:05.000Z')
})

test('normalizeForExport: undefined is dropped, null is kept, array order is preserved', () => {
  const out = normalizeForExport({ a: undefined, b: null, list: [3, 1, 2] })
  assert.ok(!('a' in out))
  assert.equal(out.b, null)
  assert.deepEqual(out.list, [3, 1, 2]) // arrays are NOT sorted (log order matters)
})

test('normalizeForExport: nested object keys are sorted for stable diffs', () => {
  const out = normalizeForExport({ z: { d: 1, a: 2 }, a: 1 })
  assert.deepEqual(Object.keys(out), ['a', 'z'])
  assert.deepEqual(Object.keys(out.z), ['a', 'd'])
})

test('splitLocalState: arrays become collections, everything else is profile', () => {
  const { profile, collections, source } = splitLocalState({
    name: 'Alex',
    settings: { units: 'metric' },
    sessions: [{ id: 's1' }],
    weights: [{ dateKey: '2026-07-01' }],
  })
  assert.equal(source, 'local')
  assert.deepEqual(profile, { name: 'Alex', settings: { units: 'metric' } })
  assert.deepEqual(Object.keys(collections).sort(), ['sessions', 'weights'])
  assert.equal(collections.sessions.length, 1)
})

test('splitLocalState round-trips through the serialiser with counts', () => {
  const out = JSON.parse(serializeUserExport(splitLocalState({ name: 'A', meals: [{}, {}, {}] }), NOW))
  assert.equal(out._manifest.source, 'local')
  assert.equal(out._manifest.counts.meals, 3)
  assert.equal(out.profile.name, 'A')
})

test('buildExportFilename: dated, stable, .json', () => {
  assert.equal(buildExportFilename(NOW), 'strengthhub-data-2026-07-31.json')
})

test('serializeUserExport: empty input still produces a valid document', () => {
  const out = JSON.parse(serializeUserExport({ profile: {}, collections: {} }, NOW))
  assert.deepEqual(out.collections, {})
  assert.deepEqual(out._manifest.counts, {})
})
