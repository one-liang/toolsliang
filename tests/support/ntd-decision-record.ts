import type { NtdGoldenVector, NtdRejectionVector } from '@/features/tools/ntd-uppercase/domain/reference'
import { createDecisionRecordReader, parseJsonCell } from './decision-record'

const reader = createDecisionRecordReader('docs/research/002-ntd-uppercase-rules-and-sources.md')

/** The record verbatim, for asserting on the ids and URLs the page has to carry. */
export const ntdDecisionRecord = reader.record

const { parseKeyColumn, tableRows } = reader

/** Purpose and key columns stay strings: comparing them is the point. */
export interface DocumentedWordingVector extends Omit<NtdGoldenVector, 'purpose'> {
  purpose: string
}

export interface DocumentedRejectionVector extends Omit<NtdRejectionVector, 'purpose' | 'code'> {
  purpose: string
  code: string
}

export function parseWordingVectors(): DocumentedWordingVector[] {
  const pattern = /^\| `("(?:[^"\\]|\\.)*")` \| `([a-z]+)` \| `([^`]*)` \| ([^|]+?) \|/gm

  return tableRows('### 6.1 大寫結果向量', pattern).map(([, input, purpose, normalized, wording]) => ({
    input: parseJsonCell<string>(input!),
    purpose: purpose!,
    normalized: normalized!,
    wording: wording!.trim(),
  }))
}

export function parseRejectionVectors(): DocumentedRejectionVector[] {
  const pattern = /^\| `("(?:[^"\\]|\\.)*")` \| `([a-z]+)` \| `([a-z-]+)` \|/gm

  return tableRows('### 6.2 拒絕向量', pattern).map(([, input, purpose, code]) => ({
    input: parseJsonCell<string>(input!),
    purpose: purpose!,
    code: code!,
  }))
}

/** Error keys in the order the document lists them, which is the check order. */
export function parseErrorCodes(): string[] {
  return parseKeyColumn('### 5.5 錯誤情境')
}

export function parseCaveatKeys(): string[] {
  return parseKeyColumn('### 7.1 必須同時呈現的免責內容')
}
