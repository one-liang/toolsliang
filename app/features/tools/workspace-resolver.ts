import archiveWorkerUrl from './product-image-workbench/archive.worker?worker&url'
import promoWorkerUrl from './brand-promo-image/promo.worker?worker&url'
import backgroundRemovalWorkerUrl from './image-background-remover/background-removal.worker?worker&url'
import compliantImageWorkerUrl from './compliant-product-image/compliant-image.worker?worker&url'
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

/**
 * Build-hashed assets declared by the SSR page, so they start loading before a
 * capability-gated workspace mounts.
 *
 * Only a worker built purely from application code may be listed. The client
 * and the server bundle a worker separately, and a worker that also bundles a
 * dependency does not produce the same bytes — and therefore not the same
 * hashed file name — on both sides, so the URL a server render computed for it
 * would not exist. That is why the background remover loads its inference
 * runtime from a versioned asset instead of bundling it.
 * `tests/e2e/quality-gates.spec.ts` holds every declared asset to a 200.
 */
export function getToolWorkspaceAssets(componentKey: string): string[] {
  if (componentKey === 'BrandPromoImageWorkspace') return [promoWorkerUrl, imageWorkerUrl]
  if (componentKey === 'ImageCompressorWorkspace') return [imageWorkerUrl]
  if (componentKey === 'ImageBackgroundRemoverWorkspace') return [backgroundRemovalWorkerUrl]
  if (componentKey === 'CompliantProductImageWorkspace') return [compliantImageWorkerUrl]
  if (componentKey === 'ProductImageWorkbenchWorkspace') return [compliantImageWorkerUrl, promoWorkerUrl, imageWorkerUrl, archiveWorkerUrl]
  return []
}
