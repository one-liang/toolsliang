import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Button from '@/components/ui/button/Button.vue'

describe('Button', () => {
  it('keeps variant and size classes in separate namespaces', () => {
    const wrapper = mount(Button, { props: { variant: 'ghost' }, slots: { default: 'Action' } })

    expect(wrapper.classes()).toContain('ui-button--ghost')
    expect(wrapper.classes()).toContain('ui-button--size-default')
    expect(wrapper.classes()).not.toContain('ui-button--default')
  })

  it('applies the primary variant explicitly', () => {
    const wrapper = mount(Button, { slots: { default: 'Primary' } })

    expect(wrapper.classes()).toContain('ui-button--default')
    expect(wrapper.classes()).toContain('ui-button--size-default')
  })
})
