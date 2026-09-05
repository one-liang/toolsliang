import type { PublishedToolDefinition } from '@/features/tools/catalog'

/**
 * Document boundary for the local random picker: which sources back the
 * equal-probability claim, and which caveats have to sit next to the result.
 * Separated from the sampling constants because it changes when a source is
 * re-reviewed, not when a ceiling or a policy changes.
 */

/** Names the reviewed set of fairness decisions the tool follows, by review date. */
export const randomPickerReferenceVersion = 'random-picker-2026-09-05'

/**
 * Every caveat must appear next to the result, in both locales. A local draw
 * has no witness, so the page has to say what the result can and cannot be used
 * for before anyone acts on it.
 */
export const randomPickerCaveatKeys = [
  'equal-probability-scope',
  'no-audit',
  'not-a-lottery',
  'duplicates-share-chances',
  'wheel-is-presentation',
  'local-processing',
] as const

export type RandomPickerCaveatKey = typeof randomPickerCaveatKeys[number]

export const randomPickerContentReview: PublishedToolDefinition['contentReview'] = {
  reviewedAt: '2026-09-05',
  sourceEdition: {
    'zh-tw': 'W3C Web Cryptography API 建議標準（2017 年 1 月 26 日）與 Durstenfeld 隨機排列演算法（Communications of the ACM，1964 年 7 月）',
    en: 'W3C Web Cryptography API Recommendation (January 26, 2017) and Durstenfeld\'s random permutation algorithm (Communications of the ACM, July 1964)',
  },
  sourceEffectiveAt: '2017-01-26',
  sources: [
    {
      title: {
        'zh-tw': 'W3C Web Cryptography API：getRandomValues 的密碼學強度要求',
        en: 'W3C Web Cryptography API: the cryptographic strength required of getRandomValues',
      },
      url: 'https://www.w3.org/TR/WebCryptoAPI/',
    },
    {
      title: {
        'zh-tw': 'MDN Web Docs：Crypto.getRandomValues()',
        en: 'MDN Web Docs: Crypto.getRandomValues()',
      },
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues',
    },
    {
      title: {
        'zh-tw': 'R. Durstenfeld：Algorithm 235, Random permutation（CACM 7(7), 1964）',
        en: 'R. Durstenfeld: Algorithm 235, Random permutation (CACM 7(7), 1964)',
      },
      url: 'https://dl.acm.org/doi/10.1145/364520.364540',
    },
  ],
}
