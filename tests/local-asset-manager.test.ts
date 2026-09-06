import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import LocalAssetManager from '@/components/LocalAssetManager.vue'
import { createLocalAssetRecord, type LocalAssetKind, type LocalAssetRecord } from '@/features/shell/local-assets/schema'
import { summarizeLocalAssets } from '@/features/shell/local-assets/usage'
import type { LocalAssetErrorCode, UnreadableAsset } from '@/features/shell/local-assets/repository'
import { Button } from '@/components/ui/button'

const now = new Date('2026-09-07T02:00:00Z')

function asset(id: string, name: string, kind: LocalAssetKind, size: number): LocalAssetRecord {
  return createLocalAssetRecord(
    { kind, name, payload: { format: 'binary', mediaType: 'image/png', bytes: new Uint8Array(size) } },
    { id, now },
  )
}

const removed: string[] = []
const renamed: string[] = []
let renameSucceeds = true
const cleared: string[] = []
const state = {
  records: ref<LocalAssetRecord[]>([]),
  unreadable: ref<UnreadableAsset[]>([]),
  usage: ref(summarizeLocalAssets([])),
  error: ref<LocalAssetErrorCode | null>(null),
  busy: ref(false),
  ready: ref(true),
}

function stubComposable() {
  vi.stubGlobal('useLocalAssets', () => ({
    ...state,
    refresh: vi.fn(),
    remove: vi.fn(async (id: string) => {
      removed.push(id)
      state.records.value = state.records.value.filter(record => record.id !== id)
      state.usage.value = summarizeLocalAssets(state.records.value)
      return true
    }),
    clearAll: vi.fn(async () => {
      cleared.push('all')
      state.records.value = []
      state.usage.value = summarizeLocalAssets([])
      return true
    }),
    rename: vi.fn(async (id: string, name: string) => {
      renamed.push(`${id}:${name}`)
      state.records.value = state.records.value.map(record => record.id === id ? { ...record, name } : record)
      return renameSucceeds
    }),
    exportAll: vi.fn(async () => 'toolsliang-local-assets-2026-09-07.json'),
    importFile: vi.fn(async () => ({ added: 2, replaced: 1 })),
  }))
}

function mountManager(locale: 'zh-tw' | 'en' = 'zh-tw') {
  return mount(LocalAssetManager, { props: { locale }, global: { components: { Button } } })
}

beforeEach(() => {
  state.records.value = []
  state.unreadable.value = []
  state.usage.value = summarizeLocalAssets([])
  state.error.value = null
  state.busy.value = false
  state.ready.value = true
  removed.length = 0
  renamed.length = 0
  renameSucceeds = true
  cleared.length = 0
  stubComposable()
})

describe('local asset manager', () => {
  it('states where the assets live and what can remove them', () => {
    const text = mountManager().text()

    expect(text).toContain('這台裝置')
    expect(text).toContain('無痕')
    expect(text, '必須說明不隨雲端偏好同步').toContain('同步')
  })

  it('explains the empty device instead of showing an empty list', () => {
    const wrapper = mountManager()

    expect(wrapper.text()).toContain('這台裝置還沒有本機資產')
    expect(wrapper.findAll('.local-asset')).toHaveLength(0)
    expect(wrapper.find('[data-asset-action="clear"]').exists(), '沒有資產時不提供清除全部').toBe(false)
    expect(wrapper.find('[data-asset-action="export"]').exists(), '沒有資產時不提供匯出').toBe(false)
  })

  it('shows what each asset and each kind occupies on this device', () => {
    state.records.value = [asset('a', '主要簽名', 'signature', 2048), asset('b', '春節框版', 'frame', 4096)]
    state.usage.value = summarizeLocalAssets(state.records.value, { usage: 6_144, quota: 1_048_576 })
    const wrapper = mountManager()

    expect(wrapper.findAll('.local-asset')).toHaveLength(2)
    expect(wrapper.get('.local-assets__usage').text()).toContain('6 KB')
    expect(wrapper.get('.local-assets__usage').text()).toContain('簽名')
    expect(wrapper.get('.local-assets__usage').text()).toContain('框版')
    expect(wrapper.get('.local-assets__quota').text()).toContain('1 MB')
    expect(wrapper.findAll('.local-asset__meta')[0]!.text()).toContain('2 KB')
  })

  it('says the browser gave no estimate rather than inventing a limit', () => {
    state.records.value = [asset('a', '主要簽名', 'signature', 2048)]
    state.usage.value = summarizeLocalAssets(state.records.value)

    expect(mountManager().get('.local-assets__usage').text()).toContain('沒有提供儲存空間估計值')
  })

  it('deletes one asset only after an explicit confirmation', async () => {
    state.records.value = [asset('a', '主要簽名', 'signature', 2048)]
    const wrapper = mountManager()

    const remove = wrapper.get('[data-asset-action="delete"]')
    expect(remove.attributes('aria-label')).toBe('刪除「主要簽名」')
    await remove.trigger('click')
    expect(removed, '第一次點擊只詢問，不刪除').toEqual([])
    expect(wrapper.text()).toContain('確定要刪除「主要簽名」嗎')

    await wrapper.get('[data-asset-action="cancel-delete"]').trigger('click')
    expect(removed).toEqual([])
    expect(wrapper.find('[data-asset-action="confirm-delete"]').exists()).toBe(false)

    await wrapper.get('[data-asset-action="delete"]').trigger('click')
    await wrapper.get('[data-asset-action="confirm-delete"]').trigger('click')
    await flushPromises()

    expect(removed).toEqual(['a'])
    expect(wrapper.get('.local-assets__status').text()).toContain('已刪除「主要簽名」')
  })

  it('renames a saved asset without touching what it holds', async () => {
    state.records.value = [asset('a', '主要簽名', 'signature', 2048)]
    const wrapper = mountManager()

    const rename = wrapper.get('[data-asset-action="rename"]')
    expect(rename.attributes('aria-label')).toBe('重新命名「主要簽名」')
    await rename.trigger('click')

    const field = wrapper.get('[data-asset-field="name"]')
    expect(field.attributes('id')).toBe('local-asset-name-a')
    expect(wrapper.get('label[for="local-asset-name-a"]').text()).toContain('名稱')

    await field.setValue('備用簽名')
    await wrapper.get('[data-asset-action="save-name"]').trigger('click')
    await flushPromises()

    expect(renamed).toEqual(['a:備用簽名'])
    expect(wrapper.get('.local-asset__name').text()).toBe('備用簽名')
    expect(wrapper.get('.local-assets__status').text()).toContain('已更名為「備用簽名」')
    expect(wrapper.find('[data-asset-field="name"]').exists(), '儲存後結束編輯').toBe(false)
  })

  it('keeps the stored name when the visitor cancels or empties the field', async () => {
    state.records.value = [asset('a', '主要簽名', 'signature', 2048)]
    const wrapper = mountManager()

    await wrapper.get('[data-asset-action="rename"]').trigger('click')
    await wrapper.get('[data-asset-field="name"]').setValue('   ')
    expect(wrapper.get('[data-asset-action="save-name"]').attributes('disabled'), '空白名稱不可儲存').toBeDefined()

    await wrapper.get('[data-asset-action="cancel-name"]').trigger('click')
    expect(renamed).toEqual([])
    expect(wrapper.get('.local-asset__name').text()).toBe('主要簽名')
  })

  it('does not claim a rename the device refused', async () => {
    state.records.value = [asset('a', '主要簽名', 'signature', 2048)]
    renameSucceeds = false
    const wrapper = mountManager()

    await wrapper.get('[data-asset-action="rename"]').trigger('click')
    await wrapper.get('[data-asset-field="name"]').setValue('備用簽名')
    await wrapper.get('[data-asset-action="save-name"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('.local-assets__status').text(), '失敗時不得宣告成功').toBe('')
  })

  it('does not offer renaming for a record it cannot read', async () => {
    state.unreadable.value = [{ id: 'broken', name: null, reason: 'corrupt' }]

    expect(mountManager().find('[data-asset-action="rename"]').exists()).toBe(false)
  })

  it('clears everything only after a confirmation that mentions the backup', async () => {
    state.records.value = [asset('a', '主要簽名', 'signature', 2048)]
    const wrapper = mountManager()

    await wrapper.get('[data-asset-action="clear"]').trigger('click')
    expect(cleared).toEqual([])
    expect(wrapper.text()).toContain('建議先匯出備份')

    await wrapper.get('[data-asset-action="confirm-clear"]').trigger('click')
    await flushPromises()

    expect(cleared).toEqual(['all'])
    expect(wrapper.get('.local-assets__status').text()).toContain('已清除')
  })

  it('says what a backup cannot carry before clearing unreadable records', async () => {
    state.records.value = [asset('a', '主要簽名', 'signature', 2048)]
    state.unreadable.value = [{ id: 'broken', name: null, reason: 'corrupt' }]
    const wrapper = mountManager()

    await wrapper.get('[data-asset-action="clear"]').trigger('click')
    expect(wrapper.get('.local-assets__confirm').text()).toContain('無法讀取的資料不會出現在匯出檔中')
  })

  it('announces an export the visitor triggered, naming the file only', async () => {
    state.records.value = [asset('a', '主要簽名', 'signature', 2048)]
    const wrapper = mountManager()

    await wrapper.get('[data-asset-action="export"]').trigger('click')
    await flushPromises()

    const status = wrapper.get('.local-assets__status')
    expect(status.attributes('role')).toBe('status')
    expect(status.text()).toContain('toolsliang-local-assets-2026-09-07.json')
    expect(status.text(), '狀態訊息不得帶出資產名稱').not.toContain('主要簽名')
  })

  it('reports what an import added and replaced', async () => {
    const wrapper = mountManager()
    const input = wrapper.get('input[type="file"]')

    expect(wrapper.get('label[for="local-asset-import"]').text()).toContain('匯入')
    expect(input.attributes('accept')).toBe('application/json,.json')

    Object.defineProperty(input.element, 'files', {
      value: [new File(['{}'], 'backup.json', { type: 'application/json' })],
    })
    await input.trigger('change')
    await flushPromises()

    expect(wrapper.get('.local-assets__status').text()).toContain('已匯入 2 筆')
  })

  it('explains a failure with a way to recover, without losing the list', () => {
    state.records.value = [asset('a', '主要簽名', 'signature', 2048)]
    state.error.value = 'quota-exceeded'
    const wrapper = mountManager()

    const alert = wrapper.get('.local-assets__error')
    expect(alert.attributes('role')).toBe('alert')
    expect(alert.text()).toContain('裝置儲存空間不足')
    expect(alert.text()).toContain('先刪除不再需要的本機資產')
    expect(wrapper.findAll('.local-asset'), '錯誤不得清空已顯示的資產').toHaveLength(1)
  })

  it('lists records it cannot read so they can still be deleted', async () => {
    state.unreadable.value = [
      { id: 'broken', name: null, reason: 'corrupt' },
      { id: 'newer', name: '未來簽名', reason: 'unsupported-version' },
    ]
    const wrapper = mountManager()

    const rows = wrapper.findAll('.local-assets__unreadable li')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('已損毀')
    expect(rows[1]!.text()).toContain('較新版本')

    await rows[0]!.get('[data-asset-action="delete"]').trigger('click')
    await rows[0]!.get('[data-asset-action="confirm-delete"]').trigger('click')
    await flushPromises()
    expect(removed).toEqual(['broken'])
  })

  it('marks the region busy while the device is working', () => {
    state.busy.value = true

    expect(mountManager().get('.local-assets').attributes('aria-busy')).toBe('true')
  })

  it('offers the same page in English', () => {
    state.records.value = [asset('a', 'Main signature', 'signature', 2048)]
    const text = mountManager('en').text()

    expect(text).toContain('Saved assets')
    expect(text).toContain('this device')
    expect(text).toContain('Export a backup file')
  })
})
