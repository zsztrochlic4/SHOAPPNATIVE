/**
 * Fallback policy guard (final plan Phase 4, node --test).
 *
 *   npm run test:unit
 *
 * The partial-context on-device fallback (src/lib/coachChat.ts) shares the live path's POLICY floor: it
 * must never hand out a supplement dose, never program through an injury ("train around it"), and never
 * prescribe a fixed training frequency as a number range. This is a direct source-content guard so the
 * banned advice can't creep back in without a test failing — it does not depend on the router.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(here, '..', '..', 'src', 'lib', 'coachChat.ts'), 'utf8')

test('no supplement dose in the fallback', () => {
  // e.g. "3-5g", "3–5 g", "5g daily" — any explicit dose figure attached to a supplement.
  assert.doesNotMatch(src, /\b\d+\s?[-–]\s?\d+\s?g\b/i, 'a supplement dose range slipped into the fallback')
  assert.doesNotMatch(src, /\b\d+\s?g\s+(daily|per day|a day)\b/i, 'a per-day gram dose slipped into the fallback')
})

test('no injury "train around it" override advice', () => {
  assert.doesNotMatch(src, /train around it/i, '"train around it" is injury-override advice and must not be in the fallback')
})

test('no auto-prescribed fixed session-per-week range', () => {
  assert.doesNotMatch(src, /\d\s?[-–]\s?\d\s+sessions?\s+a\s+week/i, 'a fixed sessions-per-week range must not be prescribed')
  assert.doesNotMatch(src, /5\s?[-–]\s?6\s+sessions?/i)
})

test('no repeated "I hear you" filler (Phase 3 voice)', () => {
  assert.doesNotMatch(src, /I hear you/i, 'empty filler "I hear you" must be removed')
})

test('detail extractor is present (acknowledges exercise/time)', () => {
  assert.match(src, /export function extractDetails/)
})
