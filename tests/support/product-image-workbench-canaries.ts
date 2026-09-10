import type { ToolContentCanary } from '../e2e/support/privacy-boundary'

/**
 * What must never leave the device while the workbench runs. A pipeline has
 * more to lose than a single tool: besides the product photo and the final
 * file, every intermediate result — the cutout, the laid-out image, the
 * composition — exists at some point, and so do the brand assets the merchant
 * brought with them. Each of them is named here so the boundary guard fails on
 * any of them, not only on the ones the last step produced.
 */
export const productImageWorkbenchCanaries: ToolContentCanary[] = [
  { label: '商品圖檔名', value: 'private-workbench-canary.png' },
  { label: '框版檔名', value: 'private-workbench-frame.png' },
  { label: 'Logo 檔名', value: 'private-workbench-logo.png' },
  { label: '合規輸出檔名', value: 'compliant-product-image.jpg' },
  { label: '宣傳輸出檔名', value: 'brand-promo-image.png' },
  { label: 'PNG 內容／輸出 Base64', value: 'iVBORw0KGgo' },
  { label: 'JPEG 內容／輸出 Base64', value: '/9j/' },
  { label: 'WebP 內容／輸出 Base64', value: 'UklGR' },
  { label: 'PNG 二進位特徵', value: 'PNG\r\n\n' },
  { label: 'WebP 二進位特徵', value: 'WEBPVP8X' },
]
