// Parse the editable EXERCISE INFO fields from the workbook's "Exercise Database"
// sheet. Used by scripts/upload-exercises.mjs. Pure Node (zlib zip reader) — no
// python, no external deps. Reads by header NAME so column order can change.

import { readFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'

function readZip(path) {
  const buf = readFileSync(path)
  let e = -1
  for (let i = buf.length - 22; i >= 0; i--) { if (buf.readUInt32LE(i) === 0x06054b50) { e = i; break } }
  if (e < 0) throw new Error(`not a valid .xlsx: ${path}`)
  const n = buf.readUInt16LE(e + 10)
  let p = buf.readUInt32LE(e + 16)
  const f = {}
  for (let k = 0; k < n; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break
    const meth = buf.readUInt16LE(p + 10), cs = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28)
    const el = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), lo = buf.readUInt32LE(p + 42)
    const nm = buf.toString('utf8', p + 46, p + 46 + nl)
    const lnl = buf.readUInt16LE(lo + 26), lel = buf.readUInt16LE(lo + 28), ds = lo + 30 + lnl + lel
    const comp = buf.subarray(ds, ds + cs)
    f[nm] = meth === 0 ? comp : inflateRawSync(comp)
    p += 46 + nl + el + cl
  }
  return f
}
const dec = (s) => String(s)
  .replace(/&#x([0-9A-Fa-f]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
const colIdx = (r) => { const m = r.match(/^([A-Z]+)/)[1]; let n = 0; for (const c of m) n = n * 26 + (c.charCodeAt(0) - 64); return n - 1 }

function sheetRows(files, ss, sheetFile) {
  const xml = (files[`xl/worksheets/${sheetFile}`] || Buffer.alloc(0)).toString('utf8')
  const rows = []
  for (const rm of xml.matchAll(/<row[^>]*>(.*?)<\/row>/gs)) {
    const c = []
    for (const cm of rm[1].matchAll(/<c ([^>]*?)(?:\/>|>(.*?)<\/c>)/gs)) {
      const a = cm[1], b = cm[2] || ''
      const ref = (a.match(/r="([A-Z]+\d+)"/) || [])[1]
      const t = (a.match(/t="([^"]+)"/) || [])[1]
      let v = ''
      if (t === 's') v = ss[+(b.match(/<v>(.*?)<\/v>/s) || [])[1]] ?? ''
      else if (t === 'inlineStr') v = [...b.matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map((x) => x[1]).join('')
      else v = (b.match(/<v>(.*?)<\/v>/s) || [])[1] ?? ''
      if (ref) c[colIdx(ref)] = dec(v)
    }
    rows.push(c)
  }
  return rows
}

/** Parse the workbook → array of exercise INFO records. */
export function readExerciseInfo(xlsxPath) {
  const files = readZip(xlsxPath)
  let ss = []
  const sb = files['xl/sharedStrings.xml']
  if (sb) ss = [...sb.toString('utf8').matchAll(/<si>(.*?)<\/si>/gs)].map((m) => [...m[1].matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map((x) => x[1]).join(''))
  const wb = files['xl/workbook.xml'].toString('utf8'), rels = files['xl/_rels/workbook.xml.rels'].toString('utf8')
  const s = [...wb.matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)].find((m) => m[1] === 'Exercise Database')
  if (!s) throw new Error('no "Exercise Database" sheet')
  const target = (rels.match(new RegExp(`Id="${s[2]}"[^>]*Target="worksheets/([^"]+)"`)) || [])[1]
  const rows = sheetRows(files, ss, target)

  // Locate the header row (contains "ID" and "Exercise") and map header → index.
  let hdr = rows.findIndex((r) => (r || []).includes('ID') && (r || []).includes('Exercise'))
  if (hdr < 0) throw new Error('could not find header row')
  const H = {}
  rows[hdr].forEach((name, i) => { if (name) H[name.trim()] = i })
  const get = (row, name) => (H[name] != null ? String(row[H[name]] ?? '').trim() : '')

  const out = []
  for (let i = hdr + 1; i < rows.length; i++) {
    const r = rows[i]
    const id = get(r, 'ID')
    const name = get(r, 'Exercise')
    if (!id || !name) continue
    const steps = ['Step 1', 'Step 2', 'Step 3'].map((k) => get(r, k)).filter(Boolean)
    out.push({
      id,
      name,
      muscleGroup: get(r, 'Muscle Group'),
      skillLevel: get(r, 'Skill Level'),
      whyInDatabase: get(r, 'Why It Is In The Database'),
      whatItDoes: get(r, 'What It Does'),
      steps,
      commonMistake: get(r, 'Common Mistake'),
      safetyNote: get(r, 'Safety Note'),
    })
  }
  return out
}
