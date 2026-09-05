import type { PublishedToolDefinition } from '@/features/tools/catalog'

/**
 * Health-information boundary for the BMI tool: which sources the page cites
 * and which caveats have to sit next to the result. Separated from the
 * measurement constants because it changes whenever a source page is
 * re-reviewed, not when a range or precision rule changes.
 */

/** Names the reviewed edition of the Taiwan adult standard the tool follows. */
export const bmiReferenceVersion = 'hpa-adult-2025-09-11'

/** Every caveat must appear next to the result, in both locales. */
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
export const bmiContentReview: PublishedToolDefinition['contentReview'] = {
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
      url: 'https://www.hpa.gov.tw/Pages/Detail.aspx?nodeid=542&pid=9737',
    },
    {
      title: {
        'zh-tw': '國民健康署：兒童與青少年生長身體質量指數(BMI)建議值',
        en: 'Health Promotion Administration: Recommended BMI values for children and adolescents',
      },
      url: 'https://www.hpa.gov.tw/Pages/Detail.aspx?nodeid=542&pid=9547',
    },
    {
      title: {
        'zh-tw': '國民健康署孕產婦關懷網站：孕期體重過輕或過重對母嬰健康都有影響',
        en: 'HPA maternal care site: Gestational weight and maternal-infant health',
      },
      url: 'https://mammy.hpa.gov.tw/Home/NewsKBContent?id=1919&type=01',
    },
    {
      title: {
        'zh-tw': '世界衛生組織：肥胖與過重',
        en: 'WHO: Obesity and overweight',
      },
      url: 'https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight',
    },
    {
      title: {
        'zh-tw': 'WHO 專家諮詢：亞洲族群適用的身體質量指數（Lancet 2004）',
        en: 'WHO expert consultation: Appropriate body-mass index for Asian populations (Lancet 2004)',
      },
      url: 'https://doi.org/10.1016/S0140-6736(03)15268-3',
    },
    {
      title: {
        'zh-tw': '美國疾病管制與預防中心：關於身體質量指數',
        en: 'CDC: About Body Mass Index (BMI)',
      },
      url: 'https://www.cdc.gov/bmi/about/index.html',
    },
    {
      title: {
        'zh-tw': 'NIST SP 811 附錄 B.9：單位換算係數',
        en: 'NIST SP 811 Appendix B.9: Conversion factors',
      },
      url: 'https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9',
    },
    {
      title: {
        'zh-tw': 'NIST Handbook 44 附錄 C：度量衡單位總表',
        en: 'NIST Handbook 44 Appendix C: General tables of units of measurement',
      },
      url: 'https://www.nist.gov/system/files/documents/2025/12/30/appc-26-HB44-20251222.pdf',
    },
  ],
}
