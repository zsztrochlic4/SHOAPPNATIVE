/**
 * Verified Australian support services (spec §22) — the SINGLE place these live.
 * All national, human-led, verified current as of July 2026. If a number changes, update
 * it here only. The coach never substitutes institution-specific services for these, and
 * (spec §20 location rule) only serves these to users in Australia.
 *
 * Quarterly verification (spec §20) is an operational task recorded against LAST_VERIFIED.
 */

export const LAST_VERIFIED = '2026-07' as const

export interface SupportService {
  id: string
  name: string
  /** Human-readable contact string shown in copy. */
  contact: string
  /** Digits for a tap-to-call button (spec §20), or null where "refer to see one". */
  dial: string | null
  /** Digits for a tap-to-text button, where offered. */
  text?: string
  useFor: string
  /** true = active-crisis line; false = support/referral line (Butterfly is NOT a crisis line). */
  isCrisisLine: boolean
}

export const SERVICES: Record<string, SupportService> = {
  emergency: {
    id: 'emergency', name: 'Emergency (000)', contact: '000', dial: '000',
    useFor: 'Immediate danger to self or others.', isCrisisLine: true,
  },
  lifeline: {
    id: 'lifeline', name: 'Lifeline', contact: '13 11 14 (24/7); text 0477 13 11 14',
    dial: '131114', text: '0477131114',
    useFor: 'Crisis support and suicide prevention — the default crisis redirect.', isCrisisLine: true,
  },
  suicideCallBack: {
    id: 'suicideCallBack', name: 'Suicide Call Back Service', contact: '1300 659 467 (24/7)',
    dial: '1300659467', useFor: 'At risk of suicide, or affected by it.', isCrisisLine: true,
  },
  beyondBlue: {
    id: 'beyondBlue', name: 'Beyond Blue', contact: '1300 22 4636 (24/7)',
    dial: '1300224636', useFor: 'Depression, anxiety, general mental-health support.', isCrisisLine: false,
  },
  butterfly: {
    id: 'butterfly', name: 'Butterfly Foundation (National Helpline)',
    contact: '1800 33 4673 (8am–midnight AEST/AEDT, 7 days)', dial: '1800334673',
    useFor: 'Eating disorders, disordered eating, body-image concerns. NOT a crisis line.',
    isCrisisLine: false,
  },
  poisons: {
    id: 'poisons', name: 'Poisons Information Centre', contact: '13 11 26 (24/7, national)',
    dial: '131126',
    useFor: 'Possible poisoning or overdose. Use 000 for collapse, not breathing, seizure, severe allergy.',
    isCrisisLine: true,
  },
  dietitian: {
    id: 'dietitian', name: 'Accredited Practising Dietitian (APD) or GP', contact: 'ask your GP for a referral',
    dial: null,
    useFor: 'Any rapid-weight-loss or intense/clinical diet question. (‘Nutritionist’ is unregulated — not used.)',
    isCrisisLine: false,
  },
  physio: {
    id: 'physio', name: 'Physiotherapist or GP', contact: 'see a physio or GP', dial: null,
    useFor: 'Injuries, pain, physical symptoms.', isCrisisLine: false,
  },
  gp: {
    id: 'gp', name: 'GP', contact: 'see your GP', dial: null,
    useFor: 'General medical assessment and referral.', isCrisisLine: false,
  },
}

/** Build a tap-to-call button from a service (spec §20 — actionable, never text-only). */
export function callButton(serviceId: keyof typeof SERVICES, label?: string) {
  const s = SERVICES[serviceId]
  return { label: label ?? `Call ${s.name}`, action: 'call' as const, value: s.dial ?? '' }
}
export function textButton(serviceId: keyof typeof SERVICES, label?: string) {
  const s = SERVICES[serviceId]
  return { label: label ?? `Text ${s.name}`, action: 'text' as const, value: s.text ?? '' }
}
