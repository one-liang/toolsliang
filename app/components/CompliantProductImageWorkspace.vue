<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { CircleCheck, CircleSlash, Download, Info, ShoppingBag, TriangleAlert } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatReviewDate } from '@/features/tools/catalog'
import { validateImageInput } from '@/features/images/input'
import { heicMessage } from '@/features/images/messages'
import { createCompliantImageRenderer } from '@/features/tools/compliant-product-image/engine'
import { planPlacement } from '@/features/tools/compliant-product-image/domain/placement'
import {
  compliantImageCaveats,
  compliantImageChannelLabels,
  compliantImageCoverageLabels,
  compliantImageErrors,
  compliantImageExclusionLabels,
  compliantImageNotices,
  compliantImageRoleLabels,
  compliantImageSizeIssues,
  compliantImageStages,
  constraintKindLabels,
  describeRuleValue,
  presetStatusLabels,
  ruleAuthorityLabels,
  ruleDispositionLabels,
  ruleVerificationLabels,
} from '@/features/tools/compliant-product-image/content'
import {
  compliantImagePresets,
  type CompliantImagePresetRule,
} from '@/features/tools/compliant-product-image/domain/reference'
import {
  compliantImageExcludedChannels,
  compliantImageSources,
} from '@/features/tools/compliant-product-image/domain/sources'
import {
  checkOutputAgainstPreset,
  findCompliantImagePreset,
  presetReviewDeadlines,
  resolvePresetStatus,
  resolveRuleState,
  ruleDispositions,
} from '@/features/tools/compliant-product-image/domain/preset'
import {
  describeSizeIssue,
  encodableFormats,
  formatMimeTypes,
  formatOfMimeType,
  resolveByteRange,
  resolveOccupancyGuides,
  resolveOutputBounds,
  resolveOutputFormats,
  resolveSafeAreaInsets,
  suggestOutputSize,
  type EncodableFormat,
  type EncodableMimeType,
} from '@/features/tools/compliant-product-image/domain/render'
import type { CompliantRenderOutput } from '@/features/tools/compliant-product-image/types'
import type { EngineCapabilities } from '@/features/tools/engine/contract'

const { locale } = useAppLocale()
const engine = createCompliantImageRenderer()
const en = computed(() => locale.value === 'en')

/**
 * The device's own date. Every preset is judged against it, so a preset whose
 * source has not been re-read in ninety days stops being used here rather than
 * quietly ageing into a wrong answer.
 *
 * It is empty until the component mounts, because the page is prerendered: the
 * build machine's date is not the visitor's, and rendering a freshness verdict
 * on the server would both mismatch on hydration and, worse, tell a visitor in
 * January what was true in September. Until the device answers, the page shows
 * the review date — a fact — and no verdict derived from it.
 */
const today = ref('')
const capabilities = shallowRef<EngineCapabilities>()
const preparing = ref(false)
const presetId = ref(compliantImagePresets[0]!.id)
const source = shallowRef<File>()
const result = shallowRef<CompliantRenderOutput>()
const outputUrl = ref('')
const previewUrl = ref('')
const sourceUrl = ref('')
const sourceSize = shallowRef<{ width: number, height: number }>()
const width = ref<string | number>(1000)
const height = ref<string | number>(1000)
const format = ref<EncodableMimeType>('image/jpeg')
const fit = ref<'cover' | 'contain'>('cover')
const zoom = ref<string | number>(100)
const offsetX = ref<string | number>(0)
const offsetY = ref<string | number>(0)
const background = ref('#ffffff')
const fileInput = ref<HTMLInputElement>()
const running = ref(false)
const validating = ref(false)
const stage = ref('')
const message = ref<'selected' | 'cancelled' | 'success' | ''>('')
const error = ref('')
let generation = 0
let mounted = true

const busy = computed(() => running.value || validating.value)
useWorkspaceDirty('compliant-product-image', computed(() => Boolean(source.value) || busy.value))

const preset = computed(() => findCompliantImagePreset(presetId.value)!)
/** The day the rules are read against; before the device answers, the day they were reviewed. */
const evaluationDate = computed(() => today.value || preset.value.reviewedAt)
const presetSource = computed(() => compliantImageSources.find(item => item.id === preset.value.sourceId)!)
const status = computed(() => resolvePresetStatus(preset.value, evaluationDate.value))
const deadlines = computed(() => presetReviewDeadlines(preset.value))
/** An expired or retired preset is never used to judge anything, so it cannot render either. */
const presetDisabled = computed(() => status.value === 'expired' || status.value === 'retired')

const availableFormats = computed<EncodableFormat[]>(() => {
  const offered = capabilities.value?.supported
    ? capabilities.value.formats
    : encodableFormats.map(item => formatMimeTypes[item])

  return encodableFormats.filter(item => offered.includes(formatMimeTypes[item]))
})
const formats = computed(() => resolveOutputFormats(preset.value, evaluationDate.value, availableFormats.value))
const bounds = computed(() => resolveOutputBounds(preset.value, evaluationDate.value))
const byteRange = computed(() => resolveByteRange(preset.value, evaluationDate.value))
const occupancy = computed(() => resolveOccupancyGuides(preset.value, evaluationDate.value))
const safeAreas = computed(() => resolveSafeAreaInsets(preset.value, evaluationDate.value))
const sizeIssue = computed(() => describeSizeIssue(bounds.value, Number(width.value), Number(height.value)))
const sizeIssueText = computed(() => sizeIssue.value ? compliantImageSizeIssues[sizeIssue.value][locale.value] : '')

/** What the finished file is judged against — read off the file, never off the settings. */
const check = computed(() => {
  const output = result.value
  const outputFormat = output && formatOfMimeType(output.format)
  if (!output || !outputFormat) return undefined

  return checkOutputAgainstPreset(
    preset.value,
    { width: output.width, height: output.height, format: outputFormat, bytes: output.blob.size },
    evaluationDate.value,
  )
})

const notices = computed(() => {
  if (check.value) return check.value.notices
  const list: Array<keyof typeof compliantImageNotices> = []
  if (status.value === 'retired') list.push('preset-retired')
  else if (status.value === 'expired') list.push('preset-expired')
  else if (status.value === 'review-due') list.push('preset-review-due')
  if (preset.value.rules.some(rule => resolveRuleState(rule, evaluationDate.value) === 'scheduled')) list.push('rule-not-in-force')
  if (preset.value.rules.some(rule => rule.verification !== 'automatic')) list.push('rules-need-your-check')

  return list
})

const ruleGroups = computed(() => {
  const outcome = check.value
  if (!outcome) return []

  return ruleDispositions
    .map(disposition => ({
      disposition,
      rules: outcome.ruleIds[disposition]
        .map(id => preset.value.rules.find(rule => rule.id === id))
        .filter((rule): rule is CompliantImagePresetRule => Boolean(rule)),
    }))
    .filter(group => group.rules.length > 0)
})

const errorText = computed(() => error.value
  ? (compliantImageErrors[error.value] ?? compliantImageErrors.failed)![locale.value]
  : '')
const statusText = computed(() => {
  if (stage.value && running.value) return compliantImageStages[stage.value]?.[locale.value] ?? ''
  if (message.value === 'cancelled') return en.value ? 'Cancelled. Your original is unchanged; you can start again.' : '已取消。原圖未變更，可重新產生。'
  if (message.value === 'selected') return en.value ? 'Image selected. Adjust the settings, then produce the output.' : '已選擇圖片。調整設定後即可產生輸出。'
  if (message.value === 'success') return en.value ? 'Output ready. Read the rule list before you upload it.' : '輸出已完成，上傳前請先看過規則清單。'
  return ''
})

const canRender = computed(() => Boolean(source.value)
  && !busy.value
  && Boolean(capabilities.value?.supported)
  && !presetDisabled.value
  && !sizeIssue.value
  && formats.value.length > 0)

/**
 * The canvas the preview frame stands for: the produced output once there is
 * one, and the settings being edited before that. The frame is built to this
 * ratio and the guides are inset as a share of it, so a guide always lands on
 * the pixels it is talking about.
 */
const frameSize = computed(() => result.value
  ? { width: result.value.width, height: result.value.height }
  : { width: Number(width.value), height: Number(height.value) })

/** Where the source image sits on that canvas, recomputed as the numbers change. */
const livePlacement = computed(() => sourceSize.value && !sizeIssue.value
  ? planPlacement({
      sourceWidth: sourceSize.value.width,
      sourceHeight: sourceSize.value.height,
      targetWidth: frameSize.value.width,
      targetHeight: frameSize.value.height,
      fit: fit.value,
      zoom: Number(zoom.value),
      offsetX: Number(offsetX.value),
      offsetY: Number(offsetY.value),
    })
  : undefined)
const coverage = computed(() => result.value?.coverage ?? livePlacement.value?.coverage)
const showsPreview = computed(() => Boolean(result.value || (sourceUrl.value && livePlacement.value)))
const frameStyle = computed(() => ({
  '--frame-ratio': String(frameSize.value.width / frameSize.value.height),
  'aspectRatio': `${frameSize.value.width} / ${frameSize.value.height}`,
  'background': background.value,
}))
const liveImageStyle = computed(() => {
  const placement = livePlacement.value
  if (!placement) return undefined
  const { width: canvasWidth, height: canvasHeight } = frameSize.value

  return {
    left: `${(placement.x / canvasWidth) * 100}%`,
    top: `${(placement.y / canvasHeight) * 100}%`,
    width: `${(placement.width / canvasWidth) * 100}%`,
    height: `${(placement.height / canvasHeight) * 100}%`,
  }
})

/** The one rule §4.5 resolves by defaulting the output format rather than judging it. */
const chromaRule = computed(() => preset.value.rules.find(rule =>
  rule.kind === 'chroma-model' && resolveRuleState(rule, evaluationDate.value) === 'in-force'))

const extension = computed(() => result.value?.format === 'image/jpeg' ? 'jpg' : result.value?.format === 'image/webp' ? 'webp' : 'png')
/** The share of the preview a guide frame occupies, as an inset on all four sides. */
const guideInset = (ratio: number) => `${((1 - Math.sqrt(ratio)) / 2) * 100}%`
function number(value: number) {
  return new Intl.NumberFormat(en.value ? 'en' : 'zh-TW').format(value)
}
function bytes(value: number) {
  return `${number(value)} bytes`
}
function percent(value: number) {
  return `${Math.round(value * 100)}%`
}
function ruleMeta(rule: CompliantImagePresetRule) {
  const parts = [ruleAuthorityLabels[rule.authority][locale.value], ruleVerificationLabels[rule.verification][locale.value]]
  // An announced-but-not-yet-binding rule reads as a live requirement without its date.
  if (rule.effectiveFrom) parts.push(`${en.value ? 'in force from' : '生效日'} ${rule.effectiveFrom}`)

  return parts.join(' · ')
}
function ruleLine(rule: CompliantImagePresetRule) {
  return `${constraintKindLabels[rule.kind][locale.value]}${en.value ? ': ' : '：'}${describeRuleValue(rule, locale.value)}`
}

/** The source preview outlives a settings change; only choosing another file replaces it. */
function releaseSource() {
  if (sourceUrl.value) URL.revokeObjectURL(sourceUrl.value)
  sourceUrl.value = ''
  sourceSize.value = undefined
}

function loadSourcePreview(file: File) {
  releaseSource()
  const url = URL.createObjectURL(file)
  sourceUrl.value = url
  const image = new Image()
  image.onload = () => { if (sourceUrl.value === url) sourceSize.value = { width: image.naturalWidth, height: image.naturalHeight } }
  image.onerror = () => { if (sourceUrl.value === url) sourceSize.value = undefined }
  image.src = url
}

function clearResult() {
  if (outputUrl.value) URL.revokeObjectURL(outputUrl.value)
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  outputUrl.value = ''
  previewUrl.value = ''
  result.value = undefined
  message.value = ''
}

/** A preset change is a different channel's rules, so nothing from the last one survives it. */
function applyPreset() {
  const size = suggestOutputSize(preset.value, evaluationDate.value)
  width.value = size.width
  height.value = size.height
  const preferred = formats.value.includes('jpeg') ? 'jpeg' : formats.value[0]
  if (preferred) format.value = formatMimeTypes[preferred]
  clearResult()
  error.value = ''
}

async function prepare() {
  preparing.value = true
  const value = await engine.prepare()
  if (!mounted) return
  capabilities.value = value
  preparing.value = false
  if (!formats.value.some(item => formatMimeTypes[item] === format.value)) applyPreset()
}

async function selectFiles(files: File[]) {
  if (busy.value) return
  const current = ++generation
  error.value = ''
  message.value = ''
  if (!files.length) return
  if (files.length !== 1) { error.value = 'multiple_files'; return }
  const file = files[0]!
  validating.value = true
  try {
    const code = await validateImageInput(file)
    if (current !== generation) return
    if (code) { error.value = code; return }
    clearResult()
    source.value = file
    loadSourcePreview(file)
    message.value = 'selected'
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

async function produce() {
  if (presetDisabled.value) { error.value = 'preset_unavailable'; return }
  if (!canRender.value || !source.value) return
  clearResult()
  error.value = ''
  running.value = true
  // §12.9 puts the preset check before anything touches the image.
  stage.value = 'validating-preset'
  const current = ++generation
  const outcome = await engine.run({
    file: source.value,
    width: Number(width.value),
    height: Number(height.value),
    format: format.value,
    fit: fit.value,
    zoom: Number(zoom.value),
    offsetX: Number(offsetX.value),
    offsetY: Number(offsetY.value),
    background: background.value,
    minBytes: byteRange.value.min,
    maxBytes: byteRange.value.max,
  }, { onProgress: progress => { stage.value = progress.stage } })
  if (current !== generation || !mounted) return
  running.value = false
  stage.value = ''
  if (outcome.status === 'cancelled') message.value = 'cancelled'
  else if (outcome.status === 'error') error.value = outcome.error.code
  else {
    try {
      outputUrl.value = URL.createObjectURL(outcome.output.blob)
      previewUrl.value = URL.createObjectURL(outcome.output.preview)
      result.value = outcome.output
      message.value = 'success'
    }
    catch { clearResult(); error.value = 'memory_limit' }
  }
}

function cancel() {
  ++generation
  engine.cancel()
  running.value = false
  validating.value = false
  stage.value = ''
  clearResult()
  message.value = 'cancelled'
}

function reset() {
  cancel()
  releaseSource()
  source.value = undefined
  error.value = ''
  message.value = ''
  fileInput.value?.focus()
}

watch(presetId, applyPreset)
watch([width, height, format, fit, zoom, offsetX, offsetY, background], () => { clearResult(); error.value = '' })
onMounted(() => {
  today.value = new Date().toISOString().slice(0, 10)
  applyPreset()
  void prepare()
})
onBeforeUnmount(() => {
  mounted = false
  ++generation
  engine.dispose()
  clearResult()
  releaseSource()
  source.value = undefined
})
</script>

<template>
  <Card class="tool-workspace compliant-product-image">
    <p class="eyebrow">{{ en ? 'Channel specifications, checked on your device' : '通路規格，在你的裝置上核對' }}</p>

    <div class="field-group">
      <label for="compliant-preset">{{ en ? 'Channel preset' : '通路規格' }}</label>
      <select id="compliant-preset" v-model="presetId" class="ui-input" :disabled="busy" aria-describedby="compliant-preset-help">
        <optgroup
          v-for="channel in [...new Set(compliantImagePresets.map(item => item.channelId))]"
          :key="channel"
          :label="compliantImageChannelLabels[channel][locale]"
        >
          <option
            v-for="item in compliantImagePresets.filter(candidate => candidate.channelId === channel)"
            :key="item.id"
            :value="item.id"
          >{{ compliantImageRoleLabels[item.role][locale] }}</option>
        </optgroup>
      </select>
      <p id="compliant-preset-help" class="field-help">{{ compliantImageCaveats['no-approval-guarantee'][locale] }}</p>
    </div>

    <section data-preset-source class="compliant-product-image__source" :aria-label="en ? 'Preset source' : '規格來源'">
      <h3>{{ compliantImageChannelLabels[preset.channelId][locale] }} · {{ compliantImageRoleLabels[preset.role][locale] }}</h3>
      <p>{{ preset.scope[locale] }}</p>
      <p>
        <a :href="presetSource.url" target="_blank" rel="noopener noreferrer">{{ presetSource.title[locale] }}</a>
        <span> · {{ presetSource.publisher[locale] }}</span>
      </p>
      <p>
        {{ en ? 'Reviewed' : '查核日期' }} <time :datetime="preset.reviewedAt">{{ formatReviewDate(preset.reviewedAt, locale) }}</time> ·
        {{ en ? 'current until' : '有效至' }} <time :datetime="deadlines.activeUntil">{{ formatReviewDate(deadlines.activeUntil, locale) }}</time>
      </p>
      <p v-if="today" data-preset-status :data-status="status">
        <Info :size="16" aria-hidden="true" />
        {{ en ? 'Status' : '狀態' }}：{{ presetStatusLabels[status][locale] }}
        <span class="compliant-product-image__meta">{{ en ? 'judged against this device\'s date' : '依這台裝置的日期判斷' }}</span>
      </p>
      <p>{{ compliantImageCoverageLabels[preset.coverage][locale] }}</p>
      <p v-if="preset.coverageGaps.length" data-coverage-gaps>
        {{ en ? 'This channel does not publish' : '這個通路未公開' }}：{{ preset.coverageGaps.map(gap => constraintKindLabels[gap][locale]).join(en ? ', ' : '、') }}
      </p>
    </section>

    <ul v-if="today && notices.length" data-preset-notices class="compliant-product-image__notices">
      <li v-for="notice in notices" :key="notice">
        <TriangleAlert :size="16" aria-hidden="true" />{{ compliantImageNotices[notice][locale] }}
      </li>
    </ul>

    <div class="compliant-product-image__picker field-group" @dragover.prevent @drop.prevent="selectFiles(Array.from($event.dataTransfer?.files ?? []))">
      <ShoppingBag :size="24" aria-hidden="true" />
      <label for="compliant-file">{{ en ? 'Choose product image' : '選擇商品圖片' }}</label>
      <input
        id="compliant-file"
        ref="fileInput"
        class="ui-input"
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        :disabled="busy"
        aria-describedby="compliant-formats compliant-error"
        :aria-invalid="Boolean(error)"
        @change="choose"
      >
      <p id="compliant-formats" class="field-help">JPEG · PNG · WebP · {{ en ? 'One image, up to 25 MiB / 24 MP. You can also drop a file here.' : '單張最多 25 MiB／2,400 萬像素。也可將檔案拖曳至此。' }}</p>
      <p class="field-help">{{ heicMessage[locale] }}</p>
    </div>
    <p v-if="source" class="compliant-product-image__filename">{{ source.name }} · {{ bytes(source.size) }}</p>

    <p v-if="preparing" role="status" class="field-help">{{ en ? 'Checking local image capabilities…' : '正在檢查本機圖片處理能力…' }}</p>
    <div v-else-if="capabilities && !capabilities.supported" class="capability-warning">
      <p>{{ compliantImageErrors.unsupported_browser![locale] }}</p>
      <Button variant="outline" @click="prepare">{{ en ? 'Check again' : '重新檢查' }}</Button>
    </div>

    <form :aria-busy="running" @submit.prevent="produce">
      <fieldset :disabled="busy" class="compliant-product-image__settings">
        <legend>{{ en ? 'Output settings' : '輸出設定' }}</legend>
        <div class="tool-workspace__grid">
          <div class="field-group">
            <label for="compliant-width">{{ en ? 'Output width (px)' : '輸出寬度（像素）' }}</label>
            <Input id="compliant-width" v-model="width" type="number" min="1" :max="bounds.maxWidth" step="1" required :readonly="Boolean(bounds.exact)" aria-describedby="compliant-size-help compliant-size-error" />
          </div>
          <div class="field-group">
            <label for="compliant-height">{{ en ? 'Output height (px)' : '輸出高度（像素）' }}</label>
            <Input id="compliant-height" v-model="height" type="number" min="1" :max="bounds.maxHeight" step="1" required :readonly="Boolean(bounds.exact)" aria-describedby="compliant-size-help compliant-size-error" />
          </div>
          <div class="field-group">
            <label for="compliant-format">{{ en ? 'Output format' : '輸出格式' }}</label>
            <select id="compliant-format" v-model="format" class="ui-input" aria-describedby="compliant-format-help">
              <option v-for="item in formats" :key="item" :value="formatMimeTypes[item]">{{ item.toUpperCase() }}</option>
            </select>
            <p id="compliant-format-help" class="field-help">
              {{ en ? 'Only formats this channel allows and this browser can write.' : '只提供這個通路允許、而且這個瀏覽器寫得出來的格式。' }}
              <template v-if="chromaRule">
                {{ en
                  ? `This channel asks for a ${(chromaRule.value as { model: string }).model} chroma model, so JPEG is offered first because it usually encodes that way. Width, height, format and bytes cannot show chroma subsampling, so the tool does not judge it for you.`
                  : `這個通路要求 ${(chromaRule.value as { model: string }).model} 色度模型，因此預設 JPEG——它通常以此編碼。寬、高、格式與位元組看不出色度取樣，工具不會替你判定。` }}
              </template>
            </p>
          </div>
          <div class="field-group">
            <label for="compliant-fit">{{ en ? 'How the image fills the canvas' : '圖片如何填滿畫布' }}</label>
            <select id="compliant-fit" v-model="fit" class="ui-input">
              <option value="cover">{{ en ? 'Fill and crop the overflow' : '填滿並裁掉超出部分' }}</option>
              <option value="contain">{{ en ? 'Fit the whole image inside' : '整張放進畫布內' }}</option>
            </select>
          </div>
          <div class="field-group">
            <label for="compliant-zoom">{{ en ? 'Scale (%)' : '縮放（%）' }}</label>
            <Input id="compliant-zoom" v-model="zoom" type="number" min="10" max="400" step="1" required />
          </div>
          <div class="field-group">
            <label for="compliant-background">{{ en ? 'Background fill' : '背景填色' }}</label>
            <input id="compliant-background" v-model="background" class="ui-input compliant-product-image__color" type="color" aria-describedby="compliant-background-help">
            <p id="compliant-background-help" class="field-help">{{ en ? 'Painted behind the image so a crop never leaves a transparent hole. Whether it counts as a solid background is yours to judge.' : '填在圖片後方，裁切後不會留下透明區塊。是否符合純色背景要求由你判斷。' }}</p>
          </div>
          <div class="field-group">
            <label for="compliant-offset-x">{{ en ? 'Horizontal position (%)' : '水平位移（%）' }}</label>
            <Input id="compliant-offset-x" v-model="offsetX" type="number" min="-100" max="100" step="1" required />
          </div>
          <div class="field-group">
            <label for="compliant-offset-y">{{ en ? 'Vertical position (%)' : '垂直位移（%）' }}</label>
            <Input id="compliant-offset-y" v-model="offsetY" type="number" min="-100" max="100" step="1" required />
          </div>
        </div>
        <p id="compliant-size-help" class="field-help">
          <template v-if="bounds.exact">{{ compliantImageSizeIssues['not-exact'][locale] }}</template>
          <template v-else>{{ en ? 'Every field takes a number, so the crop can be set from the keyboard alone. Position is a share of the canvas, measured from the centre.' : '所有欄位都以數字設定，可完全用鍵盤操作；位移以畫布的百分比計算，從置中位置起算。' }}</template>
        </p>
        <p id="compliant-size-error" class="field-error">
          <template v-if="sizeIssueText && !bounds.exact">
            <TriangleAlert :size="18" aria-hidden="true" />{{ sizeIssueText }}
          </template>
        </p>
      </fieldset>
      <div class="tool-workspace__actions">
        <Button type="submit" :disabled="!canRender">{{ en ? 'Produce output' : '產生輸出' }}</Button>
        <Button v-if="busy" type="button" variant="outline" @click="cancel">{{ en ? 'Cancel' : '取消' }}</Button>
        <Button v-if="source && !busy" type="button" variant="outline" @click="reset">{{ en ? 'Clear image' : '清除圖片' }}</Button>
      </div>
    </form>

    <p id="compliant-error" role="alert" class="field-error">
      <TriangleAlert v-if="errorText" :size="18" aria-hidden="true" />{{ errorText }}
    </p>
    <p role="status" class="compliant-product-image__status">{{ statusText }}</p>
    <div v-if="running && stage" role="progressbar" :aria-label="compliantImageStages[stage]?.[locale]" class="field-help">
      {{ en ? 'Working locally; you can cancel at any time.' : '正在本機處理，可隨時取消。' }}
    </div>

    <figure v-if="showsPreview" :data-image-result="result ? '' : undefined" data-image-preview class="compliant-product-image__result">
      <figcaption>
        <template v-if="result">{{ en ? 'Output' : '輸出' }} · {{ result.width }} × {{ result.height }} · {{ bytes(result.blob.size) }}</template>
        <template v-else>{{ en ? 'Crop preview' : '裁切預覽' }} · {{ en ? 'target' : '目標' }} {{ frameSize.width }} × {{ frameSize.height }}</template>
        <template v-if="coverage !== undefined"> · {{ en ? 'the image covers' : '圖片覆蓋畫布' }} {{ percent(coverage) }}</template>
      </figcaption>
      <div class="compliant-product-image__frame" :style="frameStyle">
        <img
          v-if="result"
          class="compliant-product-image__frame-fill"
          :src="previewUrl"
          :alt="en ? 'Preview of the produced output' : '輸出結果預覽'"
        >
        <img
          v-else
          :src="sourceUrl"
          :style="liveImageStyle"
          :alt="en ? 'Preview of the crop being set' : '目前裁切設定的預覽'"
        >
        <div
          v-for="guide in occupancy"
          :key="guide.ruleId"
          data-occupancy-guide
          class="compliant-product-image__guide"
          :style="{ inset: guideInset(guide.ratio) }"
        >
          <span>{{ en ? 'Product occupancy guide' : '商品佔比輔助框' }} {{ percent(guide.ratio) }} · {{ ruleAuthorityLabels[guide.authority][locale] }}</span>
        </div>
        <div
          v-for="guide in safeAreas"
          :key="guide.ruleId"
          data-safe-area-guide
          class="compliant-product-image__guide"
          :style="{ inset: `${guide.top * 100}% ${guide.right * 100}% ${guide.bottom * 100}% ${guide.left * 100}%` }"
        >
          <span>{{ en ? 'Safe area guide' : '安全區輔助框' }}</span>
        </div>
      </div>
      <p class="field-help">{{ en ? 'The frames are drawn as guidance. This tool cannot see where the product ends, so it does not judge occupancy or the safe area for you.' : '輔助框只是參考。工具看不出商品的邊界，因此不會替你判定佔比或安全區。' }}</p>
      <p v-if="result" class="field-help">{{ en ? 'Re-encoding does not copy the source EXIF, GPS or IPTC records; keep the original file.' : '重新編碼不會複製原始 EXIF、GPS 或 IPTC 中繼資料，請保留原檔。' }}</p>
    </figure>

    <section v-if="check" data-preset-check :data-result="check.result" class="compliant-product-image__check" :aria-label="en ? 'Rule by rule' : '逐條規則結果'">
      <h3>
        <component :is="check.result === 'pass' ? CircleCheck : check.result === 'fail' ? TriangleAlert : CircleSlash" :size="18" aria-hidden="true" />
        <template v-if="check.result === 'pass'">{{ en ? 'Every rule this tool can check is met' : '已通過所有可自動檢查的項目' }}</template>
        <template v-else-if="check.result === 'fail'">{{ en ? 'A required rule is not met' : '有規範項目未通過' }}</template>
        <template v-else>{{ en ? 'This preset is disabled, so nothing was checked' : '這個規格已停用，未進行檢查' }}</template>
      </h3>
      <div v-for="group in ruleGroups" :key="group.disposition" :data-rule-group="group.disposition" class="compliant-product-image__group">
        <h4>{{ ruleDispositionLabels[group.disposition][locale] }}（{{ group.rules.length }}）</h4>
        <ul>
          <li v-for="rule in group.rules" :key="rule.id">
            <strong>{{ ruleLine(rule) }}</strong>
            <span class="compliant-product-image__meta">{{ ruleMeta(rule) }}</span>
            <q>{{ rule.quote }}</q>
          </li>
        </ul>
      </div>
    </section>

    <Button v-if="result" as-child class="compliant-product-image__download">
      <a :href="outputUrl" :download="`${preset.id}.${extension}`">
        <Download :size="18" aria-hidden="true" />{{ en ? 'Download output' : '下載輸出' }}
      </a>
    </Button>

    <section class="compliant-product-image__rules" :aria-label="en ? 'What this channel asks for' : '這個通路的規則'">
      <h3>{{ en ? 'What this channel asks for' : '這個通路的規則' }}</h3>
      <ul>
        <li v-for="rule in preset.rules" :key="rule.id">
          <strong>{{ ruleLine(rule) }}</strong>
          <span class="compliant-product-image__meta">{{ ruleMeta(rule) }}</span>
          <q>{{ rule.quote }}</q>
        </li>
      </ul>
    </section>

    <section data-preset-caveats class="compliant-product-image__caveats" :aria-label="en ? 'Before you rely on this' : '使用前必讀'">
      <h3>{{ en ? 'Before you rely on this' : '使用前必讀' }}</h3>
      <ul>
        <li v-for="(caveat, key) in compliantImageCaveats" :key="key">{{ caveat[locale] }}</li>
      </ul>
    </section>

    <section data-excluded-channels class="compliant-product-image__excluded" :aria-label="en ? 'Channels without a preset' : '沒有 preset 的通路'">
      <h3>{{ en ? 'Channels without a preset' : '沒有 preset 的通路' }}</h3>
      <ul>
        <li v-for="channel in compliantImageExcludedChannels" :key="channel.id">
          <strong>{{ channel.name[locale] }}</strong>
          <span>{{ compliantImageExclusionLabels[channel.reason][locale] }}</span>
          <span class="compliant-product-image__meta">{{ en ? 'To be looked at again on' : '重新評估日期' }} <time :datetime="channel.recheckAt">{{ formatReviewDate(channel.recheckAt, locale) }}</time></span>
        </li>
      </ul>
    </section>
  </Card>
</template>
