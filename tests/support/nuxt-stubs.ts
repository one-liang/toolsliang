import { vi } from 'vitest'
import {
  computed, inject, nextTick, onBeforeUnmount, onMounted, onUnmounted, provide,
  reactive, readonly, ref, shallowRef, toRef, useId, watch, watchEffect,
} from 'vue'
import LandingFaqComponent from '@/components/LandingFaq.vue'
import SavedStorageNoticeComponent from '@/components/SavedStorageNotice.vue'
import SavedToolListComponent from '@/components/SavedToolList.vue'
import ToolCardComponent from '@/components/ToolCard.vue'
import ToolCategoryGridComponent from '@/components/ToolCategoryGrid.vue'
import ToolIconComponent from '@/components/ToolIcon.vue'
import ToolSearchComponent from '@/components/ToolSearch.vue'
import ToolStatusBadgeComponent from '@/components/ToolStatusBadge.vue'
import { Button as ButtonComponent } from '@/components/ui/button'
import { useAppLocale } from '@/composables/useAppLocale'
import { useLocalAssets } from '@/composables/useLocalAssets'
import { useOfflineAsset } from '@/composables/useOfflineAsset'
import { useSavedTools } from '@/composables/useSavedTools'
import { useSavedToolsView } from '@/composables/useSavedToolsView'
import { useWorkspaceDirty } from '@/composables/useWorkspaceDirty'

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
  vi.stubGlobal('useLocalAssets', useLocalAssets)
  vi.stubGlobal('useOfflineAsset', useOfflineAsset)
  vi.stubGlobal('useSavedTools', useSavedTools)
  vi.stubGlobal('useSavedToolsView', useSavedToolsView)
  vi.stubGlobal('useWorkspaceDirty', useWorkspaceDirty)
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
 * The tool directory and tool page manage saved tools through the same real
 * component tree a visitor uses; only the workspace and offline surfaces a
 * saved-tool test does not exercise are stubbed.
 */
export function savedToolsGlobals() {
  return {
    components: {
      Button: ButtonComponent,
      SavedStorageNotice: SavedStorageNoticeComponent,
      SavedToolList: SavedToolListComponent,
      ToolCard: ToolCardComponent,
      ToolCategoryGrid: ToolCategoryGridComponent,
      ToolIcon: ToolIconComponent,
      ToolSearch: ToolSearchComponent,
      ToolStatusBadge: ToolStatusBadgeComponent,
    },
    stubs: {
      NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
      ToolCapabilityGate: { template: '<div><slot /></div>' },
      ToolOfflineStatus: true,
    },
  }
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
