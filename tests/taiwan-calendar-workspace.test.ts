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
import { dgpa2026DaysOff, dgpa2026DaysOffTotal, dgpa2026MakeupWorkdays } from './support/dgpa-2026-office-calendar'
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
  it('keeps no explainer above or beside the calendar: only the controls, the grid and the day', async () => {
    const wrapper = await mountWorkspace()

    // Everything that used to be a section of its own now lives folded under the edition line.
    expect(wrapper.find('.calendar-workspace > .calendar-caveats').exists()).toBe(false)
    expect(wrapper.find('.calendar-workspace > .calendar-sources').exists()).toBe(false)
    expect(wrapper.get('.calendar-edition__details').attributes('open')).toBeUndefined()
    expect(wrapper.get('.calendar-edition__details').find('.calendar-caveats').exists()).toBe(true)
  })

  it('credits the publisher, edition and licence of the year on screen, never folded away', async () => {
    const wrapper = await mountWorkspace()
    const line = wrapper.get('.calendar-edition__line')

    // The Open Government Data Licence lapses without this attribution, so it is
    // outside the details element and readable without opening anything.
    expect(line.element.closest('details')).toBeNull()
    expect(line.text()).toContain('行政院人事行政總處')
    expect(line.text()).toContain('115年中華民國政府行政機關辦公日曆表')
    expect(line.text()).toContain('交通部中央氣象署')
    expect(line.text()).toContain('中華民國 115 年日曆資料表')
    expect(line.text()).toContain('政府資料開放授權條款')
    expect(line.findAll('a').map(link => link.attributes('href'))).toEqual(expect.arrayContaining([
      taiwanCalendarDatasets[0].url,
      taiwanCalendarDatasets[1].url,
      taiwanCalendarDatasets[0].licenceUrl,
    ]))
    expect(line.find('.calendar-edition__revised').exists()).toBe(false)
  })

  it('keeps the dates, the cross-check and the contract version in the details under the line', async () => {
    const wrapper = await mountWorkspace()
    const sources = wrapper.get('.calendar-edition__details .calendar-sources')

    expect(sources.text()).toContain('115年中華民國政府行政機關辦公日曆表')
    expect(sources.text()).toContain('2026-09-06')
    expect(sources.text()).toContain(taiwanCalendarReferenceVersion)
    expect(sources.findAll('a').map(link => link.attributes('href')))
      .toEqual(expect.arrayContaining([taiwanCalendarDatasets[0].licenceUrl, taiwanCalendarDatasets[0].url]))
  })

  it('folds every disclaimer into the details beside the calendar, not into the footer', async () => {
    const wrapper = await mountWorkspace()
    const caveats = wrapper.get('.calendar-edition__details .calendar-caveats').text()

    Object.values(taiwanCalendarCaveats).forEach(caveat => expect(caveats).toContain(caveat['zh-tw']))
    expect(wrapper.findAll('.calendar-caveats__emphasised')).toHaveLength(0)
    expect(wrapper.find('.calendar-revised').exists()).toBe(false)
  })

  it('says on the line itself that the year was reissued, and emphasises the disclaimer inside', async () => {
    const wrapper = await mountWorkspace()
    await selectYear(wrapper, 2025)

    expect(wrapper.get('.calendar-edition__line').text()).toContain('1141020')
    expect(wrapper.get('.calendar-edition__revised').text()).toBe('（修正版）')
    expect(wrapper.get('.calendar-caveats__emphasised').text())
      .toBe(taiwanCalendarCaveats['edition-may-change']['zh-tw'])
    expect(wrapper.get('.calendar-revised').text()).not.toBe('')
  })

  it('credits every reviewed dataset, including the one it only cross-checks against', async () => {
    const wrapper = await mountWorkspace()
    const credited = wrapper.findAll('.calendar-sources [data-dataset]').map(row => row.attributes('data-dataset'))

    expect(credited).toEqual(taiwanCalendarDatasets.map(dataset => dataset.id))
    expect(wrapper.get('[data-dataset="hko-lunar-calendar"]').text(), '交叉核對來源不得看起來像權威')
      .toContain('不以它作為權威')
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

describe('the whole year at once', () => {
  async function showYearView(wrapper: Workspace) {
    await wrapper.get('input[name="calendar-view"][value="year"]').setValue(true)
    await settle()
    return wrapper
  }

  const OFF_KINDS = ['weekend', 'national-holiday', 'substitute-holiday', 'bridge-holiday']

  function yearCells(wrapper: Workspace) {
    return wrapper.findAll('.calendar-year-view .calendar-day')
  }

  it('lays out twelve months of the year and every one of its days', async () => {
    const wrapper = await showYearView(await mountWorkspace())

    expect(wrapper.get('.calendar-workspace').attributes('data-calendar-view')).toBe('year')
    expect(wrapper.find('.calendar-grid').exists(), '月檢視的網格不同時出現').toBe(false)
    expect(wrapper.findAll('.calendar-mini').map(month => month.attributes('data-month')))
      .toEqual(Array.from({ length: 12 }, (_, index) => String(index + 1)))
    expect(yearCells(wrapper)).toHaveLength(365)
    expect(wrapper.get('.calendar-mini caption').text()).toBe('1 月')
  })

  it('gives 2026 the same days off and workdays as the DGPA announced, day by day', async () => {
    const wrapper = await showYearView(await mountWorkspace())
    const announced = dgpa2026DaysOff()
    const shown = yearCells(wrapper)

    expect(announced.size, '公告的全年放假日數').toBe(dgpa2026DaysOffTotal)
    for (const cell of shown) {
      const date = cell.attributes('data-date')!
      expect(OFF_KINDS.includes(cell.attributes('data-kind')!), date).toBe(announced.has(date))
    }
    expect(shown.filter(cell => OFF_KINDS.includes(cell.attributes('data-kind')!))).toHaveLength(dgpa2026DaysOffTotal)
    expect(shown.filter(cell => cell.attributes('data-kind') === 'makeup-workday').map(cell => cell.attributes('data-date')))
      .toEqual(dgpa2026MakeupWorkdays)
  })

  it('tells a day off from a workday in words, not only in colour', async () => {
    const wrapper = await showYearView(await mountWorkspace())
    const workday = officialDayKindLabels.workday['zh-tw']

    for (const cell of yearCells(wrapper)) {
      const kind = cell.attributes('data-kind')!
      const label = cell.attributes('aria-label')!
      const flag = cell.find('.calendar-day__flag')

      expect(label, cell.attributes('data-date')).toContain(officialDayKindLabels[kind as never]['zh-tw'])
      expect(label.includes(workday), cell.attributes('data-date')).toBe(!OFF_KINDS.includes(kind))
      // An ordinary weekend is named by its column; every day the calendar names carries a flag.
      if (kind === 'workday' || kind === 'weekend') expect(flag.exists()).toBe(false)
      else expect(flag.text(), cell.attributes('data-date')).toBe('休')
    }
    expect(wrapper.get('.calendar-legend').text()).toContain('上班日')
    expect(wrapper.get('.calendar-legend').text()).toContain('放假日')
    expect(wrapper.get('.calendar-legend').text()).toContain('休')
  })

  it('flags a makeup workday as a day at work', async () => {
    const wrapper = await showYearView(await mountWorkspace())
    await selectYear(wrapper, 2024)

    expect(dayCell(wrapper, '2024-02-17').attributes('data-kind')).toBe('makeup-workday')
    expect(dayCell(wrapper, '2024-02-17').get('.calendar-day__flag').text()).toBe('班')
    expect(dayCell(wrapper, '2024-02-17').attributes('aria-label')).toContain('補班日')
  })

  it('opens a picked day in the month view, selected and focused', async () => {
    const wrapper = await showYearView(await mountWorkspace())

    await dayCell(wrapper, '2026-02-16').trigger('click')
    await settle()

    expect(wrapper.get('.calendar-workspace').attributes('data-calendar-view')).toBe('month')
    expect((wrapper.get('input[name="calendar-view"][value="month"]').element as HTMLInputElement).checked).toBe(true)
    expect(wrapper.get('.calendar-grid').attributes('data-month')).toBe('2')
    expect(wrapper.get('.calendar-day--selected').attributes('data-date')).toBe('2026-02-16')
    expect(wrapper.get('.calendar-detail').text()).toContain('農曆除夕')
    expect(document.activeElement?.getAttribute('data-date')).toBe('2026-02-16')
  })

  it('walks the whole year with the arrow keys and keeps one tab stop', async () => {
    const wrapper = await showYearView(await mountWorkspace())

    expect(yearCells(wrapper).filter(cell => cell.attributes('tabindex') === '0')).toHaveLength(1)
    await dayCell(wrapper, '2026-01-31').trigger('keydown', { key: 'ArrowRight' })
    await settle()

    expect(document.activeElement?.getAttribute('data-date')).toBe('2026-02-01')
    expect(wrapper.get('.calendar-workspace').attributes('data-calendar-view')).toBe('year')
    expect(yearCells(wrapper).filter(cell => cell.attributes('tabindex') === '0').map(cell => cell.attributes('data-date')))
      .toEqual(['2026-02-01'])
  })

  it('stays in the year view across years, and refuses an unannounced one without a grid', async () => {
    const wrapper = await showYearView(await mountWorkspace())
    await selectYear(wrapper, 2027)
    expect(yearCells(wrapper)).toHaveLength(365)
    expect(dayCell(wrapper, '2027-12-31').get('.calendar-day__flag').text()).toBe('休')

    const unannounced = taiwanCalendarPublishableYears.lastYear + 1
    await selectYear(wrapper, unannounced)
    expect(wrapper.find('.calendar-year-view').exists()).toBe(false)
    expect(wrapper.get('.calendar-status').text())
      .toContain(taiwanCalendarViewErrorMessage('year-not-announced', unannounced, 'zh-tw'))
  })
})

describe('the English page', () => {
  it('names the view switch apart from the year picker', async () => {
    const wrapper = await mountWorkspace('en')
    const names = wrapper.findAll('.calendar-view__option').map(option => option.text())

    expect(names).toEqual(['One month', 'Whole year'])
    expect(names).not.toContain(wrapper.get('label[for="calendar-year"]').text())
  })

  it('answers in English, keeping the Taiwanese names the source uses', async () => {
    const wrapper = await mountWorkspace('en')
    await dayCell(wrapper, '2026-06-19').trigger('click')

    expect(wrapper.get('.calendar-grid thead th').text()).toBe('Sun')
    expect(wrapper.get('.calendar-detail').text()).toContain('Dragon Boat Festival')
    expect(wrapper.get('.calendar-detail').text()).toContain('端午節')
  })
})
