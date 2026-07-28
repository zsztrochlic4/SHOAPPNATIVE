// Shared recipe-spreadsheet parser used by both scripts/build-recipes.mjs
// (bundled seed) and scripts/upload-recipes.mjs (Firestore). Keeping the parse
// in one place guarantees the bundled seed and the uploaded docs never diverge.
//
// Pure Node — parses the .xlsx zip's XML (inline or shared strings). No python.

import { readFileSync, mkdtempSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CATEGORIES = new Set(['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Sweet'])

function unzipTo(file) {
  const dir = mkdtempSync(join(tmpdir(), 'xlsx-'))
  execFileSync('unzip', ['-o', '-q', file, '-d', dir])
  return dir
}
const dec = (s) => String(s)
  .replace(/&#x([0-9A-Fa-f]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
function colToIdx(ref) { const m = ref.match(/^([A-Z]+)/)[1]; let n = 0; for (const c of m) n = n * 26 + (c.charCodeAt(0) - 64); return n - 1 }
function sheetRows(dir, sheetFile) {
  let ss = []
  try {
    const sx = readFileSync(join(dir, 'xl', 'sharedStrings.xml'), 'utf8')
    ss = [...sx.matchAll(/<si>(.*?)<\/si>/gs)].map((m) => [...m[1].matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map((x) => x[1]).join(''))
  } catch { /* inline strings only */ }
  const xml = readFileSync(join(dir, 'xl', 'worksheets', sheetFile), 'utf8')
  const rows = []
  for (const rm of xml.matchAll(/<row[^>]*>(.*?)<\/row>/gs)) {
    const cells = []
    for (const cm of rm[1].matchAll(/<c ([^>]*?)(?:\/>|>(.*?)<\/c>)/gs)) {
      const attrs = cm[1], body = cm[2] || ''
      const ref = (attrs.match(/r="([A-Z]+\d+)"/) || [])[1]
      const t = (attrs.match(/t="([^"]+)"/) || [])[1]
      let v = ''
      if (t === 's') v = ss[+(body.match(/<v>(.*?)<\/v>/s) || [])[1]] ?? ''
      else if (t === 'inlineStr') v = [...body.matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map((x) => x[1]).join('')
      else v = (body.match(/<v>(.*?)<\/v>/s) || [])[1] ?? ''
      if (ref) cells[colToIdx(ref)] = dec(v)
    }
    rows.push(cells)
  }
  return rows
}
function sheetFileFor(dir, name, fallback) {
  const wb = readFileSync(join(dir, 'xl', 'workbook.xml'), 'utf8')
  const rels = readFileSync(join(dir, 'xl', '_rels', 'workbook.xml.rels'), 'utf8')
  const s = [...wb.matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)].find((m) => m[1] === name)
  const target = s && (rels.match(new RegExp(`Id="${s[2]}"[^>]*Target="worksheets/([^"]+)"`)) || [])[1]
  return target || fallback
}

const num = (v) => { const n = parseInt(String(v ?? '').replace(/[^\d.-]/g, ''), 10); return Number.isFinite(n) ? n : 0 }
const lines = (v) => String(v ?? '').split('\n').map((s) => s.trim()).filter(Boolean)
const semis = (v) => String(v ?? '').split(';').map((s) => s.trim()).filter(Boolean)
const slug = (s) => 'bm-' + String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
const FALLBACK_IMG = {
  Breakfast: 'https://images.pexels.com/photos/704971/pexels-photo-704971.jpeg?auto=compress&cs=tinysrgb&w=600',
  Lunch: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=600',
  Dinner: 'https://images.pexels.com/photos/3763847/pexels-photo-3763847.jpeg?auto=compress&cs=tinysrgb&w=600',
  Snack: 'https://images.pexels.com/photos/1099680/pexels-photo-1099680.jpeg?auto=compress&cs=tinysrgb&w=600',
  Sweet: 'https://images.pexels.com/photos/1099680/pexels-photo-1099680.jpeg?auto=compress&cs=tinysrgb&w=600',
}

function toRecipe(r) {
  const name = (r[0] || '').trim()
  const category = (r[1] || '').trim()
  if (!name || !CATEGORIES.has(category)) return null
  const tags = semis(r[9])
  const vegan = (r[16] || '').trim().toLowerCase() === 'vegan' || tags.some((t) => t.toLowerCase() === 'vegan')
  const rec = {
    id: (r[13] || '').trim() || slug(name),
    name,
    image: (r[14] || '').trim() || FALLBACK_IMG[category],
    category,
    minutes: num(r[2]),
    serves: num(r[3]) || 1,
    kcal: num(r[4]),
    p: num(r[5]),
    c: num(r[6]),
    f: num(r[7]),
    ingredients: lines(r[10]),
    steps: lines(r[11]),
    tags,
  }
  const flavour = (r[8] || '').trim(); if (flavour) rec.flavour = flavour
  const cookOnce = (r[12] || '').trim(); if (cookOnce) rec.cookOnce = cookOnce
  const timeDisplay = (r[15] || '').trim(); if (timeDisplay) rec.timeDisplay = timeDisplay
  if (vegan) rec.vegan = true
  return rec
}

/** Parse the workbook → { recipes, deprecations, problems }. */
export function readWorkbook(xlsxPath) {
  const dir = unzipTo(xlsxPath)
  const recRows = sheetRows(dir, sheetFileFor(dir, 'Recipes', 'sheet2.xml'))
  const recipes = recRows.slice(1).map(toRecipe).filter(Boolean)

  // Deprecations tab: [Firebase id, Recipe name, Category, Decision, Replacement]
  let deprecations = []
  try {
    const depRows = sheetRows(dir, sheetFileFor(dir, 'Firebase Deprecations', 'sheet3.xml'))
    deprecations = depRows
      .map((r) => ({ id: (r[0] || '').trim(), name: (r[1] || '').trim(), category: (r[2] || '').trim(), decision: (r[3] || '').trim(), replacement: (r[4] || '').trim() }))
      .filter((d) => /^bm-/.test(d.id))
  } catch { /* no deprecations tab */ }

  const seen = new Set(); const problems = []
  for (const r of recipes) {
    if (seen.has(r.id)) problems.push(`duplicate id ${r.id}`); seen.add(r.id)
    if (!r.ingredients.length) problems.push(`${r.id}: no ingredients`)
    if (!r.steps.length) problems.push(`${r.id}: no steps`)
  }
  return { recipes, deprecations, problems }
}

export function countByCategory(recipes) {
  const by = {}
  for (const r of recipes) by[r.category] = (by[r.category] || 0) + 1
  return by
}
