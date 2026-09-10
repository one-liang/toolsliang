<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { CircleCheck, Download, RotateCcw, Trash2, TriangleAlert, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useBackgroundRemovalModel } from '@/composables/useBackgroundRemovalModel'
import { useProductImageWorkbench } from '@/composables/useProductImageWorkbench'
import { copy } from '@/features/tools/catalog'
import { heicMessage } from '@/features/images/messages'
import { formatAssetSize } from '@/features/pwa/offline-assets'
import { portraitScopeNotice } from '@/features/tools/image-background-remover/content'
import { planPlacement } from '@/features/tools/compliant-product-image/domain/placement'
import { compliantImagePresets, type CompliantImagePresetRule } from '@/features/tools/compliant-product-image/domain/reference'
import { checkOutputAgainstPreset, ruleDispositions } from '@/features/tools/compliant-product-image/domain/preset'
import {
  compliantImageChannelLabels,
  compliantImageNotices,
  compliantImageRoleLabels,
  compliantImageSizeIssues,
  constraintKindLabels,
  describeRuleValue,
  presetStatusLabels,
  ruleDispositionLabels,
} from '@/features/tools/compliant-product-image/content'
import {
  describeSizeIssue,
  formatMimeTypes,
  formatOfMimeType,
  resolveOccupancyGuides,
  resolveSafeAreaInsets,
} from '@/features/tools/compliant-product-image/domain/render'
import { planBrandScene } from '@/features/tools/product-image-workbench/pipeline'
import { workbenchOutputName } from '@/features/tools/product-image-workbench/archive'
import { workbenchItemStatus, workbenchStepStatus } from '@/features/tools/product-image-workbench/queue'
import { promoPlacement } from '@/features/tools/brand-promo-image/scene'
import { workbenchPurposes, workbenchSteps, type WorkbenchStep } from '@/features/tools/product-image-workbench/session'
import {
  workbenchAdmissionMessage,
  workbenchArchiveIssues,
  workbenchBlockMessage,
  workbenchErrorMessage,
  workbenchItemLabel,
  workbenchItemStatusLabels,
  workbenchLimitsNotice,
  workbenchLocalNotice,
  workbenchPurposeLabels,
  workbenchPurposeSummaries,
  workbenchQueueSummary,
  workbenchStages,
  workbenchStepErrors,
  workbenchStepLabels,
  workbenchStepStateLabels,
  workbenchStepSummaries,
} from '@/features/tools/product-image-workbench/content'

const { locale, withLocale } = useAppLocale()
const en = computed(() => locale.value === 'en')
const workbench = useProductImageWorkbench()
const {
  archiveIssue, archiveSupported, archiveUrl, archiving, artifacts, availableFormats, bounds, brandSettings,
  buildArchive, busy, cancelAll, cancelItem, canRetryItem, chooseBrandAsset, choosePurpose, clearBrandAsset, compression,
  current, evaluationDate, failedStep, frame, frameSize, frameUrl, goTo, importFiles, importIssues, items,
  layoutSupported, limits, logo, logoSize, logoUrl, notice, outputs, pipeline, prepare, preparing, preset, presetDisabled,
  presetId, presetStatus, previewItem, previews, progress, purpose, queue, removeItem, reset, retryItem, runStep,
  runningStep, selectItem, selected, settings, sizes, skip, stages, usedBytes,
} = workbench

const heading = ref<HTMLElement>()
const queueHeading = ref<HTMLElement>()
const importInput = ref<HTMLInputElement>()
const {
  cancel: cancelModel, download, downloading: modelDownloading, failure: modelFailure,
  online, percent: modelPercent, ready: modelReady, totalBytes: modelBytes,
} = useBackgroundRemovalModel()

const status = (step: WorkbenchStep) => workbenchStepStatus(queue.value, step)
const currentStatus = computed(() => status(current.value))
const blockedReason = computed(() => pipeline.value.blocked[current.value])
const sizeIssue = computed(() => describeSizeIssue(bounds.value, Number(settings.value.width), Number(settings.value.height)))

/** Every distinct reason an item stopped on this step: an aggregate that hides one is worse than none. */
const stepErrors = computed(() => {
  const codes = items.value.map(item => item.session.errors[current.value]).filter((code): code is string => Boolean(code))

  return [...new Set(codes)].map(code => workbenchErrorMessage(current.value, code, locale.value))
})

const readyCount = computed(() => currentStatus.value.counts.ready)
const canRunLayout = computed(() => !busy.value && layoutSupported.value && !sizeIssue.value && !invalidLayoutField.value && readyCount.value > 0
  && (purpose.value !== 'compliant' || (!presetDisabled.value && availableFormats.value.length > 0)))

/**
 * The rail is numbered by the run, not by the module: a step this branch or this
 * device does not have stays listed with its reason, but takes no number —
 * otherwise its position in the list would disagree with the progress summary.
 */
const stepList = computed(() => {
  let position = 0

  return workbenchSteps.map((step) => {
    const state = status(step)

    return {
      step,
      state: state.state,
      counts: state.counts,
      order: state.state === 'unavailable' ? undefined : ++position,
      label: copy(workbenchStepLabels[step], locale.value),
      stateLabel: copy(workbenchStepStateLabels[state.state], locale.value),
      reachable: state.reachable,
    }
  })
})

const applicableSteps = computed(() => stepList.value.filter(item => item.order))
const currentOrder = computed(() => stepList.value.find(item => item.step === current.value)?.order ?? 0)
const progressText = computed(() => en.value
  ? `Step ${currentOrder.value} of ${applicableSteps.value.length}`
  : `第 ${currentOrder.value} 步，共 ${applicableSteps.value.length} 步`)
const queueSummary = computed(() => workbenchQueueSummary(progress.value, locale.value))

/** One row of the job queue: what it is, where it got to, and what can be done to it. */
const rows = computed(() => items.value.map((item) => {
  const state = workbenchItemStatus(item.session)
  const failed = failedStep(item.session)
  const output = outputs.value.find(entry => entry.id === item.id)
  const artifact = output ? artifacts.value[item.id]?.[output.step] : undefined
  const stage = stages.value[item.id]
  const produced = artifacts.value[item.id] ?? {}
  // The row shows the newest thing this item has, so progress is visible per row.
  const latest = produced.compress ?? produced.brand ?? produced.layout ?? produced.cutout

  return {
    id: item.id,
    ordinal: item.ordinal,
    label: workbenchItemLabel(item.ordinal, locale.value),
    state,
    stateLabel: copy(workbenchItemStatusLabels[state], locale.value),
    stageText: stage ? workbenchStages[stage]?.[locale.value] ?? '' : '',
    error: failed && item.session.errors[failed] ? workbenchErrorMessage(failed, item.session.errors[failed]!, locale.value) : '',
    canRetry: canRetryItem(item.session),
    running: state === 'running',
    preview: latest?.url ?? previews.value[item.id],
    alpha: latest?.format === 'image/png',
    size: sizes.value[item.id],
    bytes: item.bytes,
    download: artifact && output ? { url: artifact.url, name: workbenchOutputName(purpose.value, output.ordinal, artifact.format), bytes: artifact.bytes, width: artifact.width, height: artifact.height } : undefined,
  }
}))

const importMessages = computed(() => importIssues.value.map(issue => issue.kind === 'admission'
  ? workbenchAdmissionMessage(issue.code as 'too_many_items' | 'batch_too_large', limits.value, locale.value)
  : workbenchErrorMessage('import', issue.code, locale.value)))

const stageText = computed(() => {
  if (archiving.value) return workbenchStages.archiving?.[locale.value] ?? ''
  const running = rows.value.find(row => row.stageText)

  return running ? `${running.label}：${running.stageText}` : ''
})

const noticeText = computed(() => {
  if (stageText.value) return stageText.value
  const messages: Record<string, string> = en.value
    ? {
        'imported': 'Images added to the batch. Remove the background or go straight to layout.',
        'skipped': 'Step skipped for the batch. Everything you completed earlier is unchanged.',
        'cancelled': 'Cancelled. Items that finished keep their results and stay downloadable.',
        'step-done': 'Step finished. Check the queue, then continue with the next step.',
        'asset-added': 'Brand asset added to this session only.',
        'removed': 'Item removed from the batch. Nothing was kept on this device.',
        'archive-ready': 'The archive is packed on this device and ready to download.',
        'reset': 'Workbench cleared. Nothing was kept on this device.',
      }
    : {
        'imported': '已加入批次，可以整批去背，也可以直接進入版型。',
        'skipped': '整批已略過這一步，先前完成的步驟未變更。',
        'cancelled': '已取消。已完成的項目保留成果，仍可下載。',
        'step-done': '這一步結束了，確認佇列狀態後可以進行下一步。',
        'asset-added': '已加入品牌素材，只存在於這次作業。',
        'removed': '已從批次移除該項目，裝置上沒有留下任何內容。',
        'archive-ready': '封存檔已在這台裝置打包完成，可以下載。',
        'reset': '已清空工作台，裝置上沒有留下任何內容。',
      }
  return messages[notice.value] ?? ''
})

const modelStatus = computed(() => {
  if (modelReady.value) return en.value ? 'The model is on this device. The cutout works offline.' : '模型已在這台裝置，離線也能去背。'
  if (modelDownloading.value) return en.value ? `Downloading the model… ${modelPercent.value}%` : `正在下載模型…… ${modelPercent.value}%`
  if (!online.value) return en.value ? 'You are offline, so the model cannot be downloaded yet. You can skip the cutout.' : '目前離線，還無法下載模型；可以略過去背。'
  if (modelFailure.value === 'digest-mismatch') return en.value ? 'The downloaded file did not match the published fingerprint and was discarded. Download it again.' : '下載到的檔案與公布的指紋不符，已捨棄不使用。請重新下載。'
  if (modelFailure.value) return en.value ? 'The download did not finish. Nothing was kept, so you can try again.' : '下載未完成，已清除未完成的內容，可以重新下載。'
  return en.value
    ? `The cutout needs about ${formatAssetSize(modelBytes, 'en')} of model and runtime on this device. It is checked against a published fingerprint, can be cancelled, and is reused offline afterwards. Skipping the cutout needs no download.`
    : `去背需要約 ${formatAssetSize(modelBytes, 'zh-tw')} 的模型與推論資源留在這台裝置。下載內容會比對公布的指紋，隨時可取消，之後離線也能重複使用。略過去背則不需要下載。`
})

/** The canvas the preview frame stands for, and where the previewed item lands on it. */
const canvas = computed(() => ({ width: Number(settings.value.width) || 1, height: Number(settings.value.height) || 1 }))
const previewSize = computed(() => previewItem.value ? sizes.value[previewItem.value.id] : undefined)
const placement = computed(() => previewSize.value && !sizeIssue.value
  ? planPlacement({
      sourceWidth: previewSize.value.width,
      sourceHeight: previewSize.value.height,
      targetWidth: canvas.value.width,
      targetHeight: canvas.value.height,
      fit: settings.value.fit,
      zoom: Number(settings.value.zoom),
      offsetX: Number(settings.value.offsetX),
      offsetY: Number(settings.value.offsetY),
    })
  : undefined)
const previewArtifacts = computed(() => previewItem.value ? artifacts.value[previewItem.value.id] ?? {} : {})
const layoutPreviewUrl = computed(() => previewArtifacts.value.cutout?.url ?? (previewItem.value ? previews.value[previewItem.value.id] : ''))
const placementStyle = computed(() => {
  const spot = placement.value
  if (!spot) return undefined
  return {
    left: `${spot.x / canvas.value.width * 100}%`,
    top: `${spot.y / canvas.value.height * 100}%`,
    width: `${spot.width / canvas.value.width * 100}%`,
    height: `${spot.height / canvas.value.height * 100}%`,
  }
})
const occupancy = computed(() => purpose.value === 'compliant' ? resolveOccupancyGuides(preset.value, evaluationDate.value) : [])
const safeAreas = computed(() => purpose.value === 'compliant' ? resolveSafeAreaInsets(preset.value, evaluationDate.value) : [])
const guideInset = (ratio: number) => `${((1 - Math.sqrt(ratio)) / 2) * 100}%`

/** The finished file is judged by reading the file, never by trusting the settings. */
const previewOutput = computed(() => {
  const entry = previewItem.value && outputs.value.find(output => output.id === previewItem.value!.id)

  return entry ? previewArtifacts.value[entry.step] : undefined
})
const check = computed(() => {
  const result = previewOutput.value
  const format = result && formatOfMimeType(result.format)
  if (!result || !format || purpose.value !== 'compliant') return undefined
  return checkOutputAgainstPreset(preset.value, { width: result.width, height: result.height, format, bytes: result.bytes }, evaluationDate.value)
})
const ruleGroups = computed(() => {
  const outcome = check.value
  if (!outcome) return []
  return ruleDispositions
    .map(disposition => ({
      disposition,
      label: copy(ruleDispositionLabels[disposition], locale.value),
      rules: outcome.ruleIds[disposition]
        .map(id => preset.value.rules.find(rule => rule.id === id))
        .filter((rule): rule is CompliantImagePresetRule => Boolean(rule)),
    }))
    .filter(group => group.rules.length > 0)
})

/**
 * The brand preview is built from the scene the renderer is actually handed and
 * placed with the renderer's own geometry, so the two cannot drift: a Logo that
 * looks a quarter of a non-square canvas wide here is that wide in the file.
 */
const brandPreview = computed(() => {
  const product = previewArtifacts.value.layout
  if (!product) return []
  const { scene } = planBrandScene({
    canvas: { width: product.width, height: product.height },
    product: product.file,
    frame: frame.value,
    logo: logo.value,
    ...brandSettings.value,
  })
  const sources: Record<string, { url: string, width: number, height: number } | undefined> = {
    product: { url: product.url, width: product.width, height: product.height },
    frame: frameSize.value && { url: frameUrl.value, ...frameSize.value },
    logo: logoSize.value && { url: logoUrl.value, ...logoSize.value },
  }

  return scene.layers.flatMap((layer) => {
    const source = sources[layer.assetId]
    if (!source) return []
    const spot = promoPlacement(layer, source.width, source.height, scene.width, scene.height)

    return [{
      id: layer.id,
      url: source.url,
      style: {
        left: `${spot.x / scene.width * 100}%`,
        top: `${spot.y / scene.height * 100}%`,
        width: `${spot.width / scene.width * 100}%`,
        height: `${spot.height / scene.height * 100}%`,
        opacity: layer.opacity,
      },
    }]
  })
})

const logoFields = computed(() => [
  { key: 'logoScale' as const, label: en.value ? 'Logo scale (%)' : 'Logo 縮放（%）', min: 1, max: 400 },
  { key: 'logoX' as const, label: en.value ? 'Logo horizontal position (%)' : 'Logo 水平位置（%）', min: -100, max: 100 },
  { key: 'logoY' as const, label: en.value ? 'Logo vertical position (%)' : 'Logo 垂直位置（%）', min: -100, max: 100 },
  { key: 'logoOpacity' as const, label: en.value ? 'Logo opacity (%)' : 'Logo 不透明度（%）', min: 0, max: 100 },
])

const compressionFields = computed(() => [
  { key: 'quality' as const, label: en.value ? 'Quality (%)' : '品質（%）', min: 1, max: 100 },
  { key: 'maxWidth' as const, label: en.value ? 'Largest width (px)' : '最大寬度（像素）', min: 1, max: 8192 },
  { key: 'maxHeight' as const, label: en.value ? 'Largest height (px)' : '最大高度（像素）', min: 1, max: 8192 },
])

/**
 * A number field holds text while it is being typed, so the setting it feeds is
 * only replaced once the text is a number this step can actually use. A field
 * left mid-edit keeps its own invalid state instead of resetting under the
 * merchant, and nothing downstream ever sees a half-typed value.
 */
const numericFields = [
  { key: 'width' as const, min: 1, max: 8192, integer: true },
  { key: 'height' as const, min: 1, max: 8192, integer: true },
  { key: 'zoom' as const, min: 1, max: 400, integer: false },
  { key: 'offsetX' as const, min: -100, max: 100, integer: false },
  { key: 'offsetY' as const, min: -100, max: 100, integer: false },
]
const drafts = reactive<Record<string, string | number>>({})
const invalidFields = reactive<Record<string, boolean>>({})
// Scoped per step: a half-typed canvas width has no business blocking the Logo.
const invalidLayoutField = computed(() => numericFields.some(field => invalidFields[field.key]))
const invalidLogoField = computed(() => logoFields.value.some(field => invalidFields[field.key]))
const invalidCompressionField = computed(() => compressionFields.value.some(field => invalidFields[field.key]))

watch([settings, brandSettings, compression], () => {
  for (const field of numericFields) if (!invalidFields[field.key]) drafts[field.key] = settings.value[field.key]
  for (const field of logoFields.value) if (!invalidFields[field.key]) drafts[field.key] = brandSettings.value[field.key]
  for (const field of compressionFields.value) if (!invalidFields[field.key]) drafts[field.key] = compression.value[field.key]
}, { immediate: true, deep: true })

function setNumber(key: string, raw: string | number, field: { min: number, max: number, integer?: boolean }, apply: (value: number) => void) {
  drafts[key] = raw
  const value = Number(raw)
  invalidFields[key] = raw === '' || !Number.isFinite(value) || value < field.min || value > field.max || (field.integer === true && !Number.isInteger(value))
  if (!invalidFields[key]) apply(value)
}
function setLayoutNumber(key: 'width' | 'height' | 'zoom' | 'offsetX' | 'offsetY', raw: string | number) {
  const field = numericFields.find(item => item.key === key)!
  setNumber(key, raw, field, value => { settings.value = { ...settings.value, [key]: value } })
}
function setLogoNumber(key: 'logoScale' | 'logoX' | 'logoY' | 'logoOpacity', raw: string | number) {
  const field = logoFields.value.find(item => item.key === key)!
  setNumber(key, raw, field, value => { brandSettings.value = { ...brandSettings.value, [key]: value } })
}
function setCompressionNumber(key: 'quality' | 'maxWidth' | 'maxHeight', raw: string | number) {
  const field = compressionFields.value.find(item => item.key === key)!
  setNumber(key, raw, field, value => { compression.value = { ...compression.value, [key]: value } })
}

/** The step a merchant returns to: the nearest earlier step this run still has. */
const previousStep = computed(() => {
  const index = stepList.value.findIndex(item => item.step === current.value)

  return stepList.value.slice(0, index).filter(item => item.reachable).at(-1)?.step
})

function number(value: number) {
  return new Intl.NumberFormat(en.value ? 'en' : 'zh-TW').format(value)
}
function ruleLine(rule: CompliantImagePresetRule) {
  return `${copy(constraintKindLabels[rule.kind], locale.value)}${en.value ? ': ' : '：'}${describeRuleValue(rule, locale.value)}`
}
function chooseFiles(event: Event, take: (files: File[]) => void) {
  const input = event.target as HTMLInputElement
  const files = [...input.files ?? []]
  if (files.length) take(files)
  input.value = ''
}
async function downloadModel() {
  if (await download() === 'insufficient_storage') importIssues.value = [{ kind: 'input', code: 'insufficient_storage' }]
}
/**
 * Moving to a step deliberately moves the reading position with it. A step that
 * finishes on its own does not: the progress summary announces it, and taking
 * focus away from what someone just did is a change of context they did not ask
 * for.
 */
async function open(step: WorkbenchStep) {
  goTo(step)
  await nextTick()
  if (current.value === step) heading.value?.focus()
}

async function skipStep(step: WorkbenchStep) {
  skip(step)
  await nextTick()
  heading.value?.focus()
}

/**
 * Removing a row takes its buttons with it, so the reading position is put back
 * deliberately: on the row that moved into its place, or on the list itself when
 * the batch is now empty.
 */
async function dropItem(id: string) {
  const index = items.value.findIndex(item => item.id === id)
  removeItem(id)
  await nextTick()
  const next = items.value[Math.min(index, items.value.length - 1)]
  const target = next && document.querySelector<HTMLElement>(`[data-queue-item="${next.id}"] [data-queue-remove]`)
  // The list itself goes away with its last row, so the panel heading takes over.
  if (target) target.focus()
  else (queueHeading.value ?? heading.value)?.focus()
}
</script>

<template>
  <Card class="tool-workspace product-image-workbench" :aria-busy="busy">
    <p class="eyebrow">{{ en ? 'One local pass, from photos to a batch download' : '從原圖到整批下載，一次本機作業' }}</p>
    <p class="field-help">{{ copy(workbenchLocalNotice, locale) }}</p>

    <p v-if="preparing" role="status">{{ en ? 'Checking what this browser can run locally…' : '正在檢查這個瀏覽器可在本機執行的步驟…' }}</p>
    <div v-else-if="!layoutSupported" class="capability-warning">
      <p>{{ workbenchStepErrors.layout.unsupported_browser![locale] }}</p>
      <Button variant="outline" @click="prepare">{{ en ? 'Check again' : '重新檢查' }}</Button>
    </div>

    <nav class="workbench__steps" :aria-label="en ? 'Workbench steps' : '工作台步驟'">
      <ol>
        <li v-for="item in stepList" :key="item.step" :data-workbench-step="item.step" :data-workbench-state="item.state">
          <Button
            variant="outline"
            :aria-current="item.step === current ? 'step' : undefined"
            :disabled="!item.reachable || busy"
            @click="open(item.step)"
          >
            <CircleCheck v-if="item.state === 'done'" :size="16" aria-hidden="true" />
            <span>{{ item.order ? `${item.order}. ` : '' }}{{ item.label }}</span>
            <span class="workbench__state">{{ item.stateLabel }}</span>
          </Button>
        </li>
      </ol>
      <p role="status" class="field-help">{{ progressText }} · {{ queueSummary }}</p>
    </nav>

    <section class="workbench__panel" :data-workbench-panel="current" :aria-labelledby="`workbench-${current}`">
      <h2 :id="`workbench-${current}`" ref="heading" tabindex="-1">{{ copy(workbenchStepLabels[current], locale) }}</h2>
      <p class="field-help">{{ copy(workbenchStepSummaries[current], locale) }}</p>
      <p v-if="blockedReason" class="capability-warning">{{ workbenchBlockMessage(current, blockedReason, locale) }}</p>

      <template v-if="current === 'import'">
        <div class="field-group">
          <label for="workbench-file">{{ en ? 'Choose product images' : '選擇商品圖' }}</label>
          <input
            id="workbench-file"
            ref="importInput"
            class="ui-input"
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
            :disabled="busy"
            :aria-invalid="importMessages.length > 0"
            aria-describedby="workbench-import-help workbench-import-issues"
            @change="chooseFiles($event, files => importFiles(files))"
          >
          <p id="workbench-import-help" class="field-help">
            JPEG · PNG · WebP · {{ workbenchLimitsNotice(limits, locale) }}
            {{ en ? `Used so far: ${number(usedBytes)} bytes.` : `目前已使用 ${number(usedBytes)} bytes。` }}
            {{ en ? 'Each image: up to 25 MiB and 24 MP.' : '單張最多 25 MiB、2,400 萬像素。' }} {{ copy(heicMessage, locale) }}
          </p>
        </div>
        <div id="workbench-import-issues" role="alert" class="field-error">
          <p v-for="message in importMessages" :key="message"><TriangleAlert :size="16" aria-hidden="true" />{{ message }}</p>
        </div>
      </template>

      <template v-else-if="current === 'cutout'">
        <p class="workbench__scope">{{ copy(portraitScopeNotice, locale) }}</p>
        <p class="field-help">
          <NuxtLink :to="withLocale('/tools/image-background-remover/')">{{ en ? 'The portrait background remover, on its own page' : '單獨使用人像去背工具' }}</NuxtLink>
        </p>
        <div v-if="currentStatus.state !== 'unavailable'" class="workbench__model" data-workbench-model :data-model-ready="String(modelReady)">
          <p role="status">{{ modelStatus }}</p>
          <div v-if="modelDownloading" class="offline-asset__progress" role="progressbar" :aria-valuenow="modelPercent" aria-valuemin="0" aria-valuemax="100" :aria-label="en ? 'Model download progress' : '模型下載進度'">
            <span :style="{ inlineSize: `${modelPercent}%` }" />
          </div>
          <div v-if="!modelReady" class="tool-workspace__actions">
            <Button v-if="modelDownloading" variant="outline" @click="cancelModel"><X :size="16" aria-hidden="true" />{{ en ? 'Cancel download' : '取消下載' }}</Button>
            <Button v-else :disabled="!online" @click="downloadModel"><Download :size="16" aria-hidden="true" />{{ modelFailure ? (en ? 'Try again' : '重新下載') : (en ? 'Download the model' : '下載模型') }}</Button>
          </div>
        </div>
      </template>

      <template v-else-if="current === 'layout'">
        <fieldset class="workbench__controls" :disabled="busy">
          <legend>{{ en ? 'What is this batch for?' : '這批輸出的用途' }}</legend>
          <div v-for="option in workbenchPurposes" :key="option" class="workbench__purpose">
            <input :id="`workbench-purpose-${option}`" type="radio" name="workbench-purpose" :value="option" :checked="purpose === option" @change="choosePurpose(option)">
            <label :for="`workbench-purpose-${option}`">
              <strong>{{ copy(workbenchPurposeLabels[option], locale) }}</strong>
              <span class="field-help">{{ copy(workbenchPurposeSummaries[option], locale) }}</span>
            </label>
          </div>
        </fieldset>

        <div v-if="purpose === 'compliant'" class="field-group">
          <label for="workbench-preset">{{ en ? 'Channel preset' : '通路規格' }}</label>
          <select id="workbench-preset" v-model="presetId" class="ui-input" :disabled="busy">
            <option v-for="item in compliantImagePresets" :key="item.id" :value="item.id">
              {{ copy(compliantImageChannelLabels[item.channelId], locale) }} · {{ copy(compliantImageRoleLabels[item.role], locale) }}
            </option>
          </select>
          <p class="field-help">
            {{ en ? 'Reviewed' : '查核日' }} {{ preset.reviewedAt }} · {{ copy(presetStatusLabels[presetStatus], locale) }} ·
            <NuxtLink :to="withLocale('/tools/compliant-product-image/')">{{ en ? 'See every rule and its source' : '查看完整規則與來源' }}</NuxtLink>
          </p>
        </div>

        <div class="tool-workspace__grid">
          <div v-for="dimension in (['width', 'height'] as const)" :key="dimension" class="field-group">
            <label :for="`workbench-${dimension}`">{{ dimension === 'width' ? (en ? 'Width (px)' : '寬度（像素）') : (en ? 'Height (px)' : '高度（像素）') }}</label>
            <Input :id="`workbench-${dimension}`" :model-value="drafts[dimension]" type="number" min="1" max="8192" step="1" :disabled="busy" :aria-invalid="Boolean(sizeIssue) || Boolean(invalidFields[dimension])" aria-describedby="workbench-size-issue workbench-error" @update:model-value="setLayoutNumber(dimension, $event)" />
          </div>
          <div class="field-group">
            <label for="workbench-format">{{ en ? 'Output format' : '輸出格式' }}</label>
            <select id="workbench-format" v-model="settings.format" class="ui-input" :disabled="busy">
              <option v-for="format in availableFormats" :key="format" :value="formatMimeTypes[format]">{{ format.toUpperCase() }}</option>
            </select>
          </div>
          <div class="field-group">
            <label for="workbench-fit">{{ en ? 'Fit' : '填滿方式' }}</label>
            <select id="workbench-fit" v-model="settings.fit" class="ui-input" :disabled="busy">
              <option value="cover">{{ en ? 'Fill and crop' : '填滿裁切' }}</option>
              <option value="contain">{{ en ? 'Contain whole image' : '完整放入' }}</option>
            </select>
          </div>
          <div class="field-group">
            <label for="workbench-zoom">{{ en ? 'Zoom (%)' : '縮放（%）' }}</label>
            <Input id="workbench-zoom" :model-value="drafts.zoom" type="number" min="1" max="400" step="1" :disabled="busy" :aria-invalid="Boolean(invalidFields.zoom)" aria-describedby="workbench-number-help" @update:model-value="setLayoutNumber('zoom', $event)" />
          </div>
          <div class="field-group">
            <label for="workbench-offset-x">{{ en ? 'Horizontal position (%)' : '水平位置（%）' }}</label>
            <Input id="workbench-offset-x" :model-value="drafts.offsetX" type="number" min="-100" max="100" step="1" :disabled="busy" :aria-invalid="Boolean(invalidFields.offsetX)" aria-describedby="workbench-number-help" @update:model-value="setLayoutNumber('offsetX', $event)" />
          </div>
          <div class="field-group">
            <label for="workbench-offset-y">{{ en ? 'Vertical position (%)' : '垂直位置（%）' }}</label>
            <Input id="workbench-offset-y" :model-value="drafts.offsetY" type="number" min="-100" max="100" step="1" :disabled="busy" :aria-invalid="Boolean(invalidFields.offsetY)" aria-describedby="workbench-number-help" @update:model-value="setLayoutNumber('offsetY', $event)" />
          </div>
          <div class="field-group">
            <label for="workbench-background">{{ en ? 'Background colour' : '背景色' }}</label>
            <input id="workbench-background" v-model="settings.background" class="ui-input" type="color" :disabled="busy">
          </div>
        </div>
        <p id="workbench-size-issue" class="field-error">{{ sizeIssue ? copy(compliantImageSizeIssues[sizeIssue], locale) : invalidLayoutField ? workbenchStepErrors.layout.invalid_options![locale] : '' }}</p>
        <p id="workbench-number-help" class="field-help">{{ en ? 'These settings apply to every image in the batch. Zoom is 1–400% of the fitted size; position is −100–100% of the canvas, measured from the centre.' : '這些設定會套用到批次中的每一張。縮放為填入尺寸的 1–400%，位置為畫布的 −100–100%，從置中起算。' }}</p>

        <figure v-if="layoutPreviewUrl" class="workbench__figure">
          <div class="workbench__canvas" :style="{ aspectRatio: `${canvas.width} / ${canvas.height}`, background: settings.background, '--workbench-ratio': canvas.width / canvas.height }" role="img" :aria-label="en ? 'Layout preview on the output canvas' : '版型預覽，對應輸出畫布'">
            <img v-if="placementStyle" :src="layoutPreviewUrl" :style="placementStyle" alt="">
            <span v-for="guide in occupancy" :key="guide.ruleId" class="workbench__guide" :style="{ inset: guideInset(guide.ratio) }" aria-hidden="true" />
            <span v-for="guide in safeAreas" :key="guide.ruleId" class="workbench__guide workbench__guide--safe" :style="{ top: `${guide.top * 100}%`, right: `${guide.right * 100}%`, bottom: `${guide.bottom * 100}%`, left: `${guide.left * 100}%` }" aria-hidden="true" />
          </div>
          <figcaption>
            {{ previewItem ? workbenchItemLabel(previewItem.ordinal, locale) : '' }} · {{ canvas.width }} × {{ canvas.height }}
            <template v-if="occupancy.length"> · {{ en ? 'The dashed frame shows the product occupancy this channel asks for:' : '虛線輔助框標示這個通路要求的商品佔比：' }} {{ occupancy.map(guide => `${Math.round(guide.ratio * 100)}%`).join('、') }}</template>
            <template v-if="safeAreas.length"> · {{ en ? 'The dotted frame marks the keep-out margins (top / right / bottom / left):' : '點線框標示要求留白的邊界（上／右／下／左）：' }} {{ safeAreas.map(guide => [guide.top, guide.right, guide.bottom, guide.left].map(inset => `${Math.round(inset * 100)}%`).join(' / ')).join('、') }}</template>
          </figcaption>
        </figure>
      </template>

      <template v-else-if="current === 'brand'">
        <p class="field-help">
          <NuxtLink :to="withLocale('/tools/brand-promo-image/')">{{ en ? 'The brand promo image tool, on its own page' : '單獨使用品牌宣傳圖工具' }}</NuxtLink>
        </p>
        <div class="tool-workspace__grid">
          <div class="field-group">
            <label for="workbench-frame">{{ en ? 'Frame image' : '框版圖片' }}</label>
            <input id="workbench-frame" class="ui-input" type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" :disabled="busy" @change="chooseFiles($event, files => chooseBrandAsset('frame', files[0]!))">
            <p v-if="frame" class="field-help">{{ frame.name }} <Button variant="outline" :disabled="busy" @click="clearBrandAsset('frame')">{{ en ? 'Remove frame' : '移除框版' }}</Button></p>
          </div>
          <div class="field-group">
            <label for="workbench-logo">{{ en ? 'Logo image' : 'Logo 圖片' }}</label>
            <input id="workbench-logo" class="ui-input" type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" :disabled="busy" @change="chooseFiles($event, files => chooseBrandAsset('logo', files[0]!))">
            <p v-if="logo" class="field-help">{{ logo.name }} <Button variant="outline" :disabled="busy" @click="clearBrandAsset('logo')">{{ en ? 'Remove Logo' : '移除 Logo' }}</Button></p>
          </div>
        </div>
        <fieldset v-if="logo" class="workbench__controls" :disabled="busy">
          <legend>{{ en ? 'Logo placement' : 'Logo 位置' }}</legend>
          <div class="tool-workspace__grid">
            <div v-for="field in logoFields" :key="field.key" class="field-group">
              <label :for="`workbench-${field.key}`">{{ field.label }}</label>
              <Input :id="`workbench-${field.key}`" :model-value="drafts[field.key]" type="number" :min="field.min" :max="field.max" step="1" :aria-invalid="Boolean(invalidFields[field.key])" aria-describedby="workbench-error" @update:model-value="setLogoNumber(field.key, $event)" />
            </div>
          </div>
          <p class="field-help">{{ en ? 'The same frame, Logo, and placement are applied to every image in the batch. Position is measured from the centre as a share of the canvas. Version one has no text or price tags.' : '同一組框版、Logo 與位置會套用到批次中的每一張。位置從置中起算，以畫布百分比表示。第一版不含文字與價籤。' }}</p>
        </fieldset>
        <div v-if="previewArtifacts.layout" class="workbench__figure">
          <div class="workbench__canvas" :style="{ aspectRatio: `${previewArtifacts.layout.width} / ${previewArtifacts.layout.height}`, '--workbench-ratio': previewArtifacts.layout.width / previewArtifacts.layout.height }" role="img" :aria-label="en ? 'Brand composition preview' : '品牌素材組合預覽'">
            <img v-for="layer in brandPreview" :key="layer.id" :src="layer.url" :style="layer.style" alt="">
          </div>
        </div>
      </template>

      <template v-else-if="current === 'compress'">
        <p class="field-help">
          <NuxtLink :to="withLocale('/tools/image-compressor/')">{{ en ? 'The image compressor, on its own page' : '單獨使用圖片壓縮工具' }}</NuxtLink>
        </p>
        <div class="tool-workspace__grid">
          <div class="field-group">
            <label for="workbench-compress-format">{{ en ? 'Output format' : '輸出格式' }}</label>
            <select id="workbench-compress-format" v-model="compression.format" class="ui-input" :disabled="busy">
              <option value="image/jpeg">JPEG</option>
              <option value="image/webp">WEBP</option>
              <option value="image/png">PNG</option>
            </select>
          </div>
          <div v-for="field in compressionFields" :key="field.key" class="field-group">
            <label :for="`workbench-${field.key}`">{{ field.label }}</label>
            <Input :id="`workbench-${field.key}`" :model-value="drafts[field.key]" type="number" :min="field.min" :max="field.max" step="1" :disabled="busy" :aria-invalid="Boolean(invalidFields[field.key])" aria-describedby="workbench-compress-help" @update:model-value="setCompressionNumber(field.key, $event)" />
          </div>
        </div>
        <p id="workbench-compress-help" class="field-help">{{ en ? 'The same quality and size ceiling are applied to every image in the batch. PNG ignores quality. Re-encoding does not copy source metadata.' : '同一組品質與尺寸上限會套用到批次中的每一張；PNG 不使用品質設定。重新編碼不會複製來源中繼資料。' }}</p>
      </template>

      <template v-else>
        <p v-if="outputs.length === 0" class="field-help">{{ en ? 'Finish the earlier steps to produce outputs.' : '完成前面的步驟後才會產生輸出。' }}</p>
        <template v-else>
          <div class="tool-workspace__actions">
            <Button :disabled="busy || Boolean(archiveIssue) || !archiveSupported" @click="buildArchive">
              {{ en ? `Pack ${outputs.length} outputs into one archive` : `打包 ${outputs.length} 個輸出成封存檔` }}
            </Button>
            <Button v-if="archiveUrl" as-child>
              <a :href="archiveUrl" :download="`${purpose === 'compliant' ? 'compliant-product-image' : 'brand-promo-image'}s.zip`" data-archive-download>
                <Download :size="16" aria-hidden="true" />{{ en ? 'Download the archive' : '下載封存檔' }}
              </a>
            </Button>
          </div>
          <p v-if="archiveIssue" class="field-error">{{ copy(workbenchArchiveIssues[archiveIssue], locale) }}</p>
          <p v-else-if="!archiveSupported" class="field-error">{{ workbenchStepErrors.output.unsupported_browser![locale] }}</p>
          <p class="field-help">{{ en ? 'The archive is packed in this browser and never leaves the device. Re-encoded images do not copy source metadata. Keep your originals.' : '封存檔在這個瀏覽器內打包，不會離開裝置。重新編碼的圖片不複製來源中繼資料，請保留原始檔案。' }}</p>

          <figure v-if="previewOutput" class="workbench__figure">
            <img :src="previewOutput.url" :alt="en ? 'Final output preview' : '最終輸出預覽'">
            <figcaption>{{ previewItem ? workbenchItemLabel(previewItem.ordinal, locale) : '' }} · {{ previewOutput.width }} × {{ previewOutput.height }} · {{ previewOutput.format }} · {{ number(previewOutput.bytes) }} bytes</figcaption>
          </figure>

          <section v-if="check" class="workbench__check" :aria-label="en ? 'What was checked against this channel preset' : '對照通路規格的核對結果'">
            <p :data-workbench-check="check.result">
              <TriangleAlert v-if="check.result !== 'pass'" :size="16" aria-hidden="true" />
              <CircleCheck v-else :size="16" aria-hidden="true" />
              {{ check.result === 'pass'
                ? (en ? 'Every rule this tool can read off this file is satisfied. This is specification guidance, not a guarantee of channel approval.' : '這個檔案能被工具核對的規則都符合。這是規格輔助，不保證通路審核通過。')
                : check.result === 'fail'
                  ? (en ? 'At least one requirement this tool checks is not met. Adjust the layout and produce it again.' : '至少一項工具可核對的要求未符合，請回到版型調整後重新產生。')
                  : (en ? 'This preset is disabled, so nothing was checked.' : '這個通路規格已停用，未進行核對。') }}
            </p>
            <p class="field-help">{{ en ? 'Checked for the previewed item. Other items share the same settings but not necessarily the same file size.' : '這是預覽中項目的核對結果；其他項目設定相同，但檔案大小不一定相同。' }}</p>
            <p v-for="code in check.notices" :key="code" class="field-help">{{ copy(compliantImageNotices[code], locale) }}</p>
            <div v-for="group in ruleGroups" :key="group.disposition">
              <h3>{{ group.label }}</h3>
              <ul>
                <li v-for="rule in group.rules" :key="rule.id">{{ ruleLine(rule) }}</li>
              </ul>
            </div>
          </section>
        </template>
      </template>

      <div id="workbench-error" role="alert" class="field-error">
        <p v-for="message in stepErrors" :key="message"><TriangleAlert :size="16" aria-hidden="true" />{{ message }}</p>
      </div>

      <div class="tool-workspace__actions">
        <Button v-if="current === 'cutout' && currentStatus.state !== 'unavailable'" :disabled="busy || !modelReady || readyCount === 0" @click="runStep('cutout')">
          {{ en ? `Remove the background from ${readyCount} images` : `整批去背（${readyCount} 張）` }}
        </Button>
        <Button v-if="current === 'layout'" :disabled="!canRunLayout" @click="runStep('layout')">
          {{ en ? `Produce ${readyCount} layouts` : `整批產生版型（${readyCount} 張）` }}
        </Button>
        <Button v-if="current === 'brand' && currentStatus.state !== 'unavailable'" :disabled="busy || (!frame && !logo) || invalidLogoField || readyCount === 0" @click="runStep('brand')">
          {{ en ? `Compose ${readyCount} images` : `整批組合品牌素材（${readyCount} 張）` }}
        </Button>
        <Button v-if="current === 'compress' && currentStatus.state !== 'unavailable'" :disabled="busy || invalidCompressionField || readyCount === 0" @click="runStep('compress')">
          {{ en ? `Compress ${readyCount} images` : `整批壓縮（${readyCount} 張）` }}
        </Button>
        <Button v-if="busy && (runningStep || archiving)" variant="outline" @click="cancelAll">{{ en ? 'Cancel everything' : '全部取消' }}</Button>
        <Button v-if="(current === 'cutout' || current === 'brand' || current === 'compress') && currentStatus.state !== 'unavailable'" variant="outline" :disabled="busy" @click="skipStep(current)">
          {{ en ? 'Skip this step for the batch' : '整批略過這一步' }}
        </Button>
        <Button v-if="previousStep" variant="outline" :disabled="busy" @click="open(previousStep)">{{ en ? 'Back a step' : '回到前一步' }}</Button>
        <Button v-if="items.length" variant="outline" :disabled="busy" @click="reset">{{ en ? 'Clear the workbench' : '清空工作台' }}</Button>
      </div>
      <div v-if="runningStep" role="progressbar" :aria-label="en ? 'Local processing' : '本機處理'" class="field-help">{{ en ? 'Working locally. You can cancel; finished items keep their results.' : '正在本機處理，可隨時取消，已完成的項目會保留成果。' }}</div>
      <p role="status" class="workbench__status">{{ noticeText }}</p>
    </section>

    <section v-if="items.length" class="workbench__queue" aria-labelledby="workbench-queue-heading">
      <h2 id="workbench-queue-heading" ref="queueHeading" tabindex="-1">{{ en ? 'Batch queue' : '批次佇列' }}</h2>
      <p class="field-help">{{ en ? 'Every image runs its own pipeline. A failure stays on its own row.' : '每張圖片各自走自己的流程，失敗只留在自己這一列。' }}</p>
      <ul>
        <li v-for="row in rows" :key="row.id" :data-queue-item="row.id" :data-queue-state="row.state" :data-queue-selected="String(row.id === selected)">
          <img v-if="row.preview" :src="row.preview" alt="" class="workbench__thumb" :class="{ 'workbench__thumb--alpha': row.alpha }">
          <div class="workbench__queue-text">
            <p><strong>{{ row.label }}</strong> · <span data-queue-status>{{ row.stateLabel }}</span></p>
            <p class="field-help">
              {{ row.size ? `${row.size.width} × ${row.size.height} · ` : '' }}{{ number(row.bytes) }} bytes
              <template v-if="row.download"> · {{ en ? 'Output' : '輸出' }} {{ row.download.width }} × {{ row.download.height }} · {{ number(row.download.bytes) }} bytes</template>
              <template v-if="row.stageText"> · {{ row.stageText }}</template>
            </p>
            <p v-if="row.error" class="field-error">{{ row.error }}</p>
          </div>
          <div class="workbench__queue-actions">
            <Button v-if="row.download" variant="outline" as-child>
              <a :href="row.download.url" :download="row.download.name"><Download :size="16" aria-hidden="true" />{{ en ? `Download ${row.label}` : `下載${row.label}` }}</a>
            </Button>
            <Button v-if="row.running" variant="outline" @click="cancelItem(row.id)"><X :size="16" aria-hidden="true" />{{ en ? `Cancel ${row.label}` : `取消${row.label}` }}</Button>
            <Button v-if="row.canRetry" variant="outline" :disabled="busy" @click="retryItem(row.id)"><RotateCcw :size="16" aria-hidden="true" />{{ en ? `Retry ${row.label}` : `重試${row.label}` }}</Button>
            <Button v-if="row.id !== selected" variant="outline" :disabled="busy" @click="selectItem(row.id)">{{ en ? `Preview ${row.label}` : `預覽${row.label}` }}</Button>
            <Button variant="outline" :disabled="busy" data-queue-remove @click="dropItem(row.id)"><Trash2 :size="16" aria-hidden="true" />{{ en ? `Remove ${row.label}` : `移除${row.label}` }}</Button>
          </div>
        </li>
      </ul>
    </section>
  </Card>
</template>
