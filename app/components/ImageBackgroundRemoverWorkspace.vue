<script setup lang="ts">
import { useOnline } from '@vueuse/core'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { Download, Image, TriangleAlert, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { validateImageInput } from '@/features/images/input'
import { formatAssetSize } from '@/features/pwa/offline-assets'
import { createBackgroundRemover } from '@/features/tools/image-background-remover/engine'
import { backgroundRemovalErrors, backgroundRemovalStages, portraitScopeNotice } from '@/features/tools/image-background-remover/content'
import { backgroundRemovalAssets } from '@/features/tools/image-background-remover/domain/model'
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
const zoom = ref<string | number>(100)
const fileInput = ref<HTMLInputElement>()
const running = ref(false)
const validating = ref(false)
const stage = ref('')
const message = ref<'selected' | 'cancelled' | 'success' | ''>('')
const error = ref('')
let generation = 0
let mounted = true

/**
 * The weights and the runtime are the same bytes the page's offline note
 * offers, so both surfaces share one download rather than racing for it.
 */
const online = useOnline()
const assets = backgroundRemovalAssets.map(asset => ({ asset, ...useOfflineAsset(asset) }))
const modelBytes = backgroundRemovalAssets.reduce((total, asset) => total + asset.bytes, 0)
const modelReady = computed(() => assets.every(entry => entry.state.value.phase === 'cached'))
const modelDownloading = computed(() => assets.some(entry => entry.state.value.phase === 'downloading'))
/** Being offline is the condition, not the phase it left behind: reconnecting must re-enable the download. */
const modelBlocked = computed(() => !online.value)
const modelFailure = computed(() => assets.find(entry => entry.state.value.phase === 'failed')?.state.value.failureReason)
const modelReceived = computed(() => assets.reduce((total, entry) => total + (entry.state.value.phase === 'cached' ? entry.asset.bytes : entry.state.value.receivedBytes), 0))
const modelPercent = computed(() => Math.min(100, Math.round(modelReceived.value / modelBytes * 100)))

const busy = computed(() => running.value || validating.value || modelDownloading.value)
useWorkspaceDirty('image-background-remover', computed(() => Boolean(source.value) || running.value))
const errorText = computed(() => error.value ? (backgroundRemovalErrors[error.value] ?? backgroundRemovalErrors.failed)![locale.value] : '')

const modelStatus = computed(() => {
  const en = locale.value === 'en'
  if (modelReady.value) return en ? 'The model is on this device. Background removal works offline.' : '模型已在這台裝置，離線也能去背。'
  if (modelDownloading.value) return en ? `Downloading the model… ${modelPercent.value}%` : `正在下載模型…… ${modelPercent.value}%`
  if (modelBlocked.value) return en ? 'You are offline, so the model cannot be downloaded yet.' : '目前離線，還無法下載模型。'
  if (modelFailure.value === 'digest-mismatch') return en ? 'The downloaded file did not match the published fingerprint and was discarded. Download it again.' : '下載到的檔案與公布的指紋不符，已捨棄不使用。請重新下載。'
  if (modelFailure.value) return en ? 'The download did not finish. Nothing was kept, so you can try again.' : '下載未完成，已清除未完成的內容，可以重新下載。'
  return en
    ? `First use downloads about ${formatAssetSize(modelBytes, 'en')} of model and runtime to this device. It is checked against a published fingerprint, can be cancelled at any time, and is reused offline afterwards.`
    : `首次使用需下載約 ${formatAssetSize(modelBytes, 'zh-tw')} 的模型與推論資源到這台裝置。下載內容會比對公布的指紋，過程中隨時可以取消，之後離線也能重複使用。`
})

const status = computed(() => {
  const en = locale.value === 'en'
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

function size(bytes: number) { return `${new Intl.NumberFormat(locale.value === 'en' ? 'en' : 'zh-TW').format(bytes)} bytes` }

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

/**
 * §12.8 requires an unsupported device to fail before the full model loads, and
 * a device with no room for it to be told rather than to fail mid-write.
 */
async function downloadModel() {
  if (!capabilities.value?.supported) return
  error.value = ''
  const estimate = await navigator.storage?.estimate?.().catch(() => undefined)
  if (!mounted) return
  if (estimate?.quota && estimate.quota - (estimate.usage ?? 0) < modelBytes * 1.2) {
    error.value = 'insufficient_storage'
    return
  }
  for (const entry of assets) {
    if (entry.state.value.phase === 'cached') continue
    await entry.download()
    if (!mounted) return
  }
}

function cancelModel() {
  for (const entry of assets) entry.cancel()
}

async function selectFiles(files: File[]) {
  if (running.value || validating.value) return
  const current = ++generation
  error.value = ''; message.value = ''
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

async function removeBackground() {
  if (!source.value || busy.value || !capabilities.value?.supported || !modelReady.value) return
  clearResult(); error.value = ''; running.value = true; stage.value = ''
  const current = ++generation
  const outcome = await engine.run({ file: source.value }, { onProgress: progress => { stage.value = progress.stage } })
  if (current !== generation || !mounted) return
  running.value = false
  if (outcome.status === 'cancelled') message.value = 'cancelled'
  else if (outcome.status === 'error') error.value = outcome.error.code
  else {
    try {
      outputUrl.value = URL.createObjectURL(outcome.output.blob)
      originalUrl.value = URL.createObjectURL(outcome.output.preview)
      result.value = outcome.output; message.value = 'success'
    }
    catch { clearResult(); error.value = 'insufficient_memory' }
  }
}

function cancel() {
  ++generation; engine.cancel(); cancelModel()
  running.value = false; validating.value = false
  stage.value = ''; clearResult(); message.value = 'cancelled'
}

function reset() { cancel(); source.value = undefined; error.value = ''; message.value = ''; fileInput.value?.focus() }

watch(source, clearResult)
onMounted(prepare)
onBeforeUnmount(() => { mounted = false; ++generation; engine.dispose(); clearResult(); source.value = undefined })
</script>

<template>
  <Card class="tool-workspace image-background-remover">
    <p class="eyebrow">{{ locale === 'en' ? 'Portrait cutouts, on your device' : '人像去背，就在你的裝置' }}</p>
    <p class="image-background-remover__scope">{{ copy(portraitScopeNotice, locale) }}</p>

    <p v-if="preparing" role="status" class="field-help">{{ locale === 'en' ? 'Checking local model support…' : '正在檢查本機模型支援…' }}</p>
    <div v-else-if="capabilities && !capabilities.supported" class="capability-warning">
      <p>{{ backgroundRemovalErrors.unsupported_browser![locale] }}</p>
      <Button variant="outline" @click="prepare">{{ locale === 'en' ? 'Check again' : '重新檢查' }}</Button>
    </div>

    <section
      class="image-background-remover__model"
      data-model-preparation
      :data-model-ready="String(modelReady)"
      :aria-label="locale === 'en' ? 'Local model' : '本機模型'"
    >
      <p class="image-background-remover__model-status" role="status">{{ modelStatus }}</p>
      <div
        v-if="modelDownloading"
        class="offline-asset__progress"
        role="progressbar"
        :aria-valuenow="modelPercent"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="locale === 'en' ? 'Model download progress' : '模型下載進度'"
      >
        <span :style="{ inlineSize: `${modelPercent}%` }" />
      </div>
      <div v-if="!modelReady" class="tool-workspace__actions">
        <Button v-if="modelDownloading" type="button" variant="outline" @click="cancelModel">
          <X :size="18" aria-hidden="true" />{{ locale === 'en' ? 'Cancel download' : '取消下載' }}
        </Button>
        <Button v-else type="button" :disabled="modelBlocked || preparing || capabilities?.supported === false" @click="downloadModel">
          <Download :size="18" aria-hidden="true" />
          {{ modelFailure ? (locale === 'en' ? 'Try again' : '重新下載') : (locale === 'en' ? 'Download the model' : '下載模型') }}
        </Button>
      </div>
    </section>

    <div class="image-background-remover__picker field-group" @dragover.prevent @drop.prevent="selectFiles(Array.from($event.dataTransfer?.files ?? []))">
      <Image :size="24" aria-hidden="true" />
      <label for="remover-file">{{ locale === 'en' ? 'Choose portrait image' : '選擇人像圖片' }}</label>
      <input id="remover-file" ref="fileInput" class="ui-input" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" :disabled="running" aria-describedby="remover-formats remover-error" :aria-invalid="Boolean(error)" @change="choose">
      <p id="remover-formats" class="field-help">JPEG · PNG · WebP · {{ locale === 'en' ? 'One image, up to 25 MiB / 24 MP. You can also drop a file here.' : '單張最多 25 MiB／2,400 萬像素。也可將檔案拖曳至此。' }}</p>
      <p class="field-help">{{ backgroundRemovalErrors.unsupported_heic![locale] }}</p>
    </div>
    <p v-if="source" class="image-background-remover__filename">{{ source.name }} · {{ size(source.size) }}</p>

    <form :aria-busy="running" @submit.prevent="removeBackground">
      <div class="tool-workspace__actions">
        <Button type="submit" :disabled="!source || busy || !capabilities?.supported || !modelReady">{{ locale === 'en' ? 'Remove background' : '開始去背' }}</Button>
        <Button v-if="running" type="button" variant="outline" @click="cancel">{{ locale === 'en' ? 'Cancel' : '取消' }}</Button>
        <Button v-if="source && !busy" type="button" variant="outline" @click="reset">{{ locale === 'en' ? 'Clear image' : '清除圖片' }}</Button>
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
