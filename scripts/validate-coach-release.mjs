#!/usr/bin/env node
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const manifest = JSON.parse(read('config/coach-release.json'))
const gate = read('src/backend/coach/coachGate.ts')
const workflow = read('.github/workflows/web-preview.yml')
const releaseDoc = read('docs/COACH_RELEASE_STATE.md')

const failures = []
const prod = manifest.production ?? {}
if (manifest.schemaVersion !== 1) failures.push('unsupported manifest schema')
if (prod.availability !== 'disabled' || prod.releaseChannel !== 'disabled')
  failures.push('production must fail closed while gates are unsigned')
for (const field of ['exactCommit', 'holdoutDigest', 'clinicalSignoff', 'professionalSignoff', 'killSwitchDrillAt']) {
  if (prod[field] != null) failures.push(`${field} must remain null until verified evidence is recorded`)
}
for (const field of ['appCheckEnforced', 'privacyDeclarationApproved', 'storeDeclarationApproved']) {
  if (prod[field] !== false) failures.push(`${field} must remain false until verified evidence is recorded`)
}
if (!gate.includes("EXPO_PUBLIC_COACH_RELEASE_CHANNEL === 'internal'") || !gate.includes(": 'disabled'"))
  failures.push('coach gate is not environment-scoped and default-off')
if (/EXPO_PUBLIC_COACH_RELEASE_CHANNEL:\s*internal/.test(workflow))
  failures.push('web deploy must not promote the internal coach channel')
if (!/Current release state:\s*DISABLED/i.test(releaseDoc))
  failures.push('release record does not declare production disabled')

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`)
  process.exit(1)
}
console.log('PASS: coach production release manifest is disabled and fail-closed')
