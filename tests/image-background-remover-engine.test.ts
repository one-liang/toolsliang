import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBackgroundRemover } from '@/features/tools/image-background-remover/engine'

const png = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'local.png', { type: 'image/png' })

describe('人像去背 Tool Engine', () => {
  it.each([
    ['selfie.HEIC', 'image/jpeg', new Uint8Array([255, 216, 255])],
    ['selfie.png', 'image/heif', new Uint8Array([137, 80, 78, 71])],
    ['renamed.jpg', '', new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 104, 101, 105, 99, 0, 0, 0, 0, 109, 105, 102, 49, 104, 101, 105, 99])],
  ])('在載入模型前就拒絕 HEIC/HEIF：%s', async (name, type, bytes) => {
    const engine = createBackgroundRemover()
    expect(await engine.run({ file: new File([bytes], name, { type }) }))
      .toMatchObject({ status: 'error', error: { code: 'unsupported_heic', recoverable: true, suggestedAction: 'change-input' } })
    engine.dispose()
  })
})

it('拒絕偽裝格式與超出本機上限的圖片，不建立 Worker 也不讀取模型', async () => {
  const worker = vi.fn()
  vi.stubGlobal('Worker', worker)
  const engine = createBackgroundRemover()
  expect(await engine.run({ file: new File(['not an image'], 'private.png', { type: 'image/png' }) }))
    .toMatchObject({ status: 'error', error: { code: 'unsupported_format' } })
  const huge = new File([new Uint8Array(8)], 'huge.png', { type: 'image/png' })
  Object.defineProperty(huge, 'size', { value: 26 * 1024 * 1024 })
  Object.defineProperty(huge, 'slice', { value: () => png.slice() })
  expect(await engine.run({ file: huge })).toMatchObject({ status: 'error', error: { code: 'too_large' } })
  expect(worker).not.toHaveBeenCalled()
  engine.dispose()
})

describe('模型執行', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('/* public worker code */')))
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:worker-test')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('回報能力、逐階段進度並交付透明 PNG，結束後釋放 Worker', async () => {
    const terminated = vi.fn()
    vi.stubGlobal('Worker', class {
      onmessage?: (event: { data: unknown }) => void
      terminate = terminated
      postMessage(message: { type: string }) {
        queueMicrotask(() => {
          if (message.type === 'prepare') this.onmessage?.({ data: { type: 'capabilities', supported: true, formats: ['image/png'] } })
          else {
            for (const stage of ['decoding', 'preparing-model', 'inference', 'mask', 'encoding']) {
              this.onmessage?.({ data: { type: 'progress', progress: { stage, completed: 0, total: 1 } } })
            }
            this.onmessage?.({ data: { type: 'result', output: { bytes: new Uint8Array([1, 2, 3]).buffer, preview: new Uint8Array([4]).buffer, width: 800, height: 600, coverage: 0.42 } } })
          }
        })
      }
    })
    const engine = createBackgroundRemover()
    expect(await engine.prepare()).toMatchObject({ supported: true, formats: ['image/png'] })
    const stages: string[] = []
    const outcome = await engine.run({ file: png }, { onProgress: progress => stages.push(progress.stage) })
    expect(outcome).toMatchObject({ status: 'success', output: { width: 800, height: 600, coverage: 0.42 } })
    if (outcome.status === 'success') {
      expect(outcome.output.blob.type).toBe('image/png')
      expect(outcome.output.preview.type).toBe('image/png')
    }
    expect(stages).toEqual(['reading', 'decoding', 'preparing-model', 'inference', 'mask', 'encoding', 'preparing-download'])
    expect(terminated).toHaveBeenCalledTimes(2)
    engine.dispose()
  })

  it('把模型驗證與推論失敗轉成可恢復的錯誤代碼', async () => {
    for (const code of ['model_digest_mismatch', 'insufficient_memory', 'inference_failed'] as const) {
      vi.stubGlobal('Worker', class {
        onmessage?: (event: { data: unknown }) => void
        terminate = vi.fn()
        postMessage() { queueMicrotask(() => this.onmessage?.({ data: { type: 'error', code } })) }
      })
      const engine = createBackgroundRemover()
      expect(await engine.run({ file: png })).toMatchObject({ status: 'error', error: { code, recoverable: true } })
      engine.dispose()
    }
  })

  it('取消會終止推論、丟棄晚到的遮罩並保留重試能力', async () => {
    const workers: Array<{ onmessage?: (event: { data: unknown }) => void, terminate: ReturnType<typeof vi.fn> }> = []
    vi.stubGlobal('Worker', class {
      onmessage?: (event: { data: unknown }) => void
      terminate = vi.fn()
      constructor() { workers.push(this) }
      postMessage() {}
    })
    const engine = createBackgroundRemover()
    const stages: string[] = []
    const run = engine.run({ file: png }, { onProgress: progress => stages.push(progress.stage) })
    await vi.waitFor(() => expect(workers).toHaveLength(1))
    engine.cancel(); engine.cancel()
    expect(await run).toEqual({ status: 'cancelled' })
    workers[0]!.onmessage?.({ data: { type: 'result', output: { bytes: new Uint8Array([1]).buffer, preview: new Uint8Array([1]).buffer, width: 1, height: 1, coverage: 1 } } })
    expect(stages).toEqual(['reading'])
    expect(workers[0]!.terminate).toHaveBeenCalledOnce()
    const retry = engine.run({ file: png })
    await vi.waitFor(() => expect(workers).toHaveLength(2))
    engine.cancel()
    expect(await retry).toEqual({ status: 'cancelled' })
    engine.dispose()
  })
})
