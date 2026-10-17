<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { ImageOff, LoaderCircle, Play, RotateCcw, TriangleAlert, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import ImageBatchDownload from '@/components/ImageBatchDownload.vue'
import ImageBatchPicker from '@/components/ImageBatchPicker.vue'
import ImageBatchStrip from '@/components/ImageBatchStrip.vue'
import { useImageBatch, type ImageBatchItem } from '@/composables/useImageBatch'
import { nameImageOutputs } from '@/features/images/archive'
import { imageInputLimits } from '@/features/images/limits'
import { formatStoredSize } from '@/features/shell/local-assets/usage'
import { createImageCompressor } from '@/features/tools/image-compressor/engine'
import { compressorErrors, imageStages } from '@/features/tools/image-compressor/content'
import { defaultOutputFormat, recommendedQuality } from '@/features/tools/image-compressor/output-settings'
import type { CompressionOutput, ImageFormat } from '@/features/tools/image-compressor/types'
import type { EngineCapabilities } from '@/features/tools/engine/contract'

interface Compressed { output: CompressionOutput, url: string }

/**
 * One screen for one picture or a batch of them: choose, and every picture is
 * compressed on this device in turn while the first one is already on screen.
 * The only setting is the output format, and changing it compresses the batch
 * again, so what is offered for download always matches what is shown.
 */
const { locale } = useAppLocale()
const en = computed(() => locale.value === 'en')
const engine = createImageCompressor()
const capabilities = shallowRef<EngineCapabilities>()
const preparing = ref(false)
const batch = useImageBatch<Compressed>({ release: result => URL.revokeObjectURL(result.url) })
const { items, selected, held, limits } = batch
const picker = ref<InstanceType<typeof ImageBatchPicker>>()
/** 'auto' lets each picture follow its own source; any other value is the visitor's choice for the whole batch. */
const choice = ref<'auto' | ImageFormat>('auto')
const running = ref(false)
const runningId = ref<string>()
const stage = ref('')
/** Set by Cancel: pictures that have not been compressed wait until the visitor continues. */
const paused = ref(false)
let generation = 0
let mounted = true

/** A picture that cannot be read or is over the limits stays refused however often it is tried. */
const finalErrors = new Set(['unsupported_format', 'unsupported_heic', 'too_large', 'corrupt_image'])
const offeredFormats = computed<ImageFormat[]>(() => capabilities.value?.supported ? capabilities.value.formats as ImageFormat[] : ['image/jpeg', 'image/png', 'image/webp'])
const supported = computed(() => Boolean(capabilities.value?.supported))
const sourceFormat = (item: ImageBatchItem) => (['image/jpeg', 'image/png', 'image/webp'] as const).find(type => type === item.file.type)
const formatFor = (item: ImageBatchItem) => choice.value !== 'auto' && offeredFormats.value.includes(choice.value) ? choice.value : defaultOutputFormat(sourceFormat(item), offeredFormats.value)
const formatName = (format: string) => format.replace('image/', '').toUpperCase()
const size = (bytes: number) => formatStoredSize(bytes, locale.value)
const busy = computed(() => running.value)
useWorkspaceDirty('image-compressor', computed(() => items.value.length > 0 || busy.value))

const done = computed(() => items.value.filter((item): item is ImageBatchItem<Compressed> & { result: Compressed } => item.status === 'done' && Boolean(item.result)))
const waiting = computed(() => items.value.filter(item => item.status === 'pending').length)
const several = computed(() => items.value.length > 1)
const result = computed(() => selected.value?.status === 'done' ? selected.value.result : undefined)

/** Whole percent, except that a change too small to round to 1% is not called 0%. */
function describeChange(before: number, after: number) {
  const ratio = after / before
  if (ratio === 1) return en.value ? 'Same size' : '大小相同'
  const percent = Math.round(Math.abs(1 - ratio) * 100)
  if (ratio < 1) return percent < 1 ? (en.value ? 'Less than 1% smaller' : '縮小不到 1%') : (en.value ? `${percent}% smaller` : `縮小 ${percent}%`)
  return percent < 1 ? (en.value ? 'Less than 1% larger' : '增加不到 1%') : (en.value ? `${percent}% larger` : `增加 ${percent}%`)
}
const change = computed(() => selected.value && result.value ? describeChange(selected.value.file.size, result.value.output.blob.size) : '')
const grew = computed(() => Boolean(selected.value && result.value && result.value.output.blob.size > selected.value.file.size))
const totals = computed(() => {
  const before = done.value.reduce((sum, item) => sum + item.file.size, 0)
  const after = done.value.reduce((sum, item) => sum + item.result.output.blob.size, 0)
  return { before, after, change: before ? describeChange(before, after) : '', grew: after > before }
})
const sizeNote = computed(() => {
  if (result.value?.output.keptOriginal) {
    return en.value
      ? 'The original is already compact, so compressing again would only make it larger. This kept the original image data and removed its metadata.'
      : '原圖已經很精簡，再壓縮只會變大，因此沿用原圖內容並移除中繼資料。'
  }
  if (grew.value) return en.value ? 'The output is larger than the original — keep the original if you prefer.' : '輸出比原檔大，可以保留原檔。'
  return ''
})
const formatHelp = computed(() => {
  if (choice.value === 'auto') return en.value ? 'Each image keeps its format; PNG shrinks by using fewer colours and keeps transparency.' : '每張都維持原格式；PNG 以減少顏色來縮小，保留透明背景。'
  if (choice.value === 'image/jpeg') return en.value ? 'Transparent areas become white.' : '透明處會補成白色。'
  if (choice.value === 'image/png') return en.value ? 'Shrinks by using fewer colours and keeps transparency; photos are usually smaller as JPEG.' : '以減少顏色來縮小，保留透明背景；照片改選 JPEG 通常更小。'
  return ''
})
const status = computed(() => {
  if (running.value) {
    const position = items.value.findIndex(item => item.id === runningId.value) + 1
    const step = imageStages[stage.value]?.[locale.value] ?? ''
    if (!several.value) return en.value ? `Compressing on this device… ${step}` : `正在本機壓縮…${step}`
    return en.value ? `Compressing ${position} of ${items.value.length}… ${step}` : `正在壓縮第 ${position}／${items.value.length} 張…${step}`
  }
  if (paused.value && waiting.value) {
    return en.value
      ? `Cancelled. Your originals are unchanged; continue to compress the remaining ${waiting.value}.`
      : `已取消。原圖未變更，按「繼續壓縮」完成剩下的 ${waiting.value} 張。`
  }
  return ''
})
const errorText = computed(() => {
  const item = selected.value
  if (item?.status !== 'failed' || !item.error) return ''
  return (compressorErrors[item.error] ?? compressorErrors.failed)![locale.value]
})
const downloads = computed(() => {
  const names = nameImageOutputs(done.value.map(item => ({ name: item.file.name, format: item.result.output.format })), 'compressed')
  return done.value.map((item, index) => ({ name: names[index]!, blob: item.result.output.blob }))
})

async function prepare() {
  preparing.value = true
  const value = await engine.prepare()
  if (!mounted) return
  capabilities.value = value
  preparing.value = false
  void pump()
}

/** Stops whatever is running without touching the results already made. */
function interrupt() {
  ++generation
  engine.cancel()
  if (runningId.value) batch.update(runningId.value, { status: 'pending' })
  running.value = false
  runningId.value = undefined
  stage.value = ''
}

/**
 * Compresses the next waiting picture, one at a time. The engine reads each
 * file itself, so a picture starts without waiting for its preview to be
 * measured; the watcher on the batch calls back here whenever a picture
 * changes state.
 */
async function pump() {
  if (running.value || paused.value || !supported.value || !mounted) return
  const item = items.value.find(entry => entry.status === 'pending')
  if (!item) return
  const current = ++generation
  running.value = true
  runningId.value = item.id
  stage.value = 'reading'
  batch.update(item.id, { status: 'running', error: undefined })
  // Every accepted image fits within the largest side, so the output keeps the source dimensions.
  const outcome = await engine.run(
    { file: item.file, format: formatFor(item), quality: recommendedQuality, maxWidth: imageInputLimits.maxSide, maxHeight: imageInputLimits.maxSide },
    { onProgress: (next) => { if (current === generation) stage.value = next.stage } },
  )
  if (!mounted || current !== generation) return
  running.value = false
  runningId.value = undefined
  stage.value = ''
  if (!items.value.some(entry => entry.id === item.id)) return
  if (outcome.status === 'cancelled') batch.update(item.id, { status: 'pending' })
  else if (outcome.status === 'error') batch.update(item.id, { status: 'failed', error: outcome.error.code, retryable: !finalErrors.has(outcome.error.code) })
  else {
    // The output is shown from the worker's small preview: the full picture is only needed for the download.
    try { batch.update(item.id, { status: 'done', result: { output: outcome.output, url: URL.createObjectURL(outcome.output.preview) } }) }
    catch { batch.update(item.id, { status: 'failed', error: 'memory_limit', retryable: true }) }
  }
}

function add(files: File[]) {
  paused.value = false
  batch.add(files)
}

function cancel() {
  interrupt()
  paused.value = true
}

function resume() {
  paused.value = false
  void pump()
}

function retry(id: string) {
  batch.update(id, { status: 'pending', error: undefined, retryable: true })
  paused.value = false
}

function remove(id: string) {
  if (id === runningId.value) interrupt()
  batch.remove(id)
  if (!items.value.length) picker.value?.focus()
}

function clear() {
  interrupt()
  paused.value = false
  batch.clear()
}

/** A new format makes every result stale: they are dropped at once and made again in the new format. */
watch(choice, () => {
  interrupt()
  for (const item of items.value) {
    if (item.status === 'done' || item.status === 'running' || (item.status === 'failed' && item.retryable)) batch.update(item.id, { status: 'pending', error: undefined, result: undefined })
  }
})
watch(items, () => { void pump() })
onMounted(prepare)
onBeforeUnmount(() => { mounted = false; ++generation; engine.dispose() })
</script>

<template>
  <Card class="tool-workspace image-compressor" :data-compressor-state="items.length ? 'working' : 'empty'" :aria-busy="busy">
    <p v-if="preparing" role="status" class="field-help">{{ en ? 'Checking local image capabilities…' : '正在檢查本機圖片處理能力…' }}</p>
    <div v-else-if="capabilities && !capabilities.supported" class="capability-warning">
      <p>{{ compressorErrors.unsupported_browser![locale] }}</p>
      <Button variant="outline" @click="prepare">{{ en ? 'Check again' : '重新檢查' }}</Button>
    </div>

    <ImageBatchPicker ref="picker" :count="held.count" :bytes="held.bytes" :limits="limits" @add="add" @clear="clear" />

    <div v-if="selected" class="image-compressor__layout">
      <section class="image-compressor__stage" :aria-label="en ? 'Preview' : '預覽'">
        <figure class="image-compressor__frame" data-image-original>
          <div class="image-compressor__view">
            <img :src="selected.url" :alt="en ? 'Original image thumbnail' : '原圖縮圖'" decoding="async">
          </div>
          <figcaption>
            <strong>{{ en ? 'Original' : '原圖' }}</strong>
            <span v-if="selected.size">{{ selected.size.width }} × {{ selected.size.height }}</span>
            <span>{{ size(selected.file.size) }}</span>
          </figcaption>
        </figure>
        <figure v-if="result" class="image-compressor__frame" data-image-result>
          <div class="image-compressor__view image-compressor__view--alpha">
            <img :src="result.url" :alt="en ? 'Compressed image thumbnail' : '壓縮後縮圖'" decoding="async">
          </div>
          <figcaption>
            <strong>{{ en ? 'Output' : '輸出' }} · {{ formatName(result.output.format) }}</strong>
            <span>{{ result.output.width }} × {{ result.output.height }}</span>
            <span>{{ size(result.output.blob.size) }}</span>
            <span class="image-compressor__change" :class="{ 'image-compressor__change--larger': grew }">{{ change }}</span>
          </figcaption>
        </figure>
        <figure v-else class="image-compressor__frame image-compressor__frame--pending" aria-hidden="true">
          <div class="image-compressor__view">
            <span class="image-compressor__placeholder">
              <ImageOff v-if="selected.status === 'failed'" :size="22" />
              <LoaderCircle v-else-if="selected.status === 'running'" :size="22" class="image-compressor__spin" />
              {{ selected.status === 'failed' ? (en ? 'No output' : '沒有輸出') : selected.status === 'running' ? (en ? 'Compressing…' : '壓縮中…') : (en ? 'Waiting' : '等待壓縮') }}
            </span>
          </div>
          <figcaption><strong>{{ en ? 'Output' : '輸出' }}</strong></figcaption>
        </figure>
      </section>

      <div class="image-compressor__panel">
        <div v-if="several && done.length" class="image-compressor__summary" data-compressor-summary>
          <p class="image-compressor__total" :class="{ 'image-compressor__total--larger': totals.grew }">{{ totals.change }}</p>
          <p class="image-compressor__total-sizes">
            {{ en ? `${done.length} of ${items.length} images` : `${done.length}／${items.length} 張` }} · {{ size(totals.before) }} → {{ size(totals.after) }}
          </p>
        </div>

        <div v-if="running || (paused && waiting)" class="image-compressor__progress">
          <div v-if="running" role="progressbar" class="image-compressor__bar" :aria-label="imageStages[stage]?.[locale] ?? (en ? 'Compressing' : '壓縮中')"><span /></div>
          <div class="image-compressor__progress-actions">
            <Button v-if="running" variant="outline" @click="cancel"><X :size="18" aria-hidden="true" />{{ en ? 'Cancel' : '取消' }}</Button>
            <Button v-else @click="resume"><Play :size="18" aria-hidden="true" />{{ en ? 'Continue' : '繼續壓縮' }}</Button>
          </div>
        </div>
        <p role="status" class="image-compressor__status">{{ status }}</p>

        <div v-if="!several && errorText" class="image-compressor__error">
          <p id="compressor-error" role="alert" class="field-error"><TriangleAlert :size="18" aria-hidden="true" />{{ errorText }}</p>
          <Button v-if="selected.retryable" variant="outline" @click="retry(selected.id)"><RotateCcw :size="18" aria-hidden="true" />{{ en ? 'Try again' : '重試' }}</Button>
        </div>
        <p v-else id="compressor-error" role="alert" class="field-error" />

        <ImageBatchDownload :files="downloads" :archive-name="'compressed-images.zip'" :disabled="running" />

        <div class="field-group image-compressor__format">
          <label for="compressor-format">{{ en ? 'Output format' : '輸出格式' }}</label>
          <select id="compressor-format" v-model="choice" class="ui-input" :disabled="!supported" :aria-describedby="formatHelp ? 'compressor-format-help' : undefined">
            <option value="auto">{{ en ? 'Automatic (recommended)' : '自動（建議）' }}</option>
            <option v-for="item in offeredFormats" :key="item" :value="item">{{ formatName(item) }}</option>
          </select>
          <p v-if="formatHelp" id="compressor-format-help" class="field-help">{{ formatHelp }}</p>
        </div>
        <p v-if="sizeNote" class="field-help image-compressor__note">{{ sizeNote }}</p>
      </div>

      <ImageBatchStrip
        v-if="several"
        class="image-compressor__strip"
        :items="items"
        :selected-id="selected.id"
        :messages="compressorErrors"
        @select="batch.select"
        @remove="remove"
        @retry="retry"
      />
    </div>
  </Card>
</template>
