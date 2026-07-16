/**
 * Stop-symptom escalation — Safety Rule S06 (HARD safety, runtime).
 *
 * Source of truth: workbook "Safety Rules" S06 + Exercise Swaps SW02/SW03 + Coach AI
 * Operating Rules. A reported stop symptom is NEVER trained through. How far it escalates
 * depends on the KIND of symptom (owner decision, reflected back into the sheets):
 *
 *  - Cardiac / neurological / breathing symptoms (chest pain, dizziness, fainting, unusual
 *    breathlessness, palpitations, numbness, tingling): FULL escalation — end the session,
 *    HALT all generation until resolved/cleared, log a stop_symptom_event, and prompt the
 *    user to seek medical advice. This is the SW03 path.
 *  - Acute musculoskeletal pain (sharp joint pain): end THAT EXERCISE and route to the
 *    pain-swap path (SW02) + Injury Modifications for the affected region — it does NOT
 *    freeze the whole program. A pain_flag is logged and the exercise is excluded pending
 *    the user confirming the area is fine.
 *
 * An unrecognised reported stop symptom defaults to the FULL-halt path (conservative).
 * Deterministic and side-effect-free — returns the actions the app/generator must take.
 */

import type { FlagsDoc, InjuryRegion, SetLogDoc } from '../schema'

/** Cardiac / neurological / breathing symptoms that halt the whole program (SW03). */
export const HALT_SYMPTOMS = [
  'chest pain', 'chest discomfort', 'dizziness', 'fainting', 'unusual shortness of breath',
  'palpitations', 'numbness', 'tingling',
] as const

/** Acute musculoskeletal symptoms that end the exercise and route to a pain swap (SW02). */
export const MUSCULOSKELETAL_SYMPTOMS = ['sharp joint pain'] as const

/** Any of these end at least the current exercise. */
export const STOP_SYMPTOMS = [...HALT_SYMPTOMS, ...MUSCULOSKELETAL_SYMPTOMS] as const

export type SymptomKind = 'cardiac_neuro' | 'musculoskeletal' | 'none'

export interface StopSymptomEscalation {
  triggered: boolean
  kind: SymptomKind
  /** Stop the current exercise immediately. */
  endExercise: boolean
  /** End the whole session (cardiac/neuro only). */
  endSession: boolean
  /** Freeze all further generation until resolved/cleared (cardiac/neuro only). */
  haltGeneration: boolean
  /** What the app does next: full halt, or the pain-swap/injury path. */
  route: 'halt' | 'injury_swap' | null
  /** Cardiac-like/neuro symptoms prompt seeking medical advice. */
  seekMedicalAdvice: boolean
  /** Write a stop_symptom_event to flags (halt path). */
  logStopSymptomEvent: boolean
  /** Write a pain_flag and exclude the exercise pending confirmation (SW02 path). */
  logPainFlag: boolean
  /** The affected region for the injury path, if it can be read from the report. */
  region: InjuryRegion | null
  message: string | null
  symptom: string | null
}

const NONE: StopSymptomEscalation = {
  triggered: false, kind: 'none', endExercise: false, endSession: false, haltGeneration: false,
  route: null, seekMedicalAdvice: false, logStopSymptomEvent: false, logPainFlag: false,
  region: null, message: null, symptom: null,
}

const REGION_WORDS: { re: RegExp; region: InjuryRegion }[] = [
  { re: /\b(lower ?back|spine|lumbar)\b/, region: 'lower_back' },
  { re: /\bknee/, region: 'knee' },
  { re: /\bshoulder/, region: 'shoulder' },
  { re: /\bwrist/, region: 'wrist' },
  { re: /\bhip/, region: 'hip' },
  { re: /\b(ankle|achilles|calf)/, region: 'ankle' },
]

/** Best-effort region read from a free-text symptom report (for the injury path). */
export function regionFromText(text: string | null | undefined): InjuryRegion | null {
  const s = (text ?? '').toLowerCase()
  return REGION_WORDS.find((r) => r.re.test(s))?.region ?? null
}

/** Does a completed set log report a stop symptom? */
export function isStopSymptom(log: Pick<SetLogDoc, 'stop_symptom'>): boolean {
  return log.stop_symptom === true
}

function isMusculoskeletal(s: string): boolean {
  // Acute joint pain — but "chest pain" and other halt symptoms are handled first.
  return /\bjoint pain\b/.test(s) || /\bsharp\b.*\b(pain|joint|knee|shoulder|hip|elbow|wrist|ankle|back)/.test(s)
}

/**
 * Escalate a reported stop symptom. Cardiac/neuro/breathing (and anything unrecognised)
 * take the full-halt path; acute sharp joint pain takes the end-exercise pain-swap path.
 */
export function escalateStopSymptom(symptom: string | null | undefined): StopSymptomEscalation {
  const s = (symptom ?? '').trim().toLowerCase()

  // Cardiac / neuro / breathing take precedence over any musculoskeletal wording.
  const halt = HALT_SYMPTOMS.some((h) => s.includes(h))

  if (!halt && isMusculoskeletal(s)) {
    return {
      triggered: true, kind: 'musculoskeletal',
      endExercise: true, endSession: false, haltGeneration: false,
      route: 'injury_swap', seekMedicalAdvice: false,
      logStopSymptomEvent: false, logPainFlag: true,
      region: regionFromText(s), symptom: symptom ?? null,
      message: 'Stop this exercise — sharp joint pain isn’t something to push through. We’ll swap it for a safer option and work around that area. The rest of your session can carry on.',
    }
  }

  // Full-halt path (cardiac / neuro / breathing, or anything unrecognised → conservative).
  return {
    triggered: true, kind: 'cardiac_neuro',
    endExercise: true, endSession: true, haltGeneration: true,
    route: 'halt', seekMedicalAdvice: true,
    logStopSymptomEvent: true, logPainFlag: false,
    region: null, symptom: symptom ?? null,
    message: 'Stop the session now — we never train through symptoms like this. We’ve paused your program, and because this can be serious please seek medical advice before training again. Tell us once you’re cleared and we’ll pick back up.',
  }
}

/** Convenience: evaluate a set log and return the escalation (or NONE). */
export function handleSetLog(log: Pick<SetLogDoc, 'stop_symptom'> & { symptomText?: string }): StopSymptomEscalation {
  return isStopSymptom(log) ? escalateStopSymptom(log.symptomText ?? null) : NONE
}

/** Record a stop-symptom event onto the user's flags document (halt path). */
export function recordStopSymptom(flags: FlagsDoc, symptom: string, dateIso: string): FlagsDoc {
  return {
    ...flags,
    stop_symptom_events: [
      ...flags.stop_symptom_events,
      { symptom, date: dateIso, resolved: false, cleared_by_professional: false },
    ],
  }
}

/**
 * Generation stays halted while any stop-symptom event is unresolved and not cleared.
 * (Musculoskeletal pain swaps do NOT create these events, so they never halt generation.)
 */
export function hasUnresolvedStopSymptom(flags: Pick<FlagsDoc, 'stop_symptom_events'>): boolean {
  return flags.stop_symptom_events.some((e) => !e.resolved && !e.cleared_by_professional)
}
