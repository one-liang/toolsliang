import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ImageBackgroundRemoverWorkspace from '@/components/ImageBackgroundRemoverWorkspace.vue'
import { backgroundRemovalAssets } from '@/features/tools/image-background-remover/domain/model'

/**
 * The real model is tens of megabytes. These suites only need its shape: three
 * versioned files the workspace has to get onto the device before a run, each
 * three bytes long here so their fingerprint can be checked like the real one.
 */
vi.mock('@/features/tools/image-background-remover/domain/model', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/features/tools/image-background-remover/domain/model')>()
  /** SHA-256 of the bytes 1, 2, 3. */
  const sha256 = '039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81'
  return { ...original, backgroundRemovalAssets: original.backgroundRemovalAssets.map(asset => ({ ...asset, bytes: 3, sha256 })) }
})

const mounted: ReturnType<typeof mount>[] = []
afterEach(() => { mounted.splice(0).forEach(wrapper => wrapper.unmount()); vi.unstubAllGlobals(); vi.restoreAllMocks() })
beforeEach(() => setOnline(true))

const isModelRequest = (url: string) => url.includes('/assets/offline/')

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: online })
  window.dispatchEvent(new Event(online ? 'online' : 'offline'))
}

function stubCache(cached: boolean) {
  const entries = new Map<string, Response>()
  if (cached) for (const asset of backgroundRemovalAssets) entries.set(asset.url, new Response(new Blob([new Uint8Array([1, 2, 3])])))
  vi.stubGlobal('caches', {
    open: async () => ({
      match: async (url: string) => entries.get(url),
      put: async (url: string, response: Response) => { entries.set(url, response) },
    }),
  })
  return entries
}

type ModelResponse = (url: string, init?: RequestInit) => Promise<Response>
const modelBytes: ModelResponse = async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-length': '3' } })

/**
 * Every request the page makes goes through here: the worker's own code, and
 * the model files, which `serve` answers. Requests are recorded so a test can
 * say exactly what reached the network.
 */
function stubNetwork(serve: ModelResponse = modelBytes) {
  const requests: string[] = []
  const network = { serve }
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    requests.push(url)
    return isModelRequest(url) ? network.serve(url, init) : new Response('/* public worker code */')
  }))
  return { requests, network }
}

type Reply = (message: { type: string }, worker: { onmessage?: (event: { data: unknown }) => void }) => void
const capable: Reply = (message, worker) => {
  if (message.type === 'prepare') worker.onmessage?.({ data: { type: 'capabilities', supported: true, formats: ['image/png'] } })
}
const succeeds: Reply = (message, worker) => {
  if (message.type === 'prepare') capable(message, worker)
  else worker.onmessage?.({ data: { type: 'result', output: { bytes: new Uint8Array(2048).buffer, preview: new Uint8Array([4]).buffer, width: 900, height: 1200, coverage: 0.38 } } })
}

function stubWorker(behaviour: Reply) {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.stubGlobal('Worker', class {
    onmessage?: (event: { data: unknown }) => void
    terminate = vi.fn()
    postMessage(message: { type: string }) { queueMicrotask(() => behaviour(message, this)) }
  })
}

/** A response held back until the test releases it, so "still getting ready" is a state the test controls. */
function heldResponse() {
  let release = () => {}
  const gate = new Promise<void>((resolve) => { release = resolve })
  const signals: AbortSignal[] = []
  const serve: ModelResponse = async (url, init) => {
    if (init?.signal) signals.push(init.signal)
    await new Promise<void>((resolve, reject) => {
      void gate.then(resolve)
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')))
    })
    return modelBytes(url, init)
  }
  return { release: () => release(), serve, signals }
}

const png = () => new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'portrait.png', { type: 'image/png' })

async function mountWorkspace() {
  const wrapper = mount(ImageBackgroundRemoverWorkspace)
  mounted.push(wrapper)
  await flushPromises()
  return wrapper
}

async function selectFile(wrapper: ReturnType<typeof mount>, file: File) {
  const input = wrapper.find('input[type=file]')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
  await flushPromises()
}

async function start(wrapper: ReturnType<typeof mount>) {
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

const submit = (wrapper: ReturnType<typeof mount>) => wrapper.find('button[type=submit]')
const button = (wrapper: ReturnType<typeof mount>, label: string) => wrapper.findAll('button').find(candidate => candidate.text().includes(label))

it('能力不足時說明原因、不讓裝置取得用不到的模型，也不寫入任何本機儲存', async () => {
  stubCache(false)
  vi.stubGlobal('Worker', undefined)
  const requests: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string) => { requests.push(url); throw new Error('offline') }))
  const wrapper = await mountWorkspace()
  expect(wrapper.text()).toContain('這個瀏覽器無法在本機執行去背模型')
  expect(wrapper.find('input[type=file]').attributes('disabled')).toBeUndefined()
  // §12.8: an unsupported device must fail before it pays for the model, even once a photo is chosen.
  await selectFile(wrapper, png())
  expect(submit(wrapper).attributes('disabled')).toBeDefined()
  expect(requests.some(isModelRequest)).toBe(false)
  expect(localStorage.length).toBe(0)
  expect(sessionStorage.length).toBe(0)
})

it('只開啟頁面、還沒選照片時，不會取得模型，也沒有下載模型的按鈕或說明', async () => {
  stubCache(false)
  const { requests } = stubNetwork()
  stubWorker(capable)
  const wrapper = await mountWorkspace()
  await flushPromises()
  expect(requests.some(isModelRequest)).toBe(false)
  expect(wrapper.text()).not.toContain('下載')
  expect(wrapper.text()).not.toContain('準備中')
  expect(wrapper.find('[role=progressbar]').exists()).toBe(false)
  expect(submit(wrapper).text()).toBe('開始去背')
})

it('選好照片就在背景開始準備；按開始時若還沒好，按鈕旁顯示準備中與進度，完成後自動接續去背', async () => {
  stubCache(false)
  const held = heldResponse()
  const { requests } = stubNetwork(held.serve)
  stubWorker(succeeds)
  const wrapper = await mountWorkspace()
  await selectFile(wrapper, png())

  // The photo is the signal: the first file is requested before anyone presses start.
  await vi.waitFor(() => expect(requests.filter(isModelRequest)).toEqual([backgroundRemovalAssets[0]!.url]))
  // Nothing is announced while the visitor is still looking at the photo.
  expect(wrapper.find('[data-model-preparing]').exists()).toBe(false)
  expect(submit(wrapper).attributes('disabled')).toBeUndefined()

  await start(wrapper)
  const preparing = wrapper.find('[data-model-preparing]')
  expect(preparing.exists()).toBe(true)
  expect(preparing.text()).toContain('準備中')
  expect(preparing.find('[role=progressbar]').attributes('aria-valuenow')).toBe('0')
  expect(wrapper.find('form').attributes('aria-busy')).toBe('true')
  expect(wrapper.find('.image-background-remover__status').text()).toBe('準備中，完成後會自動開始去背。')
  expect(button(wrapper, '取消')).toBeDefined()
  expect(wrapper.text()).not.toContain('下載')

  held.release()
  await vi.waitFor(() => expect(wrapper.find('[data-image-result]').exists()).toBe(true))
  // One attempt, shared by the background start and the visitor waiting on it: each file once.
  expect(requests.filter(isModelRequest)).toEqual(backgroundRemovalAssets.map(asset => asset.url))
  expect(wrapper.find('[data-model-preparing]').exists()).toBe(false)
  expect(wrapper.attributes('data-model-ready')).toBe('true')
})

it('已經準備好的裝置：直接去背，整個過程不出現下載或準備字樣', async () => {
  stubCache(true)
  const { requests } = stubNetwork()
  stubWorker(succeeds)
  const wrapper = await mountWorkspace()
  await selectFile(wrapper, png())
  expect(wrapper.text()).not.toContain('下載')
  await wrapper.find('form').trigger('submit')
  expect(wrapper.find('[data-model-preparing]').exists()).toBe(false)
  expect(wrapper.text()).not.toMatch(/下載|準備中/)
  await flushPromises()

  expect(wrapper.find('[data-image-result]').exists()).toBe(true)
  expect(requests.some(isModelRequest)).toBe(false)
  // Once there is a result, "download" only ever refers to the finished PNG.
  expect(wrapper.text()).not.toMatch(/下載模型|下載資源|首次使用需下載|準備中/)
})

it('離線時按開始會說明原因並提供重試；連上網路後按重試即可完成', async () => {
  stubCache(false)
  const { requests } = stubNetwork()
  stubWorker(succeeds)
  setOnline(false)
  const wrapper = await mountWorkspace()
  await selectFile(wrapper, png())
  expect(requests.some(isModelRequest)).toBe(false)

  await start(wrapper)
  await vi.waitFor(() => expect(wrapper.find('[role=alert]').text()).toContain('目前沒有網路'))
  expect(wrapper.find('[role=alert]').text()).toContain('用過一次後，離線也能使用')
  expect(submit(wrapper).text()).toBe('重試')
  expect(submit(wrapper).attributes('disabled')).toBeUndefined()
  expect(wrapper.text()).not.toContain('下載')

  setOnline(true)
  await start(wrapper)
  await vi.waitFor(() => expect(wrapper.find('[data-image-result]').exists()).toBe(true))
  expect(wrapper.find('[role=alert]').text()).toBe('')
  expect(submit(wrapper).text()).toBe('開始去背')
})

it('準備失敗時說明原因並提供重試，重試會重新取得並接續去背', async () => {
  stubCache(false)
  const { network, requests } = stubNetwork(async () => { throw new Error('connection dropped') })
  stubWorker(succeeds)
  const wrapper = await mountWorkspace()
  await selectFile(wrapper, png())
  // The background attempt failed quietly; the visitor has not asked for anything yet.
  expect(wrapper.find('[role=alert]').text()).toBe('')

  await start(wrapper)
  await vi.waitFor(() => expect(wrapper.find('[role=alert]').text()).toContain('去背功能沒有準備完成'))
  expect(submit(wrapper).text()).toBe('重試')
  expect(wrapper.find('[data-image-result]').exists()).toBe(false)

  network.serve = modelBytes
  const before = requests.filter(isModelRequest).length
  await start(wrapper)
  await vi.waitFor(() => expect(wrapper.find('[data-image-result]').exists()).toBe(true))
  expect(requests.filter(isModelRequest).length).toBe(before + backgroundRemovalAssets.length)
})

it('收到的檔案與公布的版本不符時捨棄不用，說明原因並提供重試', async () => {
  const stored = stubCache(false)
  stubNetwork(async () => new Response(new Uint8Array([9, 9, 9])))
  stubWorker(succeeds)
  const wrapper = await mountWorkspace()
  await selectFile(wrapper, png())
  await start(wrapper)
  await vi.waitFor(() => expect(wrapper.find('[role=alert]').text()).toContain('收到的檔案不完整或已損壞'))
  expect(submit(wrapper).text()).toBe('重試')
  expect(stored.size).toBe(0)
})

it('等待準備時取消：停止取得檔案、不交付結果；再按開始會重新準備並接續', async () => {
  stubCache(false)
  const held = heldResponse()
  const { requests } = stubNetwork(held.serve)
  stubWorker(succeeds)
  const wrapper = await mountWorkspace()
  await selectFile(wrapper, png())
  await start(wrapper)
  expect(wrapper.find('[data-model-preparing]').exists()).toBe(true)

  await button(wrapper, '取消')!.trigger('click')
  await flushPromises()
  expect(held.signals[0]!.aborted).toBe(true)
  expect(wrapper.text()).toContain('已取消。原圖未變更')
  expect(wrapper.find('[data-model-preparing]').exists()).toBe(false)
  expect(wrapper.find('[data-image-result]').exists()).toBe(false)
  expect(wrapper.find('[role=alert]').text()).toBe('')

  await start(wrapper)
  expect(wrapper.find('[data-model-preparing]').exists()).toBe(true)
  held.release()
  await vi.waitFor(() => expect(wrapper.find('[data-image-result]').exists()).toBe(true))
  expect(requests.filter(isModelRequest).length).toBe(1 + backgroundRemovalAssets.length)
})

it('清除照片不會中斷背景準備：換一張照片仍沿用同一次準備', async () => {
  stubCache(false)
  const held = heldResponse()
  const { requests } = stubNetwork(held.serve)
  stubWorker(succeeds)
  const wrapper = await mountWorkspace()
  await selectFile(wrapper, png())
  await vi.waitFor(() => expect(held.signals).toHaveLength(1))
  await button(wrapper, '清除圖片')!.trigger('click')
  await flushPromises()
  expect(held.signals[0]!.aborted).toBe(false)

  await selectFile(wrapper, png())
  held.release()
  await start(wrapper)
  await vi.waitFor(() => expect(wrapper.find('[data-image-result]').exists()).toBe(true))
  expect(requests.filter(isModelRequest)).toEqual(backgroundRemovalAssets.map(asset => asset.url))
})

it('儲存空間不足時不取得檔案，按開始時說明原因並提供重試', async () => {
  stubCache(false)
  const { requests } = stubNetwork()
  stubWorker(succeeds)
  vi.stubGlobal('navigator', new Proxy(navigator, {
    get: (target, key) => key === 'storage'
      ? { estimate: async () => ({ quota: 5, usage: 0 }) }
      : Reflect.get(target, key),
  }))
  const wrapper = await mountWorkspace()
  await selectFile(wrapper, png())
  await start(wrapper)
  await vi.waitFor(() => expect(wrapper.find('[role=alert]').text()).toContain('儲存空間不足'))
  expect(submit(wrapper).text()).toBe('重試')
  expect(requests.some(isModelRequest)).toBe(false)
})

it('瀏覽器自行清掉已存的檔案時，說明原因；重試會重新取得並完成', async () => {
  stubCache(true)
  const { requests } = stubNetwork()
  let runs = 0
  stubWorker((message, worker) => {
    if (message.type === 'prepare') return capable(message, worker)
    runs += 1
    if (runs === 1) worker.onmessage?.({ data: { type: 'error', code: 'model_download_failed' } })
    else succeeds(message, worker)
  })
  const wrapper = await mountWorkspace()
  await selectFile(wrapper, png())
  await start(wrapper)
  await vi.waitFor(() => expect(wrapper.find('[role=alert]').text()).toContain('去背功能沒有準備完成'))
  expect(wrapper.attributes('data-model-ready')).toBe('false')

  await start(wrapper)
  await vi.waitFor(() => expect(wrapper.find('[data-image-result]').exists()).toBe(true))
  expect(requests.filter(isModelRequest)).toEqual(backgroundRemovalAssets.map(asset => asset.url))
})

it('選好圖片後直接顯示預覽，而不是檔名與位元組數', async () => {
  stubCache(true)
  stubNetwork()
  stubWorker(capable)
  const wrapper = await mountWorkspace()
  await selectFile(wrapper, png())
  const preview = wrapper.find('[data-image-source] img')
  expect(preview.exists()).toBe(true)
  expect(preview.attributes('src')).toBe('blob:preview')
  expect(wrapper.text()).not.toContain('portrait.png')
  expect(wrapper.text()).not.toContain('bytes')
  await button(wrapper, '清除圖片')!.trigger('click')
  await flushPromises()
  expect(wrapper.find('[data-image-source]').exists()).toBe(false)
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview')
})

it('先說明只處理人像，並在解碼前拒絕 HEIC／HEIF，也不因此取得模型', async () => {
  stubCache(false)
  const { requests } = stubNetwork()
  stubWorker(capable)
  const wrapper = await mountWorkspace()
  expect(wrapper.text()).toContain('人像')
  await selectFile(wrapper, new File([new Uint8Array([255, 216, 255])], 'selfie.heic', { type: '' }))
  expect(wrapper.text()).toContain('第一版不支援 iPhone HEIC／HEIF')
  expect(submit(wrapper).attributes('disabled')).toBeDefined()
  expect(requests.some(isModelRequest)).toBe(false)
})

it('完成後同時呈現原圖與透明結果，以 KB／MB 標示大小，並提供 PNG 下載與品質提醒', async () => {
  stubCache(true)
  stubNetwork()
  stubWorker(succeeds)
  const wrapper = await mountWorkspace()
  await selectFile(wrapper, png())
  await start(wrapper)
  await vi.waitFor(() => expect(wrapper.find('[data-image-original]').exists()).toBe(true))
  const output = wrapper.find('[data-image-result]')
  expect(output.exists()).toBe(true)
  expect(output.text()).toContain('900 × 1200')
  expect(output.text()).toContain('2 KB')
  expect(wrapper.text()).not.toContain('bytes')
  const download = wrapper.find('a[download]')
  expect(download.attributes('download')).toMatch(/\.png$/)
  expect(wrapper.text()).toContain('請確認邊緣')
})

it('去背中取消後不交付部分結果，狀態說明原圖未變更且可重試', async () => {
  stubCache(true)
  stubNetwork()
  stubWorker(capable)
  const wrapper = await mountWorkspace()
  await selectFile(wrapper, png())
  await start(wrapper)
  await button(wrapper, '取消')!.trigger('click')
  await flushPromises()
  expect(wrapper.text()).toContain('已取消')
  expect(wrapper.find('[data-image-result]').exists()).toBe(false)
  expect(wrapper.find('a[download]').exists()).toBe(false)
  expect(submit(wrapper).attributes('disabled')).toBeUndefined()
})
