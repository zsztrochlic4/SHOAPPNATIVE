// App Check coverage guard (static source check). Enforcement is a single deploy
// flip (APPCHECK_ENFORCE=1) that only protects a callable if that callable opted
// in with `enforceAppCheck: APP_CHECK_ENFORCED`. A community callable added later
// that forgets the option would be silently unprotected even after enforcement is
// on — exactly the gap a past audit found ("App Check monitor never wired on ANY
// community/group callable"). This test fails the build if any client-facing
// callable in the community/coach/account/etc. surface omits it.
//   npm run test:unit  (no emulator needed — it reads source text)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

// Every functions source file that defines client-facing callables (onCall).
// Scheduled functions (onSchedule) are NOT client-facing and are correctly exempt.
const FILES = [
  'functions/src/community.ts',
  'functions/src/communityGroups.ts',
  'functions/src/communityModeration.ts',
  'functions/src/communityMetrics.ts',
  'functions/src/coach.ts',
  'functions/src/coachProfile.ts',
  'functions/src/account.ts',
  'functions/src/notifications.ts',
  'functions/src/observability.ts',
]

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

/** Find each `export const NAME = onCall...(` and return NAME + the definition
 *  region (up to the next top-level `export const`, comments stripped). The
 *  `enforceAppCheck:` option literal only ever appears in the options object, so
 *  searching the whole region for it is exact. */
function callables(src) {
  const clean = stripComments(src)
  const out = []
  const re = /export const (\w+)\s*=\s*onCall\b/g
  let m
  while ((m = re.exec(clean))) {
    const next = clean.indexOf('\nexport const ', m.index + 1)
    const region = clean.slice(m.index, next === -1 ? clean.length : next)
    out.push({ name: m[1], head: region })
  }
  return out
}

test('every community/backend callable opts into App Check enforcement', () => {
  const missing = []
  let total = 0
  for (const rel of FILES) {
    let src
    try {
      src = readFileSync(join(root, rel), 'utf8')
    } catch {
      continue // file may not exist in every branch; skip rather than fail spuriously
    }
    for (const c of callables(src)) {
      total++
      if (!/enforceAppCheck:\s*APP_CHECK_ENFORCED/.test(c.head)) {
        missing.push(`${rel} → ${c.name}`)
      }
    }
  }
  assert.ok(total >= 15, `expected to scan the callable surface, only found ${total}`)
  assert.deepEqual(missing, [], `callables missing App Check enforcement:\n  ${missing.join('\n  ')}`)
})

test('the community callable files import the enforcement switch', () => {
  for (const rel of ['functions/src/community.ts', 'functions/src/communityGroups.ts', 'functions/src/communityModeration.ts', 'functions/src/communityMetrics.ts']) {
    const src = readFileSync(join(root, rel), 'utf8')
    assert.match(src, /APP_CHECK_ENFORCED/, `${rel} should reference APP_CHECK_ENFORCED`)
  }
})
