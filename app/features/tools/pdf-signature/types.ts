import type { PdfSignatureFailureCode, PdfSignatureStage } from './domain/reference'
import type { SignatureExportRequest } from './domain/workspace'
import type { EngineCapabilities } from '../engine/contract'

/** One page, as the worker reports it: the visible box and the page's own turn. */
export interface PdfPageReport {
  index: number
  box: [number, number, number, number]
  rotation: number
}

/**
 * What the tool learned by opening the document, and nothing more. No title, no
 * author, no text: a summary that could not identify the file it came from.
 */
export interface PdfDocumentReport {
  pageCount: number
  /** Whether the document carried its own protection, and therefore how it has to be written back. */
  encrypted: boolean
  /** The permission bits the document sets, or null when it sets none at all. */
  permissions: number[] | null
  pages: PdfPageReport[]
}

/** A rasterised page, as PNG bytes the page turns into one object URL. */
export interface PdfPagePreviewReport {
  index: number
  scale: number
  width: number
  height: number
  bytes: ArrayBuffer
}

export interface PdfExportReport {
  bytes: ArrayBuffer
  /** Read back from the exported file itself, not carried over from the input. */
  pageCount: number
  mode: 'incremental-update' | 'full-rewrite'
  /** True when the export no longer carries the document's own password. */
  decrypted: boolean
}

/** Password support is declared on its own, before any document is chosen. */
export interface PdfSignatureCapabilities extends EngineCapabilities {
  password: boolean
}

/** One rasterised signature, keyed by the id its placements refer to. */
export interface SignatureImagePayload {
  id: string
  bytes: ArrayBuffer
}

export type PdfSignatureRequest =
  | { type: 'capabilities', id: number }
  | { type: 'open', id: number, file: File, password: string | undefined }
  | { type: 'preview', id: number, page: number, scale: number }
  | { type: 'export', id: number, placements: SignatureExportRequest[], signatures: SignatureImagePayload[] }

export type PdfSignatureReply =
  | { type: 'capabilities', id: number, capabilities: PdfSignatureCapabilities }
  | { type: 'progress', id: number, stage: PdfSignatureStage }
  | { type: 'document', id: number, report: PdfDocumentReport }
  | { type: 'preview', id: number, report: PdfPagePreviewReport }
  | { type: 'export', id: number, report: PdfExportReport }
  | { type: 'failure', id: number, code: PdfSignatureFailureCode }
