import { buildZipArchive } from './archive'
import type { ArchiveWireOutput, WorkbenchArchiveInput } from './types'
import type { WorkerReply } from '../engine/worker-engine'

declare const self: DedicatedWorkerGlobalScope
const send = (message: WorkerReply<ArchiveWireOutput>, transfer: Transferable[] = []) => self.postMessage(message, transfer)

/**
 * Reads every finished output and writes the one file the merchant downloads.
 *
 * It runs off the main thread for the reason §12.11 states as a budget: a
 * batch is up to 200 MiB, and reading and checksumming that much on the page
 * would hold the interface still for far longer than 50 ms. Nothing here
 * touches the network — the bytes arrive from the page and the archive goes
 * straight back.
 */
async function write(input: WorkbenchArchiveInput) {
  try {
    const entries: { name: string, bytes: Uint8Array }[] = []
    for (const [index, entry] of input.entries.entries()) {
      send({ type: 'progress', progress: { stage: 'archiving', completed: index, total: input.entries.length } })
      entries.push({ name: entry.name, bytes: new Uint8Array(await entry.blob.arrayBuffer()) })
    }
    send({ type: 'progress', progress: { stage: 'archiving', completed: entries.length, total: entries.length } })
    const archive = buildZipArchive(entries)
    const bytes = archive.buffer as ArrayBuffer
    send({ type: 'result', output: { bytes } }, [bytes])
  }
  catch {
    send({ type: 'error', code: 'memory_limit' })
  }
}

self.onmessage = async (event: MessageEvent<{ type: 'prepare' } | { type: 'run', input: WorkbenchArchiveInput }>) => {
  if (event.data.type === 'prepare') send({ type: 'capabilities', supported: true, formats: ['application/zip'] })
  else await write(event.data.input)
}
