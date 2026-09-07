import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createImageCompressor } from '@/features/tools/image-compressor/engine'

const options = { format: 'image/png' as const, quality: 0.8, maxWidth: 1920, maxHeight: 1920 }

describe('圖片壓縮 Tool Engine', () => {
  it.each([
    ['photo.HEIC', 'image/jpeg', new Uint8Array([255, 216, 255])],
    ['photo.png', 'image/heif', new Uint8Array([137, 80, 78, 71])],
    ['renamed.jpg', '', new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 104, 101, 105, 99, 0, 0, 0, 0, 109, 105, 102, 49, 104, 101, 105, 99])],
  ])('解碼前拒絕 HEIC/HEIF：%s', async (name, type, bytes) => {
    const engine = createImageCompressor()
    const result = await engine.run({ file: new File([bytes], name, { type }), ...options })
    expect(result).toMatchObject({ status: 'error', error: { code: 'unsupported_heic', recoverable: true } })
    engine.dispose()
  })
})

it('拒絕偽裝格式與不合法設定，不開始處理', async () => {
  const engine = createImageCompressor()
  const file = new File(['not an image'], 'private.png', { type: 'image/png' })
  expect(await engine.run({ file, ...options })).toMatchObject({ status: 'error', error: { code: 'unsupported_format' } })
  expect(await engine.run({ file, ...options, quality: Number.NaN })).toMatchObject({ status: 'error', error: { code: 'invalid_options' } })
  engine.dispose()
})

const png = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'local.png', { type: 'image/png' })
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('/* public worker code */')))
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:worker-test')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

it('回報 Worker 能力與分階段進度，交付 Blob 且釋放 Worker', async () => {
  const terminated = vi.fn()
  vi.stubGlobal('Worker', class {
    onmessage?: (event: { data: unknown }) => void
    terminate = terminated
    postMessage(message: { type: string }) {
      queueMicrotask(() => {
        if (message.type === 'prepare') this.onmessage?.({ data: { type: 'capabilities', supported: true, formats: ['image/png'] } })
        else {
          this.onmessage?.({ data: { type: 'progress', progress: { stage: 'decoding', completed: 0, total: 1 } } })
          this.onmessage?.({ data: { type: 'result', output: { bytes: new Uint8Array([1, 2, 3]).buffer, preview: new Uint8Array([4]).buffer, format: 'image/png', width: 40, height: 20, sourceWidth: 80, sourceHeight: 40 } } })
        }
      })
    }
  })
  const engine = createImageCompressor()
  expect(await engine.prepare()).toMatchObject({ supported: true, formats: ['image/png'] })
  const progress: string[] = []
  const result = await engine.run({ file: png, ...options }, { onProgress: event => progress.push(event.stage) })
  expect(result).toMatchObject({ status: 'success', output: { width: 40, height: 20, sourceWidth: 80, sourceHeight: 40 } })
  if (result.status === 'success') {
    expect(result.output.blob.type).toBe('image/png')
    expect(result.output.blob.size).toBe(3)
  }
  expect(progress).toEqual(['reading', 'decoding', 'preparing-download'])
  expect(terminated).toHaveBeenCalledTimes(2)
  engine.dispose()
})

it('取消冪等、丟棄晚到輸出、保留原檔且允許重試', async () => {
  const workers: Array<{ onmessage?: (event: { data: unknown }) => void, terminate: ReturnType<typeof vi.fn> }> = []
  vi.stubGlobal('Worker', class {
    onmessage?: (event: { data: unknown }) => void
    terminate = vi.fn()
    constructor() { workers.push(this) }
    postMessage() {}
  })
  const engine = createImageCompressor()
  const stages: string[] = []
  const run = engine.run({ file: png, ...options }, { onProgress: progress => stages.push(progress.stage) })
  await vi.waitFor(() => expect(workers).toHaveLength(1))
  engine.cancel(); engine.cancel()
  expect(await run).toEqual({ status: 'cancelled' })
  workers[0]!.onmessage?.({ data: { type: 'progress', progress: { stage: 'encoding', completed: 0 } } })
  expect(stages).toEqual(['reading'])
  expect(workers[0]!.terminate).toHaveBeenCalledOnce()
  expect(png.size).toBe(8)
  const controller = new AbortController()
  const retry = engine.run({ file: png, ...options }, { signal: controller.signal })
  controller.abort()
  expect(await retry).toEqual({ status: 'cancelled' })
  engine.dispose()
  expect(await engine.run({ file: png, ...options })).toMatchObject({ status: 'error', error: { code: 'disposed' } })
})

it('結構化編碼錯誤不包含檔名，Worker 結束後仍可重試', async () => {
  let attempts = 0
  vi.stubGlobal('Worker', class {
    onmessage?: (event: { data: unknown }) => void
    terminate() {}
    postMessage() { queueMicrotask(() => this.onmessage?.({ data: { type: 'error', code: ++attempts === 1 ? 'encode_failed' : 'memory_limit' } })) }
  })
  const engine = createImageCompressor()
  expect(await engine.run({ file: png, ...options })).toEqual({ status: 'error', error: { code: 'encode_failed', recoverable: true, suggestedAction: 'retry' } })
  expect(await engine.run({ file: png, ...options })).toMatchObject({ status: 'error', error: { code: 'memory_limit' } })
  engine.dispose()
})

it('無法讀取原檔時回報可恢復讀取錯誤', async () => {
  const file = new File(['secret'], 'private.png', { type: 'image/png' })
  vi.spyOn(file, 'slice').mockImplementation(() => { throw new Error('private file path') })
  const engine = createImageCompressor()
  expect(await engine.run({ file, ...options })).toEqual({ status: 'error', error: { code: 'read_failed', recoverable: true, suggestedAction: 'retry' } })
})

it.each(['reading', 'decoding', 'processing', 'encoding', 'preparing-download'])('可在 %s 階段中止，不交付半成品', async (stage) => {
  vi.stubGlobal('Worker', class {
    onmessage?: (event: { data: unknown }) => void
    terminate() {}
    postMessage() {
      queueMicrotask(() => {
        for (const step of ['decoding', 'processing', 'encoding']) this.onmessage?.({ data: { type: 'progress', progress: { stage: step, completed: 0, total: 1 } } })
        this.onmessage?.({ data: { type: 'result', output: { bytes: new ArrayBuffer(1), preview: new ArrayBuffer(1), format: 'image/png', width: 1, height: 1, sourceWidth: 1, sourceHeight: 1 } } })
      })
    }
  })
  const engine = createImageCompressor()
  const controller = new AbortController()
  expect(await engine.run({ file: png, ...options }, { signal: controller.signal, onProgress: event => { if (event.stage === stage) controller.abort() } })).toEqual({ status: 'cancelled' })
  engine.dispose()
})

it('HEIC 排除先於進度，25 MiB 以上檔案也不建立 Worker', async () => {
  const worker = vi.fn()
  vi.stubGlobal('Worker', worker)
  const file = new File([png, new Uint8Array(25 * 1024 * 1024)], 'large.png', { type: 'image/png' })
  const engine = createImageCompressor()
  expect(await engine.run({ file, ...options })).toMatchObject({ status: 'error', error: { code: 'too_large' } })
  const progress = vi.fn()
  expect(await engine.run({ file: new File([png], 'input.heif'), ...options }, { onProgress: progress })).toMatchObject({ status: 'error', error: { code: 'unsupported_heic' } })
  expect(progress).not.toHaveBeenCalled()
  expect(worker).not.toHaveBeenCalled()
})

it('公開程式資產載入卡住時能力檢查也會逾時', async () => {
  vi.useFakeTimers()
  try {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const engine = createImageCompressor()
    let supported: boolean | undefined
    void engine.prepare().then(result => { supported = result.supported })
    await vi.advanceTimersByTimeAsync(10_001)
    expect(supported).toBe(false)
    engine.dispose()
  }
  finally { vi.useRealTimers() }
})
