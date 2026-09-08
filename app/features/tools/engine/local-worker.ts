export interface WorkerLease { worker: Worker, dispose(): void }

/**
 * Fetch only the build-owned script. A Blob worker works offline even when the
 * browser does not route Worker(scriptURL) through its Service Worker cache.
 * No tool input reaches this adapter. The bundle must be self-contained.
 *
 * A worker stays classic unless it needs module semantics — only the one that
 * imports its inference runtime at runtime does — because a module worker is
 * loaded and evaluated differently and there is no reason to change how an
 * already-shipped worker starts.
 */
export async function createLocalWorker(scriptUrl: string, signal: AbortSignal, type: WorkerType = 'classic'): Promise<WorkerLease> {
  const response = await fetch(scriptUrl, { signal })
  if (!response.ok) throw new Error('worker_asset_unavailable')
  const script = await response.blob()
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
  const url = URL.createObjectURL(new Blob([script], { type: 'text/javascript' }))
  try {
    const worker = new Worker(url, { type })
    return { worker, dispose() { worker.terminate(); URL.revokeObjectURL(url) } }
  }
  catch (error) { URL.revokeObjectURL(url); throw error }
}
