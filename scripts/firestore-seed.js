/**
 * Firestore seed + schema validation (CommonJS so it runs under plain `node scripts/firestore-seed.js`).
 *
 * Two responsibilities:
 *   1. SCHEMA — build a canonical `users` document (matching src/backend/schema.ts UserDoc) and validate
 *      it field-by-field. A schema failure is always a hard, critical failure.
 *   2. CONNECT — if firebase-admin is installed AND a connection is configured (Firestore emulator OR
 *      service-account credentials), connect and do a write + read-back round-trip against a fixed
 *      `_validation/connectivity` probe document (idempotent set(), no deletes).
 *
 * Connection config (first that applies wins):
 *   • FIRESTORE_EMULATOR_HOST=localhost:8080         → emulator, no credentials needed
 *   • GOOGLE_APPLICATION_CREDENTIALS=/path/sa.json    → service-account file
 *   • FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY → split-field credentials
 *
 * If firebase-admin is not installed, or no connection is configured, the CONNECT step is a 'skip'
 * (schema is still validated). Set REQUIRE_FIRESTORE=1 to turn a skipped/failed connection into a hard
 * failure (use this in the scheduled run once secrets are wired).
 *
 * Writes results/parts/firestore-seed.json for the aggregator.
 */
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const PARTS_DIR = path.resolve(ROOT, 'results', 'parts')
const NAME = 'firestore-seed'

/* --------------------------- result part I/O --------------------------- */
function writePart(result) {
  fs.mkdirSync(PARTS_DIR, { recursive: true })
  const part = Object.assign({ name: NAME, finished_at: new Date().toISOString() }, result)
  fs.writeFileSync(path.resolve(PARTS_DIR, `${NAME}.json`), JSON.stringify(part, null, 2))
  const icon = part.status === 'pass' ? '✅' : part.status === 'skip' ? '⏭️' : '❌'
  console.log(`\n${icon} [${NAME}] ${part.status.toUpperCase()} — ${part.summary}`)
  const gh = process.env.GITHUB_STEP_SUMMARY
  if (gh) {
    try {
      fs.appendFileSync(gh, `${icon} **${NAME}** — ${part.status.toUpperCase()}: ${part.summary}\n`)
    } catch (_) {}
  }
  if (part.status === 'fail' && part.critical) process.exitCode = 1
}

/* --------------------------- canonical seed doc --------------------------- */
// Mirrors src/backend/schema.ts UserDoc (BACKEND_SCHEMA_VERSION = 1).
function canonicalUser() {
  const now = new Date().toISOString()
  return {
    uid: '_seed_validation_user',
    display_name: 'Seed Validation',
    date_of_birth: '2000-01-01',
    age_verified: true,
    sex: 'other',
    height_cm: 175,
    weight_kg: 75,
    goal_weight_kg: 72,
    experience: 'Beginner',
    goal: 'General Fitness',
    followed_structured_program: false,
    focal_points: ['Chest', 'Back'],
    days_available: ['Monday', 'Wednesday', 'Friday'],
    session_length_min: 60,
    equipment_tier: 'Full Gym',
    equipment_tags: ['barbell', 'dumbbell'],
    trains_alone: 'sometimes',
    excluded_exercise_ids: [],
    preferred_exercise_ids: [],
    affected_regions: [],
    commitments: [],
    screening: {
      version: 'adult_v1',
      outcome: 'CLEAR',
      answers: { q1: false, q2: false, q3: false, q4: false, q5: false, q6: false, q7: false },
      followups: {},
      guardian_consent: false,
      clearance_confirmed: false,
      date: now.slice(0, 10),
      conditions: [],
      waiver_accepted: true,
    },
    diet: ['no_restrictions'],
    tight_budget: false,
    motivation: 'Stay healthy at uni',
    notes: null,
    planned_absences: [],
    created_at: now,
    schema_version: 1,
  }
}

/* --------------------------- schema validation --------------------------- */
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const GOALS = ['Hypertrophy', 'Fat Loss', 'Strength', 'General Fitness']
const EXPERIENCE = ['Beginner', 'Intermediate', 'Advanced']
const TIERS = ['Full Gym', 'Basic Gym', 'Bodyweight']
const SEX = ['male', 'female', 'other']
const INJURY_REGIONS = ['lower_back', 'knee', 'shoulder', 'wrist', 'hip', 'ankle']
const SCREENING_OUTCOMES = ['CLEAR', 'MODIFY_AND_CONTINUE', 'REQUIRE_PROFESSIONAL_CLEARANCE', 'DO_NOT_GENERATE']

function validateUserDoc(u) {
  const p = []
  const str = (f) => {
    if (typeof u[f] !== 'string' || !u[f]) p.push(`${f} must be a non-empty string`)
  }
  const num = (f) => {
    if (typeof u[f] !== 'number' || Number.isNaN(u[f])) p.push(`${f} must be a number`)
  }
  const bool = (f) => {
    if (typeof u[f] !== 'boolean') p.push(`${f} must be a boolean`)
  }
  const arr = (f) => {
    if (!Array.isArray(u[f])) p.push(`${f} must be an array`)
  }
  const oneOf = (f, set) => {
    if (!set.includes(u[f])) p.push(`${f}="${u[f]}" not in [${set.join(', ')}]`)
  }

  str('uid')
  str('display_name')
  if (u.date_of_birth !== null && !/^\d{4}-\d{2}-\d{2}$/.test(u.date_of_birth))
    p.push('date_of_birth must be null or YYYY-MM-DD')
  bool('age_verified')
  if (u.sex !== null) oneOf('sex', SEX)
  num('height_cm')
  num('weight_kg')
  num('goal_weight_kg')
  num('session_length_min')
  oneOf('experience', EXPERIENCE)
  oneOf('goal', GOALS)
  oneOf('equipment_tier', TIERS)
  arr('focal_points')
  if (Array.isArray(u.focal_points) && u.focal_points.length > 2) p.push('focal_points: max 2')
  arr('days_available')
  if (Array.isArray(u.days_available) && !u.days_available.every((d) => WEEKDAYS.includes(d)))
    p.push('days_available has an invalid weekday')
  arr('equipment_tags')
  arr('excluded_exercise_ids')
  arr('preferred_exercise_ids')
  arr('affected_regions')
  if (Array.isArray(u.affected_regions) && !u.affected_regions.every((r) => INJURY_REGIONS.includes(r)))
    p.push('affected_regions has an invalid region')
  arr('commitments')
  arr('diet')
  arr('planned_absences')
  bool('tight_budget')
  str('created_at')
  num('schema_version')

  if (!u.screening || typeof u.screening !== 'object') p.push('screening object missing')
  else if (!SCREENING_OUTCOMES.includes(u.screening.outcome))
    p.push(`screening.outcome="${u.screening.outcome}" invalid`)

  return p
}

/* --------------------------- connection --------------------------- */
function loadAdmin() {
  try {
    return require('firebase-admin')
  } catch (_) {
    return null
  }
}

function connectionConfig() {
  if (process.env.FIRESTORE_EMULATOR_HOST)
    return { kind: 'emulator', projectId: process.env.FIREBASE_PROJECT_ID || 'demo-sho' }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return { kind: 'application-default' }
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env
  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    return {
      kind: 'service-account',
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      // GitHub secrets store the PEM with escaped newlines; restore them.
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }
  }
  return null
}

async function tryConnect(admin, cfg, seedDoc) {
  if (cfg.kind === 'emulator') {
    admin.initializeApp({ projectId: cfg.projectId })
  } else if (cfg.kind === 'application-default') {
    admin.initializeApp({ credential: admin.credential.applicationDefault() })
  } else {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: cfg.projectId,
        clientEmail: cfg.clientEmail,
        privateKey: cfg.privateKey,
      }),
    })
  }
  const db = admin.firestore()
  const probe = db.collection('_validation').doc('connectivity')
  const stamp = {
    last_run_at: new Date().toISOString(),
    schema_version: seedDoc.schema_version,
    by: 'firestore-seed.js',
  }
  await probe.set(stamp, { merge: true })
  const snap = await probe.get()
  if (!snap.exists) throw new Error('probe write did not persist')
  const back = snap.data()
  if (back.schema_version !== seedDoc.schema_version) throw new Error('probe read-back mismatch')
  return { collection: '_validation/connectivity' }
}

/* --------------------------- main --------------------------- */
async function main() {
  const seed = canonicalUser()
  const schemaProblems = validateUserDoc(seed)

  if (schemaProblems.length) {
    return writePart({
      status: 'fail',
      critical: true,
      summary: `canonical UserDoc failed schema validation (${schemaProblems.length} problems)`,
      metrics: { schema_ok: false, schema_version: seed.schema_version },
      details: { schema_problems: schemaProblems },
    })
  }

  const admin = loadAdmin()
  const cfg = connectionConfig()
  const require_fs = process.env.REQUIRE_FIRESTORE === '1'

  if (!admin || !cfg) {
    const reason = !admin
      ? 'firebase-admin not installed'
      : 'no Firestore connection configured (no emulator or credentials)'
    if (require_fs) {
      return writePart({
        status: 'fail',
        critical: true,
        summary: `schema OK but connection could not be attempted: ${reason} (REQUIRE_FIRESTORE=1)`,
        metrics: { schema_ok: true, connected: false },
        details: { reason },
      })
    }
    return writePart({
      status: 'skip',
      critical: true,
      summary: `schema OK; connection SKIPPED (${reason})`,
      metrics: { schema_ok: true, connected: false },
      details: { reason },
    })
  }

  try {
    const info = await tryConnect(admin, cfg, seed)
    writePart({
      status: 'pass',
      critical: true,
      summary: `schema OK; connected via ${cfg.kind}; probe round-trip OK (${info.collection})`,
      metrics: { schema_ok: true, connected: true, connection: cfg.kind },
      details: { probe: info.collection },
    })
  } catch (e) {
    writePart({
      status: 'fail',
      critical: true,
      summary: `schema OK but Firestore connection failed via ${cfg.kind}: ${e.message}`,
      metrics: { schema_ok: true, connected: false, connection: cfg.kind },
      details: { error: e.message },
    })
  }
}

main().catch((e) => {
  console.error(e)
  writePart({
    status: 'fail',
    critical: true,
    summary: `harness error: ${e.message}`,
    metrics: {},
    details: { error: e.message },
  })
})
