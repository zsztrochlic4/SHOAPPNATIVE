/**
 * LOCALISED crisis / safety responses (audit follow-up — multilingual safety, part 2).
 *
 * ⚠️⚠️  MACHINE-GENERATED — PENDING QUALIFIED NATIVE-SPEAKER + CLINICAL REVIEW.  ⚠️⚠️
 * These translations were produced by an AI, NOT by a native-speaker clinician. They are shipped so a
 * distressed non-English user gets a comprehensible crisis message and the (language-independent)
 * phone number, instead of English-only text — but the wording, cultural appropriateness, and
 * clinical safety of EACH string must be reviewed and signed off before this is treated as the
 * validated multilingual safety layer. A reviewer edits the strings below directly; the structure and
 * the guarantees (every crisis string keeps its emergency number, AU numbers only for AU) are enforced
 * by test/safety/localized-responses.test.mjs.
 *
 * SCOPE: AU-context (the app's audience is AU university students) — the localised text embeds the AU
 * service numbers, and reuses the AU tap-to-call buttons. A non-AU, non-English user falls back to the
 * English non-AU response (generic "local emergency services"): a known, documented gap.
 *
 * Numbers embedded (language-independent, must appear verbatim): 000, Lifeline 13 11 14,
 * Suicide Call Back 1300 659 467, Poisons 13 11 26, Butterfly 1800 33 4673.
 */
import type { FixedResponse } from './types'
import { RESPONSES } from './responses'

export type ResponseLang = 'en' | 'zh' | 'hi' | 'ar' | 'vi'

/** Whether a machine translation has been reviewed & signed off by a qualified native-speaker
 *  clinician. FALSE = translations are shown but are provisional; the guardrail tests still hold. */
export const LOCALIZED_CRISIS_REVIEWED = false

/**
 * Choose the response language from the message script. Deliberately conservative: only a clear
 * non-Latin script (or distinctly Vietnamese diacritics) switches away from English, so an English
 * message with the odd accent stays English.
 */
export function detectResponseLanguage(text: string): ResponseLang {
  const t = text || ''
  if (/[一-鿿㐀-䶿]/.test(t)) return 'zh' // CJK Han
  if (/[ऀ-ॿ]/.test(t)) return 'hi' // Devanagari
  if (/[؀-ۿݐ-ݿ]/.test(t)) return 'ar' // Arabic
  if (/[đĐơƠưƯăĂ]|[ạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/.test(t)) return 'vi'
  return 'en'
}

/** Localised body text keyed by [language][responseKey]. AU-context. Numbers must stay verbatim. */
const TEXT: Record<Exclude<ResponseLang, 'en'>, Record<string, string>> = {
  zh: {
    immediate_danger:
      '我非常担心你的安全，这已经超出了我作为健身教练能帮助的范围。如果你现在处于危险中，或正想付诸行动，请立即拨打 000。你也可以随时拨打或发短信联系生命热线 Lifeline：13 11 14。你并不孤单。',
    crisis_concern:
      '很抱歉你现在有这样的感受，我想确保你能得到真正的支持——这超出了我作为健身教练能帮助的范围。请联系生命热线 Lifeline：13 11 14，或自杀求助回电服务：1300 659 467。如果你有立即的危险，请拨打 000。你不必独自面对这一切。',
    third_party_crisis:
      '你愿意关心他们，这很好。如果对方可能有立即的危险，请拨打 000。生命热线 Lifeline（13 11 14）可以指导你如何帮助处于风险中的人；在你自身安全的前提下，最好不要让对方独自一人。这超出了我作为健身教练能帮助的范围。',
    medical_emergency:
      '这可能是医疗紧急情况——请立即停止并拨打 000，这比任何训练都重要。如果可以，请在等待帮助时移动到安全的地方。这方面我无法为你提供指导。',
    overdose_poisoning:
      '请不要拖延。请立即拨打毒物信息中心 13 11 26（24 小时）寻求建议。如果当事人已昏倒、呼吸困难、抽搐或情况严重，请改拨 000。关于剂量或治疗，我无法给出建议。',
    disordered_eating:
      '谢谢你告诉我——这听起来真的很不容易，比起任何训练目标，我更在意你的状态。这不是我能指导的，我也不想给出可能让情况更糟的数字。请联系蝴蝶基金会 Butterfly：1800 33 4673，以及有饮食失调经验的医生或注册营养师。你值得得到专业的支持。',
    under_18:
      '谢谢你的坦诚。StrengthHub 的指导是为 18 岁及以上的人设计的，所以我无法在这里继续指导你。家长或监护人、体育老师，或有资质的教练或健康专业人士，会是能帮助你安全训练的合适人选。',
    age_unverified:
      '在你的 StrengthHub 个人资料中验证出生日期之前，我无法开始个性化指导。请在账户设置中更新，然后再试一次。',
  },
  hi: {
    immediate_danger:
      'मुझे आपकी सुरक्षा की बहुत चिंता है, और यह एक फिटनेस कोच के रूप में मेरी मदद के दायरे से बाहर है। अगर आप अभी ख़तरे में हैं या ऐसा कुछ करने की सोच रहे हैं, तो कृपया तुरंत 000 पर कॉल करें। आप किसी भी समय Lifeline को 13 11 14 पर कॉल या टेक्स्ट भी कर सकते हैं। आप अकेले नहीं हैं।',
    crisis_concern:
      'मुझे खेद है कि आप ऐसा महसूस कर रहे हैं, और मैं चाहता हूँ कि आपको सही सहायता मिले — यह एक फिटनेस कोच के रूप में मेरी मदद के दायरे से बाहर है। कृपया Lifeline को 13 11 14 पर, या Suicide Call Back Service को 1300 659 467 पर संपर्क करें। अगर आप तुरंत ख़तरे में हैं, तो 000 पर कॉल करें। आपको यह अकेले नहीं सहना है।',
    third_party_crisis:
      'यह अच्छा है कि आप उनका ख़याल रख रहे हैं। अगर वे तुरंत ख़तरे में हो सकते हैं, तो कृपया 000 पर कॉल करें। किसी जोखिम में व्यक्ति की मदद करने के लिए Lifeline (13 11 14) मार्गदर्शन दे सकती है, और अगर आपके लिए सुरक्षित हो तो उन्हें अकेला न छोड़ें। यह एक फिटनेस कोच के रूप में मेरी मदद के दायरे से बाहर है।',
    medical_emergency:
      'यह एक मेडिकल इमरजेंसी हो सकती है — कृपया रुकें और तुरंत 000 पर कॉल करें, यह किसी भी वर्कआउट से ज़्यादा ज़रूरी है। अगर हो सके, तो मदद आने तक किसी सुरक्षित जगह चले जाएँ। मैं इसमें कोचिंग नहीं कर सकता।',
    overdose_poisoning:
      'कृपया इसमें देर न करें। सलाह के लिए तुरंत Poisons Information Centre को 13 11 26 (24/7) पर कॉल करें। अगर व्यक्ति बेहोश है, साँस लेने में तकलीफ़ है, दौरे पड़ रहे हैं, या हालत गंभीर है, तो इसके बजाय 000 पर कॉल करें। मैं ख़ुराक या इलाज पर सलाह नहीं दे सकता।',
    disordered_eating:
      'मुझे बताने के लिए धन्यवाद — यह वाकई मुश्किल लगता है, और किसी भी ट्रेनिंग लक्ष्य से ज़्यादा मुझे आपकी परवाह है। यह ऐसा कुछ नहीं है जिसमें मैं कोचिंग कर सकूँ, और मैं ऐसे नंबर नहीं देना चाहता जो इसे और कठिन बना दें। कृपया Butterfly Foundation को 1800 33 4673 पर, और eating disorders के अनुभवी डॉक्टर या डाइटीशियन से संपर्क करें। आप सही सहायता के हक़दार हैं।',
    under_18:
      'ईमानदारी के लिए धन्यवाद। StrengthHub की कोचिंग 18 साल और उससे अधिक उम्र के लोगों के लिए बनाई गई है, इसलिए मैं यहाँ आपकी कोचिंग जारी नहीं रख सकता। माता-पिता या अभिभावक, एक PE शिक्षक, या एक योग्य कोच या स्वास्थ्य पेशेवर आपको सुरक्षित रूप से ट्रेनिंग में मदद करने के लिए सही लोग होंगे।',
    age_unverified:
      'जब तक आपकी जन्मतिथि आपकी StrengthHub प्रोफ़ाइल में सत्यापित नहीं हो जाती, मैं व्यक्तिगत कोचिंग शुरू नहीं कर सकता। कृपया इसे अपने अकाउंट विवरण में अपडेट करें, और फिर दोबारा कोशिश करें।',
  },
  ar: {
    immediate_danger:
      'أنا قلق جدًا على سلامتك، وهذا خارج نطاق ما يمكنني مساعدتك فيه كمدرّب لياقة. إذا كنت في خطر الآن أو تفكّر في الإقدام على ذلك، فيرجى الاتصال بالرقم 000 فورًا. يمكنك أيضًا الاتصال أو إرسال رسالة إلى خط Lifeline على الرقم 13 11 14 في أي وقت. أنت لست وحدك.',
    crisis_concern:
      'يؤسفني أنك تشعر بهذا، وأريد أن أتأكد من حصولك على دعم حقيقي — وهذا خارج نطاق ما يمكنني مساعدتك فيه كمدرّب لياقة. يرجى التواصل مع خط Lifeline على الرقم 13 11 14، أو خدمة Suicide Call Back على الرقم 1300 659 467. وإذا كنت في خطر فوري، فاتصل بالرقم 000. لست مضطرًا لمواجهة هذا وحدك.',
    third_party_crisis:
      'من الجيد أنك تهتم بهم. إذا كانوا قد يكونون في خطر فوري، فيرجى الاتصال بالرقم 000. يمكن لخط Lifeline (13 11 14) إرشادك حول كيفية دعم شخص معرّض للخطر، ومن الأفضل ألا تتركه بمفرده إذا كان البقاء آمنًا لك. هذا خارج نطاق ما يمكنني مساعدتك فيه كمدرّب لياقة.',
    medical_emergency:
      'قد تكون هذه حالة طبية طارئة — فيرجى التوقف والاتصال بالرقم 000 الآن، فهذا أهم من أي تمرين. إذا استطعت، انتقل إلى مكان آمن ريثما تصل المساعدة. لا أستطيع تقديم إرشاد تدريبي في هذه الحالة.',
    overdose_poisoning:
      'أرجو ألا تتأخر في هذا. اتصل بمركز معلومات السموم على الرقم 13 11 26 (24/7) فورًا للحصول على المشورة. وإذا كان الشخص قد فقد الوعي أو يعاني صعوبة في التنفس أو تشنجات أو يبدو في حالة خطيرة، فاتصل بالرقم 000 بدلًا من ذلك. لا يمكنني تقديم مشورة حول الجرعات أو العلاج.',
    disordered_eating:
      'شكرًا لإخباري — يبدو هذا صعبًا حقًا، وأنا أهتم بحالك أكثر من أي هدف تدريبي. هذا ليس أمرًا أستطيع تقديم إرشاد بشأنه، ولا أريد إعطاء أرقام قد تزيد الأمر صعوبة. يرجى التواصل مع مؤسسة Butterfly على الرقم 1800 33 4673، ومع طبيب أو أخصائي تغذية لديه خبرة في اضطرابات الأكل. أنت تستحق دعمًا مناسبًا.',
    under_18:
      'شكرًا لصراحتك. تدريب StrengthHub مُعدّ لمن هم في سن 18 فأكثر، لذا لا يمكنني الاستمرار في تدريبك هنا. وليّ الأمر أو أحد الوالدين، أو مُدرّس التربية البدنية، أو مدرّب أو مختص صحي مؤهل، هم الأشخاص المناسبون لمساعدتك على التدريب بأمان.',
    age_unverified:
      'لا يمكنني بدء تدريب شخصي حتى يتم التحقق من تاريخ ميلادك في ملفك على StrengthHub. يرجى تحديثه في تفاصيل حسابك ثم المحاولة مرة أخرى.',
  },
  vi: {
    immediate_danger:
      'Tôi thực sự lo lắng cho sự an toàn của bạn, và điều này vượt quá những gì tôi có thể giúp với vai trò huấn luyện viên thể hình. Nếu bạn đang gặp nguy hiểm ngay bây giờ hoặc đang nghĩ đến việc làm điều đó, xin hãy gọi 000 ngay. Bạn cũng có thể gọi hoặc nhắn tin cho Lifeline theo số 13 11 14 bất cứ lúc nào. Bạn không hề đơn độc.',
    crisis_concern:
      'Tôi rất tiếc khi bạn cảm thấy như vậy, và tôi muốn chắc chắn bạn nhận được sự hỗ trợ đúng đắn — điều này vượt quá những gì tôi có thể giúp với vai trò huấn luyện viên. Xin hãy liên hệ Lifeline theo số 13 11 14, hoặc Suicide Call Back Service theo số 1300 659 467. Nếu bạn đang gặp nguy hiểm tức thời, hãy gọi 000. Bạn không phải đối mặt với điều này một mình.',
    third_party_crisis:
      'Thật tốt khi bạn quan tâm đến họ. Nếu họ có thể đang gặp nguy hiểm tức thời, xin hãy gọi 000. Lifeline (13 11 14) có thể hướng dẫn bạn cách hỗ trợ một người đang gặp rủi ro, và tốt nhất đừng để họ một mình nếu bạn ở lại được an toàn. Điều này vượt quá những gì tôi có thể giúp với vai trò huấn luyện viên.',
    medical_emergency:
      'Đây có thể là một tình huống cấp cứu y tế — xin hãy dừng lại và gọi 000 ngay, điều đó quan trọng hơn bất kỳ buổi tập nào. Nếu có thể, hãy di chuyển đến nơi an toàn trong khi chờ trợ giúp. Tôi không thể hướng dẫn tập luyện trong trường hợp này.',
    overdose_poisoning:
      'Xin đừng chần chừ. Hãy gọi Trung tâm Thông tin Chất độc theo số 13 11 26 (24/7) ngay để được tư vấn. Nếu người đó đã ngất, khó thở, co giật hoặc có vẻ nguy kịch, hãy gọi 000 thay vào đó. Tôi không thể tư vấn về liều lượng hay cách điều trị.',
    disordered_eating:
      'Cảm ơn bạn đã cho tôi biết — nghe có vẻ thật sự khó khăn, và tôi quan tâm đến bạn hơn bất kỳ mục tiêu tập luyện nào. Đây không phải điều tôi có thể hướng dẫn, và tôi không muốn đưa ra những con số có thể khiến mọi việc khó khăn hơn. Xin hãy liên hệ Butterfly Foundation theo số 1800 33 4673, và một bác sĩ hoặc chuyên gia dinh dưỡng có kinh nghiệm về rối loạn ăn uống. Bạn xứng đáng được hỗ trợ đúng cách.',
    under_18:
      'Cảm ơn bạn đã thành thật. Việc huấn luyện của StrengthHub dành cho người từ 18 tuổi trở lên, nên tôi không thể tiếp tục huấn luyện bạn ở đây. Cha mẹ hoặc người giám hộ, một giáo viên thể dục, hoặc một huấn luyện viên hay chuyên gia y tế có chuyên môn sẽ là những người phù hợp để giúp bạn tập luyện an toàn.',
    age_unverified:
      'Tôi chưa thể bắt đầu huấn luyện cá nhân hoá cho đến khi ngày sinh của bạn được xác minh trong hồ sơ StrengthHub. Xin hãy cập nhật trong phần thông tin tài khoản, rồi thử lại.',
  },
}

/** True when a localised body exists for this language + key. */
export function hasLocalizedResponse(key: string | null, lang: ResponseLang): boolean {
  return !!(key && lang !== 'en' && TEXT[lang as Exclude<ResponseLang, 'en'>]?.[key])
}

/**
 * The localised AU response for a key, reusing the AU tap-to-call buttons (dial values are numbers,
 * so they are language-independent). Returns null when there is no translation (caller falls back to
 * the English/locale response). AU-context only — non-AU callers should NOT use this.
 */
export function localizedResponseAU(key: string | null, lang: ResponseLang): FixedResponse | null {
  if (!hasLocalizedResponse(key, lang)) return null
  const text = TEXT[lang as Exclude<ResponseLang, 'en'>][key as string]
  const base = RESPONSES[key as string]
  return { text, buttons: base?.buttons ?? [], noAI: base?.noAI ?? true }
}
