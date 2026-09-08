import workerUrl from './background-removal.worker?worker&url'
import { createLocalWorker } from '../engine/local-worker'
import { validateImageInput } from '@/features/images/input'
import { createWorkerEngine } from '../engine/worker-engine'
import { imageInputLimits } from '@/features/images/limits'
import type { BackgroundRemovalInput, BackgroundRemovalOutput, BackgroundRemovalWireOutput } from './types'

/**
 * A run owns its own worker, which is the only reliable way to stop this tool:
 * `session.run()` cannot be interrupted once it enters an operator, so
 * cancellation terminates the worker and hands the linear memory back.
 */
export function createBackgroundRemover() {
  return createWorkerEngine<BackgroundRemovalInput, BackgroundRemovalWireOutput, BackgroundRemovalOutput>({
    // A module worker: the inference runtime is loaded from a versioned
    // asset at run time, which a classic worker cannot do.
    worker: signal => createLocalWorker(workerUrl, signal, 'module'),
    // Preparing a session and compositing a large picture on the WebAssembly
    // baseline is slower than an encode, and the slowest measured browser needs
    // several seconds before the first operator runs.
    timeoutMs: 120_000,
    async validate(input) {
      const error = await validateImageInput(input.file)
      if (error) return error
      if (input.file.size > imageInputLimits.maxBytes) return 'too_large'
    },
    output: ({ bytes, preview, ...metadata }) => ({
      ...metadata,
      blob: new Blob([bytes], { type: 'image/png' }),
      preview: new Blob([preview], { type: 'image/png' }),
    }),
  })
}
