<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { Download, Image, RotateCcw, TriangleAlert } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { validateImageInput } from '@/features/images/input'
import { formatStoredSize } from '@/features/shell/local-assets/usage'
import { createBackgroundRemover } from '@/features/tools/image-background-remover/engine'
import { backgroundRemovalErrors, backgroundRemovalStages, modelPreparationIssues, portraitScopeNotice } from '@/features/tools/image-background-remover/content'
import { useBackgroundRemovalModel } from '@/composables/useBackgroundRemovalModel'
import { copy } from '@/features/tools/catalog'
import type { BackgroundRemovalOutput } from '@/features/tools/image-background-remover/types'
import type { EngineCapabilities } from '@/features/tools/engine/contract'

const { locale } = useAppLocale()
const engine = createBackgroundRemover()
const capabilities = shallowRef<EngineCapabilities>()
const preparing = ref(false)
const source = shallowRef<File>()
const result = shallowRef<BackgroundRemovalOutput>()
const outputUrl = ref('')
const originalUrl = ref('')
/** The chosen file itself, so the visitor sees what they picked before anything runs. */
const sourceUrl = ref('')
const zoom = ref<string | number>(100)
const fileInput = ref<HTMLInputElement>()
const running = ref(false)
const validating = ref(false)
const stage = ref('')
const message = ref<'selected' | 'cancelled' | 'success' | ''>('')
const error = ref('')
/** The visitor asked to start while the model was still on its way; the run follows on its own. */
const waiting = ref(false)
/** Why the model is not on the device yet, shown only once the visitor has asked to start. */
const issue = ref<keyof typeof modelPreparationIssues | ''>('')
let generation = 0
let mounted = true

/**
 * The weights and the runtime are versioned files this site serves; the photo
 * never goes with them. They are shared with the page's offline note, so both
 * read one answer instead of racing for the same bytes.
 */
const {
  cancel: cancelModel, download: prepareModel, forget: forgetModel,
  percent: modelPercent, ready: modelReady,
} = useBackgroundRemovalModel()

const busy = computed(() => running.value || validating.value || waiting.value)
useWorkspaceDirty('image-background-remover', computed(() => Boolean(source.value) || running.value || waiting.value))
const errorText = computed(() => {
  if (issue.value) return modelPreparationIssues[issue.value][locale.value]
  return error.value ? (backgroundRemovalErrors[error.value] ?? backgroundRemovalErrors.failed)![locale.value] : ''
})

const status = computed(() => {
  const en = locale.value === 'en'
  if (waiting.value) return en ? 'Getting ready. Background removal starts on its own when it is done.' : '準備中，完成後會自動開始去背。'
  if (stage.value && running.value) return backgroundRemovalStages[stage.value]?.[locale.value] ?? ''
  if (message.value === 'cancelled') return en ? 'Cancelled. Your original is unchanged; you can retry.' : '已取消。原圖未變更，可重新去背。'
  if (message.value === 'selected') return en ? 'Image selected. Remove the background to preview the result.' : '已選擇圖片。開始去背即可預覽結果。'
  if (message.value === 'success') return en ? 'Done. Zoom in and check the edges before you use it.' : '已完成。請放大確認邊緣後再使用。'
  return ''
})

/** A matte that keeps almost everything or almost nothing is the shape a wrong subject takes. */
const coverageHint = computed(() => {
  if (!result.value) return ''
  const en = locale.value === 'en'
  const share = result.value.coverage
  if (share < 0.02) return en ? 'Almost nothing was kept. This model only recognises people — check that the photo contains a person.' : '幾乎沒有保留任何內容。這個模型只認得人，請確認照片裡有人物。'
  if (share > 0.97) return en ? 'Almost nothing was removed. The subject may fill the frame, or the model may not have found a person.' : '幾乎沒有移除任何背景。可能主體占滿畫面，或模型沒有找到人物。'
  return ''
})

function size(bytes: number) { return formatStoredSize(bytes, locale.value) }

function clearResult() {
  if (outputUrl.value) URL.revokeObjectURL(outputUrl.value)
  if (originalUrl.value) URL.revokeObjectURL(originalUrl.value)
  outputUrl.value = ''; originalUrl.value = ''; result.value = undefined
  message.value = ''
}

async function prepare() {
  preparing.value = true
  const value = await engine.prepare()
  if (!mounted) return
  capabilities.value = value
  preparing.value = false
}

async function selectFiles(files: File[]) {
  if (busy.value) return
  const current = ++generation
  error.value = ''; issue.value = ''; message.value = ''
  if (!files.length) return
  if (files.length !== 1) { error.value = 'multiple_files'; return }
  const file = files[0]!
  validating.value = true
  try {
    const code = await validateImageInput(file)
    if (current !== generation) return
    if (code) { error.value = code; return }
    clearResult(); source.value = file; message.value = 'selected'
  }
  catch { if (current === generation) error.value = 'corrupt_image' }
  finally {
    if (current === generation) {
      validating.value = false
      if (error.value) { await nextTick(); if (current === generation) fileInput.value?.focus() }
    }
  }
}

function choose(event: Event) {
  const input = event.target as HTMLInputElement
  void selectFiles(Array.from(input.files ?? []))
  input.value = ''
}

/**
 * Starting never asks the visitor to fetch anything first: if the model is
 * still on its way, this waits for the same attempt the photo started and
 * carries on into the run, and if it cannot arrive, it says why.
 */
async function removeBackground() {
  const file = source.value
  if (!file || busy.value || !capabilities.value?.supported) return
  const current = ++generation
  clearResult(); error.value = ''; issue.value = ''
  if (!modelReady.value) {
    waiting.value = true
    const outcome = await prepareModel()
    if (current !== generation || !mounted) return
    waiting.value = false
    if (outcome !== 'ready') {
      // Only this workspace cancels, and it moves on to a new generation when it does.
      issue.value = outcome === 'cancelled' ? 'failed' : outcome
      return
    }
  }
  await run(file, current)
}

async function run(file: File, current: number) {
  running.value = true; stage.value = 'reading'
  const outcome = await engine.run({ file }, { onProgress: progress => { stage.value = progress.stage } })
  if (current !== generation || !mounted) return
  running.value = false
  if (outcome.status === 'cancelled') message.value = 'cancelled'
  else if (outcome.status === 'error') {
    // The browser can clear stored files on its own. The worker then finds
    // them missing or cut short, and the next try gets them ready again.
    if (outcome.error.code === 'model_download_failed' || outcome.error.code === 'model_digest_mismatch') {
      forgetModel(); issue.value = 'failed'
    }
    else error.value = outcome.error.code
  }
  else {
    try {
      outputUrl.value = URL.createObjectURL(outcome.output.blob)
      originalUrl.value = URL.createObjectURL(outcome.output.preview)
      result.value = outcome.output; message.value = 'success'
    }
    catch { clearResult(); error.value = 'insufficient_memory' }
  }
}

/** Stopping while the model is on its way also stops the transfer, so cancelling never keeps spending the visitor's data. */
function cancel() {
  ++generation; engine.cancel(); cancelModel()
  running.value = false; validating.value = false; waiting.value = false
  stage.value = ''; clearResult(); message.value = 'cancelled'
}

/**
 * Clearing the photo is not a cancellation: a visitor who swaps one photo for
 * another still wants the tool, so the model keeps arriving in the background.
 */
function reset() {
  ++generation; engine.cancel()
  running.value = false; validating.value = false; waiting.value = false; stage.value = ''
  source.value = undefined; clearResult(); error.value = ''; issue.value = ''
  fileInput.value?.focus()
}

function setSourcePreview(file: File | undefined) {
  if (sourceUrl.value) URL.revokeObjectURL(sourceUrl.value)
  sourceUrl.value = ''
  if (!file) return
  try { sourceUrl.value = URL.createObjectURL(file) }
  catch { /* the preview is a convenience; the run still works without it */ }
}

watch(source, (file) => { clearResult(); setSourcePreview(file) })
/**
 * Choosing a photo is the first sign a visitor means to use the tool, so the
 * model starts arriving then and overlaps with the time spent checking the
 * photo. Opening the page alone fetches nothing: a visitor only looking around
 * should not pay for megabytes they never use. §12.8 also keeps a device that
 * cannot run the model from fetching it at all. How this background attempt
 * ends is only reported if the visitor asks to start.
 */
watch([source, () => capabilities.value?.supported], ([file, supported]) => {
  if (file && supported && !modelReady.value) void prepareModel()
})
onMounted(prepare)
onBeforeUnmount(() => { mounted = false; ++generation; engine.dispose(); clearResult(); setSourcePreview(undefined); source.value = undefined })
</script>

<template>
  <Card
    class="tool-workspace image-background-remover"
    :data-capabilities="capabilities ? (capabilities.supported ? 'supported' : 'unsupported') : 'checking'"
    :data-model-ready="String(modelReady)"
  >
    <p class="image-background-remover__scope">{{ copy(portraitScopeNotice, locale) }}</p>

    <p v-if="preparing" role="status" class="field-help">{{ locale === 'en' ? 'Checking whether this browser can remove backgrounds…' : '正在確認這個瀏覽器能不能去背…' }}</p>
    <div v-else-if="capabilities && !capabilities.supported" class="capability-warning">
      <p>{{ backgroundRemovalErrors.unsupported_browser![locale] }}</p>
      <Button variant="outline" @click="prepare">{{ locale === 'en' ? 'Check again' : '重新檢查' }}</Button>
    </div>

    <div class="image-background-remover__picker field-group" @dragover.prevent @drop.prevent="selectFiles(Array.from($event.dataTransfer?.files ?? []))">
      <Image :size="24" aria-hidden="true" />
      <label for="remover-file">{{ locale === 'en' ? 'Choose portrait image' : '選擇人像圖片' }}</label>
      <input id="remover-file" ref="fileInput" class="ui-input" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" :disabled="running || waiting" aria-describedby="remover-formats remover-error" :aria-invalid="Boolean(error)" @change="choose">
      <p id="remover-formats" class="field-help">JPEG · PNG · WebP · {{ locale === 'en' ? 'One image, up to 25 MiB / 24 MP. You can also drop a file here.' : '單張最多 25 MiB／2,400 萬像素。也可將檔案拖曳至此。' }}</p>
      <p class="field-help">{{ backgroundRemovalErrors.unsupported_heic![locale] }}</p>
    </div>
    <figure v-if="source && sourceUrl && !result" class="image-background-remover__source" data-image-source>
      <img :src="sourceUrl" :alt="locale === 'en' ? 'Preview of the chosen image' : '已選擇圖片的預覽'">
    </figure>

    <form :aria-busy="running || waiting" @submit.prevent="removeBackground">
      <div class="tool-workspace__actions">
        <!-- After a preparation problem the same button retries, so focus stays where the visitor already is. -->
        <Button type="submit" :disabled="!source || busy || !capabilities?.supported">
          <template v-if="issue"><RotateCcw :size="18" aria-hidden="true" />{{ locale === 'en' ? 'Try again' : '重試' }}</template>
          <template v-else>{{ locale === 'en' ? 'Remove background' : '開始去背' }}</template>
        </Button>
        <Button v-if="running || waiting" type="button" variant="outline" @click="cancel">{{ locale === 'en' ? 'Cancel' : '取消' }}</Button>
        <Button v-if="source && !busy" type="button" variant="outline" @click="reset">{{ locale === 'en' ? 'Clear image' : '清除圖片' }}</Button>
      </div>
      <div v-if="waiting" class="image-background-remover__preparing" data-model-preparing>
        <p class="image-background-remover__preparing-label">
          <span>{{ locale === 'en' ? 'Getting ready' : '準備中' }}</span>
          <!-- The progress bar carries the value for assistive technology. -->
          <span aria-hidden="true">{{ modelPercent }}%</span>
        </p>
        <div
          class="offline-asset__progress"
          role="progressbar"
          :aria-valuenow="modelPercent"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="locale === 'en' ? 'Getting background removal ready' : '去背功能準備進度'"
        >
          <span :style="{ inlineSize: `${modelPercent}%` }" />
        </div>
      </div>
    </form>

    <p id="remover-error" role="alert" class="field-error"><TriangleAlert v-if="errorText" :size="18" aria-hidden="true" />{{ errorText }}</p>
    <p role="status" class="image-background-remover__status">{{ status }}</p>
    <div v-if="running && stage" role="progressbar" :aria-label="backgroundRemovalStages[stage]?.[locale]" class="field-help">{{ locale === 'en' ? 'Working locally; you can cancel at any time.' : '正在本機處理，可隨時取消。' }}</div>

    <template v-if="result && source">
      <div class="field-group image-background-remover__zoom">
        <label for="remover-zoom">{{ locale === 'en' ? 'Preview zoom (100–400%)' : '預覽放大倍率（100–400%）' }}</label>
        <input id="remover-zoom" v-model="zoom" class="ui-input" type="range" min="100" max="400" step="25" aria-describedby="remover-zoom-help">
        <p id="remover-zoom-help" class="field-help">{{ locale === 'en' ? `Showing both previews at ${zoom}%. Zooming does not change the downloaded file.` : `目前以 ${zoom}% 檢視兩張預覽。放大不會改變下載的檔案。` }}</p>
      </div>
      <div class="tool-workspace__grid image-background-remover__comparison">
        <figure data-image-original>
          <figcaption>{{ locale === 'en' ? 'Original' : '原圖' }} · {{ result.width }} × {{ result.height }} · {{ size(source.size) }}</figcaption>
          <!-- Zooming makes the frame scrollable, so it has to be reachable and pannable by keyboard. -->
          <div class="image-background-remover__frame" tabindex="0" role="group" :aria-label="locale === 'en' ? 'Original image preview, scrollable' : '原圖預覽，可捲動'"><img :src="originalUrl" :style="{ width: `${zoom}%` }" :alt="locale === 'en' ? 'Original image preview' : '原圖預覽'"></div>
        </figure>
        <figure data-image-result>
          <figcaption>{{ locale === 'en' ? 'Transparent output' : '透明背景結果' }} · {{ result.width }} × {{ result.height }} · {{ size(result.blob.size) }}</figcaption>
          <div class="image-background-remover__frame image-background-remover__frame--alpha" tabindex="0" role="group" :aria-label="locale === 'en' ? 'Cutout preview, scrollable' : '去背結果預覽，可捲動'"><img :src="outputUrl" :style="{ width: `${zoom}%` }" :alt="locale === 'en' ? 'Preview of the cutout on a checkered transparency background' : '去背結果預覽，透明處以格紋表示'"></div>
        </figure>
      </div>
      <p class="field-help">{{ locale === 'en' ? 'The checkered area is transparent. Hair, semi-transparent areas, and low-contrast edges are the usual weak spots — please check the edges before you use it.' : '格紋區域代表透明。髮絲、半透明區域與低對比邊緣最容易出錯，使用前請確認邊緣。' }}</p>
      <p v-if="coverageHint" class="field-help image-background-remover__coverage">{{ coverageHint }}</p>
      <Button as-child class="image-background-remover__download"><a :href="outputUrl" download="background-removed.png"><Download :size="18" aria-hidden="true" />{{ locale === 'en' ? 'Download transparent PNG' : '下載透明 PNG' }}</a></Button>
    </template>
  </Card>
</template>
