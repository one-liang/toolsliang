import type { ToolContentReview } from '@/features/tools/catalog'

/**
 * Health-information boundary for the BMI tool: which sources the page cites
 * and which caveats the page has to state. Separated from the
 * measurement constants because it changes whenever a source page is
 * re-reviewed, not when a range or precision rule changes.
 */

/** Names the reviewed edition of the Taiwan adult standard the tool follows. */
export const bmiReferenceVersion = 'hpa-adult-2025-09-11'

/**
 * Every caveat still has to reach the page, in both locales. Since #82 the
 * workspace holds only input and result: the first, second and fourth are the
 * one sentence of the before-you-start answer, the rest are answered in the FAQ.
 */
export const bmiCaveatKeys = [
  'not-a-diagnosis',
  'adults-only',
  'body-composition',
  'pregnancy',
  'older-adults',
  'professional-advice',
] as const

export type BmiCaveatKey = typeof bmiCaveatKeys[number]

/** Ready to register as the tool's contentReview once the tool page exists. */
export const bmiContentReview: ToolContentReview = {
  reviewedAt: '2026-09-05',
  sourceEdition: {
    'zh-tw': '衛生福利部國民健康署「成人健康體位標準」（2025 年 9 月 11 日更新）',
    en: 'Health Promotion Administration, MOHW, “Adult healthy body standards” (updated September 11, 2025)',
  },
  sourceEffectiveAt: '2025-09-11',
  sources: [
    {
      title: {
        'zh-tw': '國民健康署：成人健康體位標準',
        en: 'Health Promotion Administration: Adult healthy body standards',
      },
      description: {
        'zh-tw': 'BMI 的算法與成人四個分級的界線都依這份標準。',
        en: 'The BMI formula and the four adult category boundaries follow this standard.',
      },
      url: 'https://www.hpa.gov.tw/Pages/Detail.aspx?nodeid=542&pid=9737',
    },
    {
      title: {
        'zh-tw': '國民健康署：兒童與青少年生長身體質量指數(BMI)建議值',
        en: 'Health Promotion Administration: Recommended BMI values for children and adolescents',
      },
      description: {
        'zh-tw': '未滿 18 歲要依年齡與性別另外對照，所以不適用成人分級。',
        en: 'People under 18 are read by age and sex instead, so the adult categories do not apply.',
      },
      url: 'https://www.hpa.gov.tw/Pages/Detail.aspx?nodeid=542&pid=9547',
    },
    {
      title: {
        'zh-tw': '國民健康署孕產婦關懷網站：孕期體重過輕或過重對母嬰健康都有影響',
        en: 'HPA maternal care site: Gestational weight and maternal-infant health',
      },
      description: {
        'zh-tw': '懷孕期間的體重另有建議範圍，所以不適用成人分級。',
        en: 'Weight during pregnancy has its own recommended range, so the adult categories do not apply.',
      },
      url: 'https://mammy.hpa.gov.tw/Home/NewsKBContent?id=1919&type=01',
    },
    {
      title: {
        'zh-tw': '世界衛生組織：肥胖與過重',
        en: 'WHO: Obesity and overweight',
      },
      description: {
        'zh-tw': '國際通用的 BMI 定義，以及 25 與 30 的國際分級界線。',
        en: 'The international definition of BMI and its international cut-offs of 25 and 30.',
      },
      url: 'https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight',
    },
    {
      title: {
        'zh-tw': 'WHO 專家諮詢：亞洲族群適用的身體質量指數（Lancet 2004）',
        en: 'WHO expert consultation: Appropriate body-mass index for Asian populations (Lancet 2004)',
      },
      description: {
        'zh-tw': '亞洲族群在較低 BMI 就可能有較高健康風險的研究背景。',
        en: 'Background on why Asian populations may face higher health risk at a lower BMI.',
      },
      url: 'https://doi.org/10.1016/S0140-6736(03)15268-3',
    },
    {
      title: {
        'zh-tw': '美國疾病管制與預防中心：關於身體質量指數',
        en: 'CDC: About Body Mass Index (BMI)',
      },
      description: {
        'zh-tw': 'BMI 是篩檢用的數字，分不出脂肪和肌肉。',
        en: 'BMI is a screening number that cannot tell fat from muscle.',
      },
      url: 'https://www.cdc.gov/bmi/about/index.html',
    },
    {
      title: {
        'zh-tw': '美國國家標準與技術研究院：長度換算係數',
        en: 'US National Institute of Standards and Technology: length conversion factors',
      },
      description: {
        'zh-tw': '英吋、英尺換算成公尺的精確數值。',
        en: 'The exact values for turning inches and feet into metres.',
      },
      url: 'https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9',
    },
    {
      title: {
        'zh-tw': '美國國家標準與技術研究院：度量衡單位總表',
        en: 'US National Institute of Standards and Technology: tables of units of measurement',
      },
      description: {
        'zh-tw': '磅換算成公斤的精確數值。',
        en: 'The exact value for turning pounds into kilograms.',
      },
      url: 'https://www.nist.gov/system/files/documents/2025/12/30/appc-26-HB44-20251222.pdf',
    },
  ],
}
