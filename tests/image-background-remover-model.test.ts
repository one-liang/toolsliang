import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import {
  backgroundRemovalBudgets,
  backgroundRemovalCandidates,
  backgroundRemovalDecision,
  backgroundRemovalPermittedLicences,
  backgroundRemovalRuntime,
  redistributableCandidates,
} from '@/features/tools/image-background-remover/domain/reference'
import {
  backgroundRemovalAssets,
  inferenceRuntimeAsset,
  portraitMattingModel,
  portraitModelAsset,
} from '@/features/tools/image-background-remover/domain/model'
import { imageInputLimits } from '@/features/images/limits'
import { getTool, offlineAssetPathPrefix } from '@/features/tools/catalog'

/** The tool serves these from `public/`, so the shipped bytes live at the same path. */
const shipped = (url: string) => `public${url}`

async function digestOf(path: string) {
  return createHash('sha256').update(await readFile(path)).digest('hex')
}

describe('人像去背選定方案', () => {
  it('採用 T18 決策紀錄推薦的人像候選，不自行挑選其他權重', () => {
    expect(portraitMattingModel.candidateId).toBe(backgroundRemovalDecision.recommendedCandidateId)
    expect(portraitMattingModel.scope).toBe(backgroundRemovalDecision.recommendedScope)
    expect(portraitMattingModel.scope).toBe('portrait')
  })

  it('模型的前處理與授權欄位逐字沿用決策紀錄，沒有第二份真相', () => {
    const candidate = backgroundRemovalCandidates.find(entry => entry.id === portraitMattingModel.candidateId)!
    expect(portraitMattingModel.input).toEqual(candidate.input)
    expect(portraitMattingModel.output).toEqual(candidate.output)
    expect(portraitMattingModel.licence).toBe(candidate.licence)
    expect(portraitModelAsset.bytes).toBe(candidate.bytes)
    expect(portraitModelAsset.sha256).toBe(candidate.sha256)
  })

  it('只採用授權經三方查證、可自行散布的權重', () => {
    expect(redistributableCandidates.map(candidate => candidate.id)).toContain(portraitMattingModel.candidateId)
    expect(backgroundRemovalPermittedLicences as readonly string[]).toContain(portraitMattingModel.licence)
  })

  it('模型與 runtime 都由本站的版本化路徑提供，執行期不連任何第三方', () => {
    for (const asset of backgroundRemovalAssets) {
      expect(asset.url.startsWith(`${offlineAssetPathPrefix}/`)).toBe(true)
      expect(asset.url).toContain(asset.version)
      expect(asset.url).not.toMatch(/^https?:/)
    }
    expect(inferenceRuntimeAsset.version).toBe(backgroundRemovalRuntime.version)
  })

  it('隨版本控制提交的檔案就是宣告的位元組，位元不同即為 model_digest_mismatch', async () => {
    for (const asset of backgroundRemovalAssets) {
      const path = shipped(asset.url)
      expect((await stat(path)).size).toBe(asset.bytes)
      expect(await digestOf(path)).toBe(asset.sha256)
    }
  })

  it('首次下載量落在規格 §12.8 的傳輸預算內', () => {
    const total = backgroundRemovalAssets.reduce((sum, asset) => sum + asset.bytes, 0)
    expect(total).toBeLessThanOrEqual(backgroundRemovalBudgets.maxCompressedTransferBytes * 2)
    expect(portraitModelAsset.bytes).toBeLessThanOrEqual(backgroundRemovalBudgets.maxCompressedTransferBytes)
  })

  it('工具註冊的離線資產就是模型與 runtime 本身', () => {
    const tool = getTool('image-background-remover')!
    expect(tool.offlineMode).toBe('requires-first-download')
    expect(tool.offlineAssets).toEqual(backgroundRemovalAssets)
  })

  it('輸入上限與其他圖片工具共用同一組本機限制', () => {
    expect(imageInputLimits).toEqual({ maxBytes: 25 * 1024 * 1024, maxPixels: 24_000_000, maxSide: 8192 })
    expect(readFileSync('app/features/tools/image-background-remover/engine.ts', 'utf8')).toContain('imageInputLimits')
    expect(readFileSync('app/features/tools/image-background-remover/background-removal.worker.ts', 'utf8')).toContain('exceedsImageLimits')
  })
})
