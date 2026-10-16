import workerUrl from './archive.worker?worker&url'
import { createLocalWorker } from '../tools/engine/local-worker'
import { createWorkerEngine } from '../tools/engine/worker-engine'
import { checkImageArchive, type ArchiveWireOutput, type ImageArchiveInput, type ImageArchiveOutput } from './archive'

/**
 * Packs finished outputs into one download. It began as the only engine the
 * workbench owned; every image tool that offers a batch now shares it, so a
 * ZIP from one tool is written exactly like a ZIP from the next. It is asked
 * whether it can run at all before a batch is offered an archive, which is
 * the capability preflight §12.11 requires.
 */
export function createImageArchiveWriter() {
  return createWorkerEngine<ImageArchiveInput, ArchiveWireOutput, ImageArchiveOutput>({
    worker: signal => createLocalWorker(workerUrl, signal),
    async validate(input) {
      return checkImageArchive({ count: input.entries.length, bytes: input.entries.reduce((total, entry) => total + entry.blob.size, 0) })
    },
    output: ({ bytes }) => ({ blob: new Blob([bytes], { type: 'application/zip' }) }),
  })
}
