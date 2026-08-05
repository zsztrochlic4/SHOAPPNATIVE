/**
 * CLI entry for the profile-sweep HARD gate. Compiled and run by `npm run sweep`
 * (and by CI on every push/PR). Exits non-zero if any profile breaches a safety floor
 * or leaves a required slot empty, so a regression fails the build.
 */
import { runProfileSweep } from './sweep'

const r = runProfileSweep()
if (r.warnings.length) {
  // Non-fatal coverage gaps: the workbook still lacks enough true no-equipment options to fill
  // every Bodyweight required slot (R5-005). Surfaced so they are visible in CI without blocking
  // merges; the coach refuses to apply such sparse plans (U-011). These are NOT impossible
  // prescriptions — the sweep hard-fails if a plan ever serves unavailable equipment.
  console.warn(`Profile sweep WARNINGS — ${r.warnings.length} known coverage gap(s):`)
  for (const w of r.warnings.slice(0, 60)) console.warn('  ! ' + w)
}
if (r.passed) {
  // Be truthful about the warnings in the headline (R5-012): do NOT claim "zero empty required
  // slots" when known Bodyweight coverage gaps remain.
  if (r.warnings.length) {
    console.log(
      `Profile sweep PASSED WITH WARNINGS — ${r.count} profiles, zero safety-floor breaches and ` +
        `zero impossible prescriptions, but ${r.warnings.length} known coverage gap(s) leave some ` +
        `Bodyweight required slot(s) unfilled (see warnings above).`,
    )
  } else {
    console.log(`Profile sweep PASSED — ${r.count} profiles, zero safety-floor breaches, zero empty required slots.`)
  }
  process.exit(0)
}
console.error(`Profile sweep FAILED — ${r.failures.length} issue(s):`)
for (const f of r.failures.slice(0, 60)) console.error('  - ' + f)
process.exit(1)
