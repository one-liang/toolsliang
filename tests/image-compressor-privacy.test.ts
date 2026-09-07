import { expect, it } from 'vitest'
import { imageCompressorCanaries } from './support/image-compressor-canaries'
import { inspectNetworkRequest } from './e2e/support/privacy-boundary'

it.each(imageCompressorCanaries)('同源 GET 不得夾帶圖片內容：$label', (canary) => {
  const findings = inspectNetworkRequest({ url: `https://toolsliang.com/collect?image=${encodeURIComponent(canary.value)}`, method: 'GET', headers: {}, body: null }, imageCompressorCanaries, { allowedOrigins: ['https://toolsliang.com'] })
  expect(findings.length).toBeGreaterThan(0)
})

it.each(['data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==', 'data:image/jpeg;base64,/9j/4AAQSkZJRg==', 'data:image/webp;base64,UklGRiIAAABXRUJQ', 'Exif\u0000\u0000', 'compressed-image.jpg', 'compressed-image.webp'])('不帶原檔名的輸出或 EXIF 仍被攔截', (value) => {
  expect(inspectNetworkRequest({ url: `https://toolsliang.com/?result=${encodeURIComponent(value)}`, method: 'GET', headers: {}, body: null }, imageCompressorCanaries, { allowedOrigins: ['https://toolsliang.com'] }).length).toBeGreaterThan(0)
})

it('公開 Worker 程式 URL 不會被誤判為圖片內容', () => {
  expect(inspectNetworkRequest({ url: 'https://toolsliang.com/_nuxt/image.worker-publichash.js', method: 'GET', headers: {}, body: null }, imageCompressorCanaries, { allowedOrigins: ['https://toolsliang.com'] })).toEqual([])
})
