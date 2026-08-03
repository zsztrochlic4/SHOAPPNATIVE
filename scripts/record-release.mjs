/**
 * Production release attestation (audit SA-015).
 *
 *   node scripts/record-release.mjs [--tag <label>]
 *
 * The prior audit flagged that deployment lineage was unproven: the deployed
 * rules/functions revision existed only in an ephemeral GitHub step summary, so
 * nothing tied a release to the exact reviewed source. This writes a COMMITTED,
 * verifiable attestation record — the git SHA plus content hashes of the exact
 * files that define the trust boundary (security rules, functions source,
 * firebase config) — to docs/RELEASE_ATTESTATION.json.
 *
 * Run it as part of a deploy (after `firebase deploy`); commit the updated JSON.
 * A reviewer can then re-hash the same files at that SHA and confirm the deployed
 * artefacts match the reviewed source. Cross-platform, no external deps.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { resolve, join, relative } from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const OUT = join(ROOT, 'docs', 'RELEASE_ATTESTATION.json')

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

function hashFile(rel) {
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) return null
  return sha256(readFileSync(abs))
}

/** Recursively hash every file under a dir into one stable digest (sorted paths). */
function hashTree(relDir) {
  const absDir = join(ROOT, relDir)
  if (!existsSync(absDir)) return null
  const files = []
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const abs = join(dir, name)
      const st = statSync(abs)
      if (st.isDirectory()) {
        if (name === 'node_modules' || name === 'lib' || name === '.git') continue
        walk(abs)
      } else {
        files.push(abs)
      }
    }
  }
  walk(absDir)
  const h = createHash('sha256')
  for (const abs of files.sort()) {
    h.update(relative(ROOT, abs).replace(/\\/g, '/'))
    h.update('\0')
    h.update(readFileSync(abs))
    h.update('\0')
  }
  return { digest: h.digest('hex'), fileCount: files.length }
}

function gitSha() {
  try {
    return execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim()
  } catch {
    return process.env.GITHUB_SHA ?? 'unknown'
  }
}

const tagIdx = process.argv.indexOf('--tag')
const tag = tagIdx >= 0 ? process.argv[tagIdx + 1] : null

const attestation = {
  recordedAt: new Date().toISOString(),
  tag,
  gitSha: gitSha(),
  project: process.env.FIREBASE_PROJECT_ID ?? 'strengthhub-2ab33',
  appCheckEnforced: process.env.APPCHECK_ENFORCE === '1',
  artefacts: {
    'firestore.rules': hashFile('firestore.rules'),
    'storage.rules': hashFile('storage.rules'),
    'firestore.indexes.json': hashFile('firestore.indexes.json'),
    'firebase.json': hashFile('firebase.json'),
    'functions/src': hashTree('functions/src'),
  },
}

writeFileSync(OUT, JSON.stringify(attestation, null, 2) + '\n')
console.log(`✔ Release attestation written to ${relative(ROOT, OUT)}`)
console.log(`  git SHA: ${attestation.gitSha}`)
console.log(`  rules:   ${attestation.artefacts['firestore.rules']}`)
console.log(`  fns:     ${attestation.artefacts['functions/src']?.digest} (${attestation.artefacts['functions/src']?.fileCount} files)`)
