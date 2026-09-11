/**
 * The page's side of the PDF worker: one worker for one document, for as long
 * as the visitor is signing it.
 *
 * Every other tool here runs one job and throws its worker away, because one
 * image in is one image out. Signing is a conversation instead — open, look at a
 * page, place, look again, export — and re-parsing a 50 MiB document for each of
 * those steps would be both slower and less honest about what the tool is
 * holding. So the session keeps a single worker and correlates requests by id.
 *
 * That is a different shape from `createWorkerEngine`, not a different contract.
 * ADR-0010 asks a heavy module to run in a Web Worker and to encapsulate the six
 * things a visitor can feel, and all six are here: capability detection before
 * anything is chosen (`capabilities`), progress per stage (`onProgress`),
 * cancellation (`cancel`, `signal`), structured failures (`pdfSignatureError`),
 * Blob output (`PdfPagePreview`, `PdfExportResult`) and memory cleanup
 * (`dispose`, and a terminated worker on every cancel).
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
  pdfSignatureMemoryModel,
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
export const pdfSignatureMemoryBudgetBytes = 384 * 1024 * 1024

/**
 * What this device may actually be asked to hold.
 *
 * §12.12 sets 100 pages and 50 MiB "subject to device capability", and §9.2 of
 * the record allows the numbers to come down but never up. The working set is
 * several times the file (two engines, each holding it), so the byte ceiling is
 * derived by running the record's own estimator backwards from the budget.
 * `deviceMemory` is coarse and missing in some browsers; when it says nothing
 * the shared ceiling stands, because a limit invented from silence is not more
 * careful, only more annoying. The page cap does not move: it is about how much
 * a person can work with, not about bytes.
 */
export function resolvePdfSignatureLimits(
  device: { deviceMemory?: number } = {},
  budgetBytes = pdfSignatureMemoryBudgetBytes,
) {
  const budget = device.deviceMemory
    ? Math.min(budgetBytes, Math.round(device.deviceMemory * 1024 ** 3 / 8))
    : budgetBytes
  const fits = Math.floor(
    (budget - pdfSignatureMemoryModel.baseBytes)
    / (pdfSignatureMemoryModel.bytesPerInputByte * pdfSignatureMemoryModel.engines),
  )

  return {
    maxPages: pdfSignatureLimits.maxPages,
    maxBytes: Math.max(0, Math.min(pdfSignatureLimits.maxBytes, fits)),
    budgetBytes: budget,
  }
}

export type PdfSignatureSessionLimits = ReturnType<typeof resolvePdfSignatureLimits>
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
  onProgress?: (progress: { stage: PdfSignatureStage, page?: number, total?: number }) => void
  /** Abandons this request the way `cancel()` does, for a caller that owns its own lifetime. */
  signal?: AbortSignal
}

export interface PdfSignatureSessionOptions {
  /** What the browser admits the device has, in GiB; absent leaves the shared ceiling. */
  deviceMemory?: number
  /** Lowered by the tests to reach the memory refusal without a large file. */
  memoryBudgetBytes?: number
}

export interface PdfSignatureSession {
  /** The ceilings this session enforces, after the device has been asked. */
  limits: PdfSignatureSessionLimits
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
  onProgress?: PdfRequestContext['onProgress']
  timer: ReturnType<typeof setTimeout>
}

export function createPdfSignatureSession(options: PdfSignatureSessionOptions = {}): PdfSignatureSession {
  const limits = resolvePdfSignatureLimits(options, options.memoryBudgetBytes ?? pdfSignatureMemoryBudgetBytes)
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

  /** Hands every request in flight back to its caller as cancelled. */
  function abandonPending() {
    const requests = [...pending.values()]
    pending.clear()
    for (const request of requests) {
      clearTimeout(request.timer)
      request.abandon()
    }
  }

  /**
   * Stops everything: the work in flight goes back to its callers as cancelled
   * and the worker holding the document is terminated. Cancelling, aborting and
   * disposing all mean this, so they all come through here.
   */
  function abandonEverything() {
    generation += 1
    abandonPending()
    teardown()
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
      request.onProgress?.({ stage: reply.stage, page: reply.page, total: reply.total })
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
    if (disposed || context.signal?.aborted) return { status: 'cancelled' }
    const mine = generation
    const worker = await ensureWorker()
    if (disposed || mine !== generation) return { status: 'cancelled' }
    /* Aborted while the worker was starting: the caller still gets the cancel it asked for. */
    if (context.signal?.aborted) { abandonEverything(); return { status: 'cancelled' } }
    if (!worker) return failure('unsupported_browser')

    const id = nextId++
    const message = build(id)

    return new Promise<EngineOutcome<T>>((resolve) => {
      const settled = (outcome: EngineOutcome<T>) => {
        context.signal?.removeEventListener('abort', abort)
        resolve(outcome)
      }
      /* An aborted request is a cancelled one: the worker holding the document goes. */
      const abort = () => {
        pending.delete(id)
        abandonEverything()
        settled({ status: 'cancelled' })
      }
      context.signal?.addEventListener('abort', abort, { once: true })

      pending.set(id, {
        onProgress: context.onProgress,
        settle: reply => settled(reply.type === 'failure' ? failure(reply.code) : read(reply)),
        abandon: () => settled({ status: 'cancelled' }),
        timer: setTimeout(() => {
          pending.delete(id)
          teardown()
          settled(failure('insufficient_memory'))
        }, REQUEST_TIMEOUT_MS),
      })
      worker.worker.postMessage(message, transfer)
    })
  }

  return {
    limits,

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
      if (file.size > limits.maxBytes) return failure('insufficient_memory')
      if (estimatePdfWorkingSetBytes(file.size) > limits.budgetBytes) return failure('insufficient_memory')

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

    cancel: abandonEverything,

    dispose() {
      disposed = true
      abandonEverything()
    },
  }
}
