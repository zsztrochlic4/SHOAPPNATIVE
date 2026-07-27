/**
 * Dataset sync + integrity validation for the static SHO datasets (the exercise "workbook" and the
 * meal database), against the Firestore/dataset expectations contract in data/expected-counts.json.
 *
 *   node scripts/validate-data-sync.mjs
 *
 * For each dataset in the manifest it loads the live source array and checks:
 *   • COUNT     — live length matches the manifest (a drift guard: any add/remove must update the manifest)
 *   • UNIQUE    — every id is unique
 *   • REQUIRED  — every required field is present and non-empty on every row
 *   • ENUM      — enum fields only use allowed values
 *
 * Any failure fails the check (critical). This is what stops a silent dataset change from shipping
 * out of sync with what the backend/Firestore layer expects.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadArray, imgStub } from './lib/ts-array.mjs'
import { finish, ROOT } from './lib/result.mjs'

const NAME = 'data-sync'

function isEmpty(v) {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
}

function validateDataset(key, spec) {
  const source = readFileSync(resolve(ROOT, spec.source), 'utf8')
  const rows = loadArray(source, spec.export, { img: imgStub })
  const problems = []

  if (rows.length !== spec.count) {
    problems.push(
      `COUNT drift: found ${rows.length}, manifest expects ${spec.count} (update data/expected-counts.json if intended)`,
    )
  }

  const idField = spec.id_field ?? 'id'
  const seen = new Map()
  for (const [i, row] of rows.entries()) {
    const id = row?.[idField]
    if (isEmpty(id)) {
      problems.push(`row ${i}: missing ${idField}`)
      continue
    }
    if (seen.has(id)) problems.push(`duplicate ${idField}: "${id}" (rows ${seen.get(id)} and ${i})`)
    else seen.set(id, i)

    for (const f of spec.required_fields ?? []) {
      if (isEmpty(row?.[f])) problems.push(`${idField}="${id}": missing required field "${f}"`)
    }
    for (const [f, allowed] of Object.entries(spec.enum_fields ?? {})) {
      const val = row?.[f]
      if (!isEmpty(val) && !allowed.includes(val)) {
        problems.push(`${idField}="${id}": ${f}="${val}" not in [${allowed.join(', ')}]`)
      }
    }
  }

  return {
    key,
    source: spec.source,
    export: spec.export,
    count: rows.length,
    expected: spec.count,
    unique_ids: seen.size,
    ok: problems.length === 0,
    problems,
  }
}

async function main() {
  const manifest = JSON.parse(readFileSync(resolve(ROOT, 'data', 'expected-counts.json'), 'utf8'))
  const datasets = manifest.datasets ?? {}
  const reports = []
  for (const [key, spec] of Object.entries(datasets)) {
    try {
      reports.push(validateDataset(key, spec))
    } catch (e) {
      reports.push({
        key,
        source: spec.source,
        ok: false,
        problems: [`load error: ${e.message}`],
        count: 0,
        expected: spec.count,
      })
    }
  }

  const failed = reports.filter((r) => !r.ok)
  const status = failed.length ? 'fail' : 'pass'
  const summary = failed.length
    ? `${failed.length}/${reports.length} datasets out of sync: ${failed.map((r) => r.key).join(', ')}`
    : `${reports.length} datasets in sync (${reports.map((r) => `${r.key}=${r.count}`).join(', ')})`

  finish(NAME, {
    status,
    critical: true,
    summary,
    metrics: Object.fromEntries(
      reports.map((r) => [r.key, { count: r.count, expected: r.expected, unique_ids: r.unique_ids, ok: r.ok }]),
    ),
    details: { datasets: reports },
  })

  for (const r of reports) {
    console.log(`\n${r.ok ? '✅' : '❌'} ${r.key} (${r.source}#${r.export}): ${r.count}/${r.expected}`)
    for (const p of r.problems) console.log(`   - ${p}`)
  }
}

main().catch((e) => {
  console.error(e)
  finish(NAME, { status: 'fail', critical: true, summary: `harness error: ${e.message}` })
})
