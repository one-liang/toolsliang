import type { ToolContentCanary } from '../e2e/support/privacy-boundary'

/**
 * Stands in for everything the portrait tool touches: the picked file, the
 * decoded pixels, the matte the model produces and the transparent output. The
 * model file and the runtime are public assets, so they are deliberately not
 * canaries — fetching them is the one request this tool is allowed to make.
 */
export const backgroundRemoverCanaries: ToolContentCanary[] = [
  { label: '圖片檔名', value: 'private-portrait-canary.png' },
  { label: '輸出檔名', value: 'background-removed.png' },
  { label: 'PNG 內容／輸出 Base64', value: 'iVBORw0KGgo' },
  { label: 'JPEG 內容 Base64', value: '/9j/' },
  { label: 'PNG 二進位特徵', value: 'PNG\r\n\n' },
  { label: '遮罩內容', value: 'portrait-matte-canary' },
]
