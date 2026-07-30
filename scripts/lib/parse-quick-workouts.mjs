// Shared parser for the 8×12-minute bodyweight workout spreadsheet, used by both
// scripts/build-quick-workouts.mjs (bundled seed) and scripts/upload-workouts.mjs
// (Firestore). Keeping the parse in one place guarantees the bundled seed and the
// uploaded docs never diverge.
//
// Pure Node — parses the .xlsx zip's XML (inline or shared strings). No python,
// no external deps. This workbook uses INLINE strings (no sharedStrings.xml).
//
// Source sheets:
//   "Workout Overview"    — id, name, focus, level per workout
//   "Exercise Instructions" — per-exercise "Switch Sides" flag (per-side prompt)
//   "Workout Schedule"    — every station in order (round, id, name, work, rest)

import { readFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'

/** Minimal dependency-free ZIP reader (a .xlsx is a ZIP). name → Buffer. */
function readZip(path) {
  const buf = readFileSync(path)
  let eocd = -1
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error(`not a valid .xlsx/zip: ${path}`)
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  const files = {}
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break
    const method = buf.readUInt16LE(p + 10)
    const compSize = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const localOff = buf.readUInt32LE(p + 42)
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen)
    const lhNameLen = buf.readUInt16LE(localOff + 26)
    const lhExtraLen = buf.readUInt16LE(localOff + 28)
    const dataStart = localOff + 30 + lhNameLen + lhExtraLen
    const comp = buf.subarray(dataStart, dataStart + compSize)
    files[name] = method === 0 ? comp : inflateRawSync(comp)
    p += 46 + nameLen + extraLen + commentLen
  }
  return files
}

const dec = (s) =>
  String(s)
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')

const colIdx = (ref) => {
  const m = ref.match(/^([A-Z]+)/)[1]
  let n = 0
  for (const c of m) n = n * 26 + (c.charCodeAt(0) - 64)
  return n - 1
}

/** Rows → array of cell-arrays (0-indexed by column). Handles inline + shared strings. */
function sheetRows(files, ss, sheetFile) {
  const xml = (files[`xl/worksheets/${sheetFile}`] || Buffer.alloc(0)).toString('utf8')
  const rows = []
  for (const rm of xml.matchAll(/<row[^>]*>(.*?)<\/row>/gs)) {
    const cells = []
    for (const cm of rm[1].matchAll(/<c ([^>]*?)(?:\/>|>(.*?)<\/c>)/gs)) {
      const attrs = cm[1],
        body = cm[2] || ''
      const ref = (attrs.match(/r="([A-Z]+\d+)"/) || [])[1]
      const t = (attrs.match(/t="([^"]+)"/) || [])[1]
      let v = ''
      if (t === 's') v = ss[+(body.match(/<v>(.*?)<\/v>/s) || [])[1]] ?? ''
      else if (t === 'inlineStr') v = [...body.matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map((x) => x[1]).join('')
      else v = (body.match(/<v>(.*?)<\/v>/s) || [])[1] ?? ''
      if (ref) cells[colIdx(ref)] = dec(v)
    }
    rows.push(cells)
  }
  return rows
}

/** Resolve a sheet name → its worksheet xml file (e.g. sheet3.xml). */
function sheetFileFor(files, name) {
  const wb = files['xl/workbook.xml'].toString('utf8')
  const rels = files['xl/_rels/workbook.xml.rels'].toString('utf8')
  const s = [...wb.matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)].find((m) => dec(m[1]) === name)
  if (!s) throw new Error(`no "${name}" sheet`)
  // Attribute order and path prefix vary by writer (Id may come after Target;
  // Target may be "/xl/worksheets/sheet1.xml" or "worksheets/sheet1.xml").
  const rel = (rels.match(new RegExp(`<Relationship\\b[^>]*\\bId="${s[2]}"[^>]*/>`)) || [])[0]
  const target = rel && (rel.match(/Target="[^"]*worksheets\/([^"]+)"/) || [])[1]
  if (!target) throw new Error(`no rel target for "${name}"`)
  return target
}

// Beginner → advanced display order. The sheet levels are Beginner/Intermediate
// only; beginners lead, then intermediates, ending on the hardest.
const DISPLAY_ORDER = ['BW12-01', 'BW12-02', 'BW12-04', 'BW12-03', 'BW12-05', 'BW12-06', 'BW12-07', 'BW12-08']

/** "35 sec (5-6 reps/side)" → { workSec: 35, repHint: '5-6 reps/side' }. */
function parseWorkingTime(raw) {
  const s = String(raw || '').trim()
  const sec = (s.match(/(\d+)\s*sec/i) || [])[1]
  const paren = (s.match(/\(([^)]*)\)/) || [])[1]
  return { workSec: sec ? +sec : 0, repHint: paren ? paren.trim() : undefined }
}
const parseSec = (raw) => {
  const m = String(raw || '').match(/(\d+)\s*sec/i)
  return m ? +m[1] : 0
}

/**
 * Parse the workbook → { workouts, problems }.
 * workouts: [{ id, name, level, order, focus, minutes, rounds:[{round,build,roundRestSec,stations:[...]}] }]
 * station:  { exerciseId, name, workSec, restSec, repHint?, perSide? }
 */
export function readQuickWorkouts(xlsxPath) {
  const files = readZip(xlsxPath)
  let ss = []
  const sb = files['xl/sharedStrings.xml']
  if (sb)
    ss = [...sb.toString('utf8').matchAll(/<si>(.*?)<\/si>/gs)].map((m) =>
      [...m[1].matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map((x) => x[1]).join(''),
    )

  const problems = []

  // --- Workout Overview → meta (name, focus, level) keyed by id ---
  const ov = sheetRows(files, ss, sheetFileFor(files, 'Workout Overview'))
  const ovHdr = ov.findIndex((r) => (r || []).includes('Workout ID'))
  const OVH = {}
  if (ovHdr >= 0)
    ov[ovHdr].forEach((n, i) => {
      if (n) OVH[n.trim()] = i
    })
  const meta = {}
  for (let i = ovHdr + 1; i < ov.length; i++) {
    const r = ov[i] || []
    const id = (r[OVH['Workout ID']] || '').trim()
    if (!/^BW12-\d+/.test(id)) continue
    meta[id] = {
      name: (r[OVH['Workout Name']] || '').trim(),
      focus: (r[OVH['Focus']] || '').trim(),
      level: (r[OVH['Level']] || '').trim(),
    }
  }

  // --- Exercise Instructions → per-exercise "Switch Sides" flag keyed by id ---
  const ins = sheetRows(files, ss, sheetFileFor(files, 'Exercise Instructions'))
  const insHdr = ins.findIndex((r) => (r || []).includes('Exercise ID'))
  const INH = {}
  if (insHdr >= 0)
    ins[insHdr].forEach((n, i) => {
      if (n) INH[n.trim()] = i
    })
  const perSideById = {}
  for (let i = insHdr + 1; i < ins.length; i++) {
    const r = ins[i] || []
    const id = (r[INH['Exercise ID']] || '').trim()
    if (!id) continue
    perSideById[id] = /^y/i.test((r[INH['Switch Sides']] || '').trim())
  }

  // --- Workout Schedule → ordered stations → rounds ---
  const sc = sheetRows(files, ss, sheetFileFor(files, 'Workout Schedule'))
  const scHdr = sc.findIndex((r) => (r || []).includes('Workout ID') && (r || []).includes('Order'))
  const SCH = {}
  if (scHdr >= 0)
    sc[scHdr].forEach((n, i) => {
      if (n) SCH[n.trim()] = i
    })
  const get = (r, k) => (SCH[k] != null ? String((r || [])[SCH[k]] ?? '').trim() : '')

  const byId = {}
  for (let i = scHdr + 1; i < sc.length; i++) {
    const r = sc[i]
    const wid = get(r, 'Workout ID')
    if (!/^BW12-\d+/.test(wid)) continue
    const roundNo = +get(r, 'Round') || 1
    const exId = get(r, 'Exercise ID')
    const exName = get(r, 'Exercise')
    const w = (byId[wid] ??= { rounds: {} })
    const round = (w.rounds[roundNo] ??= { round: roundNo, build: roundNo === 1, stations: [], roundRestSec: 0 })
    if (exId === 'REST') {
      round.roundRestSec = parseSec(get(r, 'Rest'))
      continue
    }
    const { workSec, repHint } = parseWorkingTime(get(r, 'Working Time'))
    const st = { exerciseId: exId, name: exName, workSec, restSec: parseSec(get(r, 'Rest')) }
    if (repHint) st.repHint = repHint
    if (perSideById[exId] || /\/\s*side/i.test(get(r, 'Working Time'))) st.perSide = true
    round.stations.push(st)
  }

  const workouts = []
  for (const id of DISPLAY_ORDER) {
    const built = byId[id]
    const m = meta[id]
    if (!built || !m) {
      problems.push(`missing workout ${id}`)
      continue
    }
    const rounds = Object.values(built.rounds).sort((a, b) => a.round - b.round)
    // The final round carries no round-rest (workout ends after it).
    if (rounds.length) rounds[rounds.length - 1].roundRestSec = 0
    workouts.push({
      id,
      name: m.name,
      level: m.level,
      order: DISPLAY_ORDER.indexOf(id) + 1,
      focus: m.focus,
      minutes: 12,
      rounds: rounds.map((r) => ({
        round: r.round,
        ...(r.build ? { build: true } : {}),
        ...(r.roundRestSec ? { roundRestSec: r.roundRestSec } : {}),
        stations: r.stations,
      })),
    })
  }
  // Ids present in the sheet but not in DISPLAY_ORDER would be silently dropped — flag it.
  for (const id of Object.keys(byId))
    if (!DISPLAY_ORDER.includes(id)) problems.push(`workout ${id} not in DISPLAY_ORDER`)

  return { workouts, problems }
}
