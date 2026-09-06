import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TaiwanCalendarWorkspace from '@/components/TaiwanCalendarWorkspace.vue'
import {
  officialDayKindLabels,
  taiwanCalendarCaveats,
  taiwanCalendarViewErrorMessage,
} from '@/features/tools/taiwan-calendar/content'
import {
  taiwanCalendarDatasets,
  taiwanCalendarPublishableYears,
  taiwanCalendarReferenceVersion,
} from '@/features/tools/taiwan-calendar/domain/sources'
import { setTestRoute } from './support/nuxt-stubs'

const CURRENT_YEAR = 2026

async function mountWorkspace(locale: 'zh-tw' | 'en' = 'zh-tw') {
  setTestRoute({ path: `/${locale}/tools/taiwan-calendar/`, params: { locale, slug: 'taiwan-calendar' } })
  const wrapper = mount(TaiwanCalendarWorkspace, { attachTo: document.body })
  await settle()
  return wrapper
}

type Workspace = Awaited<ReturnType<typeof mountWorkspace>>

/** The year modules load asynchronously, so a render is only settled once the
 * workspace stops reporting that it is preparing a year. */
async function settle() {
  for (let tick = 0; tick < 50; tick += 1) {
    await Promise.resolve()
    await new Promise(resolve => setTimeout(resolve, 0))
    if (document.querySelector('.calendar-workspace')?.getAttribute('data-calendar-state') !== 'loading') return
  }
  throw new Error('the calendar never finished preparing a year')
}

async function selectYear(wrapper: Workspace, year: number) {
  await wrapper.get('#calendar-year').setValue(String(year))
  await settle()
  return wrapper
}

async function goToMonth(wrapper: Workspace, month: number) {
  while (Number(wrapper.get('.calendar-grid').attributes('data-month')) < month) {
    await wrapper.get('.calendar-next-month').trigger('click')
    await settle()
  }
  return wrapper
}

function dayCell(wrapper: Workspace, date: string) {
  return wrapper.get(`[data-date="${date}"]`)
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-06-19T09:00:00+08:00'))
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('opening the calendar', () => {
  it('opens on the device\'s own year and month, with today marked', async () => {
    const wrapper = await mountWorkspace()

    expect((wrapper.get('#calendar-year').element as HTMLSelectElement).value).toBe(String(CURRENT_YEAR))
    expect(wrapper.get('.calendar-grid').attributes('data-month')).toBe('6')
    expect(dayCell(wrapper, '2026-06-19').attributes('aria-current')).toBe('date')
  })

  it('offers every published year, and the next one only to say it is not announced', async () => {
    const wrapper = await mountWorkspace()
    const options = wrapper.findAll('#calendar-year option').map(option => Number(option.attributes('value')))
    const { firstYear, lastYear } = taiwanCalendarPublishableYears

    expect(options[0]).toBe(firstYear)
    expect(options.at(-1)).toBe(lastYear + 1)
    expect(options).toHaveLength(lastYear - firstYear + 2)
  })

  it('lays the month out as a table of weeks with named weekday columns', async () => {
    const wrapper = await mountWorkspace()
    const headers = wrapper.findAll('.calendar-grid thead th').map(cell => cell.text())

    expect(headers).toHaveLength(7)
    expect(headers[0]).toBe('日')
    expect(wrapper.findAll('.calendar-grid tbody .calendar-day')).toHaveLength(30)
    expect(wrapper.get('.calendar-grid caption').text()).not.toBe('')
  })

  it('says what every day is in text, not only in colour', async () => {
    const wrapper = await mountWorkspace()
    const label = dayCell(wrapper, '2026-06-19').attributes('aria-label')!

    expect(label).toContain('115')
    expect(label).toContain('端午節')
    expect(label).toContain('星期五')
    expect(dayCell(wrapper, '2026-06-19').text()).toContain('端午節')
    expect(dayCell(wrapper, '2026-06-19').attributes('data-kind')).toBe('national-holiday')
  })
})

describe('moving around', () => {
  it('changes month without leaving the year, and comes back to today', async () => {
    const wrapper = await mountWorkspace()

    await wrapper.get('.calendar-prev-month').trigger('click')
    await settle()
    expect(wrapper.get('.calendar-grid').attributes('data-month')).toBe('5')
    expect((wrapper.get('#calendar-year').element as HTMLSelectElement).value).toBe(String(CURRENT_YEAR))

    await wrapper.get('.calendar-today').trigger('click')
    await settle()
    expect(wrapper.get('.calendar-grid').attributes('data-month')).toBe('6')
    expect(wrapper.get('.calendar-day--selected').attributes('data-date')).toBe('2026-06-19')
  })

  it('carries the month across the year boundary in both directions', async () => {
    const wrapper = await mountWorkspace()
    await goToMonth(wrapper, 12)

    await wrapper.get('.calendar-next-month').trigger('click')
    await settle()
    expect((wrapper.get('#calendar-year').element as HTMLSelectElement).value).toBe(String(CURRENT_YEAR + 1))
    expect(wrapper.get('.calendar-grid').attributes('data-month')).toBe('1')

    await wrapper.get('.calendar-prev-month').trigger('click')
    await settle()
    expect((wrapper.get('#calendar-year').element as HTMLSelectElement).value).toBe(String(CURRENT_YEAR))
    expect(wrapper.get('.calendar-grid').attributes('data-month')).toBe('12')
  })

  it('stops at the edge of the published years instead of walking into an empty one', async () => {
    const wrapper = await mountWorkspace()
    await selectYear(wrapper, taiwanCalendarPublishableYears.firstYear)

    expect(wrapper.get('.calendar-prev-month').attributes('disabled')).toBeDefined()
    await selectYear(wrapper, taiwanCalendarPublishableYears.lastYear)
    await goToMonth(wrapper, 12)
    expect(wrapper.get('.calendar-next-month').attributes('disabled')).toBeDefined()
  })

  it('moves the focused day with the arrow keys and follows it into the next month', async () => {
    const wrapper = await mountWorkspace()

    await dayCell(wrapper, '2026-06-19').trigger('keydown', { key: 'ArrowRight' })
    await settle()
    expect(document.activeElement?.getAttribute('data-date')).toBe('2026-06-20')

    await dayCell(wrapper, '2026-06-20').trigger('keydown', { key: 'ArrowDown' })
    await settle()
    expect(document.activeElement?.getAttribute('data-date')).toBe('2026-06-27')

    await dayCell(wrapper, '2026-06-30').trigger('keydown', { key: 'ArrowRight' })
    await settle()
    expect(wrapper.get('.calendar-grid').attributes('data-month')).toBe('7')
    expect(document.activeElement?.getAttribute('data-date')).toBe('2026-07-01')
  })

  it('keeps exactly one day in the tab order so Tab leaves the grid', async () => {
    const wrapper = await mountWorkspace()
    const tabbable = wrapper.findAll('.calendar-day').filter(day => day.attributes('tabindex') === '0')

    expect(tabbable).toHaveLength(1)
    expect(tabbable[0]!.attributes('data-date')).toBe('2026-06-19')
  })
})

describe('one day in detail', () => {
  it('shows the ROC year, weekday, lunar date, solar term and official kind of the day picked', async () => {
    const wrapper = await mountWorkspace()
    await dayCell(wrapper, '2026-06-05').trigger('click')

    const detail = wrapper.get('.calendar-detail').text()
    expect(detail).toContain('115')
    expect(detail).toContain('星期五')
    expect(detail).toContain('芒種')
    expect(detail).toContain('農曆')
    expect(detail).toContain(officialDayKindLabels.workday['zh-tw'])
  })

  it('quotes the source annotation a marked day came from', async () => {
    const wrapper = await mountWorkspace()
    await dayCell(wrapper, '2026-06-19').trigger('click')

    expect(wrapper.get('.calendar-detail').text()).toContain('端午節')
    expect(wrapper.get('.calendar-detail__note').text()).toContain('端午節')
  })

  it('lists the month\'s marked days as an equivalent agenda, and nothing else', async () => {
    const wrapper = await mountWorkspace()
    const agenda = wrapper.findAll('.calendar-agenda__item').map(item => item.attributes('data-date'))

    expect(agenda).toContain('2026-06-19')
    expect(agenda).toContain('2026-06-05')
    expect(agenda).not.toContain('2026-06-18')
  })
})

describe('what the page has to say about its data', () => {
  it('shows the dataset edition, publisher, licence and retrieval date of the year on screen', async () => {
    const wrapper = await mountWorkspace()
    const sources = wrapper.get('.calendar-sources')

    expect(sources.text()).toContain('115年中華民國政府行政機關辦公日曆表')
    expect(sources.text()).toContain('行政院人事行政總處')
    expect(sources.text()).toContain(taiwanCalendarReferenceVersion)
    expect(sources.findAll('a').map(link => link.attributes('href')))
      .toEqual(expect.arrayContaining([taiwanCalendarDatasets[0].licenceUrl, taiwanCalendarDatasets[0].url]))
  })

  it('carries the permanent disclaimers beside the calendar, not only in the footer', async () => {
    const wrapper = await mountWorkspace()
    const caveats = wrapper.get('.calendar-caveats').text()

    expect(caveats).toContain(taiwanCalendarCaveats['government-agency-scope']['zh-tw'])
    expect(caveats).toContain(taiwanCalendarCaveats['no-personal-events']['zh-tw'])
    expect(caveats).not.toContain(taiwanCalendarCaveats['edition-may-change']['zh-tw'])
  })

  it('adds the revision warning only on the year the authority reissued', async () => {
    const wrapper = await mountWorkspace()
    await selectYear(wrapper, 2025)

    expect(wrapper.get('.calendar-caveats').text()).toContain(taiwanCalendarCaveats['edition-may-change']['zh-tw'])
    expect(wrapper.get('.calendar-revised').text()).not.toBe('')
  })

  it('offers the year after the last published one and says it is not announced yet', async () => {
    const wrapper = await mountWorkspace()
    const unannounced = taiwanCalendarPublishableYears.lastYear + 1
    const options = wrapper.findAll('#calendar-year option').map(option => Number(option.attributes('value')))

    expect(options).toContain(unannounced)
    await selectYear(wrapper, unannounced)

    expect(wrapper.find('.calendar-grid').exists()).toBe(false)
    expect(wrapper.get('.calendar-status').text())
      .toContain(taiwanCalendarViewErrorMessage('year-not-announced', unannounced, 'zh-tw'))
  })
})

describe('the English page', () => {
  it('answers in English, keeping the Taiwanese names the source uses', async () => {
    const wrapper = await mountWorkspace('en')
    await dayCell(wrapper, '2026-06-19').trigger('click')

    expect(wrapper.get('.calendar-grid thead th').text()).toBe('Sun')
    expect(wrapper.get('.calendar-detail').text()).toContain('Dragon Boat Festival')
    expect(wrapper.get('.calendar-detail').text()).toContain('端午節')
  })
})
