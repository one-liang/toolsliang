import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPdfSignatureSession } from '@/features/tools/pdf-signature/engine'
import { estimatePdfWorkingSetBytes, pdfSignatureLimits } from '@/features/tools/pdf-signature/domain/reference'
import type { PdfSignatureReply, PdfSignatureRequest } from '@/features/tools/pdf-signature/types'

const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x37])

function pdfFile(name = 'contract.pdf', size?: number) {
  const file = new File([pdfBytes], name, { type: 'application/pdf' })
  if (size !== undefined) Object.defineProperty(file, 'size', { value: size })
  return file
}

const pageReport = { index: 0, box: [0, 0, 595.28, 841.89] as [number, number, number, number], rotation: 0 }
const documentReport = { pageCount: 1, encrypted: false, permissions: null, pages: [pageReport] }

interface FakeWorker {
  listeners: Array<(event: { data: unknown }) => void>
  posted: PdfSignatureRequest[]
  terminated: boolean
  reply: (reply: PdfSignatureReply) => void
  /** Stands in for a worker the browser tore down mid-job. */
  crash: () => void
}

const workers: FakeWorker[] = []

/** A worker that answers exactly what the test tells it to, one request at a time. */
function stubWorker(answer: (request: PdfSignatureRequest, worker: FakeWorker) => void) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('/* public worker code */')))
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf-signature')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.stubGlobal('Worker', class {
    private readonly self: FakeWorker
    private failed?: (event: { preventDefault: () => void }) => void
    constructor() {
      this.self = {
        listeners: [],
        posted: [],
        terminated: false,
        reply: reply => this.self.listeners.forEach(listener => listener({ data: reply })),
        crash: () => this.failed?.({ preventDefault: () => {} }),
      }
      workers.push(this.self)
    }

    addEventListener(_type: string, listener: (event: { data: unknown }) => void) { this.self.listeners.push(listener) }
    removeEventListener() {}
    set onmessage(listener: (event: { data: unknown }) => void) { this.self.listeners.push(listener) }
    set onerror(listener: (event: { preventDefault: () => void }) => void) { this.failed = listener }
    set onmessageerror(_listener: unknown) {}
    terminate() { this.self.terminated = true }
    postMessage(request: PdfSignatureRequest) {
      this.self.posted.push(request)
      queueMicrotask(() => { if (!this.self.terminated) answer(request, this.self) })
    }
  })
}

/** The happy path: capabilities, one page report, one preview, one export. */
function stubWorkingWorker() {
  stubWorker((request, worker) => {
    if (request.type === 'capabilities') {
      worker.reply({ type: 'capabilities', id: request.id, capabilities: { supported: true, formats: ['application/pdf'], password: true } })
    }
    if (request.type === 'open') {
      worker.reply({ type: 'progress', id: request.id, stage: 'read' })
      worker.reply({ type: 'progress', id: request.id, stage: 'parse' })
      worker.reply({ type: 'document', id: request.id, report: documentReport })
    }
    if (request.type === 'preview') {
      worker.reply({ type: 'progress', id: request.id, stage: 'preview', page: request.page + 1, total: documentReport.pageCount })
      worker.reply({ type: 'preview', id: request.id, report: { index: request.page, scale: request.scale, width: 100, height: 200, bytes: new Uint8Array([1, 2]).buffer } })
    }
    if (request.type === 'export') {
      worker.reply({ type: 'progress', id: request.id, stage: 'apply' })
      worker.reply({ type: 'progress', id: request.id, stage: 'write' })
      worker.reply({ type: 'export', id: request.id, report: { bytes: new Uint8Array([3, 4]).buffer, pageCount: 1, mode: 'incremental-update', decrypted: false } })
    }
  })
}

afterEach(() => { workers.length = 0; vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('能力與密碼支援', () => {
  it('密碼支援是獨立宣告的能力，在選擇檔案前就知道', async () => {
    stubWorkingWorker()
    const session = createPdfSignatureSession()

    expect(await session.capabilities()).toEqual({ supported: true, formats: ['application/pdf'], password: true })
    session.dispose()
  })

  it('無法建立 Worker 時說明瀏覽器不支援，而不是怪檔案', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    const session = createPdfSignatureSession()

    expect(await session.capabilities()).toMatchObject({ supported: false, reason: 'unsupported_browser' })
    expect(await session.open(pdfFile())).toMatchObject({ status: 'error', error: { code: 'unsupported_browser', recoverable: false } })
    session.dispose()
  })
})

describe('開檔前的把關', () => {
  beforeEach(stubWorkingWorker)

  it('不是 PDF 的檔案在建立 Worker 前就退回', async () => {
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'photo.png', { type: 'image/png' })
    const session = createPdfSignatureSession()

    expect(await session.open(file)).toMatchObject({ status: 'error', error: { code: 'not_a_pdf', suggestedAction: 'change-input' } })
    expect(workers).toHaveLength(0)
    session.dispose()
  })

  it('超過位元組上限的檔案不讀取內容也不建立 Worker', async () => {
    const session = createPdfSignatureSession()

    expect(await session.open(pdfFile('big.pdf', pdfSignatureLimits.maxBytes + 1)))
      .toMatchObject({ status: 'error', error: { code: 'too_large' } })
    expect(workers).toHaveLength(0)
    session.dispose()
  })

  it('工作集估算超過本機預算時在解析前說明記憶體不足', async () => {
    const session = createPdfSignatureSession({ memoryBudgetBytes: estimatePdfWorkingSetBytes(1024) })

    expect(await session.open(pdfFile('heavy.pdf', 4096)))
      .toMatchObject({ status: 'error', error: { code: 'insufficient_memory', recoverable: true } })
    expect(workers).toHaveLength(0)
    session.dispose()
  })
})

describe('開檔、預覽與匯出', () => {
  beforeEach(stubWorkingWorker)

  it('逐階段回報進度，並只交出不帶檔名的摘要', async () => {
    const stages: string[] = []
    const session = createPdfSignatureSession()
    const outcome = await session.open(pdfFile(), { onProgress: progress => stages.push(progress.stage) })

    expect(outcome).toEqual({ status: 'success', output: documentReport })
    expect(stages).toEqual(['read', 'parse'])
    expect(JSON.stringify(outcome)).not.toContain('contract.pdf')
    session.dispose()
  })

  it('會走頁面的階段同時回報第幾頁與共幾頁，不帶任何頁面內容', async () => {
    const reported: Array<{ stage: string, page?: number, total?: number }> = []
    const session = createPdfSignatureSession()
    await session.open(pdfFile())
    await session.renderPage(0, 1.5, { onProgress: progress => reported.push(progress) })

    expect(reported).toEqual([{ stage: 'preview', page: 1, total: 1 }])
    session.dispose()
  })

  it('同一個 Worker 服務整個工作階段，不為每次預覽重新解析', async () => {
    const session = createPdfSignatureSession()
    await session.open(pdfFile())
    await session.renderPage(0, 1.5)
    await session.renderPage(0, 3)

    expect(workers).toHaveLength(1)
    expect(workers[0]!.posted.map(request => request.type)).toEqual(['open', 'preview', 'preview'])
    session.dispose()
  })

  it('預覽與匯出都交出 PNG 與 PDF 的 Blob', async () => {
    const session = createPdfSignatureSession()
    await session.open(pdfFile())
    const preview = await session.renderPage(0, 1.5)
    const exported = await session.exportSigned(
      [{ page: 0, rect: { x: 0.1, y: 0.1, width: 0.3, height: 0.1 }, signatureId: 'sig-1' }],
      [{ id: 'sig-1', bytes: new Uint8Array([1]).buffer }],
    )

    expect(preview).toMatchObject({ status: 'success', output: { index: 0, scale: 1.5, width: 100, height: 200 } })
    if (preview.status === 'success') expect(preview.output.blob.type).toBe('image/png')
    expect(exported).toMatchObject({ status: 'success', output: { pageCount: 1, mode: 'incremental-update', decrypted: false } })
    if (exported.status === 'success') expect(exported.output.blob.type).toBe('application/pdf')
    session.dispose()
  })

  it('尚未開檔就預覽或匯出時不會憑空產生結果', async () => {
    const session = createPdfSignatureSession()

    expect(await session.renderPage(0, 1.5)).toMatchObject({ status: 'error', error: { code: 'damaged_pdf' } })
    expect(await session.exportSigned([], [])).toMatchObject({ status: 'error', error: { code: 'export_failed' } })
    expect(workers).toHaveLength(0)
    session.dispose()
  })

  it('忽略不屬於這次請求的訊息，包括引擎自己的雜訊', async () => {
    stubWorker((request, worker) => {
      worker.reply({ sourceName: 'worker', targetName: 'main', action: 'ready' } as unknown as PdfSignatureReply)
      worker.reply({ type: 'document', id: request.id + 99, report: { ...documentReport, pageCount: 404 } })
      worker.reply({ type: 'document', id: request.id, report: documentReport })
    })
    const session = createPdfSignatureSession()

    expect(await session.open(pdfFile())).toEqual({ status: 'success', output: documentReport })
    session.dispose()
  })
})

describe('裝置能力決定的上限', () => {
  it('瀏覽器沒有回報記憶體時維持規格的上限', () => {
    const session = createPdfSignatureSession()

    expect(session.limits).toMatchObject({ maxPages: 100, maxBytes: pdfSignatureLimits.maxBytes })
    session.dispose()
  })

  it('記憶體較少的裝置只下修不上修，且下修後的數字就是工具使用的數字', async () => {
    stubWorkingWorker()
    const session = createPdfSignatureSession({ deviceMemory: 1 })

    expect(session.limits.maxBytes).toBeLessThan(pdfSignatureLimits.maxBytes)
    expect(session.limits.maxPages).toBe(pdfSignatureLimits.maxPages)
    expect(await session.open(pdfFile('big.pdf', session.limits.maxBytes + 1)))
      .toMatchObject({ status: 'error', error: { code: 'insufficient_memory' } })
    expect(workers).toHaveLength(0)
    session.dispose()
  })

  it('記憶體很多的裝置也不會超過規格的上限', () => {
    const session = createPdfSignatureSession({ deviceMemory: 64 })

    expect(session.limits.maxBytes).toBe(pdfSignatureLimits.maxBytes)
    session.dispose()
  })
})

describe('取消、失敗與釋放', () => {
  it('呼叫端自己的 AbortSignal 與取消等效：交還工作並釋放 Worker', async () => {
    stubWorker((request, worker) => {
      /* `open` answers; the preview never does, so only the abort can settle it. */
      if (request.type === 'open') worker.reply({ type: 'document', id: request.id, report: documentReport })
    })
    const session = createPdfSignatureSession()
    await session.open(pdfFile())
    const controller = new AbortController()
    const pending = session.renderPage(0, 1.5, { signal: controller.signal })
    controller.abort()

    expect(await pending).toEqual({ status: 'cancelled' })
    expect(workers[0]!.terminated).toBe(true)
    session.dispose()
  })

  it('已經中止的 signal 不會建立任何工作', async () => {
    stubWorkingWorker()
    const session = createPdfSignatureSession()
    await session.open(pdfFile())
    const aborted = AbortSignal.abort()

    expect(await session.renderPage(0, 1.5, { signal: aborted })).toEqual({ status: 'cancelled' })
    expect(workers[0]!.posted.filter(request => request.type === 'preview')).toHaveLength(0)
    session.dispose()
  })

  it('取消會終止 Worker 並把進行中的工作交還，之後可以重新開檔', async () => {
    stubWorker((request, worker) => {
      /* `open` answers; the export never does, which is the state only a terminated worker leaves. */
      if (request.type === 'open') worker.reply({ type: 'document', id: request.id, report: documentReport })
    })
    const session = createPdfSignatureSession()
    await session.open(pdfFile())
    const pending = session.exportSigned([{ page: 0, rect: { x: 0, y: 0, width: 0.2, height: 0.1 }, signatureId: 'sig-1' }], [{ id: 'sig-1', bytes: new Uint8Array([1]).buffer }])
    session.cancel()

    expect(await pending).toEqual({ status: 'cancelled' })
    expect(workers[0]!.terminated).toBe(true)
    expect(await session.open(pdfFile())).toEqual({ status: 'success', output: documentReport })
    expect(workers).toHaveLength(2)
    session.dispose()
  })

  it('Worker 中途消失時回報記憶體不足，而不是靜悄悄地停住', async () => {
    stubWorker((request, worker) => { if (request.type === 'open') worker.crash() })
    const session = createPdfSignatureSession()

    expect(await session.open(pdfFile())).toMatchObject({ status: 'error', error: { code: 'insufficient_memory', recoverable: true } })
    expect(workers[0]!.terminated).toBe(true)
    session.dispose()
  })

  it('引擎自己回報的失敗代碼原樣交給介面', async () => {
    stubWorker((request, worker) => { if (request.type === 'open') worker.reply({ type: 'failure', id: request.id, code: 'password_required' }) })
    const session = createPdfSignatureSession()

    expect(await session.open(pdfFile()))
      .toMatchObject({ status: 'error', error: { code: 'password_required', suggestedAction: 'enter-password' } })
    session.dispose()
  })

  it('釋放後不再建立 Worker，也不再回覆結果', async () => {
    stubWorkingWorker()
    const session = createPdfSignatureSession()
    await session.open(pdfFile())
    session.dispose()

    expect(workers[0]!.terminated).toBe(true)
    expect(await session.renderPage(0, 1.5)).toEqual({ status: 'cancelled' })
    expect(await session.open(pdfFile())).toEqual({ status: 'cancelled' })
    expect(workers).toHaveLength(1)
  })

  it('重複取消與重複釋放都不會丟出例外', async () => {
    stubWorkingWorker()
    const session = createPdfSignatureSession()
    await session.open(pdfFile())

    expect(() => { session.cancel(); session.cancel(); session.dispose(); session.dispose() }).not.toThrow()
  })
})
