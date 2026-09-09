import type { ToolContentCanary } from '../e2e/support/privacy-boundary'

/**
 * What must never leave the device while the compliant product image tool runs:
 * the product photo a merchant hands it, the filename it arrived under, and the
 * bytes of every output it produces. Format signatures cover browser-dependent
 * encoder output, and the preset ids cover the output filenames.
 */
export const compliantProductImageCanaries: ToolContentCanary[] = [
  { label: '商品圖檔名', value: 'private-product-canary.png' },
  { label: '改名 HEIC 素材', value: 'renamed-product.jpg' },
  { label: 'JPEG 輸出檔名', value: 'momo-store-main.jpg' },
  { label: 'PNG 輸出檔名', value: 'ruten-main.png' },
  { label: 'WebP 輸出檔名', value: 'google-merchant-center-main.webp' },
  { label: 'PNG 內容／輸出 Base64', value: 'iVBORw0KGgo' },
  { label: 'JPEG 內容／輸出 Base64', value: '/9j/' },
  { label: 'WebP 內容／輸出 Base64', value: 'UklGR' },
  { label: 'EXIF 區段', value: 'Exif\u0000\u0000' },
  { label: 'PNG 二進位特徵', value: 'PNG\r\n\u001a\n' },
  { label: 'WebP 二進位特徵', value: 'WEBPVP8X' },
]
