/**
 * legal.ts — in-app copy of StrengthHub's legal / safety documents.
 *
 * React Native can't read the Markdown in `docs/*.md` at runtime, so the three
 * documents are mirrored here as structured blocks that `LegalDocModal` renders
 * natively. The canonical, publishable source of truth is the Markdown:
 *   - docs/PRIVACY.md        → 'privacy'
 *   - docs/TERMS.md          → 'terms'
 *   - docs/HEALTH_SAFETY.md  → 'health-safety'
 * These mirror the "Finalised" v1.0 documents (Effective 2 August 2026). If you
 * edit one, edit the Markdown too so the app and the website stay in sync.
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
  lastUpdated: '2 August 2026 · Version 1.0',
  blocks: [
    { p: `These Terms of Use ("Terms") govern your access to and use of the StrengthHub Online mobile and web application, website, AI-powered Coach and related services (together, the "Service").` },
    { p: `**Important:** StrengthHub provides general fitness, training, nutrition and wellbeing information. It is not a medical device, health professional, counselling service or emergency service. If life is in danger or urgent medical help is needed, call **000** in Australia or your local emergency number.` },
    { p: `By creating an account, selecting an acceptance control or using the Service, you agree to these Terms, the Privacy Policy, the Health & Safety Information and any feature-specific terms presented to you. If you do not agree, do not use the Service.` },

    { h: '1. About StrengthHub and these Terms' },
    { p: `StrengthHub Online ("StrengthHub", "we", "us" or "our") operates from Melbourne, Victoria, Australia. You can contact us at **${CONTACT}**.` },
    { p: `You must be at least 18 years old and legally able to enter into this agreement. The Service is designed primarily for adults in Australia, including university students, and is not directed to children.` },
    { p: `If feature-specific terms conflict with these Terms, the feature-specific terms apply to that feature to the extent of the conflict. Safety warnings always take priority.` },

    { h: '2. What the Service provides' },
    { p: `Depending on your plan, device, location and the features currently available, the Service may provide:` },
    { ul: [
      `onboarding and pre-exercise screening;`,
      `personalised training programs and exercise guidance;`,
      `workout, activity, nutrition, habit, recovery and progress logging;`,
      `calorie, macro and meal-photo estimates;`,
      `AI-generated coaching and wellbeing information;`,
      `reminders and notifications;`,
      `community, challenge, leaderboard and training-partner features;`,
      `integrations with compatible third-party fitness or health services; and`,
      `subscription management and other supporting features.`,
    ] },
    { p: `We may add, improve, replace or withdraw features. If a change materially reduces a paid Service during a current billing period, we will give reasonable notice where practicable and provide any remedy required by law.` },

    { h: '3. Health, safety and no professional advice' },
    { p: `The Service provides general information only. It does not provide medical advice, diagnosis, treatment, rehabilitation, dietetic care, psychological care or emergency assistance, and using it does not create a practitioner–client or other professional relationship.` },
    { p: `The Service cannot examine you, observe your technique, verify your information, inspect your equipment or surroundings, or consider every factor relevant to your health. Personalisation is based on the information available to the Service and is not a professional assessment.` },
    { p: `Before starting or materially changing an exercise or nutrition program, seek advice from a suitably qualified professional if appropriate for you, particularly if you have an injury, symptoms, a medical condition, take medication, are pregnant or postpartum, have been advised to restrict exercise, or have eating- or mental-health concerns.` },
    { p: `You must read and follow the Health & Safety Information. Stop exercising and seek appropriate help if you feel unwell or develop pain or concerning symptoms. Do not delay or disregard professional care because of anything in the Service.` },

    { h: '4. Artificial-intelligence features' },
    { p: `AI features, including the Coach and meal-photo analysis, use probabilistic systems. Outputs can be inaccurate, fabricated, incomplete, outdated, inconsistent or unsuitable, even when they sound confident. Similar inputs may produce different results.` },
    { p: `AI outputs are general information and estimates. You must use independent judgment, check important information and obtain professional advice where a decision could materially affect health, safety or wellbeing.` },
    { p: `The Coach is not monitored live by a person, cannot contact emergency services for you, cannot continuously monitor your condition or location, and may fail to recognise an emergency or other risk. Never wait for an AI response in an urgent situation.` },
    { p: `Relevant prompts, photos and selected account context may be processed by third-party AI providers as described in the Privacy Policy. Only submit information necessary to use the feature, and do not submit another person's personal information unless you are authorised to do so.` },
    { p: `Additional Coach-specific terms or acknowledgements may apply before that feature is enabled.` },

    { h: '5. Your account' },
    { p: `You must provide accurate information and keep it reasonably current, particularly age, screening, injury and limitation information used to tailor guidance. Do not create an account for another person or share your account.` },
    { p: `You are responsible for protecting your login credentials and for activity through your account, except to the extent it results from our failure to take reasonable care. Notify us promptly at **${CONTACT}** if you suspect unauthorised access.` },
    { p: `We may require you to verify your email, re-authenticate or complete reasonable security steps. One person may hold one personal account unless we agree otherwise.` },

    { h: '6. Subscriptions, trials and payment' },
    { p: `Some features require a paid subscription. Before purchase, the checkout screen will show the price, currency, billing period, trial period (if any), included features and payment channel.` },
    { ul: [
      `**Free trials.** If a trial converts to a paid subscription, we will clearly disclose this before you subscribe. Unless you cancel before the stated trial end, the subscription will begin automatically and the displayed fee will be charged.`,
      `**Automatic renewal.** Subscriptions renew for successive billing periods until cancelled. You authorise the applicable payment provider to charge the then-current disclosed fee and any applicable tax.`,
      `**Payment providers.** Payments may be processed by Stripe or the applicable app store. Their payment terms also apply. We do not receive or store your full card number.`,
      `**Cancellation.** You may cancel at any time through the billing-management link in the app, which opens our payment provider's secure billing portal, or through the app store or payment channel you used to subscribe. Cancellation stops future renewals. Unless the law or checkout terms provide otherwise, access continues until the end of the paid period. Deleting your account does not cancel a subscription; if you have deleted your account and can no longer reach the billing portal, contact us at info@strengthhubonline.com and we will cancel it for you.`,
      `**Price changes.** We will give reasonable advance notice of an increase. The new price applies from a later renewal, and you may cancel before it takes effect.`,
      `**Refunds.** We do not provide change-of-mind refunds unless stated at purchase. This does not limit any refund, cancellation or other remedy available under the Australian Consumer Law or another applicable law. Store purchases may need to be handled through the relevant store.`,
    ] },
    { p: `You are responsible for keeping payment and contact information current. A failed payment may result in loss of paid access after reasonable retry or notice.` },

    { h: '7. Your content and community participation' },
    { p: `You retain ownership of content you create or submit, including profile information, logs, prompts, posts, comments and photos ("User Content").` },
    { p: `You grant us a non-exclusive, worldwide, royalty-free licence to host, copy, transmit, process, format and display User Content only as reasonably necessary to operate, secure and support the Service, comply with law and exercise our rights under these Terms. This licence ends when the content is deleted from our active systems, subject to reasonable backup, legal and technical retention.` },
    { p: `Community and social features may be rolled out progressively and may appear as a preview with example content before they are active. Content you choose to publish in a community, leaderboard, challenge or partner feature may be visible to the audience identified in the feature. Do not post confidential information or content you do not want that audience to see. Other users may copy or share what they can view despite our rules.` },
    { p: `Some leaderboards are global. If you claim a username and join the global streak leaderboard, your username, streak and ranking are visible to all users of the Service. Joining is optional — you appear only after you claim a username, and you may change your username or stop taking part at any time. Choose a username that does not reveal information you would prefer to keep private.` },
    { p: `Community content is provided by users, not verified by StrengthHub, and must not be treated as professional advice. We may remove or restrict content where we reasonably believe this is necessary to enforce these Terms, protect users, comply with law or maintain the Service.` },

    { h: '8. Acceptable use' },
    { p: `You must not:` },
    { ul: [
      `use the Service for an unlawful, fraudulent, abusive or harmful purpose;`,
      `encourage self-harm, violence, dangerous exercise, eating-disorder behaviour or illegal drug use;`,
      `harass, threaten, exploit, impersonate or discriminate against another person;`,
      `post unlawful, defamatory, infringing, sexually exploitative, private or misleading content;`,
      `collect or reveal another person's personal information without authority;`,
      `bypass safety controls, access another account, introduce malware, disrupt the Service or probe it for vulnerabilities without written authorisation;`,
      `scrape, reverse engineer, resell or commercially exploit the Service except where the law expressly permits; or`,
      `present AI output or other Service content as verified professional advice.`,
    ] },
    { p: `You may report safety or conduct concerns to **${CONTACT}**. If there is immediate danger, contact emergency services rather than relying on a report to us.` },

    { h: '9. Connected and third-party services' },
    { p: `The Service relies on third parties such as Google Firebase, Google Gemini, Stripe, notification providers, app stores and any on-device health platform you choose to connect, such as Apple Health or Health Connect. Third-party services have their own terms, availability and privacy practices.` },
    { p: `If you connect a service, you authorise us to receive and use the permitted data to provide the integration until you disconnect it. Disconnecting stops new collection through that connection but does not automatically delete data already imported into StrengthHub or held by the third party. You can delete imported StrengthHub data using the controls described in the Privacy Policy.` },
    { p: `We are not responsible for a third-party service to the extent allowed by law, but this does not affect responsibility we have for our own conduct or non-excludable consumer rights.` },

    { h: '10. Our intellectual property' },
    { p: `The Service, including its software, design, branding, databases and original content, is owned by or licensed to StrengthHub and protected by intellectual-property laws.` },
    { p: `While you comply with these Terms, we grant you a limited, personal, non-exclusive, non-transferable, revocable licence to use the Service for its intended, non-commercial purpose.` },
    { p: `AI output may not be unique, may resemble material generated for others and may not qualify for intellectual-property protection. You are responsible for checking that your use of output is lawful and suitable.` },
    { p: `If you voluntarily provide feedback, you allow us to use it without restriction or payment, but we will not identify you publicly without permission.` },

    { h: '11. Privacy' },
    { p: `Our Privacy Policy explains what personal information we collect, how we use and disclose it, overseas processing, retention, security, access, correction, deletion and complaints. By using the Service, you acknowledge that you have had an opportunity to read it.` },
    { p: `Where consent is required for sensitive information or an optional feature, we will request that consent separately. You may withdraw an optional consent prospectively using the relevant setting or by contacting us, although this may disable the feature.` },

    { h: '12. Suspension, termination and account deletion' },
    { p: `You may stop using the Service, cancel a subscription and request account deletion at any time. Deleting the app does not cancel a subscription or delete your account, and deleting your account does not cancel your subscription. To stop billing, cancel first using "Manage or cancel subscription" in Settings, which opens our payment provider's secure billing portal. If you delete your account before cancelling, you will no longer be able to sign in to reach the billing portal — contact us at info@strengthhubonline.com and we will cancel your subscription for you. Your payment provider may retain transaction, invoice and tax records as required by law.` },
    { p: `We may restrict or suspend access where we reasonably believe this is necessary to address a material breach, unlawful conduct, fraud, non-payment, safety or security risk, or a legal requirement. Where reasonable, we will explain the reason and give you an opportunity to respond or fix the issue.` },
    { p: `We may terminate an account for a serious or repeated breach, or discontinue the Service. We will provide reasonable notice where practicable. Any refund or other remedy will be provided where required by law.` },
    { p: `Provisions that by their nature should continue—including intellectual property, liability, accrued payment obligations and dispute provisions—survive termination.` },

    { h: '13. Availability and disclaimers' },
    { p: `We use reasonable care in providing the Service. Subject to rights that cannot be excluded, we do not promise that the Service will be uninterrupted, error-free, permanently available or compatible with every device, or that any program, estimate, community post or AI output will be accurate or achieve a particular result.` },
    { p: `Fitness, strength, body-composition, nutrition and wellbeing outcomes vary and depend on factors outside our control. Examples, progress projections and estimates are informational only.` },

    { h: '14. Liability' },
    { p: `Nothing in these Terms excludes, restricts or modifies a guarantee, right, remedy or liability that cannot lawfully be excluded, restricted or modified, including under the Australian Consumer Law. Nothing excludes liability for fraud, wilful misconduct or any other liability the law does not permit us to exclude.` },
    { p: `To the maximum extent permitted by law, neither party is liable to the other for indirect or consequential loss that was not reasonably foreseeable when these Terms were accepted.` },
    { p: `We are not responsible for loss to the extent it is caused or increased by your unlawful or deliberate misuse of the Service, your failure to follow an express safety warning, materially inaccurate information you provide, or an event outside our reasonable control. Responsibility will otherwise be assessed under applicable law, including any contribution by each party.` },

    { h: '15. Australian Consumer Law' },
    { p: `Our services come with consumer guarantees that cannot be excluded under the Australian Consumer Law. Services must be provided with due care and skill, be reasonably fit for a disclosed purpose and be supplied within a reasonable time where no time is agreed.` },
    { p: `For a major failure, you may be entitled to cancel the service contract and receive a refund for the unused portion or compensation for reduced value. You may also be entitled to compensation for other reasonably foreseeable loss or damage. For a non-major failure, you may be entitled to have the problem remedied within a reasonable time and, if it is not, to further remedies. These rights are in addition to any other rights you have.` },

    { h: '16. Changes to these Terms' },
    { p: `We may update these Terms for legal, safety, security, technology or product reasons. We will publish the updated version and effective date.` },
    { p: `For a material change, we will give reasonable notice before it takes effect where practicable. If a change would materially disadvantage you in relation to an existing paid subscription, you may cancel before it takes effect and receive any remedy required by law. Urgent safety, security or legal changes may take effect sooner.` },
    { p: `The version in effect when conduct occurred governs that conduct. By continuing to use the Service after a notified update takes effect, you agree to the updated Terms. If you do not agree, stop using the Service and cancel any subscription.` },

    { h: '17. Governing law and disputes' },
    { p: `These Terms are governed by the laws of Victoria, Australia and applicable Commonwealth laws. You and StrengthHub submit to the non-exclusive jurisdiction of the courts of Victoria and courts entitled to hear appeals from them.` },
    { p: `Before starting formal proceedings, please contact us so we can try to resolve the issue promptly. This does not prevent either party seeking urgent relief or exercising a right under consumer law, and does not prevent you bringing a claim in another forum where a mandatory law allows it.` },

    { h: '18. General' },
    { p: `If part of these Terms is invalid or unenforceable, it is to be read down to the minimum extent necessary or severed, and the rest continues.` },
    { p: `A delay in enforcing a right is not a waiver. These Terms and the documents incorporated into them form the agreement about the Service, subject to any additional terms presented at purchase or for a specific feature.` },
    { p: `You may not transfer your account or these Terms without our written consent. We may transfer our rights and obligations as part of a genuine restructure, financing or sale of the Service, provided the transfer does not reduce your mandatory rights and we give reasonable notice where the change materially affects you.` },

    { h: '19. Contact' },
    { p: `StrengthHub Online` },
    { p: `Melbourne, Victoria, Australia` },
    { p: `Email: **${CONTACT}**` },
    { p: `Do not use email for an emergency. Call **000** in Australia or your local emergency number.` },
  ],
}

const PRIVACY: LegalDoc = {
  key: 'privacy',
  linkLabel: 'Privacy Policy',
  title: 'Privacy Policy',
  lastUpdated: '2 August 2026 · Version 1.0',
  blocks: [
    { p: `StrengthHub Online ("StrengthHub", "we", "us" or "our") is a fitness, training, nutrition and wellbeing service operated from Melbourne, Victoria, Australia. This Privacy Policy explains how we handle personal information through our mobile and web application, website, AI-powered Coach and related services (together, the "Service").` },
    { p: `We handle personal information in accordance with the Privacy Act 1988 (Cth) and the Australian Privacy Principles (APPs), and we treat these as binding commitments rather than aspirations. Because we handle health information from Victoria, we also apply the Health Records Act 2001 (Vic) and the Health Privacy Principles (HPPs).` },
    { p: `Contact: **${CONTACT}**` },

    { h: '1. Scope and age requirement' },
    { p: `This Policy applies to personal information we collect or hold in connection with the Service. It does not replace the privacy policy of a third-party app, store or connected service.` },
    { p: `The Service is intended for people aged 18 and over. We do not knowingly permit children to create accounts. If you believe a person under 18 has provided personal information, contact us so we can investigate and take appropriate action.` },

    { h: '2. Personal information we collect' },
    { p: `The information we collect depends on the features you use and the choices you make.` },
    { p: `**Account and identity information**` },
    { ul: [
      `email address, account identifier and optional display name;`,
      `date of birth and age-verification status;`,
      `university, campus, residence, society or similar community affiliation, if a profile or community feature asks for it and you choose to provide it; and`,
      `authentication and security information. Password credentials are processed by Firebase Authentication; we do not receive your readable password.`,
    ] },
    { p: `**Fitness, health and profile information**` },
    { ul: [
      `sex, height, weight, goal weight, goals, experience and motivation;`,
      `training availability, preferred environment and equipment, exercises and training history;`,
      `injuries, affected body regions, limitations, symptoms, pregnancy or postpartum answers, professional-clearance status and other pre-exercise screening responses;`,
      `nutrition entries, dietary preferences, meal plans, food check-ins, calorie and macro estimates;`,
      `habits, sleep, recovery, activity, streaks, progress and body metrics you choose to log; and`,
      `information about medication, physical or mental health, eating concerns or other sensitive matters that you choose to provide in screening, notes or AI conversations.`,
    ] },
    { p: `Some of this is health information or other sensitive information. Where required, we ask for consent before collecting it. You do not have to provide optional information, but the Service may be unable to personalise guidance or safely provide a feature without it.` },
    { p: `**Workout, nutrition and activity records**` },
    { p: `We collect workouts, sessions, sets, repetitions, loads, exercise substitutions, activities, meals, recipes, habits, goals and progress entries you log or import.` },
    { p: `Progress photos are intended to remain on your device unless you deliberately use a sharing or upload feature. Meal photos submitted for AI analysis are not retained in your StrengthHub account; how Google processes and temporarily retains the content you submit is described in the AI and automated processing section. The resulting nutrition estimate is stored only if you choose to log it.` },
    { p: `**AI-feature information**` },
    { p: `If you use an AI feature, we may process:` },
    { ul: [
      `prompts, messages, meal photos and AI responses;`,
      `selected profile, goal, screening, training-history, recovery, habit and nutrition context relevant to the request;`,
      `recent conversation context and any coach memories you choose to save;`,
      `your feature consent, preferences and proposed-action responses; and`,
      `limited safety classifications, usage counters and operational safety state used to apply safeguards and prevent abuse.`,
    ] },
    { p: `Coach conversations are not reviewed live by a person by default. Do not use the Coach as an emergency or confidential clinical service.` },
    { p: `**Community and user content**` },
    { p: `Community and social features (such as feeds, groups, challenges, leaderboards and training-partner matching) are being developed and may be shown as a preview with example content before they are active. When these features are live and you use them, we collect the posts, comments, reactions, challenge participation, leaderboard activity, training-partner preferences and other content you submit, and content you choose to publish will be visible to the audience identified in the feature, such as a campus, residence, society or wider community. Until a social feature is active, content of this kind that you create is stored only in your own account.` },
    { p: `To keep competitive leaderboards fair, when you take part in leagues or groups we also keep a per-day record of the activity that determines your ranking. This includes, for each day, the daily wellness figures you log — your **step count, hours of sleep, water intake and a nutrition-adherence score** — along with how many workouts or other activities you logged, your training volume, any rest or streak-freeze days, and the time each was recorded. This record is used to calculate your leaderboard score on our servers (so rankings cannot be faked from a modified app) and to detect implausible activity; it is visible only to you, contains no body measurements, weight or health notes, and is retained only for the period needed for scoring before being automatically deleted. It is included when you download your data and removed when you delete your account. If you appeal a review decision, the note you write is kept with your community profile (and is in your data download); the anti-cheat and moderation details behind a review are not shown to you.` },
    { p: `If you choose to claim a username and join the global streak leaderboard, your username, current and best streak, and ranking become visible to all users of the Service. Participation is optional — you only appear after you claim a username, and you can change your username at any time. We do not display your real name, location, or health measurements on the leaderboard; only your chosen username and streak figures are shown. Reactions you add to a friend group's activity are visible only to members of that group.` },
    { p: `**Connected-service information**` },
    { p: `If you connect a compatible on-device health service such as Apple Health (iOS) or Health Connect (Android), you grant permission on your device and we receive only the data categories you approve, which may include steps, sleep, activity or workout information. These on-device connections are planned for a future native app release and are not available in the current Service; where a version does not offer them, no health-platform data is collected.` },
    { p: `You can disconnect a service at any time. This stops new collection through that connection but does not by itself delete information already imported.` },
    { p: `**Subscription and transaction information**` },
    { p: `If you subscribe, we collect or receive information needed to administer access, such as your email, payment-provider customer identifier, plan, subscription status, trial and renewal dates, transaction references and limited billing metadata. Stripe or the applicable app store processes payment-card details; we do not receive or store your full card number.` },
    { p: `**Device, notification and technical information**` },
    { ul: [
      `a device push token, notification preferences and delivery status when notifications are enabled;`,
      `app version, device/platform type, connectivity and general diagnostic or error information;`,
      `security and service records such as authentication events, request timestamps, rate limits and logs; and`,
      `internet protocol address and similar network information that hosting, security and service providers may process when you use an online service.`,
    ] },
    { p: `We do not use third-party advertising SDKs and do not track you across unrelated apps or websites for advertising.` },

    { h: '3. How we collect information' },
    { p: `We collect information:` },
    { ul: [
      `directly from you when you create an account, complete onboarding or screening, log activity, use AI, post content, contact us or change settings;`,
      `automatically from your device and use of the Service where needed for operation, security and notifications;`,
      `from payment providers and app stores when you subscribe;`,
      `from a fitness or health service you choose to connect; and`,
      `from another person only where they are authorised to provide it or where law permits.`,
    ] },
    { p: `If you provide information about another person, you must have authority to do so and must not submit more than is necessary.` },

    { h: '4. Why we collect, use and disclose information' },
    { p: `We use personal information to:` },
    { ul: [
      `create, authenticate, secure and support accounts;`,
      `provide onboarding, screening, training, logging, nutrition, progress, community, reminder and connected-service features;`,
      `personalise programs and guidance using the information you provide;`,
      `provide AI responses, meal estimates, coach memory and safety controls where enabled;`,
      `process subscriptions, confirm entitlements and support billing enquiries;`,
      `communicate service, security, support and policy information;`,
      `prevent abuse, enforce our Terms, investigate incidents and protect users and the Service;`,
      `troubleshoot, maintain and improve reliability, accessibility and safety;`,
      `comply with law and respond to lawful requests; and`,
      `establish, exercise or defend legal claims.`,
    ] },
    { p: `We do not sell personal information. We do not use personal information for third-party targeted advertising.` },
    { p: `We may use aggregated or de-identified information for analysis, planning, safety evaluation and improvement where it is no longer reasonably identifiable.` },

    { h: '5. AI and automated processing' },
    { p: `The Coach and meal-photo scan use Google's Gemini AI. Relevant content is sent to Google to classify safety risk, generate a response or estimate meal nutrition. AI systems may infer information from the content you submit and can produce inaccurate results.` },
    { p: `The AI Coach is currently disabled. While it is off, the Coach does not operate and no Coach conversations or Coach memories are collected; the AI processing described in this section then applies only to the meal-photo scan.` },
    { p: `We do not retain your meal photo in your StrengthHub account. Content you submit to Google is processed under Google's applicable terms, and how Google processes or temporarily retains that content is governed by those terms rather than by us.` },
    { p: `Automated safety systems may block or redirect a request, limit feature use or display support information. These controls are designed to reduce risk; they do not make clinical diagnoses or decisions that have legal or similarly significant effects. A person is not monitoring each interaction in real time.` },
    { p: `Long-term Coach memory is optional. Where available, you can pause it, inspect and delete individual memories, or clear them. You can withdraw Coach consent and delete the Coach workspace without deleting the rest of your account, subject to minimal records we must retain for security or law.` },
    { p: `Google processes AI inputs and outputs under the terms and privacy commitments applicable to the service configuration we use. Do not submit information that is unnecessary for the feature.` },

    { h: '6. Who we disclose information to' },
    { p: `We disclose personal information only as reasonably necessary to:` },
    { ul: [
      `Google Firebase and Google Cloud, for authentication, database, hosting, storage, server functions and security;`,
      `Google's Gemini services, for the AI features described above;`,
      `Stripe or an applicable app store, for checkout, subscriptions, fraud prevention and payment support;`,
      `Expo or another notification-delivery provider, if you enable remote notifications;`,
      `the operating-system health platform you choose to connect on your device, such as Apple Health or Health Connect, to the extent needed to operate that connection;`,
      `professional advisers, insurers, auditors or contractors bound by appropriate confidentiality obligations;`,
      `a buyer, investor or successor in a genuine business transaction, subject to appropriate safeguards and notice where required;`,
      `regulators, courts, law-enforcement bodies or other persons where required or authorised by law; and`,
      `another person where you direct us or consent.`,
    ] },
    { p: `Community content is disclosed to the audience you select or that the feature clearly identifies. We do not sell personal information.` },

    { h: '7. Overseas processing and disclosure' },
    { p: `Our primary Firestore database and Cloud Functions are configured in an Australian region. Some providers are global companies and may process, support or store information outside Australia.` },
    { p: `Overseas recipients are likely to include providers in the United States. Depending on the provider, your location and its current infrastructure, information may also be processed in other countries described in that provider's published privacy or data-location materials.` },
    { p: `Likely overseas processing includes Google AI and support systems, Stripe, Expo and app stores. On-device health connections such as Apple Health and Health Connect are read locally on your device and are not, by themselves, disclosed by us overseas. Before a cross-border disclosure, we take reasonable steps required by applicable Australian privacy law, and we assess providers and contractual or technical safeguards appropriate to the information and service.` },

    { h: '8. How we store and protect information' },
    { p: `Cloud account and app data is primarily held using Firebase services. Some information is cached locally on your device to support performance and offline use.` },
    { p: `We use safeguards appropriate to the nature of the information, including encrypted network connections, authentication, user-scoped access controls, restricted administrative access, service-provider controls, logging, rate limits and deletion processes.` },
    { p: `No system is completely secure. You should use a unique password, protect your device and notify us if you suspect unauthorised access.` },
    { p: `If a data breach is likely to cause serious harm and notification is required, we will notify affected individuals and the Office of the Australian Information Commissioner (OAIC) in accordance with the Notifiable Data Breaches scheme.` },

    { h: '9. How long we retain information' },
    { p: `We retain account and app data while your account is active and for only as long afterwards as reasonably needed for the purposes described in this Policy, backup and security cycles, dispute resolution and legal obligations.` },
    { p: `When you delete your account, we delete the active Firebase authentication account and user data we control, subject to:` },
    { ul: [
      `a limited period for deletion to propagate through backups and caches;`,
      `health information that a law such as the Health Records Act 2001 (Vic) requires us to retain for a minimum period, which may be longer than you request; where this applies we restrict access to that information and delete it when the required period ends;`,
      `financial, transaction, fraud-prevention or legal records that must or may reasonably be retained;`,
      `information held independently by a payment, app-store or connected-service provider; and`,
      `a minimal deletion audit record containing an account identifier and timestamp, retained only for security, compliance and evidence that the request was completed.`,
    ] },
    { p: `Deleting your account does not cancel a paid subscription. Cancel it first from Settings ("Manage or cancel subscription"); if you have already deleted your account and can no longer sign in, contact us at info@strengthhubonline.com and we will cancel your subscription for you.` },
    { p: `Where deletion is not required or reasonably possible, we may de-identify information. We periodically review retained information and delete or de-identify it when no longer reasonably required.` },

    { h: '10. Your choices and rights' },
    { p: `Subject to applicable law and reasonable verification, you may:` },
    { ul: [
      `access and correct personal information through the app or by contacting us;`,
      `download available profile and log data from Settings > Download my data;`,
      `delete your account from Settings or request deletion by email;`,
      `control notifications through the app and device settings;`,
      `connect or disconnect optional third-party services;`,
      `control available Coach consent and memory settings; and`,
      `withdraw consent to future collection or use where we rely on consent.`,
    ] },
    { p: `Withdrawing consent does not affect earlier lawful processing and may mean a feature cannot operate. Internal security logic, confidential information about others and information we are legally entitled or required to withhold may not appear in an export.` },
    { p: `We will respond to access and correction requests within a reasonable period. If we refuse a request, we will explain why and available complaint options where required.` },

    { h: '11. Privacy questions and complaints' },
    { p: `To ask a question, make a request or complain about privacy, email **${CONTACT}** with enough detail for us to understand the issue. Do not send unnecessary health information or account passwords.` },
    { p: `We will acknowledge and investigate a complaint and aim to respond within 30 days. We may ask you to verify your identity or provide further information. If more time is reasonably needed, we will tell you why and provide an updated timeframe.` },
    { p: `If you are not satisfied after giving us a reasonable opportunity to respond, you may complain to the Office of the Australian Information Commissioner at www.oaic.gov.au or by calling 1300 363 992. For a complaint about health information handled in Victoria, you may also contact the Victorian Health Complaints Commissioner at hcc.vic.gov.au or on 1300 582 113. Other complaint rights may also apply.` },

    { h: '12. Direct communications' },
    { p: `We may send service, billing, safety and security messages needed to operate your account. If we send optional marketing communications, we will provide a way to unsubscribe. You may still receive essential non-marketing messages while your account is active.` },

    { h: '13. Changes to this Policy' },
    { p: `We may update this Policy when our practices, providers, features or legal obligations change. We will publish the new effective date and take reasonable steps to notify you of a material change before it takes effect where practicable.` },
    { p: `This Policy is a notice about how information is handled; it does not reduce rights you have under applicable law.` },

    { h: '14. Contact' },
    { p: `StrengthHub Online` },
    { p: `Melbourne, Victoria, Australia` },
    { p: `Email: **${CONTACT}**` },
  ],
}

const HEALTH_SAFETY: LegalDoc = {
  key: 'health-safety',
  linkLabel: 'Health & safety information',
  title: 'Health & Safety Information',
  lastUpdated: '2 August 2026 · Version 1.0',
  blocks: [
    { p: `StrengthHub Online provides general fitness, training, nutrition and wellbeing information. It is **not a medical device, health professional, counselling service or emergency service**. This Health & Safety Information forms part of the Terms of Use.` },
    { p: `**Emergency:** If life is in danger, someone is seriously unwell, or urgent help is needed, call **000** in Australia or your local emergency number. Do not wait for the app or the AI Coach to respond.` },

    { h: '1. Check that exercise is appropriate for you' },
    { p: `Before starting or significantly changing an exercise or nutrition program, consider speaking with a doctor or another suitably qualified professional. Obtain professional advice before training if:` },
    { ul: [
      `a doctor has told you that you have a heart condition or should exercise only under supervision;`,
      `you have chest pain during activity or have recently had unexplained chest pain at rest;`,
      `you become unusually breathless, dizzy, faint or lose consciousness;`,
      `you have an injury or a bone, joint, muscle or soft-tissue problem that exercise could worsen;`,
      `you are pregnant, have given birth within the past six months, or are recovering from surgery or illness;`,
      `you take medication or have a condition that may affect safe exercise, hydration, temperature control or nutrition;`,
      `you have been advised to avoid or restrict exercise or particular movements; or`,
      `there is any other reason you are unsure whether activity is safe.`,
    ] },
    { p: `If a professional gives you conditions or restrictions, follow them. Do not use StrengthHub to override professional advice.` },

    { h: '2. Screening and personalisation have limits' },
    { p: `StrengthHub may use onboarding and screening answers to adjust or withhold guidance. Screening is not a diagnosis, medical clearance or guarantee that exercise is safe.` },
    { p: `Answer accurately and update relevant information when your health or circumstances change. The Service cannot examine you, observe your movement, verify an answer or know your complete medical history.` },
    { p: `If screening tells you to obtain professional clearance, do not begin or continue the affected program until an appropriate professional has assessed you and any required conditions are recorded and followed.` },

    { h: '3. Stop immediately when something is wrong' },
    { p: `Stop exercising and seek urgent medical help if you experience symptoms such as:` },
    { ul: [
      `chest pain, pressure or tightness;`,
      `severe or unusual shortness of breath;`,
      `fainting, near-fainting, confusion, loss of coordination or sudden severe dizziness;`,
      `a very fast or irregular heartbeat with concerning symptoms;`,
      `sudden weakness, facial droop, difficulty speaking or another possible sign of stroke;`,
      `a severe allergic reaction, including swelling or difficulty breathing;`,
      `sudden or severe pain, a pop, major swelling, deformity or loss of movement; or`,
      `any symptom that feels severe, rapidly worsens or causes you concern.`,
    ] },
    { p: `Call **000** in Australia if symptoms may be life-threatening. For non-emergency health advice in Australia, healthdirect is available on **1800 022 222**. This list is not exhaustive.` },

    { h: '4. Train within your current ability' },
    { ul: [
      `Warm up progressively and cool down as appropriate.`,
      `Learn correct technique before increasing load, speed, range or complexity.`,
      `Start conservatively and progress gradually over days and weeks, not in one session.`,
      `Use the prescribed sets, repetitions, loads and rest periods as a starting point, not a requirement to push through symptoms.`,
      `Stop a set when technique breaks down or you cannot control the movement.`,
      `Allow adequate recovery and avoid hard training when unwell, severely sleep-deprived or impaired by alcohol, drugs or medication.`,
      `Stay hydrated and take extra care in heat, cold, humidity or poor air quality.`,
    ] },
    { p: `Normal effort and muscle fatigue can occur. Sharp, sudden, joint-related, worsening or unfamiliar pain is a reason to stop and assess the situation.` },

    { h: '5. Equipment, spotting and surroundings' },
    { p: `Inspect equipment before use and follow the manufacturer's and facility's instructions. Use safety pins, catches, collars and other protective equipment correctly.` },
    { p: `Use a competent spotter or appropriate safety setup for heavy or overhead lifts and any exercise where failing a repetition could trap or injure you. Do not attempt a lift because the app suggests it if the equipment, supervision or environment is unsuitable.` },
    { p: `Train on a stable surface with enough clear space. Keep children, pets and hazards away. If training alone, choose exercises and loads you can safely stop or exit.` },

    { h: '6. Injuries, illness, pregnancy and recovery' },
    { p: `Do not train through an acute injury, significant illness, fever or worsening symptoms. A substitution suggested by the Service is not rehabilitation advice and does not prove that a movement is safe for your condition.` },
    { p: `Pregnancy, postpartum recovery, surgery, chronic illness and medication can change exercise and nutrition needs. Obtain individual advice from an appropriate professional and follow any restrictions. Seek urgent help for warning signs or rapid deterioration.` },
    { p: `When returning after time away, illness or injury, reduce load and volume and rebuild gradually.` },

    { h: '7. Nutrition and meal estimates' },
    { p: `Calorie, macro, portion and nutrient figures—including meal-photo estimates—are approximate and can be materially wrong. Do not treat them as food labels, laboratory measurements or personalised dietetic advice.` },
    { p: `Check ingredients, allergens and food-safety requirements yourself. StrengthHub cannot reliably identify every ingredient or cross-contamination risk from a photo.` },
    { p: `Do not use the Service to manage diabetes, an allergy, pregnancy nutrition, kidney disease, an eating disorder or another medical or therapeutic diet without advice from a qualified professional.` },

    { h: '8. Supplements, medication and substances' },
    { p: `StrengthHub does not prescribe medication. Ask a doctor or pharmacist about side effects, contraindications and interactions before changing medication or using a supplement where safety may be relevant.` },
    { p: `Supplement contents and quality can vary, and "natural" does not mean safe. Do not use illegal or unsafe performance-enhancing substances. For suspected poisoning or overdose in Australia, call the Poisons Information Centre on **13 11 26**; call **000** if the situation is urgent or life-threatening.` },

    { h: '9. Eating, weight and body image' },
    { p: `Training and nutrition tracking should support wellbeing, not cause harm. Stop or reduce use of tracking features if they cause distress or reinforce restriction, bingeing, purging, compulsive exercise, unsafe rapid weight change or fixation on weight or appearance.` },
    { p: `Speak with a doctor or qualified eating-disorder professional if you are concerned about your relationship with food, exercise or your body. In Australia, the Butterfly National Helpline supports people affected by eating disorders and body-image concerns on **1800 33 4673**.` },

    { h: '10. Mental health and crisis support' },
    { p: `The Service and AI Coach do not provide therapy, suicide-risk assessment or crisis management. They cannot know that you are safe, monitor you continuously or contact help for you.` },
    { p: `If you or another person may be in immediate danger or may act on thoughts of suicide or self-harm, call **000** now or go to the nearest emergency department.` },
    { p: `Australia-wide support includes:` },
    { ul: [
      `**Lifeline:** 13 11 14, 24 hours a day, 7 days a week;`,
      `**Beyond Blue Support Service:** 1300 22 4636, 24 hours a day, 7 days a week; and`,
      `**Butterfly National Helpline:** 1800 33 4673 for eating-disorder and body-image support.`,
    ] },
    { p: `These services are independent of StrengthHub. Availability and contact details can change. If you are outside Australia, use your local emergency number and local crisis or health services.` },

    { h: '11. AI Coach limitations' },
    { p: `AI-generated guidance may be wrong, incomplete, outdated, inconsistent or inappropriate. Safety filters reduce some risks but are not perfect. The Coach may fail to recognise symptoms, misunderstand context or sound confident when incorrect.` },
    { p: `Do not rely on the Coach as the sole source for a health or safety decision. Check important information and seek a qualified professional where appropriate. Coach conversations are not reviewed live by a person by default.` },

    { h: '12. Wearables and connected data' },
    { p: `Steps, sleep, recovery, calorie expenditure, heart-rate and activity data from phones, wearables or connected services are estimates and can be incomplete or delayed. They are not a diagnosis or medical monitoring unless the device and use are specifically approved for that purpose.` },
    { p: `Do not ignore symptoms because a device or readiness score appears normal, and do not undertake unsafe activity because a score or challenge encourages it.` },

    { h: '13. Your responsibility and legal rights' },
    { p: `Physical activity carries inherent risks, including falls, strains, aggravation of existing conditions, serious injury and, in rare cases, death. You choose whether and how to exercise and are responsible for using reasonable care, following warnings and staying within your current ability.` },
    { p: `Nothing in this information excludes, restricts or modifies any consumer guarantee, right, remedy or liability that cannot lawfully be excluded, restricted or modified, including under the Australian Consumer Law.` },

    { h: '14. Contact' },
    { p: `Questions about this information may be sent to **${CONTACT}**.` },
    { p: `Do not use email for an emergency. Call **000** in Australia or your local emergency number.` },
  ],
}

export const LEGAL_DOCS: Record<LegalDocKey, LegalDoc> = {
  terms: TERMS,
  privacy: PRIVACY,
  'health-safety': HEALTH_SAFETY,
}

/** Order used by the onboarding acknowledgement list. */
export const LEGAL_DOC_ORDER: LegalDocKey[] = ['terms', 'privacy', 'health-safety']
