import { vi } from 'vitest'
import {
  computed, inject, nextTick, onBeforeUnmount, onMounted, onUnmounted, provide,
  reactive, readonly, ref, shallowRef, toRef, useId, watch, watchEffect,
} from 'vue'
import LandingFaqComponent from '@/components/LandingFaq.vue'
import LandingFeaturedToolsComponent from '@/components/LandingFeaturedTools.vue'
import ToolCardComponent from '@/components/ToolCard.vue'
import ToolCategoryGridComponent from '@/components/ToolCategoryGrid.vue'
import ToolIconComponent from '@/components/ToolIcon.vue'
import ToolSearchComponent from '@/components/ToolSearch.vue'
import ToolStatusBadgeComponent from '@/components/ToolStatusBadge.vue'
import { Button as ButtonComponent } from '@/components/ui/button'
import { useAppLocale } from '@/composables/useAppLocale'

export interface TestRoute {
  path: string
  fullPath: string
  params: Record<string, string>
  query: Record<string, string>
}

function defaultRoute(): TestRoute {
  return { path: '/zh-tw/tools/', fullPath: '/zh-tw/tools/', params: { locale: 'zh-tw' }, query: {} }
}

const route = reactive<TestRoute>(defaultRoute())
const states = new Map<string, unknown>()

export function setTestRoute(patch: Partial<TestRoute> = {}) {
  Object.assign(route, defaultRoute(), patch)
}

export function resetNuxtStubs() {
  states.clear()
  setTestRoute()
  document.documentElement.className = ''
  localStorage.clear()
}

export function installNuxtStubs() {
  const vueGlobals = {
    computed, inject, nextTick, onBeforeUnmount, onMounted, onUnmounted, provide,
    reactive, readonly, ref, shallowRef, toRef, useId, watch, watchEffect,
  }
  for (const [name, value] of Object.entries(vueGlobals)) vi.stubGlobal(name, value)

  vi.stubGlobal('useRoute', () => route)
  vi.stubGlobal('useHead', () => {})
  vi.stubGlobal('useSeoMeta', () => {})
  vi.stubGlobal('definePageMeta', () => {})
  vi.stubGlobal('usePageSeo', () => {})
  vi.stubGlobal('useAppLocale', useAppLocale)
  vi.stubGlobal('useState', <T>(key: string, init: () => T) => {
    if (!states.has(key)) states.set(key, ref(init()))
    return states.get(key)
  })
}

export const shellStubs = {
  NuxtLink: {
    props: ['to'],
    template: '<a :href="to"><slot /></a>',
  },
  BrandMark: true,
  ToolIcon: true,
  ToolStatusBadge: true,
}

/**
 * Pages rely on Nuxt auto-imported components, so a page-level test has to
 * register the real tree to observe what a visitor can actually reach.
 */
export function landingGlobals() {
  return {
    components: {
      Button: ButtonComponent,
      LandingFaq: LandingFaqComponent,
      LandingFeaturedTools: LandingFeaturedToolsComponent,
      ToolCard: ToolCardComponent,
      ToolCategoryGrid: ToolCategoryGridComponent,
      ToolIcon: ToolIconComponent,
      ToolSearch: ToolSearchComponent,
      ToolStatusBadge: ToolStatusBadgeComponent,
    },
    stubs: {
      NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
    },
  }
}
