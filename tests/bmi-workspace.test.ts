import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import BmiCalculatorWorkspace from '@/components/BmiCalculatorWorkspace.vue'
import { bmiCaveats } from '@/features/tools/bmi-calculator/content'
import { bmiCaveatKeys } from '@/features/tools/bmi-calculator/domain/sources'
import { setTestRoute } from './support/nuxt-stubs'

function mountWorkspace(locale: 'zh-tw' | 'en' = 'zh-tw') {
  setTestRoute({ path: `/${locale}/tools/bmi-calculator/`, params: { locale, slug: 'bmi-calculator' } })
  return mount(BmiCalculatorWorkspace)
}

async function enterMetric(wrapper: ReturnType<typeof mountWorkspace>, height: string, weight: string) {
  await wrapper.get('#bmi-height-centimetres').setValue(height)
  await wrapper.get('#bmi-weight-kilograms').setValue(weight)
  return wrapper
}

describe('BMI workspace', () => {
  it('opens on metric input with a numeric keyboard and its supported range', () => {
    const wrapper = mountWorkspace()
    const height = wrapper.get('#bmi-height-centimetres')

    expect(height.attributes('inputmode')).toBe('decimal')
    expect(wrapper.get('label[for="bmi-height-centimetres"]').text()).toBe('身高（公分）')
    expect(wrapper.get('label[for="bmi-weight-kilograms"]').text()).toBe('體重（公斤）')
    expect(wrapper.text()).toContain('支援 100 到 250 公分')
    expect(wrapper.find('#bmi-height-feet').exists()).toBe(false)
    expect(height.attributes('aria-invalid')).toBe('false')
  })

  it('announces the result and its category in a polite live region', async () => {
    const wrapper = await enterMetric(mountWorkspace(), '170', '65')
    const result = wrapper.get('.result-panel')

    expect(result.attributes('aria-live')).toBe('polite')
    expect(result.text()).toContain('22.5')
    expect(result.text(), '分級必須以文字表達，不能只靠顏色').toContain('健康體重')
    expect(result.text()).toContain('18.5 ≦ BMI < 24')
  })

  it('keeps the same page while switching to imperial input', async () => {
    const wrapper = mountWorkspace()
    await wrapper.get('input[name="bmi-unit-system"][value="imperial"]').setValue()

    expect(wrapper.find('#bmi-height-centimetres').exists()).toBe(false)
    await wrapper.get('#bmi-height-feet').setValue('5')
    await wrapper.get('#bmi-height-inches').setValue('9')
    await wrapper.get('#bmi-weight-pounds').setValue('160')

    expect(wrapper.get('.result-panel').text()).toContain('23.6')
    expect(wrapper.get('.result-panel').text()).toContain('健康體重')
  })

  it('explains an unreadable number on the field that has to change', async () => {
    const wrapper = await enterMetric(mountWorkspace(), '1e2', '65')
    const alert = wrapper.get('[role="alert"]')

    expect(alert.text()).toContain('兩位小數')
    expect(wrapper.get('#bmi-height-centimetres').attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('#bmi-height-centimetres').attributes('aria-describedby')).toContain(alert.attributes('id'))
    expect(wrapper.find('.bmi-result__value').exists(), '無法計算時不得顯示數值').toBe(false)
  })

  it('quotes the supported range when a measurement is outside it', async () => {
    const wrapper = await enterMetric(mountWorkspace(), '260', '65')

    expect(wrapper.get('[role="alert"]').text()).toContain('250')
  })

  it('asks calmly for the measurement that is still missing', async () => {
    const wrapper = mountWorkspace()
    await wrapper.get('#bmi-height-centimetres').setValue('170')

    expect(wrapper.findAll('[role="alert"]'), '尚未填寫不是錯誤').toHaveLength(0)
    expect(wrapper.get('.result-panel').text()).toContain('還需要填寫體重')
  })

  it('returns to an empty workspace after a reset', async () => {
    const wrapper = await enterMetric(mountWorkspace(), '170', '65')
    await wrapper.get('.bmi-reset').trigger('click')

    expect((wrapper.get('#bmi-height-centimetres').element as HTMLInputElement).value).toBe('')
    expect((wrapper.get('#bmi-weight-kilograms').element as HTMLInputElement).value).toBe('')
    expect(wrapper.get('.result-panel').text()).toContain('填入身高與體重')
  })

  it('shows every reviewed caveat beside the result', async () => {
    const wrapper = await enterMetric(mountWorkspace(), '170', '65')
    const caveats = wrapper.get('.bmi-caveats').text()

    for (const key of bmiCaveatKeys) expect(caveats, `${key} 免責內容必須呈現`).toContain(bmiCaveats[key]['zh-tw'])
  })

  it('publishes the formula and the full category table', () => {
    const wrapper = mountWorkspace()

    expect(wrapper.text()).toContain('BMI ＝ 體重（公斤）÷ 身高（公尺）÷ 身高（公尺）')
    const rows = wrapper.findAll('.bmi-category-table tbody tr')
    expect(rows).toHaveLength(4)
    expect(rows[0]!.text()).toContain('體重過輕')
    expect(rows[0]!.text()).toContain('BMI < 18.5')
    expect(rows[3]!.text()).toContain('BMI ≧ 27')
  })

  it('speaks English on the English page', async () => {
    const wrapper = await enterMetric(mountWorkspace('en'), '170', '65')

    expect(wrapper.get('label[for="bmi-height-centimetres"]').text()).toBe('Height (cm)')
    expect(wrapper.get('.result-panel').text()).toContain('Healthy weight')
    expect(wrapper.get('.bmi-caveats').text()).toContain('not a medical diagnosis')
  })

  it('keeps height and weight out of device storage', async () => {
    const wrapper = await enterMetric(mountWorkspace(), '170', '65')
    await wrapper.get('input[name="bmi-unit-system"][value="imperial"]').setValue()

    expect(localStorage.length, '身高體重不得寫入本機儲存').toBe(0)
    expect(sessionStorage.length, '身高體重不得寫入本機儲存').toBe(0)
  })
})
