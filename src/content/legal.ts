/**
 * legal.ts — in-app copy of StrengthHub's legal / safety documents.
 *
 * React Native can't read the Markdown in `docs/*.md` at runtime, so the three
 * documents are mirrored here as structured blocks that `LegalDocModal` renders
 * natively. The canonical, publishable source of truth is the Markdown:
 *   - docs/PRIVACY.md        → 'privacy'
 *   - docs/TERMS.md          → 'terms'
 *   - docs/HEALTH_SAFETY.md  → 'health-safety'
 * If you edit one, edit the other so the app and the website stay in sync.
 *
 * Inline emphasis: wrap text in **double asterisks** to render it bold.
 */

export type LegalDocKey = 'terms' | 'privacy' | 'health-safety'

/** A single rendered block within a document. */
export type LegalBlock =
  | { h: string } // section heading
  | { p: string } // paragraph (supports **bold**)
  | { ul: string[] } // bullet list (each item supports **bold**)

export interface LegalDoc {
  key: LegalDocKey
  /** Short label used in links / the acknowledgement list. */
  linkLabel: string
  /** Full title shown at the top of the viewer. */
  title: string
  lastUpdated: string
  blocks: LegalBlock[]
}

const CONTACT = 'info@strengthhubonline.com'

const TERMS: LegalDoc = {
  key: 'terms',
  linkLabel: 'Terms of Use',
  title: 'Terms of Use',
  lastUpdated: '2 August 2026',
  blocks: [
    { p: 'Welcome to StrengthHub Online ("StrengthHub", "we", "us", "our"). These Terms of Use ("Terms") are a legal agreement between you and StrengthHub and govern your use of the StrengthHub Online mobile app and related services (the "Service").' },
    { p: 'By creating an account, ticking the acknowledgement box, or otherwise using the Service, you agree to these Terms and to our Privacy Policy. If you do not agree, please do not use the Service.' },
    { p: `If you have any questions, contact us at **${CONTACT}**.` },

    { h: '1. Who we are' },
    { p: 'StrengthHub Online is operated by **Strengthhubonline** ("we"). The Service provides personalised training programs, workout and nutrition logging, progress tracking and general fitness guidance for university students.' },

    { h: '2. Eligibility' },
    { p: 'You must be **18 years of age or older** to use the Service. By using the Service you confirm that you are at least 18. The Service is not directed at, and must not be used by, anyone under 18. If we learn that a user is under 18 we may suspend or delete their account.' },

    { h: '3. The Service — general information, not medical advice' },
    { p: 'StrengthHub provides **general fitness, training and nutrition information for health and wellbeing**. It is **not a medical device** and does **not** provide medical advice, diagnosis or treatment. Training programs, exercise suggestions, calorie and macro figures (including AI photo estimates) are **general and approximate** and are generated from the information you provide — we cannot see you or assess your health.' },
    { p: 'You should always seek advice from a qualified professional (such as your doctor) before starting or changing an exercise or nutrition program, and for any medical or mental-health concern. Please also read our Health & safety information, which forms part of these Terms. **You use the Service, and exercise, at your own risk** (see sections 9 and 10).' },
    { p: 'If you are experiencing a medical or mental-health emergency, call **000** (in Australia) or your local emergency number immediately.' },

    { h: '4. Your account' },
    { ul: [
      'You are responsible for the information you provide and for keeping it accurate, including the health and screening answers you give during onboarding, which the Service relies on to tailor guidance to you.',
      'You are responsible for keeping your login credentials secure and for all activity under your account. Do not share your account with anyone.',
      `One account is for one person. Tell us promptly at **${CONTACT}** if you believe your account has been used without your permission.`,
    ] },

    { h: '5. Subscriptions, billing and cancellation' },
    { p: 'Some features of the Service require a paid subscription.' },
    { ul: [
      '**Free trial.** We may offer a free trial. Unless you cancel before the trial ends, your subscription will begin automatically and you will be charged the applicable fee.',
      '**Fees and renewal.** The subscription fee and billing period are shown to you at the time of purchase. Subscriptions **renew automatically** at the end of each billing period, and the then-current fee is charged to your chosen payment method, until you cancel.',
      '**Payment provider.** Payments are processed by our payment provider (Stripe) or, where you subscribe through an app store, by that app store, in accordance with their terms. We do not store your full card details.',
      '**Cancelling.** You can cancel at any time from the app (Settings → manage subscription) or, for app-store purchases, through your app-store account. Cancellation stops future renewals; you keep access until the end of the period you have already paid for.',
      '**Refunds.** Except where required by law (including the Australian Consumer Law — see section 11), fees already paid are generally non-refundable. Refunds for app-store purchases are handled by the relevant app store.',
      '**Price changes.** We may change subscription prices. We will give you reasonable notice, and any change applies from your next billing period.',
    ] },

    { h: '6. Acceptable use' },
    { p: 'You agree not to:' },
    { ul: [
      'use the Service for any unlawful, harmful or fraudulent purpose;',
      "attempt to gain unauthorised access to the Service, other users' accounts, or our systems, or interfere with or disrupt the Service;",
      'copy, scrape, reverse-engineer, resell or commercially exploit the Service or its content except as allowed by law;',
      'upload content that is unlawful, infringing, harmful, or that you do not have the right to share; or',
      'misrepresent your age or identity.',
    ] },
    { p: 'We may suspend or terminate access for conduct that breaches these Terms.' },

    { h: '7. Your content and data' },
    { ul: [
      '**Your content.** You keep ownership of the content you create in the app (your logs, entries and profile information). You grant us a limited licence to host, process and display that content solely to operate and improve the Service for you.',
      '**How we handle your data.** Our collection and use of personal information is described in our Privacy Policy, which forms part of these Terms.',
      "**AI features.** Some features (such as the meal-photo scan and AI-assisted guidance) send the information you submit to a third-party AI provider (Google's Gemini) to generate a response. Results are **estimates and general guidance only**. Do not submit sensitive information you would not want processed this way. See the Privacy Policy for details.",
    ] },

    { h: '8. Intellectual property' },
    { p: 'The Service, including its software, design, text, graphics, exercise and recipe content, and logos, is owned by us or our licensors and is protected by intellectual-property laws. We grant you a personal, non-exclusive, non-transferable, revocable licence to use the Service for your own personal, non-commercial use, subject to these Terms.' },

    { h: '9. Assumption of risk' },
    { p: 'Physical exercise carries inherent risks, including injury. By using the Service you acknowledge that:' },
    { ul: [
      'you are voluntarily choosing to exercise and to follow (or not follow) any guidance the Service provides;',
      'you are responsible for exercising within your own limits, using correct technique, and stopping if you feel unwell or experience pain; and',
      'you have read the Health & safety information and will seek professional advice where appropriate.',
    ] },

    { h: '10. Disclaimers and limitation of liability' },
    { ul: [
      'The Service is provided **"as is"** and **"as available"**. To the maximum extent permitted by law, we do not warrant that it will be uninterrupted, error-free, or that any result, program or estimate is accurate or suitable for you.',
      'To the maximum extent permitted by law, we are not liable for any indirect or consequential loss, or for loss or injury arising from your use of, or reliance on, the Service, except to the extent caused by our own failure to take reasonable care.',
      'Nothing in these Terms excludes, restricts or modifies any consumer guarantee, right or remedy that cannot lawfully be excluded (see section 11).',
    ] },

    { h: '11. Australian Consumer Law' },
    { p: 'Our goods and services come with guarantees that cannot be excluded under the Australian Consumer Law. Nothing in these Terms excludes, restricts or modifies those consumer guarantees. Where we are permitted to limit our liability for a breach of a consumer guarantee, our liability is limited, at our option, to re-supplying the service or paying the cost of having it re-supplied.' },

    { h: '12. Termination' },
    { ul: [
      '**By you.** You may stop using the Service and delete your account at any time (see the Privacy Policy for how to delete your data).',
      '**By us.** We may suspend or terminate your access if you breach these Terms, if required by law, or if we discontinue the Service. Where reasonable, we will give you notice.',
      'Sections that by their nature should survive termination (such as sections 7, 8, 9, 10 and 11) will survive.',
    ] },

    { h: '13. Changes to these Terms or the Service' },
    { p: 'We may update these Terms or change, suspend or discontinue features of the Service from time to time. When we make material changes to these Terms we will update the "Last updated" date above and, where appropriate, notify you in the app. Your continued use of the Service after an update means you accept the revised Terms.' },

    { h: '14. Governing law' },
    { p: 'These Terms are governed by the laws of Australia. You and we submit to the non-exclusive jurisdiction of the courts of Australia, without affecting any rights you have under the Australian Consumer Law or the law of the place where you live.' },

    { h: '15. Contact us' },
    { p: 'Strengthhubonline' },
    { p: `Email: **${CONTACT}**` },
  ],
}

const PRIVACY: LegalDoc = {
  key: 'privacy',
  linkLabel: 'Privacy Policy',
  title: 'Privacy Policy',
  lastUpdated: '1 August 2026',
  blocks: [
    { p: 'StrengthHub Online ("StrengthHub", "we", "us", "our") is a fitness, training and nutrition app for university students. This policy explains what information we collect, how we use it, who we share it with, and the choices and rights you have. It is written to reflect what the app actually does.' },
    { p: `If you have any questions, contact us at **${CONTACT}**.` },

    { h: '1. Who we are' },
    { p: `StrengthHub Online is operated by **Strengthhubonline**. For any privacy question or request, email **${CONTACT}**.` },
    { p: 'The app is intended for users **aged 18 and over** who are studying at university. It is not directed at children (see section 9).' },

    { h: '2. What information we collect' },
    { p: 'We only collect what the app needs to work for you:' },
    { p: '**Account information**' },
    { ul: [
      'Your email address and a password (used to create and secure your account).',
      'Optionally, a display name you choose.',
    ] },
    { p: '**Your fitness and profile data** (the content you create in the app)' },
    { ul: [
      'Your goals, training experience and preferences.',
      'Workouts, sessions and exercises you log.',
      'Nutrition entries, meal logs and food "check-in" tags.',
      'Body metrics you choose to enter, such as weight, and streaks/progress.',
      'Any injuries, limitations or dietary preferences you tell the app so it can tailor guidance to you.',
    ] },
    { p: '**Meal photos (only when you use the photo scan)**' },
    { ul: [
      "When you take or upload a photo of a meal, the image is sent to Google's Gemini AI to estimate its nutrition (see section 4). **We do not store your meal photos on our servers** — only the resulting estimate (for example the meal name and calorie/macro figures) is saved to your account if you choose to log it.",
    ] },
    { p: '**Device and notification data**' },
    { ul: [
      'If you turn on notifications, we store a "push token" for your device so we can send the reminders you asked for. You can turn this off at any time in the app\'s settings or your device settings.',
    ] },
    { p: '**Technical data**' },
    { ul: [
      'Basic information needed to run a mobile app and keep it secure (for example app version and general error information). We do **not** use third-party analytics or advertising SDKs.',
    ] },

    { h: '3. How we use your information' },
    { p: 'We use your information to:' },
    { ul: [
      'Create and secure your account and let you sign in.',
      'Provide the app\'s core features: training plans, logging, progress tracking, nutrition guidance and reminders.',
      'Personalise your experience (for example, respecting your goals, injuries and dietary preferences).',
      'Estimate the nutrition of meals you photograph, when you use that feature.',
      'Send you the notifications you have enabled.',
      'Keep the service safe, prevent abuse, and fix problems.',
    ] },
    { p: 'We do **not** sell your personal information, and we do **not** track you across other apps or websites for advertising.' },

    { h: '4. Artificial intelligence (AI) features' },
    { p: "Some features use Google's Gemini AI:" },
    { ul: [
      "**Meal photo scan:** the photo you submit is sent to Google's Gemini AI to estimate its nutrition. The result is an **estimate only** and is not a substitute for a nutrition label or professional dietary advice.",
      "Any other AI-assisted guidance sends the relevant text you provide to Google's Gemini AI to generate a response.",
    ] },
    { p: "When you use these features, the data you submit is processed by Google in accordance with Google's privacy terms. We ask you not to submit sensitive personal information you would not want processed this way." },

    { h: '5. Who we share your information with' },
    { p: 'We share data only with the service providers that run the app for us, and only as needed to provide the service:' },
    { ul: [
      '**Google Firebase** — authentication, cloud database and storage, and hosting (Google LLC / Google Cloud).',
      "**Google's Gemini AI** — to power the AI features described in section 4.",
    ] },
    { p: 'These providers process data on our behalf under their own terms and security commitments. We may also disclose information if required by law, or to protect the rights, safety and security of our users and the service.' },
    { p: 'We do **not** sell your personal information to anyone.' },

    { h: '6. Where your data is stored and how we protect it' },
    { p: 'Your account and app data are stored using Google Firebase, in a data centre region located in **Australia**. We rely on Firebase\'s security controls, enforce access rules so that you can generally only read and write your own data, and take reasonable steps to protect your information. No online service can be guaranteed to be 100% secure, but we work to keep your data safe.' },

    { h: '7. How long we keep your data' },
    { p: 'We keep your account and app data for as long as your account is active. If you delete your account (see section 8), we delete or de-identify your personal data that we hold, except where we are required to keep certain records by law.' },

    { h: '8. Your rights and choices' },
    { p: 'You can:' },
    { ul: [
      '**Access and correct** your information — most of it is editable directly in the app.',
      '**Download your data** — from **Settings → Download my data**, export your profile and logs as a JSON file to keep or move elsewhere.',
      `**Delete your account and data** — you can request deletion from within the app or by emailing **${CONTACT}**. When you delete your account, we remove your login and associated personal data.`,
      '**Control notifications** — turn reminders on or off in the app\'s settings or in your device settings.',
      `**Contact us** about any privacy request at **${CONTACT}**.`,
    ] },
    { p: 'Depending on where you live, you may have additional rights under local privacy law (for example, the Australian Privacy Principles). Contact us and we will help.' },

    { h: "9. Children's privacy" },
    { p: 'StrengthHub Online is intended for users **aged 18 and over**. We do not knowingly collect personal information from children under 18. If you believe a child has provided us with personal information, contact us and we will delete it.' },

    { h: '10. Health and wellbeing disclaimer' },
    { p: 'StrengthHub Online provides **general fitness, training and nutrition information for health and wellbeing**. It is **not a medical device** and does not provide medical advice, diagnosis or treatment. Calorie and nutrition figures (including AI photo estimates) are approximate. Always seek advice from a qualified professional before making significant changes to your exercise or diet, and for any medical or mental-health concern.' },

    { h: '11. Changes to this policy' },
    { p: 'We may update this policy from time to time. When we do, we will change the "Last updated" date above and, where appropriate, notify you in the app. Your continued use of StrengthHub Online after an update means you accept the revised policy.' },

    { h: '12. Contact us' },
    { p: 'Strengthhubonline' },
    { p: `Email: **${CONTACT}**` },
  ],
}

const HEALTH_SAFETY: LegalDoc = {
  key: 'health-safety',
  linkLabel: 'Health & safety information',
  title: 'Health & Safety Information',
  lastUpdated: '2 August 2026',
  blocks: [
    { p: 'StrengthHub Online provides **general fitness, training and nutrition information for health and wellbeing**. It is **not medical advice** and is **not a substitute** for a consultation with a qualified professional. Please read this information before you start training. It forms part of our Terms of Use.' },
    { p: '**In an emergency, call 000 (in Australia) or your local emergency number.**' },

    { h: '1. Talk to a professional first' },
    { p: 'Before you start or significantly change an exercise or nutrition program, we recommend you speak with your doctor or another qualified health professional — especially if any of the following apply to you:' },
    { ul: [
      'you have a heart condition, high blood pressure, chest pain, or you become breathless or dizzy with light activity;',
      'you have diabetes, asthma, epilepsy, or another ongoing medical condition;',
      'you have a bone, joint or muscle problem, or a current or recent injury;',
      'you are pregnant, recently gave birth, or are recovering from surgery or illness;',
      'you take medication that could affect exercise; or',
      'you are unsure, for any reason, whether exercise is safe for you.',
    ] },
    { p: 'StrengthHub tailors guidance from the information you give us during onboarding, but **we cannot see you or assess your health**. You are responsible for exercising within your own limits.' },

    { h: '2. Stop and seek help if something is wrong' },
    { p: '**Stop exercising immediately and seek medical help** if you experience any of the following during or after activity:' },
    { ul: [
      'chest pain, pressure or tightness;',
      'severe shortness of breath;',
      'dizziness, faintness or loss of consciousness;',
      'an irregular or racing heartbeat;',
      'sudden or severe pain, or a "pop", swelling or loss of movement in a joint or muscle.',
    ] },
    { p: 'If symptoms are severe or you think it may be a medical emergency, **call 000** (in Australia) or your local emergency number.' },

    { h: '3. Train safely' },
    { p: 'To reduce the risk of injury:' },
    { ul: [
      '**Warm up** before training and cool down afterwards.',
      '**Learn correct technique** and start with lighter loads before adding weight. Increase difficulty gradually — progress over weeks, not in a single session.',
      '**Use equipment safely.** Check equipment before use, use safety collars and racks, and use a spotter for heavy or overhead lifts.',
      "**Listen to your body.** Some muscle fatigue is normal; sharp pain is not. Rest when you need to, and don't train through pain, illness or injury.",
      '**Stay hydrated** and allow time to recover between sessions.',
      '**Mind your surroundings** — train in a clear, stable space with good footing.',
    ] },
    { p: "Guidance in the app (including sets, reps, weights and rest times) is a **general starting point**, not a personalised medical prescription. Adjust it to suit your own ability, and stop if anything doesn't feel right." },

    { h: '4. Nutrition and calorie estimates' },
    { ul: [
      'Calorie, macro and nutrition figures in the app — including the **AI meal-photo scan** — are **estimates only**. They can be inaccurate and are not a substitute for a nutrition label or advice from a qualified professional.',
      'Do not use the app to manage a medical condition or a special diet without professional advice.',
      'If you have, or think you may be developing, an unhealthy relationship with food, exercise, or your body — for example, restricting food, over-exercising, or distress about eating or weight — please talk to your doctor or a qualified professional. In Australia, the **Butterfly Foundation National Helpline** is available on **1800 33 4673**.',
    ] },

    { h: '5. Your mental health matters' },
    { p: "Training should support your wellbeing, not harm it. If you are struggling with your mental health, you don't have to manage it alone. In Australia you can reach:" },
    { ul: [
      '**Lifeline** — **13 11 14** (24/7 crisis support)',
      '**Beyond Blue** — **1300 22 4636**',
      'In an emergency, **000**.',
    ] },
    { p: 'If you are outside Australia, please contact your local crisis line or emergency services.' },

    { h: '6. Your responsibility' },
    { p: 'By using StrengthHub Online you acknowledge that physical exercise carries inherent risks, that you are choosing to exercise voluntarily, and that you are responsible for exercising safely and within your limits. StrengthHub provides general information to support you — the decisions about what, when and how you train remain yours.' },

    { h: '7. Contact us' },
    { p: `Questions about this information? Email **${CONTACT}**.` },
  ],
}

export const LEGAL_DOCS: Record<LegalDocKey, LegalDoc> = {
  terms: TERMS,
  privacy: PRIVACY,
  'health-safety': HEALTH_SAFETY,
}

/** Order used by the onboarding acknowledgement list. */
export const LEGAL_DOC_ORDER: LegalDocKey[] = ['terms', 'privacy', 'health-safety']
