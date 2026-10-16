import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { productImageWorkbenchCanaries } from './support/product-image-workbench-canaries'
import { inspectNetworkRequest } from './e2e/support/privacy-boundary'
import { productImageWorkbenchDefinition } from '@/features/tools/product-image-workbench/definition'
import { buildZipArchive } from '@/features/images/archive'
import { workbenchArchiveName, workbenchOutputName } from '@/features/tools/product-image-workbench/archive'
import { createPromoLayer } from '@/features/tools/brand-promo-image/scene'

const policy = { allowedOrigins: ['https://toolsliang.com'] }

function inspect(url: string) {
  return inspectNetworkRequest({ url, method: 'GET', headers: {}, body: null }, productImageWorkbenchCanaries, policy)
}

it.each(productImageWorkbenchCanaries)('同源 GET 不得夾帶任何一步的工具內容：$label', (canary) => {
  expect(inspect(`https://toolsliang.com/collect?step=${encodeURIComponent(canary.value)}`).length).toBeGreaterThan(0)
})

it('公開 Worker 程式 URL 不會被誤判為工具內容', () => {
  for (const worker of ['promo', 'image', 'background-removal', 'archive']) {
    expect(inspect(`https://toolsliang.com/_nuxt/${worker}.worker-publichash.js`)).toEqual([])
  }
})

it('版面文件只帶圖層的位置與種類，不含檔名、Blob 或像素', () => {
  const scene = { width: 1000, height: 1000, layers: [createPromoLayer('background', 'asset-1'), createPromoLayer('product', 'slot'), createPromoLayer('logo', 'asset-2')] }

  expect(JSON.stringify(scene)).not.toMatch(/private-workbench|blob:|data:/)
  expect(inspect(`https://toolsliang.com/?scene=${encodeURIComponent(JSON.stringify(scene))}`)).toEqual([])
})

it('輸出與封存檔名不帶來源檔名，只由工具名稱與序號組成', () => {
  expect(workbenchOutputName(7, 'image/png')).not.toContain('private-workbench')
  expect(workbenchArchiveName).not.toContain('private-workbench')
})

it('封存檔只寫入本機產生的名稱與內容，不寫入裝置時間', () => {
  const archive = buildZipArchive([{ name: workbenchOutputName(1, 'image/png'), bytes: new Uint8Array([1, 2, 3]) }])
  const names = new TextDecoder().decode(archive)

  expect(names).toContain('product-image-01.png')
  expect(names).not.toContain('private-workbench')
  expect(new DataView(archive.buffer).getUint16(10, true)).toBe(0)
})

it('工作台本身不宣告任何需要下載的離線資產', () => {
  expect(productImageWorkbenchDefinition.offlineMode).toBe('ready')
  expect(productImageWorkbenchDefinition.offlineAssets ?? []).toEqual([])
})

/** Every module the workbench runs names this site's own paths only. */
it.each([
  'app/composables/useProductWorkbench.ts',
  'app/components/ProductImageWorkbenchWorkspace.vue',
  'app/features/tools/product-image-workbench/archive.ts',
])('執行期模組不含任何第三方位址：%s', (path) => {
  expect(readFileSync(path, 'utf8')).not.toMatch(/https?:\/\//)
})
