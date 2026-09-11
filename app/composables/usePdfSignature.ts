import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { createPdfSignatureSession, type PdfSignatureSession } from '@/features/tools/pdf-signature/engine'
import {
  pdfSignatureLimits,
  type PdfSignatureStage,
} from '@/features/tools/pdf-signature/domain/reference'
import {
  canUndoPlacement,
  createPdfWorkspace,
  movePlacement,
  placeSignature,
  placementGeometry,
  placementSummary,
  placementsOnPage,
  removePlacement,
  resizePlacement,
  selectPlacement,
  setPlacementRect,
  signatureExportRequests,
  undoPlacement,
  type PdfWorkspaceState,
} from '@/features/tools/pdf-signature/domain/workspace'
import { pdfDisplayBox } from '@/features/tools/pdf-signature/domain/reference'
import { createLocalAssetRepository } from '@/features/shell/local-assets/repository'
import { openLocalAssetStore } from '@/features/shell/local-assets/indexeddb-store'
import { useLocalAssets } from './useLocalAssets'
import { useWorkspaceDirty } from './useWorkspaceDirty'
import type { PdfDocumentReport, PdfSignatureCapabilities } from '@/features/tools/pdf-signature/types'
import type { LocaleCode } from '@/features/tools/catalog'

/** One rasterised signature the visitor can place, saved or not. */
export interface SignatureAsset {
  id: string
  name: string
  /** A transparent PNG; the only form anything is ever embedded in. */
  bytes: ArrayBuffer
  width: number
  height: number
  url: string
  /** Set once it is also a local asset on this device. */
  savedId?: string
}

interface PagePreview {
  index: number
  url: string
  width: number
  height: number
}

/** Page previews are megabytes each; only the ones a visitor is moving between are kept. */
const PREVIEW_CACHE_SIZE = 8

/**
 * The whole signing session, from choosing a file to handing over the download.
 *
 * Nothing here touches a PDF: the worker does the parsing, rasterising and
 * writing, the domain module owns the placement arithmetic, and this composable
 * is the part that keeps them in step with what the visitor can see — which page
 * is showing, which signature is selected, what is still running, and what may
 * be downloaded. Every object URL it creates is revoked again, because a
 * signed 50 MiB document that outlives its tab is the visitor's memory, not ours.
 */
export function usePdfSignature(locale: () => LocaleCode) {
  const session: PdfSignatureSession = createPdfSignatureSession()
  const repository = createLocalAssetRepository(openLocalAssetStore)
  const local = useLocalAssets()

  const capabilities = shallowRef<PdfSignatureCapabilities>()
  const preparing = ref(true)
  const online = ref(true)

  const file = shallowRef<File>()
  const password = ref('')
  const passwordNeeded = ref(false)
  const report = shallowRef<PdfDocumentReport>()
  const workspace = shallowRef<PdfWorkspaceState>(createPdfWorkspace([]))
  const pageIndex = ref(0)
  const preview = shallowRef<PagePreview>()

  const signatures = shallowRef<SignatureAsset[]>([])
  const activeSignatureId = ref('')

  const busy = ref(false)
  const stage = ref<PdfSignatureStage | ''>('')
  const error = ref('')
  const message = ref<'opened' | 'cancelled' | 'exported' | 'signature-saved' | 'signature-removed' | ''>('')
  const output = ref('')
  const outputInfo = shallowRef<{ mode: string, decrypted: boolean, pageCount: number, bytes: number }>()

  const previews = new Map<number, PagePreview>()
  let generation = 0
  let mounted = true
  let signatureCount = 0

  const opened = computed(() => Boolean(report.value))
  const selected = computed(() => workspace.value.placements.find(placement => placement.id === workspace.value.selectedId))
  const geometry = computed(() => selected.value ? placementGeometry(workspace.value, selected.value.id) : undefined)
  const summary = computed(() => selected.value ? placementSummary(workspace.value, selected.value.id, locale()) : '')
  const pagePlacements = computed(() => placementsOnPage(workspace.value, pageIndex.value))
  const canUndo = computed(() => canUndoPlacement(workspace.value))
  const activeSignature = computed(() => signatures.value.find(signature => signature.id === activeSignatureId.value))
  const savedSignatures = computed(() => local.records.value.filter(record => record.kind === 'signature'))
  /** The widest page in the document decides how many pixels a signature is worth. */
  const maxPlacedWidthPt = computed(() => Math.max(
    595,
    ...workspace.value.pages.map(page => pdfDisplayBox(page).width),
  ))

  useWorkspaceDirty('pdf-signature', computed(() => Boolean(file.value) || busy.value))

  function revokePreviews() {
    for (const entry of previews.values()) URL.revokeObjectURL(entry.url)
    previews.clear()
    preview.value = undefined
  }

  function clearOutput() {
    if (output.value) URL.revokeObjectURL(output.value)
    output.value = ''
    outputInfo.value = undefined
  }

  /** Everything the open document brought with it, including its password. */
  function closeDocument() {
    revokePreviews()
    clearOutput()
    report.value = undefined
    workspace.value = createPdfWorkspace([])
    pageIndex.value = 0
    password.value = ''
    passwordNeeded.value = false
  }

  async function prepare() {
    preparing.value = true
    online.value = typeof navigator === 'undefined' || navigator.onLine !== false
    const value = await session.capabilities()
    if (!mounted) return
    capabilities.value = value
    preparing.value = false
  }

  /** Reads the page the visitor is looking at, reusing what is already drawn. */
  async function showPage(index: number) {
    if (!report.value || index < 0 || index >= report.value.pageCount) return
    pageIndex.value = index
    const cached = previews.get(index)
    if (cached) { preview.value = cached; return }
    if (busy.value) return

    const current = ++generation
    busy.value = true
    error.value = ''
    const outcome = await session.renderPage(index, pdfSignatureLimits.previewScale, { onProgress: value => { stage.value = value } })
    if (!mounted || current !== generation) return
    busy.value = false
    stage.value = ''
    if (outcome.status === 'error') { error.value = outcome.error.code; return }
    if (outcome.status === 'cancelled') return

    const entry: PagePreview = {
      index,
      url: URL.createObjectURL(outcome.output.blob),
      width: outcome.output.width,
      height: outcome.output.height,
    }
    previews.set(index, entry)
    if (previews.size > PREVIEW_CACHE_SIZE) {
      const [oldest] = previews.keys()
      if (oldest !== undefined && oldest !== index) {
        URL.revokeObjectURL(previews.get(oldest)!.url)
        previews.delete(oldest)
      }
    }
    if (pageIndex.value === index) preview.value = entry
  }

  /**
   * Opens the chosen document. A document that needs a password is not a
   * failure: the interface asks for one and tries again with it.
   */
  async function openDocument(withPassword?: string, { keepMessage = false } = {}) {
    const chosen = file.value
    if (!chosen || busy.value) return

    const current = ++generation
    closeDocument()
    busy.value = true
    error.value = ''
    if (!keepMessage) message.value = ''
    const outcome = await session.open(chosen, {
      password: withPassword,
      onProgress: value => { stage.value = value },
    })
    if (!mounted || current !== generation) return
    busy.value = false
    stage.value = ''

    if (outcome.status === 'cancelled') { message.value = 'cancelled'; return }
    if (outcome.status === 'error') {
      error.value = outcome.error.code
      passwordNeeded.value = outcome.error.code === 'password_required' || outcome.error.code === 'password_rejected'
      return
    }

    password.value = withPassword ?? ''
    passwordNeeded.value = false
    report.value = outcome.output
    workspace.value = createPdfWorkspace(outcome.output.pages)
    if (!keepMessage) message.value = 'opened'
    await showPage(0)
  }

  async function choose(files: File[]) {
    if (busy.value) return
    error.value = ''
    message.value = ''
    if (!files.length) return
    if (files.length !== 1) { error.value = 'multiple_files'; return }

    closeDocument()
    file.value = files[0]
    await openDocument()
  }

  /**
   * Re-opens the same bytes after a cancel, so the placements stay usable. The
   * visitor is told what they did, not what the workspace did about it: the
   * cancellation stays on screen even though the document was opened again.
   */
  async function reopen() {
    if (!file.value) return
    const keep = workspace.value
    const keepPage = pageIndex.value
    await openDocument(password.value || undefined, { keepMessage: true })
    if (!mounted || !report.value) return
    if (keep.placements.length && keep.pages.length === workspace.value.pages.length) {
      workspace.value = { ...keep, pages: workspace.value.pages }
      await showPage(keepPage)
    }
  }

  function addSignature(asset: Omit<SignatureAsset, 'id' | 'url'> & { id?: string }) {
    signatureCount += 1
    const id = asset.id ?? `signature-${signatureCount}`
    const entry: SignatureAsset = {
      ...asset,
      id,
      url: URL.createObjectURL(new Blob([asset.bytes], { type: 'image/png' })),
    }
    signatures.value = [...signatures.value.filter(signature => signature.id !== id), entry]
    activeSignatureId.value = id
    error.value = ''

    return entry
  }

  function dropSignature(id: string) {
    const entry = signatures.value.find(signature => signature.id === id)
    if (entry) URL.revokeObjectURL(entry.url)
    signatures.value = signatures.value.filter(signature => signature.id !== id)
    /* A placement without its signature cannot be exported, so it goes too. */
    for (const placement of workspace.value.placements.filter(placement => placement.signatureId === id)) {
      workspace.value = removePlacement(workspace.value, placement.id)
    }
    if (activeSignatureId.value === id) activeSignatureId.value = signatures.value.at(-1)?.id ?? ''
  }

  /** Keeps the signature on this device, only because the visitor asked. */
  async function saveSignature(id: string, name: string) {
    const entry = signatures.value.find(signature => signature.id === id)
    if (!entry) return
    const result = await repository.save({
      kind: 'signature',
      name,
      payload: { format: 'binary', mediaType: 'image/png', bytes: new Uint8Array(entry.bytes.slice(0)) },
    })
    if (!mounted) return
    if (!result.ok) { error.value = `storage_${result.code}`; return }

    signatures.value = signatures.value.map(signature => signature.id === id
      ? { ...signature, name, savedId: result.value.records.find(record => record.name === name && record.kind === 'signature')?.id }
      : signature)
    message.value = 'signature-saved'
    await local.refresh()
  }

  /**
   * Brings a signature saved on this device back into the session. Its pixels
   * are read from the device store, never re-downloaded, and its size is taken
   * from the image itself so a placement keeps the proportions it was saved in.
   */
  async function useSavedSignature(id: string) {
    const record = local.records.value.find(candidate => candidate.id === id)
    if (!record || record.payload.format !== 'binary') return
    try {
      const bytes = record.payload.bytes.slice().buffer as ArrayBuffer
      const bitmap = await createImageBitmap(new Blob([bytes], { type: record.payload.mediaType }))
      if (!mounted) { bitmap.close(); return }
      addSignature({ name: record.name, bytes, width: bitmap.width, height: bitmap.height, savedId: record.id })
      bitmap.close()
      if (report.value) place()
    }
    catch {
      error.value = 'signature_unreadable'
    }
  }

  async function forgetSavedSignature(id: string) {
    if (await local.remove(id)) message.value = 'signature-removed'
  }

  function place() {
    const signature = activeSignature.value
    if (!signature || !report.value) return
    workspace.value = placeSignature(workspace.value, {
      id: `placement-${workspace.value.placements.length + 1}-${pageIndex.value}`,
      page: pageIndex.value,
      signature,
    })
    clearOutput()
  }

  function update(change: (state: PdfWorkspaceState) => PdfWorkspaceState) {
    workspace.value = change(workspace.value)
    clearOutput()
  }

  async function exportSigned() {
    if (!report.value || busy.value || !workspace.value.placements.length) return
    const current = ++generation
    busy.value = true
    error.value = ''
    message.value = ''
    clearOutput()

    const used = new Set(workspace.value.placements.map(placement => placement.signatureId))
    const outcome = await session.exportSigned(
      signatureExportRequests(workspace.value),
      signatures.value
        .filter(signature => used.has(signature.id))
        .map(signature => ({ id: signature.id, bytes: signature.bytes.slice(0) })),
      { onProgress: value => { stage.value = value } },
    )
    if (!mounted || current !== generation) return
    busy.value = false
    stage.value = ''

    if (outcome.status === 'cancelled') { message.value = 'cancelled'; void reopen(); return }
    if (outcome.status === 'error') { error.value = outcome.error.code; return }

    try {
      output.value = URL.createObjectURL(outcome.output.blob)
      outputInfo.value = {
        mode: outcome.output.mode,
        decrypted: outcome.output.decrypted,
        pageCount: outcome.output.pageCount,
        bytes: outcome.output.blob.size,
      }
      message.value = 'exported'
    }
    catch {
      clearOutput()
      error.value = 'insufficient_memory'
    }
  }

  function cancel() {
    generation += 1
    session.cancel()
    busy.value = false
    stage.value = ''
    message.value = 'cancelled'
    if (report.value) void reopen()
  }

  function reset() {
    generation += 1
    session.cancel()
    busy.value = false
    stage.value = ''
    error.value = ''
    message.value = ''
    closeDocument()
    file.value = undefined
  }

  onMounted(prepare)
  onBeforeUnmount(() => {
    mounted = false
    generation += 1
    session.dispose()
    revokePreviews()
    clearOutput()
    for (const signature of signatures.value) URL.revokeObjectURL(signature.url)
    signatures.value = []
    file.value = undefined
  })

  return {
    capabilities,
    preparing,
    online,
    file,
    password,
    passwordNeeded,
    report,
    opened,
    workspace,
    pageIndex,
    preview,
    pagePlacements,
    selected,
    geometry,
    summary,
    canUndo,
    signatures,
    activeSignature,
    activeSignatureId,
    savedSignatures,
    maxPlacedWidthPt,
    busy,
    stage,
    error,
    message,
    output,
    outputInfo,
    localError: local.error,
    localUsage: local.usage,

    prepare,
    choose,
    openDocument,
    showPage,
    addSignature,
    dropSignature,
    saveSignature,
    useSavedSignature,
    forgetSavedSignature,
    place,
    select: (id: string) => update(state => selectPlacement(state, id)),
    move: (delta: { x: number, y: number }) => update(state => selected.value ? movePlacement(state, selected.value.id, delta) : state),
    resize: (factor: number) => update(state => selected.value ? resizePlacement(state, selected.value.id, factor) : state),
    setRect: (rect: { leftPt: number, topPt: number, widthPt: number }) => update(state => selected.value ? setPlacementRect(state, selected.value.id, rect) : state),
    remove: () => update(state => selected.value ? removePlacement(state, selected.value.id) : state),
    undo: () => update(undoPlacement),
    exportSigned,
    cancel,
    reset,
  }
}
