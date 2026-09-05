import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RandomPickerWorkspace from '@/components/RandomPickerWorkspace.vue'
import { randomPickerCaveats } from '@/features/tools/random-picker/content'
import { randomPickerLimits } from '@/features/tools/random-picker/domain/reference'
import { randomPickerReferenceVersion } from '@/features/tools/random-picker/domain/sources'
import { setTestRoute } from './support/nuxt-stubs'

function mountWorkspace(locale: 'zh-tw' | 'en' = 'zh-tw') {
  setTestRoute({ path: `/${locale}/tools/random-picker/`, params: { locale, slug: 'random-picker' } })
  return mount(RandomPickerWorkspace)
}

type Workspace = ReturnType<typeof mountWorkspace>

/** Replaces the browser's random source with an exact sequence, so a draw is reproducible. */
function scriptRandom(words: number[]) {
  let cursor = 0
  vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((array) => {
    const view = array as Uint32Array
    for (let index = 0; index < view.length; index += 1) {
      view[index] = words[cursor % words.length]!
      cursor += 1
    }
    return array
  })
}

function stubReducedMotion(reduce: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (media: string) => ({ matches: reduce, media, addEventListener() {}, removeEventListener() {} }),
  })
}

async function enterList(wrapper: Workspace, list: string) {
  await wrapper.get('#picker-list').setValue(list)
  return wrapper
}

async function draw(wrapper: Workspace) {
  await wrapper.get('.picker-draw').trigger('click')
  await wrapper.vm.$nextTick()
  return wrapper
}

function drawnEntries(wrapper: Workspace) {
  return wrapper.findAll('.picker-result__item').map(item => item.text())
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  Reflect.deleteProperty(window, 'matchMedia')
})

describe('random picker workspace', () => {
  it('opens on an empty, calm workspace that explains what it needs', () => {
    const wrapper = mountWorkspace()

    expect(wrapper.get('label[for="picker-list"]').text()).toBe('候選名單')
    expect(wrapper.findAll('[role="alert"]'), '還沒輸入不是錯誤').toHaveLength(0)
    expect(wrapper.get('.picker-result').text()).toContain('準備好名單後按')
    expect(wrapper.get('.picker-draw').attributes('disabled')).toBeDefined()
    expect((wrapper.get('input[name="picker-duplicates"][value="keep"]').element as HTMLInputElement).checked).toBe(true)
  })

  it('reports what it parsed out of the pasted list', async () => {
    const wrapper = await enterList(mountWorkspace(), 'Amy\n\n  \nBob\nAmy')
    const summary = wrapper.findAll('.picker-summary li').map(item => item.text())

    expect(summary[0]).toContain('3')
    expect(summary.join(' ')).toContain('略過空白行 2 行')
    expect(wrapper.get('.picker-draw').attributes('disabled'), '名單成立後就可以抽').toBeUndefined()
  })

  it('merges repeated entries only when asked, and says how many it merged', async () => {
    const wrapper = await enterList(mountWorkspace(), 'Amy\nAmy\nBob')
    expect(wrapper.get('.picker-caveats').text()).toContain(randomPickerCaveats['duplicates-share-chances']['zh-tw'])

    await wrapper.get('input[name="picker-duplicates"][value="merge"]').setValue()
    expect(wrapper.findAll('.picker-summary li').map(item => item.text()).join(' ')).toContain('合併重複 1 筆')
    expect(wrapper.get('.picker-caveats').text(), '合併後就沒有多佔機會的問題')
      .not.toContain(randomPickerCaveats['duplicates-share-chances']['zh-tw'])
  })

  it('adds one entry at a time without disturbing the pasted list', async () => {
    const wrapper = await enterList(mountWorkspace(), 'Amy\nBob')
    await wrapper.get('#picker-new-entry').setValue('  Cindy  ')
    await wrapper.get('.picker-add__button').trigger('click')

    expect((wrapper.get('#picker-list').element as HTMLTextAreaElement).value).toBe('Amy\nBob\nCindy')
    expect((wrapper.get('#picker-new-entry').element as HTMLInputElement).value, '加入後欄位要清空').toBe('')
  })

  it('announces the drawn entries in a live region', async () => {
    scriptRandom([2])
    const wrapper = await draw(await enterList(mountWorkspace(), 'Amy\nBob\nCindy'))
    const result = wrapper.get('.picker-result')

    expect(result.attributes('role')).toBe('status')
    expect(result.attributes('aria-live')).toBe('polite')
    expect(result.attributes('aria-busy')).toBe('false')
    expect(drawnEntries(wrapper)).toEqual(['Cindy'])
  })

  it('draws several different entries and never repeats one', async () => {
    scriptRandom([0])
    const wrapper = await enterList(mountWorkspace(), 'Amy\nBob\nCindy\nDan')
    await wrapper.get('#picker-count').setValue('3')
    await draw(wrapper)

    const drawn = drawnEntries(wrapper)
    expect(drawn).toHaveLength(3)
    expect(new Set(drawn).size, '多人抽選不得重複中選').toBe(3)
  })

  it('explains a refused draw on the field that has to change', async () => {
    const wrapper = await enterList(mountWorkspace(), 'Amy\nBob')
    await wrapper.get('#picker-count').setValue('5')

    const alert = wrapper.get('[role="alert"]')
    expect(alert.text()).toBe('要抽 5 名，但名單只有 2 筆可抽。')
    expect(wrapper.get('#picker-count').attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('#picker-count').attributes('aria-describedby')).toContain(alert.attributes('id'))
    expect(wrapper.get('.picker-draw').attributes('disabled')).toBeDefined()
  })

  it('names the ceiling a list ran into instead of trimming the list', async () => {
    const wrapper = await enterList(
      mountWorkspace(),
      Array.from({ length: randomPickerLimits.maxEntries + 1 }, (_, index) => `n${index}`).join('\n'),
    )

    expect(wrapper.get('[role="alert"]').text()).toBe('名單最多 10,000 筆，目前有 10,001 筆。')
    expect((wrapper.get('#picker-list').element as HTMLTextAreaElement).value.split('\n'), '不得替使用者刪掉項目')
      .toHaveLength(randomPickerLimits.maxEntries + 1)
  })

  it('asks calmly for a list instead of raising an alert', async () => {
    const wrapper = await enterList(await enterList(mountWorkspace(), 'Amy'), '')

    expect(wrapper.findAll('[role="alert"]')).toHaveLength(0)
    expect(wrapper.get('.picker-pending').text()).toContain('請先貼上或逐項輸入候選名單')
  })

  it('offers the wheel only where a wheel can be read, and says why when it cannot', async () => {
    const wrapper = await enterList(mountWorkspace(), 'Amy\nBob\nCindy')
    await wrapper.get('input[name="picker-presentation"][value="wheel"]').setValue()
    expect(wrapper.find('.picker-wheel').exists()).toBe(true)
    expect(wrapper.find('.picker-wheel-note').exists()).toBe(false)

    await wrapper.get('#picker-count').setValue('2')
    expect(wrapper.get('.picker-wheel-note').text()).toContain('抽 1 名')
    expect(wrapper.find('.picker-wheel').exists(), '無法呈現輪盤時改用名單').toBe(false)
  })

  it('spins the wheel, then announces the result the draw had already decided', async () => {
    vi.useFakeTimers()
    stubReducedMotion(false)
    scriptRandom([1])
    const wrapper = await enterList(mountWorkspace(), 'Amy\nBob\nCindy')
    await wrapper.get('input[name="picker-presentation"][value="wheel"]').setValue()
    await draw(wrapper)

    expect(wrapper.get('.picker-result').attributes('aria-busy')).toBe('true')
    expect(drawnEntries(wrapper), '動畫還沒停就不得宣告結果').toHaveLength(0)
    expect(wrapper.get('.picker-progress').attributes('role')).toBe('progressbar')

    vi.advanceTimersByTime(5_000)
    await wrapper.vm.$nextTick()
    expect(wrapper.get('.picker-result').attributes('aria-busy')).toBe('false')
    expect(drawnEntries(wrapper)).toEqual(['Bob'])
    expect(wrapper.find('.picker-skip').exists(), '停下來以後不需要跳過鍵').toBe(false)
  })

  it('skips the animation without changing the result it landed on', async () => {
    vi.useFakeTimers()
    stubReducedMotion(false)
    scriptRandom([1])
    const wrapper = await enterList(mountWorkspace(), 'Amy\nBob\nCindy')
    await wrapper.get('input[name="picker-presentation"][value="wheel"]').setValue()
    await draw(wrapper)

    await wrapper.get('.picker-skip').trigger('click')
    expect(drawnEntries(wrapper), '跳過動畫不得重抽').toEqual(['Bob'])
    expect(wrapper.get('.picker-result').attributes('aria-busy')).toBe('false')
  })

  it('shows the result immediately when the visitor asked for less motion', async () => {
    stubReducedMotion(true)
    scriptRandom([1])
    const wrapper = await enterList(mountWorkspace(), 'Amy\nBob\nCindy')
    await wrapper.get('input[name="picker-presentation"][value="wheel"]').setValue()
    await draw(wrapper)

    expect(drawnEntries(wrapper), 'reduced motion 下結果不得依賴動畫').toEqual(['Bob'])
    expect(wrapper.find('.picker-skip').exists()).toBe(false)
    expect(wrapper.get('.picker-wheel').exists(), '輪盤仍然看得到中選的扇形').toBe(true)
  })

  it('keeps the whole candidate list readable beside the wheel', async () => {
    const wrapper = await enterList(mountWorkspace(), 'Amy\nBob\nCindy')
    await wrapper.get('input[name="picker-presentation"][value="wheel"]').setValue()

    expect(wrapper.findAll('.picker-candidates li').map(item => item.text())).toEqual(['Amy', 'Bob', 'Cindy'])
  })

  it('clears a stale result and stale wheel names as soon as the list changes', async () => {
    stubReducedMotion(true)
    scriptRandom([0])
    const wrapper = await enterList(mountWorkspace(), 'Amy\nBob')
    await wrapper.get('input[name="picker-presentation"][value="wheel"]').setValue()
    await draw(wrapper)
    expect(drawnEntries(wrapper)).toEqual(['Amy'])

    await enterList(wrapper, 'Cindy\nDan\nErin')
    expect(drawnEntries(wrapper), '名單改了就不能留著舊結果').toHaveLength(0)
    expect(wrapper.findAll('.picker-candidates li').map(item => item.text()), '輪盤旁的名單必須跟著改')
      .toEqual(['Cindy', 'Dan', 'Erin'])
  })

  it('returns to an empty workspace after a reset, keeping the chosen settings', async () => {
    scriptRandom([0])
    const wrapper = await enterList(mountWorkspace(), 'Amy\nBob')
    await wrapper.get('input[name="picker-duplicates"][value="merge"]').setValue()
    await draw(wrapper)
    await wrapper.get('.picker-reset').trigger('click')

    expect((wrapper.get('#picker-list').element as HTMLTextAreaElement).value).toBe('')
    expect(drawnEntries(wrapper)).toHaveLength(0)
    expect(wrapper.get('.picker-result').text()).toContain('準備好名單後按')
    expect((wrapper.get('input[name="picker-duplicates"][value="merge"]').element as HTMLInputElement).checked).toBe(true)
  })

  it('stops instead of drawing when the browser has no secure random source', async () => {
    vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(() => {
      throw new Error('blocked')
    })
    const wrapper = await draw(await enterList(mountWorkspace(), 'Amy\nBob'))

    expect(wrapper.get('[role="alert"]').text()).toContain('沒有提供可用的安全隨機來源')
    expect(drawnEntries(wrapper)).toHaveLength(0)
    expect(wrapper.get('.picker-draw').attributes('disabled'), '來源不可信時不得讓人一直重按').toBeDefined()

    await enterList(wrapper, 'Amy\nBob\nCindy')
    expect(wrapper.get('.picker-draw').attributes('disabled'), '改動名單後可以再試一次').toBeUndefined()
  })

  it('names the rule version and cites the method sources', () => {
    const wrapper = mountWorkspace()

    expect(wrapper.get('.picker-source').text()).toContain(randomPickerReferenceVersion)
    expect(wrapper.get('.picker-source').get('a').attributes('href')).toBe('https://www.w3.org/TR/WebCryptoAPI/')
    expect(wrapper.get('.picker-method').text()).toContain('Fisher–Yates')
  })

  it('speaks English on the English page', async () => {
    const wrapper = await enterList(mountWorkspace('en'), 'Amy\nBob')
    await wrapper.get('#picker-count').setValue('5')

    expect(wrapper.get('label[for="picker-list"]').text()).toBe('Candidates')
    expect(wrapper.get('[role="alert"]').text()).toBe('You asked for 5 but the list only has 2 to draw from.')
    expect(wrapper.get('.picker-caveats').text()).toContain('no third-party audit')
  })

  it('keeps the list and the result out of device storage', async () => {
    scriptRandom([0])
    const wrapper = await draw(await enterList(mountWorkspace(), '王小明\n李小美'))

    expect(drawnEntries(wrapper)).toEqual(['王小明'])
    expect(localStorage.length, '名單不得寫入本機儲存').toBe(0)
    expect(sessionStorage.length, '名單不得寫入本機儲存').toBe(0)
  })
})
