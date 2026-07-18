/**
 * Fixed safety responses (spec §3–§17, §20, §22). These are used for every ENFORCED tier so
 * that a model failure or outage can never produce an unsafe reply. They are identical on the
 * live-AI path and the on-device fallback path — one source of truth.
 *
 * Wording for the crisis, third-party, disordered-eating, meal-plan, injury-override and
 * steroid cases follows the specification's illustrative text. First-aid wording for the
 * diabetic-hypo and asthma cases is intentionally conservative and marked for the independent
 * clinical review (spec §7, §23) — it directs to 000 / the personal action plan and does not
 * invent doses.
 */

import type { FixedResponse } from './types'
import { callButton, textButton, SERVICES } from './services'

/** The neutral fail-safe screen (spec §2 "failure handling"). Never the fitness menu. */
export function serviceUnavailable(): FixedResponse {
  return {
    text:
      'The coach is unavailable right now, so I can’t reply here. If this is an emergency or you’re in immediate danger, call 000. ' +
      'For mental-health support you can reach Lifeline on 13 11 14 (24/7, call or text 0477 13 11 14). Please try the coach again later.',
    buttons: [callButton('emergency', 'Call 000'), callButton('lifeline', 'Call Lifeline'), textButton('lifeline', 'Text Lifeline')],
    noAI: true,
  }
}

/**
 * Fixed responses keyed by responseKey. Only enforced categories appear here; `allow`
 * decisions have no fixed response (the coach proceeds, then the validator checks the reply).
 */
export const RESPONSES: Record<string, FixedResponse> = {
  immediate_danger: {
    text:
      'I’m really concerned about your safety, and this is beyond what I can help with as a training coach. ' +
      'If you’re in immediate danger or thinking about acting on this now, please call 000. You can also reach Lifeline on 13 11 14 (24/7, call or text 0477 13 11 14). You don’t have to face this alone.',
    buttons: [callButton('emergency', 'Call 000'), callButton('lifeline', 'Call Lifeline'), textButton('lifeline', 'Text Lifeline')],
    noAI: true,
  },

  crisis_concern: {
    text:
      'I’m really sorry you’re feeling like this, and I want to make sure you get proper support — this is beyond what I can help with as a training coach. ' +
      'We recommend reaching out to Lifeline on 13 11 14 (24/7, call or text 0477 13 11 14), or the Suicide Call Back Service on 1300 659 467. If you’re in immediate danger, please call 000. You don’t have to go through this alone.',
    buttons: [callButton('lifeline', 'Call Lifeline'), textButton('lifeline', 'Text Lifeline'), callButton('suicideCallBack', 'Suicide Call Back'), callButton('emergency', 'Call 000')],
    noAI: true,
  },

  third_party_crisis: {
    text:
      'It’s good that you’re looking out for them. If they may be in immediate danger, please call 000. ' +
      'For guidance on how to support someone at risk, Lifeline (13 11 14) can help, and it’s best not to leave them alone if it’s safe for you to stay. This is beyond what I can help with as a training coach.',
    buttons: [callButton('emergency', 'Call 000'), callButton('lifeline', 'Call Lifeline')],
    noAI: true,
  },

  harm_to_others: {
    text:
      'I can’t help with this. If someone may be in immediate danger, please call 000 now. This is beyond what I can help with as a training coach.',
    buttons: [callButton('emergency', 'Call 000')],
    noAI: true,
  },

  medical_emergency: {
    text:
      'This could be a medical emergency, so please stop and call 000 right now — that’s more important than any workout. ' +
      'If you can, move to a safe, cool place while help is on the way. I can’t coach through this.',
    buttons: [callButton('emergency', 'Call 000')],
    noAI: true,
  },

  overdose_poisoning: {
    text:
      'Please don’t wait on this. Call the Poisons Information Centre on 13 11 26 (24/7) for advice right now. ' +
      'If the person has collapsed, is having trouble breathing, is seizing, or seems seriously unwell, call 000 instead. I can’t advise on doses or treatment.',
    buttons: [callButton('poisons', 'Call Poisons (13 11 26)'), callButton('emergency', 'Call 000')],
    noAI: true,
  },

  medical_urgent: {
    text:
      'I’m sorry you’re dealing with that. That’s something to get looked at rather than train through — please stop the activity that brings it on and see a physiotherapist or GP for proper advice. ' +
      'I can’t diagnose it or prescribe treatment, but I’m here for your training once you’ve been cleared.',
    buttons: [],
    noAI: true,
  },

  injury_override: {
    text:
      'I can’t recommend training that loads or risks the injured area while it’s still healing — continuing could make it worse or slow your recovery, and I won’t suggest a lighter version, a different variation, taping, or a painkiller so you can push through. ' +
      'Please follow the advice of your doctor or physiotherapist and get clearance before returning to that training.',
    buttons: [],
    noAI: true,
  },

  pregnancy: {
    text:
      'Congratulations, and thanks for telling me. Training during pregnancy or after birth really needs to be guided by your own health, so I can’t set intensity, loading, or a return-to-training timeline. ' +
      'Please check with your GP, midwife, obstetric team, or a pelvic-health physiotherapist. If you have any warning signs — bleeding, fluid leaking, painful contractions, chest pain, dizziness, severe pain, or reduced baby movement — seek medical care now (000 for anything severe).',
    buttons: [callButton('emergency', 'Call 000')],
    noAI: true,
  },

  medical_condition: {
    text:
      'Thanks for letting me know — a condition like that affects what’s safe, and it’s not something I’m qualified to build a program around or set heart-rate, glucose, or intensity targets for. ' +
      'Please talk to your treating GP or specialist, or an Accredited Exercise Physiologist, who can advise safely. I can help with your training once you have clearance and any restrictions written down.',
    buttons: [],
    noAI: true,
  },

  disordered_eating: {
    text:
      'Thank you for telling me — that sounds really hard, and I care about how you’re doing more than any training goal. This isn’t something I can coach, and I don’t want to give numbers that could make it harder. ' +
      'Please reach out to the Butterfly Foundation on 1800 33 4673 (8am–midnight, 7 days), and to an Accredited Practising Dietitian, GP, or a health professional experienced in eating disorders. You deserve proper support.',
    buttons: [callButton('butterfly', 'Call Butterfly')],
    noAI: true,
  },

  rapid_weight_loss: {
    text:
      'Losing weight quickly and safely really depends on your individual health, so that’s something an Accredited Practising Dietitian or your GP is best placed to help with — I’d recommend seeing one rather than a crash approach. ' +
      'I can keep your training solid in the meantime.',
    buttons: [],
    noAI: true,
  },

  meal_plan: {
    text:
      'I can share general nutrition ideas, but I can’t create a personalised meal plan or set calorie and macro targets — that’s outside what I do as a training coach. ' +
      'An Accredited Practising Dietitian can build a plan around your health, goals, and individual needs.',
    buttons: [],
    noAI: true,
  },

  steroids_ped: {
    text:
      'I can’t recommend steroid cycles, doses, stacks, sourcing, or performance-enhancing drugs, and I can’t help avoid a drug test — these carry serious health risks. ' +
      'If you’re considering or already using them, please speak confidentially with a GP, sports physician, or endocrinologist who can look after your health. I can help you improve your training and recovery without them.',
    buttons: [],
    noAI: true,
  },

  supplement_dosing: {
    text:
      'I can explain what a supplement is in general terms, but I can’t give you a personal dose or tell you it’s safe to stack stimulants — the label directions and a pharmacist or GP are the right source for that, especially alongside any medication. ' +
      'If you’ve taken far too much, call the Poisons Information Centre on 13 11 26, or 000 if you have chest pain, palpitations, or feel like collapsing.',
    buttons: [callButton('poisons', 'Call Poisons (13 11 26)'), callButton('emergency', 'Call 000')],
    noAI: true,
  },

  prescribed_medication: {
    text:
      'I can’t advise you to start, stop, or change any prescribed medication — that decision belongs with the doctor who prescribed it, or your pharmacist. Please check with them.',
    buttons: [],
    noAI: true,
  },

  under_18: {
    text:
      'Thanks for being honest with me. StrengthHub’s coaching is built for people 18 and over, so I can’t keep coaching you here. ' +
      'A parent or guardian, a PE teacher, or a qualified coach or health professional would be the right people to help you train safely.',
    buttons: [],
    noAI: true,
  },

  unsafe_training: {
    text:
      'I won’t build that — training that hard with no recovery tends to cause injury and burnout rather than progress, and I won’t help you train while unwell, impaired, or by pushing through with painkillers or stimulants. ' +
      'Rest is part of the plan, not a break from it. When you’re recovered, I’ll set you up with something sustainable.',
    buttons: [],
    noAI: true,
  },

  ai_relationship: {
    text:
      'Just so we’re clear, I’m an app feature, not a real person, a therapist, or your doctor — and I’m only here to help with training, recovery, and general nutrition. ' +
      'If something heavier is going on, please reach out to someone you trust or a professional. What would you like to work on in your training?',
    buttons: [],
    noAI: false, // boundary reminder, but the user may continue on a safe topic
  },

  off_topic: {
    text:
      'That’s outside what I can help with — I’m your training coach, so I stick to workouts, recovery, motivation, and general nutrition. Want to pick one of those up?',
    buttons: [],
    noAI: true,
  },

  catch_all: {
    text:
      'Thanks for flagging that. Because it could affect what’s safe for you to do, I don’t want to guess or build around it — I’d rather you check with a qualified health professional first. ' +
      'If you have any severe or sudden symptoms, treat it as urgent and call 000. I’m here for your training once you’ve got the all-clear.',
    buttons: [callButton('emergency', 'Call 000')],
    noAI: true,
  },
}

/** Look up a fixed response, defaulting to the fail-safe screen if the key is unknown. */
export function responseFor(key: string | null): FixedResponse {
  if (key && RESPONSES[key]) return RESPONSES[key]
  return serviceUnavailable()
}

/** Every response that names a phone number renders it as an actionable button (spec §20). */
export function assertActionableButtons(): string[] {
  const problems: string[] = []
  for (const [key, r] of Object.entries(RESPONSES)) {
    const mentionsNumber = /\b000\b|13 ?11 ?14|1300 ?659 ?467|1800 ?33 ?4673|13 ?11 ?26/.test(r.text)
    if (mentionsNumber && r.buttons.filter((b) => b.value).length === 0) {
      problems.push(`${key}: names a number but has no actionable button`)
    }
    for (const b of r.buttons) if (!b.value) problems.push(`${key}: button "${b.label}" has no dial value`)
  }
  // Sanity: the crisis lines we depend on must exist.
  for (const id of ['emergency', 'lifeline', 'poisons', 'butterfly']) {
    if (!SERVICES[id]?.dial) problems.push(`service ${id} missing dial number`)
  }
  return problems
}
