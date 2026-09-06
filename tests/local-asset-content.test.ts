import { describe, expect, it } from 'vitest'
import {
  localAssetCopy,
  localAssetErrorMessage,
  localAssetKindLabel,
} from '@/features/shell/local-assets/content'
import { localAssetKinds } from '@/features/shell/local-assets/schema'
import type { LocalAssetErrorCode } from '@/features/shell/local-assets/repository'
import { supportedLocales } from '@/features/tools/catalog'

const errorCodes: LocalAssetErrorCode[] = [
  'unsupported', 'blocked', 'quota-exceeded', 'unsupported-version', 'corrupt-asset', 'missing-asset', 'invalid-bundle', 'empty-bundle', 'unknown',
]

describe('local asset copy', () => {
  it('names every asset kind in both languages', () => {
    for (const locale of supportedLocales) {
      for (const kind of localAssetKinds) {
        expect(localAssetKindLabel(kind, locale).length, `${kind} 缺少 ${locale} 名稱`).toBeGreaterThan(0)
      }
    }
  })

  it('explains every failure in both languages, and says what to do next', () => {
    for (const locale of supportedLocales) {
      for (const code of errorCodes) {
        const message = localAssetErrorMessage(code, locale)
        expect(message.title.length, `${code} 缺少 ${locale} 標題`).toBeGreaterThan(0)
        expect(message.recovery.length, `${code} 缺少 ${locale} 可恢復做法`).toBeGreaterThan(0)
      }
    }
  })

  it('states the device boundary the ADR requires, in both languages', () => {
    expect(localAssetCopy('zh-tw').boundary).toContain('這台裝置')
    expect(localAssetCopy('zh-tw').boundary).toContain('無痕')
    expect(localAssetCopy('zh-tw').boundary).toContain('同步')
    expect(localAssetCopy('en').boundary).toContain('this device')
    expect(localAssetCopy('en').boundary.toLowerCase()).toContain('private browsing')
    expect(localAssetCopy('en').boundary.toLowerCase()).toContain('sync')
  })

  it('offers the same actions in both languages', () => {
    expect(Object.keys(localAssetCopy('zh-tw'))).toEqual(Object.keys(localAssetCopy('en')))
  })
})
