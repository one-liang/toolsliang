<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import {
  Check, ChevronLeft, ChevronRight, Download, FileText, ImagePlus, PenLine, Trash2, TriangleAlert, Type, Undo2, X,
} from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import SignaturePad from '@/components/SignaturePad.vue'
import { isSignatureInputErrorCode, pdfSignatureErrors, pdfSignatureStageLabels, signatureInputErrors } from '@/features/tools/pdf-signature/content'
import { pdfSignatureDisclosures } from '@/features/tools/pdf-signature/domain/reference'
import { nudgeStepPt, placementCorners, type PlacementCorner } from '@/features/tools/pdf-signature/domain/workspace'
import { importSignatureImage, type CreatedSignature } from '@/features/tools/pdf-signature/signature-image'
import type { NormalizedRect } from '@/features/tools/pdf-signature/domain/reference'
import { localAssetErrorMessage } from '@/features/shell/local-assets/content'
import { formatStoredSize } from '@/features/shell/local-assets/usage'
import { usePdfSignature } from '@/composables/usePdfSignature'
import type { LocalAssetErrorCode } from '@/features/shell/local-assets/repository'

/**
 * The signing workspace, on one screen: the page in the middle, the visitor's
 * signatures beside it, and the download under them.
 *
 * Signing is direct manipulation. A signature in the list is placed on the page
 * being shown with one press; it is then dragged (or its corner pulled) on the
 * page itself, or moved with the arrow and plus/minus keys once focused, while a
 * spoken summary carries the numbers, because a rectangle on a canvas is the one
 * thing a screen reader cannot read. Signatures saved on this device come first
 * and are there before any document is open; a new one goes straight into the
 * list, and onto the page when there is one.
 */
const { locale, withLocale } = useAppLocale()
const en = computed(() => locale.value === 'en')

/* Destructured so the template reads the state directly, as the other workspaces do. */
const {
  limits, capabilities, preparing, online, passwordNeeded, report, opened, workspace, pageIndex,
  preview, pagePlacements, selected, geometry, summary, canUndo, signatures, savedSignatures, savedThumbnails,
  sessionSignatures, maxPlacedWidthPt, busy, stage, error, message, placedOn, output, outputInfo,
  prepare, choose, openDocument, showPage, addSignature, dropSignature, saveSignature,
  useSavedSignature, placeSignature, place, select, move, drag: dragTo, resize, resizeFromCorner, remove, undo,
  exportSigned, cancel, reset,
} = usePdfSignature(() => locale.value)
const layout = ref<HTMLElement>()
const stageElement = ref<HTMLElement>()
const pageImage = ref<HTMLImageElement>()
const passwordInput = ref<HTMLInputElement>()
const imageInput = ref<HTMLInputElement>()
const passwordDraft = ref('')
const dragging = ref(false)
const importing = ref(false)
/** Which signature is being drawn or typed; the dialog is open while this is set. */
const creating = ref<'drawn' | 'typed'>()
/** Where focus goes once the dialog has closed: the new placement, or the button that opened it. */
let focusAfterCreating: (() => void) | undefined
/**
 * One pointer gesture on a placement: moving the whole signature, or pulling
 * one of its corners. Both are measured from where the gesture began, so undo
 * takes it back in one step and the signature stays under the pointer.
 */
let gesture: { id: string, corner?: PlacementCorner, origin: NormalizedRect, x: number, y: number, moved: boolean, pointerId: number } | undefined

const errorText = computed(() => {
  const code = error.value
  if (!code) return ''
  if (code.startsWith('storage_')) {
    const message = localAssetErrorMessage(code.slice('storage_'.length) as LocalAssetErrorCode, locale.value)
    return `${message.title}。${message.recovery}`
  }
  if (isSignatureInputErrorCode(code)) return signatureInputErrors[code][locale.value]
  /* An engine that will not start offline is not an unsupported browser. */
  if (code === 'unsupported_browser' && !online.value) {
    return en.value
      ? 'The local PDF engine has not been stored on this device yet. Reconnect once to fetch it; after that this tool works offline.'
      : '本機 PDF 引擎還沒有存到這台裝置上。請連線一次取得引擎，之後就能離線使用。'
  }
  return pdfSignatureErrors[code as keyof typeof pdfSignatureErrors]?.[locale.value] ?? ''
})

const status = computed(() => {
  if (busy.value && stage.value) {
    const { stage: name, page, total } = stage.value
    const label = pdfSignatureStageLabels[name][locale.value]
    if (page === undefined) return label
    /* The two stages that count are counting different things. */
    if (name === 'preview') return en.value ? `${label} (page ${page} of ${total})` : `${label}（第 ${page} 頁，共 ${total} 頁）`
    return en.value ? `${label} (${page} of ${total})` : `${label}（第 ${page} 個，共 ${total} 個）`
  }
  if (preparing.value) return en.value ? 'Checking local PDF support…' : '正在檢查本機 PDF 支援…'
  if (message.value === 'cancelled') return en.value ? 'Cancelled. Your file is unchanged and your placements are kept.' : '已取消。原檔未變更，已放置的簽名仍保留。'
  if (message.value === 'signature-saved') return en.value ? 'Signature saved on this device.' : '簽名已保存在這台裝置。'
  if (message.value === 'signature-placed') return en.value ? `Placed on page ${placedOn.value + 1}.` : `已放到第 ${placedOn.value + 1} 頁。`
  if (message.value === 'exported') return en.value ? 'Done. Check the signature on the page, then download.' : '已完成。請確認頁面上的簽名後再下載。'
  if (message.value === 'opened' && report.value) {
    return en.value
      ? `Opened: ${report.value.pageCount} pages.`
      : `已開啟：共 ${report.value.pageCount} 頁。`
  }
  return ''
})

const pageNumbers = computed(() => Array.from({ length: report.value?.pageCount ?? 0 }, (_, index) => index))
const hasSignatures = computed(() => savedThumbnails.value.length + sessionSignatures.value.length > 0)
const savedBytes = computed(() => savedSignatures.value.reduce((total, record) => total + record.bytes, 0))
/** The one line above the list: what a press on a signature will do right now. */
const listHint = computed(() => {
  if (!hasSignatures.value) return ''
  if (!opened.value) return en.value ? 'Open a PDF, then select a signature to place it.' : '開啟 PDF 後，點一下簽名就能放到頁面上。'
  return en.value ? `Select a signature to place it on page ${pageIndex.value + 1}.` : `點一下簽名，放到第 ${pageIndex.value + 1} 頁。`
})

/** CSS pixels per point, so a pointer drag can be expressed in the page's own units. */
function pointScale() {
  const rect = pageImage.value?.getBoundingClientRect()
  const display = geometry.value?.display.width ?? preview.value?.width
  if (!rect?.width || !display) return 1
  return rect.width / display
}

/**
 * Once a document is open the workspace is the task, so it comes up under the
 * page header and the page navigation takes the focus the file picker had —
 * the picker itself is gone, and focus must not fall back to the top of the page.
 * Focus the visitor has already put somewhere else, such as a signature dialog,
 * stays where it is.
 */
async function revealWorkspace() {
  if (!opened.value) return
  await nextTick()
  const active = document.activeElement
  if (!active || active === document.body || active.id === 'pdf-signature-file') {
    document.getElementById('pdf-signature-page')?.focus({ preventScroll: true })
  }
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  layout.value?.closest('.pdf-signature')?.scrollIntoView({ block: 'start', behavior: reduced ? 'instant' : 'smooth' })
}

async function chooseFiles(files: File[]) {
  dragging.value = false
  await choose(files)
  await revealWorkspace()
}

function chooseFile(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  void chooseFiles(files)
}

function dropFiles(event: DragEvent) {
  dragging.value = false
  if (opened.value || busy.value) return
  void chooseFiles(Array.from(event.dataTransfer?.files ?? []))
}

function leaveStage(event: DragEvent) {
  if (!stageElement.value?.contains(event.relatedTarget as Node | null)) dragging.value = false
}

async function unlock() {
  await openDocument(passwordDraft.value)
  if (passwordNeeded.value) {
    await nextTick()
    passwordInput.value?.focus()
    return
  }
  passwordDraft.value = ''
  await revealWorkspace()
}

async function closeDocument() {
  reset()
  await nextTick()
  document.getElementById('pdf-signature-file')?.focus()
}

/** Moves focus onto a placement just made, so the arrow keys work on it straight away. */
async function focusPlacement(id: string | undefined) {
  if (!id) return
  await nextTick()
  stageElement.value?.querySelector<HTMLElement>(`[data-placement="${id}"]`)?.focus({ preventScroll: true })
}

async function placeSaved(id: string) {
  await focusPlacement(await useSavedSignature(id))
}

/** Adds a finished signature to the list, and onto the page being shown when there is one. */
function addToList(signature: CreatedSignature) {
  addSignature(signature)
  return opened.value ? place() : undefined
}

function startCreating(form: 'drawn' | 'typed', event: Event) {
  const trigger = event.currentTarget as HTMLElement | null
  focusAfterCreating = () => trigger?.focus()
  error.value = ''
  creating.value = form
}

function created(signature: CreatedSignature) {
  const placement = addToList(signature)
  if (placement) focusAfterCreating = () => void focusPlacement(placement)
  creating.value = undefined
}

/** The dialog starts where the visitor's hand goes: the text field, or the pad's own title. */
function focusCreator(event: Event) {
  event.preventDefault()
  void nextTick(() => {
    const target = creating.value === 'typed' ? 'signature-typed' : 'signature-dialog-title'
    document.getElementById(target)?.focus()
  })
}

function returnFocus(event: Event) {
  event.preventDefault()
  focusAfterCreating?.()
  focusAfterCreating = undefined
}

/** An imported picture needs no confirming: choosing the file adds it. */
async function importImage(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (!files.length) return
  importing.value = true
  error.value = ''
  const result = await importSignatureImage(files, {
    maxPlacedWidthPt: maxPlacedWidthPt.value,
    name: en.value ? 'Imported signature' : '匯入的簽名',
  })
  importing.value = false
  if (!result.ok) {
    error.value = result.code
    imageInput.value?.focus()
    return
  }
  await focusPlacement(addToList(result.signature))
}

/**
 * Saving moves the signature up among the saved ones, so focus follows it there:
 * to its button when there is a page to place it on, or to the row itself.
 */
async function save(id: string) {
  const savedId = await saveSignature(id)
  if (!savedId) return
  await nextTick()
  const row = layout.value?.querySelector<HTMLElement>(`[data-saved-signature="${savedId}"]`)
  ;(row?.querySelector<HTMLElement>('button.pdf-signature__thumb') ?? row)?.focus()
}

function startGesture(event: PointerEvent, id: string, corner?: PlacementCorner) {
  if (event.button !== 0 || busy.value) return
  const target = (event.currentTarget as HTMLElement).closest<HTMLElement>('.pdf-signature__placement')
  const placement = workspace.value.placements.find(candidate => candidate.id === id)
  if (!target || !placement) return
  /* Without this the browser starts dragging the signature image itself and
   * cancels the pointer after the first movement: the drag that would not move. */
  event.preventDefault()
  target.focus({ preventScroll: true })
  select(id)
  gesture = { id, corner, origin: { ...placement.rect }, x: event.clientX, y: event.clientY, moved: false, pointerId: event.pointerId }
  /* Capture keeps the gesture alive outside the page image; a pointer the
   * browser no longer tracks refuses it, and the gesture is fine without it. */
  try { target.setPointerCapture(event.pointerId) }
  catch { /* the gesture continues without capture */ }
}

function continueGesture(event: PointerEvent) {
  if (!gesture || event.pointerId !== gesture.pointerId) return
  const scale = pointScale()
  const delta = { x: (event.clientX - gesture.x) / scale, y: (event.clientY - gesture.y) / scale }
  if (!gesture.moved && Math.hypot(delta.x, delta.y) * scale < 1) return
  /* Undo has to take the signature back to where the gesture began, not back
   * one pointer sample, so everything after the first movement continues the step. */
  if (gesture.corner) resizeFromCorner(gesture.corner, gesture.origin, delta, { continuing: gesture.moved })
  else dragTo(gesture.origin, delta, { continuing: gesture.moved })
  gesture.moved = true
}

function endGesture(event: PointerEvent) {
  if (gesture && event.pointerId === gesture.pointerId) gesture = undefined
}

/** The keyboard equivalent of dragging and resizing, on the placement itself. */
function keyPlacement(event: KeyboardEvent) {
  const step = event.shiftKey ? nudgeStepPt.coarse : nudgeStepPt.fine
  const moves: Record<string, { x: number, y: number }> = {
    ArrowLeft: { x: -step, y: 0 },
    ArrowRight: { x: step, y: 0 },
    ArrowUp: { x: 0, y: -step },
    ArrowDown: { x: 0, y: step },
  }
  if (moves[event.key]) { event.preventDefault(); move(moves[event.key]!); return }
  if (event.key === '+' || event.key === '=') { event.preventDefault(); resize(1.1); return }
  if (event.key === '-' || event.key === '_') { event.preventDefault(); resize(1 / 1.1); return }
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); remove() }
}

/** The ceiling this device actually enforces, which is the number the visitor is told. */
const maxMegabytes = computed(() => Math.floor(limits.maxBytes / 1024 / 1024))
</script>

<template>
  <Card class="tool-workspace pdf-signature" :class="{ 'pdf-signature--open': opened }">
    <div ref="layout" class="pdf-signature__layout">
      <section class="pdf-signature__main" :aria-label="en ? 'Document' : '文件'">
        <div v-if="opened && report" class="pdf-signature__toolbar">
          <div class="pdf-signature__pager">
            <Button
              type="button"
              variant="outline"
              size="icon"
              :aria-label="en ? 'Previous page' : '上一頁'"
              :disabled="pageIndex === 0 || busy"
              @click="showPage(pageIndex - 1)"
            >
              <ChevronLeft :size="20" aria-hidden="true" />
            </Button>
            <label for="pdf-signature-page" class="sr-only">
              {{ en ? `Page, of ${report.pageCount}` : `頁次，共 ${report.pageCount} 頁` }}
            </label>
            <select
              id="pdf-signature-page"
              class="ui-input pdf-signature__page-select"
              :value="pageIndex"
              :disabled="busy"
              @change="showPage(Number(($event.target as HTMLSelectElement).value))"
            >
              <option v-for="index in pageNumbers" :key="index" :value="index">{{ index + 1 }} / {{ report.pageCount }}</option>
            </select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              :aria-label="en ? 'Next page' : '下一頁'"
              :disabled="pageIndex >= report.pageCount - 1 || busy"
              @click="showPage(pageIndex + 1)"
            >
              <ChevronRight :size="20" aria-hidden="true" />
            </Button>
          </div>
          <!-- Undo has to outlive the selection: the step most worth undoing is a delete. -->
          <div class="pdf-signature__edit">
            <Button type="button" variant="outline" :disabled="!canUndo || busy" @click="undo()">
              <Undo2 :size="18" aria-hidden="true" /><span class="pdf-signature__tool-label">{{ en ? 'Undo' : '復原' }}</span>
            </Button>
            <Button type="button" variant="outline" :disabled="!selected || busy" @click="remove()">
              <Trash2 :size="18" aria-hidden="true" /><span class="pdf-signature__tool-label">{{ en ? 'Delete' : '刪除' }}</span>
            </Button>
          </div>
        </div>

        <div
          ref="stageElement"
          class="pdf-signature__stage"
          :class="{ 'pdf-signature__stage--dragging': dragging, 'pdf-signature__stage--busy': busy }"
          :aria-busy="busy"
          @dragenter.prevent="dragging = !opened"
          @dragover.prevent
          @dragleave="leaveStage"
          @drop.prevent="dropFiles"
        >
          <div v-if="opened && preview" class="pdf-signature__canvas" data-page-preview>
            <img
              ref="pageImage"
              :src="preview.url"
              :alt="en ? `Preview of page ${pageIndex + 1}` : `第 ${pageIndex + 1} 頁的預覽`"
              :width="preview.width"
              :height="preview.height"
              draggable="false"
            >
            <button
              v-for="placement in pagePlacements"
              :key="placement.id"
              type="button"
              class="pdf-signature__placement"
              :class="{ 'pdf-signature__placement--selected': placement.id === workspace.selectedId }"
              :data-placement="placement.id"
              :style="{
                left: `${placement.rect.x * 100}%`,
                top: `${placement.rect.y * 100}%`,
                width: `${placement.rect.width * 100}%`,
                height: `${placement.rect.height * 100}%`,
              }"
              :aria-pressed="placement.id === workspace.selectedId"
              :aria-label="en
                ? `Placed signature. Drag it to move it, drag a corner to resize it. Arrow keys move it, plus and minus resize it, Delete removes it.`
                : '已放置的簽名。拖曳可移動、拖曳四角可縮放；方向鍵移動、加減號縮放、Delete 刪除。'"
              @pointerdown="startGesture($event, placement.id)"
              @pointermove="continueGesture"
              @pointerup="endGesture"
              @pointercancel="endGesture"
              @lostpointercapture="endGesture"
              @dragstart.prevent
              @keydown="keyPlacement"
              @focus="select(placement.id)"
            >
              <img :src="signatures.find(asset => asset.id === placement.signatureId)?.url" alt="" aria-hidden="true" draggable="false">
              <template v-if="placement.id === workspace.selectedId">
                <span
                  v-for="corner in placementCorners"
                  :key="corner"
                  class="pdf-signature__handle"
                  :class="`pdf-signature__handle--${corner}`"
                  :data-corner="corner"
                  aria-hidden="true"
                  @pointerdown.stop="startGesture($event, placement.id, corner)"
                />
              </template>
            </button>
          </div>

          <template v-else-if="!opened">
            <div v-if="capabilities && !capabilities.supported" class="capability-warning pdf-signature__capability">
              <p>{{ pdfSignatureErrors.unsupported_browser[locale] }}</p>
              <Button variant="outline" @click="prepare()">{{ en ? 'Check again' : '重新檢查' }}</Button>
            </div>

            <form v-if="passwordNeeded" class="pdf-signature__password" @submit.prevent="unlock">
              <div class="field-group">
                <label for="pdf-signature-password">{{ en ? 'Open password' : '開啟密碼' }}</label>
                <input
                  id="pdf-signature-password"
                  ref="passwordInput"
                  v-model="passwordDraft"
                  class="ui-input"
                  type="password"
                  autocomplete="off"
                  :disabled="busy"
                  aria-describedby="pdf-signature-password-help"
                >
                <p id="pdf-signature-password-help" class="field-help">{{ pdfSignatureDisclosures['password-stays-on-device'][locale] }}</p>
              </div>
              <Button type="submit" :disabled="busy">{{ en ? 'Open with password' : '用密碼開啟' }}</Button>
            </form>

            <div class="pdf-signature__picker" :class="{ 'pdf-signature__picker--quiet': passwordNeeded }">
              <FileText v-if="!passwordNeeded" :size="32" aria-hidden="true" />
              <input
                id="pdf-signature-file"
                class="sr-only pdf-signature__file"
                type="file"
                accept="application/pdf,.pdf"
                :disabled="busy"
                aria-describedby="pdf-signature-limits pdf-signature-error"
                :aria-invalid="Boolean(errorText)"
                @change="chooseFile"
              >
              <label
                for="pdf-signature-file"
                class="ui-button pdf-signature__file-label"
                :class="passwordNeeded ? 'ui-button--ghost' : 'ui-button--default ui-button--size-lg'"
              >
                {{ passwordNeeded ? (en ? 'Choose another PDF' : '改選其他 PDF') : (en ? 'Choose a PDF' : '選擇 PDF 檔') }}
              </label>
              <p id="pdf-signature-limits" class="field-help">
                {{ en
                  ? `Up to ${limits.maxPages} pages and ${maxMegabytes} MiB on this device. You can also drop it here.`
                  : `最多 ${limits.maxPages} 頁、${maxMegabytes} MiB，也可以把檔案拖曳到這裡。` }}
              </p>
            </div>
          </template>
        </div>
        <p role="status" class="sr-only" data-placement-summary>{{ summary }}</p>
      </section>

      <section class="pdf-signature__side" :aria-label="en ? 'Signatures and download' : '簽名與下載'">
        <div class="pdf-signature__tray">
          <h2 class="pdf-signature__heading">{{ en ? 'Signatures' : '簽名' }}</h2>
          <p v-if="listHint" class="pdf-signature__hint">{{ listHint }}</p>

          <ul v-if="hasSignatures" class="pdf-signature__list" :aria-label="en ? 'Your signatures' : '你的簽名'">
            <li v-for="record in savedThumbnails" :key="record.id" class="pdf-signature__item" :data-saved-signature="record.id" tabindex="-1">
              <button
                v-if="opened"
                type="button"
                class="pdf-signature__thumb"
                :disabled="busy"
                :aria-label="en ? `Place on page ${pageIndex + 1}: ${record.name}` : `放到第 ${pageIndex + 1} 頁：${record.name}`"
                @click="placeSaved(record.id)"
              >
                <img :src="record.url" alt="" draggable="false">
              </button>
              <span v-else class="pdf-signature__thumb">
                <img :src="record.url" :alt="record.name" draggable="false">
              </span>
              <span class="pdf-signature__saved-mark">
                <Check :size="16" aria-hidden="true" />{{ en ? 'Saved' : '已保存' }}
              </span>
            </li>
            <li v-for="asset in sessionSignatures" :key="asset.id" class="pdf-signature__item" data-session-signature>
              <button
                v-if="opened"
                type="button"
                class="pdf-signature__thumb"
                :disabled="busy"
                :aria-label="en ? `Place on page ${pageIndex + 1}: ${asset.name}` : `放到第 ${pageIndex + 1} 頁：${asset.name}`"
                @click="focusPlacement(placeSignature(asset.id))"
              >
                <img :src="asset.url" alt="" draggable="false">
              </button>
              <span v-else class="pdf-signature__thumb">
                <img :src="asset.url" :alt="asset.name" draggable="false">
              </span>
              <Button
                type="button"
                variant="outline"
                class="pdf-signature__save"
                :aria-label="en ? `Save ${asset.name} on this device` : `保存「${asset.name}」在這台裝置`"
                data-signature-save
                @click="save(asset.id)"
              >
                {{ en ? 'Save' : '保存' }}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                :aria-label="en ? `Remove ${asset.name}` : `移除「${asset.name}」`"
                @click="dropSignature(asset.id)"
              >
                <X :size="18" aria-hidden="true" />
              </Button>
            </li>
          </ul>

          <p v-if="savedThumbnails.length" class="pdf-signature__storage">
            {{ en ? 'Saved on this device' : '保存在這台裝置' }} · {{ formatStoredSize(savedBytes, locale) }} ·
            <NuxtLink :to="withLocale('/storage/')">{{ en ? 'Manage' : '管理' }}</NuxtLink>
          </p>

          <div class="pdf-signature__create" role="group" aria-labelledby="pdf-signature-create-title">
            <p id="pdf-signature-create-title" class="pdf-signature__create-title">{{ en ? 'New signature' : '新增簽名' }}</p>
            <div class="pdf-signature__create-actions">
              <Button type="button" variant="outline" :disabled="busy" @click="startCreating('drawn', $event)">
                <PenLine :size="18" aria-hidden="true" />{{ en ? 'Draw' : '手寫' }}
              </Button>
              <Button type="button" variant="outline" :disabled="busy" @click="startCreating('typed', $event)">
                <Type :size="18" aria-hidden="true" />{{ en ? 'Type' : '文字' }}
              </Button>
              <input
                id="signature-image"
                ref="imageInput"
                class="sr-only pdf-signature__file"
                type="file"
                accept="image/png,image/webp,.png,.webp"
                :disabled="busy || importing"
                :aria-label="en ? 'Image: add a signature from a transparent PNG or WebP' : '圖片：用透明背景的 PNG 或 WebP 新增簽名'"
                @change="importImage"
              >
              <label for="signature-image" class="ui-button ui-button--outline pdf-signature__file-label">
                <ImagePlus :size="18" aria-hidden="true" />{{ en ? 'Image' : '圖片' }}
              </label>
            </div>
          </div>
        </div>

        <div class="pdf-signature__footer">
          <template v-if="opened && report">
            <p class="pdf-signature__note">{{ pdfSignatureDisclosures['original-pages-untouched'][locale] }}</p>
            <!-- A full rewrite drops the document's own password, so this is said before the download exists. -->
            <p v-if="report.encrypted" class="pdf-signature__warning" data-decrypted-notice>
              {{ pdfSignatureDisclosures['decrypted-export'][locale] }}
            </p>
          </template>
          <p id="pdf-signature-error" role="alert" class="field-error">
            <TriangleAlert v-if="errorText" :size="18" aria-hidden="true" />{{ errorText }}
          </p>
          <p role="status" class="pdf-signature__status">{{ status }}</p>

          <Button v-if="busy" type="button" variant="outline" class="pdf-signature__primary" @click="cancel()">
            <X :size="18" aria-hidden="true" />{{ en ? 'Cancel' : '取消' }}
          </Button>
          <template v-else-if="opened && report">
            <template v-if="output && outputInfo">
              <p class="pdf-signature__export-summary" data-export-summary>
                {{ en
                  ? `${outputInfo.pageCount} pages · ${formatStoredSize(outputInfo.bytes, locale)}`
                  : `共 ${outputInfo.pageCount} 頁 · ${formatStoredSize(outputInfo.bytes, locale)}` }}
              </p>
              <Button as-child class="pdf-signature__primary">
                <a :href="output" download="signed.pdf">
                  <Download :size="18" aria-hidden="true" />{{ en ? 'Download the signed PDF' : '下載已簽名的 PDF' }}
                </a>
              </Button>
            </template>
            <Button
              v-else
              type="button"
              class="pdf-signature__primary"
              :disabled="!workspace.placements.length"
              data-export
              @click="exportSigned()"
            >
              {{ en ? 'Sign and prepare the download' : '加上簽名並準備下載' }}
            </Button>
            <Button type="button" variant="ghost" class="pdf-signature__close" @click="closeDocument()">
              {{ en ? 'Choose another PDF' : '換一份 PDF' }}
            </Button>
          </template>
        </div>
      </section>
    </div>

    <DialogRoot :open="Boolean(creating)" @update:open="open => { if (!open) creating = undefined }">
      <DialogPortal>
        <DialogOverlay class="signature-dialog__overlay" />
        <DialogContent class="signature-dialog" :aria-describedby="undefined" @open-auto-focus="focusCreator" @close-auto-focus="returnFocus">
          <DialogTitle id="signature-dialog-title" class="signature-dialog__title" tabindex="-1">
            {{ creating === 'typed' ? (en ? 'Type a signature' : '用文字建立簽名') : (en ? 'Draw a signature' : '手寫簽名') }}
          </DialogTitle>
          <SignaturePad
            v-if="creating"
            :key="creating"
            :form="creating"
            :locale="locale"
            :max-placed-width-pt="maxPlacedWidthPt"
            :disabled="busy"
            @created="created"
            @cancel="creating = undefined"
          />
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </Card>
</template>
