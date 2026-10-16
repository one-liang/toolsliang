<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { ImageOff, Info, LoaderCircle, RotateCcw, TriangleAlert, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import ImageBatchDownload from '@/components/ImageBatchDownload.vue'
import ImageBatchPicker from '@/components/ImageBatchPicker.vue'
import ImageBatchStrip from '@/components/ImageBatchStrip.vue'
import { useImageBatch, type ImageBatchItem } from '@/composables/useImageBatch'
import { useBackgroundRemovalModel } from '@/composables/useBackgroundRemovalModel'
import { nameImageOutputs } from '@/features/images/archive'
import { formatStoredSize } from '@/features/shell/local-assets/usage'
import { copy } from '@/features/tools/catalog'
import { createBackgroundRemover } from '@/features/tools/image-background-remover/engine'
import { backgroundRemovalErrors, backgroundRemovalStages, modelPreparationIssues, portraitScopeNotice } from '@/features/tools/image-background-remover/content'
import type { BackgroundRemovalOutput } from '@/features/tools/image-background-remover/types'
import type { EngineCapabilities } from '@/features/tools/engine/contract'

interface Cutout { output: BackgroundRemovalOutput, url: string }

/**
 * One screen for one portrait or a batch: the whole original and the whole
 * cutout side by side, sized to the window, never scrolled inside. The cutout
 * is the heavy part, so it waits for one press of 開始去背 and then works
 * through every waiting picture in turn, one at a time.
 */
const { locale } = useAppLocale()
const en = computed(() => locale.value === 'en')
const engine = createBackgroundRemover()
const capabilities = shallowRef<EngineCapabilities>()
const preparing = ref(false)
const batch = useImageBatch<Cutout>({ release: result => URL.revokeObjectURL(result.url) })
const { items, selected, held, limits } = batch
const picker = ref<InstanceType<typeof ImageBatchPicker>>()
const running = ref(false)
const runningId = ref<string>()
const stage = ref('')
/** Pressed start while the model was still on its way; the run follows on its own. */
const waiting = ref(false)
/** Nothing runs until the visitor presses start, and again once a batch has been worked through. */
const paused = ref(true)
const message = ref<'cancelled' | ''>('')
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

/** A picture that cannot be read or is over the limits stays refused however often it is tried. */
const finalErrors = new Set(['unsupported_format', 'unsupported_heic', 'too_large', 'corrupt_image'])
const supported = computed(() => Boolean(capabilities.value?.supported))
const busy = computed(() => running.value || waiting.value)
const several = computed(() => items.value.length > 1)
const pending = computed(() => items.value.filter(item => item.status === 'pending').length)
const done = computed(() => items.value.filter((item): item is ImageBatchItem<Cutout> & { result: Cutout } => item.status === 'done' && Boolean(item.result)))
const result = computed(() => selected.value?.status === 'done' ? selected.value.result : undefined)
const size = (bytes: number) => formatStoredSize(bytes, locale.value)
useWorkspaceDirty('image-background-remover', computed(() => items.value.length > 0 || busy.value))

const startLabel = computed(() => {
  if (issue.value) return en.value ? 'Try again' : '重試'
  if (several.value && pending.value > 1) return en.value ? `Remove backgrounds (${pending.value})` : `開始去背（${pending.value} 張）`
  return en.value ? 'Remove background' : '開始去背'
})
const errorText = computed(() => {
  if (issue.value) return modelPreparationIssues[issue.value][locale.value]
  const item = selected.value
  if (several.value || item?.status !== 'failed' || !item.error) return ''
  return (backgroundRemovalErrors[item.error] ?? backgroundRemovalErrors.failed)![locale.value]
})
const status = computed(() => {
  if (waiting.value) return en.value ? 'Getting ready. Background removal starts on its own when it is done.' : '準備中，完成後會自動開始去背。'
  if (running.value) {
    const step = backgroundRemovalStages[stage.value]?.[locale.value] ?? ''
    if (!several.value) return step
    const position = items.value.findIndex(item => item.id === runningId.value) + 1
    return en.value ? `Image ${position} of ${items.value.length}: ${step}` : `第 ${position}／${items.value.length} 張：${step}`
  }
  if (message.value === 'cancelled') return en.value ? 'Cancelled. Your original is unchanged; you can retry.' : '已取消。原圖未變更，可重新去背。'
  return ''
})

/** A matte that keeps almost everything or almost nothing is the shape a wrong subject takes. */
const coverageHint = computed(() => {
  if (!result.value) return ''
  const share = result.value.output.coverage
  if (share < 0.02) return en.value ? 'Almost nothing was kept. This model only recognises people — check that the photo contains a person.' : '幾乎沒有保留任何內容。這個模型只認得人，請確認照片裡有人物。'
  if (share > 0.97) return en.value ? 'Almost nothing was removed. The subject may fill the frame, or the model may not have found a person.' : '幾乎沒有移除任何背景。可能主體占滿畫面，或模型沒有找到人物。'
  return ''
})
/** The tool's own name for every cutout, never the original's: background-removed.png, then -2, -3 and so on. */
const downloads = computed(() => {
  const names = nameImageOutputs(done.value.map(() => ({ name: 'background-removed.png', format: 'image/png' })), '')
  return done.value.map((item, index) => ({ name: names[index]!, blob: item.result.output.blob }))
})

async function prepare() {
  preparing.value = true
  const value = await engine.prepare()
  if (!mounted) return
  capabilities.value = value
  preparing.value = false
}

/** Stops whatever is running without touching the cutouts already made. */
function interrupt() {
  ++generation
  engine.cancel()
  if (runningId.value) batch.update(runningId.value, { status: 'pending' })
  running.value = false
  runningId.value = undefined
  waiting.value = false
  stage.value = ''
}

/**
 * Works through the waiting pictures one at a time. Starting never asks the
 * visitor to fetch anything first: if the model is still on its way, this
 * waits for the same attempt choosing the photo started and carries on into
 * the run, and if it cannot arrive, it says why.
 */
async function pump() {
  if (running.value || waiting.value || paused.value || !supported.value || !mounted) return
  const item = items.value.find(entry => entry.status === 'pending')
  if (!item) { paused.value = true; return }
  const current = ++generation
  if (!modelReady.value) {
    waiting.value = true
    const outcome = await prepareModel()
    if (current !== generation || !mounted) return
    waiting.value = false
    if (outcome !== 'ready') {
      // Only this workspace cancels, and it moves on to a new generation when it does.
      issue.value = outcome === 'cancelled' ? 'failed' : outcome
      paused.value = true
      return
    }
  }
  if (!items.value.some(entry => entry.id === item.id && entry.status === 'pending')) return void pump()
  running.value = true
  runningId.value = item.id
  stage.value = 'reading'
  batch.update(item.id, { status: 'running', error: undefined })
  const outcome = await engine.run({ file: item.file }, { onProgress: (next) => { if (current === generation) stage.value = next.stage } })
  if (current !== generation || !mounted) return
  running.value = false
  runningId.value = undefined
  stage.value = ''
  if (!items.value.some(entry => entry.id === item.id)) return void pump()
  if (outcome.status === 'cancelled') batch.update(item.id, { status: 'pending' })
  else if (outcome.status === 'error') {
    // The browser can clear stored files on its own. The worker then finds
    // them missing or cut short, and the next try gets them ready again.
    if (outcome.error.code === 'model_download_failed' || outcome.error.code === 'model_digest_mismatch') {
      forgetModel()
      issue.value = 'failed'
      paused.value = true
      batch.update(item.id, { status: 'pending' })
    }
    else batch.update(item.id, { status: 'failed', error: outcome.error.code, retryable: !finalErrors.has(outcome.error.code) })
  }
  else {
    try { batch.update(item.id, { status: 'done', result: { output: outcome.output, url: URL.createObjectURL(outcome.output.blob) } }) }
    catch { batch.update(item.id, { status: 'failed', error: 'insufficient_memory', retryable: true }) }
  }
}

function start() {
  if (!supported.value || busy.value) return
  issue.value = ''
  message.value = ''
  paused.value = false
  void pump()
}

/** Stopping while the model is on its way also stops the transfer, so cancelling never keeps spending the visitor's data. */
function cancel() {
  interrupt()
  cancelModel()
  paused.value = true
  message.value = 'cancelled'
}

function retry(id: string) {
  batch.update(id, { status: 'pending', error: undefined, retryable: true })
  start()
}

function remove(id: string) {
  if (id === runningId.value) interrupt()
  batch.remove(id)
  if (!items.value.length) picker.value?.focus()
}

/**
 * Clearing the photos is not a cancellation: a visitor who swaps one photo for
 * another still wants the tool, so the model keeps arriving in the background.
 */
function clear() {
  interrupt()
  paused.value = true
  issue.value = ''
  message.value = ''
  batch.clear()
}

function add(files: File[]) {
  message.value = ''
  batch.add(files)
}

watch(items, () => { void pump() })
/**
 * Choosing a photo is the first sign a visitor means to use the tool, so the
 * model starts arriving then and overlaps with the time spent looking at the
 * photo. Opening the page alone fetches nothing: a visitor only looking around
 * should not pay for megabytes they never use. §12.8 also keeps a device that
 * cannot run the model from fetching it at all. How this background attempt
 * ends is only reported if the visitor asks to start.
 */
watch([() => items.value.length > 0, supported], ([chosen, capable]) => {
  if (chosen && capable && !modelReady.value) void prepareModel()
})
onMounted(prepare)
onBeforeUnmount(() => { mounted = false; ++generation; engine.dispose() })
</script>

<template>
  <Card
    class="tool-workspace image-background-remover"
    :data-capabilities="capabilities ? (capabilities.supported ? 'supported' : 'unsupported') : 'checking'"
    :data-model-ready="String(modelReady)"
  >
    <!-- Said before a photo is chosen; once there is a cutout, an empty-looking result says it again where it matters. -->
    <p v-if="!items.length" class="image-background-remover__scope"><Info :size="16" aria-hidden="true" />{{ copy(portraitScopeNotice, locale) }}</p>

    <p v-if="preparing" role="status" class="field-help">{{ en ? 'Checking whether this browser can remove backgrounds…' : '正在確認這個瀏覽器能不能去背…' }}</p>
    <div v-else-if="capabilities && !capabilities.supported" class="capability-warning">
      <p>{{ backgroundRemovalErrors.unsupported_browser![locale] }}</p>
      <Button variant="outline" @click="prepare">{{ en ? 'Check again' : '重新檢查' }}</Button>
    </div>

    <ImageBatchPicker ref="picker" :count="held.count" :bytes="held.bytes" :limits="limits" @add="add" @clear="clear" />

    <div v-if="selected" class="image-background-remover__layout">
      <section class="image-background-remover__stage" :aria-label="en ? 'Preview' : '預覽'">
        <figure class="image-background-remover__frame" data-image-original>
          <div class="image-background-remover__view">
            <img :src="selected.url" :alt="en ? 'Original image preview' : '原圖預覽'" decoding="async">
          </div>
          <figcaption>
            <strong>{{ en ? 'Original' : '原圖' }}</strong>
            <span v-if="selected.size">{{ selected.size.width }} × {{ selected.size.height }}</span>
            <span>{{ size(selected.file.size) }}</span>
          </figcaption>
        </figure>
        <figure v-if="result" class="image-background-remover__frame" data-image-result>
          <div class="image-background-remover__view image-background-remover__view--alpha">
            <img :src="result.url" :alt="en ? 'Preview of the cutout on a checkered transparency background' : '去背結果預覽，透明處以格紋表示'" decoding="async">
          </div>
          <figcaption>
            <strong>{{ en ? 'Transparent output' : '透明背景結果' }}</strong>
            <span>{{ result.output.width }} × {{ result.output.height }}</span>
            <span>{{ size(result.output.blob.size) }}</span>
          </figcaption>
        </figure>
        <figure v-else class="image-background-remover__frame" aria-hidden="true">
          <div class="image-background-remover__view image-background-remover__view--empty">
            <span class="image-background-remover__placeholder">
              <ImageOff v-if="selected.status === 'failed'" :size="22" />
              <LoaderCircle v-else-if="selected.status === 'running'" :size="22" class="image-background-remover__spin" />
              {{ selected.status === 'failed' ? (en ? 'No cutout' : '沒有結果') : selected.status === 'running' ? (en ? 'Removing the background…' : '去背中…') : (en ? 'The cutout appears here' : '去背結果會出現在這裡') }}
            </span>
          </div>
          <figcaption><strong>{{ en ? 'Transparent output' : '透明背景結果' }}</strong></figcaption>
        </figure>
      </section>

      <div class="image-background-remover__panel">
        <p v-if="several" class="image-background-remover__count" data-remover-summary>
          {{ en ? `${done.length} of ${items.length} images done` : `${done.length}／${items.length} 張完成` }}
        </p>

        <form class="image-background-remover__start" :aria-busy="busy" @submit.prevent="start">
          <div v-if="pending || issue || busy" class="tool-workspace__actions">
            <!-- After a preparation problem the same button retries, so focus stays where the visitor already is. -->
            <Button v-if="!busy" type="submit" :disabled="!supported">
              <RotateCcw v-if="issue" :size="18" aria-hidden="true" />{{ startLabel }}
            </Button>
            <Button v-else type="button" variant="outline" @click="cancel"><X :size="18" aria-hidden="true" />{{ en ? 'Cancel' : '取消' }}</Button>
          </div>
          <div v-if="waiting" class="image-background-remover__preparing" data-model-preparing>
            <p class="image-background-remover__preparing-label">
              <span>{{ en ? 'Getting ready' : '準備中' }}</span>
              <!-- The progress bar carries the value for assistive technology. -->
              <span aria-hidden="true">{{ modelPercent }}%</span>
            </p>
            <div
              class="offline-asset__progress"
              role="progressbar"
              :aria-valuenow="modelPercent"
              aria-valuemin="0"
              aria-valuemax="100"
              :aria-label="en ? 'Getting background removal ready' : '去背功能準備進度'"
            >
              <span :style="{ inlineSize: `${modelPercent}%` }" />
            </div>
          </div>
          <div v-if="running && stage" role="progressbar" class="image-background-remover__bar" :aria-label="backgroundRemovalStages[stage]?.[locale]"><span /></div>
        </form>
        <p role="status" class="image-background-remover__status">{{ status }}</p>

        <div v-if="errorText" class="image-background-remover__error">
          <p id="remover-error" role="alert" class="field-error"><TriangleAlert :size="18" aria-hidden="true" />{{ errorText }}</p>
          <Button v-if="!issue && selected.status === 'failed' && selected.retryable" variant="outline" @click="retry(selected.id)"><RotateCcw :size="18" aria-hidden="true" />{{ en ? 'Try again' : '重試' }}</Button>
        </div>
        <p v-else id="remover-error" role="alert" class="field-error" />

        <ImageBatchDownload :files="downloads" :archive-name="'background-removed.zip'" :disabled="busy" />

        <template v-if="result">
          <p v-if="coverageHint" class="field-help image-background-remover__coverage">{{ coverageHint }}</p>
          <p class="field-help">{{ en ? 'Hair, semi-transparent areas and low-contrast edges are the usual weak spots — check the edges before you use it.' : '髮絲、半透明與低對比的邊緣最容易出錯，使用前請確認邊緣。' }}</p>
        </template>
      </div>

      <ImageBatchStrip
        v-if="several"
        class="image-background-remover__strip"
        :items="items"
        :selected-id="selected.id"
        :disabled="busy"
        :messages="backgroundRemovalErrors"
        @select="batch.select"
        @remove="remove"
        @retry="retry"
      />
    </div>
  </Card>
</template>
