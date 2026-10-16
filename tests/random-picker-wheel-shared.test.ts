import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LandingDemoWheel from '@/components/LandingDemoWheel.vue'
import RandomPickerWheel from '@/components/RandomPickerWheel.vue'
import RandomPickerWorkspace from '@/components/RandomPickerWorkspace.vue'
import { pickerDemoNames, pickerDemoWinnerIndex } from '@/features/landing/demos'
import { setTestRoute } from './support/nuxt-stubs'

/**
 * #106: the landing demo and the tool draw one wheel. Given the demo's names
 * and the demo's result, the tool has to put exactly the demo's drawing on
 * screen: the same slices, colours, labels, rotation and drawn slice.
 */

afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(window, 'matchMedia')
  document.body.innerHTML = ''
})

function disc(wrapper: VueWrapper) {
  return wrapper.getComponent(RandomPickerWheel).get('.picker-wheel__disc')
}

describe('the shared wheel', () => {
  it('draws the landing demo and a settled tool draw identically', async () => {
    const names = pickerDemoNames['zh-tw']
    const landing = mount(LandingDemoWheel, { props: { locale: 'zh-tw' } })

    // Reduced motion lands the wheel at once; word 3 of a six-name list draws the demo's winner.
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (media: string) => ({ matches: true, media, addEventListener() {}, removeEventListener() {} }),
    })
    vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(array => (array as Uint32Array).fill(pickerDemoWinnerIndex))
    setTestRoute({ path: '/zh-tw/tools/random-picker/', params: { locale: 'zh-tw', slug: 'random-picker' } })
    const tool = mount(RandomPickerWorkspace, { attachTo: document.body })
    await tool.get('#picker-list').setValue(names.join('\n'))
    await tool.get('input[name="picker-presentation"][value="wheel"]').setValue()
    await tool.get('.picker-draw').trigger('click')

    expect(tool.find('.picker-result__item').text()).toBe(names[pickerDemoWinnerIndex])
    expect(disc(tool).html(), '工具頁停下來的輪盤必須和首頁示範一模一樣').toBe(disc(landing).html())
    expect(disc(landing).get('.picker-wheel__won').text()).toBe(names[pickerDemoWinnerIndex])
  })
})
