import { expect, it } from 'vitest'
import { compliantProductImageCanaries } from './support/compliant-product-image-canaries'
import { inspectNetworkRequest } from './e2e/support/privacy-boundary'
import { compliantImageSources } from '@/features/tools/compliant-product-image/domain/sources'
import { compliantProductImageDefinition } from '@/features/tools/compliant-product-image/definition'

const policy = { allowedOrigins: ['https://toolsliang.com'] }

it.each(compliantProductImageCanaries)('同源 GET 不得夾帶商品圖內容：$label', (canary) => {
  const findings = inspectNetworkRequest(
    { url: `https://toolsliang.com/collect?image=${encodeURIComponent(canary.value)}`, method: 'GET', headers: {}, body: null },
    compliantProductImageCanaries,
    policy,
  )

  expect(findings.length).toBeGreaterThan(0)
})

it.each([
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
  'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
  'data:image/webp;base64,UklGRiIAAABXRUJQ',
  'momo-store-main.jpg',
])('不帶原檔名的輸出仍被攔截：%s', (value) => {
  expect(inspectNetworkRequest(
    { url: `https://toolsliang.com/?result=${encodeURIComponent(value)}`, method: 'GET', headers: {}, body: null },
    compliantProductImageCanaries,
    policy,
  ).length).toBeGreaterThan(0)
})

it('公開 Worker 程式 URL 不會被誤判為商品圖內容', () => {
  expect(inspectNetworkRequest(
    { url: 'https://toolsliang.com/_nuxt/compliant-image.worker-publichash.js', method: 'GET', headers: {}, body: null },
    compliantProductImageCanaries,
    policy,
  )).toEqual([])
})

it('通路來源只被引用與外連，不由本站在執行期取得', () => {
  compliantImageSources.forEach((source) => {
    const findings = inspectNetworkRequest(
      { url: source.url, method: 'GET', headers: {}, body: null },
      compliantProductImageCanaries,
      policy,
    )

    // A channel page is a third-party origin: the tool links out to it and never fetches it.
    expect(findings, source.id).toContain(`GET ${new URL(source.url).origin}: 不允許的第三方請求`)
  })
})

it('工具不宣告任何需要下載的離線資產，preset 隨網站打包', () => {
  expect(compliantProductImageDefinition.offlineMode).toBe('ready')
  expect(compliantProductImageDefinition.offlineAssets ?? []).toEqual([])
})
