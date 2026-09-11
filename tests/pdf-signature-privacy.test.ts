import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { pdfSignatureCanaries } from './support/pdf-signature-canaries'
import { inspectNetworkRequest } from './e2e/support/privacy-boundary'
import { pdfSignatureParserPolicy } from '@/features/tools/pdf-signature/domain/reference'

const policy = { allowedOrigins: ['https://toolsliang.com'] }

/**
 * Every module the browser actually runs for this tool. `domain/reference.ts`
 * is deliberately absent: it is T24's decision carried as data, and the licence
 * and repository addresses in it are provenance nothing ever fetches — the same
 * split the background removal tool makes with its own reference module.
 */
const runtimeModules = [
  'app/features/tools/pdf-signature/engine.ts',
  'app/features/tools/pdf-signature/pdf-signature.worker.ts',
  'app/features/tools/pdf-signature/types.ts',
  'app/features/tools/pdf-signature/content.ts',
  'app/features/tools/pdf-signature/domain/workspace.ts',
  'app/features/tools/pdf-signature/domain/signature.ts',
  'app/composables/usePdfSignature.ts',
  'app/components/PdfSignatureWorkspace.vue',
  'app/components/SignaturePad.vue',
]

it.each(pdfSignatureCanaries)('同源 GET 不得夾帶 PDF、密碼、簽名或輸出：$label', (canary) => {
  expect(inspectNetworkRequest(
    { url: `https://toolsliang.com/collect?value=${encodeURIComponent(canary.value)}`, method: 'GET', headers: {}, body: null },
    pdfSignatureCanaries,
    policy,
  ).length).toBeGreaterThan(0)
})

/**
 * The decision record cites the specification and the two libraries, and the
 * tool definition links them for the visitor. None of that may turn into an
 * address something running in a browser reaches for.
 */
it.each(runtimeModules)('執行期模組不含任何第三方位址：%s', (path) => {
  expect(readFileSync(path, 'utf8')).not.toMatch(/https?:\/\//)
})

it('輸出以工具自己的檔名下載，不沿用原始檔名', () => {
  const workspace = readFileSync('app/components/PdfSignatureWorkspace.vue', 'utf8')

  expect(workspace).toContain('download="signed.pdf"')
  expect(workspace).not.toMatch(/:download="[^"]*\.name/)
})

it('解析器的七個開關全部關閉，而且 Worker 就是這樣設定引擎的', () => {
  expect(Object.values(pdfSignatureParserPolicy).every(value => value === false)).toBe(true)

  const worker = readFileSync('app/features/tools/pdf-signature/pdf-signature.worker.ts', 'utf8')
  // The options are read from the reviewed policy, not spelled out again here.
  expect(worker).toContain('pdfSignatureParserPolicy.evalSupported')
  expect(worker).toContain('pdfSignatureParserPolicy.useSystemFonts')
  expect(worker).toContain('pdfSignatureParserPolicy.renderXfa')
  // Scripting is never built, and no font or resource is fetched on a document's behalf.
  expect(worker).not.toMatch(/enableScripting:\s*true/)
  expect(worker).not.toMatch(/useWorkerFetch:\s*true/)
  expect(worker).not.toMatch(/standardFontDataUrl|cMapUrl|wasmUrl|iccUrl/)
})

it('Worker 與工作階段都不讀寫任何本機儲存或快取', () => {
  for (const path of runtimeModules) {
    const source = readFileSync(path, 'utf8')
    expect(source, path).not.toMatch(/localStorage|sessionStorage|caches\./)
  }
})

it('密碼只在開檔訊息裡出現，不進入任何紀錄、檔名或錯誤字彙', () => {
  const worker = readFileSync('app/features/tools/pdf-signature/pdf-signature.worker.ts', 'utf8')
  const engine = readFileSync('app/features/tools/pdf-signature/engine.ts', 'utf8')

  // Nothing may log, and no failure reply may carry anything but a fixed code.
  for (const source of [worker, engine]) {
    expect(source).not.toMatch(/console\.(log|info|warn|error)/)
  }
  // No reply the worker posts may mention the password, whatever else it carries.
  for (const line of worker.split('\n')) {
    if (/\bsend\(|postMessage\(/.test(line)) expect(line, line.trim()).not.toMatch(/password/)
  }
})

it('文案只填入已公布的上限與紀錄裡的句子，沒有任何來自使用者的值', () => {
  const content = readFileSync('app/features/tools/pdf-signature/content.ts', 'utf8')
  const interpolations = [...content.matchAll(/\$\{([^}]*)\}/g)].map(match => match[1]!.trim())

  expect(interpolations.length).toBeGreaterThan(4)
  for (const expression of interpolations) {
    expect(expression, `文案不得填入 ${expression}`).toMatch(/^(maxMegabytes|pdfSignatureLimits\.\w+|pdfSignatureDisclosures\[[^\]]+\](\[[^\]]+\])?(\.en)?)$/)
  }
})

it('介面不把檔名放進狀態、錯誤或摘要', () => {
  const workspace = readFileSync('app/components/PdfSignatureWorkspace.vue', 'utf8')
  const composable = readFileSync('app/composables/usePdfSignature.ts', 'utf8')

  for (const source of [workspace, composable]) {
    expect(source).not.toMatch(/file\.value\?\.name|file\.name|chosen\.name/)
  }
})
