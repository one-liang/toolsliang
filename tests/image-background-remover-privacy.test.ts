import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { backgroundRemoverCanaries } from './support/image-background-remover-canaries'
import { inspectNetworkRequest } from './e2e/support/privacy-boundary'
import { backgroundRemovalAssets } from '@/features/tools/image-background-remover/domain/model'

const policy = { allowedOrigins: ['https://toolsliang.com'] }

it.each(backgroundRemoverCanaries)('同源 GET 不得夾帶圖片、遮罩或輸出：$label', (canary) => {
  expect(inspectNetworkRequest({ url: `https://toolsliang.com/collect?value=${encodeURIComponent(canary.value)}`, method: 'GET', headers: {}, body: null }, backgroundRemoverCanaries, policy).length).toBeGreaterThan(0)
})

it('模型與 runtime 是公開資產，取得它們不算工具內容外流', () => {
  for (const asset of backgroundRemovalAssets) {
    expect(inspectNetworkRequest({ url: `https://toolsliang.com${asset.url}`, method: 'GET', headers: {}, body: null }, backgroundRemoverCanaries, policy)).toEqual([])
  }
})

/**
 * The weights are provenance-tracked in the T18 record, but nothing that runs
 * in a browser may reach for them: every shipped module of this tool must name
 * this site's own paths only.
 */
it.each([
  'app/features/tools/image-background-remover/engine.ts',
  'app/features/tools/image-background-remover/domain/model.ts',
  'app/features/tools/image-background-remover/background-removal.worker.ts',
  'app/components/ImageBackgroundRemoverWorkspace.vue',
])('執行期模組不含任何第三方位址：%s', (path) => {
  expect(readFileSync(path, 'utf8')).not.toMatch(/https?:\/\//)
})

it('去背輸出以工具自己的檔名下載，不沿用原始檔名', () => {
  const workspace = readFileSync('app/components/ImageBackgroundRemoverWorkspace.vue', 'utf8')
  expect(workspace).toContain('background-removed.png')
  expect(workspace).not.toMatch(/:download="[^"]*\.name/)
})
