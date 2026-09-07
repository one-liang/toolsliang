<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { Download, Image, TriangleAlert } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { validateImageInput } from '@/features/images/input'
import { createImageCompressor } from '@/features/tools/image-compressor/engine'
import { heicMessage, imageErrors, imageStages } from '@/features/tools/image-compressor/content'
import type { CompressionOutput, ImageFormat } from '@/features/tools/image-compressor/types'
import type { EngineCapabilities } from '@/features/tools/engine/contract'

const { locale } = useAppLocale()
const engine = createImageCompressor()
const capabilities = shallowRef<EngineCapabilities>()
const preparing = ref(false)
const source = shallowRef<File>()
const result = shallowRef<CompressionOutput>()
const outputUrl = ref('')
const originalUrl = ref('')
const format = ref<ImageFormat>('image/jpeg')
const quality = ref<string | number>(80)
const maxWidth = ref<string | number>(1920)
const maxHeight = ref<string | number>(1920)
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
const errorText = computed(() => error.value ? (imageErrors[error.value] ?? imageErrors.failed)![locale.value] : '')
const status = computed(() => {
  if (stage.value && running.value) return imageStages[stage.value]?.[locale.value] ?? ''
  if (message.value === 'cancelled') return locale.value === 'en' ? 'Cancelled. Your original is unchanged; you can retry.' : '已取消。原檔未變更，可重新處理。'
  if (message.value === 'selected') return locale.value === 'en' ? 'Image selected. Choose settings and compress to preview.' : '已選擇圖片。調整設定並壓縮即可預覽。'
  if (message.value === 'success') return locale.value === 'en' ? 'Image ready. Compare the actual size before downloading.' : '圖片已完成，請比較實際大小後下載。'
  return ''
})
const savings = computed(() => source.value && result.value ? Math.round((1 - result.value.blob.size / source.value.size) * 100) : 0)
const extension = computed(() => result.value?.format === 'image/jpeg' ? 'jpg' : result.value?.format === 'image/webp' ? 'webp' : 'png')
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
  if (value.supported && !value.formats.includes(format.value)) format.value = value.formats[0] as ImageFormat
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
    if (current !== generation) return
    if (code) { error.value = code; return }
    clearResult(); source.value = file; message.value = 'selected'
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
  clearResult(); error.value = ''; running.value = true; stage.value = ''
  const current = ++generation
  const outcome = await engine.run({ file: source.value, format: format.value, quality: Number(quality.value) / 100, maxWidth: Number(maxWidth.value), maxHeight: Number(maxHeight.value) }, { onProgress: progress => { stage.value = progress.stage } })
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
    catch { clearResult(); error.value = 'memory_limit' }
  }
}
function cancel() {
  ++generation; engine.cancel(); running.value = false; validating.value = false
  stage.value = ''; clearResult(); message.value = 'cancelled'
}
function reset() { cancel(); source.value = undefined; error.value = ''; message.value = ''; fileInput.value?.focus() }
watch([format, quality, maxWidth, maxHeight], () => { clearResult(); error.value = '' })
onMounted(prepare)
onBeforeUnmount(() => { mounted = false; ++generation; engine.dispose(); clearResult(); source.value = undefined })
</script>

<template>
  <Card class="tool-workspace image-compressor">
    <p class="eyebrow">{{ locale === 'en' ? 'Less space, on your device' : '圖片瘦身，就在你的裝置' }}</p>
    <div class="image-compressor__picker field-group" @dragover.prevent @drop.prevent="selectFiles(Array.from($event.dataTransfer?.files ?? []))">
      <Image :size="24" aria-hidden="true" />
      <label for="compressor-file">{{ locale === 'en' ? 'Choose image' : '選擇圖片' }}</label>
      <input id="compressor-file" ref="fileInput" class="ui-input" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" :disabled="busy" aria-describedby="compressor-formats compressor-error" :aria-invalid="Boolean(error)" @change="choose">
      <p id="compressor-formats" class="field-help">JPEG · PNG · WebP · {{ locale === 'en' ? 'One image, up to 25 MiB / 24 MP. You can also drop a file here.' : '單張最多 25 MiB／2,400 萬像素。也可將檔案拖曳至此。' }}</p>
      <p class="field-help">{{ heicMessage[locale] }}</p>
    </div>
    <p v-if="source" class="image-compressor__filename">{{ source.name }} · {{ size(source.size) }}</p>
    <p v-if="preparing" role="status" class="field-help">{{ locale === 'en' ? 'Checking local image capabilities…' : '正在檢查本機圖片處理能力…' }}</p>
    <div v-else-if="capabilities && !capabilities.supported" class="capability-warning">
      <p>{{ imageErrors.unsupported_browser![locale] }}</p>
      <Button variant="outline" @click="prepare">{{ locale === 'en' ? 'Check again' : '重新檢查' }}</Button>
    </div>
    <form :aria-busy="running" @submit.prevent="compress">
      <fieldset :disabled="busy" class="image-compressor__settings">
        <legend>{{ locale === 'en' ? 'Output settings' : '輸出設定' }}</legend>
        <div class="tool-workspace__grid">
          <div class="field-group">
            <label for="compressor-format">{{ locale === 'en' ? 'Output format' : '輸出格式' }}</label>
            <select id="compressor-format" v-model="format" class="ui-input" aria-describedby="compressor-format-help">
              <option v-for="item in (capabilities?.supported ? capabilities.formats : ['image/jpeg', 'image/png', 'image/webp'])" :key="item" :value="item">{{ item.replace('image/', '').toUpperCase() }}</option>
            </select>
            <p id="compressor-format-help" class="field-help">{{ locale === 'en' ? 'Only available encoders are offered. JPEG fills transparent areas with white.' : '只提供可用的編碼格式。JPEG 透明區會補白。' }}</p>
          </div>
          <div class="field-group">
            <label for="compressor-quality">{{ locale === 'en' ? 'Quality (0–100)' : '品質（0–100）' }}</label>
            <Input id="compressor-quality" v-model="quality" type="number" min="0" max="100" step="1" required :disabled="format === 'image/png'" aria-describedby="compressor-quality-help" />
            <p id="compressor-quality-help" class="field-help">{{ locale === 'en' ? 'PNG ignores quality. Lower JPEG/WebP quality trades detail for size.' : 'PNG 不使用品質參數。JPEG／WebP 品質越低，細節可能越少。' }}</p>
          </div>
          <div class="field-group"><label for="compressor-width">{{ locale === 'en' ? 'Maximum width' : '最大寬度' }}</label><Input id="compressor-width" v-model="maxWidth" type="number" min="1" max="8192" step="1" required /></div>
          <div class="field-group"><label for="compressor-height">{{ locale === 'en' ? 'Maximum height' : '最大高度' }}</label><Input id="compressor-height" v-model="maxHeight" type="number" min="1" max="8192" step="1" required /></div>
        </div>
        <p class="field-help">{{ locale === 'en' ? 'Keeps proportions; never enlarges. Dimensions are in pixels. Preview appears after compression.' : '保持比例、不放大，尺寸單位為像素。壓縮後顯示比較預覽。' }}</p>
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
    <div v-if="result && source" class="tool-workspace__grid image-compressor__comparison">
      <figure data-image-original>
        <figcaption>{{ locale === 'en' ? 'Original' : '原圖' }} · {{ result.sourceWidth }} × {{ result.sourceHeight }} · {{ size(source.size) }}</figcaption>
        <img :src="originalUrl" :alt="locale === 'en' ? 'Original image preview' : '原圖預覽'">
      </figure>
      <figure data-image-result>
        <figcaption>{{ locale === 'en' ? 'Output' : '輸出' }} · {{ result.width }} × {{ result.height }} · {{ size(result.blob.size) }}</figcaption>
        <img :src="outputUrl" :alt="locale === 'en' ? 'Compressed image preview' : '壓縮圖片預覽'">
      </figure>
    </div>
    <template v-if="result">
      <p class="field-help">{{ savings >= 0 ? (locale === 'en' ? `${savings}% smaller` : `減少 ${savings}%`) : (locale === 'en' ? `${-savings}% larger — keep the original if you prefer.` : `增加 ${-savings}% — 可以選擇保留原檔。`) }}</p>
      <Button as-child class="image-compressor__download"><a :href="outputUrl" :download="`compressed-image.${extension}`"><Download :size="18" aria-hidden="true" />{{ locale === 'en' ? 'Download image' : '下載圖片' }}</a></Button>
    </template>
  </Card>
</template>
