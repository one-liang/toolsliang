import { describe, expect, it } from 'vitest'
import * as bmiContent from '@/features/tools/bmi-calculator/content'
import * as brandPromoContent from '@/features/tools/brand-promo-image/content'
import * as deviceTimeContent from '@/features/tools/device-time/content'
import * as imageBackgroundRemoverContent from '@/features/tools/image-background-remover/content'
import * as imageCompressorContent from '@/features/tools/image-compressor/content'
import * as ntdContent from '@/features/tools/ntd-uppercase/content'
import * as pdfSignatureContent from '@/features/tools/pdf-signature/content'
import * as productImageWorkbenchContent from '@/features/tools/product-image-workbench/content'
import * as randomPickerContent from '@/features/tools/random-picker/content'
import * as rocYearContent from '@/features/tools/roc-year-converter/content'
import * as taiwanCalendarContent from '@/features/tools/taiwan-calendar/content'
import * as workingDayContent from '@/features/tools/working-day-calculator/content'
import {
  copy,
  publishedTools,
  supportedLocales,
  type LocaleCode,
  type PublishedToolDefinition,
} from '@/features/tools/catalog'
import { getToolFaq } from '@/features/tools/faq'
import { buildToolStructuredData } from '@/features/tools/structured-data'
import { isRewrittenElsewhere, technicalTermsIn } from './support/technical-terms'

/** Every string a content module exports, with the locale it is written in. */
function exportedStrings(module: Record<string, unknown>) {
  const found: Array<{ locale?: LocaleCode, text: string }> = []
  const seen = new Set<unknown>()

  function walk(value: unknown, locale?: LocaleCode) {
    if (typeof value === 'string') {
      found.push({ locale, text: value })
      return
    }
    if (!value || typeof value !== 'object' || seen.has(value)) return
    seen.add(value)
    for (const [key, child] of Object.entries(value)) {
      walk(child, supportedLocales.includes(key as LocaleCode) ? key as LocaleCode : locale)
    }
  }

  walk(module)
  return found
}

const contentModules: Record<string, Record<string, unknown>> = {
  'bmi-calculator': bmiContent,
  'brand-promo-image': brandPromoContent,
  'device-time': deviceTimeContent,
  'image-background-remover': imageBackgroundRemoverContent,
  'image-compressor': imageCompressorContent,
  'ntd-uppercase': ntdContent,
  'pdf-signature': pdfSignatureContent,
  'product-image-workbench': productImageWorkbenchContent,
  'random-picker': randomPickerContent,
  'roc-year-converter': rocYearContent,
  'taiwan-calendar': taiwanCalendarContent,
  'working-day-calculator': workingDayContent,
}

/** What the tool page itself prints, in one locale, outside the workspace component. */
function pageText(tool: PublishedToolDefinition, locale: LocaleCode) {
  const structuredData = JSON.stringify(buildToolStructuredData(tool, locale))

  return [
    copy(tool.name, locale),
    copy(tool.description, locale),
    copy(tool.seo.title, locale),
    copy(tool.seo.description, locale),
    copy(tool.seo.answer, locale),
    copy(tool.acceptedInput, locale),
    copy(tool.localProcessingStatement, locale),
    ...getToolFaq(tool.seo.contentKey, locale).flatMap(entry => [entry.heading, entry.body]),
    ...tool.contentReview
      ? [
          copy(tool.contentReview.sourceEdition, locale),
          ...tool.contentReview.sources.flatMap(source => [
            copy(source.title, locale),
            source.description ? copy(source.description, locale) : '',
          ]),
        ]
      : [],
    // Only the visible fields: URLs and schema keywords are not read by anyone.
    ...[...structuredData.matchAll(/"(?:name|description|text)":"((?:[^"\\]|\\.)*)"/g)].map(match => JSON.parse(`"${match[1]}"`) as string),
  ]
}

describe('tool pages in plain language', () => {
  it.each(publishedTools.map(tool => [tool.slug, tool] as const))('%s names no API, algorithm, library or specification', (slug, tool) => {
    const found = supportedLocales.flatMap(locale => pageText(tool, locale)
      .flatMap(text => technicalTermsIn(slug, text, locale).map(term => `${locale}｜${term}｜${text}`)))

    expect(found).toEqual([])
  })

  it.each(Object.entries(contentModules))('%s workspace copy names no API, algorithm, library or specification', (slug, module) => {
    const found = exportedStrings(module)
      .flatMap(({ locale, text }) => technicalTermsIn(slug, text, locale).map(term => `${locale ?? '—'}｜${term}｜${text}`))

    expect(found).toEqual([])
  })

  it('checks the workspace copy of every published tool that has its own content module', () => {
    const withoutModule = publishedTools
      .map(tool => tool.slug)
      .filter(slug => !contentModules[slug] && !isRewrittenElsewhere(slug))

    expect(withoutModule).toEqual([])
  })

  it('catches the wording this issue was opened about', () => {
    const before = [
      '工具以瀏覽器的密碼學隨機來源搭配拒絕取樣與 Fisher–Yates 抽出不重複的中選名單',
      'W3C Web Cryptography API：getRandomValues 的密碼學強度要求',
      'IndexedDB API 3.0 與 Storage 現行規格',
      'WHATWG Canvas／ImageBitmap 與圖片格式規格',
      'toolsliang 去背模型評估紀錄 007 與 MODNet、ONNX Runtime Web 一手來源',
      'HTML Canvas 編碼規格',
      'toolsliang PDF 引擎決策紀錄 009 與 ISO 32000-1、pdf.js、@cantoo/pdf-lib 一手來源',
    ]

    for (const text of before) expect(technicalTermsIn('any-tool', text, 'zh-tw'), text).not.toEqual([])
    expect(technicalTermsIn('any-tool', '把圖片放到畫布上', 'zh-tw')).toEqual([])
    expect(technicalTermsIn('any-tool', 'Set the canvas and background freely', 'en')).toEqual([])
  })
})

describe('the sources a tool page lists', () => {
  const reviewed = publishedTools.filter(tool => tool.contentReview && !isRewrittenElsewhere(tool.slug))

  it('are content a tool answers with, never how the tool is built', () => {
    const technicalHosts = /w3\.org|whatwg\.org|tc39\.es|developer\.mozilla\.org|rfc-editor\.org|onnxruntime\.ai|opensource\.adobe\.com|github\.com/

    for (const tool of reviewed) {
      for (const source of tool.contentReview!.sources) expect(source.url, tool.slug).not.toMatch(technicalHosts)
    }
  })

  it('each come with one plain sentence on what they settle, in both locales', () => {
    for (const tool of reviewed) {
      for (const source of tool.contentReview!.sources) {
        for (const locale of supportedLocales) {
          expect(source.description?.[locale]?.trim(), `${tool.slug}｜${source.url}｜${locale}`).toBeTruthy()
        }
      }
    }
  })

  it('are only listed by tools that rest on outside content; the rest say how they handle yours', () => {
    expect(reviewed.map(tool => tool.slug).sort())
      .toEqual(['bmi-calculator', 'ntd-uppercase', 'roc-year-converter', 'taiwan-calendar', 'working-day-calculator'])

    for (const tool of publishedTools.filter(candidate => !candidate.contentReview)) {
      expect(tool.pagePresentation.showLocalProcessingStatement, tool.slug).toBe(true)
      for (const locale of supportedLocales) expect(copy(tool.localProcessingStatement, locale).trim(), tool.slug).not.toBe('')
    }
  })
})
