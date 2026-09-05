import { bmiSupportedRange, type BmiFieldError, type BmiFieldId } from './domain/calculate'
import type { BmiCategory } from './domain/reference'
import { bmiCaveatKeys, type BmiCaveatKey } from './domain/sources'
import type { ToolFaqEntry } from '../faq'
import { hasLocalizedCopy, type LocaleCode, type LocalizedCopy } from '../catalog'

/**
 * Everything the BMI workspace and page say out loud. It sits beside the
 * calculator rather than inside the component because the health-information
 * boundary is reviewed as content: the caveats keep the wording published in
 * docs/research/001-bmi-formula-and-health-sources.md §6.1, and the questions
 * keep the ones approved in §7. Error messages are built from the shared range
 * constants so a bound can never be retyped into a message it does not match.
 */

const { metric, imperial } = bmiSupportedRange

const bmiCopyEntries = {
  unitLegend: { 'zh-tw': '輸入單位', en: 'Units' },
  unitMetric: { 'zh-tw': '公制（公分、公斤）', en: 'Metric (cm, kg)' },
  unitImperial: { 'zh-tw': '英制（英尺、英吋、磅）', en: 'Imperial (ft, in, lb)' },
  heightCentimetresLabel: { 'zh-tw': '身高（公分）', en: 'Height (cm)' },
  heightFeetLabel: { 'zh-tw': '身高（英尺）', en: 'Height (ft)' },
  heightInchesLabel: { 'zh-tw': '身高（英吋）', en: 'Height (in)' },
  weightKilogramsLabel: { 'zh-tw': '體重（公斤）', en: 'Weight (kg)' },
  weightPoundsLabel: { 'zh-tw': '體重（磅）', en: 'Weight (lb)' },
  heightCentimetresHint: {
    'zh-tw': `支援 ${metric.heightCentimetres.min} 到 ${metric.heightCentimetres.max} 公分，最多兩位小數。`,
    en: `From ${metric.heightCentimetres.min} to ${metric.heightCentimetres.max} cm, up to two decimal places.`,
  },
  heightImperialHint: {
    'zh-tw': `支援 ${imperial.height.minFeet} 英尺 ${imperial.height.minInches} 英吋 到 ${imperial.height.maxFeet} 英尺 ${imperial.height.maxInches} 英吋；英尺請填整數，留空的一欄視為 0。`,
    en: `From ${imperial.height.minFeet} ft ${imperial.height.minInches} in to ${imperial.height.maxFeet} ft ${imperial.height.maxInches} in; whole feet, and a blank box counts as zero.`,
  },
  weightKilogramsHint: {
    'zh-tw': `支援 ${metric.weightKilograms.min} 到 ${metric.weightKilograms.max} 公斤，最多兩位小數。`,
    en: `From ${metric.weightKilograms.min} to ${metric.weightKilograms.max} kg, up to two decimal places.`,
  },
  weightPoundsHint: {
    'zh-tw': `支援 ${imperial.weightPounds.min} 到 ${imperial.weightPounds.max} 磅，最多兩位小數。`,
    en: `From ${imperial.weightPounds.min} to ${imperial.weightPounds.max} lb, up to two decimal places.`,
  },
  resultLabel: { 'zh-tw': '計算結果', en: 'Result' },
  resultEmpty: {
    'zh-tw': '填入身高與體重後，這裡會顯示 BMI 數值與分級。',
    en: 'Enter height and weight to see the BMI value and its category here.',
  },
  resultCategoryLabel: { 'zh-tw': '分級', en: 'Category' },
  resultSummary: {
    'zh-tw': '依國民健康署成人健康體位標準判定。',
    en: 'Categorized with the Health Promotion Administration adult standard.',
  },
  resetLabel: { 'zh-tw': '重設', en: 'Reset' },
  caveatsTitle: { 'zh-tw': '這個結果不能用來做什麼', en: 'What this result cannot do' },
  formulaTitle: { 'zh-tw': '計算方式', en: 'How it is calculated' },
  formula: {
    'zh-tw': 'BMI ＝ 體重（公斤）÷ 身高（公尺）÷ 身高（公尺）',
    en: 'BMI = weight (kg) ÷ height (m) ÷ height (m)',
  },
  formulaNote: {
    'zh-tw': '英制輸入會先以 1 英吋 0.0254 公尺、1 磅 0.45359237 公斤換算後再計算。',
    en: 'Imperial entries are converted at 0.0254 m per inch and 0.45359237 kg per pound before the formula runs.',
  },
  categoryTableTitle: { 'zh-tw': '公式與成人分級', en: 'Formula and adult categories' },
  categoryTableCaption: { 'zh-tw': '成人 BMI 分級與對應範圍', en: 'Adult BMI categories and their ranges' },
  categoryColumn: { 'zh-tw': '分級', en: 'Category' },
  rangeColumn: { 'zh-tw': 'BMI 範圍', en: 'BMI range' },
  sourceLabel: { 'zh-tw': '分級依據', en: 'Category source' },
  sourceUpdatedLabel: { 'zh-tw': '來源更新日', en: 'Source updated' },
} satisfies Record<string, LocalizedCopy>

export type BmiCopyKey = keyof typeof bmiCopyEntries
export const bmiCopyKeys = Object.keys(bmiCopyEntries) as BmiCopyKey[]
export const bmiCopy: Record<BmiCopyKey, LocalizedCopy> = bmiCopyEntries

/** Section 6.1: shown next to the result, complete, in both locales. */
export const bmiCaveats: Record<BmiCaveatKey, LocalizedCopy> = {
  'not-a-diagnosis': {
    'zh-tw': 'BMI 是體位篩檢的參考值，不是醫療診斷，也不用來評估疾病風險。',
    en: 'BMI is a screening reference, not a medical diagnosis or a disease risk assessment.',
  },
  'adults-only': {
    'zh-tw': '這裡的分級只適用 18 歲（含）以上成人；未滿 18 歲需依年齡與性別對照百分位。',
    en: 'These categories apply to adults aged 18 and over; people under 18 need age- and sex-specific percentiles.',
  },
  'body-composition': {
    'zh-tw': 'BMI 不區分脂肪、肌肉與骨質，也看不出脂肪長在哪裡。',
    en: 'BMI does not distinguish fat, muscle, or bone mass, and does not show where fat is carried.',
  },
  'pregnancy': {
    'zh-tw': '懷孕期間不適用；孕期體重另有以孕前 BMI 為基準的建議增重範圍。',
    en: 'It does not apply during pregnancy; gestational weight gain follows guidance based on pre-pregnancy BMI.',
  },
  'older-adults': {
    'zh-tw': '長者、肌肉量高或身體組成特殊的人，結果僅供參考。',
    en: 'For older adults or people with atypical body composition, treat the result as reference only.',
  },
  'professional-advice': {
    'zh-tw': '需要健康判斷或體重管理計畫時，請諮詢醫事人員。',
    en: 'Consult a health professional for any health decision or weight management plan.',
  },
}

/** Section 7: the visible questions, and the only ones the page publishes as structured data. */
export const bmiFaq: ToolFaqEntry[] = [
  {
    heading: { 'zh-tw': 'BMI 如何計算？', en: 'How is BMI calculated?' },
    body: {
      'zh-tw': 'BMI ＝ 體重（公斤）÷ 身高（公尺）÷ 身高（公尺）。選英制時，會先把英尺、英吋與磅換算成公尺與公斤，再套用同一條公式。',
      en: 'BMI = weight (kg) ÷ height (m) ÷ height (m). Imperial entries are converted to metres and kilograms first, then the same formula runs.',
    },
  },
  {
    heading: { 'zh-tw': '台灣成人的 BMI 分級標準是什麼？', en: 'What are Taiwan\'s adult BMI categories?' },
    body: {
      'zh-tw': '依國民健康署「成人健康體位標準」分為四級：體重過輕 BMI < 18.5、健康體重 18.5 ≦ BMI < 24、體重過重 24 ≦ BMI < 27、肥胖 BMI ≧ 27。',
      en: 'The Health Promotion Administration adult standard has four categories: underweight below 18.5, healthy weight from 18.5 to under 24, overweight from 24 to under 27, and obesity at 27 and above.',
    },
  },
  {
    heading: { 'zh-tw': '為什麼台灣的過重界線是 24，不是 WHO 的 25？', en: 'Why does Taiwan use 24 instead of the WHO cut-off of 25?' },
    body: {
      'zh-tw': '24 與 27 是國民健康署公告的成人界線，本工具依台灣主管機關的標準判定。世界衛生組織的國際分級為 25 與 30；WHO 2004 年的亞洲族群專家諮詢指出亞洲族群在較低 BMI 即可能面對較高健康風險，但它不是台灣界線的出處。中英文頁面採用同一組界線。',
      en: 'The cut-offs of 24 and 27 come from Taiwan\'s Health Promotion Administration, and this tool follows that standard. WHO\'s international categories use 25 and 30; a 2004 WHO expert consultation observed that Asian populations may face higher health risk at a lower BMI, but it is not the origin of Taiwan\'s numbers. Both language versions use the same cut-offs.',
    },
  },
  {
    heading: { 'zh-tw': '未滿 18 歲可以用這個工具嗎？', en: 'Can people under 18 use this tool?' },
    body: {
      'zh-tw': '不適用。這裡的分級只涵蓋 18 歲（含）以上成人；兒童與青少年要對照國民健康署依年齡與性別公布的生長身體質量指數建議值百分位。',
      en: 'No. These categories cover adults aged 18 and over only. Children and adolescents are read against the age- and sex-specific growth BMI percentiles published by the Health Promotion Administration.',
    },
  },
  {
    heading: { 'zh-tw': '懷孕可以用 BMI 判斷嗎？', en: 'Can BMI be used during pregnancy?' },
    body: {
      'zh-tw': '不適用。孕期體重以孕前 BMI 為基準另有建議增重範圍，不能把孕期體重套用成人分級。',
      en: 'No. Gestational weight gain follows separate guidance based on pre-pregnancy BMI, so pregnancy weight cannot be read against the adult categories.',
    },
  },
  {
    heading: { 'zh-tw': 'BMI 可以看出體脂肪或健康狀況嗎？', en: 'Does BMI measure body fat or health?' },
    body: {
      'zh-tw': '不能。BMI 不區分脂肪、肌肉與骨質，也看不出脂肪長在哪裡，它是體位篩檢的參考值，不是醫療診斷。',
      en: 'No. BMI does not distinguish fat, muscle, or bone mass and does not show where fat is carried; it is a screening reference, not a medical diagnosis.',
    },
  },
  {
    heading: { 'zh-tw': '英制身高體重怎麼換算？', en: 'How are imperial units converted?' },
    body: {
      'zh-tw': '採用 NIST 公布的精確係數：1 英吋 ＝ 0.0254 公尺、1 英尺 ＝ 0.3048 公尺、1 磅 ＝ 0.45359237 公斤。工具不使用 703 近似式，因為它會在界線附近改變分級。',
      en: 'With the exact NIST factors: 1 inch = 0.0254 m, 1 foot = 0.3048 m, 1 pound = 0.45359237 kg. The 703 approximation is not used, because it can shift the category near a boundary.',
    },
  },
  {
    heading: { 'zh-tw': '我輸入的身高體重會被上傳嗎？', en: 'Is my height and weight uploaded?' },
    body: {
      'zh-tw': '不會。身高、體重與計算結果只留在這個瀏覽器分頁，不會被保存、不會寫進網址，也不會送到 toolsliang 或第三方服務。',
      en: 'No. Height, weight, and the result stay in this browser tab; they are never stored, written into the URL, or sent to toolsliang or a third-party service.',
    },
  },
]

const bmiContentIssues = validateBmiContent()
if (bmiContentIssues.length) {
  throw new Error(`Invalid BMI content:\n${bmiContentIssues.join('\n')}`)
}

export function getBmiCopy(locale: LocaleCode): Record<BmiCopyKey, string> {
  return Object.fromEntries(
    bmiCopyKeys.map(key => [key, bmiCopy[key][locale]]),
  ) as Record<BmiCopyKey, string>
}

export function getBmiCaveats(locale: LocaleCode) {
  return bmiCaveatKeys.map(key => ({ key, text: bmiCaveats[key][locale] }))
}

/**
 * The published boundary of a category, written the way the source writes it.
 * It reads the same in both locales because it is arithmetic, and it is what
 * keeps a category legible without relying on colour.
 */
export function bmiCategoryRangeText(category: BmiCategory) {
  if (category.minInclusive === null) return `BMI < ${category.maxExclusive}`
  if (category.maxExclusive === null) return `BMI ≧ ${category.minInclusive}`

  return `${category.minInclusive} ≦ BMI < ${category.maxExclusive}`
}

export function bmiFieldErrorMessage(error: BmiFieldError, locale: LocaleCode) {
  return fieldErrorCopy(error)[locale]
}

function fieldErrorCopy(error: BmiFieldError): LocalizedCopy {
  const measureName = error.measure === 'height'
    ? { 'zh-tw': '身高', en: 'Height' }
    : { 'zh-tw': '體重', en: 'Weight' }

  switch (error.code) {
    case 'missing':
      return {
        'zh-tw': `還需要填寫${measureName['zh-tw']}。`,
        en: `${measureName.en} is still needed.`,
      }
    case 'non-positive':
      return {
        'zh-tw': `${measureName['zh-tw']}必須大於 0。`,
        en: `${measureName.en} must be greater than 0.`,
      }
    case 'invalid-number':
      return error.field === 'height-feet'
        ? { 'zh-tw': '英尺請填整數，例如 5。', en: 'Enter whole feet, for example 5.' }
        : {
            'zh-tw': '請填半形或全形數字，最多兩位小數，不使用千分位逗號或次方寫法。',
            en: 'Enter digits with up to two decimal places, without grouping commas or exponents.',
          }
    case 'out-of-range':
      return outOfRangeCopy(error.field, measureName)
  }
}

function outOfRangeCopy(field: BmiFieldId, measureName: LocalizedCopy): LocalizedCopy {
  switch (field) {
    case 'height-centimetres':
      return {
        'zh-tw': `${measureName['zh-tw']}支援 ${metric.heightCentimetres.min} 到 ${metric.heightCentimetres.max} 公分。`,
        en: `${measureName.en} is supported from ${metric.heightCentimetres.min} to ${metric.heightCentimetres.max} cm.`,
      }
    case 'weight-kilograms':
      return {
        'zh-tw': `${measureName['zh-tw']}支援 ${metric.weightKilograms.min} 到 ${metric.weightKilograms.max} 公斤。`,
        en: `${measureName.en} is supported from ${metric.weightKilograms.min} to ${metric.weightKilograms.max} kg.`,
      }
    case 'weight-pounds':
      return {
        'zh-tw': `${measureName['zh-tw']}支援 ${imperial.weightPounds.min} 到 ${imperial.weightPounds.max} 磅。`,
        en: `${measureName.en} is supported from ${imperial.weightPounds.min} to ${imperial.weightPounds.max} lb.`,
      }
    default:
      return {
        'zh-tw': `${measureName['zh-tw']}支援 ${imperial.height.minFeet} 英尺 ${imperial.height.minInches} 英吋 到 ${imperial.height.maxFeet} 英尺 ${imperial.height.maxInches} 英吋。`,
        en: `${measureName.en} is supported from ${imperial.height.minFeet} ft ${imperial.height.minInches} in to ${imperial.height.maxFeet} ft ${imperial.height.maxInches} in.`,
      }
  }
}

export function validateBmiContent() {
  const issues: string[] = []

  for (const key of bmiCopyKeys) {
    if (!hasLocalizedCopy(bmiCopy[key])) issues.push(`[copy:${key}] requires both locales`)
  }

  for (const key of bmiCaveatKeys) {
    if (!hasLocalizedCopy(bmiCaveats[key])) issues.push(`[caveat:${key}] requires both locales`)
  }
  for (const key of Object.keys(bmiCaveats)) {
    if (!bmiCaveatKeys.includes(key as BmiCaveatKey)) issues.push(`[caveat:${key}] is not a reviewed caveat`)
  }

  const questions = new Set<string>()
  for (const [index, entry] of bmiFaq.entries()) {
    if (!hasLocalizedCopy(entry.heading) || !hasLocalizedCopy(entry.body)) {
      issues.push(`[faq:${index}] requires both locales`)
    }
    if (questions.has(entry.heading['zh-tw'])) issues.push(`[faq:${index}] duplicate question`)
    questions.add(entry.heading['zh-tw'])
  }

  return issues
}
