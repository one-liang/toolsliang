import type { WorkerLease } from './local-worker'
import { engineError, type EngineCapabilities, type EngineOutcome, type EngineProgress, type RunContext, type ToolEngine } from './contract'

export type WorkerReply<T> =
  | { type: 'capabilities' } & EngineCapabilities
  | { type: 'progress', progress: EngineProgress }
  | { type: 'result', output: T }
  | { type: 'error', code: string }

/** Owns one job and its worker. Cancellation terminates even a decoder that cannot cooperate. */
export function createWorkerEngine<Input, WireOutput, Output>(adapter: {
  worker: (signal: AbortSignal) => Promise<WorkerLease>
  validate: (input: Input) => Promise<string | undefined>
  output: (wire: WireOutput) => Output
}): ToolEngine<Input, Output> {
  let disposed = false
  let cancelActive: (() => void) | undefined
  let cancelPreparation: (() => void) | undefined
  let preparing: Promise<EngineCapabilities> | undefined

  function prepare(): Promise<EngineCapabilities> {
    if (disposed) return Promise.resolve({ supported: false, formats: [], reason: 'disposed' })
    if (preparing) return preparing
    preparing = new Promise<EngineCapabilities>((resolve) => {
      let worker: Worker | undefined
      let lease: WorkerLease | undefined
      const controller = new AbortController()
      let settled = false
      const finish = (capabilities: EngineCapabilities) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        controller.abort()
        lease?.dispose()
        cancelPreparation = undefined
        resolve(capabilities)
      }
      cancelPreparation = () => finish({ supported: false, formats: [], reason: 'cancelled' })
      const timer = setTimeout(() => finish({ supported: false, formats: [], reason: 'unsupported_browser' }), 10_000)
      void (async () => {
        try {
          lease = await adapter.worker(controller.signal)
          if (settled) { lease.dispose(); return }
          worker = lease.worker
          worker.onmessage = (event: MessageEvent<WorkerReply<WireOutput>>) => {
            if (event.data.type === 'capabilities') finish(event.data)
          }
          worker.onerror = event => { event.preventDefault(); finish({ supported: false, formats: [], reason: 'unsupported_browser' }) }
          worker.onmessageerror = () => finish({ supported: false, formats: [], reason: 'unsupported_browser' })
          worker.postMessage({ type: 'prepare' })
        }
        catch { finish({ supported: false, formats: [], reason: 'unsupported_browser' }) }
      })()
    }).finally(() => { preparing = undefined })
    return preparing
  }

  function run(input: Input, context: RunContext = {}): Promise<EngineOutcome<Output>> {
    if (disposed) return Promise.resolve({ status: 'error', error: engineError('disposed') })
    if (cancelActive) return Promise.resolve({ status: 'error', error: engineError('busy') })
    if (context.signal?.aborted) return Promise.resolve({ status: 'cancelled' })
    return new Promise((resolve) => {
      let worker: Worker | undefined
      let lease: WorkerLease | undefined
      const controller = new AbortController()
      let settled = false
      const finish = (outcome: EngineOutcome<Output>) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        controller.abort()
        lease?.dispose()
        context.signal?.removeEventListener('abort', cancel)
        cancelActive = undefined
        resolve(outcome)
      }
      const cancel = () => finish({ status: 'cancelled' })
      cancelActive = cancel
      context.signal?.addEventListener('abort', cancel, { once: true })
      const fail = (code: string) => finish({ status: 'error', error: engineError(code) })
      const timer = setTimeout(() => fail('processing_timeout'), 60_000)
      void (async () => {
        let failure = 'read_failed'
        try {
          const code = await adapter.validate(input)
          if (settled) return
          if (code) { fail(code); return }
          context.onProgress?.({ stage: 'reading', completed: 0, total: 1 })
          if (settled) return
          failure = 'unsupported_browser'
          lease = await adapter.worker(controller.signal)
          if (settled) { lease.dispose(); return }
          worker = lease.worker
          failure = 'worker_failed'
          worker.onmessage = (event: MessageEvent<WorkerReply<WireOutput>>) => {
            if (settled) return
            try {
              if (event.data.type === 'progress') context.onProgress?.(event.data.progress)
              else if (event.data.type === 'error') fail(event.data.code)
              else if (event.data.type === 'result') {
                context.onProgress?.({ stage: 'preparing-download', completed: 1, total: 1 })
                if (!settled) finish({ status: 'success', output: adapter.output(event.data.output) })
              }
            }
            catch { fail('memory_limit') }
          }
          worker.onerror = event => { event.preventDefault(); fail('worker_failed') }
          worker.onmessageerror = () => fail('worker_failed')
          worker.postMessage({ type: 'run', input })
        }
        catch { if (!settled) fail(failure) }
      })()
    })
  }

  return {
    prepare, capabilities: prepare, run,
    cancel() { cancelActive?.(); cancelPreparation?.() },
    dispose() { disposed = true; cancelActive?.(); cancelPreparation?.() },
  }
}
