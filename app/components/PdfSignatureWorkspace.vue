<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Download, FileText, Save, TriangleAlert, Trash2, Undo2, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import SignaturePad from '@/components/SignaturePad.vue'
import { pdfSignatureErrors, pdfSignatureStageLabels, signatureInputErrors } from '@/features/tools/pdf-signature/content'
import { pdfSignatureDisclosures, pdfSignatureLimits } from '@/features/tools/pdf-signature/domain/reference'
import { nudgeStepPt } from '@/features/tools/pdf-signature/domain/workspace'
import { localAssetErrorMessage } from '@/features/shell/local-assets/content'
import { formatStoredSize } from '@/features/shell/local-assets/usage'
import { usePdfSignature } from '@/composables/usePdfSignature'
import type { SignatureAsset } from '@/composables/usePdfSignature'
import type { LocalAssetErrorCode } from '@/features/shell/local-assets/repository'

/**
 * The signing workspace: choose a document, make a signature, put it where it
 * belongs, download the result.
 *
 * Two rules shape the markup. The first two sentences of §10 of the decision
 * record are above everything a visitor can act on, so nobody places a signature
 * before reading what this is not. And every placement is reachable three ways —
 * pointer, arrow keys, and numeric fields — because a rectangle on a canvas is
 * the one thing a screen reader cannot read, so the numbers and the spoken
 * summary are the placement, not a description of it.
 */
const { locale } = useAppLocale()
const en = computed(() => locale.value === 'en')

const signature = usePdfSignature(() => locale.value)
const fileInput = ref<HTMLInputElement>()
const passwordInput = ref<HTMLInputElement>()
const pageImage = ref<HTMLImageElement>()
const passwordDraft = ref('')
const signatureName = ref('')
let dragging: { id: string, x: number, y: number } | undefined

const errorText = computed(() => {
  const code = signature.error.value
  if (!code) return ''
  if (code.startsWith('storage_')) {
    const message = localAssetErrorMessage(code.slice('storage_'.length) as LocalAssetErrorCode, locale.value)
    return `${message.title}。${message.recovery}`
  }
  if (signatureInputErrors[code]) return signatureInputErrors[code]![locale.value]
  /* An engine that will not start offline is not an unsupported browser. */
  if (code === 'unsupported_browser' && !signature.online.value) {
    return en.value
      ? 'The local PDF engine has not been stored on this device yet. Reconnect once to fetch it; after that this tool works offline.'
      : '本機 PDF 引擎還沒有存到這台裝置上。請連線一次取得引擎，之後就能離線使用。'
  }
  return pdfSignatureErrors[code as keyof typeof pdfSignatureErrors]?.[locale.value] ?? ''
})

const status = computed(() => {
  if (signature.busy.value && signature.stage.value) return pdfSignatureStageLabels[signature.stage.value]![locale.value]
  if (signature.message.value === 'cancelled') return en.value ? 'Cancelled. Your file is unchanged and your placements are kept.' : '已取消。原檔未變更，已放置的簽名仍保留。'
  if (signature.message.value === 'signature-saved') return en.value ? 'Signature saved on this device.' : '簽名已保存在這台裝置。'
  if (signature.message.value === 'signature-removed') return en.value ? 'Saved signature deleted from this device.' : '已從這台裝置刪除保存的簽名。'
  if (signature.message.value === 'exported') return en.value ? 'Done. Check the signature on the page, then download.' : '已完成。請確認頁面上的簽名後再下載。'
  if (signature.message.value === 'opened' && signature.report.value) {
    return en.value
      ? `Opened: ${signature.report.value.pageCount} pages.`
      : `已開啟：共 ${signature.report.value.pageCount} 頁。`
  }
  return ''
})

const pageNumbers = computed(() => Array.from({ length: signature.report.value?.pageCount ?? 0 }, (_, index) => index))
const placedOnPage = computed(() => signature.pagePlacements.value)
const geometry = computed(() => signature.geometry.value)

/** CSS pixels per point, so a pointer drag can be expressed in the page's own units. */
function pointScale() {
  const rect = pageImage.value?.getBoundingClientRect()
  const display = geometry.value?.display.width ?? signature.preview.value?.width
  if (!rect?.width || !display) return 1
  return rect.width / display
}

function choose(event: Event) {
  const input = event.target as HTMLInputElement
  void signature.choose(Array.from(input.files ?? []))
  input.value = ''
}

async function unlock() {
  await signature.openDocument(passwordDraft.value)
  if (signature.passwordNeeded.value) {
    await nextTick()
    passwordInput.value?.focus()
  }
  else passwordDraft.value = ''
}

function useSignature(asset: Parameters<typeof signature.addSignature>[0]) {
  const added = signature.addSignature(asset)
  signatureName.value = added.name
  if (signature.opened.value) signature.place()
}

function placeAgain() {
  signature.place()
}

function startDrag(event: PointerEvent, id: string) {
  signature.select(id)
  dragging = { id, x: event.clientX, y: event.clientY }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function drag(event: PointerEvent) {
  if (!dragging) return
  const scale = pointScale()
  signature.move({ x: (event.clientX - dragging.x) / scale, y: (event.clientY - dragging.y) / scale })
  dragging = { ...dragging, x: event.clientX, y: event.clientY }
}

function endDrag() { dragging = undefined }

/** The keyboard equivalent of dragging and resizing, on the placement itself. */
function keyPlacement(event: KeyboardEvent) {
  const step = event.shiftKey ? nudgeStepPt.coarse : nudgeStepPt.fine
  const moves: Record<string, { x: number, y: number }> = {
    ArrowLeft: { x: -step, y: 0 },
    ArrowRight: { x: step, y: 0 },
    ArrowUp: { x: 0, y: -step },
    ArrowDown: { x: 0, y: step },
  }
  if (moves[event.key]) { event.preventDefault(); signature.move(moves[event.key]!); return }
  if (event.key === '+' || event.key === '=') { event.preventDefault(); signature.resize(1.1); return }
  if (event.key === '-' || event.key === '_') { event.preventDefault(); signature.resize(1 / 1.1); return }
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); signature.remove() }
}

function setNumber(field: 'leftPt' | 'topPt' | 'widthPt', value: string) {
  const current = geometry.value
  if (!current) return
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return
  signature.setRect({
    leftPt: field === 'leftPt' ? parsed : current.left,
    topPt: field === 'topPt' ? parsed : current.top,
    widthPt: field === 'widthPt' ? parsed : current.width,
  })
}

function round(value: number) { return Math.round(value * 10) / 10 }

function savedLabel(asset: SignatureAsset) {
  return asset.savedId ? (en.value ? 'Saved' : '已保存') : ''
}
</script>

<template>
  <Card class="tool-workspace pdf-signature">
    <p class="eyebrow">{{ en ? 'Sign a PDF on your device' : '在你的裝置上簽 PDF' }}</p>
    <!-- §10 of the decision record: these two sentences come before any placement. -->
    <p class="pdf-signature__scope">{{ pdfSignatureDisclosures['not-a-digital-signature'][locale] }}</p>
    <p class="pdf-signature__scope">{{ pdfSignatureDisclosures['no-identity-verification'][locale] }}</p>

    <p v-if="signature.preparing.value" role="status" class="field-help">{{ en ? 'Checking local PDF support…' : '正在檢查本機 PDF 支援…' }}</p>
    <div v-else-if="signature.capabilities.value && !signature.capabilities.value.supported" class="capability-warning">
      <p>{{ pdfSignatureErrors.unsupported_browser[locale] }}</p>
      <Button variant="outline" @click="signature.prepare()">{{ en ? 'Check again' : '重新檢查' }}</Button>
    </div>

    <div
      class="pdf-signature__picker field-group"
      @dragover.prevent
      @drop.prevent="signature.choose(Array.from($event.dataTransfer?.files ?? []))"
    >
      <FileText :size="24" aria-hidden="true" />
      <label for="pdf-signature-file">{{ en ? 'Choose a PDF' : '選擇 PDF 檔' }}</label>
      <input
        id="pdf-signature-file"
        ref="fileInput"
        class="ui-input"
        type="file"
        accept="application/pdf,.pdf"
        :disabled="signature.busy.value"
        aria-describedby="pdf-signature-limits pdf-signature-error"
        :aria-invalid="Boolean(errorText)"
        @change="choose"
      >
      <p id="pdf-signature-limits" class="field-help">
        {{ en
          ? `PDF only, up to ${pdfSignatureLimits.maxPages} pages and ${pdfSignatureLimits.maxBytes / 1024 / 1024} MiB. You can also drop a file here.`
          : `僅支援 PDF，最多 ${pdfSignatureLimits.maxPages} 頁、${pdfSignatureLimits.maxBytes / 1024 / 1024} MiB。也可將檔案拖曳至此。` }}
      </p>
      <p class="field-help">{{ pdfSignatureDisclosures['local-processing'][locale] }}</p>
    </div>

    <form v-if="signature.passwordNeeded.value" class="pdf-signature__password field-group" @submit.prevent="unlock">
      <label for="pdf-signature-password">{{ en ? 'Open password' : '開啟密碼' }}</label>
      <input
        id="pdf-signature-password"
        ref="passwordInput"
        v-model="passwordDraft"
        class="ui-input"
        type="password"
        autocomplete="off"
        :disabled="signature.busy.value"
        aria-describedby="pdf-signature-password-help"
      >
      <p id="pdf-signature-password-help" class="field-help">{{ pdfSignatureDisclosures['password-stays-on-device'][locale] }}</p>
      <div class="tool-workspace__actions">
        <Button type="submit" :disabled="signature.busy.value">{{ en ? 'Open with password' : '用密碼開啟' }}</Button>
      </div>
    </form>

    <p id="pdf-signature-error" role="alert" class="field-error">
      <TriangleAlert v-if="errorText" :size="18" aria-hidden="true" />{{ errorText }}
    </p>
    <p role="status" class="pdf-signature__status">{{ status }}</p>
    <div v-if="signature.busy.value" class="tool-workspace__actions">
      <Button type="button" variant="outline" @click="signature.cancel()">
        <X :size="18" aria-hidden="true" />{{ en ? 'Cancel' : '取消' }}
      </Button>
    </div>

    <template v-if="signature.opened.value && signature.report.value">
      <section class="pdf-signature__document" :aria-label="en ? 'Document' : '文件'">
        <p class="field-help" data-document-summary>
          {{ en
            ? `${signature.report.value.pageCount} pages · ${signature.report.value.encrypted ? 'password protected' : 'not protected'}`
            : `共 ${signature.report.value.pageCount} 頁 · ${signature.report.value.encrypted ? '有密碼保護' : '沒有密碼保護'}` }}
        </p>
      </section>

      <SignaturePad
        :locale="locale"
        :max-placed-width-pt="signature.maxPlacedWidthPt.value"
        :disabled="signature.busy.value"
        @created="useSignature"
      />

      <section v-if="signature.signatures.value.length" class="pdf-signature__signatures" :aria-label="en ? 'Signatures in this session' : '這次作業的簽名'">
        <ul class="pdf-signature__signature-list">
          <li v-for="asset in signature.signatures.value" :key="asset.id">
            <img :src="asset.url" :alt="en ? `Signature preview: ${asset.name}` : `簽名預覽：${asset.name}`" width="120">
            <span>{{ asset.name }} · {{ asset.width }} × {{ asset.height }} {{ savedLabel(asset) }}</span>
            <Button type="button" variant="outline" @click="signature.activeSignatureId.value = asset.id; placeAgain()">
              {{ en ? 'Place on this page' : '放到這一頁' }}
            </Button>
            <Button type="button" variant="outline" @click="signature.dropSignature(asset.id)">
              <Trash2 :size="16" aria-hidden="true" />{{ en ? 'Remove' : '移除' }}
            </Button>
          </li>
        </ul>
        <div class="field-group pdf-signature__save">
          <label for="pdf-signature-name">{{ en ? 'Name for a saved signature' : '保存時的名稱' }}</label>
          <input id="pdf-signature-name" v-model="signatureName" class="ui-input" type="text" maxlength="60" aria-describedby="pdf-signature-save-help">
          <p id="pdf-signature-save-help" class="field-help">{{ pdfSignatureDisclosures['saved-signature-is-local'][locale] }}</p>
          <div class="tool-workspace__actions">
            <Button
              type="button"
              variant="outline"
              :disabled="!signature.activeSignature.value || !signatureName.trim()"
              @click="signature.activeSignature.value && signature.saveSignature(signature.activeSignature.value.id, signatureName.trim())"
            >
              <Save :size="18" aria-hidden="true" />{{ en ? 'Save on this device' : '保存在這台裝置' }}
            </Button>
          </div>
        </div>
      </section>

      <section class="pdf-signature__page" :aria-label="en ? 'Page preview' : '頁面預覽'">
        <div class="field-group pdf-signature__page-select">
          <label for="pdf-signature-page">{{ en ? 'Page' : '頁次' }}</label>
          <select
            id="pdf-signature-page"
            class="ui-input"
            :value="signature.pageIndex.value"
            :disabled="signature.busy.value"
            @change="signature.showPage(Number(($event.target as HTMLSelectElement).value))"
          >
            <option v-for="index in pageNumbers" :key="index" :value="index">
              {{ en ? `Page ${index + 1} of ${signature.report.value.pageCount}` : `第 ${index + 1} 頁，共 ${signature.report.value.pageCount} 頁` }}
            </option>
          </select>
          <div class="tool-workspace__actions">
            <Button type="button" variant="outline" :disabled="signature.pageIndex.value === 0 || signature.busy.value" @click="signature.showPage(signature.pageIndex.value - 1)">
              {{ en ? 'Previous page' : '上一頁' }}
            </Button>
            <Button type="button" variant="outline" :disabled="signature.pageIndex.value >= signature.report.value.pageCount - 1 || signature.busy.value" @click="signature.showPage(signature.pageIndex.value + 1)">
              {{ en ? 'Next page' : '下一頁' }}
            </Button>
          </div>
        </div>

        <div v-if="signature.preview.value" class="pdf-signature__canvas" data-page-preview>
          <img
            ref="pageImage"
            :src="signature.preview.value.url"
            :alt="en ? `Preview of page ${signature.pageIndex.value + 1}` : `第 ${signature.pageIndex.value + 1} 頁的預覽`"
            :width="signature.preview.value.width"
            :height="signature.preview.value.height"
          >
          <button
            v-for="placement in placedOnPage"
            :key="placement.id"
            type="button"
            class="pdf-signature__placement"
            :class="{ 'pdf-signature__placement--selected': placement.id === signature.workspace.value.selectedId }"
            :style="{
              left: `${placement.rect.x * 100}%`,
              top: `${placement.rect.y * 100}%`,
              width: `${placement.rect.width * 100}%`,
              height: `${placement.rect.height * 100}%`,
            }"
            :aria-pressed="placement.id === signature.workspace.value.selectedId"
            :aria-label="en
              ? `Placed signature. Arrow keys move it, plus and minus resize it, Delete removes it.`
              : '已放置的簽名。方向鍵移動、加減號縮放、Delete 刪除。'"
            @pointerdown="startDrag($event, placement.id)"
            @pointermove="drag"
            @pointerup="endDrag"
            @pointercancel="endDrag"
            @keydown="keyPlacement"
            @focus="signature.select(placement.id)"
          >
            <img :src="signature.signatures.value.find(asset => asset.id === placement.signatureId)?.url" alt="" aria-hidden="true">
          </button>
        </div>
      </section>

      <section v-if="geometry" class="pdf-signature__placement-fields" :aria-label="en ? 'Signature position' : '簽名位置'">
        <div class="tool-workspace__grid">
          <div class="field-group">
            <label for="pdf-signature-left">{{ en ? 'From the left (pt)' : '距左（pt）' }}</label>
            <input id="pdf-signature-left" class="ui-input" type="number" step="1" :value="round(geometry.left)" @change="setNumber('leftPt', ($event.target as HTMLInputElement).value)">
          </div>
          <div class="field-group">
            <label for="pdf-signature-top">{{ en ? 'From the top (pt)' : '距上（pt）' }}</label>
            <input id="pdf-signature-top" class="ui-input" type="number" step="1" :value="round(geometry.top)" @change="setNumber('topPt', ($event.target as HTMLInputElement).value)">
          </div>
          <div class="field-group">
            <label for="pdf-signature-width">{{ en ? 'Width (pt)' : '寬度（pt）' }}</label>
            <input id="pdf-signature-width" class="ui-input" type="number" step="1" min="24" :value="round(geometry.width)" @change="setNumber('widthPt', ($event.target as HTMLInputElement).value)">
          </div>
        </div>
        <p role="status" class="pdf-signature__summary" data-placement-summary>{{ signature.summary.value }}</p>
        <div class="tool-workspace__actions">
          <Button type="button" variant="outline" @click="signature.remove()">
            <Trash2 :size="18" aria-hidden="true" />{{ en ? 'Delete this signature' : '刪除這個簽名' }}
          </Button>
        </div>
      </section>

      <!-- Undo has to outlive the selection: the step most worth undoing is a delete. -->
      <div class="tool-workspace__actions pdf-signature__history">
        <Button type="button" variant="outline" :disabled="!signature.canUndo.value" @click="signature.undo()">
          <Undo2 :size="18" aria-hidden="true" />{{ en ? 'Undo' : '復原' }}
        </Button>
      </div>

      <section class="pdf-signature__export" :aria-label="en ? 'Download' : '下載'">
        <p class="field-help">{{ pdfSignatureDisclosures['original-pages-untouched'][locale] }}</p>
        <!-- A full rewrite drops the document's own password, so this is said before the download exists. -->
        <p v-if="signature.report.value.encrypted" class="pdf-signature__warning" data-decrypted-notice>
          {{ pdfSignatureDisclosures['decrypted-export'][locale] }}
        </p>
        <div class="tool-workspace__actions">
          <Button
            type="button"
            :disabled="signature.busy.value || !signature.workspace.value.placements.length"
            data-export
            @click="signature.exportSigned()"
          >
            {{ en ? 'Sign and prepare the download' : '加上簽名並準備下載' }}
          </Button>
        </div>
        <template v-if="signature.output.value && signature.outputInfo.value">
          <p class="field-help" data-export-summary>
            {{ en
              ? `${signature.outputInfo.value.pageCount} pages · ${formatStoredSize(signature.outputInfo.value.bytes, locale)}`
              : `共 ${signature.outputInfo.value.pageCount} 頁 · ${formatStoredSize(signature.outputInfo.value.bytes, locale)}` }}
          </p>
          <Button as-child class="pdf-signature__download">
            <a :href="signature.output.value" download="signed.pdf">
              <Download :size="18" aria-hidden="true" />{{ en ? 'Download the signed PDF' : '下載已簽名的 PDF' }}
            </a>
          </Button>
        </template>
      </section>

      <div class="tool-workspace__actions">
        <Button type="button" variant="outline" @click="signature.reset()">{{ en ? 'Close this document' : '關閉這份文件' }}</Button>
      </div>
    </template>

    <section v-if="signature.savedSignatures.value.length" class="pdf-signature__saved" :aria-label="en ? 'Saved signatures' : '已保存的簽名'">
      <p class="field-help">
        {{ en ? 'Saved on this device' : '保存在這台裝置' }} ·
        {{ formatStoredSize(signature.savedSignatures.value.reduce((total, record) => total + record.bytes, 0), locale) }}
      </p>
      <ul class="pdf-signature__signature-list">
        <li v-for="record in signature.savedSignatures.value" :key="record.id">
          <span>{{ record.name }}</span>
          <Button type="button" variant="outline" :disabled="!signature.opened.value || signature.busy.value" @click="signature.useSavedSignature(record.id)">
            {{ en ? 'Use on this page' : '用在這一頁' }}
          </Button>
          <Button type="button" variant="outline" @click="signature.forgetSavedSignature(record.id)">
            <Trash2 :size="16" aria-hidden="true" />{{ en ? 'Delete' : '刪除' }}
          </Button>
        </li>
      </ul>
    </section>

    <section class="pdf-signature__disclosures" :aria-label="en ? 'What this tool does and does not do' : '這個工具會做與不會做的事'">
      <ul>
        <li v-for="(sentence, key) in pdfSignatureDisclosures" :key="key">{{ sentence[locale] }}</li>
      </ul>
    </section>
  </Card>
</template>
