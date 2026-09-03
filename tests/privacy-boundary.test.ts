import { describe, expect, it } from 'vitest'
import { inspectNetworkRequest, inspectWebSocketFrame, redactToolContent } from './e2e/support/privacy-boundary'

describe('tool content network boundary', () => {
  const policy = {
    allowedOrigins: ['http://127.0.0.1:3000', 'https://toolsliang.com'],
  }
  const toolContent = [
    { label: '輸入', value: '私密測試輸入-8af3' },
    { label: '輸出', value: '新臺幣壹萬零壹元玖分' },
    { label: '檔名', value: 'fixture-secret.pdf' },
  ]

  it('reports a same-origin request that contains tool input', () => {
    expect(inspectNetworkRequest({
      url: 'http://127.0.0.1:3000/api/convert?amount=%E7%A7%81%E5%AF%86%E6%B8%AC%E8%A9%A6%E8%BC%B8%E5%85%A5-8af3',
      method: 'GET',
      headers: {},
      body: null,
    }, toolContent, policy)).toEqual([
      'GET /api/convert: URL 含有工具內容（輸入）',
    ])
  })

  it('reports encoded tool output, filenames, and third-party requests', () => {
    expect(inspectNetworkRequest({
      url: 'https://analytics.example.test/collect?query=%E7%A7%81%E5%AF%86%E6%B8%AC%E8%A9%A6%E8%BC%B8%E5%85%A5-8af3',
      method: 'POST',
      headers: { 'x-file-name': 'fixture-secret.pdf' },
      body: JSON.stringify({ result: '新臺幣壹萬零壹元玖分' }),
    }, toolContent, policy)).toEqual([
      'POST https://analytics.example.test: 不允許的第三方請求',
      'POST https://analytics.example.test: URL 含有工具內容（輸入）',
      'POST https://analytics.example.test: header 含有工具內容（檔名）',
      'POST https://analytics.example.test: body 含有工具內容（輸出）',
    ])
  })

  it('allows same-origin public assets without tool content', () => {
    expect(inspectNetworkRequest({
      url: 'http://127.0.0.1:3000/_nuxt/app.js',
      method: 'GET',
      headers: { accept: '*/*' },
      body: null,
    }, toolContent, policy)).toEqual([])
  })

  it('allows explicitly configured first-party production assets', () => {
    expect(inspectNetworkRequest({
      url: 'https://toolsliang.com/_nuxt/app.js',
      method: 'GET',
      headers: { accept: '*/*' },
      body: null,
    }, toolContent, policy)).toEqual([])
  })

  it('reports a third-party WebSocket', () => {
    expect(inspectNetworkRequest({
      url: 'wss://events.example.test/socket',
      method: 'WEBSOCKET',
      headers: {},
      body: null,
    }, toolContent, policy)).toEqual([
      'WEBSOCKET wss://events.example.test: 不允許的第三方請求',
    ])
  })

  it('reports tool content sent in a same-origin WebSocket frame', () => {
    expect(inspectWebSocketFrame(
      'ws://127.0.0.1:3000/socket',
      '私密測試輸入-8af3',
      toolContent,
      policy,
    )).toEqual([
      'WEBSOCKET FRAME /socket: body 含有工具內容（輸入）',
    ])
  })

  it('redacts tool content from console and page errors', () => {
    expect(redactToolContent(
      'conversion failed for 私密測試輸入-8af3',
      toolContent,
    )).toBe('conversion failed for [工具內容：輸入]')
  })
})
