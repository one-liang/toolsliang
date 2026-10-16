<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { Eraser } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import {
  fitTypedSignatureSize,
  signatureIsEmpty,
  signaturePadAspect,
  signatureRasterSize,
  strokeContentBox,
  typedSignatureText,
  type SignatureStroke,
} from '@/features/tools/pdf-signature/domain/signature'
import { signatureInputErrors, type SignatureInputErrorCode } from '@/features/tools/pdf-signature/content'
import { encodeSignature, type CreatedSignature } from '@/features/tools/pdf-signature/signature-image'
import type { LocaleCode } from '@/features/tools/catalog'

/**
 * Where a signature is drawn or typed. Both leave here as the same thing as an
 * imported picture — a PNG with an alpha channel and its pixel size — so nothing
 * downstream has to know which one the visitor used, and no font is ever
 * embedded in a document. Importing needs no surface of its own: choosing the
 * file is the whole step, so it happens in the workspace.
 *
 * Drawing needs a pointer, so the typed form is its keyboard equivalent rather
 * than a second-class alternative: it produces exactly the same output.
 */
const { locale, maxPlacedWidthPt, form, disabled = false } = defineProps<{
  locale: LocaleCode
  /** The widest placement the open document allows, which sets the raster size. */
  maxPlacedWidthPt: number
  form: 'drawn' | 'typed'
  disabled?: boolean
}>()

const emit = defineEmits<{
  created: [signature: CreatedSignature]
  cancel: []
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

const strokes = shallowRef<SignatureStroke[]>([])
/**
 * Points are pushed into the stroke being drawn, and a mutation inside a
 * `shallowRef` is not something Vue can see. Whether the pad holds a signature
 * at all is the one thing the interface needs from it, so it is tracked on its
 * own as soon as a stroke stops being a single press.
 */
const hasInk = ref(false)
const typed = ref('')
const error = ref<SignatureInputErrorCode | ''>('')
const pad = ref<HTMLCanvasElement>()
const typedPreview = ref<HTMLCanvasElement>()
let drawing = false

const en = computed(() => locale === 'en')
const errorText = computed(() => error.value ? signatureInputErrors[error.value][locale] : '')
const ready = computed(() => form === 'drawn' ? hasInk.value : typedSignatureText(typed.value).length > 0)

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

/** A canvas of the signature's own size, or nothing when this device has no 2D context. */
function rasterCanvas(size: { width: number, height: number }) {
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) { error.value = 'unsupported_format'; return undefined }

  return { canvas, context }
}

function rasteriseDrawn() {
  const box = strokeContentBox(strokes.value, CONTENT_PADDING)
  if (!box) { error.value = 'signature_empty'; return undefined }

  /* The box is a share of the pad, and the pad is three times as wide as tall. */
  const size = signatureRasterSize({ aspect: (box.width * signaturePadAspect) / box.height, maxPlacedWidthPt })
  const target = rasterCanvas(size)
  if (!target) return undefined
  paintStrokes(target.context, size, box)

  return { canvas: target.canvas, name: en.value ? 'Drawn signature' : '手寫簽名' }
}

function rasteriseTyped() {
  const text = typedSignatureText(typed.value)
  /* The name's own shape has to be measured before there is a canvas to draw it on. */
  const probe = document.createElement('canvas').getContext('2d')
  if (!probe) { error.value = 'unsupported_format'; return undefined }

  const padSize = typedFontSize(probe, text, { width: PAD_WIDTH * TYPED_FILL.width, height: PAD_HEIGHT * TYPED_FILL.height })
  probe.font = typedFont(padSize)
  const aspect = Math.max(0.1, (probe.measureText(text).width * TYPED_SIDE_AIR) / (padSize * TYPED_LINE_HEIGHT))
  const size = signatureRasterSize({ aspect, maxPlacedWidthPt })
  const target = rasterCanvas(size)
  if (!target) return undefined
  paintTypedText(target.context, text, size, TYPED_RASTER_FILL)

  return { canvas: target.canvas, name: text }
}

/** Adds the signature as the transparent PNG everything downstream expects. */
async function create() {
  if (disabled || !ready.value) { error.value = 'signature_empty'; return }
  error.value = ''

  const target = form === 'drawn' ? rasteriseDrawn() : rasteriseTyped()
  if (!target) return

  const signature = await encodeSignature(target.canvas, target.name, form)
  if (!signature) { error.value = 'unsupported_format'; return }
  emit('created', signature)
}

watch(typed, redrawTyped)
onMounted(() => {
  if (form === 'drawn') redrawPad()
  else redrawTyped()
})
</script>

<template>
  <form class="signature-pad" novalidate @submit.prevent="create">
    <div v-if="form === 'drawn'" class="signature-pad__surface" :class="{ 'signature-pad__surface--inked': hasInk }">
      <canvas
        ref="pad"
        class="signature-pad__canvas"
        :width="PAD_WIDTH"
        :height="PAD_HEIGHT"
        role="img"
        :aria-label="en ? 'Signature pad. Draw with a pointer or finger; choose Type for a keyboard alternative.' : '簽名板。可用滑鼠或手指書寫；需要鍵盤操作時請改用「文字」。'"
        @pointerdown="startStroke"
        @pointermove="extendStroke"
        @pointerup="endStroke"
        @pointercancel="endStroke"
        @pointerleave="endStroke"
      />
      <span class="signature-pad__hint" aria-hidden="true">{{ en ? 'Sign here' : '在這裡簽名' }}</span>
    </div>

    <div v-else class="signature-pad__typed field-group">
      <label for="signature-typed">{{ en ? 'Name to write' : '要寫上的文字' }}</label>
      <input
        id="signature-typed"
        v-model="typed"
        class="ui-input"
        type="text"
        maxlength="60"
        :disabled="disabled"
        autocomplete="off"
      >
      <canvas ref="typedPreview" class="signature-pad__canvas signature-pad__canvas--preview" :width="PAD_WIDTH" :height="PAD_HEIGHT" role="img" :aria-label="en ? 'Preview of the typed signature' : '輸入文字的簽名預覽'" />
    </div>

    <p v-if="errorText" role="alert" class="field-error">{{ errorText }}</p>

    <div class="signature-pad__actions">
      <Button v-if="form === 'drawn'" type="button" variant="ghost" class="signature-pad__clear" :disabled="disabled || !hasInk" @click="clearPad">
        <Eraser :size="18" aria-hidden="true" />{{ en ? 'Clear' : '清除' }}
      </Button>
      <Button type="button" variant="outline" @click="emit('cancel')">{{ en ? 'Cancel' : '取消' }}</Button>
      <Button type="submit" :disabled="disabled || !ready" data-signature-add>{{ en ? 'Add' : '加入' }}</Button>
    </div>
  </form>
</template>
