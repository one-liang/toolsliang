export interface WorkerLease { worker: Worker, dispose(): void }

/**
 * Fetch only the build-owned script. A Blob worker works offline even when the
 * browser does not route Worker(scriptURL) through its Service Worker cache.
 * No tool input reaches this adapter. The bundle must be self-contained.
 */
export async function createLocalWorker(scriptUrl: string, signal: AbortSignal): Promise<WorkerLease> {
  const response = await fetch(scriptUrl, { signal })
  if (!response.ok) throw new Error('worker_asset_unavailable')
  const script = await response.blob()
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
  const url = URL.createObjectURL(new Blob([script], { type: 'text/javascript' }))
  try {
    const worker = new Worker(url)
    return { worker, dispose() { worker.terminate(); URL.revokeObjectURL(url) } }
  }
  catch (error) { URL.revokeObjectURL(url); throw error }
}
