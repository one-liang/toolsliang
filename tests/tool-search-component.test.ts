import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ToolSearch from '@/components/ToolSearch.vue'

describe('ToolSearch', () => {
  it('renders local keyword results without exposing unpublished tools', async () => {
    const wrapper = mount(ToolSearch, {
      props: { locale: 'zh-tw' },
      global: {
        stubs: {
          Button: { template: '<button><slot /></button>' },
          NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
          ToolIcon: true,
          ToolStatusBadge: true,
        },
      },
    })

    await wrapper.get('input').setValue('image-resizer')
    expect(wrapper.findAll('.tool-search__result')).toHaveLength(0)

    await wrapper.get('input').setValue('圖片')
    expect(wrapper.get('.tool-search__result').attributes('href')).toBe('/zh-tw/tools/image-compressor/')

    await wrapper.get('input').setValue('支票')
    expect(wrapper.get('.tool-search__result').attributes('href')).toBe('/zh-tw/tools/ntd-uppercase/')
    expect(wrapper.get('input').attributes('aria-expanded'), 'searchbox 不支援 aria-expanded').toBeUndefined()
    expect(wrapper.get('.tool-search__results').attributes('aria-label')).toBe('工具搜尋結果')
  })
})
