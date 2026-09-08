import workerUrl from './image.worker?worker&url'
import { createLocalWorker } from '../engine/local-worker'
import { imageInputLimits } from '@/features/images/limits'
import { validateImageInput } from '@/features/images/input'
import { createWorkerEngine } from '../engine/worker-engine'
import type { CompressionInput, CompressionOutput, CompressionWireOutput } from './types'

export function createImageCompressor() {
  return createWorkerEngine<CompressionInput, CompressionWireOutput, CompressionOutput>({
    worker: signal => createLocalWorker(workerUrl, signal),
    async validate(input) {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(input.format) || !Number.isFinite(input.quality) || input.quality < 0 || input.quality > 1 || ![input.maxWidth, input.maxHeight].every(value => Number.isInteger(value) && value > 0 && value <= imageInputLimits.maxSide)) return 'invalid_options'
      const error = await validateImageInput(input.file)
      if (error) return error
      if (input.file.size > imageInputLimits.maxBytes) return 'too_large'
    },
    output: ({ bytes, preview, ...metadata }) => ({ ...metadata, blob: new Blob([bytes], { type: metadata.format }), preview: new Blob([preview], { type: 'image/png' }) }),
  })
}
