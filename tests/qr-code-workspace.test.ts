import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import QrCodeGeneratorWorkspace from '@/components/QrCodeGeneratorWorkspace.vue'
import { setTestRoute } from './support/nuxt-stubs'

function mountWorkspace(locale: 'zh-tw' | 'en' = 'zh-tw') {
  setTestRoute({ path: `/${locale}/tools/qr-code-generator/`, params: { locale, slug: 'qr-code-generator' } })
  return mount(QrCodeGeneratorWorkspace, { attachTo: document.body })
}

function downloadButtons(wrapper: ReturnType<typeof mountWorkspace>) {
  return wrapper.findAll('.qr-code__actions button')
}

describe('QR Code generator workspace', () => {
  const storageWrites: string[] = []

  beforeEach(() => {
    storageWrites.length = 0
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string) => {
      storageWrites.push(key)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('opens on the link field with nothing to download yet and no error', () => {
    const wrapper = mountWorkspace()

    expect(wrapper.get('input[name="qr-content-kind"][value="url"]').element).toHaveProperty('checked', true)
    expect(wrapper.get('label[for="qr-url"]').text()).toBe('貼上網址')
    expect(wrapper.get('#qr-url').attributes('inputmode')).toBe('url')
    expect(wrapper.find('svg.qr-code__image').exists()).toBe(false)
    expect(wrapper.get('.qr-code__status').text()).toBe('輸入內容後，這裡會顯示 QR Code。')
    expect(wrapper.findAll('[role="alert"]')).toHaveLength(0)
    for (const button of downloadButtons(wrapper)) expect(button.attributes('disabled')).toBeDefined()
  })

  it('draws the code as the link is typed and shows the address it actually encodes', async () => {
    const wrapper = mountWorkspace()
    await wrapper.get('#qr-url').setValue('line.me/R/ti/p/@example')

    const image = wrapper.get('svg.qr-code__image')
    expect(image.attributes('role')).toBe('img')
    expect(image.attributes('aria-label')).toBe('你輸入的網址的 QR Code')
    expect(image.attributes('viewBox')).toBe('0 0 37 37')
    expect(wrapper.get('[data-encoded-url]').text()).toBe('https://line.me/R/ti/p/@example')
    expect(wrapper.get('.qr-code__status').attributes('aria-live')).toBe('polite')
    expect(wrapper.get('.qr-code__status').text()).toBe('網址的 QR Code 已產生。')
    for (const button of downloadButtons(wrapper)) expect(button.attributes('disabled')).toBeUndefined()
  })

  it('keeps what was typed for each kind when the visitor switches between them', async () => {
    const wrapper = mountWorkspace()
    await wrapper.get('#qr-url').setValue('toolsliang.com')
    await wrapper.get('input[name="qr-content-kind"][value="text"]').setValue()
    expect(wrapper.find('#qr-url').exists()).toBe(false)
    await wrapper.get('#qr-text').setValue('週一公休\n其餘 11:00 開門')
    await wrapper.get('input[name="qr-content-kind"][value="url"]').setValue()

    expect((wrapper.get('#qr-url').element as HTMLInputElement).value).toBe('toolsliang.com')
    await wrapper.get('input[name="qr-content-kind"][value="text"]').setValue()
    expect((wrapper.get('#qr-text').element as HTMLTextAreaElement).value).toBe('週一公休\n其餘 11:00 開門')
  })

  it('asks for the Wi-Fi field still missing without calling it a mistake', async () => {
    const wrapper = mountWorkspace()
    await wrapper.get('input[name="qr-content-kind"][value="wifi"]').setValue()
    expect(wrapper.get('input[name="qr-wifi-security"][value="wpa"]').element).toHaveProperty('checked', true)

    await wrapper.get('#qr-wifi-ssid').setValue('咖啡店 5G')
    expect(wrapper.get('.qr-code__status').text()).toContain('填上密碼後就會產生')
    expect(wrapper.findAll('[role="alert"]')).toHaveLength(0)
    expect(wrapper.get('#qr-wifi-ssid').attributes('aria-invalid')).toBe('false')
    expect(wrapper.find('svg.qr-code__image').exists()).toBe(false)

    await wrapper.get('#qr-wifi-password').setValue('latte;2026')
    expect(wrapper.find('svg.qr-code__image').exists()).toBe(true)
    expect(wrapper.get('.qr-code__status').text()).toBe('Wi-Fi 的 QR Code 已產生。')
    expect(wrapper.get('svg.qr-code__image').attributes('aria-label')).toBe('你輸入的 Wi-Fi 的 QR Code')
  })

  it('shows the password by default, hides it on request, and drops it for an open network', async () => {
    const wrapper = mountWorkspace()
    await wrapper.get('input[name="qr-content-kind"][value="wifi"]').setValue()
    const toggle = wrapper.get('.qr-code__password button')

    expect(wrapper.get('#qr-wifi-password').attributes('type')).toBe('text')
    expect(toggle.text()).toBe('隱藏密碼')
    await toggle.trigger('click')
    expect(wrapper.get('#qr-wifi-password').attributes('type')).toBe('password')
    expect(wrapper.get('.qr-code__password button').text()).toBe('顯示密碼')

    await wrapper.get('#qr-wifi-ssid').setValue('Free WiFi')
    await wrapper.get('input[name="qr-wifi-security"][value="nopass"]').setValue()
    expect(wrapper.find('#qr-wifi-password').exists()).toBe(false)
    expect(wrapper.find('svg.qr-code__image').exists()).toBe(true)
  })

  it('says when the text no longer fits, on the field, and offers nothing to download', async () => {
    const wrapper = mountWorkspace()
    await wrapper.get('input[name="qr-content-kind"][value="text"]').setValue()
    await wrapper.get('#qr-text').setValue('測'.repeat(778))

    const alert = wrapper.get('#qr-content-error')
    expect(alert.attributes('role')).toBe('alert')
    expect(alert.text()).toContain('內容太長')
    expect(wrapper.get('#qr-text').attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('#qr-text').attributes('aria-describedby')).toContain('qr-content-error')
    expect(wrapper.find('svg.qr-code__image').exists(), '不得留下和輸入不符的舊碼').toBe(false)
    for (const button of downloadButtons(wrapper)) expect(button.attributes('disabled')).toBeDefined()
  })

  it('blocks colours a phone cannot read, explains why in words, and offers the way back', async () => {
    const wrapper = mountWorkspace()
    await wrapper.get('#qr-url').setValue('toolsliang.com')
    await wrapper.get('#qr-foreground').setValue('#ffffff')
    await wrapper.get('#qr-background').setValue('#000000')

    const alert = wrapper.get('#qr-color-error')
    expect(alert.text()).toContain('碼的顏色要比底色深')
    expect(wrapper.get('#qr-foreground').attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('#qr-foreground').attributes('aria-describedby')).toBe('qr-color-error')
    for (const button of downloadButtons(wrapper)) expect(button.attributes('disabled')).toBeDefined()

    await wrapper.get('.qr-code__reset').trigger('click')
    expect(wrapper.find('#qr-color-error').exists()).toBe(false)
    expect(wrapper.find('.qr-code__reset').exists()).toBe(false)
    for (const button of downloadButtons(wrapper)) expect(button.attributes('disabled')).toBeUndefined()
  })

  it('downloads an SVG of the code without putting the content in the file name', async () => {
    const created: Blob[] = []
    const clicked: string[] = []
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      created.push(blob as Blob)
      return 'blob:qr'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this.download)
    })

    const wrapper = mountWorkspace()
    await wrapper.get('#qr-url').setValue('toolsliang.com')
    await downloadButtons(wrapper)[1]!.trigger('click')

    expect(clicked).toEqual(['qr-code.svg'])
    expect(created[0]!.type).toBe('image/svg+xml')
    const svg = await created[0]!.text()
    expect(svg).toContain('<svg')
    expect(svg).not.toContain('toolsliang.com')
  })

  it('never writes what was typed to storage', async () => {
    const wrapper = mountWorkspace()
    await wrapper.get('#qr-url').setValue('secret.example/launch')
    await wrapper.get('input[name="qr-content-kind"][value="wifi"]').setValue()
    await wrapper.get('#qr-wifi-ssid').setValue('Back Office')
    await wrapper.get('#qr-wifi-password').setValue('do-not-store')

    expect(storageWrites).toEqual([])
  })

  it('shows DENSO WAVE’s trademark notice and the scan reminder on the workspace', () => {
    const wrapper = mountWorkspace()
    expect(wrapper.get('.qr-code__trademark').text()).toBe('QR Code 是 DENSO WAVE INCORPORATED 的註冊商標。')
    expect(wrapper.get('[data-scan-reminder]').text()).toContain('印刷前請先用手機實際掃一次')
  })

  it('speaks English on the English page', async () => {
    const wrapper = mountWorkspace('en')
    expect(wrapper.get('label[for="qr-url"]').text()).toBe('Paste the link')
    await wrapper.get('#qr-url').setValue('toolsliang.com')
    expect(wrapper.get('.qr-code__status').text()).toBe('QR Code for the link is ready.')
    expect(wrapper.get('.qr-code__trademark').text()).toBe('QR Code is registered trademark of DENSO WAVE INCORPORATED.')
  })
})
