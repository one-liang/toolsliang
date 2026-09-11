import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  pdfSignatureBudgets,
  pdfSignatureExportMode,
  pdfSignatureFailureCodes,
  pdfSignatureLimits,
  pdfSignatureSelection,
} from '@/features/tools/pdf-signature/domain/reference'

/**
 * What the shipped worker actually wrote into a document, measured in three
 * browsers by `scripts/verify-pdf-signature-output.mjs`. The e2e suite drives
 * the interface and checks the bytes; this file is the pixel half of the same
 * claim, and it is deliberately strict: one stray pixel outside a placement, or
 * one changed pixel on a page nobody signed, fails the build.
 */
interface SignedPage {
  index: number
  pageCount: number
  widthPreserved: boolean
  heightPreserved: boolean
  rotationPreserved: boolean
  inkRatio: number
  seeThroughRatio: number
  strayInkPixels: number
  changedPixelsOutsidePlacement: number
  comparedPixels: number
}

interface VerificationRun {
  fixture: string
  outcome: 'ok' | 'refused' | 'export-refused' | 'error'
  code?: string
  expectedCode: string | null
  pageCount?: number
  encrypted?: boolean
  exportMode?: string
  exportDecrypted?: boolean
  originalBytesArePrefix?: boolean
  firstPagePreviewMs?: number
  exportMs?: number
  openStages?: string[]
  exportStages?: string[]
  signedPages?: SignedPage[]
  untouchedPage?: { index: number, changedPixels: number, comparedPixels: number }
  consoleErrors: string[]
  workerError: string | null
  unexpectedRequests: string[]
  localBlobReads: number
}

interface Verification {
  measuredAt: string
  previewScale: number
  signatureRect: { x: number, y: number, width: number, height: number }
  workerBundleBytes: number
  servedPaths: string[]
  browsers: Array<{ name: string, environment: { userAgent: string }, runs: VerificationRun[] }>
}

const verification = JSON.parse(
  readFileSync(resolve(process.cwd(), 'docs/research/data/010-pdf-signature-verification.json'), 'utf8'),
) as Verification

const browsers = verification.browsers
const runs = browsers.flatMap(browser => browser.runs.map(run => ({ browser: browser.name, ...run })))
const signed = runs.filter(run => run.outcome === 'ok')
const refused = runs.filter(run => run.expectedCode !== null)

describe('量測涵蓋範圍', () => {
  it('三個瀏覽器各跑完同一組文件', () => {
    expect(browsers.map(browser => browser.name).sort()).toEqual(['chromium', 'firefox', 'webkit'])
    const names = browsers.map(browser => browser.runs.map(run => run.fixture).join(','))
    expect(new Set(names).size, '三個瀏覽器的文件清單必須相同').toBe(1)
    expect(browsers[0]!.runs.length).toBeGreaterThanOrEqual(11)
  })

  it('涵蓋旋轉頁、偏移頁框、物件串流、交叉參考損壞、宣告動作的文件與兩種加密', () => {
    const covered = new Set(browsers[0]!.runs.map(run => run.fixture))

    for (const fixture of [
      'rotated-pages', 'offset-crop-box', 'object-stream', 'active-content', 'broken-xref',
      'encrypted-rc4-128', 'encrypted-aes-128', 'reference-20-page',
      'owner-password-restricted', 'truncated', 'page-cap-120',
    ]) {
      expect(covered, `缺少 ${fixture}`).toContain(fixture)
    }
  })

  it('每一次成功的簽名都真的讀回了頁面，不是空白紀錄', () => {
    expect(signed.length).toBe(24)
    for (const run of signed) {
      expect(run.signedPages?.length, `${run.browser}/${run.fixture}`).toBeGreaterThanOrEqual(1)
      for (const page of run.signedPages!) expect(page.comparedPixels).toBeGreaterThan(10_000)
    }
  })
})

describe('簽名落在預覽指出的位置', () => {
  it('矩形內看得到簽名，矩形外一個像素都沒有變', () => {
    for (const run of signed) {
      for (const page of run.signedPages!) {
        const where = `${run.browser}/${run.fixture}/第 ${page.index + 1} 頁`
        expect(page.inkRatio, `${where} 的簽名覆蓋率`).toBeGreaterThan(0.05)
        expect(page.strayInkPixels, `${where} 的越界簽名像素`).toBe(0)
        expect(page.changedPixelsOutsidePlacement, `${where} 的矩形外變動像素`).toBe(0)
      }
    }
  })

  it('簽名保有透明度：矩形內大部分的頁面內容仍然看得見', () => {
    for (const run of signed) {
      for (const page of run.signedPages!) {
        expect(page.seeThroughRatio, `${run.browser}/${run.fixture}/第 ${page.index + 1} 頁的透出比例`).toBeGreaterThan(0.5)
      }
    }
  })

  it('頁面尺寸、旋轉與頁數都沒有被輸出改動', () => {
    for (const run of signed) {
      for (const page of run.signedPages!) {
        expect(page.widthPreserved && page.heightPreserved, `${run.browser}/${run.fixture} 的頁面尺寸`).toBe(true)
        expect(page.rotationPreserved, `${run.browser}/${run.fixture} 的頁面旋轉`).toBe(true)
        expect(page.pageCount).toBe(run.pageCount)
      }
    }
  })

  it('沒有簽名的頁面讀回來一個像素都沒有變', () => {
    const checked = signed.filter(run => run.untouchedPage)
    expect(checked.length, '至少要有一份多頁文件檢查未簽頁').toBeGreaterThanOrEqual(3)
    for (const run of checked) {
      expect(run.untouchedPage!.changedPixels, `${run.browser}/${run.fixture} 的未簽頁`).toBe(0)
      expect(run.untouchedPage!.comparedPixels).toBeGreaterThan(10_000)
    }
  })
})

describe('兩種匯出方式', () => {
  it('未加密文件以增量更新寫出，原始位元組仍是檔案的開頭', () => {
    const plain = signed.filter(run => run.encrypted === false)
    expect(plain.length).toBeGreaterThan(0)
    for (const run of plain) {
      expect(run.exportMode, run.fixture).toBe(pdfSignatureSelection.exportModes.unencrypted)
      expect(run.exportMode).toBe(pdfSignatureExportMode({ encrypted: false }))
      expect(run.originalBytesArePrefix, `${run.browser}/${run.fixture} 應保留原始位元組`).toBe(true)
      expect(run.exportDecrypted).toBe(false)
    }
  })

  it('加密文件以完整重寫寫出，且輸出不再帶有原本的保護', () => {
    const encrypted = signed.filter(run => run.encrypted === true)
    expect(encrypted.length).toBeGreaterThanOrEqual(6)
    for (const run of encrypted) {
      expect(run.exportMode, run.fixture).toBe(pdfSignatureSelection.exportModes.encrypted)
      expect(run.exportMode).toBe(pdfSignatureExportMode({ encrypted: true }))
      expect(run.originalBytesArePrefix, `${run.browser}/${run.fixture} 不應是追加寫入`).toBe(false)
      expect(run.exportDecrypted).toBe(pdfSignatureSelection.encryptedExportIsDecrypted)
    }
  })

  it('每一次執行都跑完規格列出的階段，套用階段逐一數過每個簽名', () => {
    for (const run of signed) {
      expect(run.openStages).toEqual(['read', 'parse'])
      /* `apply` repeats once per placement, so the order is what matters here. */
      expect([...new Set(run.exportStages)]).toEqual(['apply', 'write'])
      expect(run.exportStages!.at(-1)).toBe('write')
      expect(run.exportStages!.filter(stage => stage === 'apply').length).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('必須被擋下的文件', () => {
  it('權限不允許修改、損毀與超過頁數上限都以既有的失敗代碼停止', () => {
    expect(refused.length).toBe(9)
    for (const run of refused) {
      expect(run.outcome, `${run.browser}/${run.fixture}`).toBe('refused')
      expect(run.code, `${run.browser}/${run.fixture}`).toBe(run.expectedCode)
      expect(pdfSignatureFailureCodes as readonly string[]).toContain(run.code)
      expect(run.signedPages, '被擋下的文件不得產生輸出').toBeUndefined()
    }
  })

  it('頁數上限就是 domain 模組宣告的那一個', () => {
    const capped = refused.filter(run => run.expectedCode === 'too_many_pages')
    expect(capped.length).toBe(3)
    expect(pdfSignatureLimits.maxPages).toBe(100)
  })
})

describe('預算與邊界', () => {
  it('代表性 20 頁文件的首頁預覽與匯出都遠低於規格預算', () => {
    const reference = signed.filter(run => run.fixture === 'reference-20-page')
    expect(reference.length).toBe(3)
    for (const run of reference) {
      expect(run.firstPagePreviewMs, `${run.browser} 的首頁預覽`).toBeLessThan(pdfSignatureBudgets.firstPagePreviewMs)
      expect(run.exportMs, `${run.browser} 的匯出`).toBeLessThan(pdfSignatureBudgets.exportMs)
    }
  })

  it('量測時使用的預覽倍率就是工具使用的倍率', () => {
    expect(verification.previewScale).toBe(pdfSignatureLimits.previewScale)
  })

  it('整個量測期間沒有主控台錯誤、沒有 Worker 崩潰，也沒有任何對外請求', () => {
    for (const run of runs) {
      expect(run.consoleErrors, `${run.browser}/${run.fixture}`).toEqual([])
      expect(run.workerError, `${run.browser}/${run.fixture}`).toBeNull()
      expect(run.unexpectedRequests, `${run.browser}/${run.fixture}`).toEqual([])
    }
  })

  it('只提供 harness、Worker、pdf.js 與合成文件，沒有其他來源', () => {
    /* The browser asks for a favicon on its own and the server has none; it is
     * named here rather than filtered out, so the list stays a full account of
     * everything that was asked for. */
    for (const path of verification.servedPaths) {
      expect(path).toMatch(/^\/(favicon\.ico|harness\.html|engine-worker\.mjs|vendor\/pdf(\.worker)?\.mjs|fixtures\/[a-z0-9-]+\.pdf)$/)
    }
  })
})
