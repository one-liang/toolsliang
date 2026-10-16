<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PromoEditor } from '@/composables/usePromoEditor'
import { movePromoLayer, pickPromoLayer, promoHandles, promoPlacement, resizePromoLayer, type PromoHandle, type PromoLayer } from '@/features/tools/brand-promo-image/scene'

/**
 * The layout's canvas: every layer drawn where the renderer will put it, and a
 * selected layer moved, scaled or stretched by dragging it or its handles.
 * Shared by the brand promo image and the product workbench, so a layout is
 * made the same way in both.
 */
const props = withDefaults(defineProps<{
  editor: PromoEditor
  /** Stops editing while something outside the editor is using the layout. */
  locked?: boolean
  /** What an empty canvas says to do first. */
  emptyText?: string
}>(), { locked: false, emptyText: '' })

const { locale } = useAppLocale()
const en = computed(() => locale.value === 'en')
const { scene, selectedId, selected, busy, assetOf, shownAssetId, preview, commit, revert, patchLayer, remove } = props.editor
const stageEl = ref<HTMLElement>()
const canvasEl = ref<HTMLElement>()
const locked = computed(() => busy.value || props.locked)

function boxOf(layer: PromoLayer) {
  const asset = assetOf(layer)
  return asset ? promoPlacement(layer, asset.width, asset.height, scene.value.width, scene.value.height) : undefined
}
function percentBox(box: { x: number, y: number, width: number, height: number }) {
  return { left: `${box.x / scene.value.width * 100}%`, top: `${box.y / scene.value.height * 100}%`, width: `${box.width / scene.value.width * 100}%`, height: `${box.height / scene.value.height * 100}%` }
}
function layerStyle(layer: PromoLayer) {
  const box = boxOf(layer)
  return box ? { ...percentBox(box), opacity: layer.opacity } : {}
}
/** The transform box drawn around the selected layer, with its eight handles. */
const selectionStyle = computed(() => {
  const layer = selected.value
  const box = layer?.visible && !locked.value ? boxOf(layer) : undefined
  return box ? percentBox(box) : undefined
})

/*
 * Picking a layer by its paint rather than its box, as an image editor does:
 * each preview image is sampled once into a small alpha map, so clicking the
 * transparent middle of a frame reaches the product underneath.
 */
const alphaMaps = new Map<string, { width: number, height: number, alpha: Uint8ClampedArray } | null>()
function alphaMap(assetId: string) {
  if (alphaMaps.has(assetId)) return alphaMaps.get(assetId)
  const image = [...canvasEl.value?.querySelectorAll<HTMLImageElement>('img[data-asset-id]') ?? []].find(candidate => candidate.dataset.assetId === assetId)
  /* Not drawn yet: answer "opaque" for now and try again on the next click. */
  if (!image?.complete || !image.naturalWidth) return null
  try {
    const ratio = Math.min(1, 256 / Math.max(image.naturalWidth, image.naturalHeight))
    const width = Math.max(1, Math.round(image.naturalWidth * ratio)), height = Math.max(1, Math.round(image.naturalHeight * ratio))
    const sampler = document.createElement('canvas')
    sampler.width = width; sampler.height = height
    const context = sampler.getContext('2d', { willReadFrequently: true })
    if (!context) { alphaMaps.set(assetId, null); return null }
    context.drawImage(image, 0, 0, width, height)
    const pixels = context.getImageData(0, 0, width, height).data
    const alpha = new Uint8ClampedArray(width * height)
    for (let index = 0; index < alpha.length; index++) alpha[index] = pixels[index * 4 + 3]!
    const map = { width, height, alpha }
    alphaMaps.set(assetId, map)
    return map
  }
  catch {
    alphaMaps.set(assetId, null)
    return null
  }
}
function opaqueAt(layer: PromoLayer, u: number, v: number) {
  const map = alphaMap(shownAssetId(layer))
  if (!map) return true
  const x = Math.min(map.width - 1, Math.floor(u * map.width)), y = Math.min(map.height - 1, Math.floor(v * map.height))
  return map.alpha[y * map.width + x]! > 24
}
function canvasPoint(event: PointerEvent) {
  const rect = canvasEl.value!.getBoundingClientRect()
  return { x: (event.clientX - rect.left) / rect.width * scene.value.width, y: (event.clientY - rect.top) / rect.height * scene.value.height }
}
function contains(layer: PromoLayer, point: { x: number, y: number }) {
  const box = boxOf(layer)
  return Boolean(box && point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height)
}

/**
 * One pointer gesture on the preview. It is drawn as it happens and becomes a
 * single undo step when the pointer is released, measured from where it began
 * so the layer stays under the pointer even after hitting a limit.
 */
let gesture: {
  pointerId: number
  id: string
  handle?: PromoHandle
  origin: PromoLayer
  start: { x: number, y: number }
  factor: number
  source: { width: number, height: number }
  moved: boolean
} | undefined

function startGesture(event: PointerEvent) {
  if (event.button !== 0 || locked.value || !stageEl.value || !canvasEl.value) return
  const handle = (event.target as HTMLElement).closest<HTMLElement>('[data-handle]')?.dataset.handle as PromoHandle | undefined
  let layer: PromoLayer | undefined
  if (handle) layer = selected.value
  else {
    const point = canvasPoint(event)
    const current = selected.value
    /* Ctrl/⌘ drags the selected layer even where another one is on top of it. */
    layer = (event.ctrlKey || event.metaKey) && current?.visible && contains(current, point)
      ? current
      : pickPromoLayer(scene.value.layers, point, { boxOf, opaqueAt, selectedId: selectedId.value })
  }
  const asset = layer && assetOf(layer)
  if (!layer || !asset) return
  event.preventDefault()
  stageEl.value.focus({ preventScroll: true })
  selectedId.value = layer.id
  gesture = {
    pointerId: event.pointerId,
    id: layer.id,
    handle,
    origin: { ...layer },
    start: { x: event.clientX, y: event.clientY },
    factor: scene.value.width / canvasEl.value.getBoundingClientRect().width,
    source: { width: asset.width, height: asset.height },
    moved: false,
  }
  try { stageEl.value.setPointerCapture(event.pointerId) }
  catch { /* the gesture continues without capture */ }
}

function continueGesture(event: PointerEvent) {
  const current = gesture
  if (!current || event.pointerId !== current.pointerId) return
  const travelled = { x: event.clientX - current.start.x, y: event.clientY - current.start.y }
  if (!current.moved && Math.hypot(travelled.x, travelled.y) < 2) return
  current.moved = true
  const delta = { x: travelled.x * current.factor, y: travelled.y * current.factor }
  const patch = current.handle
    ? resizePromoLayer(current.origin, current.handle, delta, current.source, scene.value, { proportional: !event.shiftKey, fromCenter: event.altKey })
    : movePromoLayer(current.origin, delta, scene.value, { constrain: event.shiftKey })
  preview({ ...scene.value, layers: scene.value.layers.map(layer => layer.id === current.id ? { ...current.origin, ...patch } : layer) })
}

function endGesture(event: PointerEvent) {
  const current = gesture
  if (!current || event.pointerId !== current.pointerId) return
  gesture = undefined
  if (current.moved) commit(scene.value)
}

/** Keys on the focused preview: nudge, delete, and Escape to abandon a gesture. */
function stageKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && gesture) {
    event.preventDefault()
    gesture = undefined
    revert()
    return
  }
  const layer = selected.value
  if (!layer || locked.value) return
  const step = event.shiftKey ? 10 : 1
  const nudges: Record<string, { x: number, y: number }> = { ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step } }
  const nudge = nudges[event.key]
  if (nudge) { event.preventDefault(); patchLayer(movePromoLayer(layer, nudge, scene.value)); return }
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); remove() }
}
</script>

<template>
  <section class="brand-promo__preview" :aria-label="en ? 'Preview' : '預覽'">
    <div class="brand-promo__stage-frame">
      <div
        ref="stageEl"
        class="brand-promo__stage"
        data-promo-stage
        tabindex="0"
        role="group"
        :aria-label="en ? 'Preview. Select a layer, then drag it or its handles.' : '預覽。選取圖層後可以直接拖曳圖層或控制點。'"
        aria-describedby="promo-stage-help"
        :style="{ aspectRatio: `${scene.width} / ${scene.height}`, '--promo-ratio': scene.width / scene.height }"
        @pointerdown="startGesture"
        @pointermove="continueGesture"
        @pointerup="endGesture"
        @pointercancel="endGesture"
        @lostpointercapture="endGesture"
        @dragstart.prevent
        @keydown="stageKey"
      >
        <div ref="canvasEl" class="brand-promo__canvas">
          <template v-for="layer in scene.layers" :key="layer.id">
            <img v-if="layer.visible && assetOf(layer)" :src="assetOf(layer)!.url" :data-asset-id="shownAssetId(layer)" :style="layerStyle(layer)" alt="" draggable="false">
          </template>
        </div>
        <p v-if="!scene.layers.length && emptyText" class="brand-promo__empty">{{ emptyText }}</p>
        <div v-if="selectionStyle" class="brand-promo__selection" data-promo-selection :style="selectionStyle" aria-hidden="true">
          <span v-for="handle in promoHandles" :key="handle" class="brand-promo__handle" :class="`brand-promo__handle--${handle}`" :data-handle="handle" />
        </div>
      </div>
    </div>
  </section>
</template>
