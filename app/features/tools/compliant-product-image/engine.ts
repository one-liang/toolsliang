import workerUrl from './compliant-image.worker?worker&url'
import { createLocalWorker } from '../engine/local-worker'
import { createWorkerEngine } from '../engine/worker-engine'
import { imageInputLimits } from '@/features/images/limits'
import { validateImageInput } from '@/features/images/input'
import { encodableFormats, formatMimeTypes } from './domain/render'
import type { CompliantRenderInput, CompliantRenderOutput, CompliantRenderWireOutput } from './types'

const supportedMimeTypes: string[] = encodableFormats.map(format => formatMimeTypes[format])

/** Everything a number field could hold that the renderer must never be handed. */
function hasImpossibleOptions(input: CompliantRenderInput) {
  const sides = [input.width, input.height]
  const percentages = [input.zoom, input.offsetX, input.offsetY]

  return !supportedMimeTypes.includes(input.format)
    || !['cover', 'contain'].includes(input.fit)
    || !/^#[0-9a-f]{6}$/i.test(input.background)
    || !sides.every(value => Number.isInteger(value) && value > 0 && value <= imageInputLimits.maxSide)
    || input.width * input.height > imageInputLimits.maxPixels
    || !percentages.every(value => Number.isFinite(value))
    || input.zoom <= 0 || input.zoom > 400
    || ![input.offsetX, input.offsetY].every(value => value >= -100 && value <= 100)
    || [input.minBytes, input.maxBytes].some(value => value !== undefined && !(value > 0))
}

/**
 * The renderer behind the compliant product image tool. It is handed a canvas
 * size, a format and a capacity range that the page already resolved from a
 * preset, so nothing here can turn a channel rule into a different one; whether
 * the file it produces satisfies the preset is decided afterwards, by reading
 * the file.
 */
export function createCompliantImageRenderer() {
  return createWorkerEngine<CompliantRenderInput, CompliantRenderWireOutput, CompliantRenderOutput>({
    worker: signal => createLocalWorker(workerUrl, signal),
    async validate(input) {
      if (hasImpossibleOptions(input)) return 'invalid_options'
      const error = await validateImageInput(input.file)
      if (error) return error
      if (input.file.size > imageInputLimits.maxBytes) return 'too_large'
    },
    output: ({ bytes, preview, ...metadata }) => ({
      ...metadata,
      blob: new Blob([bytes], { type: metadata.format }),
      preview: new Blob([preview], { type: 'image/png' }),
    }),
  })
}
