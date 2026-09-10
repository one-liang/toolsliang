import { afterEach, expect, it, vi } from 'vitest'
import { createArchiveWriter } from '@/features/tools/product-image-workbench/engine'
import { workbenchArchiveLimits } from '@/features/tools/product-image-workbench/archive'

/** Only `size` is read before a worker exists, so the refusals are testable without one. */
const entry = (name: string, size: number) => ({ name, blob: { size } as Blob })

afterEach(() => vi.unstubAllGlobals())

it('沒有完成的輸出時不開始工作', async () => {
  const engine = createArchiveWriter()

  expect(await engine.run({ entries: [] })).toMatchObject({ status: 'error', error: { code: 'nothing_to_archive' } })
  engine.dispose()
})

it('超出單一封存檔容量的批次在讀取任何位元組前就被退回', async () => {
  const engine = createArchiveWriter()
  const entries = [entry('brand-promo-image-01.png', workbenchArchiveLimits.maxBytes), entry('brand-promo-image-02.png', 1)]

  expect(await engine.run({ entries })).toMatchObject({
    status: 'error',
    error: { code: 'archive_too_large', recoverable: true },
  })
  engine.dispose()
})

it('無法建立 Worker 的瀏覽器在提供封存之前就說不支援', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
  const engine = createArchiveWriter()

  expect(await engine.prepare()).toMatchObject({ supported: false })
  engine.dispose()
})

it('已取消的工作不會讀取任何輸出；釋放後不可重啟', async () => {
  const engine = createArchiveWriter()
  const input = { entries: [entry('brand-promo-image-01.png', 1024)] }
  const controller = new AbortController()
  controller.abort()

  expect(await engine.run(input, { signal: controller.signal })).toEqual({ status: 'cancelled' })
  engine.dispose()
  expect(await engine.run(input)).toMatchObject({ status: 'error', error: { code: 'disposed' } })
})
