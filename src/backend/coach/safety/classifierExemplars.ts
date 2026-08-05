/**
 * Few-shot calibration exemplars for the safety classifier (audit R5-002).
 *
 * Hand-authored, NON-HOLDOUT worked examples that teach the model the benign/at-risk boundary in
 * both directions: third-party attributes, academic/research framing, historical/resolved states and
 * gym hyperbole are ["none"], while genuine first-person risk is flagged. Adding them to the shipped
 * prompt (buildPrompt) cut the benign false-positive rate from 19.7% to 3.5% on the frozen holdout
 * with ZERO loss of critical recall (0 misses, measured repeatably).
 *
 * SINGLE SOURCE OF TRUTH: kept byte-identical to data/fewshot-exemplars.json (the measurement harness
 * reads that JSON); test/unit/classifierExemplars.test.mjs fails the build if the two ever diverge.
 * Do not hand-edit one without the other.
 */
export interface ClassifierExemplar {
  /** A representative user message. */
  text: string
  /** The categories a correct classifier returns for it ("none" for the benign look-alikes). */
  categories: string[]
}

export const CLASSIFIER_EXEMPLARS: ReadonlyArray<ClassifierExemplar> = [
  {"text":"my flatmate is on blood pressure tablets, is it ok for him to start lifting?","categories":["none"]},
  {"text":"my little brother just turned 14, what's a safe way for him to begin training?","categories":["none"]},
  {"text":"for my nursing assignment I'm reading about anorexia recovery, any good sources?","categories":["none"]},
  {"text":"I dislocated my shoulder back in high school but it healed years ago and feels fine now","categories":["none"]},
  {"text":"that leg session absolutely destroyed me today, loved every second","categories":["none"]},
  {"text":"can you put together an upper/lower split for me four days a week?","categories":["none"]},
  {"text":"I'm absolutely starving after that session, what's a solid high-protein snack?","categories":["none"]},
  {"text":"my mate mentioned he ran a steroid cycle last year — I don't touch that stuff myself","categories":["none"]},
  {"text":"lately I keep feeling like the people around me would be better off if I wasn't here","categories":["crisis_concern"]},
  {"text":"I've decided tonight is the night, I've got everything ready","categories":["immediate_danger"]},
  {"text":"I lost count and swallowed several more paracetamol than the packet says, should I worry?","categories":["overdose_poisoning"]},
  {"text":"mid-set my chest went really tight and the pain is spreading down my arm","categories":["medical_emergency"]},
  {"text":"I'm still in year 10 at school — am I allowed to use this?","categories":["under_18"]},
  {"text":"I've been making myself throw up after big meals, is that a problem?","categories":["disordered_eating"]},
  {"text":"I keep quietly hoping I'll just stop existing one of these days","categories":["crisis_concern"]},
  {"text":"honestly I can't picture myself still being around by the end of the month","categories":["crisis_concern"]},
  {"text":"part of me just wants the lights to switch off and stay off for good","categories":["crisis_concern"]},
  {"text":"I've quietly started handing my things to friends, I won't be needing them","categories":["crisis_concern"]},
  {"text":"I told everyone it was just for an assignment, but it's about me and I've made my decision","categories":["immediate_danger"]},
  {"text":"everything's arranged now and I'm going through with it after tonight","categories":["immediate_danger"]},
  {"text":"before I made it sound like I was asking for a friend — it's me, and I've stopped pretending I'm okay","categories":["crisis_concern"]},
  {"text":"my housemate keeps saying he won't be around much longer and started giving his gear away","categories":["third_party_crisis"]},
  {"text":"I'm wrapping up training early today, legs are completely toast","categories":["none"]},
  {"text":"I'm finally ending things with my ex this weekend, feels overdue","categories":["none"]},
  {"text":"yeah just do it, go ahead and lock in my program","categories":["none"]},
  {"text":"that AMRAP finisher wrecked me in the best possible way","categories":["none"]},
  {"text":"I'm done for today, I'll be back at it tomorrow morning","categories":["none"]},
]
