import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import CompliantProductImageWorkspace from '@/components/CompliantProductImageWorkspace.vue'

const mounted: ReturnType<typeof mount>[] = []

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  // The day the four sources were read, so every preset starts inside its review period.
  vi.setSystemTime(new Date('2026-09-08T09:00:00+08:00'))
})
afterEach(() => {
  mounted.splice(0).forEach(wrapper => wrapper.unmount())
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

interface WorkerStub { onmessage?: (event: { data: unknown }) => void }

function stubWorker(behaviour: (message: { type: string, input?: Record<string, unknown> }, worker: WorkerStub) => void) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('/* public worker code */')))
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.stubGlobal('Worker', class {
    onmessage?: (event: { data: unknown }) => void
    terminate = vi.fn()
    postMessage(message: { type: string, input?: Record<string, unknown> }) { queueMicrotask(() => behaviour(message, this)) }
  })
}

const capable = (formats = ['image/jpeg', 'image/png', 'image/webp']) =>
  (message: { type: string }, worker: WorkerStub) => {
    if (message.type === 'prepare') worker.onmessage?.({ data: { type: 'capabilities', supported: true, formats } })
  }

function renders(bytes: number, patch: Record<string, unknown> = {}) {
  return (message: { type: string }, worker: WorkerStub) => {
    if (message.type === 'prepare') {
      worker.onmessage?.({ data: { type: 'capabilities', supported: true, formats: ['image/jpeg', 'image/png', 'image/webp'] } })
      return
    }
    worker.onmessage?.({
      data: {
        type: 'result',
        output: {
          bytes: new Uint8Array(bytes).buffer,
          preview: new Uint8Array([4]).buffer,
          format: 'image/jpeg',
          width: 1000,
          height: 1000,
          sourceWidth: 2400,
          sourceHeight: 1800,
          coverage: 1,
          quality: 0.8,
          ...patch,
        },
      },
    })
  }
}

const jpeg = () => new File([new Uint8Array([255, 216, 255, 224])], 'product.jpg', { type: 'image/jpeg' })

/** happy-dom never loads a blob URL, so the source preview reports a size the way a browser would. */
function stubSourceImage(naturalWidth = 2400, naturalHeight = 1800) {
  vi.stubGlobal('Image', class {
    naturalWidth = naturalWidth
    naturalHeight = naturalHeight
    onload?: () => void
    onerror?: () => void
    set src(_value: string) { queueMicrotask(() => this.onload?.()) }
  })
}

async function mountWorkspace() {
  const wrapper = mount(CompliantProductImageWorkspace)
  mounted.push(wrapper)
  await flushPromises()

  return wrapper
}

async function selectPreset(wrapper: ReturnType<typeof mount>, presetId: string) {
  await wrapper.find('#compliant-preset').setValue(presetId)
  await flushPromises()
}

async function selectFile(wrapper: ReturnType<typeof mount>, file: File) {
  const input = wrapper.find('input[type=file]')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
  await flushPromises()
}

it('能力不足時說明原因、停用產生按鈕，且不寫入任何本機儲存', async () => {
  vi.stubGlobal('Worker', undefined)
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
  const wrapper = await mountWorkspace()

  expect(wrapper.text()).toContain('這個瀏覽器無法在背景處理圖片')
  expect(wrapper.find('button[type=submit]').attributes('disabled')).toBeDefined()
  expect(localStorage.length).toBe(0)
  expect(sessionStorage.length).toBe(0)
})

it('每個 preset 都看得到通路、用途、來源連結、查核日期、狀態與適用範圍', async () => {
  stubWorker(capable())
  const wrapper = await mountWorkspace()
  await selectPreset(wrapper, 'momo-store-main')
  const panel = wrapper.find('[data-preset-source]')

  expect(panel.text()).toContain('momo 商店（賣家自行上架）')
  expect(panel.text()).toContain('商品頁的主要商品圖')
  expect(panel.text()).toContain('2026')
  expect(panel.text()).toContain('momo 商店由賣家自行上架的商品主圖')
  const link = panel.find('a[href="https://rules.momo.com.tw/goods/00021/"]')
  expect(link.exists()).toBe(true)
  expect(link.attributes('rel')).toContain('noopener')
  expect(wrapper.find('[data-preset-status]').attributes('data-status')).toBe('active')
})

it('通路沒有公開的欄位寫出缺哪一項，而不是留白', async () => {
  stubWorker(capable())
  const wrapper = await mountWorkspace()
  await selectPreset(wrapper, 'ruten-main')

  // ruten publishes no minimum dimension; the page has to say so rather than imply none exists.
  expect(wrapper.find('[data-coverage-gaps]').text()).toContain('尺寸範圍')
  expect(wrapper.find('[data-coverage-gaps]').text()).toContain('未公開')
})

it('固定尺寸的通路鎖住寬高，並說明只接受一種尺寸', async () => {
  stubWorker(capable())
  const wrapper = await mountWorkspace()
  await selectPreset(wrapper, 'momo-store-ad')

  const width = wrapper.find('#compliant-width')
  expect((width.element as HTMLInputElement).value).toBe('1000')
  expect(width.attributes('readonly')).toBeDefined()
  expect(wrapper.text()).toContain('這個通路只接受一種尺寸')
})

it('輸出設定超出通路允許範圍時，在開始前就說明並停用產生', async () => {
  stubWorker(capable())
  const wrapper = await mountWorkspace()
  await selectPreset(wrapper, 'ruten-main')
  await selectFile(wrapper, jpeg())
  await wrapper.find('#compliant-width').setValue('3000')
  await wrapper.find('#compliant-height').setValue('400')
  await flushPromises()

  expect(wrapper.text()).toContain('長寬比不在這個通路允許的範圍內')
  expect(wrapper.find('button[type=submit]').attributes('disabled')).toBeDefined()
})

it('已過查核效期的 preset 停用、說明原因，且不能用來產生輸出', async () => {
  // Every preset was reviewed on 2026-09-07; 90 days plus 30 of grace end well before this.
  vi.setSystemTime(new Date('2027-06-01T09:00:00+08:00'))
  stubWorker(capable())
  const wrapper = await mountWorkspace()
  await selectFile(wrapper, jpeg())

  expect(wrapper.find('[data-preset-status]').attributes('data-status')).toBe('expired')
  expect(wrapper.find('[data-preset-notices]').text()).toContain('已超過查核效期')
  expect(wrapper.find('button[type=submit]').attributes('disabled')).toBeDefined()
  expect(wrapper.find('[data-preset-check]').exists()).toBe(false)
})

it('解碼前拒絕 HEIC／HEIF，並保留檔案欄位', async () => {
  stubWorker(capable())
  const wrapper = await mountWorkspace()
  await selectFile(wrapper, new File([new Uint8Array([255, 216, 255])], 'product.heic', { type: '' }))

  expect(wrapper.find('#compliant-error').text()).toContain('第一版不支援 iPhone HEIC／HEIF')
  expect(wrapper.find('button[type=submit]').attributes('disabled')).toBeDefined()
})

it('完成後寫出輸出尺寸與容量，逐類列出檢查結果，並提供下載', async () => {
  stubWorker(renders(400_000))
  const wrapper = await mountWorkspace()
  await selectPreset(wrapper, 'momo-store-main')
  await selectFile(wrapper, jpeg())
  await wrapper.find('form').trigger('submit')
  await flushPromises()

  const result = wrapper.find('[data-image-result]')
  expect(result.exists()).toBe(true)
  expect(result.text()).toContain('1000 × 1000')
  const check = wrapper.find('[data-preset-check]')
  expect(check.attributes('data-result')).toBe('pass')
  expect(check.find('[data-rule-group="passed"]').text()).toContain('尺寸須為 1000 × 1000 像素')
  // momo's YCbCr and occupancy rules can never be decided from one output file.
  expect(check.find('[data-rule-group="assisted"]').text()).toContain('色度模型')
  expect(check.find('[data-rule-group="manual"]').text()).toContain('每則商品')
  expect(check.find('[data-rule-group="out-of-scope"]').text()).toContain('允許放置於')
  expect(wrapper.find('a[download]').attributes('download')).toMatch(/\.jpg$/)
})

it('未通過的規範寫成未通過，未達成的建議只是建議', async () => {
  stubWorker(renders(20_000))
  const wrapper = await mountWorkspace()
  await selectPreset(wrapper, 'momo-store-main')
  await selectFile(wrapper, jpeg())
  await wrapper.find('form').trigger('submit')
  await flushPromises()

  const check = wrapper.find('[data-preset-check]')
  expect(check.attributes('data-result')).toBe('fail')
  expect(check.find('[data-rule-group="failed"]').text()).toContain('檔案大小')
  expect(check.text()).toContain('有規範項目未通過')
})

it('尚未生效的規則列出來但不列入判定', async () => {
  stubWorker(renders(400_000, { width: 400, height: 400 }))
  const wrapper = await mountWorkspace()
  await selectFile(wrapper, jpeg())
  await wrapper.find('form').trigger('submit')
  await flushPromises()

  // Google's 500 x 500 minimum only binds from 2027-01-31.
  const check = wrapper.find('[data-preset-check]')
  expect(check.find('[data-rule-group="scheduled"]').text()).toContain('2027-01-31')
  expect(check.find('[data-rule-group="failed"]').exists()).toBe(false)
  expect(wrapper.find('[data-preset-notices]').text()).toContain('自指定日期起才生效')
})

it('佔比輔助框以文字說明它是輔助，不只用顏色表達', async () => {
  stubWorker(renders(400_000))
  const wrapper = await mountWorkspace()
  await selectPreset(wrapper, 'momo-store-main')
  await selectFile(wrapper, jpeg())
  await wrapper.find('form').trigger('submit')
  await flushPromises()

  const guide = wrapper.find('[data-occupancy-guide]')
  expect(guide.exists()).toBe(true)
  expect(guide.text()).toContain('80%')
  expect(wrapper.text()).toContain('工具提供輔助')
})

it('取消後不交付部分結果，狀態說明原圖未變更且可重試', async () => {
  stubWorker(capable())
  const wrapper = await mountWorkspace()
  await selectFile(wrapper, jpeg())
  await wrapper.find('form').trigger('submit')
  await flushPromises()
  const cancel = wrapper.findAll('button').find(button => button.text().includes('取消'))!
  await cancel.trigger('click')
  await flushPromises()

  expect(wrapper.text()).toContain('已取消')
  expect(wrapper.find('[data-image-result]').exists()).toBe(false)
  expect(wrapper.find('a[download]').exists()).toBe(false)
})

it('選取 preset 時，八句免責與被排除的通路都看得見', async () => {
  stubWorker(capable())
  const wrapper = await mountWorkspace()
  const caveats = wrapper.find('[data-preset-caveats]')

  expect(caveats.text()).toContain('規格輔助，不保證通路審核通過。')
  expect(caveats.text()).toContain('toolsliang 與各通路沒有合作或授權關係')
  expect(caveats.text()).toContain('超過查核效期的 preset 會停用')
  expect(caveats.text()).toContain('商品圖片、裁切參數、預覽與輸出只在這台裝置上處理。')
  const excluded = wrapper.find('[data-excluded-channels]')
  expect(excluded.text()).toContain('蝦皮購物（台灣）')
  expect(excluded.text()).toContain('JavaScript')
})

it('只提供這個通路允許、而且這個瀏覽器寫得出來的格式', async () => {
  stubWorker(capable(['image/jpeg', 'image/webp']))
  const wrapper = await mountWorkspace()
  await selectPreset(wrapper, 'ruten-main')
  const options = wrapper.findAll('#compliant-format option').map(option => option.attributes('value'))

  // Ruten allows JPEG and PNG only, and this browser cannot write PNG.
  expect(options).toEqual(['image/jpeg'])
})

it('選好圖片後就看得到裁切預覽與佔比輔助框，不必先產生輸出', async () => {
  stubWorker(capable())
  stubSourceImage()
  const wrapper = await mountWorkspace()
  await selectPreset(wrapper, 'momo-store-main')
  await selectFile(wrapper, jpeg())

  // §4.4 calls occupancy `assisted`: an aid you can only see after committing is not one.
  const preview = wrapper.find('[data-image-preview]')
  expect(preview.exists()).toBe(true)
  expect(preview.text()).toContain('裁切預覽')
  expect(wrapper.find('[data-image-result]').exists()).toBe(false)
  expect(wrapper.find('[data-occupancy-guide]').text()).toContain('80%')
})

it('裁切設定改變時預覽跟著更新，而不是消失到下次產生為止', async () => {
  stubWorker(capable())
  stubSourceImage(2000, 1000)
  const wrapper = await mountWorkspace()
  await selectPreset(wrapper, 'momo-store-main')
  await selectFile(wrapper, jpeg())
  const covered = () => wrapper.find('[data-image-preview]').text()

  expect(covered()).toContain('100%')
  await wrapper.find('#compliant-fit').setValue('contain')
  await flushPromises()
  expect(wrapper.find('[data-image-preview]').exists()).toBe(true)
  expect(covered()).toContain('50%')
})

it('已停用的 preset 即使被送出，也只會說明原因而不產生輸出', async () => {
  vi.setSystemTime(new Date('2027-06-01T09:00:00+08:00'))
  stubWorker(renders(400_000))
  stubSourceImage()
  const wrapper = await mountWorkspace()
  await selectFile(wrapper, jpeg())
  await wrapper.find('form').trigger('submit')
  await flushPromises()

  expect(wrapper.find('#compliant-error').text()).toContain('這個通路規格目前停用')
  expect(wrapper.find('[data-image-result]').exists()).toBe(false)
  expect(wrapper.find('a[download]').exists()).toBe(false)
})

it('一直到規則清單都寫出尚未生效的日期，不讓它讀起來像現行規範', async () => {
  stubWorker(capable())
  const wrapper = await mountWorkspace()

  // Google announced a 500 x 500 minimum that only binds from 2027-01-31.
  expect(wrapper.find('.compliant-product-image__rules').text()).toContain('生效日 2027-01-31')
})

it('說明為什麼預設輸出 JPEG，且不宣稱已檢查色度模型', async () => {
  stubWorker(capable())
  const wrapper = await mountWorkspace()
  await selectPreset(wrapper, 'momo-store-main')
  const help = wrapper.find('#compliant-format-help').text()

  expect(help).toContain('YCbCr')
  expect(help).toContain('工具不會替你判定')
})
