import { afterEach, expect, it, vi } from 'vitest'
import { imageArchiveLimits } from '@/features/images/archive'
import { createImageArchiveWriter } from '@/features/images/archive-writer'

/** Only `size` is read before a worker exists, so the refusals are testable without one. */
const entry = (name: string, size: number) => ({ name, blob: { size } as Blob })

afterEach(() => vi.unstubAllGlobals())

it('沒有完成的輸出時不開始工作', async () => {
  const engine = createImageArchiveWriter()

  expect(await engine.run({ entries: [] })).toMatchObject({ status: 'error', error: { code: 'nothing_to_archive' } })
  engine.dispose()
})

it('超出單一封存檔容量的批次在讀取任何位元組前就被退回', async () => {
  const engine = createImageArchiveWriter()
  const entries = [entry('brand-promo-image-01.png', imageArchiveLimits.maxBytes), entry('brand-promo-image-02.png', 1)]

  expect(await engine.run({ entries })).toMatchObject({
    status: 'error',
    error: { code: 'archive_too_large', recoverable: true },
  })
  engine.dispose()
})

it('無法建立 Worker 的瀏覽器在提供封存之前就說不支援', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
  const engine = createImageArchiveWriter()

  expect(await engine.prepare()).toMatchObject({ supported: false })
  engine.dispose()
})

it('已取消的工作不會讀取任何輸出；釋放後不可重啟', async () => {
  const engine = createImageArchiveWriter()
  const input = { entries: [entry('brand-promo-image-01.png', 1024)] }
  const controller = new AbortController()
  controller.abort()

  expect(await engine.run(input, { signal: controller.signal })).toEqual({ status: 'cancelled' })
  engine.dispose()
  expect(await engine.run(input)).toMatchObject({ status: 'error', error: { code: 'disposed' } })
})
