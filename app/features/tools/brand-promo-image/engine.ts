import workerUrl from './promo.worker?worker&url'
import { createLocalWorker } from '../engine/local-worker'
import { createWorkerEngine } from '../engine/worker-engine'
import { validateImageInput } from '@/features/images/input'
import { exceedsImageLimits, imageInputLimits } from '@/features/images/limits'
import { promoLayerKinds, type PromoScene } from './scene'

export interface PromoInput { scene: PromoScene, files: Record<string, File> }
export interface PromoWireOutput { bytes: ArrayBuffer, preview: ArrayBuffer, width: number, height: number }
export interface PromoOutput { blob: Blob, preview: Blob, width: number, height: number }

export function createPromoRenderer() {
  return createWorkerEngine<PromoInput, PromoWireOutput, PromoOutput>({
    worker: signal => createLocalWorker(workerUrl, signal),
    async validate({ scene, files }) {
      if (![scene.width, scene.height].every(value => Number.isInteger(value) && value > 0)
        || exceedsImageLimits(scene.width, scene.height) || !scene.layers.length || scene.layers.length > 12) return 'invalid_options'
      for (const layer of scene.layers) {
        if (!promoLayerKinds.includes(layer.kind) || !['contain', 'cover'].includes(layer.fit)
          || ![layer.x, layer.y].every(value => Number.isFinite(value) && Math.abs(value) <= 1)
          || !Number.isFinite(layer.scale) || layer.scale < 0.01 || layer.scale > 4
          || !Number.isFinite(layer.opacity) || layer.opacity < 0 || layer.opacity > 1) return 'invalid_options'
        const file = files[layer.assetId]
        if (!file) return 'missing_asset'
        if (file.size > imageInputLimits.maxBytes) return 'too_large'
        const error = await validateImageInput(file)
        if (error) return error
      }
    },
    output: ({ bytes, preview, width, height }) => ({ blob: new Blob([bytes], { type: 'image/png' }), preview: new Blob([preview], { type: 'image/png' }), width, height }),
  })
}
