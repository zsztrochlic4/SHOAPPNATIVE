/**
 * Consistency guard: data/app-paths.json (the eval catalogue the lint/judge score against) is GENERATED
 * from the runtime route table src/backend/coach/appRoutes.ts. This test fails if they drift — e.g. a
 * route was changed in appRoutes.ts without running `npm run gen:app-paths`, or the JSON was hand-edited.
 * Keeping them in lock-step means the scorers can never grade against a stale map.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { APP_ROUTES } from '../../.sweep-out/backend/coach/appRoutes.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const catalogue = JSON.parse(readFileSync(resolve(ROOT, 'data', 'app-paths.json'), 'utf8'))

test('catalogue is marked generated (never hand-edited)', () => {
  assert.equal(catalogue._meta?.generated, true, 'run: npm run gen:app-paths')
})

test('catalogue destinations are byte-in-step with appRoutes.ts', () => {
  assert.equal(catalogue.destinations.length, APP_ROUTES.length, 'destination count drifted — run: npm run gen:app-paths')
  for (let i = 0; i < APP_ROUTES.length; i++) {
    const src = APP_ROUTES[i]
    const cat = catalogue.destinations[i]
    assert.equal(cat.id, src.id, `id drift at ${i}`)
    assert.equal(cat.label, src.label, `label drift for ${src.id}`)
    assert.equal(cat.route, src.route, `route drift for ${src.id}`)
    assert.deepEqual(cat.serves, src.serves, `serves drift for ${src.id}`)
  }
})

test('every route label appears in knownControls (lint can recognise it)', () => {
  const known = new Set(catalogue.knownControls)
  for (const r of APP_ROUTES) {
    assert.ok(known.has(r.label), `knownControls missing label "${r.label}" — run: npm run gen:app-paths`)
  }
})
