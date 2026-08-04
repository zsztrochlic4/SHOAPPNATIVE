/**
 * CLI entry for the profile-sweep HARD gate. Compiled and run by `npm run sweep`
 * (and by CI on every push/PR). Exits non-zero if any profile breaches a safety floor
 * or leaves a required slot empty, so a regression fails the build.
 */
import { runProfileSweep } from './sweep'

const r = runProfileSweep()
if (r.warnings.length) {
  // Non-fatal coverage gaps (e.g. the known Bodyweight equipment-taxonomy defect, R4-004). Surfaced
  // so they are visible in CI without blocking merges; the coach refuses to apply such plans (U-011).
  console.warn(`Profile sweep WARNINGS — ${r.warnings.length} known coverage gap(s):`)
  for (const w of r.warnings.slice(0, 60)) console.warn('  ! ' + w)
}
if (r.passed) {
  console.log(`Profile sweep PASSED — ${r.count} profiles, zero safety-floor breaches, zero empty required slots.`)
  process.exit(0)
}
console.error(`Profile sweep FAILED — ${r.failures.length} issue(s):`)
for (const f of r.failures.slice(0, 60)) console.error('  - ' + f)
process.exit(1)
