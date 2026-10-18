import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WorkingDayCalculatorWorkspace from '@/components/WorkingDayCalculatorWorkspace.vue'
import { workingDayCaveatKeys } from '@/features/tools/working-day-calculator/domain/sources'
import { setTestRoute } from './support/nuxt-stubs'

async function mountWorkspace(locale: 'zh-tw' | 'en' = 'zh-tw') {
  setTestRoute({ path: `/${locale}/tools/working-day-calculator/`, params: { locale, slug: 'working-day-calculator' } })
  const wrapper = mount(WorkingDayCalculatorWorkspace, {
    attachTo: document.body,
    global: { stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } },
  })
  await settle()
  return wrapper
}

type Workspace = Awaited<ReturnType<typeof mountWorkspace>>

/** Every covered year loads asynchronously; the workspace says when it is ready. */
async function settle() {
  for (let tick = 0; tick < 50; tick += 1) {
    await Promise.resolve()
    await new Promise(resolve => setTimeout(resolve, 0))
    if (document.querySelector('.working-day')?.getAttribute('data-working-day-state') === 'ready') return
  }
  throw new Error('the office calendar never finished loading')
}

async function chooseMode(wrapper: Workspace, mode: 'forward' | 'backward' | 'between') {
  await wrapper.get(`input[name="working-day-mode"][value="${mode}"]`).setValue()
}

describe('working day calculator workspace', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 1, 13, 9, 0, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('opens on counting forward from today, with the rule beside the start date', async () => {
    const wrapper = await mountWorkspace()

    expect(wrapper.get('input[name="working-day-mode"][value="forward"]').element).toHaveProperty('checked', true)
    expect((wrapper.get('#working-day-start').element as HTMLInputElement).value).toBe('2026-02-13')
    expect(wrapper.get('#working-day-start-help').text()).toContain('起算日那天不算')
    expect(wrapper.get('#working-day-count').attributes('inputmode')).toBe('numeric')
    expect(wrapper.findAll('[role="alert"]')).toHaveLength(0)
    expect(wrapper.get('.result-panel').text()).toContain('填好日期和天數')
  })

  it('answers 3 working days after the Friday before Lunar New Year in a polite live region', async () => {
    const wrapper = await mountWorkspace()
    await wrapper.get('#working-day-count').setValue('3')
    const result = wrapper.get('.result-panel')

    expect(result.attributes('aria-live')).toBe('polite')
    expect(wrapper.get('.working-day__headline').text()).toBe('2026-02-25（三）')
    expect(result.text()).toContain('民國 115 年 2 月 25 日')
    expect(result.text()).toContain('從 2026-02-13（五）往後數 3 個工作天，不含起算日。')
  })

  it('lists the days off it skipped, by name, in a folded breakdown', async () => {
    const wrapper = await mountWorkspace()
    await wrapper.get('#working-day-count').setValue('3')
    const breakdown = wrapper.get('.working-day__breakdown')

    expect(breakdown.attributes('open'), '明細預設收合').toBeUndefined()
    const skipped = breakdown.findAll('[data-skipped] li').map(item => item.text())
    expect(skipped[0]).toBe('2026-02-15（日）小年夜')
    expect(skipped[1]).toBe('2026-02-16（一）農曆除夕')
    expect(skipped.at(-1)).toBe('2026-02-20（五）補假')
    expect(breakdown.get('[data-weekends]').text()).toBe('另外跳過 3 天週末。')
  })

  it('counts back from a date the visitor picks', async () => {
    const wrapper = await mountWorkspace()
    await chooseMode(wrapper, 'backward')
    await wrapper.get('#working-day-start').setValue('2026-03-02')
    await wrapper.get('#working-day-count').setValue('3')

    expect(wrapper.get('.working-day__headline').text()).toBe('2026-02-24（二）')
    expect(wrapper.get('.result-panel').text()).toContain('往前數 3 個工作天')
  })

  it('counts both ends of a range and keeps the start date when switching mode', async () => {
    const wrapper = await mountWorkspace()
    await wrapper.get('#working-day-start').setValue('2026-04-01')
    await chooseMode(wrapper, 'between')

    expect((wrapper.get('#working-day-start').element as HTMLInputElement).value).toBe('2026-04-01')
    expect(wrapper.get('label[for="working-day-start"]').text()).toBe('開始日')
    expect(wrapper.find('#working-day-count').exists()).toBe(false)

    await wrapper.get('#working-day-end').setValue('2026-04-10')
    expect(wrapper.get('.working-day__headline').text()).toBe('6 個工作天')
    expect(wrapper.get('.result-panel').text()).toContain('頭尾兩天都算，共 10 個日曆天')
  })

  it('says an answer that lands on a makeup workday is one', async () => {
    const wrapper = await mountWorkspace()
    await wrapper.get('#working-day-start').setValue('2025-02-07')
    await wrapper.get('#working-day-count').setValue('1')

    expect(wrapper.get('.working-day__headline').text()).toBe('2025-02-08（六）')
    expect(wrapper.get('[data-makeup-note]').text()).toContain('補班日')
    expect(wrapper.get('[data-makeup] li').text()).toBe('2025-02-08（六）')
  })

  it('refuses to guess into an unannounced year and says how far it counted', async () => {
    const wrapper = await mountWorkspace()
    await wrapper.get('#working-day-start').setValue('2027-12-28')
    await wrapper.get('#working-day-count').setValue('3')

    const refusal = wrapper.get('[data-refusal]').text()
    expect(refusal).toContain('數到 2027-12-30（四）是第 2 個工作天；第 3 個要用到 2028 年')
    expect(refusal).toContain('尚未公告')
    expect(wrapper.find('.working-day__headline').exists(), '拒答時不得顯示任何日期').toBe(false)
    expect(wrapper.find('.working-day__breakdown').exists()).toBe(false)
  })

  it('names what to change in the number of days, without calling an empty field a mistake', async () => {
    const wrapper = await mountWorkspace()
    await wrapper.get('#working-day-count').setValue('0')
    const alert = wrapper.get('[role="alert"]')

    expect(alert.text()).toBe('請填 1 以上的數字。')
    expect(wrapper.get('#working-day-count').attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('#working-day-count').attributes('aria-describedby')).toContain(alert.attributes('id'))

    await wrapper.get('#working-day-count').setValue('')
    expect(wrapper.findAll('[role="alert"]')).toHaveLength(0)
    expect(wrapper.get('#working-day-count').attributes('aria-invalid')).toBe('false')
  })

  it('keeps the office calendar credit and its licence on screen, with the caveats folded below', async () => {
    const wrapper = await mountWorkspace()
    const edition = wrapper.get('[data-edition]')

    expect(edition.text()).toContain('行政院人事行政總處')
    expect(edition.text()).toContain('民國 109 至 116 年（114 年為修正版）')
    expect(edition.findAll('a').map(link => link.attributes('href'))).toEqual(['https://data.gov.tw/dataset/14718', 'https://data.gov.tw/license'])
    expect(wrapper.findAll('[data-caveat]').map(item => item.attributes('data-caveat'))).toEqual([...workingDayCaveatKeys])
    expect(wrapper.get('[data-caveat="not-a-statutory-period"]').text()).toContain('不是法定期間')
    expect(wrapper.findAll('.working-day__editions li')).toHaveLength(8)
  })

  it('links to the Taiwan Calendar in the same language', async () => {
    const wrapper = await mountWorkspace()
    expect(wrapper.get('.working-day__calendar-link a').attributes('href')).toBe('/zh-tw/tools/taiwan-calendar/')
  })

  it('speaks English on the English page', async () => {
    const wrapper = await mountWorkspace('en')
    await wrapper.get('#working-day-count').setValue('3')

    expect(wrapper.get('.working-day__headline').text()).toBe('Wed 25 Feb 2026')
    expect(wrapper.get('.result-panel').text()).toContain('3 working days after Fri 13 Feb 2026, not counting the start date.')
    expect(wrapper.get('.working-day__calendar-link a').attributes('href')).toBe('/en/tools/taiwan-calendar/')
  })
})
