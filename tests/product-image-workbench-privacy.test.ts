import { expect, it } from 'vitest'
import { productImageWorkbenchCanaries } from './support/product-image-workbench-canaries'
import { inspectNetworkRequest } from './e2e/support/privacy-boundary'
import { productImageWorkbenchDefinition } from '@/features/tools/product-image-workbench/definition'
import { planBrandScene, planLayoutInput } from '@/features/tools/product-image-workbench/pipeline'
import { buildZipArchive, workbenchArchiveName, workbenchOutputName } from '@/features/tools/product-image-workbench/archive'
import { admitWorkbenchFiles, createWorkbenchQueue, measureWorkbenchItem } from '@/features/tools/product-image-workbench/queue'
import { completeWorkbenchStep, createWorkbenchSession, startWorkbenchStep } from '@/features/tools/product-image-workbench/session'

const policy = { allowedOrigins: ['https://toolsliang.com'] }

function inspect(url: string) {
  return inspectNetworkRequest({ url, method: 'GET', headers: {}, body: null }, productImageWorkbenchCanaries, policy)
}

it.each(productImageWorkbenchCanaries)('同源 GET 不得夾帶任何一步的工具內容：$label', (canary) => {
  expect(inspect(`https://toolsliang.com/collect?step=${encodeURIComponent(canary.value)}`).length).toBeGreaterThan(0)
})

it('公開 Worker 程式 URL 不會被誤判為工具內容', () => {
  expect(inspect('https://toolsliang.com/_nuxt/compliant-image.worker-publichash.js')).toEqual([])
  expect(inspect('https://toolsliang.com/_nuxt/promo.worker-publichash.js')).toEqual([])
  expect(inspect('https://toolsliang.com/_nuxt/archive.worker-publichash.js')).toEqual([])
})

it('工作階段文件只帶步驟狀態，不含檔名、Blob 或像素', () => {
  const session = completeWorkbenchStep(startWorkbenchStep(createWorkbenchSession(), 'import'), 'import')

  expect(inspect(`https://toolsliang.com/?session=${encodeURIComponent(JSON.stringify(session))}`)).toEqual([])
})

it('交給引擎的輸入只帶使用者的檔案本身，場景文件不複製像素', () => {
  const product = new File([new Uint8Array([137, 80])], 'private-workbench-canary.png', { type: 'image/png' })
  const logo = new File([new Uint8Array([137, 80])], 'private-workbench-logo.png', { type: 'image/png' })
  const layout = planLayoutInput({
    file: product,
    purpose: 'compliant',
    settings: { presetId: 'momo-store-main', width: 1000, height: 1000, format: 'image/jpeg', fit: 'cover', zoom: 100, offsetX: 0, offsetY: 0, background: '#ffffff' },
    byteRange: {},
  })
  const { scene } = planBrandScene({ canvas: { width: 1000, height: 1000 }, product, logo, logoScale: 25, logoX: 0, logoY: 0, logoOpacity: 100 })

  expect(layout.file).toBe(product)
  expect(JSON.stringify(scene)).not.toMatch(/private-workbench|blob:|data:/)
  expect(inspect(`https://toolsliang.com/?scene=${encodeURIComponent(JSON.stringify(scene))}`)).toEqual([])
})

it('輸出與封存檔名不帶來源檔名，只由用途與序號組成', () => {
  expect(workbenchOutputName('compliant', 1, 'image/jpeg')).toBe('compliant-product-image-01.jpg')
  expect(workbenchOutputName('promotional', 7, 'image/png')).not.toContain('private-workbench')
  expect(workbenchArchiveName('promotional')).not.toContain('private-workbench')
})

it('佇列文件只帶批次的形狀，不含檔名、Blob 或像素', () => {
  const { queue } = admitWorkbenchFiles(createWorkbenchQueue(), [{ bytes: 1024 }, { bytes: 2048 }])
  const measured = measureWorkbenchItem(queue, 'item-1', { width: 800, height: 800 })

  expect(inspect(`https://toolsliang.com/?queue=${encodeURIComponent(JSON.stringify(measured))}`)).toEqual([])
  expect(JSON.stringify(measured)).not.toMatch(/private-workbench|blob:|data:/)
})

it('封存檔只寫入本機產生的名稱與內容，不寫入裝置時間', () => {
  const archive = buildZipArchive([{ name: workbenchOutputName('promotional', 1, 'image/png'), bytes: new Uint8Array([1, 2, 3]) }])
  const names = new TextDecoder().decode(archive)

  expect(names).toContain('brand-promo-image-01.png')
  expect(names).not.toContain('private-workbench')
  expect(new DataView(archive.buffer).getUint16(10, true)).toBe(0)
})

it('工作台本身不宣告任何需要下載的離線資產', () => {
  expect(productImageWorkbenchDefinition.offlineMode).toBe('ready')
  expect(productImageWorkbenchDefinition.offlineAssets ?? []).toEqual([])
})
