<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { Download, Image, ImageOff, TriangleAlert } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { imageSignature, validateImageInput } from '@/features/images/input'
import { imageInputLimits } from '@/features/images/limits'
import { formatStoredSize } from '@/features/shell/local-assets/usage'
import { createImageCompressor } from '@/features/tools/image-compressor/engine'
import { compressorErrors, heicMessage, imageStages } from '@/features/tools/image-compressor/content'
import { defaultOutputFormat, recommendedQuality } from '@/features/tools/image-compressor/output-settings'
import type { CompressionOutput, ImageFormat } from '@/features/tools/image-compressor/types'
import type { EngineCapabilities } from '@/features/tools/engine/contract'

const { locale } = useAppLocale()
const engine = createImageCompressor()
const capabilities = shallowRef<EngineCapabilities>()
const preparing = ref(false)
const source = shallowRef<File>()
const result = shallowRef<CompressionOutput>()
const outputUrl = ref('')
/** The chosen file itself, shown as the original's thumbnail from selection until it is replaced or cleared. */
const sourceUrl = ref('')
const sourceDimensions = ref<{ width: number, height: number }>()
const sourcePreviewFailed = ref(false)
const sourceFormat = ref<ImageFormat>()
/** Set only by the format field, so a choice carries over to the next image while untouched images follow their source. */
const chosenFormat = ref<ImageFormat>()
const offeredFormats = computed<ImageFormat[]>(() => capabilities.value?.supported ? capabilities.value.formats as ImageFormat[] : ['image/jpeg', 'image/png', 'image/webp'])
const format = computed<ImageFormat>({
  get: () => chosenFormat.value && offeredFormats.value.includes(chosenFormat.value) ? chosenFormat.value : defaultOutputFormat(sourceFormat.value, offeredFormats.value),
  set: (value) => { chosenFormat.value = value },
})
const fileInput = ref<HTMLInputElement>()
const running = ref(false)
const validating = ref(false)
const stage = ref('')
const message = ref<'selected' | 'cancelled' | 'success' | ''>('')
const error = ref('')
let generation = 0
let mounted = true
const busy = computed(() => running.value || validating.value)
useWorkspaceDirty('image-compressor', computed(() => Boolean(source.value) || busy.value))
const errorText = computed(() => error.value ? (compressorErrors[error.value] ?? compressorErrors.failed)![locale.value] : '')
const status = computed(() => {
  if (stage.value && running.value) return imageStages[stage.value]?.[locale.value] ?? ''
  if (message.value === 'cancelled') return locale.value === 'en' ? 'Cancelled. Your original is unchanged; you can retry.' : '已取消。原檔未變更，可重新處理。'
  if (message.value === 'selected') return locale.value === 'en' ? 'Image selected. Compress it to compare previews.' : '已選擇圖片，按「壓縮圖片」即可比較預覽。'
  if (message.value === 'success') return locale.value === 'en' ? 'Image ready. Compare the actual size before downloading.' : '圖片已完成，請比較實際大小後下載。'
  return ''
})
const grew = computed(() => Boolean(source.value && result.value && result.value.blob.size > source.value.size))
/** Whole percent, except that a change too small to round to 1% is not called 0%. */
const change = computed(() => {
  if (!source.value || !result.value) return ''
  const en = locale.value === 'en'
  const ratio = result.value.blob.size / source.value.size
  if (ratio === 1) return en ? 'Same size' : '大小相同'
  const percent = Math.round(Math.abs(1 - ratio) * 100)
  if (ratio < 1) return percent < 1 ? (en ? 'Less than 1% smaller' : '縮小不到 1%') : (en ? `${percent}% smaller` : `縮小 ${percent}%`)
  return percent < 1 ? (en ? 'Less than 1% larger' : '增加不到 1%') : (en ? `${percent}% larger` : `增加 ${percent}%`)
})
const sizeNote = computed(() => {
  const en = locale.value === 'en'
  if (result.value?.keptOriginal) {
    return en
      ? 'The original is already compact, so compressing again would only make it larger. This kept the original image data and removed its metadata. You can try another output format.'
      : '原圖已經很精簡，再壓縮只會變大，因此沿用原圖內容並移除中繼資料。可改用其他輸出格式再試。'
  }
  if (grew.value) return en ? 'The output is larger than the original — keep the original if you prefer.' : '輸出比原檔大，可以選擇保留原檔。'
  return ''
})
const extension = computed(() => result.value?.format === 'image/jpeg' ? 'jpg' : result.value?.format === 'image/webp' ? 'webp' : 'png')
/** Derived from the chosen file's name, so the download is easy to match with its original. */
const downloadName = computed(() => `${source.value?.name.replace(/\.[^.]*$/, '') || 'image'}-compressed.${extension.value}`)
const sourceCard = computed(() => {
  const width = result.value?.sourceWidth ?? sourceDimensions.value?.width
  const height = result.value?.sourceHeight ?? sourceDimensions.value?.height
  return { dimensions: width && height ? `${width} × ${height}` : '', size: source.value ? formatStoredSize(source.value.size, locale.value) : '' }
})
function measureSource(event: Event) {
  const image = event.target as HTMLImageElement
  sourceDimensions.value = { width: image.naturalWidth, height: image.naturalHeight }
}
function setSourcePreview(file: File | undefined) {
  if (sourceUrl.value) URL.revokeObjectURL(sourceUrl.value)
  sourceUrl.value = ''; sourceDimensions.value = undefined; sourcePreviewFailed.value = false
  if (!file) return
  try { sourceUrl.value = URL.createObjectURL(file) }
  catch { sourcePreviewFailed.value = true }
}
function clearResult() {
  if (outputUrl.value) URL.revokeObjectURL(outputUrl.value)
  outputUrl.value = ''; result.value = undefined
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
  error.value = ''; message.value = ''
  if (!files.length) return
  if (files.length !== 1) { error.value = 'multiple_files'; return }
  const file = files[0]!
  validating.value = true
  try {
    const code = await validateImageInput(file)
    const signature = code ? undefined : imageSignature(new Uint8Array(await file.slice(0, 16).arrayBuffer()))
    if (current !== generation) return
    if (code) { error.value = code; return }
    clearResult(); source.value = file; sourceFormat.value = signature; message.value = 'selected'
  }
  catch { if (current === generation) error.value = 'read_failed' }
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
async function compress() {
  if (!source.value || busy.value || !capabilities.value?.supported) return
  clearResult(); error.value = ''; running.value = true; stage.value = 'reading'
  const current = ++generation
  // Every accepted image fits within the largest side, so the output keeps the source dimensions.
  const outcome = await engine.run({ file: source.value, format: format.value, quality: recommendedQuality, maxWidth: imageInputLimits.maxSide, maxHeight: imageInputLimits.maxSide }, { onProgress: progress => { stage.value = progress.stage } })
  if (current !== generation || !mounted) return
  running.value = false
  if (outcome.status === 'cancelled') message.value = 'cancelled'
  else if (outcome.status === 'error') error.value = outcome.error.code
  else {
    try {
      outputUrl.value = URL.createObjectURL(outcome.output.blob)
      result.value = outcome.output; message.value = 'success'
    }
    catch { clearResult(); error.value = 'memory_limit' }
  }
}
function cancel() {
  ++generation; engine.cancel(); running.value = false; validating.value = false
  stage.value = ''; clearResult(); message.value = 'cancelled'
}
function reset() { cancel(); source.value = undefined; sourceFormat.value = undefined; error.value = ''; message.value = ''; fileInput.value?.focus() }
// A new image already clears the result; only choosing another format makes an output stale.
watch(chosenFormat, () => { clearResult(); error.value = '' })
watch(source, setSourcePreview)
onMounted(prepare)
onBeforeUnmount(() => { mounted = false; ++generation; engine.dispose(); clearResult(); setSourcePreview(undefined); source.value = undefined })
</script>

<template>
  <Card class="tool-workspace image-compressor">
    <div class="image-compressor__picker field-group" @dragover.prevent @drop.prevent="selectFiles(Array.from($event.dataTransfer?.files ?? []))">
      <Image :size="24" aria-hidden="true" />
      <label for="compressor-file">{{ locale === 'en' ? 'Choose image' : '選擇圖片' }}</label>
      <input id="compressor-file" ref="fileInput" class="ui-input" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" :disabled="busy" aria-describedby="compressor-formats compressor-error" :aria-invalid="Boolean(error)" @change="choose">
      <p id="compressor-formats" class="field-help">JPEG · PNG · WebP · {{ locale === 'en' ? 'One image, up to 25 MiB / 24 MP. You can also drop a file here.' : '單張最多 25 MiB／2,400 萬像素。也可將檔案拖曳至此。' }}</p>
      <p class="field-help">{{ heicMessage[locale] }}</p>
    </div>
    <p v-if="preparing" role="status" class="field-help">{{ locale === 'en' ? 'Checking local image capabilities…' : '正在檢查本機圖片處理能力…' }}</p>
    <div v-else-if="capabilities && !capabilities.supported" class="capability-warning">
      <p>{{ compressorErrors.unsupported_browser![locale] }}</p>
      <Button variant="outline" @click="prepare">{{ locale === 'en' ? 'Check again' : '重新檢查' }}</Button>
    </div>
    <form :aria-busy="running" @submit.prevent="compress">
      <fieldset :disabled="busy" class="image-compressor__settings">
        <legend>{{ locale === 'en' ? 'Output settings' : '輸出設定' }}</legend>
        <div class="tool-workspace__grid">
          <div class="field-group">
            <label for="compressor-format">{{ locale === 'en' ? 'Output format' : '輸出格式' }}</label>
            <select id="compressor-format" v-model="format" class="ui-input" aria-describedby="compressor-format-help">
              <option v-for="item in offeredFormats" :key="item" :value="item">{{ item.replace('image/', '').toUpperCase() }}</option>
            </select>
            <p id="compressor-format-help" class="field-help">{{ locale === 'en' ? 'Only available encoders are offered. JPEG and WebP images keep their format by default. JPEG fills transparent areas with white.' : '只提供可用的編碼格式。JPEG、WebP 預設沿用原格式；JPEG 透明區會補白。' }}</p>
          </div>
        </div>
        <p class="field-help">{{ locale === 'en' ? 'Output keeps the original dimensions; JPEG and WebP use a recommended quality. After compression, the output thumbnail appears next to the original.' : '輸出維持原圖尺寸；JPEG／WebP 以建議品質壓縮。壓縮後輸出縮圖會出現在原圖旁。' }}</p>
      </fieldset>
      <div class="tool-workspace__actions">
        <Button type="submit" :disabled="!source || busy || !capabilities?.supported">{{ locale === 'en' ? 'Compress image' : '壓縮圖片' }}</Button>
        <Button v-if="busy" type="button" variant="outline" @click="cancel">{{ locale === 'en' ? 'Cancel' : '取消' }}</Button>
        <Button v-if="source && !busy" type="button" variant="outline" @click="reset">{{ locale === 'en' ? 'Clear image' : '清除圖片' }}</Button>
      </div>
    </form>
    <p id="compressor-error" role="alert" class="field-error"><TriangleAlert v-if="errorText" :size="18" aria-hidden="true" />{{ errorText }}</p>
    <p role="status" class="image-compressor__status">{{ status }}</p>
    <div v-if="running && stage" role="progressbar" :aria-label="imageStages[stage]?.[locale]" class="field-help">{{ locale === 'en' ? 'Working locally; you can cancel at any time.' : '正在本機處理，可隨時取消。' }}</div>
    <div v-if="source" class="image-compressor__cards">
      <figure class="image-compressor__card" data-image-original>
        <div class="image-compressor__thumb">
          <img v-if="sourceUrl && !sourcePreviewFailed" :src="sourceUrl" :alt="locale === 'en' ? 'Original image thumbnail' : '原圖縮圖'" decoding="async" @load="measureSource" @error="sourcePreviewFailed = true">
          <p v-else class="image-compressor__thumb-empty"><ImageOff :size="20" aria-hidden="true" />{{ locale === 'en' ? 'No preview available' : '無法顯示預覽' }}</p>
        </div>
        <figcaption>
          <strong class="image-compressor__card-title">{{ locale === 'en' ? 'Original' : '原圖' }}</strong>
          <dl>
            <div v-if="sourceCard.dimensions"><dt>{{ locale === 'en' ? 'Dimensions' : '尺寸' }}</dt><dd>{{ sourceCard.dimensions }}</dd></div>
            <div><dt>{{ locale === 'en' ? 'File size' : '檔案大小' }}</dt><dd>{{ sourceCard.size }}</dd></div>
          </dl>
        </figcaption>
      </figure>
      <figure v-if="result" class="image-compressor__card" data-image-result>
        <div class="image-compressor__thumb">
          <img :src="outputUrl" :alt="locale === 'en' ? 'Compressed image thumbnail' : '壓縮後縮圖'" decoding="async">
        </div>
        <figcaption>
          <strong class="image-compressor__card-title">{{ locale === 'en' ? 'Output' : '輸出' }}</strong>
          <dl>
            <div><dt>{{ locale === 'en' ? 'Dimensions' : '尺寸' }}</dt><dd>{{ result.width }} × {{ result.height }}</dd></div>
            <div><dt>{{ locale === 'en' ? 'File size' : '檔案大小' }}</dt><dd>{{ formatStoredSize(result.blob.size, locale) }}</dd></div>
          </dl>
          <span class="image-compressor__change" :class="{ 'image-compressor__change--larger': grew }">{{ change }}</span>
        </figcaption>
      </figure>
    </div>
    <template v-if="result">
      <p v-if="sizeNote" class="field-help">{{ sizeNote }}</p>
      <Button as-child class="image-compressor__download"><a :href="outputUrl" :download="downloadName"><Download :size="18" aria-hidden="true" />{{ locale === 'en' ? 'Download image' : '下載圖片' }}</a></Button>
    </template>
  </Card>
</template>
