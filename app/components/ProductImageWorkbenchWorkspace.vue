<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { CircleCheck, Download, TriangleAlert, X } from '@lucide/vue'
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
import { planBrandScene, workbenchOutputName } from '@/features/tools/product-image-workbench/pipeline'
import { promoPlacement } from '@/features/tools/brand-promo-image/scene'
import { isWorkbenchStepReachable, workbenchPurposes, workbenchSteps, type WorkbenchStep } from '@/features/tools/product-image-workbench/session'
import {
  workbenchBlockReasons,
  workbenchErrorMessage,
  workbenchLocalNotice,
  workbenchPurposeLabels,
  workbenchPurposeSummaries,
  workbenchStages,
  workbenchStepLabels,
  workbenchStepErrors,
  workbenchStepStateLabels,
  workbenchStepSummaries,
} from '@/features/tools/product-image-workbench/content'

const { locale, withLocale } = useAppLocale()
const en = computed(() => locale.value === 'en')
const workbench = useProductImageWorkbench()
const {
  artifacts, availableFormats, bounds, brandSettings, busy, cancel, chooseBrandAsset, choosePurpose,
  clearBrandAsset, composeBrand, evaluationDate, frame, frameSize, frameUrl, goTo, importSource, layoutSupported,
  logo, logoSize, logoUrl, noteError, notice, output, prepare, preparing, preset, presetDisabled,
  presetId, presetStatus, progress, removeBackground, renderLayout, reset, running, session, settings,
  skip, source, sourceSize, sourceUrl, stage,
} = workbench

const heading = ref<HTMLElement>()
const importInput = ref<HTMLInputElement>()
const {
  cancel: cancelModel, download, downloading: modelDownloading, failure: modelFailure,
  online, percent: modelPercent, ready: modelReady, totalBytes: modelBytes,
} = useBackgroundRemovalModel()

const current = computed(() => session.value.current)
const states = computed(() => session.value.states)
const errorCode = computed(() => session.value.errors[current.value])
const errorText = computed(() => errorCode.value ? workbenchErrorMessage(current.value, errorCode.value, locale.value) : '')
const blockedReason = computed(() => session.value.blocked[current.value])
const sizeIssue = computed(() => describeSizeIssue(bounds.value, Number(settings.value.width), Number(settings.value.height)))
const canRenderLayout = computed(() => Boolean(source.value) && !busy.value && layoutSupported.value && !sizeIssue.value && !invalidLayoutField.value
  && (session.value.purpose !== 'compliant' || (!presetDisabled.value && availableFormats.value.length > 0)))

/**
 * The rail is numbered by the run, not by the module: a step this branch or this
 * device does not have stays listed with its reason, but takes no number —
 * otherwise its position in the list would disagree with the progress summary.
 */
const stepList = computed(() => {
  let position = 0

  return workbenchSteps.map((step, index) => ({
    step,
    index,
    state: states.value[step],
    order: states.value[step] === 'unavailable' ? undefined : ++position,
    label: copy(workbenchStepLabels[step], locale.value),
    stateLabel: copy(workbenchStepStateLabels[states.value[step]], locale.value),
    reachable: isWorkbenchStepReachable(session.value, step),
  }))
})

const currentOrder = computed(() => stepList.value.find(item => item.step === current.value)?.order ?? 0)
const progressText = computed(() => en.value
  ? `Step ${currentOrder.value} of ${progress.value.total} · ${progress.value.completed} completed`
  : `第 ${currentOrder.value} 步，共 ${progress.value.total} 步 · 已完成 ${progress.value.completed} 步`)

const stageText = computed(() => running.value && stage.value ? workbenchStages[stage.value]?.[locale.value] ?? '' : '')
const noticeText = computed(() => {
  if (stageText.value) return stageText.value
  const messages: Record<string, string> = en.value
    ? {
        'imported': 'Product image ready. Remove the background or go straight to layout.',
        'skipped': 'Step skipped. Everything you completed earlier is unchanged.',
        'cancelled': 'Cancelled. The results of the earlier steps are unchanged, and you can retry this step.',
        'step-done': 'Step finished. Continue with the next step.',
        'asset-added': 'Brand asset added to this session only.',
        'reset': 'Workbench cleared. Nothing was kept on this device.',
      }
    : {
        'imported': '商品圖已就緒，可以去背，也可以直接進入版型。',
        'skipped': '已略過這一步，先前完成的步驟未變更。',
        'cancelled': '已取消。先前步驟的成果未變更，可重試這一步。',
        'step-done': '這一步已完成，可以進行下一步。',
        'asset-added': '已加入品牌素材，只存在於這次作業。',
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

/** The canvas the preview frame stands for, and where the product lands on it. */
const canvas = computed(() => ({ width: Number(settings.value.width) || 1, height: Number(settings.value.height) || 1 }))
const placement = computed(() => sourceSize.value && !sizeIssue.value
  ? planPlacement({
      sourceWidth: sourceSize.value.width,
      sourceHeight: sourceSize.value.height,
      targetWidth: canvas.value.width,
      targetHeight: canvas.value.height,
      fit: settings.value.fit,
      zoom: Number(settings.value.zoom),
      offsetX: Number(settings.value.offsetX),
      offsetY: Number(settings.value.offsetY),
    })
  : undefined)
const layoutPreviewUrl = computed(() => artifacts.value.cutout?.url ?? sourceUrl.value)
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
const occupancy = computed(() => session.value.purpose === 'compliant' ? resolveOccupancyGuides(preset.value, evaluationDate.value) : [])
const safeAreas = computed(() => session.value.purpose === 'compliant' ? resolveSafeAreaInsets(preset.value, evaluationDate.value) : [])
const guideInset = (ratio: number) => `${((1 - Math.sqrt(ratio)) / 2) * 100}%`

/** The finished file is judged by reading the file, never by trusting the settings. */
const check = computed(() => {
  const result = output.value
  const format = result && formatOfMimeType(result.format)
  if (!result || !format || session.value.purpose !== 'compliant') return undefined
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
  const product = artifacts.value.layout
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

watch([settings, brandSettings], () => {
  for (const field of numericFields) if (!invalidFields[field.key]) drafts[field.key] = settings.value[field.key]
  for (const field of logoFields.value) if (!invalidFields[field.key]) drafts[field.key] = brandSettings.value[field.key]
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

/** The step a merchant returns to: the nearest earlier step this run still has. */
const previousStep = computed(() => stepList.value
  .filter(item => item.reachable && item.index < stepList.value.find(entry => entry.step === current.value)!.index)
  .at(-1)?.step)

function number(value: number) {
  return new Intl.NumberFormat(en.value ? 'en' : 'zh-TW').format(value)
}
function ruleLine(rule: CompliantImagePresetRule) {
  return `${copy(constraintKindLabels[rule.kind], locale.value)}${en.value ? ': ' : '：'}${describeRuleValue(rule, locale.value)}`
}
function chooseFile(event: Event, take: (file: File) => void) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) take(file)
  input.value = ''
}
async function downloadModel() {
  if (await download() === 'insufficient_storage') noteError('cutout', 'insufficient_storage')
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
watch(() => session.value.errors.import, async (code) => {
  if (!code) return
  await nextTick()
  importInput.value?.focus()
})
</script>

<template>
  <Card class="tool-workspace product-image-workbench" :aria-busy="busy">
    <p class="eyebrow">{{ en ? 'One local pass, from photo to output' : '從原圖到輸出，一次本機作業' }}</p>
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
      <p role="status" class="field-help">{{ progressText }}</p>
    </nav>

    <section class="workbench__panel" :data-workbench-panel="current" :aria-labelledby="`workbench-${current}`">
      <h2 :id="`workbench-${current}`" ref="heading" tabindex="-1">{{ copy(workbenchStepLabels[current], locale) }}</h2>
      <p class="field-help">{{ copy(workbenchStepSummaries[current], locale) }}</p>
      <p v-if="blockedReason" class="capability-warning">{{ copy(workbenchBlockReasons[blockedReason], locale) }}</p>

      <template v-if="current === 'import'">
        <div class="field-group">
          <label for="workbench-file">{{ en ? 'Choose product image' : '選擇商品圖' }}</label>
          <input
            id="workbench-file"
            ref="importInput"
            class="ui-input"
            type="file"
            accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
            :disabled="busy"
            :aria-invalid="Boolean(errorCode)"
            aria-describedby="workbench-import-help workbench-error"
            @change="chooseFile($event, file => importSource(file))"
          >
          <p id="workbench-import-help" class="field-help">JPEG · PNG · WebP · {{ en ? 'One image, up to 25 MiB and 24 MP.' : '單張最多 25 MiB、2,400 萬像素。' }} {{ copy(heicMessage, locale) }}</p>
        </div>
        <figure v-if="sourceUrl" class="workbench__figure">
          <img :src="sourceUrl" :alt="en ? 'Imported product image preview' : '匯入的商品圖預覽'">
          <figcaption>{{ source?.name }} · {{ sourceSize ? `${sourceSize.width} × ${sourceSize.height} · ` : '' }}{{ number(source?.size ?? 0) }} bytes</figcaption>
        </figure>
      </template>

      <template v-else-if="current === 'cutout'">
        <p class="workbench__scope">{{ copy(portraitScopeNotice, locale) }}</p>
        <p class="field-help">
          <NuxtLink :to="withLocale('/tools/image-background-remover/')">{{ en ? 'The portrait background remover, on its own page' : '單獨使用人像去背工具' }}</NuxtLink>
        </p>
        <div v-if="states.cutout !== 'unavailable'" class="workbench__model" data-workbench-model :data-model-ready="String(modelReady)">
          <p role="status">{{ modelStatus }}</p>
          <div v-if="modelDownloading" class="offline-asset__progress" role="progressbar" :aria-valuenow="modelPercent" aria-valuemin="0" aria-valuemax="100" :aria-label="en ? 'Model download progress' : '模型下載進度'">
            <span :style="{ inlineSize: `${modelPercent}%` }" />
          </div>
          <div v-if="!modelReady" class="tool-workspace__actions">
            <Button v-if="modelDownloading" variant="outline" @click="cancelModel"><X :size="16" aria-hidden="true" />{{ en ? 'Cancel download' : '取消下載' }}</Button>
            <Button v-else :disabled="!online" @click="downloadModel"><Download :size="16" aria-hidden="true" />{{ modelFailure ? (en ? 'Try again' : '重新下載') : (en ? 'Download the model' : '下載模型') }}</Button>
          </div>
        </div>
        <figure v-if="artifacts.cutout" class="workbench__figure workbench__figure--alpha">
          <img :src="artifacts.cutout.url" :alt="en ? 'Cutout preview on a checkered transparency background' : '去背結果預覽，透明處以格紋表示'">
          <figcaption>{{ artifacts.cutout.width }} × {{ artifacts.cutout.height }} · {{ number(artifacts.cutout.bytes) }} bytes · {{ en ? 'The checkered area is transparent.' : '格紋區域代表透明。' }}</figcaption>
        </figure>
      </template>

      <template v-else-if="current === 'layout'">
        <fieldset class="workbench__controls" :disabled="busy">
          <legend>{{ en ? 'What is this output for?' : '這次輸出的用途' }}</legend>
          <div v-for="purpose in workbenchPurposes" :key="purpose" class="workbench__purpose">
            <input :id="`workbench-purpose-${purpose}`" type="radio" name="workbench-purpose" :value="purpose" :checked="session.purpose === purpose" @change="choosePurpose(purpose)">
            <label :for="`workbench-purpose-${purpose}`">
              <strong>{{ copy(workbenchPurposeLabels[purpose], locale) }}</strong>
              <span class="field-help">{{ copy(workbenchPurposeSummaries[purpose], locale) }}</span>
            </label>
          </div>
        </fieldset>

        <div v-if="session.purpose === 'compliant'" class="field-group">
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
        <p id="workbench-number-help" class="field-help">{{ en ? 'Zoom is 1–400% of the fitted size; position is −100–100% of the canvas, measured from the centre.' : '縮放為填入尺寸的 1–400%，位置為畫布的 −100–100%，從置中起算。' }}</p>

        <figure v-if="layoutPreviewUrl" class="workbench__figure">
          <div class="workbench__canvas" :style="{ aspectRatio: `${canvas.width} / ${canvas.height}`, background: settings.background, '--workbench-ratio': canvas.width / canvas.height }" role="img" :aria-label="en ? 'Layout preview on the output canvas' : '版型預覽，對應輸出畫布'">
            <img v-if="placementStyle" :src="layoutPreviewUrl" :style="placementStyle" alt="">
            <span v-for="guide in occupancy" :key="guide.ruleId" class="workbench__guide" :style="{ inset: guideInset(guide.ratio) }" aria-hidden="true" />
            <span v-for="guide in safeAreas" :key="guide.ruleId" class="workbench__guide workbench__guide--safe" :style="{ top: `${guide.top * 100}%`, right: `${guide.right * 100}%`, bottom: `${guide.bottom * 100}%`, left: `${guide.left * 100}%` }" aria-hidden="true" />
          </div>
          <figcaption>
            {{ canvas.width }} × {{ canvas.height }}
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
            <input id="workbench-frame" class="ui-input" type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" :disabled="busy" @change="chooseFile($event, file => chooseBrandAsset('frame', file))">
            <p v-if="frame" class="field-help">{{ frame.name }} <Button variant="outline" :disabled="busy" @click="clearBrandAsset('frame')">{{ en ? 'Remove frame' : '移除框版' }}</Button></p>
          </div>
          <div class="field-group">
            <label for="workbench-logo">{{ en ? 'Logo image' : 'Logo 圖片' }}</label>
            <input id="workbench-logo" class="ui-input" type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" :disabled="busy" @change="chooseFile($event, file => chooseBrandAsset('logo', file))">
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
          <p class="field-help">{{ en ? 'Position is measured from the centre as a share of the canvas. Version one has no text or price tags.' : '位置從置中起算，以畫布百分比表示。第一版不含文字與價籤。' }}</p>
        </fieldset>
        <div v-if="artifacts.layout" class="workbench__figure">
          <div class="workbench__canvas" :style="{ aspectRatio: `${artifacts.layout.width} / ${artifacts.layout.height}`, '--workbench-ratio': artifacts.layout.width / artifacts.layout.height }" role="img" :aria-label="en ? 'Brand composition preview' : '品牌素材組合預覽'">
            <img v-for="layer in brandPreview" :key="layer.id" :src="layer.url" :style="layer.style" alt="">
          </div>
        </div>
      </template>

      <template v-else>
        <template v-if="output">
          <figure class="workbench__figure">
            <img :src="output.url" :alt="en ? 'Final output preview' : '最終輸出預覽'">
            <figcaption>{{ output.width }} × {{ output.height }} · {{ output.format }} · {{ number(output.bytes) }} bytes</figcaption>
          </figure>
          <Button as-child><a :href="output.url" :download="workbenchOutputName(session.purpose, output.format)"><Download :size="16" aria-hidden="true" />{{ en ? 'Download the output' : '下載輸出檔案' }}</a></Button>
          <p class="field-help">{{ en ? 'Re-encoded images do not copy source metadata. Keep your originals.' : '重新編碼的圖片不複製來源中繼資料，請保留原始檔案。' }}</p>

          <section v-if="check" class="workbench__check" :aria-label="en ? 'What was checked against this channel preset' : '對照通路規格的核對結果'">
            <p :data-workbench-check="check.result">
              <TriangleAlert v-if="check.result !== 'pass'" :size="16" aria-hidden="true" />
              <CircleCheck v-else :size="16" aria-hidden="true" />
              {{ check.result === 'pass'
                ? (en ? 'Every rule this tool can read off the file is satisfied. This is specification guidance, not a guarantee of channel approval.' : '這個檔案能被工具核對的規則都符合。這是規格輔助，不保證通路審核通過。')
                : check.result === 'fail'
                  ? (en ? 'At least one requirement this tool checks is not met. Adjust the layout and produce it again.' : '至少一項工具可核對的要求未符合，請回到版型調整後重新產生。')
                  : (en ? 'This preset is disabled, so nothing was checked.' : '這個通路規格已停用，未進行核對。') }}
            </p>
            <p v-for="code in check.notices" :key="code" class="field-help">{{ copy(compliantImageNotices[code], locale) }}</p>
            <div v-for="group in ruleGroups" :key="group.disposition">
              <h3>{{ group.label }}</h3>
              <ul>
                <li v-for="rule in group.rules" :key="rule.id">{{ ruleLine(rule) }}</li>
              </ul>
            </div>
          </section>
        </template>
        <p v-else class="field-help">{{ en ? 'Finish the earlier steps to produce an output.' : '完成前面的步驟後才會產生輸出。' }}</p>
      </template>

      <p id="workbench-error" role="alert" class="field-error">
        <TriangleAlert v-if="errorText" :size="16" aria-hidden="true" />{{ errorText }}
      </p>

      <div class="tool-workspace__actions">
        <Button v-if="current === 'cutout' && states.cutout !== 'unavailable'" :disabled="busy || !source || !modelReady" @click="removeBackground">{{ en ? 'Remove the background' : '開始去背' }}</Button>
        <Button v-if="current === 'layout'" :disabled="!canRenderLayout" @click="renderLayout">{{ en ? 'Produce the layout' : '產生版型' }}</Button>
        <Button v-if="current === 'brand' && states.brand !== 'unavailable'" :disabled="busy || (!frame && !logo) || invalidLogoField" @click="composeBrand">{{ en ? 'Compose the brand assets' : '組合品牌素材' }}</Button>
        <Button v-if="running" variant="outline" @click="cancel">{{ en ? 'Cancel this step' : '取消這一步' }}</Button>
        <Button v-if="(current === 'cutout' || current === 'brand') && states[current] !== 'unavailable'" variant="outline" :disabled="busy" @click="skipStep(current)">
          {{ current === 'cutout' ? (en ? 'Skip the cutout' : '略過去背') : (en ? 'Skip brand assets' : '略過品牌素材') }}
        </Button>
        <Button v-if="previousStep" variant="outline" :disabled="busy" @click="open(previousStep)">{{ en ? 'Back a step' : '回到前一步' }}</Button>
        <Button v-if="source" variant="outline" :disabled="busy" @click="reset">{{ en ? 'Clear the workbench' : '清空工作台' }}</Button>
      </div>
      <div v-if="running" role="progressbar" :aria-label="en ? 'Local processing' : '本機處理'" class="field-help">{{ en ? 'Working locally. You can cancel; earlier steps are kept.' : '正在本機處理，可隨時取消，先前步驟的成果會保留。' }}</div>
      <p role="status" class="workbench__status">{{ noticeText }}</p>
    </section>
  </Card>
</template>
