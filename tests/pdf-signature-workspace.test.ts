import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import PdfSignatureWorkspace from '@/components/PdfSignatureWorkspace.vue'
import { pdfSignatureDisclosures } from '@/features/tools/pdf-signature/domain/reference'
import type { PdfSignatureReply, PdfSignatureRequest } from '@/features/tools/pdf-signature/types'

/**
 * The workspace as a visitor meets it: what it says before anything is chosen,
 * what it does with a document it cannot open, and what it leaves behind when it
 * goes away.
 *
 * Making a signature is not exercised here — this environment has no canvas, so
 * a rasterised signature cannot exist in it. `tests/e2e/pdf-signature.spec.ts`
 * covers drawing, typing, importing and placing in real browsers, and
 * `tests/pdf-signature-placement.test.ts` covers the arithmetic behind them.
 */
const mounted: ReturnType<typeof mount>[] = []
const workers: Array<{ terminated: boolean }> = []
const revoked: string[] = []

afterEach(() => {
  mounted.splice(0).forEach(wrapper => wrapper.unmount())
  workers.length = 0
  revoked.length = 0
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function stubWorker(answer: (request: PdfSignatureRequest, reply: (reply: PdfSignatureReply) => void) => void) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('/* public worker code */')))
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:pdf-signature-${revoked.length}`)
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(url => { revoked.push(url) })
  vi.stubGlobal('Worker', class {
    private readonly listeners: Array<(event: { data: unknown }) => void> = []
    private readonly self = { terminated: false }
    constructor() { workers.push(this.self) }
    addEventListener(_type: string, listener: (event: { data: unknown }) => void) { this.listeners.push(listener) }
    removeEventListener() {}
    set onerror(_listener: unknown) {}
    set onmessageerror(_listener: unknown) {}
    terminate() { this.self.terminated = true }
    postMessage(request: PdfSignatureRequest) {
      queueMicrotask(() => {
        if (this.self.terminated) return
        answer(request, reply => this.listeners.forEach(listener => listener({ data: reply })))
      })
    }
  })
}

const capable = (request: PdfSignatureRequest, reply: (reply: PdfSignatureReply) => void) => {
  if (request.type === 'capabilities') {
    reply({ type: 'capabilities', id: request.id, capabilities: { supported: true, formats: ['application/pdf'], password: true } })
  }
}

const documentReport = {
  pageCount: 2,
  encrypted: false,
  permissions: null,
  pages: [
    { index: 0, box: [0, 0, 595.28, 841.89] as [number, number, number, number], rotation: 0 },
    { index: 1, box: [0, 0, 595.28, 841.89] as [number, number, number, number], rotation: 0 },
  ],
}

function pdf(name = 'contract.pdf') {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x37])], name, { type: 'application/pdf' })
}

async function choose(wrapper: ReturnType<typeof mount>, file: File) {
  const input = wrapper.find('#pdf-signature-file')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
  await flushPromises()
  await flushPromises()
}

it('在可以放置任何簽名之前，就說明這不是憑證式數位簽章也不驗證身分', async () => {
  stubWorker(capable)
  const wrapper = mount(PdfSignatureWorkspace)
  mounted.push(wrapper)
  await flushPromises()

  const scope = wrapper.findAll('.pdf-signature__scope').map(node => node.text())
  expect(scope[0]).toBe(pdfSignatureDisclosures['not-a-digital-signature']['zh-tw'])
  expect(scope[1]).toBe(pdfSignatureDisclosures['no-identity-verification']['zh-tw'])

  // Every sentence the record fixes is on the page, and none of them is rewritten.
  const text = wrapper.text()
  for (const sentence of Object.values(pdfSignatureDisclosures)) expect(text).toContain(sentence['zh-tw'])
})

it('瀏覽器不支援時說明原因並提供重新檢查，不讓人先選檔案再失望', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('no worker asset') }))
  const wrapper = mount(PdfSignatureWorkspace)
  mounted.push(wrapper)
  await flushPromises()

  expect(wrapper.text()).toContain('這個瀏覽器無法在本機開啟並編輯 PDF')
  expect(wrapper.findAll('button').some(button => button.text().includes('重新檢查'))).toBe(true)
})

it('離線且尚未取得本機引擎時，說的是引擎還沒下載，而不是瀏覽器不支援', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
  vi.stubGlobal('navigator', { ...globalThis.navigator, onLine: false })
  const wrapper = mount(PdfSignatureWorkspace)
  mounted.push(wrapper)
  await flushPromises()
  await choose(wrapper, pdf())

  expect(wrapper.find('[role="alert"]').text()).toContain('本機 PDF 引擎還沒有存到這台裝置上')
})

it('開啟後顯示頁數與保護狀態，並要求第一頁的預覽', async () => {
  const requests: PdfSignatureRequest[] = []
  stubWorker((request, reply) => {
    requests.push(request)
    capable(request, reply)
    if (request.type === 'open') reply({ type: 'document', id: request.id, report: documentReport })
    if (request.type === 'preview') {
      reply({ type: 'preview', id: request.id, report: { index: request.page, scale: request.scale, width: 893, height: 1263, bytes: new Uint8Array([1]).buffer } })
    }
  })
  const wrapper = mount(PdfSignatureWorkspace)
  mounted.push(wrapper)
  await flushPromises()
  await choose(wrapper, pdf())

  expect(wrapper.find('[data-document-summary]').text()).toContain('共 2 頁')
  expect(wrapper.find('[data-document-summary]').text()).toContain('沒有密碼保護')
  expect(wrapper.find('[data-page-preview] img').attributes('src')).toMatch(/^blob:/)
  expect(requests.filter(request => request.type === 'preview')).toMatchObject([{ page: 0, scale: 1.5 }])
  // A document nobody has signed cannot be exported.
  expect(wrapper.find('[data-export]').attributes('disabled')).toBeDefined()
})

it('需要密碼時出現密碼欄位，密碼只往 Worker 送，不寫進任何本機儲存', async () => {
  const passwords: Array<string | undefined> = []
  stubWorker((request, reply) => {
    capable(request, reply)
    if (request.type === 'open') {
      passwords.push(request.password)
      if (request.password === 'toolsliang-t24') reply({ type: 'document', id: request.id, report: { ...documentReport, encrypted: true } })
      else reply({ type: 'failure', id: request.id, code: request.password === undefined ? 'password_required' : 'password_rejected' })
    }
    if (request.type === 'preview') {
      reply({ type: 'preview', id: request.id, report: { index: request.page, scale: request.scale, width: 893, height: 1263, bytes: new Uint8Array([1]).buffer } })
    }
  })
  const wrapper = mount(PdfSignatureWorkspace)
  mounted.push(wrapper)
  await flushPromises()
  await choose(wrapper, pdf('locked.pdf'))

  expect(wrapper.find('[role="alert"]').text()).toContain('需要開啟密碼')
  expect(wrapper.find('#pdf-signature-password').exists()).toBe(true)
  expect(wrapper.text()).toContain(pdfSignatureDisclosures['password-stays-on-device']['zh-tw'])

  await wrapper.find('#pdf-signature-password').setValue('wrong')
  await wrapper.find('.pdf-signature__password').trigger('submit')
  await flushPromises()
  expect(wrapper.find('[role="alert"]').text()).toContain('密碼不正確')

  await wrapper.find('#pdf-signature-password').setValue('toolsliang-t24')
  await wrapper.find('.pdf-signature__password').trigger('submit')
  await flushPromises()
  await flushPromises()

  expect(passwords).toEqual([undefined, 'wrong', 'toolsliang-t24'])
  expect(wrapper.find('[data-document-summary]').text()).toContain('有密碼保護')
  // A protected document loses its protection on the way out, and that is said before the download exists.
  expect(wrapper.find('[data-decrypted-notice]').text()).toBe(pdfSignatureDisclosures['decrypted-export']['zh-tw'])
  expect(wrapper.find('[data-export-summary]').exists()).toBe(false)
  expect(localStorage.length).toBe(0)
  expect(sessionStorage.length).toBe(0)
  expect(JSON.stringify(localStorage) + JSON.stringify(sessionStorage)).not.toContain('toolsliang-t24')
})

it('取消會終止 Worker，並說明原檔未變更', async () => {
  stubWorker((request, reply) => {
    capable(request, reply)
    if (request.type === 'open') reply({ type: 'document', id: request.id, report: documentReport })
    /* The preview never answers, so the workspace stays busy and cancellable. */
  })
  const wrapper = mount(PdfSignatureWorkspace)
  mounted.push(wrapper)
  await flushPromises()
  await choose(wrapper, pdf())

  const cancel = wrapper.findAll('button').find(button => button.text().includes('取消'))!
  await cancel.trigger('click')
  await flushPromises()

  expect(wrapper.find('.pdf-signature__status').text()).toContain('已取消')
  expect(wrapper.find('.pdf-signature__status').text()).toContain('原檔未變更')
  // The worker that was working is gone; the document is opened again on a new
  // one, because the placements live in the page and stay usable.
  expect(workers[0]!.terminated).toBe(true)
  expect(workers.length).toBe(2)
})

it('離開工具時釋放 Worker 與所有 Blob URL', async () => {
  stubWorker((request, reply) => {
    capable(request, reply)
    if (request.type === 'open') reply({ type: 'document', id: request.id, report: documentReport })
    if (request.type === 'preview') {
      reply({ type: 'preview', id: request.id, report: { index: request.page, scale: request.scale, width: 893, height: 1263, bytes: new Uint8Array([1]).buffer } })
    }
  })
  const wrapper = mount(PdfSignatureWorkspace)
  mounted.push(wrapper)
  await flushPromises()
  await choose(wrapper, pdf())
  const created = wrapper.find('[data-page-preview] img').attributes('src')

  wrapper.unmount()
  mounted.length = 0

  expect(revoked).toContain(created)
  expect(workers.every(worker => worker.terminated)).toBe(true)
})
