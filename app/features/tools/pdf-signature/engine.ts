/**
 * The page's side of the PDF worker: one worker for one document, for as long
 * as the visitor is signing it.
 *
 * Every other tool here runs one job and throws its worker away, because one
 * image in is one image out. Signing is a conversation instead — open, look at a
 * page, place, look again, export — and re-parsing a 50 MiB document for each of
 * those steps would be both slower and less honest about what the tool is
 * holding. So the session keeps a single worker and correlates requests by id,
 * while keeping the parts of the Tool Engine contract that matter: a capability
 * answer before anything is chosen, progress per stage, cancellation that really
 * stops the work, structured failures, and a release that leaves nothing behind.
 *
 * Cancellation terminates the worker. Nothing inside an engine's save or render
 * can be interrupted once it has started, and a terminated worker is also the
 * only way to hand the document's memory straight back. The placements live in
 * the page, so re-opening the file restores the workspace exactly as it was.
 */
import workerUrl from './pdf-signature.worker?worker&url'
import { createLocalWorker } from '../engine/local-worker'
import {
  estimatePdfWorkingSetBytes,
  pdfSignatureError,
  pdfSignatureLimits,
  type PdfSignatureFailureCode,
  type PdfSignatureStage,
} from './domain/reference'
import type { SignatureExportRequest } from './domain/workspace'
import type {
  PdfDocumentReport,
  PdfPagePreviewReport,
  PdfSignatureCapabilities,
  PdfSignatureReply,
  PdfSignatureRequest,
  SignatureImagePayload,
} from './types'
import type { EngineOutcome } from '../engine/contract'
import type { WorkerLease } from '../engine/local-worker'

/** The same ceiling every other local engine works under. */
const DEFAULT_MEMORY_BUDGET_BYTES = 384 * 1024 * 1024
/** A request that has not answered by now is a worker that is not coming back. */
const REQUEST_TIMEOUT_MS = 90_000

export interface PdfPagePreview extends Omit<PdfPagePreviewReport, 'bytes'> {
  blob: Blob
}

export interface PdfExportResult {
  blob: Blob
  pageCount: number
  mode: 'incremental-update' | 'full-rewrite'
  decrypted: boolean
}

export interface PdfRequestContext {
  onProgress?: (stage: PdfSignatureStage) => void
}

export interface PdfSignatureSessionOptions {
  /** Lowered by the tests and by a device that reports less room than the default. */
  memoryBudgetBytes?: number
}

export interface PdfSignatureSession {
  capabilities: () => Promise<PdfSignatureCapabilities>
  open: (file: File, context?: PdfRequestContext & { password?: string }) => Promise<EngineOutcome<PdfDocumentReport>>
  renderPage: (index: number, scale: number, context?: PdfRequestContext) => Promise<EngineOutcome<PdfPagePreview>>
  exportSigned: (
    placements: SignatureExportRequest[],
    signatures: SignatureImagePayload[],
    context?: PdfRequestContext,
  ) => Promise<EngineOutcome<PdfExportResult>>
  cancel: () => void
  dispose: () => void
}

const unsupported: PdfSignatureCapabilities = { supported: false, formats: [], password: false, reason: 'unsupported_browser' }

interface PendingRequest {
  settle: (reply: PdfSignatureReply) => void
  /** Resolves the caller without a reply, for a cancelled or disposed session. */
  abandon: () => void
  onProgress?: (stage: PdfSignatureStage) => void
  timer: ReturnType<typeof setTimeout>
}

export function createPdfSignatureSession(options: PdfSignatureSessionOptions = {}): PdfSignatureSession {
  const memoryBudgetBytes = options.memoryBudgetBytes ?? DEFAULT_MEMORY_BUDGET_BYTES
  const pending = new Map<number, PendingRequest>()
  let lease: WorkerLease | undefined
  let starting: Promise<WorkerLease | undefined> | undefined
  let disposed = false
  let nextId = 1
  /** Set while a document is open, so a preview cannot be asked for before one is. */
  let opened = false
  /**
   * Bumped by every cancel. A request is still starting its worker when the
   * visitor presses cancel, so the generation it was born in is what decides
   * whether it may still be sent — otherwise that request would be registered
   * after the cancel and wait for a worker that is already gone.
   */
  let generation = 0

  function failure(code: PdfSignatureFailureCode): EngineOutcome<never> {
    return { status: 'error', error: pdfSignatureError(code) }
  }

  function settleAll(outcome: 'cancelled') {
    const requests = [...pending.values()]
    pending.clear()
    for (const request of requests) {
      clearTimeout(request.timer)
      if (outcome === 'cancelled') request.abandon()
    }
  }

  /** Hands the worker and the document it holds back to the device. */
  function teardown() {
    opened = false
    starting = undefined
    lease?.dispose()
    lease = undefined
  }

  function receive(event: MessageEvent<PdfSignatureReply>) {
    const reply = event.data
    /* pdf.js shares this port and sends messages of its own; only ours carry a request id. */
    if (typeof reply?.id !== 'number') return
    const request = pending.get(reply.id)
    if (!request) return

    if (reply.type === 'progress') {
      request.onProgress?.(reply.stage)
      return
    }

    clearTimeout(request.timer)
    pending.delete(reply.id)
    request.settle(reply)
  }

  /**
   * A worker that dies while holding a document has, in practice, run out of
   * room: the documents that kill it are the large ones. Reporting that is more
   * use than a generic failure, and the visitor can act on it.
   */
  function workerLost() {
    const requests = [...pending.values()]
    pending.clear()
    teardown()
    for (const request of requests) {
      clearTimeout(request.timer)
      request.settle({ type: 'failure', id: -1, code: 'insufficient_memory' })
    }
  }

  async function ensureWorker(): Promise<WorkerLease | undefined> {
    if (disposed) return undefined
    if (lease) return lease
    starting ??= (async () => {
      try {
        const started = await createLocalWorker(workerUrl, new AbortController().signal, 'module')
        if (disposed) { started.dispose(); return undefined }
        started.worker.addEventListener('message', receive as (event: MessageEvent) => void)
        started.worker.onerror = (event) => { event.preventDefault(); workerLost() }
        started.worker.onmessageerror = () => workerLost()
        lease = started
        return started
      }
      catch {
        return undefined
      }
      finally {
        starting = undefined
      }
    })()

    return starting
  }

  /** Sends one request and resolves when its own reply arrives, or when it stops being possible. */
  async function request<T>(
    build: (id: number) => PdfSignatureRequest,
    read: (reply: PdfSignatureReply) => EngineOutcome<T>,
    context: PdfRequestContext = {},
    transfer: Transferable[] = [],
  ): Promise<EngineOutcome<T>> {
    if (disposed) return { status: 'cancelled' }
    const mine = generation
    const worker = await ensureWorker()
    if (disposed || mine !== generation) return { status: 'cancelled' }
    if (!worker) return failure('unsupported_browser')

    const id = nextId++
    const message = build(id)

    return new Promise<EngineOutcome<T>>((resolve) => {
      pending.set(id, {
        onProgress: context.onProgress,
        settle: reply => resolve(reply.type === 'failure' ? failure(reply.code) : read(reply)),
        abandon: () => resolve({ status: 'cancelled' }),
        timer: setTimeout(() => {
          pending.delete(id)
          teardown()
          resolve(failure('insufficient_memory'))
        }, REQUEST_TIMEOUT_MS),
      })
      worker.worker.postMessage(message, transfer)
    })
  }

  return {
    async capabilities() {
      if (disposed) return unsupported
      const outcome = await request<PdfSignatureCapabilities>(
        id => ({ type: 'capabilities', id }),
        reply => reply.type === 'capabilities' ? { status: 'success', output: reply.capabilities } : failure('unsupported_browser'),
      )

      return outcome.status === 'success' ? outcome.output : unsupported
    },

    /**
     * Everything that can be judged without parsing is judged here: the
     * signature, the byte ceiling and what the document would cost this device.
     * A file that fails any of them never reaches a worker.
     */
    async open(file, context = {}) {
      if (disposed) return { status: 'cancelled' }
      if (file.size > pdfSignatureLimits.maxBytes) return failure('too_large')
      if (estimatePdfWorkingSetBytes(file.size) > memoryBudgetBytes) return failure('insufficient_memory')

      const header = new Uint8Array(await file.slice(0, 5).arrayBuffer())
      if (String.fromCharCode(...header) !== '%PDF-') return failure('not_a_pdf')

      const outcome = await request<PdfDocumentReport>(
        id => ({ type: 'open', id, file, password: context.password }),
        reply => reply.type === 'document' ? { status: 'success', output: reply.report } : failure('damaged_pdf'),
        context,
      )
      opened = outcome.status === 'success'

      return outcome
    },

    renderPage(index, scale, context = {}) {
      if (disposed) return Promise.resolve({ status: 'cancelled' })
      if (!opened) return Promise.resolve(failure('damaged_pdf'))

      return request<PdfPagePreview>(
        id => ({ type: 'preview', id, page: index, scale }),
        (reply) => {
          if (reply.type !== 'preview') return failure('damaged_pdf')
          const { bytes, ...rest } = reply.report
          return { status: 'success', output: { ...rest, blob: new Blob([bytes], { type: 'image/png' }) } }
        },
        context,
      )
    },

    exportSigned(placements, signatures, context = {}) {
      if (disposed) return Promise.resolve({ status: 'cancelled' })
      if (!opened || !placements.length) return Promise.resolve(failure('export_failed'))

      return request<PdfExportResult>(
        id => ({ type: 'export', id, placements, signatures }),
        (reply) => {
          if (reply.type !== 'export') return failure('export_failed')
          const { bytes, ...rest } = reply.report
          return { status: 'success', output: { ...rest, blob: new Blob([bytes], { type: 'application/pdf' }) } }
        },
        context,
        signatures.map(signature => signature.bytes),
      )
    },

    cancel() {
      generation += 1
      settleAll('cancelled')
      teardown()
    },

    dispose() {
      disposed = true
      generation += 1
      settleAll('cancelled')
      teardown()
    },
  }
}
