<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { Eraser, PenLine, Type, Upload } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { exceedsImageLimits, imageInputLimits } from '@/features/images/limits'
import {
  fitTypedSignatureSize,
  opaqueBounds,
  signatureFormKeys,
  signatureHasTransparency,
  signatureIsEmpty,
  signaturePadAspect,
  signatureRasterSize,
  strokeContentBox,
  typedSignatureText,
  validateSignatureImageFile,
  type SignatureBox,
  type SignatureForm,
  type SignatureStroke,
} from '@/features/tools/pdf-signature/domain/signature'
import { signatureInputErrors, type SignatureInputErrorCode } from '@/features/tools/pdf-signature/content'
import type { LocaleCode } from '@/features/tools/catalog'

/**
 * Where a signature is made, in the three forms T24 allows: drawn, typed, or an
 * imported transparent image. All three leave here as the same thing — a PNG
 * with an alpha channel and its pixel size — so nothing downstream has to know
 * which one the visitor used, and no font is ever embedded in a document.
 *
 * Drawing needs a pointer, so the typed form is its keyboard equivalent rather
 * than a second-class alternative: it produces exactly the same output.
 */
const { locale, maxPlacedWidthPt, disabled = false } = defineProps<{
  locale: LocaleCode
  /** The widest placement the open document allows, which sets the raster size. */
  maxPlacedWidthPt: number
  disabled?: boolean
}>()

const emit = defineEmits<{
  created: [signature: { name: string, form: SignatureForm, bytes: ArrayBuffer, width: number, height: number }]
}>()

/** The pad's own pixels. Strokes are stored as shares of it, so this is only how it is drawn. */
const PAD_WIDTH = 900
const PAD_HEIGHT = PAD_WIDTH / signaturePadAspect
/** Stroke width as a share of the pad height, so a signature keeps its weight at any size. */
const STROKE_RATIO = 0.045
/** Breathing room around the handwriting, in the same units. */
const CONTENT_PADDING = 0.03
/** The ink every form is drawn in: the page's own text colour, not pure black. */
const INK = '#1d1b19'
/** How much of its box a typed name fills, leaving room for descenders. */
const TYPED_FILL = { width: 0.94, height: 0.8 }
/** The same question once the signature is rasterised at its real size. */
const TYPED_RASTER_FILL = { width: 0.96, height: 0.82 }
/** A typed name's own shape: its measured width plus air, over one line of type. */
const TYPED_SIDE_AIR = 1.08
const TYPED_LINE_HEIGHT = 1.5

const form = ref<SignatureForm>('drawn')
const strokes = shallowRef<SignatureStroke[]>([])
/**
 * Points are pushed into the stroke being drawn, and a mutation inside a
 * `shallowRef` is not something Vue can see. Whether the pad holds a signature
 * at all is the one thing the interface needs from it, so it is tracked on its
 * own as soon as a stroke stops being a single press.
 */
const hasInk = ref(false)
const typed = ref('')
/**
 * The imported picture, with the crop measured once. The pixels themselves are
 * not kept: a large picture is tens of megabytes of RGBA, and the only thing
 * the rasteriser needs from them is the rectangle that is not transparent.
 */
const imported = shallowRef<{ bitmap: ImageBitmap, width: number, height: number, bounds: SignatureBox }>()
const importedName = ref('')
const error = ref<SignatureInputErrorCode | ''>('')
const pad = ref<HTMLCanvasElement>()
const typedPreview = ref<HTMLCanvasElement>()
const imageInput = ref<HTMLInputElement>()
let drawing = false

const formLabels: Record<SignatureForm, { 'zh-tw': string, en: string }> = {
  drawn: { 'zh-tw': '手寫', en: 'Draw' },
  typed: { 'zh-tw': '輸入文字', en: 'Type' },
  image: { 'zh-tw': '匯入透明圖片', en: 'Import image' },
}

const errorText = computed(() => error.value ? signatureInputErrors[error.value][locale] : '')
const ready = computed(() => {
  if (form.value === 'drawn') return hasInk.value
  if (form.value === 'typed') return typedSignatureText(typed.value).length > 0
  return Boolean(imported.value)
})

/** Resets the pad to its own pixel size, which also clears what was on it. */
function resetPad() {
  const canvas = pad.value
  if (!canvas) return undefined
  canvas.width = PAD_WIDTH
  canvas.height = PAD_HEIGHT
  return canvas.getContext('2d') ?? undefined
}

/** Draws the strokes at the size given, mapping the content box onto the target. */
function paintStrokes(
  context: CanvasRenderingContext2D,
  target: { width: number, height: number },
  box: { x: number, y: number, width: number, height: number },
) {
  context.clearRect(0, 0, target.width, target.height)
  context.strokeStyle = INK
  context.lineJoin = 'round'
  context.lineCap = 'round'
  context.lineWidth = Math.max(1, STROKE_RATIO * (target.height / box.height))
  const scaleX = target.width / box.width
  const scaleY = target.height / box.height

  for (const stroke of strokes.value) {
    context.beginPath()
    stroke.points.forEach((point, index) => {
      const x = (point.x - box.x) * scaleX
      const y = (point.y - box.y) * scaleY
      if (index === 0) context.moveTo(x, y)
      else context.lineTo(x, y)
    })
    /* A single press still has to leave a mark, or the pad looks broken. */
    if (stroke.points.length === 1) context.lineTo((stroke.points[0]!.x - box.x) * scaleX + 0.01, (stroke.points[0]!.y - box.y) * scaleY)
    context.stroke()
  }
}

function redrawPad() {
  const context = resetPad()
  if (!context) return
  paintStrokes(context, { width: PAD_WIDTH, height: PAD_HEIGHT }, { x: 0, y: 0, width: 1, height: 1 })
}

function pointFrom(event: PointerEvent) {
  const canvas = pad.value
  if (!canvas) return undefined
  const rect = canvas.getBoundingClientRect()
  if (!rect.width || !rect.height) return undefined

  return {
    x: Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1),
    y: Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1),
  }
}

function startStroke(event: PointerEvent) {
  if (disabled) return
  const point = pointFrom(event)
  if (!point) return
  drawing = true
  strokes.value = [...strokes.value, { points: [point] }]
  error.value = ''
  redrawPad()
  /*
   * Capture keeps a stroke going when the pointer leaves the pad, and it is only
   * that: a pointer the browser does not consider active — a synthetic one, or
   * one already released — refuses capture, and losing the stroke over that
   * would be worse than losing the convenience.
   */
  try { pad.value?.setPointerCapture(event.pointerId) }
  catch { /* the stroke continues without capture */ }
}

function extendStroke(event: PointerEvent) {
  if (!drawing) return
  const point = pointFrom(event)
  const last = strokes.value.at(-1)
  if (!point || !last) return
  last.points.push(point)
  if (!hasInk.value && !signatureIsEmpty(strokes.value)) hasInk.value = true
  redrawPad()
}

function endStroke() { drawing = false }

function clearPad() {
  strokes.value = []
  hasInk.value = false
  error.value = ''
  redrawPad()
}

/**
 * Writes the typed name into the middle of the target, at the largest size that
 * still fits the share of it the fill allows. The preview and the rasterised
 * signature go through here, so what the visitor sees is what gets placed.
 */
function paintTypedText(
  context: CanvasRenderingContext2D,
  text: string,
  target: { width: number, height: number },
  fill: { width: number, height: number },
) {
  context.clearRect(0, 0, target.width, target.height)
  if (!text) return

  const size = typedFontSize(context, text, { width: target.width * fill.width, height: target.height * fill.height })
  context.font = typedFont(size)
  context.fillStyle = INK
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(text, target.width / 2, target.height / 2)
}

/** Draws the typed name so the visitor sees what will be placed, not a promise of it. */
function redrawTyped() {
  const canvas = typedPreview.value
  if (!canvas) return
  canvas.width = PAD_WIDTH
  canvas.height = PAD_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) return

  paintTypedText(context, typedSignatureText(typed.value), { width: PAD_WIDTH, height: PAD_HEIGHT }, TYPED_FILL)
}

/** The device's own text font: nothing is embedded, so nothing has to be licensed. */
function typedFont(size: number) {
  return `${size}px system-ui, -apple-system, "Noto Sans TC", "PingFang TC", sans-serif`
}

function typedFontSize(context: CanvasRenderingContext2D, text: string, box: { width: number, height: number }) {
  return fitTypedSignatureSize({
    box,
    maxSize: box.height,
    measure: (size) => {
      context.font = typedFont(size)
      const measured = context.measureText(text)
      return { width: measured.width, height: size }
    },
  })
}

/** A refused image puts the focus back where the visitor can choose another one. */
function refuse(code: SignatureInputErrorCode) {
  error.value = code
  imageInput.value?.focus()
}

async function chooseImage(files: File[]) {
  error.value = ''
  if (!files.length) return
  if (files.length !== 1) { refuse('multiple_files'); return }

  const file = files[0]!
  const code = await validateSignatureImageFile(file)
  if (code) { refuse(code); return }
  if (file.size > imageInputLimits.maxBytes) { refuse('signature_too_large'); return }

  try {
    const bitmap = await createImageBitmap(file)
    if (exceedsImageLimits(bitmap.width, bitmap.height)) { bitmap.close(); refuse('signature_too_large'); return }

    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) { bitmap.close(); refuse('unsupported_format'); return }
    context.drawImage(bitmap, 0, 0)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    if (!signatureHasTransparency(pixels)) { bitmap.close(); refuse('signature_is_opaque'); return }

    clearImported()
    imported.value = {
      bitmap,
      width: bitmap.width,
      height: bitmap.height,
      bounds: opaqueBounds(pixels, bitmap.width, bitmap.height) ?? { x: 0, y: 0, width: bitmap.width, height: bitmap.height },
    }
    importedName.value = file.name
  }
  catch {
    refuse('unsupported_format')
  }
}

/** A picture that is no longer shown is a decoded bitmap nobody is holding for. */
function clearImported() {
  imported.value?.bitmap.close()
  imported.value = undefined
}

/** A signature on a canvas of its own, with the name it will be saved under. */
interface Rasterised {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  name: string
}

/** The canvas every form draws onto, or nothing when this device has no 2D context. */
function rasterCanvas(size: { width: number, height: number }, name: string): Rasterised | undefined {
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) { error.value = 'unsupported_format'; return undefined }

  return { canvas, context, name }
}

function rasteriseDrawn(): Rasterised | undefined {
  const box = strokeContentBox(strokes.value, CONTENT_PADDING)
  if (!box) { error.value = 'signature_empty'; return undefined }

  /* The box is a share of the pad, and the pad is three times as wide as tall. */
  const size = signatureRasterSize({ aspect: (box.width * signaturePadAspect) / box.height, maxPlacedWidthPt })
  const target = rasterCanvas(size, locale === 'en' ? 'Drawn signature' : '手寫簽名')
  if (target) paintStrokes(target.context, size, box)

  return target
}

function rasteriseTyped(): Rasterised | undefined {
  const text = typedSignatureText(typed.value)
  /* The name's own shape has to be measured before there is a canvas to draw it on. */
  const probe = document.createElement('canvas').getContext('2d')
  if (!probe) { error.value = 'unsupported_format'; return undefined }

  const padSize = typedFontSize(probe, text, { width: PAD_WIDTH * TYPED_FILL.width, height: PAD_HEIGHT * TYPED_FILL.height })
  probe.font = typedFont(padSize)
  const aspect = Math.max(0.1, (probe.measureText(text).width * TYPED_SIDE_AIR) / (padSize * TYPED_LINE_HEIGHT))
  const size = signatureRasterSize({ aspect, maxPlacedWidthPt })
  const target = rasterCanvas(size, text)
  if (target) paintTypedText(target.context, text, size, TYPED_RASTER_FILL)

  return target
}

function rasteriseImported(): Rasterised | undefined {
  const source = imported.value
  if (!source) { error.value = 'signature_empty'; return undefined }

  const crop = source.bounds
  /* Never upscale an imported picture: its own pixels are the most it has. */
  const width = Math.min(signatureRasterSize({ aspect: crop.width / crop.height, maxPlacedWidthPt }).width, crop.width)
  const size = { width, height: Math.max(1, Math.round(width * (crop.height / crop.width))) }
  const target = rasterCanvas(size, locale === 'en' ? 'Imported signature' : '匯入的簽名')
  if (target) target.context.drawImage(source.bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, size.width, size.height)

  return target
}

const rasterisers: Record<SignatureForm, () => Rasterised | undefined> = {
  drawn: rasteriseDrawn,
  typed: rasteriseTyped,
  image: rasteriseImported,
}

/** Writes the signature out as the transparent PNG everything downstream expects. */
async function create() {
  if (disabled || !ready.value) { error.value = 'signature_empty'; return }
  error.value = ''

  const target = rasterisers[form.value]()
  if (!target) return

  const blob = await new Promise<Blob | null>(resolve => target.canvas.toBlob(resolve, 'image/png'))
  if (!blob) { error.value = 'unsupported_format'; return }

  emit('created', {
    name: target.name,
    form: form.value,
    bytes: await blob.arrayBuffer(),
    width: target.canvas.width,
    height: target.canvas.height,
  })
}

watch(typed, redrawTyped)
onBeforeUnmount(clearImported)
watch(form, (value) => {
  error.value = ''
  if (value === 'drawn') requestAnimationFrame(redrawPad)
  if (value === 'typed') requestAnimationFrame(redrawTyped)
})
</script>

<template>
  <section class="signature-pad" :aria-label="locale === 'en' ? 'Make a signature' : '建立簽名'">
    <fieldset class="signature-pad__forms">
      <legend>{{ locale === 'en' ? 'Signature form' : '簽名方式' }}</legend>
      <label v-for="key in signatureFormKeys" :key="key" class="signature-pad__form">
        <input v-model="form" type="radio" name="signature-form" :value="key" :disabled="disabled">
        <PenLine v-if="key === 'drawn'" :size="16" aria-hidden="true" />
        <Type v-else-if="key === 'typed'" :size="16" aria-hidden="true" />
        <Upload v-else :size="16" aria-hidden="true" />
        {{ formLabels[key][locale] }}
      </label>
    </fieldset>

    <div v-if="form === 'drawn'" class="signature-pad__panel">
      <canvas
        ref="pad"
        class="signature-pad__canvas"
        :width="PAD_WIDTH"
        :height="PAD_HEIGHT"
        role="img"
        :aria-label="locale === 'en' ? 'Signature pad. Draw with a pointer or finger; use the Type tab for a keyboard alternative.' : '簽名板。可用滑鼠或手指書寫；需要鍵盤操作時請改用「輸入文字」。'"
        @pointerdown="startStroke"
        @pointermove="extendStroke"
        @pointerup="endStroke"
        @pointercancel="endStroke"
        @pointerleave="endStroke"
      />
      <p class="field-help">{{ locale === 'en' ? 'Draw inside the box. The signature is cropped to your strokes and kept transparent.' : '在框內書寫。簽名會裁切到筆跡範圍，並保留透明背景。' }}</p>
      <div class="tool-workspace__actions">
        <Button type="button" variant="outline" :disabled="disabled || !hasInk" @click="clearPad">
          <Eraser :size="18" aria-hidden="true" />{{ locale === 'en' ? 'Clear pad' : '清除簽名板' }}
        </Button>
      </div>
    </div>

    <div v-else-if="form === 'typed'" class="signature-pad__panel field-group">
      <label for="signature-typed">{{ locale === 'en' ? 'Name to write' : '要寫上的文字' }}</label>
      <input id="signature-typed" v-model="typed" class="ui-input" type="text" maxlength="60" :disabled="disabled" autocomplete="off" aria-describedby="signature-typed-help">
      <p id="signature-typed-help" class="field-help">{{ locale === 'en' ? 'Rendered with a font already on this device and placed as a transparent image; no font is added to the PDF.' : '使用這台裝置上的字型畫成透明圖片後放到頁面上，不會在 PDF 裡嵌入字型。' }}</p>
      <canvas ref="typedPreview" class="signature-pad__canvas" :width="PAD_WIDTH" :height="PAD_HEIGHT" role="img" :aria-label="locale === 'en' ? 'Preview of the typed signature' : '輸入文字的簽名預覽'" />
    </div>

    <div v-else class="signature-pad__panel field-group">
      <label for="signature-image">{{ locale === 'en' ? 'Transparent PNG or WebP' : '透明背景的 PNG 或 WebP' }}</label>
      <input
        id="signature-image"
        ref="imageInput"
        class="ui-input"
        type="file"
        accept="image/png,image/webp,.png,.webp"
        :disabled="disabled"
        aria-describedby="signature-image-help"
        @change="chooseImage(Array.from(($event.target as HTMLInputElement).files ?? []))"
      >
      <p id="signature-image-help" class="field-help">{{ locale === 'en' ? 'The image is cropped to its visible pixels. A photo without transparency would cover the page, so JPEG is refused.' : '圖片會裁切到實際有內容的範圍。沒有透明背景的照片會遮住頁面，因此不接受 JPEG。' }}</p>
      <p v-if="imported" class="field-help signature-pad__imported-note">
        {{ locale === 'en' ? `Loaded ${importedName}: ${imported.width} × ${imported.height} pixels` : `已載入 ${importedName}：${imported.width} × ${imported.height} 像素` }}
      </p>
    </div>

    <p v-if="errorText" role="alert" class="field-error">{{ errorText }}</p>

    <div class="tool-workspace__actions">
      <Button type="button" :disabled="disabled || !ready" data-signature-use @click="create">
        {{ locale === 'en' ? 'Use this signature' : '使用這個簽名' }}
      </Button>
    </div>
  </section>
</template>
