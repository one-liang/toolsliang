import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CustomCalendarEntryForm from '@/components/CustomCalendarEntryForm.vue'
import CustomCalendarWorkspace from '@/components/CustomCalendarWorkspace.vue'
import { useCustomCalendar } from '@/composables/useCustomCalendar'
import { customCalendarCaveats, customEntryIssueMessage } from '@/features/tools/custom-calendar/content'
import { serializeCustomCalendar } from '@/features/tools/custom-calendar/domain/document'
import type { CustomCalendarEntry } from '@/features/tools/custom-calendar/domain/entries'
import { MemoryAssetStore } from './support/memory-asset-store'
import { setTestRoute } from './support/nuxt-stubs'

const ASSET_ID = 'custom-calendar'
let store: MemoryAssetStore

function entry(patch: Partial<CustomCalendarEntry> = {}): CustomCalendarEntry {
  return {
    id: 'entry-1',
    startDate: '2026-09-18',
    endDate: '2026-09-18',
    mark: 'day-off',
    title: '公司特休',
    note: '全公司休息',
    updatedAt: '2026-09-07T02:00:00.000Z',
    ...patch,
  }
}

/** What a device that already holds a calendar looks like before the page opens. */
function seed(contents: string) {
  store.rows.set(ASSET_ID, {
    id: ASSET_ID,
    version: 1,
    kind: 'calendar',
    name: '自訂行事曆 Custom Calendar',
    bytes: new TextEncoder().encode(contents).byteLength,
    payload: { format: 'text', mediaType: 'application/json', text: contents },
    createdAt: '2026-09-07T02:00:00.000Z',
    updatedAt: '2026-09-07T02:00:00.000Z',
  })
}

async function mountWorkspace(locale: 'zh-tw' | 'en' = 'zh-tw') {
  setTestRoute({ path: `/${locale}/tools/custom-calendar/`, params: { locale, slug: 'custom-calendar' } })
  const wrapper = mount(CustomCalendarWorkspace, {
    attachTo: document.body,
    global: { components: { CustomCalendarEntryForm } },
  })
  await settle()
  return wrapper
}

type Workspace = Awaited<ReturnType<typeof mountWorkspace>>

async function settle() {
  for (let tick = 0; tick < 60; tick += 1) {
    await Promise.resolve()
    await new Promise(resolve => setTimeout(resolve, 0))
    if (document.querySelector('.custom-calendar-workspace')?.getAttribute('data-calendar-state') !== 'loading') return
  }
  throw new Error('the calendar never finished preparing a year')
}

async function fillForm(wrapper: Workspace, values: { title?: string, mark?: string, start?: string, end?: string, note?: string }) {
  if (values.title !== undefined) await wrapper.get('#custom-entry-title').setValue(values.title)
  if (values.start !== undefined) await wrapper.get('#custom-entry-start').setValue(values.start)
  if (values.end !== undefined) await wrapper.get('#custom-entry-end').setValue(values.end)
  if (values.note !== undefined) await wrapper.get('#custom-entry-note').setValue(values.note)
  if (values.mark !== undefined) await wrapper.get(`input[name="custom-entry-mark"][value="${values.mark}"]`).setValue()
}

async function submit(wrapper: Workspace) {
  await wrapper.get('.custom-calendar-form').trigger('submit')
  await settle()
}

function day(wrapper: Workspace, date: string) {
  return wrapper.get(`.calendar-day[data-date="${date}"]`)
}

async function selectDay(wrapper: Workspace, date: string) {
  await day(wrapper, date).trigger('click')
  await settle()
  return wrapper
}

beforeEach(() => {
  store = new MemoryAssetStore()
  vi.stubGlobal('useCustomCalendar', () => useCustomCalendar({
    defaultName: () => '自訂行事曆',
    openStore: async () => store,
  }))
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-09-07T09:00:00+08:00'))
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('creating and editing entries on this device', () => {
  it('saves a new entry on the selected day and keeps it after the workspace is opened again', async () => {
    const wrapper = await mountWorkspace()
    await selectDay(wrapper, '2026-09-18')
    await wrapper.get('[data-entry-action="add"]').trigger('click')
    await fillForm(wrapper, { title: '公司特休', mark: 'day-off', note: '全公司休息' })
    await submit(wrapper)

    expect(wrapper.get('.custom-calendar-entry').text()).toContain('公司特休')
    expect(wrapper.get('.custom-calendar-status').text()).toContain('公司特休')
    expect(day(wrapper, '2026-09-18').attributes('data-custom')).toBe('day-off')
    wrapper.unmount()

    const reopened = await mountWorkspace()
    await selectDay(reopened, '2026-09-18')
    expect(reopened.get('.custom-calendar-entry').text(), '重新載入後仍要看得到已保存的項目').toContain('公司特休')
  })

  it('shows the office calendar and the visitor\'s own answer as two separate layers', async () => {
    seed(serializeCustomCalendar([entry()], new Date('2026-09-07T02:00:00Z')))
    const wrapper = await mountWorkspace()
    await selectDay(wrapper, '2026-09-18')

    expect(wrapper.get('.custom-calendar-layers__official').text(), '官方日別必須照原樣顯示').toContain('上班日')
    expect(wrapper.get('.custom-calendar-layers__custom').text()).toContain('自訂放假')
    expect(wrapper.get('.custom-calendar-changed').text()).toContain('與辦公日曆表不同')
    expect(day(wrapper, '2026-09-18').attributes('data-changed')).toBe('true')
  })

  it('writes the day mark as text, not only as a colour', async () => {
    seed(serializeCustomCalendar([entry()], new Date('2026-09-07T02:00:00Z')))
    const wrapper = await mountWorkspace()

    const cell = day(wrapper, '2026-09-18')
    expect(cell.get('.calendar-day__custom').text()).toBe('自訂放假')
    expect(cell.attributes('aria-label')).toContain('公司特休')
    expect(cell.attributes('aria-label')).toContain('上班日')
  })

  it('edits an existing entry in place and announces the change', async () => {
    seed(serializeCustomCalendar([entry()], new Date('2026-09-07T02:00:00Z')))
    const wrapper = await mountWorkspace()
    await selectDay(wrapper, '2026-09-18')

    await wrapper.get('[data-entry-action="edit"]').trigger('click')
    await fillForm(wrapper, { title: '公司特休（改期）', start: '2026-09-21', end: '2026-09-22' })
    await submit(wrapper)

    expect(wrapper.get('.custom-calendar-entry').text(), '儲存後停在被移到的那一天').toContain('公司特休（改期）')
    expect(wrapper.get('.custom-calendar-status').text()).toContain('已更新')
    expect(day(wrapper, '2026-09-18').attributes('data-custom'), '原本那一天不再有自訂標示').toBeUndefined()
    expect(day(wrapper, '2026-09-22').attributes('data-custom'), '期間內每一天都要標示').toBe('day-off')
  })

  it('asks before deleting, and cancelling keeps the entry', async () => {
    seed(serializeCustomCalendar([entry()], new Date('2026-09-07T02:00:00Z')))
    const wrapper = await mountWorkspace()
    await selectDay(wrapper, '2026-09-18')

    await wrapper.get('[data-entry-action="delete"]').trigger('click')
    await wrapper.get('[data-entry-action="cancel-delete"]').trigger('click')
    expect(wrapper.findAll('.custom-calendar-entry')).toHaveLength(1)

    await wrapper.get('[data-entry-action="delete"]').trigger('click')
    await wrapper.get('[data-entry-action="confirm-delete"]').trigger('click')
    await settle()

    expect(wrapper.findAll('.custom-calendar-entry')).toHaveLength(0)
    expect(wrapper.get('.custom-calendar-status').text()).toContain('已刪除')
    expect(store.rows.size, '刪除最後一筆後仍保留一份空文件').toBe(1)
  })

  it('refuses an entry that cannot be saved and writes nothing to the device', async () => {
    const wrapper = await mountWorkspace()
    await selectDay(wrapper, '2026-09-18')
    await wrapper.get('[data-entry-action="add"]').trigger('click')
    await fillForm(wrapper, { title: '  ', end: '2026-09-01' })
    await submit(wrapper)

    const error = wrapper.get('.custom-calendar-form__error')
    expect(error.attributes('role')).toBe('alert')
    expect(error.text()).toContain(customEntryIssueMessage({ field: 'title', code: 'title-required' }, 'zh-tw'))
    expect(error.text()).toContain(customEntryIssueMessage({ field: 'dates', code: 'end-before-start' }, 'zh-tw'))
    expect(wrapper.get('#custom-entry-title').attributes('aria-invalid')).toBe('true')
    expect(store.rows.size, '被拒絕的輸入不得寫入裝置').toBe(0)
  })

  it('refuses a date outside the years the official calendar covers', async () => {
    const wrapper = await mountWorkspace()
    await selectDay(wrapper, '2026-09-18')
    await wrapper.get('[data-entry-action="add"]').trigger('click')
    await fillForm(wrapper, { title: '太早的事', start: '2019-01-01', end: '2019-01-01' })
    await submit(wrapper)

    expect(wrapper.get('.custom-calendar-form__error').text())
      .toContain(customEntryIssueMessage({ field: 'dates', code: 'date-out-of-range' }, 'zh-tw'))
  })
})

describe('the file and the device', () => {
  it('clears everything only after the visitor confirms', async () => {
    seed(serializeCustomCalendar([entry()], new Date('2026-09-07T02:00:00Z')))
    const wrapper = await mountWorkspace()

    await wrapper.get('[data-calendar-action="clear"]').trigger('click')
    expect(wrapper.get('.custom-calendar-confirm').text()).toContain('建議先匯出備份')
    await wrapper.get('[data-calendar-action="cancel-clear"]').trigger('click')
    expect(store.rows.size).toBe(1)

    await wrapper.get('[data-calendar-action="clear"]').trigger('click')
    await wrapper.get('[data-calendar-action="confirm-clear"]').trigger('click')
    await settle()

    expect(store.rows.size, '清除會移除這台裝置上的整份文件').toBe(0)
    expect(wrapper.get('.custom-calendar-status').text()).toContain('已清除')
  })

  it('leaves the saved entries untouched when an imported file cannot be read', async () => {
    seed(serializeCustomCalendar([entry()], new Date('2026-09-07T02:00:00Z')))
    const wrapper = await mountWorkspace()

    const input = wrapper.get('#custom-calendar-import')
    Object.defineProperty(input.element, 'files', {
      value: [new File(['not a calendar'], 'broken.json', { type: 'application/json' })],
    })
    await input.trigger('change')
    await settle()

    expect(wrapper.get('.custom-calendar-error').text()).toContain('不是可讀的自訂行事曆備份檔')
    await selectDay(wrapper, '2026-09-18')
    expect(wrapper.get('.custom-calendar-entry').text(), '匯入失敗不得改動裝置上的項目').toContain('公司特休')
  })

  it('reports a document it cannot read, refuses to overwrite it, and offers the bytes back', async () => {
    seed('{ this is not a calendar')
    const wrapper = await mountWorkspace()

    expect(wrapper.get('.custom-calendar-workspace').attributes('data-document-state')).toBe('corrupt')
    expect(wrapper.get('.custom-calendar-error').text()).toContain('讀不出來')
    expect(wrapper.get('[data-calendar-action="download-raw"]').exists()).toBe(true)
    expect(wrapper.find('[data-entry-action="add"]').exists(), '讀不出來時不得直接新增而覆寫').toBe(false)
    expect((store.rows.get(ASSET_ID) as { payload: { text: string } }).payload.text).toBe('{ this is not a calendar')
  })

  it('will not rewrite a document written by a newer release', async () => {
    seed(JSON.stringify({ format: 'toolsliang.custom-calendar', version: 99, updatedAt: '', entries: [] }))
    const wrapper = await mountWorkspace()

    expect(wrapper.get('.custom-calendar-workspace').attributes('data-document-state')).toBe('unsupported-version')
    expect(wrapper.get('.custom-calendar-error').text()).toContain('較新版本')
    expect((wrapper.get('#custom-calendar-import').element as HTMLInputElement).disabled).toBe(true)
  })
})

describe('what the workspace says', () => {
  it('states the device boundary and every reviewed caveat', async () => {
    const wrapper = await mountWorkspace()

    expect(wrapper.get('.custom-calendar-boundary').text()).toContain('這台裝置')
    expect(wrapper.get('.custom-calendar-boundary').text(), '不重複工具頁已經印過的那句本機處理說明').toContain('辦公日曆表')
    for (const caveat of Object.values(customCalendarCaveats)) {
      expect(wrapper.get('.custom-calendar-caveats').text()).toContain(caveat['zh-tw'])
    }
  })

  it('reads in English on the English page', async () => {
    seed(serializeCustomCalendar([entry({ title: 'Company day off' })], new Date('2026-09-07T02:00:00Z')))
    const wrapper = await mountWorkspace('en')
    await selectDay(wrapper, '2026-09-18')

    expect(wrapper.get('.custom-calendar-boundary').text()).toContain('this device')
    expect(wrapper.get('.custom-calendar-layers__custom').text()).toContain('Custom day off')
    expect(wrapper.get('.custom-calendar-entry').text()).toContain('Company day off')
  })
})
