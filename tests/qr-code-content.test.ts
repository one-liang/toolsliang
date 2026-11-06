import { describe, expect, it } from 'vitest'
import {
  describeQrPreview,
  describeQrReady,
  qrColorMessage,
  qrCopy,
  qrCopyKeys,
  qrFaq,
  qrPendingMessage,
  qrTooLongMessage,
  securityLabel,
  validateQrContent,
} from '@/features/tools/qr-code-generator/content'
import { qrCapacity } from '@/features/tools/qr-code-generator/domain/encode'
import { qrContentKinds, wifiSecurities } from '@/features/tools/qr-code-generator/domain/payload'
import { getTool, supportedLocales } from '@/features/tools/catalog'
import { getToolFaq } from '@/features/tools/faq'

function everyVisibleString() {
  const tool = getTool('qr-code-generator')!
  return supportedLocales.flatMap(locale => [
    ...qrCopyKeys.map(key => qrCopy[key][locale]),
    ...qrFaq.flatMap(entry => [entry.heading[locale], entry.body[locale]]),
    ...qrContentKinds.flatMap(kind => [describeQrPreview(kind, locale), describeQrReady(kind, locale)]),
    ...wifiSecurities.map(security => securityLabel(security, locale)),
    qrPendingMessage('wifi-ssid', locale), qrPendingMessage('wifi-password', locale),
    qrColorMessage('inverted', locale), qrColorMessage('low-contrast', locale),
    qrTooLongMessage(locale),
    tool.name[locale], tool.description[locale], tool.acceptedInput[locale], tool.localProcessingStatement[locale],
    tool.seo.title[locale], tool.seo.description[locale], tool.seo.answer[locale],
  ])
}

describe('QR Code generator content', () => {
  it('passes its own validation', () => {
    expect(validateQrContent()).toEqual([])
  })

  it('quotes the limits the encoder actually holds', () => {
    for (const locale of supportedLocales) {
      expect(qrTooLongMessage(locale)).toContain(qrCapacity.chineseCharacters.toLocaleString('en-US'))
      expect(qrTooLongMessage(locale)).toContain(qrCapacity.asciiCharacters.toLocaleString('en-US'))
    }
  })

  it('carries DENSO WAVE’s trademark notice, in its own English words', () => {
    expect(qrCopy.trademark.en).toBe('QR Code is registered trademark of DENSO WAVE INCORPORATED.')
    expect(qrCopy.trademark['zh-tw']).toContain('DENSO WAVE INCORPORATED 的註冊商標')
  })

  it('tells the visitor to scan before printing and that a printed code cannot change', () => {
    expect(qrCopy.scanReminder['zh-tw']).toContain('印刷前請先用手機實際掃一次')
    expect(qrCopy.scanReminder['zh-tw']).toContain('不能改內容')
    expect(qrCopy.scanReminder.en).toContain('Scan it with a phone before you print')
  })

  it('answers the six questions the issue asks for, on the page and in structured data', () => {
    expect(qrFaq.map(entry => entry.heading['zh-tw'])).toEqual([
      '產生的 QR Code 會過期嗎？',
      '印出去之後可以改內容嗎？',
      '可以免費拿來商用嗎？',
      'Wi-Fi QR Code 怎麼用？',
      '為什麼有些顏色不能用？',
      '我輸入的內容會被送出嗎？',
    ])
    expect(getToolFaq('qr-code-generator', 'zh-tw')).toHaveLength(qrFaq.length)
  })

  it('says QR Code, never the words CONTEXT.md asks the tool to avoid', () => {
    for (const text of everyVisibleString()) {
      expect(text, text).not.toMatch(/二維碼|QR 碼|QR碼|動態 QR Code 產生|前端處理|上傳/)
    }
  })

  it('keeps the search-only words in aliases and keywords, where they are matched rather than shown', () => {
    const tool = getTool('qr-code-generator')!
    expect([...tool.aliases['zh-tw'], ...tool.keywords['zh-tw']]).toEqual(expect.arrayContaining(['二維碼', 'QR碼']))
  })
})
