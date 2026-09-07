import { readFileSync } from 'node:fs'
import type { ToolContentCanary } from '../e2e/support/privacy-boundary'

const webp = readFileSync('tests/fixtures/image-compressor/transparent.webp').toString('base64')

/** Format signatures cover browser-dependent output bytes; fixture markers also cover recognizable content. */
export const imageCompressorCanaries: ToolContentCanary[] = [
  { label: '圖片檔名', value: 'private-image-canary.png' },
  { label: 'WebP 素材檔名', value: 'transparent.webp' },
  { label: '改名 HEIC 素材', value: 'renamed.jpg' },
  { label: 'PNG 輸出檔名', value: 'compressed-image.png' },
  { label: 'JPEG 輸出檔名', value: 'compressed-image.jpg' },
  { label: 'WebP 輸出檔名', value: 'compressed-image.webp' },
  { label: 'PNG 內容／輸出 Base64', value: 'iVBORw0KGgo' },
  { label: 'JPEG 內容／輸出 Base64', value: '/9j/' },
  { label: 'WebP 內容／輸出 Base64', value: 'UklGR' },
  { label: '合成 WebP 內容', value: webp },
  { label: '合成 WebP 像素內容', value: webp.slice(-128, -16) },
  { label: 'EXIF 區段', value: 'Exif\u0000\u0000' },
  { label: 'EXIF 區段 Base64', value: 'RXhpZgAASUkqAAgAAAABABIBAwABAAAABgAA' },
  { label: 'HEIC 內容 Base64', value: 'AAAAGGZ0eXBoZWljAAAAAG1pZjFoZWlj' },
  { label: 'PNG 二進位特徵', value: 'PNG\r\n\u001a\n' },
  { label: 'WebP 二進位特徵', value: 'WEBPVP8X' },
]
