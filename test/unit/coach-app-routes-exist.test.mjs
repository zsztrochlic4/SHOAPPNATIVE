/**
 * Route-existence guard: every destination the coach can relay (APP_ROUTES) must name a control that
 * actually exists in the app UI source. This catches (a) a route I mislabeled — a confidently-relayed
 * WRONG path is the worst app-help failure — and (b) a future UI rename that would silently make the
 * coach send users to a control that no longer exists. If this fails, fix the label in appRoutes.ts to
 * match the real UI (then `npm run gen:app-paths`), or update the anchor here if a control was renamed.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { APP_ROUTES } from '../../.sweep-out/backend/coach/appRoutes.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const FILES = [
  'src/lib/i18n.ts', 'src/overlays/index.tsx', 'src/overlays/extra.tsx', 'src/components/CoachMemoryView.tsx',
  'src/screens/Dashboard.tsx', 'src/screens/Workout.tsx', 'src/screens/Nutrition.tsx', 'src/screens/ActiveWorkout.tsx',
  'src/screens/Community.tsx', 'src/community/groups.tsx', 'src/community/LeagueScreen.tsx', 'src/community/UsernameSetup.tsx',
  'src/community/GlobalLeaderboard.tsx', 'src/nav.tsx', 'src/screens/Progress.tsx',
]
let src = ''
for (const f of FILES) { try { src += '\n' + readFileSync(resolve(ROOT, f), 'utf8') } catch {} }
const low = src.toLowerCase()

// A distinctive anchor for routes whose `label` is too generic to grep (e.g. "menu"); otherwise the
// label itself is the anchor.
const ANCHOR = {
  menu: 'menu', 'activeWorkout.skip': 'skiprest', 'activeWorkout.finish': 'finish workout',
  quick: 'quick', community: 'community', 'community.leagues': 'league', 'workout.library': 'exercises',
}

test('every relayable route names a control that exists in the app UI source', () => {
  const missing = []
  for (const r of APP_ROUTES) {
    const a = (ANCHOR[r.id] || r.label).toLowerCase()
    if (!(low.includes(a) || low.includes(a.replace(/\s+/g, '')))) missing.push(`${r.id} ("${r.label}")`)
  }
  assert.deepEqual(missing, [], `routes whose control label is not in the UI source: ${missing.join(', ')}`)
})
