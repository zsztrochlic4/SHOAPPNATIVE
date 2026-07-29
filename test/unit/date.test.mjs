// Pure date-helper tests (Production Readiness plan §5 "pure domain tests:
// dates/DST"). These are timezone-robust: keys are parsed back through a UTC
// oracle so a DST bug in addDays/toKey would surface as a skipped or duplicated
// calendar day regardless of the machine's local timezone.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  toKey,
  fromKey,
  addDays,
  dayKey,
  todayKey,
  shortDate,
  weekday,
  relativeLabel,
  currentWeekKeys,
  DEMO_NOW,
} from '../../.sweep-out/lib/date.js'

const KEY = /^\d{4}-\d{2}-\d{2}$/
// Parse a 'YYYY-MM-DD' key into a tz-independent UTC instant for comparisons.
const utc = (k) => {
  const [y, m, d] = k.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

test('toKey zero-pads month and day', () => {
  assert.equal(toKey(new Date(2026, 0, 5)), '2026-01-05')
  assert.equal(toKey(new Date(2026, 11, 31)), '2026-12-31')
})

test('toKey/fromKey round-trips any key', () => {
  for (const k of ['2026-01-01', '2026-06-07', '2026-12-31', '2027-02-28']) {
    assert.equal(toKey(fromKey(k)), k)
  }
})

test('addDays crosses month and year boundaries', () => {
  assert.equal(toKey(addDays(new Date(2026, 11, 31), 1)), '2027-01-01')
  assert.equal(toKey(addDays(new Date(2026, 2, 31), 1)), '2026-04-01')
  assert.equal(toKey(addDays(new Date(2026, 5, 7), -1)), '2026-06-06')
})

test('addDays + toKey never skip or duplicate a calendar day (DST-robust)', () => {
  // Walk ~13 months of days from the demo instant; each step must advance the
  // calendar key by exactly one day even across any DST transition.
  let prev = null
  for (let i = 0; i < 400; i++) {
    const k = toKey(addDays(DEMO_NOW, i))
    assert.match(k, KEY)
    if (prev !== null) {
      assert.equal(utc(k) - utc(prev), 86400000, `gap at day ${i}: ${prev} -> ${k}`)
    }
    prev = k
  }
})

test('dayKey(0) equals today, dayKey(1) is the day before', () => {
  assert.equal(dayKey(0), todayKey)
  assert.equal(utc(dayKey(0)) - utc(dayKey(1)), 86400000)
})

test('relativeLabel labels today and yesterday', () => {
  assert.equal(relativeLabel(todayKey), 'Today')
  assert.equal(relativeLabel(dayKey(1)), 'Yesterday')
  // An arbitrary older day gets a short date, not a relative word.
  assert.equal(relativeLabel('2026-01-01'), shortDate('2026-01-01'))
})

test('currentWeekKeys is Mon..Sun, 7 consecutive days containing now', () => {
  const wk = currentWeekKeys()
  assert.equal(wk.length, 7)
  assert.equal(weekday(wk[0]), 'Mon')
  assert.equal(weekday(wk[6]), 'Sun')
  for (let i = 1; i < wk.length; i++) {
    assert.equal(utc(wk[i]) - utc(wk[i - 1]), 86400000)
  }
  assert.ok(wk.includes(toKey(DEMO_NOW)), 'week should contain the current day')
})
