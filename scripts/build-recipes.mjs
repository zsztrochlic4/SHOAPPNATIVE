#!/usr/bin/env node
// Build the app's bundled recipe seed from the recipe spreadsheet.
//
//   npm run recipes:build                    # reads data/recipes/StrengthHub_Recipe_Template.xlsx
//   node scripts/build-recipes.mjs --file "C:/path/to/your.xlsx"
//
// Output: src/data/recipes.generated.ts — the app's offline/first-load recipe set
// (and the fallback when Firestore is unavailable). Regenerate whenever you edit
// the spreadsheet, then commit the result. Uses the shared parser so the bundled
// seed and the Firestore upload can never diverge.

import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readWorkbook, countByCategory } from './lib/parse-recipes.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d }
const XLSX = arg('file', join(repoRoot, 'data', 'recipes', 'StrengthHub_Recipe_Template.xlsx'))
const OUT = join(repoRoot, 'src', 'data', 'recipes.generated.ts')

const { recipes, problems } = readWorkbook(XLSX)
if (problems.length) { console.error('✖ recipe problems:\n  ' + problems.join('\n  ')); process.exit(1) }

const byCat = countByCategory(recipes)
const header = `// GENERATED FILE — do not edit by hand.
// Source: data/recipes/StrengthHub_Recipe_Template.xlsx
// Regenerate: npm run recipes:build
// ${recipes.length} recipes — ${Object.entries(byCat).map(([k, v]) => `${k}:${v}`).join(' · ')}
import type { BudgetMeal } from '../store/types'

export const BUDGET_MEALS_SEED: BudgetMeal[] = ${JSON.stringify(recipes, null, 2)}
`
writeFileSync(OUT, header)
console.log(`✔ wrote ${recipes.length} recipes → src/data/recipes.generated.ts`)
console.log(`  ${Object.entries(byCat).map(([k, v]) => `${k}:${v}`).join('  ')}`)
