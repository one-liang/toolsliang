import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { useImageBatch } from '@/composables/useImageBatch'
import { imageBatchLimits } from '@/features/images/batch'

const mounted: ReturnType<typeof mount>[] = []
afterEach(() => { mounted.splice(0).forEach(wrapper => wrapper.unmount()); vi.unstubAllGlobals(); vi.restoreAllMocks() })

const png = (name: string, size = 64) => new File([new Uint8Array(size)], name, { type: 'image/png' })

/** Pictures decode to the size named in the file, or fail when it says so. */
function stubDecoding(sizes: Record<string, { width: number, height: number } | 'broken'>) {
  const files = new Map<string, File>()
  const revoked: string[] = []
  vi.spyOn(URL, 'createObjectURL').mockImplementation((object) => { const url = `blob:test-${files.size}`; files.set(url, object as File); return url })
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => { revoked.push(url) })
  vi.stubGlobal('Image', class {
    onload?: () => void
    onerror?: () => void
    naturalWidth = 0
    naturalHeight = 0
    set src(url: string) {
      const size = sizes[files.get(url)!.name] ?? { width: 800, height: 600 }
      queueMicrotask(() => {
        if (size === 'broken') { this.onerror?.(); return }
        this.naturalWidth = size.width
        this.naturalHeight = size.height
        this.onload?.()
      })
    }
  })
  return { revoked }
}

function useBatch<Result>(options: Parameters<typeof useImageBatch<Result>>[0] = {}) {
  let batch!: ReturnType<typeof useImageBatch<Result>>
  const wrapper = mount(defineComponent(() => { batch = useImageBatch<Result>(options); return () => h('div') }))
  mounted.push(wrapper)
  return { batch, wrapper }
}

describe('批次狀態', () => {
  it('加入的圖片都先是等待處理，第一張自動成為目前預覽', async () => {
    stubDecoding({})
    const { batch } = useBatch()
    batch.add([png('a.png', 100), png('b.png', 200)])
    await flushPromises()

    expect(batch.items.value.map(item => [item.file.name, item.status, item.url])).toEqual([['a.png', 'pending', 'blob:test-0'], ['b.png', 'pending', 'blob:test-1']])
    expect(batch.items.value[0]!.size).toEqual({ width: 800, height: 600 })
    expect(batch.selected.value?.file.name).toBe('a.png')
    expect(batch.held.value).toEqual({ count: 2, bytes: 300 })

    batch.add([png('c.png')])
    expect(batch.selected.value?.file.name).toBe('a.png')
  })

  it('id 由這裡產生，不帶檔名；移除後也不重複使用', () => {
    stubDecoding({})
    const { batch } = useBatch()
    const [first] = batch.add([png('private-name.png')])
    batch.remove(first!.id)
    const [second] = batch.add([png('private-name.png')])

    expect(first!.id).not.toContain('private')
    expect(second!.id).not.toBe(first!.id)
  })

  it('超過像素上限或無法解碼的圖片一讀到就標成失敗，而且不能重試', async () => {
    stubDecoding({ 'huge.png': { width: 9000, height: 100 }, 'broken.png': 'broken' })
    const { batch } = useBatch()
    batch.add([png('huge.png'), png('broken.png'), png('fine.png')])
    await flushPromises()

    expect(batch.items.value.map(item => [item.status, item.error, item.retryable])).toEqual([
      ['failed', 'too_large', false],
      ['failed', 'corrupt_image', false],
      ['pending', undefined, true],
    ])
    expect(batch.progress.value).toEqual({ total: 3, pending: 1, running: 0, done: 0, failed: 2 })
  })

  it('工具回報的狀態與結果寫回該張；換掉的舊結果會被釋放', () => {
    stubDecoding({})
    const release = vi.fn()
    const { batch } = useBatch<{ name: string }>({ release })
    const [item] = batch.add([png('a.png')])

    batch.update(item!.id, { status: 'running' })
    batch.update(item!.id, { status: 'done', result: { name: 'first' } })
    batch.update(item!.id, { status: 'done', result: { name: 'second' } })

    expect(batch.items.value[0]).toMatchObject({ status: 'done', result: { name: 'second' } })
    expect(release).toHaveBeenCalledWith({ name: 'first' })
  })

  it('移除目前那張時由後一張接手，最後一張則由前一張接手，並釋放預覽與結果', () => {
    const { revoked } = stubDecoding({})
    const release = vi.fn()
    const { batch } = useBatch<string>({ release })
    const [a, b, c] = batch.add([png('a.png'), png('b.png'), png('c.png')])
    batch.update(b!.id, { result: 'b-result' })

    batch.select(b!.id)
    batch.remove(b!.id)
    expect(batch.selectedId.value).toBe(c!.id)
    expect(revoked).toEqual([b!.url])
    expect(release).toHaveBeenCalledWith('b-result')

    batch.remove(c!.id)
    expect(batch.selectedId.value).toBe(a!.id)
  })

  it('全部清除與卸載都會釋放所有預覽', () => {
    const { revoked } = stubDecoding({})
    const { batch, wrapper } = useBatch()
    const items = batch.add([png('a.png'), png('b.png')])
    batch.clear()
    expect(revoked).toEqual(items.map(item => item.url))
    expect(batch.selectedId.value).toBeUndefined()

    const [later] = batch.add([png('c.png')])
    wrapper.unmount()
    mounted.splice(0)
    expect(revoked).toContain(later!.url)
  })

  it('上限依這台裝置的記憶體下修', () => {
    stubDecoding({})
    vi.stubGlobal('navigator', { ...navigator, deviceMemory: 0.5 })
    const { batch } = useBatch()

    expect(batch.limits.value.maxItems).toBeLessThan(imageBatchLimits.maxItems)
    expect(batch.limits.value.maxBytes).toBeLessThan(imageBatchLimits.maxBytes)
  })
})
