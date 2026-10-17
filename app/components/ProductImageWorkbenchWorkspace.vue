<script setup lang="ts">
import { computed, ref } from 'vue'
import { Play, Redo2, Undo2, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import ImageBatchDownload from '@/components/ImageBatchDownload.vue'
import ImageBatchPicker from '@/components/ImageBatchPicker.vue'
import ImageBatchStrip from '@/components/ImageBatchStrip.vue'
import PromoCanvas from '@/components/PromoCanvas.vue'
import PromoLayers from '@/components/PromoLayers.vue'
import { useProductWorkbench, type WorkbenchJobs } from '@/composables/useProductWorkbench'
import { usePromoShortcuts } from '@/composables/usePromoShortcuts'
import { copy } from '@/features/tools/catalog'
import type { PromoLayerKind } from '@/features/tools/brand-promo-image/scene'
import { modelPreparationIssues } from '@/features/tools/image-background-remover/content'
import { workbenchArchiveName } from '@/features/tools/product-image-workbench/archive'
import { workbenchErrors, workbenchJobHints, workbenchJobLabels, workbenchStages } from '@/features/tools/product-image-workbench/content'

/**
 * One screen for a batch of product photos: the photos under the canvas they
 * are laid out on, and beside them the three jobs to run on every one — the
 * cutout, the layout and the compression, each the tool it comes from — with
 * one button that runs them all and the downloads once they are done.
 */
const { locale } = useAppLocale()
const en = computed(() => locale.value === 'en')
const workbench = useProductWorkbench()
const {
  batch, items, selected, editor, jobs, format, offeredFormats, removerSupported, compressorCapabilities, removerCapabilities,
  running, runningId, stage, waiting, message, issue, busy, anyJob, pending, done, downloads, cutouts, model,
  start, cancel, retry, remove, clear, add,
} = workbench
const { canUndo, canRedo, undo, redo, importFile, supported: composeSupported, preparing: composeChecking, error: editorError } = editor
const picker = ref<InstanceType<typeof ImageBatchPicker>>()
const layerInput = ref<HTMLInputElement>()
const layerKind = ref<PromoLayerKind>('background')
/** Set by the layers panel while a typed number is out of range. */
const invalid = ref(false)
const shortcut = usePromoShortcuts(editor, busy)
const jobKeys: (keyof WorkbenchJobs)[] = ['cutout', 'compose', 'compress']
const layerKinds: PromoLayerKind[] = ['background', 'frame', 'logo']
const layerLabels = computed(() => en.value ? { background: 'Background', frame: 'Frame', logo: 'Logo', product: 'Product' } : { background: '背景', frame: '框版', logo: 'Logo', product: '商品圖' })
const several = computed(() => items.value.length > 1)
const checking = computed(() => !removerCapabilities.value || !compressorCapabilities.value || composeChecking.value)
const formatName = (value: string) => value.replace('image/', '').toUpperCase()

/** Why a job cannot be ticked on this device, if it cannot. */
function unavailable(job: keyof WorkbenchJobs) {
  if (checking.value) return false
  if (job === 'cutout') return !removerSupported.value
  if (job === 'compose') return !composeSupported.value
  return !compressorCapabilities.value?.supported
}

/** What the photo on screen looks like without a layout: its result, its cutout, or the photo itself. */
const plain = computed(() => {
  const item = selected.value
  if (!item) return undefined
  if (item.status === 'done' && item.result) return { url: item.result.url, alpha: item.result.format !== 'image/jpeg' }
  const cutout = jobs.cutout ? cutouts.value[item.id] : undefined
  return cutout ? { url: cutout.url, alpha: true } : { url: item.url, alpha: false }
})
const runLabel = computed(() => {
  if (issue.value) return en.value ? 'Try again' : '重試'
  if (pending.value === items.value.length) return several.value ? (en.value ? `Process all ${pending.value}` : `全部處理（${pending.value} 張）`) : (en.value ? 'Process' : '開始處理')
  return en.value ? `Process the other ${pending.value}` : `處理剩下的 ${pending.value} 張`
})
const status = computed(() => {
  if (waiting.value) return en.value ? 'Getting ready. Background removal starts on its own when it is done.' : '準備中，完成後會自動開始去背。'
  if (running.value) {
    const step = stage.value ? workbenchStages[stage.value][locale.value] : ''
    const position = items.value.findIndex(item => item.id === runningId.value) + 1
    return en.value ? `Image ${position} of ${items.value.length}: ${step}` : `第 ${position}／${items.value.length} 張：${step}`
  }
  if (message.value === 'cancelled') return en.value ? 'Cancelled. Your originals are unchanged; you can carry on.' : '已取消。原圖未變更，可以繼續處理。'
  if (message.value === 'done') return en.value ? `${done.value.length} of ${items.value.length} images done.` : `完成 ${done.value.length}／${items.value.length} 張。`
  return ''
})
const errorText = computed(() => {
  if (invalid.value) return copy(workbenchErrors.invalid_options!, locale.value)
  if (issue.value) return modelPreparationIssues[issue.value][locale.value]
  if (editorError.value) return copy(workbenchErrors[editorError.value] ?? workbenchErrors.failed!, locale.value)
  const item = selected.value
  if (several.value || item?.status !== 'failed' || !item.error) return ''
  return copy(workbenchErrors[item.error] ?? workbenchErrors.failed!, locale.value)
})

function pickLayer(kind: PromoLayerKind) {
  layerKind.value = kind
  layerInput.value?.click()
}
function chooseLayer(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) void importFile(file, layerKind.value)
  input.value = ''
}
function removePhoto(id: string) {
  remove(id)
  if (!items.value.length) picker.value?.focus()
}
</script>

<template>
  <Card class="tool-workspace workbench product-image-workbench" :data-model-ready="String(model.ready.value)" :aria-busy="busy" @keydown="shortcut">
    <p v-if="checking" role="status" class="capability-checking">{{ en ? 'Checking what this browser can do…' : '正在確認這個瀏覽器能做哪些事…' }}</p>

    <ImageBatchPicker ref="picker" :count="batch.held.value.count" :bytes="batch.held.value.bytes" :limits="batch.limits.value" @add="add" @clear="clear" />

    <!-- The picture on the left, every control on the right, as in the brand promo image. -->
    <div v-if="selected" class="workbench__layout">
      <div class="workbench__stage">
        <ImageBatchStrip
          v-if="several"
          class="workbench__strip"
          :items="items"
          :selected-id="selected.id"
          :disabled="busy"
          :messages="workbenchErrors"
          @select="batch.select"
          @remove="removePhoto"
          @retry="retry"
        />
        <PromoCanvas v-if="jobs.compose" :editor="editor" :locked="busy" />
        <figure v-else-if="plain" class="workbench__plain" data-workbench-preview>
          <div class="workbench__view" :class="{ 'workbench__view--alpha': plain.alpha }">
            <img :src="plain.url" :alt="en ? 'Preview of the image on screen' : '目前這張圖片的預覽'" decoding="async">
          </div>
        </figure>
        <p v-if="jobs.compose" id="promo-stage-help" class="field-help workbench__help">
          {{ en
            ? 'The photo on screen sits in the product layer. Drag a layer to move it, a corner to resize it.'
            : '目前這張商品圖放在商品圖層裡。拖曳圖層可移動，拖曳四角可縮放。' }}
        </p>
      </div>

      <div class="workbench__panel">
        <fieldset class="workbench__jobs" :disabled="busy">
          <legend>{{ en ? 'For every photo' : '每張都要做的事' }}</legend>
          <div v-for="job in jobKeys" :key="job" class="workbench__job" :data-workbench-job="job">
            <label class="choice-option workbench__toggle">
              <input v-model="jobs[job]" type="checkbox" :disabled="unavailable(job)" :aria-describedby="`workbench-${job}-hint`">
              {{ workbenchJobLabels[job][locale] }}
            </label>
            <p :id="`workbench-${job}-hint`" class="field-help">
              {{ unavailable(job) ? (en ? 'This browser cannot do this on your device.' : '這個瀏覽器無法在本機完成這一步。') : workbenchJobHints[job][locale] }}
            </p>
            <select v-if="job === 'compress' && jobs.compress" id="workbench-format" v-model="format" class="ui-input workbench__format" :aria-label="en ? 'Output format' : '輸出格式'">
              <option value="auto">{{ en ? 'Automatic format' : '自動選格式' }}</option>
              <option v-for="item in offeredFormats" :key="item" :value="item">{{ formatName(item) }}</option>
            </select>
            <div v-if="job === 'compose' && jobs.compose" class="workbench__layer-tools">
              <Button
                v-for="kind in layerKinds"
                :key="kind"
                variant="outline"
                :data-workbench-add="kind"
                :aria-label="(en ? 'Add ' : '加入') + layerLabels[kind]"
                aria-describedby="promo-error"
                @click="pickLayer(kind)"
              >
                {{ layerLabels[kind] }}
              </Button>
            </div>
          </div>
        </fieldset>
        <!-- One picker for the three layer buttons, outside the list so it is a single element. -->
        <input ref="layerInput" class="brand-promo__file" type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" tabindex="-1" aria-hidden="true" data-workbench-layer-input @change="chooseLayer">

        <div v-if="waiting" class="image-background-remover__preparing" data-model-preparing>
          <p class="image-background-remover__preparing-label">
            <span>{{ en ? 'Getting ready' : '準備中' }}</span>
            <span aria-hidden="true">{{ model.percent.value }}%</span>
          </p>
          <div class="offline-asset__progress" role="progressbar" :aria-valuenow="model.percent.value" aria-valuemin="0" aria-valuemax="100" :aria-label="en ? 'Getting background removal ready' : '去背功能準備進度'">
            <span :style="{ inlineSize: `${model.percent.value}%` }" />
          </div>
        </div>

        <div v-if="busy || pending || issue || jobs.compose" class="workbench__actions">
          <template v-if="jobs.compose">
            <Button size="icon" variant="outline" :disabled="busy || !canUndo" :aria-label="en ? 'Undo' : '復原'" :title="en ? 'Undo (Ctrl/⌘ Z)' : '復原（Ctrl／⌘ Z）'" aria-keyshortcuts="Control+z Meta+z" @click="undo"><Undo2 :size="18" aria-hidden="true" /></Button>
            <Button size="icon" variant="outline" :disabled="busy || !canRedo" :aria-label="en ? 'Redo' : '重做'" :title="en ? 'Redo (Ctrl/⌘ Shift Z)' : '重做（Ctrl／⌘ Shift Z）'" aria-keyshortcuts="Control+Shift+z Meta+Shift+z" @click="redo"><Redo2 :size="18" aria-hidden="true" /></Button>
          </template>
          <Button v-if="busy" variant="outline" class="workbench__primary" @click="cancel"><X :size="18" aria-hidden="true" />{{ en ? 'Cancel' : '取消' }}</Button>
          <Button v-else-if="pending || issue" class="workbench__primary" :disabled="!anyJob || invalid" data-workbench-run @click="start">
            <Play :size="18" aria-hidden="true" />{{ runLabel }}
          </Button>
        </div>
        <p role="status" class="workbench__status">{{ status }}</p>
        <p id="promo-error" role="alert" class="field-error">{{ errorText }}</p>
        <ImageBatchDownload :files="downloads" :archive-name="workbenchArchiveName" :disabled="busy" />
        <PromoLayers v-if="jobs.compose" v-model:invalid="invalid" class="workbench__layers" :editor="editor" :locked="busy" />
      </div>
    </div>
  </Card>
</template>
