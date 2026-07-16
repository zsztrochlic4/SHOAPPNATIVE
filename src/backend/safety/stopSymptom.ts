/**
 * Stop-symptom escalation — Safety Rule S06 (HARD safety, runtime).
 *
 * Source of truth: workbook "Safety Rules" S06 + Exercise Swaps SW03 + Coach AI Operating
 * Rules. A reported stop symptom is NEVER trained through and NEVER treated as a swap:
 * the session ends immediately, the event is logged to `flags`, and further generation is
 * halted until the user confirms it resolved (or a professional clears them, where the
 * Screening Outcomes sheet requires it).
 *
 * Deterministic and side-effect-free — returns the actions the app/generator must take.
 */

import type { FlagsDoc, SetLogDoc } from '../schema'

/** Symptoms that end a session on the spot. */
export const STOP_SYMPTOMS = [
  'chest pain', 'chest discomfort', 'dizziness', 'fainting', 'unusual shortness of breath',
  'palpitations', 'numbness', 'tingling', 'sharp joint pain',
] as const

export type StopSymptom = (typeof STOP_SYMPTOMS)[number]

/** Symptoms that additionally prompt the user to seek medical advice. */
const CARDIAC_LIKE: string[] = ['chest pain', 'chest discomfort', 'dizziness', 'fainting', 'palpitations', 'unusual shortness of breath']

export interface StopSymptomEscalation {
  triggered: boolean
  endSession: boolean
  /** Block all further generation until cleared/resolved. */
  haltGeneration: boolean
  /** Cardiac-like symptoms also advise seeking medical care. */
  seekMedicalAdvice: boolean
  message: string | null
  symptom: string | null
}

const NONE: StopSymptomEscalation = {
  triggered: false, endSession: false, haltGeneration: false, seekMedicalAdvice: false, message: null, symptom: null,
}

/** Does a completed set log report a stop symptom? */
export function isStopSymptom(log: Pick<SetLogDoc, 'stop_symptom'>): boolean {
  return log.stop_symptom === true
}

/**
 * Escalate a reported stop symptom. `symptom` is free text (from the log/chat); it's
 * matched loosely against the known list to decide the medical-advice prompt, but ANY
 * reported stop symptom ends the session and halts generation regardless.
 */
export function escalateStopSymptom(symptom: string | null | undefined): StopSymptomEscalation {
  const s = (symptom ?? '').trim().toLowerCase()
  const cardiac = CARDIAC_LIKE.some((c) => s.includes(c))
  return {
    triggered: true,
    endSession: true,
    haltGeneration: true,
    seekMedicalAdvice: cardiac,
    symptom: symptom ?? null,
    message: cardiac
      ? 'Stop the session now. Because you mentioned a symptom like chest pain, dizziness or breathlessness, please seek medical advice before training again. We’ve paused your program until you’re cleared.'
      : 'Stop the session now — we never train through pain like this. We’ve paused your program. Once the symptom has fully settled you can tell us and we’ll pick back up.',
  }
}

/** Convenience: evaluate a set log and return the escalation (or NONE). */
export function handleSetLog(log: Pick<SetLogDoc, 'stop_symptom'> & { symptomText?: string }): StopSymptomEscalation {
  return isStopSymptom(log) ? escalateStopSymptom(log.symptomText ?? null) : NONE
}

/** Record a stop-symptom event onto the user's flags document (returns the next flags). */
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
 * The generator must call this alongside the per-user screening gate.
 */
export function hasUnresolvedStopSymptom(flags: Pick<FlagsDoc, 'stop_symptom_events'>): boolean {
  return flags.stop_symptom_events.some((e) => !e.resolved && !e.cleared_by_professional)
}
