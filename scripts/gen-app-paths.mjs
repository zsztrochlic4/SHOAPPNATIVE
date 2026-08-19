/**
 * Generate data/app-paths.json (the eval catalogue the lint/judge score against) FROM the runtime route
 * table src/backend/coach/appRoutes.ts, so the two can never drift. appRoutes.ts is the single source of
 * truth; this derives the catalogue's destinations, and a knownControls list mined from the labels and
 * the route breadcrumbs, plus the fixed tabs. Run: `npm run gen:app-paths` (compiles the sweep build
 * first so it can import the compiled module).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { APP_ROUTES } = await import(`file:///${ROOT}/.sweep-out/backend/coach/appRoutes.js`)

const TABS = ['Dashboard', 'Workout', 'Coach', 'Nutrition', 'Community']

// knownControls = every route label + every breadcrumb segment of every route (stripping parentheticals
// and the leading tab/menu), so the existence lint recognises any real control the coach might name.
const controls = new Set(TABS)
for (const r of APP_ROUTES) {
  controls.add(r.label)
  for (const seg of String(r.route).split('›')) {
    const c = seg.replace(/\(.*?\)/g, '').trim()
    if (c && c.length <= 40 && !/^(tap|the |top left|top right|›)/i.test(c)) controls.add(c)
  }
}

const out = {
  _meta: {
    purpose:
      'GENERATED from src/backend/coach/appRoutes.ts by scripts/gen-app-paths.mjs — do not hand-edit. The runtime route table is the single source of truth; this is the eval catalogue the app-path lint/judge score against. Regenerate with `npm run gen:app-paths` after changing appRoutes.ts.',
    generated: true,
    version: 3,
  },
  tabs: TABS,
  overlays: [...new Set(APP_ROUTES.map((r) => r.id))],
  destinations: APP_ROUTES.map((r) => ({ id: r.id, label: r.label, route: r.route, serves: r.serves })),
  knownControls: [...controls].sort(),
}
writeFileSync(resolve(ROOT, 'data', 'app-paths.json'), JSON.stringify(out, null, 2) + '\n')
console.log(`generated data/app-paths.json: ${out.destinations.length} destinations, ${out.knownControls.length} known controls`)
