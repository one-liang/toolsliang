import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCompliantImageRenderer } from '@/features/tools/compliant-product-image/engine'
import type { CompliantRenderInput } from '@/features/tools/compliant-product-image/types'

const options = {
  width: 1000,
  height: 1000,
  format: 'image/jpeg',
  fit: 'cover',
  zoom: 100,
  offsetX: 0,
  offsetY: 0,
  background: '#ffffff',
} as const satisfies Omit<CompliantRenderInput, 'file'>

const png = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'product.png', { type: 'image/png' })

describe('合規主圖 Tool Engine', () => {
  it.each([
    ['product.HEIC', 'image/jpeg', new Uint8Array([255, 216, 255])],
    ['product.png', 'image/heif', new Uint8Array([137, 80, 78, 71])],
    ['renamed.jpg', '', new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 104, 101, 105, 99, 0, 0, 0, 0, 109, 105, 102, 49, 104, 101, 105, 99])],
  ])('解碼前拒絕 HEIC/HEIF：%s', async (name, type, bytes) => {
    const engine = createCompliantImageRenderer()

    expect(await engine.run({ file: new File([bytes], name, { type }), ...options }))
      .toMatchObject({ status: 'error', error: { code: 'unsupported_heic', recoverable: true, suggestedAction: 'change-input' } })
    engine.dispose()
  })

  it.each([
    ['超過本機單邊上限的畫布', { width: 9000 }],
    ['超過本機像素上限的畫布', { width: 8000, height: 8000 }],
    ['非整數畫布', { width: 1000.5 }],
    ['零或負的縮放', { zoom: 0 }],
    ['超出範圍的位移', { offsetX: 140 }],
    ['本工具無法輸出的格式', { format: 'image/gif' as unknown as CompliantRenderInput['format'] }],
    ['不合法的背景填色', { background: 'white' }],
    ['不合法的容量下限', { minBytes: 0 }],
  ])('不合法設定在開始前就被擋下，不進入 Worker：%s', async (_label, patch) => {
    const engine = createCompliantImageRenderer()

    expect(await engine.run({ file: png, ...options, ...patch }))
      .toMatchObject({ status: 'error', error: { code: 'invalid_options', recoverable: true, suggestedAction: 'change-input' } })
    engine.dispose()
  })

  it('拒絕偽裝成圖片的檔案', async () => {
    const engine = createCompliantImageRenderer()

    expect(await engine.run({ file: new File(['not an image'], 'product.png', { type: 'image/png' }), ...options }))
      .toMatchObject({ status: 'error', error: { code: 'unsupported_format' } })
    engine.dispose()
  })
})

describe('worker 生命週期', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('/* public worker code */')))
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:worker-test')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

  function stubWorker(behaviour: (message: { type: string, input?: CompliantRenderInput }, worker: { onmessage?: (event: { data: unknown }) => void }) => void, terminate = vi.fn()) {
    vi.stubGlobal('Worker', class {
      onmessage?: (event: { data: unknown }) => void
      terminate = terminate
      postMessage(message: { type: string, input?: CompliantRenderInput }) { queueMicrotask(() => behaviour(message, this)) }
    })

    return terminate
  }

  it('回報能力、逐階段進度與 Blob 輸出，並釋放 Worker', async () => {
    const terminate = stubWorker((message, worker) => {
      if (message.type === 'prepare') {
        worker.onmessage?.({ data: { type: 'capabilities', supported: true, formats: ['image/jpeg', 'image/png'] } })
        return
      }
      for (const stage of ['decoding', 'fitting', 'rendering', 'encoding']) {
        worker.onmessage?.({ data: { type: 'progress', progress: { stage, completed: 0, total: 1 } } })
      }
      worker.onmessage?.({
        data: {
          type: 'result',
          output: {
            bytes: new Uint8Array([1, 2, 3]).buffer,
            preview: new Uint8Array([4]).buffer,
            format: 'image/jpeg',
            width: 1000,
            height: 1000,
            sourceWidth: 2000,
            sourceHeight: 1500,
            coverage: 1,
            quality: 0.8,
          },
        },
      })
    })
    const engine = createCompliantImageRenderer()

    expect(await engine.prepare()).toMatchObject({ supported: true, formats: ['image/jpeg', 'image/png'] })
    const stages: string[] = []
    const outcome = await engine.run({ file: png, ...options }, { onProgress: event => stages.push(event.stage) })

    expect(outcome).toMatchObject({ status: 'success', output: { width: 1000, height: 1000, coverage: 1, quality: 0.8 } })
    if (outcome.status === 'success') {
      expect(outcome.output.blob.type).toBe('image/jpeg')
      expect(outcome.output.blob.size).toBe(3)
      expect(outcome.output.preview.type).toBe('image/png')
    }
    // §12.9 requires decode, fit, render and encode to be visible as they happen.
    expect(stages).toEqual(['reading', 'decoding', 'fitting', 'rendering', 'encoding', 'preparing-download'])
    expect(terminate).toHaveBeenCalledTimes(2)
    engine.dispose()
  })

  it('取消一個已在處理中的工作，不交付部分結果並終止 Worker', async () => {
    let started: () => void
    const running = new Promise<void>((resolve) => { started = resolve })
    // The worker never answers a run, so cancellation is what ends the job.
    const terminate = stubWorker((message, worker) => {
      if (message.type === 'prepare') worker.onmessage?.({ data: { type: 'capabilities', supported: true, formats: ['image/jpeg'] } })
      else started()
    })
    const engine = createCompliantImageRenderer()
    const outcome = engine.run({ file: png, ...options })
    await running
    engine.cancel()

    expect(await outcome).toEqual({ status: 'cancelled' })
    expect(terminate).toHaveBeenCalled()
    engine.dispose()
  })

  it('在 Worker 開始前取消也不留下未終止的工作', async () => {
    const terminate = stubWorker((message, worker) => {
      if (message.type === 'prepare') worker.onmessage?.({ data: { type: 'capabilities', supported: true, formats: ['image/jpeg'] } })
    })
    const engine = createCompliantImageRenderer()
    const outcome = engine.run({ file: png, ...options })
    engine.cancel()

    expect(await outcome).toEqual({ status: 'cancelled' })
    expect(terminate).not.toHaveBeenCalled()
    engine.dispose()
  })

  it('把 Worker 的錯誤代碼原樣交回，讓頁面說明可恢復的下一步', async () => {
    stubWorker((message, worker) => {
      if (message.type === 'prepare') worker.onmessage?.({ data: { type: 'capabilities', supported: true, formats: ['image/jpeg'] } })
      else worker.onmessage?.({ data: { type: 'error', code: 'unsupported_encoder' } })
    })
    const engine = createCompliantImageRenderer()

    expect(await engine.run({ file: png, ...options }))
      .toMatchObject({ status: 'error', error: { code: 'unsupported_encoder', recoverable: true } })
    engine.dispose()
  })

  it('把容量範圍原樣交給 Worker，不在頁面上假裝已經達成', async () => {
    let received: CompliantRenderInput | undefined
    stubWorker((message, worker) => {
      if (message.type === 'prepare') { worker.onmessage?.({ data: { type: 'capabilities', supported: true, formats: ['image/jpeg'] } }); return }
      received = message.input
      worker.onmessage?.({ data: { type: 'error', code: 'failed' } })
    })
    const engine = createCompliantImageRenderer()
    await engine.run({ file: png, ...options, minBytes: 50_000, maxBytes: 1_000_000 })

    expect(received).toMatchObject({ minBytes: 50_000, maxBytes: 1_000_000 })
    engine.dispose()
  })

  it('釋放後不再開始新的工作', async () => {
    stubWorker((message, worker) => {
      if (message.type === 'prepare') worker.onmessage?.({ data: { type: 'capabilities', supported: true, formats: ['image/jpeg'] } })
    })
    const engine = createCompliantImageRenderer()
    engine.dispose()

    expect(await engine.run({ file: png, ...options }))
      .toMatchObject({ status: 'error', error: { code: 'disposed', recoverable: false } })
  })
})
