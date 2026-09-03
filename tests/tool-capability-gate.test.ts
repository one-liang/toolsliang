import { mount } from '@vue/test-utils'
import { renderToString } from '@vue/server-renderer'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import ToolCapabilityGate from '@/components/ToolCapabilityGate.vue'

describe('ToolCapabilityGate', () => {
  it('does not render a workspace before client capability detection', async () => {
    const html = await renderToString(h(ToolCapabilityGate, {
      requirements: ['javascript'],
      locale: 'en',
    }, {
      default: () => h('div', { class: 'workspace-fixture' }, 'workspace'),
    }))

    expect(html).not.toContain('workspace-fixture')
  })

  it('shows a failure message instead of mounting an unsupported workspace', async () => {
    const wrapper = mount(ToolCapabilityGate, {
      props: { requirements: ['webgpu'], locale: 'en' },
      slots: { default: '<div class="workspace-fixture">workspace</div>' },
    })

    await wrapper.vm.$nextTick()
    expect(wrapper.get('[role="alert"]').text()).toContain('WebGPU')
    expect(wrapper.find('.workspace-fixture').exists()).toBe(false)
  })
})
