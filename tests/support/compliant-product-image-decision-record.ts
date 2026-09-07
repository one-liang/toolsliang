import {
  createDecisionRecordReader,
  parseJsonCell,
  type DocumentedSentence,
  type LocalizedSentence,
} from './decision-record'

const reader = createDecisionRecordReader(
  'docs/research/005-compliant-product-image-presets-and-sources.md',
)

/** The record verbatim, for asserting on the ids, URLs and wording the tool has to carry. */
export const compliantImageDecisionRecord = reader.record

const { parseKeyColumn, tableRows } = reader

/**
 * Every row below keeps its key columns as plain strings. Comparing those
 * strings against the module's unions is the point of the reference test: a
 * value that only exists in one of the two places has to fail.
 */
export interface DocumentedSource {
  id: string
  url: string
  tier: string
  retrievability: string
  checkedAt: string
}

export interface DocumentedExclusion {
  channelId: string
  reason: string
  evidenceUrl: string
  recheckAt: string
}

export interface DocumentedPreset {
  id: string
  channelId: string
  role: string
  region: string
  sourceId: string
  coverage: string
  reviewedAt: string
}

export interface DocumentedRule {
  presetId: string
  ruleId: string
  kind: string
  authority: string
  verification: string
  value: Record<string, unknown>
  effectiveFrom: string | null
}

export interface DocumentedPresetStatusVector {
  presetId: string
  retiredAt: string | null
  date: string
  status: string
}

export interface DocumentedRuleStateVector {
  presetId: string
  ruleId: string
  date: string
  state: string
}

export interface DocumentedOutputCheckVector {
  presetId: string
  date: string
  candidate: { width: number, height: number, format: string, bytes: number }
  result: string
  failedRuleIds: string[]
}

export function parseChannelIds(): string[] {
  return parseKeyColumn('### 4.1 通路')
}

export function parseRoleKeys(): string[] {
  return parseKeyColumn('### 4.2 圖片用途')
}

export function parseAuthorityKeys(): string[] {
  return parseKeyColumn('### 4.3 規則層級')
}

export function parseVerificationKeys(): string[] {
  return parseKeyColumn('### 4.4 可驗證性')
}

export function parseConstraintKinds(): string[] {
  return parseKeyColumn('### 4.5 限制種類')
}

export function parseCoverageKeys(): string[] {
  return parseKeyColumn('### 4.6 來源涵蓋度')
}

export function parsePresetStatusKeys(): string[] {
  return parseKeyColumn('### 4.7 Preset 狀態')
}

export function parseRuleStateKeys(): string[] {
  return parseKeyColumn('### 4.8 規則生效狀態')
}

export function parseExclusionReasonKeys(): string[] {
  return parseKeyColumn('### 5.4 排除原因')
}

export function parseIngestionErrorCodes(): string[] {
  return parseKeyColumn('### 5.5 重查錯誤')
}

export function parseViewNoticeCodes(): string[] {
  return parseKeyColumn('### 5.6 檢視提示')
}

/** The sentences section 5.6 approves for each notice, in both locales. */
export function parseViewNoticeSentences(): DocumentedSentence[] {
  return reader.parseBilingualRows('### 5.6 檢視提示', 1)
}

export function parseSources(): DocumentedSource[] {
  const pattern = /^\| `([a-z0-9-]+)` \|(?:[^|]*\|){2} (\S+) \| `([a-z-]+)` \| `([a-z-]+)` \| `(\d{4}-\d{2}-\d{2})` \|/gm

  return tableRows('### 3.2 已納入來源', pattern)
    .map(([, id, url, tier, retrievability, checkedAt]) => ({
      id: id!,
      url: url!,
      tier: tier!,
      retrievability: retrievability!,
      checkedAt: checkedAt!,
    }))
}

export function parseSourceTiers(): string[] {
  return parseKeyColumn('### 3.4 來源層級')
}

export function parseRetrievabilityKeys(): string[] {
  return parseKeyColumn('### 3.5 可取得性')
}

export function parseExclusions(): DocumentedExclusion[] {
  const pattern = /^\| `([a-z0-9-]+)` \| [^|]+ \| `([a-z-]+)` \| (\S+) \| `(\d{4}-\d{2}-\d{2})` \|/gm

  return tableRows('### 3.3 已排除通路', pattern)
    .map(([, channelId, reason, evidenceUrl, recheckAt]) => ({
      channelId: channelId!,
      reason: reason!,
      evidenceUrl: evidenceUrl!,
      recheckAt: recheckAt!,
    }))
}

export function parsePresets(): DocumentedPreset[] {
  const pattern = /^\| `([a-z0-9-]+)` \| `([a-z0-9-]+)` \| `([a-z-]+)` \| `([a-z-]+)` \| `([a-z0-9-]+)` \| `([a-z-]+)` \| `(\d{4}-\d{2}-\d{2})` \|/gm

  return tableRows('### 6.1 Preset 清單', pattern)
    .map(([, id, channelId, role, region, sourceId, coverage, reviewedAt]) => ({
      id: id!,
      channelId: channelId!,
      role: role!,
      region: region!,
      sourceId: sourceId!,
      coverage: coverage!,
      reviewedAt: reviewedAt!,
    }))
}

export function parseRules(): DocumentedRule[] {
  const pattern = /^\| `([a-z0-9-]+)` \| `([a-z-]+)` \| `([a-z-]+)` \| `([a-z-]+)` \| `([a-z-]+)` \| `(\{[^`]*\})` \| `(\d{4}-\d{2}-\d{2}|null)` \|/gm

  return tableRows('### 6.2 規則向量', pattern)
    .map(([, presetId, ruleId, kind, authority, verification, value, effectiveFrom]) => ({
      presetId: presetId!,
      ruleId: ruleId!,
      kind: kind!,
      authority: authority!,
      verification: verification!,
      value: parseJsonCell<Record<string, unknown>>(value!),
      effectiveFrom: effectiveFrom === 'null' ? null : effectiveFrom!,
    }))
}

export function parsePresetStatusVectors(): DocumentedPresetStatusVector[] {
  const pattern = /^\| `([a-z0-9-]+)` \| `(\d{4}-\d{2}-\d{2}|null)` \| `(\d{4}-\d{2}-\d{2})` \| `([a-z-]+)` \|/gm

  return tableRows('### 6.3 Preset 狀態向量', pattern)
    .map(([, presetId, retiredAt, date, status]) => ({
      presetId: presetId!,
      retiredAt: retiredAt === 'null' ? null : retiredAt!,
      date: date!,
      status: status!,
    }))
}

export function parseRuleStateVectors(): DocumentedRuleStateVector[] {
  const pattern = /^\| `([a-z0-9-]+)` \| `([a-z-]+)` \| `(\d{4}-\d{2}-\d{2})` \| `([a-z-]+)` \|/gm

  return tableRows('### 6.4 規則生效向量', pattern)
    .map(([, presetId, ruleId, date, state]) => ({
      presetId: presetId!,
      ruleId: ruleId!,
      date: date!,
      state: state!,
    }))
}

export function parseOutputCheckVectors(): DocumentedOutputCheckVector[] {
  const pattern = /^\| `([a-z0-9-]+)` \| `(\d{4}-\d{2}-\d{2})` \| `(\{[^`]*\})` \| `([a-z]+)` \| `(\[[^\]]*\])` \|/gm

  return tableRows('### 6.5 輸出檢查向量', pattern)
    .map(([, presetId, date, candidate, result, failedRuleIds]) => ({
      presetId: presetId!,
      date: date!,
      candidate: parseJsonCell<DocumentedOutputCheckVector['candidate']>(candidate!),
      result: result!,
      failedRuleIds: parseJsonCell<string[]>(failedRuleIds!),
    }))
}

export interface DocumentedPresetScope extends LocalizedSentence {
  presetId: string
  coverageGaps: string[]
}

/** Each preset's scope of application and the constraint kinds its source omits. */
export function parsePresetScopes(): DocumentedPresetScope[] {
  const pattern = /^\| `([a-z-]+)` \| `(\[[^\]]*\])` \| (.+?) \| (.+?) \|$/gm

  return tableRows('### 6.6 適用範圍與缺少的欄位', pattern)
    .map(([, presetId, coverageGaps, zh, en]) => ({
      presetId: presetId!,
      coverageGaps: parseJsonCell<string[]>(coverageGaps!),
      'zh-tw': zh!.trim(),
      en: en!.trim(),
    }))
}

export function parseCaveatKeys(): string[] {
  return parseKeyColumn('### 7.1 必須同時呈現的免責內容')
}

/** The disclaimer wording section 7.1 requires next to every preset, in both locales. */
export function parseCaveatSentences(): DocumentedSentence[] {
  return reader.parseBilingualRows('### 7.1 必須同時呈現的免責內容')
}

/** Every wording section 7.3 forbids, Chinese and English alike. */
export function parseForbiddenWording(): string[] {
  return reader.parseForbiddenWording('### 7.3 禁止用語')
}

/**
 * The questions section 7.4 approves as the only source of both the visible FAQ
 * and the FAQPage markup.
 */
export function parseFaqQuestions(): LocalizedSentence[] {
  return reader.parseFaqQuestions('### 7.4 AEO 問答依據')
}
