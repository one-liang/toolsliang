import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ImageBatchDownload from '@/components/ImageBatchDownload.vue'
import { buildZipArchive, imageArchiveLimits, nameImageOutputs, type ImageArchiveInput } from '@/features/images/archive'
import { imageArchiveErrors } from '@/features/images/messages'
import { setTestRoute } from './support/nuxt-stubs'

const mounted: ReturnType<typeof mount>[] = []
afterEach(() => { mounted.splice(0).forEach(wrapper => wrapper.unmount()); vi.unstubAllGlobals(); vi.restoreAllMocks() })

const output = (name: string, text = name) => ({ name, blob: new Blob([text], { type: 'image/png' }) })

/** Object URLs stand for the blobs they were made from, so a test can open what a link points at. */
function stubUrls() {
  const objects = new Map<string, Blob | MediaSource>()
  const revoked: string[] = []
  vi.spyOn(URL, 'createObjectURL').mockImplementation((object) => { const url = `blob:test-${objects.size}`; objects.set(url, object); return url })
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => { revoked.push(url) })
  return { objects, revoked }
}

/** A worker that packs exactly like the real one, on the test's thread. */
function stubArchiveWorker() {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('/* public worker code */')))
  vi.stubGlobal('Worker', class {
    onmessage?: (event: { data: unknown }) => void
    terminate = vi.fn()
    postMessage(message: { type: string, input?: ImageArchiveInput }) {
      void (async () => {
        if (message.type === 'prepare') {
          this.onmessage?.({ data: { type: 'capabilities', supported: true, formats: ['application/zip'] } })
          return
        }
        const entries = await Promise.all(message.input!.entries.map(async entry => ({ name: entry.name, bytes: new Uint8Array(await entry.blob.arrayBuffer()) })))
        this.onmessage?.({ data: { type: 'result', output: { bytes: buildZipArchive(entries).buffer } } })
      })()
    }
  })
}

/** Entry names read back from a ZIP's central directory. */
async function zipNames(blob: Blob) {
  const archive = new Uint8Array(await blob.arrayBuffer())
  const view = new DataView(archive.buffer)
  const end = archive.length - 22
  let offset = view.getUint32(end + 16, true)
  const names: string[] = []
  for (let index = 0; index < view.getUint16(end + 10, true); index += 1) {
    const length = view.getUint16(offset + 28, true)
    names.push(new TextDecoder().decode(archive.subarray(offset + 46, offset + 46 + length)))
    offset += 46 + length
  }
  return names
}

function mountDownload(files: ReturnType<typeof output>[], archiveName = 'compressed-images.zip') {
  const wrapper = mount(ImageBatchDownload, { props: { files, archiveName }, attachTo: document.body })
  mounted.push(wrapper)
  return wrapper
}

describe('只有一張', () => {
  it('直接下載這一張，不打包也不啟動打包程式', async () => {
    const { objects } = stubUrls()
    const worker = vi.fn()
    vi.stubGlobal('Worker', worker)
    const file = output('產品照-compressed.jpg')
    const wrapper = mountDownload([file])
    await flushPromises()

    const link = wrapper.find('a[data-batch-download]')
    expect(link.text()).toBe('下載圖片')
    expect(link.attributes('download')).toBe('產品照-compressed.jpg')
    expect(objects.get(link.attributes('href')!)).toBe(file.blob)
    expect(wrapper.find('[data-batch-download-all]').exists()).toBe(false)
    expect(worker).not.toHaveBeenCalled()
  })
})

describe('多張', () => {
  it('提供逐張下載與「全部下載（ZIP）」，ZIP 內的檔名就是逐張下載的檔名', async () => {
    const { objects } = stubUrls()
    stubArchiveWorker()
    const names = nameImageOutputs([{ name: 'a.jpg', format: 'image/jpeg' }, { name: 'a.png', format: 'image/jpeg' }, { name: 'b.webp', format: 'image/webp' }], 'compressed')
    const files = names.map(name => output(name))
    const clicks: HTMLAnchorElement[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicks.push(this) })
    const wrapper = mountDownload(files)
    await flushPromises()

    const each = wrapper.findAll('details a[data-batch-download]')
    expect(each.map(link => link.attributes('download'))).toEqual(['a-compressed.jpg', 'a-compressed-2.jpg', 'b-compressed.webp'])
    expect(each.map(link => link.attributes('aria-label'))).toEqual(['下載 a-compressed.jpg', '下載 a-compressed-2.jpg', '下載 b-compressed.webp'])
    expect(each.map(link => objects.get(link.attributes('href')!))).toEqual(files.map(file => file.blob))
    expect(wrapper.find('details summary').text()).toBe('逐張下載（3 張）')

    const all = wrapper.find('[data-batch-download-all]')
    expect(all.text()).toBe('全部下載（ZIP）')
    await all.trigger('click')
    await flushPromises()

    expect(clicks).toHaveLength(1)
    expect(clicks[0]!.download).toBe('compressed-images.zip')
    const zip = objects.get(clicks[0]!.getAttribute('href')!) as Blob
    expect(zip.type).toBe('application/zip')
    expect(await zipNames(zip)).toEqual(names)
    expect(document.querySelectorAll('a[download="compressed-images.zip"]')).toHaveLength(0)
  })

  it('打包全程在裝置上：只取得打包程式本身，沒有任何請求帶著圖片或檔名', async () => {
    stubUrls()
    stubArchiveWorker()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const wrapper = mountDownload([output('private-canary-a.png'), output('private-canary-b.png')])
    await flushPromises()
    await wrapper.find('[data-batch-download-all]').trigger('click')
    await flushPromises()

    const calls = vi.mocked(fetch).mock.calls
    expect(calls.length).toBeGreaterThan(0)
    for (const [url, init] of calls) {
      expect(String(url)).toMatch(/archive\.worker/)
      expect(String(url)).not.toMatch(/private-canary/)
      expect(init?.body).toBeUndefined()
    }
  })

  it('同一批輸出再按一次直接下載同一個 ZIP；輸出變了才重新打包', async () => {
    const { revoked } = stubUrls()
    stubArchiveWorker()
    const clicks: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicks.push(this.getAttribute('href')!) })
    const files = [output('a.png'), output('b.png')]
    const wrapper = mountDownload(files)
    await flushPromises()

    await wrapper.find('[data-batch-download-all]').trigger('click')
    await flushPromises()
    await wrapper.setProps({ files: [...files] })
    await wrapper.find('[data-batch-download-all]').trigger('click')
    await flushPromises()
    expect(clicks[1]).toBe(clicks[0])

    await wrapper.setProps({ files: [files[0]!] })
    expect(revoked).toContain(clicks[0])
  })

  it('瀏覽器無法打包時說明原因，並直接展開逐張下載', async () => {
    stubUrls()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    const wrapper = mountDownload([output('a.png'), output('b.png')])
    await flushPromises()

    expect(wrapper.find('[data-batch-download-all]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[role="alert"]').text()).toBe(imageArchiveErrors.unsupported_browser['zh-tw'])
    expect(wrapper.find('details').attributes('open')).toBeDefined()
    expect(wrapper.findAll('details a[data-batch-download]')).toHaveLength(2)
  })

  it('超過一個 ZIP 能放的大小時，在打包前就說明', async () => {
    stubUrls()
    stubArchiveWorker()
    const huge = { name: 'a.png', blob: { size: imageArchiveLimits.maxBytes } as Blob }
    const wrapper = mountDownload([huge, output('b.png')])
    await flushPromises()

    expect(wrapper.find('[data-batch-download-all]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[role="alert"]').text()).toBe(imageArchiveErrors.archive_too_large['zh-tw'])
  })

  it('卸載時釋放每一個下載連結', async () => {
    const { revoked } = stubUrls()
    stubArchiveWorker()
    const wrapper = mountDownload([output('a.png'), output('b.png')])
    await flushPromises()
    const hrefs = wrapper.findAll('details a[data-batch-download]').map(link => link.attributes('href'))
    wrapper.unmount()
    mounted.splice(0)

    expect(revoked).toEqual(expect.arrayContaining(hrefs))
  })

  it('英文介面也完整', async () => {
    setTestRoute({ params: { locale: 'en' } })
    stubUrls()
    stubArchiveWorker()
    const wrapper = mountDownload([output('a.png'), output('b.png')])
    await flushPromises()

    expect(wrapper.find('[data-batch-download-all]').text()).toBe('Download all (ZIP)')
    expect(wrapper.find('details summary').text()).toBe('Download one by one (2)')
  })
})
