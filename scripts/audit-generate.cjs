/* Audit harness — runs the REAL compiled generator engine (.sweep-out) against
 * controlled profiles and prints programs + safety-gate outcomes. Not committed logic;
 * an audit-only read-through of the same code the app runs. */
const { generateProgram } = require('../.sweep-out/backend/generator/generate.js')
const { canGenerate } = require('../.sweep-out/backend/mapping/onboardingContract.js')
const { DEFAULT_INVENTORY_BY_TIER } = require('../.sweep-out/backend/data/equipmentInventory.js')

const WEEK = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const SPREAD = ['Monday','Wednesday','Friday','Saturday','Tuesday','Thursday','Sunday']
const TAGS = DEFAULT_INVENTORY_BY_TIER  // exact inventory the engine uses
const MAJOR = ['Chest','Back','Quads','Hamstrings & Glutes','Shoulders']
const SECONDARY = ['Biceps','Triceps','Calves','Core']
function user(goal, exp, days, o={}) {
  const tier = o.equipment_tier ?? 'Full Gym'
  return {
    uid:'audit', display_name:'T', date_of_birth: o.dob ?? '2000-01-01', age_verified: o.age_verified ?? true,
    sex:'male', height_cm:180, weight_kg:80, goal_weight_kg:82, experience:exp, goal,
    followed_structured_program: o.structured ?? true,
    focal_points:o.focal_points ?? [],
    days_available:o.days_available ?? SPREAD.slice(0,days).sort((a,b)=>WEEK.indexOf(a)-WEEK.indexOf(b)),
    session_length_min:o.session_length_min ?? 60, equipment_tier:tier, equipment_tags:o.equipment_tags ?? TAGS[tier],
    trains_alone:o.trains_alone ?? 'never', excluded_exercise_ids:o.excluded_exercise_ids ?? [],
    preferred_exercise_ids:o.preferred_exercise_ids ?? [],
    affected_regions:o.affected_regions ?? [], commitments:o.commitments ?? [],
    screening:{ version:'adult_v1', outcome:o.outcome ?? 'CLEAR', answers:{}, followups:{}, guardian_consent:o.guardian_consent ?? false,
      clearance_confirmed:o.clearance_confirmed ?? false, date:'', conditions:[], waiver_accepted:true },
    diet:[], tight_budget:false, motivation:null, notes:null, planned_absences:[], created_at:'2026-07-16', schema_version:1,
  }
}
function printProgram(title, u) {
  const gate = canGenerate(u)
  console.log('\n════════════════════════════════════════════════════════')
  console.log('PROFILE:', title)
  console.log(`  goal=${u.goal} exp=${u.experience} days=${u.days_available.length}(${u.days_available.join(',')}) session=${u.session_length_min}m tier=${u.equipment_tier} alone=${u.trains_alone} injuries=[${u.affected_regions}]`)
  console.log('  canGenerate:', JSON.stringify(gate))
  if (!gate.ok) { console.log('  → NO PROGRAM (gate closed).'); return }
  const r = generateProgram(u)
  if (!r.ok) { console.log('  → generateProgram FAILED:', r.reason); return }
  const p = r.program
  console.log(`  SPLIT: ${p.splitId}  | rest days: ${p.restDays.join(',')||'—'}`)
  for (const d of p.days) {
    console.log(`  ── ${d.weekday} · ${d.dayType} (${d.exercises.length} ex)`)
    for (const e of d.exercises) {
      const reps = e.repsMin!=null ? `${e.repsMin}-${e.repsMax}` : '—'
      const rest = e.restSecMin!=null ? `${e.restSecMin}s+` : '—'
      const pct = e.pct1rmMax!=null ? ` ≤${e.pct1rmMax}%1RM` : ''
      const rules = e.appliedRules&&e.appliedRules.length ? `  {${e.appliedRules.join(',')}}` : ''
      console.log(`       • ${e.name} [${e.muscleGroup}/${e.prescriptionClass}] ${e.sets}x${reps} RIR${e.rirMin} rest${rest}${pct}${rules}`)
    }
  }
  const vol = Object.entries(p.weeklySetsByMuscle).filter(([,n])=>n>0).map(([m,n])=>`${m}:${n}`).join('  ')
  console.log('  WEEKLY SETS:', vol)
  if (p.audit && p.audit.length) console.log('  AUDIT:', p.audit.join(' | '))
  // automated checks
  const flags = []
  for (const m of MAJOR) { const n = p.weeklySetsByMuscle[m]??0; if (n<4) flags.push(`MAJOR ${m}=${n}<4 floor`); if (n>20) flags.push(`MAJOR ${m}=${n}>20 cap`) }
  for (const m of SECONDARY) { const n = p.weeklySetsByMuscle[m]??0; if (n===0) flags.push(`SECONDARY ${m}=0 (untrained)`) }
  if (p.audit.some(a=>a.includes('UNFILLED'))) flags.push('UNFILLED required slot(s)')
  for (const d of p.days) for (const e of d.exercises) {
    if (e.prescriptionClass==='Load') { if (e.repsMin!=null&&e.repsMin<4) flags.push(`${e.exerciseId} reps<4 (S04)`); if (e.pct1rmMax!=null&&e.pct1rmMax>88) flags.push(`${e.exerciseId} %1RM>88 (S04)`) }
  }
  console.log('  ⚑ CHECK:', flags.length? flags.join(' ; ') : 'no automated flags')
}

// ---- Quality scorecard profiles ----
printProgram('P1 Beginner · Build muscle · 3d · Full Gym (clean)', user('Hypertrophy','Beginner',3))
printProgram('P2 Beginner · Get stronger · 3d · Full Gym', user('Strength','Beginner',3))
printProgram('P3 Advanced · Build muscle · 5d · Full Gym', user('Hypertrophy','Advanced',5))
printProgram('P4 Intermediate · Lose fat · 4d · Full Gym', user('Fat Loss','Intermediate',4))
printProgram('P5 Beginner · Build muscle · 6d (expect FB3C cap, NOT PPL6)', user('Hypertrophy','Beginner',6))
printProgram('P6 Intermediate · Build muscle · 4d · Bodyweight (dorm, no barbell)', user('Hypertrophy','Intermediate',4,{equipment_tier:'Bodyweight'}))
printProgram('P7 Intermediate · Build muscle · 4d · knee injury (MODIFY)', user('Hypertrophy','Intermediate',4,{affected_regions:['knee'],outcome:'MODIFY_AND_CONTINUE'}))
printProgram('P8 Beginner · Build muscle · 3d · trains ALONE (expect S09 cue)', user('Hypertrophy','Beginner',3,{trains_alone:'always'}))
printProgram('P9 Intermediate · Build muscle · 3d · 30-min session', user('Hypertrophy','Intermediate',3,{session_length_min:30}))

// ---- SAFETY GATE tests (expect NO program) ----
console.log('\n\n########## SAFETY GATE TESTS ##########')
printProgram('G1 Under-18 DOB (2012) — expect BLOCK', user('Hypertrophy','Beginner',3,{dob:'2012-01-01'}))
printProgram('G2 Screening DO_NOT_GENERATE — expect BLOCK', user('Hypertrophy','Beginner',3,{outcome:'DO_NOT_GENERATE'}))
printProgram('G3 REQUIRE_PROFESSIONAL_CLEARANCE (unconfirmed) — expect BLOCK', user('Hypertrophy','Beginner',3,{outcome:'REQUIRE_PROFESSIONAL_CLEARANCE'}))
printProgram('G4 REQUIRE_PROFESSIONAL_CLEARANCE (confirmed) — expect PROGRAM', user('Hypertrophy','Beginner',3,{outcome:'REQUIRE_PROFESSIONAL_CLEARANCE',clearance_confirmed:true}))
printProgram('G5 No DOB / unverified — expect BLOCK', user('Hypertrophy','Beginner',3,{dob:'',age_verified:false}))

// ---- Dropped-field probes ----
console.log('\n\n########## DROPPED-FIELD PROBES ##########')
const base = user('Hypertrophy','Intermediate',4)
const withPref = user('Hypertrophy','Intermediate',4,{preferred_exercise_ids:['CH01','CH02','CH03','BK01','BK02']})
const rb = generateProgram(base), rp = generateProgram(withPref)
const ids = (r)=> r.ok ? r.program.days.flatMap(d=>d.exercises.map(e=>e.exerciseId)).join(',') : 'FAIL'
console.log('preferred_exercise_ids effect: identical program?', ids(rb)===ids(rp))
console.log('  base    :', ids(rb))
console.log('  withPref:', ids(rp))
const struct0 = user('Hypertrophy','Intermediate',4,{structured:false})
const struct1 = user('Hypertrophy','Intermediate',4,{structured:true})
console.log('followed_structured_program effect: identical program?', ids(generateProgram(struct0))===ids(generateProgram(struct1)))

// ---- Determinism probe ----
console.log('\ndeterminism: two runs identical?', ids(generateProgram(user('Hypertrophy','Beginner',3)))===ids(generateProgram(user('Hypertrophy','Beginner',3))))
