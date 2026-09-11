/**
 * The only place a PDF is parsed, rasterised or written.
 *
 * Two libraries, each doing the half T24 measured it to be good at: `pdfjs-dist`
 * opens the document, reads its protection and draws the pages, and
 * `@cantoo/pdf-lib` writes the signature back. The preview engine is also the
 * gatekeeper — it decides what may be opened, and it reads every export back
 * before the file is offered — because the writer accepts documents it cannot
 * faithfully reproduce (§7 and §9.1 of
 * `docs/research/009-pdf-local-editing-engine-and-safety-boundary.md`).
 *
 * Nothing here reaches the network. The document arrives as a `File` handle the
 * visitor chose, every byte stays in this worker, and no progress report,
 * failure code or log line carries a file name, a password or page content.
 */
import { PDFDocument, degrees } from '@cantoo/pdf-lib'
import * as pdfjs from 'pdfjs-dist'
/*
 * pdf.js runs its parser in a worker of its own, which this build does not
 * need: this *is* the worker. Importing the worker bundle publishes
 * `globalThis.pdfjsWorker`, which pdf.js answers by talking to it over an
 * in-process port instead of starting a nested worker — one thread, no second
 * script to fetch, and nothing that has to resolve a URL from a Blob.
 *
 * The bundle also installs a message handler of its own on this scope. It only
 * answers messages addressed to pdf.js (`targetName`), and the listener below
 * only answers messages carrying a request id, so the two never read each
 * other's mail. The one visible trace is a `ready` message posted to the page,
 * which the session ignores.
 */
import 'pdfjs-dist/build/pdf.worker.mjs'
import {
  pdfSignatureExportMode,
  pdfSignatureLimits,
  pdfSignatureParserPolicy,
  pdfSignatureSelection,
  pdfDisplayBox,
  pdfSignaturePlacement,
  type PdfSignatureFailureCode,
  type PdfSignatureStage,
} from './domain/reference'
import type {
  PdfDocumentReport,
  PdfPageReport,
  PdfSignatureReply,
  PdfSignatureRequest,
  SignatureImagePayload,
} from './types'
import type { SignatureExportRequest } from './domain/workspace'

declare const self: DedicatedWorkerGlobalScope

/**
 * The permission bits §7.2 of the record makes the tool respect: changing page
 * content and changing annotations (ISO 32000-1 table 22). A document that
 * withholds either one is saying it does not want to be edited, and the tool
 * takes the author at their word even though nothing enforces it.
 */
const MODIFY_CONTENTS = 0x08
const MODIFY_ANNOTATIONS = 0x20

/** Only errors are logged: a warning per missing glyph would say more about the document than the console should. */
const PDFJS_VERBOSITY_ERRORS = 0

function send(reply: PdfSignatureReply, transfer: Transferable[] = []) {
  self.postMessage(reply, transfer)
}

/** Stages carry「第幾頁／共幾頁」where there is a page to count, never a name or a word of content. */
const progress = (id: number, stage: PdfSignatureStage, page?: number, total?: number) =>
  send({ type: 'progress', id, stage, ...(page === undefined ? {} : { page, total }) })

/**
 * A signature tool opens documents it did not make, so the parser is told to do
 * as little as a parser can: no script, no action, no request, no font lookup on
 * this machine. Every switch comes from the reviewed policy rather than from
 * here, so a change has to be made in the record first.
 */
function parserOptions(password?: string) {
  return {
    password,
    verbosity: PDFJS_VERBOSITY_ERRORS,
    isEvalSupported: pdfSignatureParserPolicy.evalSupported,
    useSystemFonts: pdfSignatureParserPolicy.useSystemFonts,
    enableXfa: pdfSignatureParserPolicy.renderXfa,
    /* Without it pdf.js reads `document.baseURI` to decide, and a worker has no document. */
    useWorkerFetch: false,
    disableFontFace: true,
    CanvasFactory: OffscreenCanvasFactory,
  }
}

/**
 * pdf.js needs somewhere to draw the intermediate layers a page asks for —
 * transparency groups, masks, patterns. Its own factory reaches for
 * `document.createElement`, which a worker does not have.
 */
class OffscreenCanvasFactory {
  create(width: number, height: number) {
    if (width <= 0 || height <= 0) throw new Error('invalid_canvas_size')
    const canvas = new OffscreenCanvas(width, height)
    return { canvas, context: canvas.getContext('2d', { willReadFrequently: true }) }
  }

  reset(entry: { canvas: OffscreenCanvas | null }, width: number, height: number) {
    if (!entry.canvas) throw new Error('invalid_canvas')
    entry.canvas.width = width
    entry.canvas.height = height
  }

  destroy(entry: { canvas: OffscreenCanvas | null, context: unknown }) {
    if (entry.canvas) entry.canvas.width = entry.canvas.height = 0
    entry.canvas = null
    entry.context = null
  }
}

interface OpenDocument {
  password: string | undefined
  /** The bytes as they arrived. pdf.js is handed a copy, because it takes ownership of what it is given. */
  bytes: Uint8Array
  task: ReturnType<typeof pdfjs.getDocument>
  document: Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>
  report: PdfDocumentReport
}

let open: OpenDocument | undefined

class SignatureFailure extends Error {
  constructor(readonly code: PdfSignatureFailureCode) {
    super(code)
  }
}

/** Annotated so TypeScript narrows at every call site: a failure never returns. */
const fail: (code: PdfSignatureFailureCode) => never = (code) => {
  throw new SignatureFailure(code)
}

function capabilities() {
  const supported = typeof OffscreenCanvas !== 'undefined'
    && typeof createImageBitmap === 'function'
    && typeof structuredClone === 'function'

  return {
    supported,
    formats: supported ? ['application/pdf'] : [],
    /* The engines do the decryption themselves, so support stands or falls with them. */
    password: supported,
    ...(supported ? {} : { reason: 'unsupported_browser' }),
  }
}

/**
 * What pdf.js refused, in the tool's own vocabulary. A password problem is the
 * one the visitor can act on, so it is never folded into a damaged document.
 */
function classifyFailure(error: unknown): PdfSignatureFailureCode {
  if (error instanceof SignatureFailure) return error.code
  const name = error instanceof Error ? error.name : ''
  if (name === 'PasswordException') {
    /* 1 = a password is needed, 2 = the one supplied was wrong (`PasswordResponses`). */
    return (error as { code?: number }).code === 2 ? 'password_rejected' : 'password_required'
  }
  if (name === 'InvalidPDFException') return 'damaged_pdf'
  if (error instanceof RangeError || name === 'RangeError') return 'insufficient_memory'

  return 'damaged_pdf'
}

async function readReport(document_: OpenDocument['document']): Promise<PdfDocumentReport> {
  const { info } = await document_.getMetadata() as { info: { EncryptFilterName?: string | null } }
  const handler = info.EncryptFilterName ?? null
  /* Anything but the standard security handler is outside what T24 measured. */
  if (handler !== null && handler !== 'Standard') fail('unsupported_encryption')

  if (document_.numPages > pdfSignatureLimits.maxPages) fail('too_many_pages')

  const permissions = await document_.getPermissions()
  if (permissions !== null && !(permissions.has(MODIFY_CONTENTS) && permissions.has(MODIFY_ANNOTATIONS))) {
    fail('modification_not_permitted')
  }

  const pages: PdfPageReport[] = []
  for (let index = 0; index < document_.numPages; index += 1) {
    const page = await document_.getPage(index + 1)
    const [x0, y0, x1, y1] = page.view as [number, number, number, number]
    pages.push({ index, box: [x0, y0, x1, y1], rotation: page.rotate })
    page.cleanup()
  }

  return {
    pageCount: document_.numPages,
    encrypted: handler !== null,
    permissions: permissions === null ? null : [...permissions].sort((left, right) => left - right),
    pages,
  }
}

/**
 * The writer opens the document too, before the visitor places anything.
 *
 * §9.3 of the record puts this in the opening sequence on purpose: the two
 * engines do not accept exactly the same documents, and a document only the
 * preview engine can open would otherwise look fine until the export failed.
 * The writer's own document is dropped straight away — it is re-opened from the
 * original bytes for each export, so a repeated export can never stamp twice.
 */
async function confirmWriterCanOpen(bytes: Uint8Array, report: PdfDocumentReport, password: string | undefined) {
  try {
    await PDFDocument.load(bytes.slice(), {
      updateMetadata: false,
      /* pdf-lib refuses any document carrying `/Encrypt`, even with an empty user password. */
      ...(report.encrypted ? { password: password ?? '' } : {}),
    })
  }
  catch {
    fail(report.encrypted ? 'unsupported_encryption' : 'damaged_pdf')
  }
}

function closeOpenDocument() {
  const current = open
  open = undefined
  /* The loading task owns the parser; dropping the proxy alone would leave it holding the document. */
  void current?.task.destroy().catch(() => {})
}

async function openDocument(id: number, file: File, password: string | undefined) {
  closeOpenDocument()
  progress(id, 'read')
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (String.fromCharCode(...bytes.subarray(0, 5)) !== '%PDF-') fail('not_a_pdf')

  progress(id, 'parse')
  /* pdf.js takes ownership of the buffer it is given; the writer needs the original later. */
  const task = pdfjs.getDocument({ data: bytes.slice(), ...parserOptions(password) })
  const document_ = await task.promise
  const report = await readReport(document_)
  await confirmWriterCanOpen(bytes, report, password)
  open = { password, bytes, task, document: document_, report }

  send({ type: 'document', id, report })
}

async function renderPage(id: number, index: number, scale: number) {
  const current = open ?? fail('damaged_pdf')
  progress(id, 'preview', index + 1, current.report.pageCount)
  const page = await current.document.getPage(index + 1)
  const viewport = page.getViewport({ scale })
  const canvas = new OffscreenCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
  const context = canvas.getContext('2d', { willReadFrequently: false }) ?? fail('insufficient_memory')
  /* A PDF page is paper: what the document does not paint is white, not transparent. */
  context.fillStyle = 'white'
  context.fillRect(0, 0, canvas.width, canvas.height)
  /*
   * pdf.js takes the canvas from the context it is given, and types both as the
   * DOM pair. Off the main thread they are the offscreen pair instead, which the
   * library supports and its types do not describe.
   */
  const target = { canvasContext: context, viewport } as unknown as Parameters<typeof page.render>[0]
  await page.render(target).promise
  const blob = await canvas.convertToBlob({ type: 'image/png' })
  page.cleanup()
  canvas.width = canvas.height = 0
  const bytes = await blob.arrayBuffer()

  send({
    type: 'preview',
    id,
    report: { index, scale, width: viewport.width, height: viewport.height, bytes },
  }, [bytes])
}

/**
 * Draws the signatures and writes the document back.
 *
 * The bytes that were opened are re-read for every export, so a cancelled or
 * repeated export can never stamp the same page twice, and the pages nobody
 * signed keep the producer's own bytes.
 */
async function exportSigned(id: number, placements: SignatureExportRequest[], signatures: SignatureImagePayload[]) {
  const current = open ?? fail('damaged_pdf')
  if (!placements.length) fail('export_failed')

  const mode = pdfSignatureExportMode(current.report)
  progress(id, 'apply', 1, placements.length)

  let bytes: Uint8Array
  try {
    const pdf = await PDFDocument.load(current.bytes.slice(), {
      /* The visitor's own metadata is theirs; this tool adds no producer line of its own. */
      updateMetadata: false,
      forIncrementalUpdate: mode === 'incremental-update',
      ...(current.report.encrypted ? { password: current.password ?? '' } : {}),
    })

    const embedded = new Map<string, Awaited<ReturnType<typeof pdf.embedPng>>>()
    for (const signature of signatures) embedded.set(signature.id, await pdf.embedPng(signature.bytes))

    const pages = pdf.getPages()
    for (const [index, request] of placements.entries()) {
      progress(id, 'apply', index + 1, placements.length)
      const page = pages[request.page] ?? fail('export_failed')
      const image = embedded.get(request.signatureId) ?? fail('export_failed')

      const cropBox = page.getCropBox()
      const geometry = {
        box: [cropBox.x, cropBox.y, cropBox.x + cropBox.width, cropBox.y + cropBox.height] as const,
        rotation: page.getRotation().angle,
      }
      /* The two engines have to agree about the page the visitor pointed at. */
      const display = pdfDisplayBox(geometry)
      const expected = pdfDisplayBox(current.report.pages[request.page]!)
      if (Math.abs(display.width - expected.width) > 0.5 || Math.abs(display.height - expected.height) > 0.5) {
        fail('export_failed')
      }

      const placement = pdfSignaturePlacement(geometry, request.rect)
      page.drawImage(image, {
        x: placement.anchor.x,
        y: placement.anchor.y,
        width: placement.width,
        height: placement.height,
        rotate: degrees(placement.rotation),
      })
    }

    progress(id, 'write')
    bytes = mode === 'incremental-update'
      ? await pdf.commit({ useObjectStreams: false })
      : await pdf.save({ useObjectStreams: false, addDefaultPage: false })
  }
  catch (error) {
    throw error instanceof SignatureFailure ? error : new SignatureFailure('export_failed')
  }

  /*
   * The writer accepts documents it cannot reproduce — a truncated file exports
   * happily and opens nowhere — so the export is read back with the preview
   * engine before it is offered. A full rewrite of an encrypted document is no
   * longer encrypted, which is why the read-back needs no password.
   */
  let verifiedPageCount = current.report.pageCount
  if (pdfSignatureSelection.verifyExportBeforeDownload) {
    const verification = pdfjs.getDocument({ data: bytes.slice(), ...parserOptions(undefined) })
    try {
      const verified = await verification.promise
      if (verified.numPages !== current.report.pageCount) fail('export_unreadable')
      verifiedPageCount = verified.numPages
    }
    catch (error) {
      throw error instanceof SignatureFailure ? error : new SignatureFailure('export_unreadable')
    }
    finally {
      await verification.destroy().catch(() => {})
    }
  }

  const output = bytes.buffer.byteLength === bytes.byteLength
    ? bytes.buffer as ArrayBuffer
    : bytes.slice().buffer as ArrayBuffer

  send({
    type: 'export',
    id,
    report: {
      bytes: output,
      pageCount: verifiedPageCount,
      mode,
      decrypted: current.report.encrypted && mode === 'full-rewrite',
    },
  }, [output])
}

self.addEventListener('message', (event: MessageEvent<PdfSignatureRequest>) => {
  const request = event.data
  /* pdf.js talks over this same scope; anything without a request id is not ours. */
  if (typeof request?.id !== 'number') return

  void (async () => {
    try {
      if (request.type === 'capabilities') send({ type: 'capabilities', id: request.id, capabilities: capabilities() })
      else if (request.type === 'open') await openDocument(request.id, request.file, request.password)
      else if (request.type === 'preview') await renderPage(request.id, request.page, request.scale)
      else if (request.type === 'export') await exportSigned(request.id, request.placements, request.signatures)
    }
    catch (error) {
      send({
        type: 'failure',
        id: request.id,
        code: error instanceof SignatureFailure ? error.code : classifyFailure(error),
      })
    }
  })()
})
