<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { ArrowDown, ArrowUp, Download, GripVertical, Redo2, Trash2, Undo2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { usePromoEditor } from '@/composables/usePromoEditor'
import {
  movePromoLayer,
  pickPromoLayer,
  promoHandles,
  promoPlacement,
  promoScaleRange,
  resizePromoLayer,
  type PromoHandle,
  type PromoLayer,
  type PromoLayerKind,
} from '@/features/tools/brand-promo-image/scene'
import { promoErrors } from '@/features/tools/brand-promo-image/content'

const { locale } = useAppLocale()
const en = computed(() => locale.value === 'en')
const { scene, assets, selectedId, selected, canUndo, canRedo, busy, preparing, supported, error, message, stage, task, output, commit, preview, revert, patchLayer, reorder, move, moveToEdge, remove, undo, redo, cancel, prepare, importFile, produce } = usePromoEditor()
/** The add buttons follow the order a merchant builds a promo image in: the product first. */
const addKinds: PromoLayerKind[] = ['product', 'background', 'frame', 'logo']
const kind = ref<PromoLayerKind>('product')
const fileInput = ref<HTMLInputElement>()
const stageEl = ref<HTMLElement>()
const canvasEl = ref<HTMLElement>()
const locked = computed(() => busy.value)
const labels = computed(() => en.value ? { background: 'Background', product: 'Product', frame: 'Frame', logo: 'Logo' } : { background: '背景', product: '商品圖', frame: '框版', logo: 'Logo' })
/** A verb ahead of a layer name, spaced the way Chinese copy spaces a Latin word such as Logo. */
function lead(verb: string, kind: PromoLayerKind) {
  return en.value || /^[A-Za-z]/.test(labels.value[kind]) ? `${verb} ` : verb
}
const drafts = reactive<Record<string, string | number>>({ width: 1000, height: 1000, x: 0, y: 0, scale: 100, opacity: 100 })
const invalidFields = reactive<Record<string, boolean>>({})
const invalid = computed(() => Object.values(invalidFields).some(Boolean))
const errorText = computed(() => invalid.value ? promoErrors.invalid_options![locale.value] : error.value ? (promoErrors[error.value] ?? promoErrors.failed)![locale.value] : '')
/** The layers panel reads like an image editor's: the front layer first. */
const layersFrontToBack = computed(() => [...scene.value.layers].reverse())
const ready = computed(() => Boolean(output.value) && !invalid.value)
watch(selectedId, () => {
  for (const key of ['x', 'y', 'scale', 'opacity']) invalidFields[key] = false
})
watch([scene, selectedId], () => {
  for (const key of ['width', 'height'] as const) if (!invalidFields[key]) drafts[key] = scene.value[key]
  for (const key of ['x', 'y', 'scale', 'opacity'] as const) if (!invalidFields[key]) drafts[key] = Math.round((selected.value?.[key] ?? 0) * 100)
})
/* The produce button gives way to the download link; focus follows it instead of dropping to the page. */
watch(ready, async (now) => {
  const focused = document.activeElement
  if (!now || (focused && focused !== document.body && focused.id !== 'promo-produce')) return
  await nextTick()
  document.getElementById('promo-download')?.focus()
})
const statusText = computed(() => {
  if (busy.value) {
    if (task.value === 'import') return en.value ? 'Reading the image…' : '正在讀取圖片…'
    return stage.value === 'encoding' ? (en.value ? 'Making the PNG…' : '正在產生 PNG…') : (en.value ? 'Combining layers…' : '正在合成圖層…')
  }
  const messages: Record<string, string> = en.value
    ? { imported: 'Layer added.', cancelled: 'Cancelled. Your layers are unchanged.', success: 'Your PNG is ready to download.' }
    : { imported: '已加入圖層。', cancelled: '已取消，圖層維持原狀。', success: 'PNG 已準備好，可以下載。' }
  return messages[message.value] ?? ''
})
const transforms = computed(() => [
  { key: 'x' as const, label: en.value ? 'Horizontal position (%)' : '水平位置（%）', min: -100, max: 100 },
  { key: 'y' as const, label: en.value ? 'Vertical position (%)' : '垂直位置（%）', min: -100, max: 100 },
  { key: 'scale' as const, label: en.value ? 'Scale (%)' : '縮放（%）', min: 1, max: 400 },
  { key: 'opacity' as const, label: en.value ? 'Opacity (%)' : '不透明度（%）', min: 0, max: 100 },
])
function transform(key: 'x' | 'y' | 'scale' | 'opacity', raw: string | number) {
  const field = transforms.value.find(item => item.key === key)!
  drafts[key] = raw
  const value = Number(raw)
  invalidFields[key] = raw === '' || !Number.isFinite(value) || value < field.min || value > field.max
  if (invalidFields[key]) return
  const layer = selected.value
  /* A stretched layer keeps its stretch: the scale field resizes it proportionally. */
  if (key === 'scale' && layer?.scaleY !== undefined) {
    const scaleY = Math.min(Math.max(layer.scaleY * (value / 100) / layer.scale, promoScaleRange.min), promoScaleRange.max)
    patchLayer({ scale: value / 100, scaleY })
    return
  }
  patchLayer({ [key]: value / 100 })
}
function resize(key: 'width' | 'height', raw: string | number) {
  drafts[key] = raw
  const value = Number(raw)
  invalidFields[key] = !Number.isInteger(value) || value < 1 || value > 8192 || value * scene.value[key === 'width' ? 'height' : 'width'] > 24_000_000
  if (invalidFields[key]) return
  commit({ ...scene.value, [key]: value })
}
function boxOf(layer: PromoLayer) {
  const asset = assets.value[layer.assetId]
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
/** One button per layer type opens the same file picker. */
function pick(next: PromoLayerKind) {
  kind.value = next
  fileInput.value?.click()
}
function choose(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) void importFile(file, kind.value)
  input.value = ''
}

/*
 * Picking a layer by its paint rather than its box, as an image editor does:
 * each preview image is sampled once into a small alpha map, so clicking the
 * transparent middle of a frame reaches the product underneath.
 */
const alphaMaps = new Map<string, { width: number, height: number, alpha: Uint8ClampedArray } | null>()
function alphaMap(assetId: string) {
  if (alphaMaps.has(assetId)) return alphaMaps.get(assetId)
  const image = canvasEl.value?.querySelector<HTMLImageElement>(`img[data-asset-id="${assetId}"]`)
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
  const map = alphaMap(layer.assetId)
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
  const asset = layer && assets.value[layer.assetId]
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

/* Reordering by dragging a row of the layers panel. */
const draggedLayerId = ref('')
const dropTargetId = ref('')
function dragLayerStart(event: DragEvent, id: string) {
  if (locked.value) { event.preventDefault(); return }
  draggedLayerId.value = id
  if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', id) }
}
function dragLayerOver(event: DragEvent, id: string) {
  if (!draggedLayerId.value) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  dropTargetId.value = id
}
function dropLayer(event: DragEvent, id: string) {
  event.preventDefault()
  const target = scene.value.layers.findIndex(layer => layer.id === id)
  if (draggedLayerId.value && target >= 0) reorder(draggedLayerId.value, target)
  dragLayerEnd()
}
function dragLayerEnd() { draggedLayerId.value = ''; dropTargetId.value = '' }

function shortcut(event: KeyboardEvent) {
  if (!(event.ctrlKey || event.metaKey)) return
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return
  if (event.code === 'BracketRight' || event.code === 'BracketLeft') {
    if (locked.value || !selected.value) return
    event.preventDefault()
    const forward = event.code === 'BracketRight'
    if (event.shiftKey) moveToEdge(forward ? 'front' : 'back')
    else move(forward ? 1 : -1)
    return
  }
  if (event.key.toLowerCase() !== 'z') return
  event.preventDefault()
  if (event.shiftKey) redo()
  else undo()
}
</script>

<template>
  <Card class="tool-workspace brand-promo" :aria-busy="locked" @keydown="shortcut">
    <p v-if="preparing" role="status" class="capability-checking">{{ en ? 'Checking that this browser can make the image…' : '正在確認這個瀏覽器能否製作圖片…' }}</p>
    <div v-else-if="!supported" class="capability-warning">
      <p>{{ promoErrors.unsupported_browser![locale] }}</p>
      <Button variant="outline" @click="prepare">{{ en ? 'Check again' : '重新檢查' }}</Button>
    </div>

    <div class="brand-promo__editor">
      <div class="brand-promo__add" role="group" aria-labelledby="promo-add-label">
        <p id="promo-add-label" class="brand-promo__label">{{ en ? 'Add a layer' : '加入圖層' }}</p>
        <div class="brand-promo__add-buttons">
          <Button
            v-for="item in addKinds"
            :key="item"
            variant="outline"
            :data-promo-add="item"
            :aria-label="lead(en ? 'Add' : '加入', item) + labels[item]"
            :disabled="locked || preparing || !supported"
            aria-describedby="promo-error"
            @click="pick(item)"
          >
            {{ labels[item] }}
          </Button>
        </div>
        <input id="promo-file" ref="fileInput" class="brand-promo__file" type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" tabindex="-1" aria-hidden="true" @change="choose">
      </div>

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
                <img v-if="layer.visible && assets[layer.assetId]" :src="assets[layer.assetId]!.url" :data-asset-id="layer.assetId" :style="layerStyle(layer)" alt="" draggable="false">
              </template>
            </div>
            <p v-if="!scene.layers.length" class="brand-promo__empty">{{ en ? 'Add a product image, then a background, frame, or Logo.' : '先加入商品圖，再疊上背景、框版或 Logo。' }}</p>
            <div v-if="selectionStyle" class="brand-promo__selection" data-promo-selection :style="selectionStyle" aria-hidden="true">
              <span v-for="handle in promoHandles" :key="handle" class="brand-promo__handle" :class="`brand-promo__handle--${handle}`" :data-handle="handle" />
            </div>
          </div>
        </div>
      </section>

      <div class="brand-promo__output">
        <div class="brand-promo__actions">
          <Button variant="outline" size="icon" :disabled="locked || !canUndo" :aria-label="en ? 'Undo' : '復原'" :title="en ? 'Undo (Ctrl/⌘ Z)' : '復原（Ctrl／⌘ Z）'" aria-keyshortcuts="Control+z Meta+z" @click="undo">
            <Undo2 :size="18" aria-hidden="true" />
          </Button>
          <Button variant="outline" size="icon" :disabled="locked || !canRedo" :aria-label="en ? 'Redo' : '重做'" :title="en ? 'Redo (Ctrl/⌘ Shift Z)' : '重做（Ctrl／⌘ Shift Z）'" aria-keyshortcuts="Control+Shift+z Meta+Shift+z" @click="redo">
            <Redo2 :size="18" aria-hidden="true" />
          </Button>
          <Button v-if="ready" as-child class="brand-promo__primary">
            <a id="promo-download" :href="output" download="brand-promo.png"><Download :size="18" aria-hidden="true" />{{ en ? 'Download PNG' : '下載 PNG' }}</a>
          </Button>
          <Button v-else id="promo-produce" class="brand-promo__primary" :disabled="locked || !supported || !scene.layers.length || invalid" aria-describedby="promo-error" @click="!invalid && produce()">
            {{ en ? 'Make PNG' : '產生 PNG' }}
          </Button>
          <Button v-if="busy" variant="outline" @click="cancel">{{ en ? 'Cancel' : '取消' }}</Button>
        </div>
        <p id="promo-error" role="alert" class="field-error">{{ errorText }}</p>
        <p role="status" class="brand-promo__status">{{ statusText }}</p>
        <p v-show="scene.layers.length" id="promo-stage-help" class="field-help">
          {{ en
            ? 'Drag a layer on the preview to move it, a corner to resize it, or an edge to stretch it. After clicking the preview, arrow keys nudge and Delete removes.'
            : '在預覽上拖曳圖層即可移動，拖曳四角縮放、四邊拉伸。點一下預覽後，方向鍵可微調、Delete 可移除。' }}
        </p>
      </div>

      <div class="brand-promo__panel">
        <section v-if="scene.layers.length" class="brand-promo__layers" aria-labelledby="promo-layers-title">
          <h2 id="promo-layers-title">{{ en ? 'Layers, front to back' : '圖層，由上到下' }}</h2>
          <ol>
            <li
              v-for="layer in layersFrontToBack"
              :key="layer.id"
              :class="{ 'brand-promo__layer--drop': dropTargetId === layer.id && draggedLayerId !== layer.id, 'brand-promo__layer--dragging': draggedLayerId === layer.id }"
              :draggable="!locked"
              @dragstart="dragLayerStart($event, layer.id)"
              @dragover="dragLayerOver($event, layer.id)"
              @dragleave="dropTargetId === layer.id && (dropTargetId = '')"
              @drop="dropLayer($event, layer.id)"
              @dragend="dragLayerEnd"
            >
              <span class="brand-promo__grip" aria-hidden="true"><GripVertical :size="18" /></span>
              <Button variant="outline" :aria-pressed="selectedId === layer.id" :disabled="locked" @click="selectedId = layer.id">
                <img v-if="assets[layer.assetId]" class="brand-promo__thumb" :src="assets[layer.assetId]!.url" alt="" draggable="false">
                <span>{{ labels[layer.kind] }}</span>
              </Button>
            </li>
          </ol>
          <fieldset v-if="selected" :disabled="locked" class="brand-promo__controls">
            <legend>{{ lead(en ? 'Adjust' : '調整', selected.kind) + labels[selected.kind] }}</legend>
            <div class="brand-promo__fields">
              <div v-for="field in transforms" :key="field.key" class="field-group">
                <label :for="`promo-${field.key}`">{{ field.label }}</label>
                <Input :id="`promo-${field.key}`" :model-value="drafts[field.key]" :aria-invalid="Boolean(invalidFields[field.key])" type="number" :min="field.min" :max="field.max" step="1" aria-describedby="promo-error" @update:model-value="transform(field.key, $event)" />
              </div>
            </div>
            <div class="brand-promo__layer-actions">
              <Button variant="outline" :disabled="scene.layers.at(-1)?.id === selectedId" aria-keyshortcuts="Control+BracketRight Meta+BracketRight" @click="move(1)">
                <ArrowUp :size="18" aria-hidden="true" />{{ en ? 'Move up' : '上移一層' }}
              </Button>
              <Button variant="outline" :disabled="scene.layers[0]?.id === selectedId" aria-keyshortcuts="Control+BracketLeft Meta+BracketLeft" @click="move(-1)">
                <ArrowDown :size="18" aria-hidden="true" />{{ en ? 'Move down' : '下移一層' }}
              </Button>
              <Button v-if="selected.scaleY !== undefined" variant="outline" @click="patchLayer({ scaleY: undefined })">{{ en ? 'Restore proportions' : '還原原始比例' }}</Button>
              <Button variant="outline" @click="remove">
                <Trash2 :size="18" aria-hidden="true" />{{ en ? 'Remove layer' : '移除圖層' }}
              </Button>
            </div>
          </fieldset>
        </section>

        <fieldset :disabled="locked" class="brand-promo__controls">
          <legend>{{ en ? 'PNG size' : 'PNG 輸出尺寸' }}</legend>
          <div class="brand-promo__fields">
            <div v-for="dimension in (['width', 'height'] as const)" :key="dimension" class="field-group">
              <label :for="`promo-${dimension}`">{{ dimension === 'width' ? (en ? 'Width (px)' : '寬度（像素）') : (en ? 'Height (px)' : '高度（像素）') }}</label>
              <Input :id="`promo-${dimension}`" :model-value="drafts[dimension]" :aria-invalid="Boolean(invalidFields[dimension])" type="number" min="1" max="8192" step="1" aria-describedby="promo-error" @update:model-value="resize(dimension, $event)" />
            </div>
          </div>
        </fieldset>
      </div>
    </div>
  </Card>
</template>
