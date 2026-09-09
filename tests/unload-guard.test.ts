import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { expect, it } from 'vitest'
import { useUnloadGuard } from '@/composables/useUnloadGuard'

function mountGuard(initial: boolean) {
  const dirty = ref(initial)
  const wrapper = mount(defineComponent({
    setup() {
      useUnloadGuard(dirty)
      return () => null
    },
  }))

  return { dirty, wrapper }
}

function unloadPrevented() {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)

  return event.defaultPrevented
}

it('沒有未完成的工作時不打擾離開的使用者', async () => {
  const { wrapper } = mountGuard(false)

  expect(unloadPrevented()).toBe(false)
  wrapper.unmount()
})

it('有未完成的工作時提醒，工作清空後不再提醒', async () => {
  const { dirty, wrapper } = mountGuard(false)

  dirty.value = true
  await wrapper.vm.$nextTick()
  expect(unloadPrevented()).toBe(true)

  dirty.value = false
  await wrapper.vm.$nextTick()
  expect(unloadPrevented()).toBe(false)
  wrapper.unmount()
})

it('離開工作區後不再攔截整個網站的離開行為', async () => {
  const { wrapper } = mountGuard(true)

  expect(unloadPrevented()).toBe(true)
  wrapper.unmount()
  expect(unloadPrevented()).toBe(false)
})
