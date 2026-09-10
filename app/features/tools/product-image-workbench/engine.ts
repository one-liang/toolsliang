import workerUrl from './archive.worker?worker&url'
import { createLocalWorker } from '../engine/local-worker'
import { createWorkerEngine } from '../engine/worker-engine'
import { checkWorkbenchArchive } from './archive'
import type { ArchiveWireOutput, WorkbenchArchiveInput, WorkbenchArchiveOutput } from './types'

/**
 * The only engine the workbench owns. Every other step borrows a tool's own
 * engine (ADR-0004); packing finished outputs into one download is work no
 * independent tool does, so it lives here — and it is asked whether it can run
 * at all before a batch is offered an archive, which is the capability
 * preflight §12.11 requires.
 */
export function createArchiveWriter() {
  return createWorkerEngine<WorkbenchArchiveInput, ArchiveWireOutput, WorkbenchArchiveOutput>({
    worker: signal => createLocalWorker(workerUrl, signal),
    async validate(input) {
      return checkWorkbenchArchive({ count: input.entries.length, bytes: input.entries.reduce((total, entry) => total + entry.blob.size, 0) })
    },
    output: ({ bytes }) => ({ blob: new Blob([bytes], { type: 'application/zip' }) }),
  })
}
