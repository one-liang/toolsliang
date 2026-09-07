import imageWorkerUrl from './image-compressor/image.worker?worker&url'
import { defineAsyncComponent, type AsyncComponentLoader } from 'vue'
import type { PublishedToolDefinition } from '@/features/tools/catalog'

const workspaceLoaders = import.meta.glob('../../components/*Workspace.vue')

export function resolveToolWorkspace(componentKey: string) {
  const loader = workspaceLoaders[`../../components/${componentKey}.vue`]
  return loader ? defineAsyncComponent(loader as AsyncComponentLoader) : undefined
}

export function validateToolWorkspaces(tools: PublishedToolDefinition[]) {
  return tools
    .filter(tool => !workspaceLoaders[`../../components/${tool.routeComponentKey}.vue`])
    .map(tool => `[${tool.slug}] unknown workspace component: ${tool.routeComponentKey}`)
}

/** Build-hashed assets must be declared by the SSR page, before capability-gated workspaces mount. */
export function getToolWorkspaceAssets(componentKey: string): string[] {
  return componentKey === 'ImageCompressorWorkspace' ? [imageWorkerUrl] : []
}
