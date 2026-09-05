import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import NtdUppercaseWorkspace from '@/components/NtdUppercaseWorkspace.vue'
import { ntdCaveats } from '@/features/tools/ntd-uppercase/content'
import { ntdReferenceVersion } from '@/features/tools/ntd-uppercase/domain/sources'
import { setTestRoute } from './support/nuxt-stubs'

function mountWorkspace(locale: 'zh-tw' | 'en' = 'zh-tw') {
  setTestRoute({ path: `/${locale}/tools/ntd-uppercase/`, params: { locale, slug: 'ntd-uppercase' } })
  return mount(NtdUppercaseWorkspace)
}

type Workspace = ReturnType<typeof mountWorkspace>

async function enterAmount(wrapper: Workspace, amount: string) {
  await wrapper.get('#ntd-amount').setValue(amount)
  return wrapper
}

async function selectPurpose(wrapper: Workspace, purpose: string) {
  await wrapper.get(`input[name="ntd-purpose"][value="${purpose}"]`).setValue()
  return wrapper
}

/** The clipboard is a browser capability the workspace has to survive without. */
function stubClipboard(writeText: () => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'clipboard')
})

describe('NTD uppercase workspace', () => {
  it('opens on the accounting purpose with an empty, calm workspace', () => {
    const wrapper = mountWorkspace()

    expect((wrapper.get('input[name="ntd-purpose"][value="accounting"]').element as HTMLInputElement).checked).toBe(true)
    expect(wrapper.findAll('input[name="ntd-purpose"]')).toHaveLength(3)
    expect(wrapper.get('label[for="ntd-amount"]').text()).toBe('輸入金額（新臺幣）')
    expect(wrapper.get('#ntd-amount').attributes('inputmode')).toBe('decimal')
    expect(wrapper.get('#ntd-amount').attributes('aria-invalid')).toBe('false')
    expect(wrapper.findAll('[role="alert"]'), '尚未輸入不是錯誤').toHaveLength(0)
    expect(wrapper.get('.result-panel').text()).toContain('選好用途並輸入金額')
  })

  it('announces the wording and the numerals to check it against', async () => {
    const wrapper = await enterAmount(mountWorkspace(), '12,850.05')
    const result = wrapper.get('.result-panel')

    expect(result.attributes('aria-live')).toBe('polite')
    expect(wrapper.get('.ntd-result__wording').text()).toBe('新臺幣壹萬貳仟捌佰伍拾元零伍分')
    expect(result.text(), '大小寫金額必須並列，才能逐字核對').toContain('12,850.05')
  })

  it('rewrites the same amount when the purpose changes', async () => {
    const wrapper = await enterAmount(mountWorkspace(), '100000001')
    expect(wrapper.get('.ntd-result__wording').text()).toBe('新臺幣壹億零壹元整')

    await selectPurpose(wrapper, 'treasury')
    expect(wrapper.get('.ntd-result__wording').text()).toBe('新臺幣壹億壹元整')
    expect((wrapper.get('#ntd-amount').element as HTMLInputElement).value, '換用途不得清空金額').toBe('100000001')

    await selectPurpose(wrapper, 'cheque')
    expect(wrapper.get('.ntd-result__wording').text()).toBe('新臺幣壹億零壹元整')
  })

  it('shows both amounts when the treasury rounding changed the one being written', async () => {
    const wrapper = await selectPurpose(await enterAmount(mountWorkspace(), '12850.5'), 'treasury')
    const rounded = wrapper.get('.ntd-result__rounded')

    expect(rounded.text()).toContain('12,850.50')
    expect(rounded.text()).toContain('12,851')
    expect(wrapper.get('.ntd-result__wording').text()).toBe('新臺幣壹萬貳仟捌佰伍拾壹元整')

    await enterAmount(wrapper, '12850')
    expect(wrapper.find('.ntd-result__rounded').exists(), '沒有捨入就不必顯示對照').toBe(false)
  })

  it('explains a refused amount on the field that has to change', async () => {
    const wrapper = await selectPurpose(await enterAmount(mountWorkspace(), '100.5'), 'cheque')
    const alert = wrapper.get('[role="alert"]')

    expect(alert.text()).toContain('與收款人確認')
    expect(wrapper.get('#ntd-amount').attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('#ntd-amount').attributes('aria-describedby')).toContain(alert.attributes('id'))
    expect(wrapper.find('.ntd-result__wording').exists(), '無法換寫時不得顯示結果').toBe(false)
    expect(wrapper.get('.tool-workspace__copy').attributes('disabled')).toBeDefined()
  })

  it('quotes the bound of the purpose that refused the amount', async () => {
    const wrapper = await selectPurpose(await enterAmount(mountWorkspace(), '1000000000000'), 'cheque')
    expect(wrapper.get('[role="alert"]').text()).toContain('999,999,999,999')

    await selectPurpose(wrapper, 'accounting')
    expect(wrapper.findAll('[role="alert"]'), '同一筆金額在會計用途內，錯誤必須消失').toHaveLength(0)
  })

  it('asks calmly for an amount instead of raising an alert', async () => {
    const wrapper = await enterAmount(await enterAmount(mountWorkspace(), '100'), '   ')

    expect(wrapper.findAll('[role="alert"]')).toHaveLength(0)
    expect(wrapper.get('#ntd-pending').text()).toContain('請先輸入要換寫的新臺幣金額')
    expect(wrapper.get('#ntd-amount').attributes('aria-invalid')).toBe('false')
  })

  it('confirms a copy, and says so when the browser refuses one', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubClipboard(writeText)

    const wrapper = await enterAmount(mountWorkspace(), '1018')
    await wrapper.get('.tool-workspace__copy').trigger('click')
    await vi.waitFor(() => expect(wrapper.get('.ntd-copy-status').text()).toContain('已複製'))

    expect(writeText).toHaveBeenCalledWith('新臺幣壹仟零壹拾捌元整')
    expect(wrapper.get('.ntd-copy-status').attributes('role')).toBe('status')

    stubClipboard(vi.fn().mockRejectedValue(new Error('denied')))
    await wrapper.get('.tool-workspace__copy').trigger('click')
    await vi.waitFor(() => expect(wrapper.get('.ntd-copy-status').text()).toContain('無法自動複製'))
  })

  it('returns to an empty workspace after a clear, keeping the chosen purpose', async () => {
    const wrapper = await selectPurpose(await enterAmount(mountWorkspace(), '1018'), 'treasury')
    await wrapper.get('.ntd-clear').trigger('click')

    expect((wrapper.get('#ntd-amount').element as HTMLInputElement).value).toBe('')
    expect(wrapper.get('.result-panel').text()).toContain('選好用途並輸入金額')
    expect((wrapper.get('input[name="ntd-purpose"][value="treasury"]').element as HTMLInputElement).checked).toBe(true)
    expect(wrapper.find('.ntd-copy-status').text()).toBe('')
  })

  it('shows the caveats of the chosen purpose beside the result', async () => {
    const wrapper = await enterAmount(mountWorkspace(), '1018')
    const caveats = () => wrapper.get('.ntd-caveats').text()

    expect(caveats()).toContain(ntdCaveats['no-legal-effect']['zh-tw'])
    expect(caveats()).toContain(ntdCaveats['local-processing']['zh-tw'])
    expect(caveats()).not.toContain(ntdCaveats['treasury-omits-zero']['zh-tw'])

    await selectPurpose(wrapper, 'treasury')
    expect(caveats()).toContain(ntdCaveats['treasury-omits-zero']['zh-tw'])
    expect(caveats()).toContain(ntdCaveats['treasury-rounds-to-yuan']['zh-tw'])
  })

  it('names the rule version and cites the source of the chosen purpose', async () => {
    const wrapper = mountWorkspace()
    const source = () => wrapper.get('.ntd-source')

    expect(source().text()).toContain(ntdReferenceVersion)
    expect(source().text(), '一般會計不受法規限制，必須說清楚').toContain('沒有法規限制')
    expect(source().get('a').attributes('href')).toBe('https://www.twnch.org.tw/manual.html')

    await selectPurpose(wrapper, 'treasury')
    expect(source().get('a').attributes('href')).toBe('https://www.nta.gov.tw/singlehtml/296?cntId=nta_102_296')

    await selectPurpose(wrapper, 'cheque')
    expect(source().get('a').text(), '非現行法規必須標示').toContain('非現行法規')
  })

  it('warns only the treasury purpose about zeros on several unit boundaries', async () => {
    const wrapper = mountWorkspace()
    expect(wrapper.find('.ntd-zero-note').exists()).toBe(false)

    await selectPurpose(wrapper, 'treasury')
    const note = wrapper.get('.ntd-zero-note').text()
    expect(note).toContain('單一單位交界')
    expect(note).toContain('付款機關')
  })

  it('summarizes the rules of the chosen purpose', async () => {
    const wrapper = await selectPurpose(mountWorkspace(), 'treasury')
    const rules = wrapper.get('.ntd-rules').text()

    expect(rules).toContain('9,999,999,999,999,999')
    expect(rules).toContain('中間的零不書寫')
    expect(rules).toContain('元以下四捨五入')
  })

  it('publishes the worked examples and the digit reference', () => {
    const wrapper = mountWorkspace()
    const exampleRows = wrapper.findAll('.ntd-examples tbody tr')

    expect(exampleRows.length).toBeGreaterThan(2)
    const hazard = exampleRows.find(row => row.text().includes('101'))!
    expect(hazard.text()).toContain('新臺幣壹佰零壹元整')
    expect(hazard.text()).toContain('新臺幣壹佰壹元整')
    expect(wrapper.findAll('.ntd-digits tbody tr'), '十個數字分兩欄呈現').toHaveLength(5)
  })

  it('speaks English on the English page', async () => {
    const wrapper = await enterAmount(mountWorkspace('en'), '0.5')

    expect(wrapper.get('label[for="ntd-amount"]').text()).toBe('Amount (NTD)')
    expect(wrapper.get('.ntd-result__wording').text(), '結果本身仍是繁體中文單據用語').toBe('新臺幣零元伍角')
    expect(wrapper.get('.ntd-caveats').text()).toContain('not legal or accounting review')

    await selectPurpose(wrapper, 'cheque')
    expect(wrapper.get('[role="alert"]').text()).toBe('A cheque amount is written to 元 only; confirm the amount with the payee, then enter a whole number.')
  })

  it('keeps the amount out of device storage', async () => {
    const wrapper = await enterAmount(mountWorkspace(), '12,850.05')
    await selectPurpose(wrapper, 'treasury')

    expect(localStorage.length, '金額不得寫入本機儲存').toBe(0)
    expect(sessionStorage.length, '金額不得寫入本機儲存').toBe(0)
  })
})
