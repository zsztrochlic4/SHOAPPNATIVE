#!/usr/bin/env node
// Build the app's bundled 12-minute quick-workout seed from the workout spreadsheet.
//
//   npm run workouts:build                   # reads data/quick-workouts/8x12min.xlsx
//   node scripts/build-quick-workouts.mjs --file "C:/path/to/your.xlsx"
//
// Output: src/data/quickWorkouts.generated.ts — the app's offline/first-load set for
// the "12-Minute Bodyweight Exercises" section (QuickWorkoutsSheet). Regenerate
// whenever you edit the spreadsheet, then commit the result. Uses the shared parser
// so the bundled seed and the Firestore upload can never diverge.

import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readQuickWorkouts } from './lib/parse-quick-workouts.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d
}
const XLSX = arg('file', join(repoRoot, 'data', 'quick-workouts', '8x12min.xlsx'))
const OUT = join(repoRoot, 'src', 'data', 'quickWorkouts.generated.ts')

const { workouts, problems } = readQuickWorkouts(XLSX)
if (problems.length) {
  console.error('✖ workout problems:\n  ' + problems.join('\n  '))
  process.exit(1)
}

const header = `// GENERATED FILE — do not edit by hand.
// Source: data/quick-workouts/8x12min.xlsx
// Regenerate: npm run workouts:build
// ${workouts.length} workouts (beginner → advanced): ${workouts.map((w) => `${w.name} [${w.level}]`).join(' · ')}
import type { QuickWorkout } from '../store/types'

export const QUICK_WORKOUTS_SEED: QuickWorkout[] = ${JSON.stringify(workouts, null, 2)}
`
writeFileSync(OUT, header)
console.log(`✔ wrote ${workouts.length} quick workouts → src/data/quickWorkouts.generated.ts`)
for (const w of workouts)
  console.log(`  ${w.order}. ${w.name}  [${w.level}]  ${w.rounds.length} rounds × ${w.rounds[0].stations.length}`)
