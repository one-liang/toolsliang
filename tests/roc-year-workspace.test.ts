import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RocYearConverterWorkspace from '@/components/RocYearConverterWorkspace.vue'
import { setTestRoute } from './support/nuxt-stubs'

function mountWorkspace(locale: 'zh-tw' | 'en' = 'zh-tw') {
  setTestRoute({ path: `/${locale}/tools/roc-year-converter/`, params: { locale, slug: 'roc-year-converter' } })
  return mount(RocYearConverterWorkspace, { attachTo: document.body })
}

describe('ROC year converter workspace', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 15, 9, 0, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('opens on an empty ROC year field with a numeric keyboard and today’s year already answered', () => {
    const wrapper = mountWorkspace()
    const input = wrapper.get('#roc-year-input')

    expect(input.attributes('inputmode')).toBe('numeric')
    expect(wrapper.get('label[for="roc-year-input"]').text()).toBe('民國年份')
    expect(wrapper.get('input[name="roc-year-direction"][value="roc-to-gregorian"]').element).toHaveProperty('checked', true)
    expect(wrapper.findAll('[role="alert"]')).toHaveLength(0)
    expect(wrapper.get('.result-panel').text()).toContain('輸入年份後')
    expect(wrapper.get('[data-current-year]').text()).toBe('今年是民國 115 年（西元 2026 年）。')
  })

  it('announces the Gregorian year for an ROC year in a polite live region', async () => {
    const wrapper = mountWorkspace()
    await wrapper.get('#roc-year-input').setValue('115')
    const result = wrapper.get('.result-panel')

    expect(result.attributes('aria-live')).toBe('polite')
    expect(wrapper.get('.roc-year__headline').text()).toBe('西元 2026 年')
    expect(result.text()).toContain('民國 115 年 ＝ 西元 2026 年')
  })

  it('answers ROC year 1 as 1912 and calls it 民國元年', async () => {
    const wrapper = mountWorkspace()
    await wrapper.get('#roc-year-input').setValue('1')

    expect(wrapper.get('.roc-year__headline').text()).toBe('西元 1912 年')
    expect(wrapper.get('.result-panel').text()).toContain('民國元年')
  })

  it('carries the year, not its digits, when the visitor switches direction', async () => {
    const wrapper = mountWorkspace()
    await wrapper.get('#roc-year-input').setValue('115')
    await wrapper.get('input[name="roc-year-direction"][value="gregorian-to-roc"]').setValue()

    expect(wrapper.get('label[for="roc-year-input"]').text()).toBe('西元年份')
    expect((wrapper.get('#roc-year-input').element as HTMLInputElement).value).toBe('2026')
    expect(wrapper.get('.roc-year__headline').text()).toBe('民國 115 年')
  })

  it('writes 1911 as 民國前 1 年 and says the year is outside the table', async () => {
    const wrapper = mountWorkspace()
    await wrapper.get('input[name="roc-year-direction"][value="gregorian-to-roc"]').setValue()
    await wrapper.get('#roc-year-input').setValue('1911')

    expect(wrapper.get('.roc-year__headline').text()).toBe('民國前 1 年')
    expect(wrapper.get('[data-outside-table]').text()).toContain('西元 1911 年不在這張表的範圍內')
    expect(wrapper.findAll('[data-match]')).toHaveLength(0)
    expect(wrapper.text()).not.toMatch(/民國\s*0\s*年/)
  })

  it('refuses ROC year 0 on the field that has to change', async () => {
    const wrapper = mountWorkspace()
    await wrapper.get('#roc-year-input').setValue('0')
    const alert = wrapper.get('[role="alert"]')

    expect(alert.text()).toContain('民國元年')
    expect(wrapper.get('#roc-year-input').attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('#roc-year-input').attributes('aria-describedby')).toContain(alert.attributes('id'))
    expect(wrapper.find('.roc-year__headline').exists(), '無法換算時不得顯示結果').toBe(false)
    expect(wrapper.text()).not.toMatch(/民國\s*0\s*年/)
  })

  it('explains text that is not a year without calling an empty field a mistake', async () => {
    const wrapper = mountWorkspace()
    await wrapper.get('#roc-year-input').setValue('abc')
    expect(wrapper.get('[role="alert"]').text()).toContain('請只填數字')

    await wrapper.get('#roc-year-input').setValue('')
    expect(wrapper.findAll('[role="alert"]')).toHaveLength(0)
    expect(wrapper.get('#roc-year-input').attributes('aria-invalid')).toBe('false')
  })

  it('lists ROC year 1 to ten years after this year and marks this year in words', () => {
    const wrapper = mountWorkspace()
    const rows = wrapper.findAll('tbody tr')

    expect(rows).toHaveLength(125)
    expect(rows[0]!.text()).toBe('1 年1912 年')
    expect(rows.at(-1)!.attributes('data-gregorian')).toBe('2036')
    const current = wrapper.get('tr[aria-current="date"]')
    expect(current.attributes('data-gregorian')).toBe('2026')
    expect(current.text(), '今年不能只靠顏色標示').toContain('今年')
    expect(wrapper.get('caption').text()).toContain('民國 125 年')
  })

  it('marks the row of the year the visitor looked up', async () => {
    const wrapper = mountWorkspace()
    await wrapper.get('#roc-year-input').setValue('100')

    const match = wrapper.get('[data-match]')
    expect(match.attributes('data-gregorian')).toBe('2011')
    expect(match.text()).toContain('你查的年份')
    expect(wrapper.findAll('[data-match]')).toHaveLength(1)
  })

  it('keeps the table scrollable from the keyboard as a named region', () => {
    const wrapper = mountWorkspace()
    const region = wrapper.get('.roc-year__scroll')

    expect(region.attributes('tabindex')).toBe('0')
    expect(region.attributes('role')).toBe('region')
    expect(region.attributes('aria-labelledby')).toBe('roc-year-table-title')
  })

  it('speaks English on the English page', async () => {
    const wrapper = mountWorkspace('en')
    await wrapper.get('#roc-year-input').setValue('115')

    expect(wrapper.get('.roc-year__headline').text()).toBe('2026')
    expect(wrapper.get('[data-current-year]').text()).toBe('This year is 2026, ROC year 115.')
    await wrapper.get('#roc-year-input').setValue('0')
    expect(wrapper.get('[role="alert"]').text()).toContain('no year 0')
  })
})
