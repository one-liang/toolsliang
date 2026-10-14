<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { GripVertical } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { usePromoEditor } from '@/composables/usePromoEditor'
import {
  movePromoLayer,
  pickPromoLayer,
  promoHandles,
  promoLayerKinds,
  promoPlacement,
  promoScaleRange,
  resizePromoLayer,
  type PromoHandle,
  type PromoLayer,
  type PromoLayerKind,
} from '@/features/tools/brand-promo-image/scene'
import { promoErrors } from '@/features/tools/brand-promo-image/content'
import { localAssetErrorMessage } from '@/features/shell/local-assets/content'

const { locale, withLocale } = useAppLocale()
const en = computed(() => locale.value === 'en')
const { scene, assets, selectedId, selected, canUndo, canRedo, busy, saving, preparing, supported, error, message, stage, output, outputPreview, local, commit, preview, revert, patchLayer, reorder, move, moveToEdge, remove, undo, redo, cancel, prepare, importFile, reuse, save, produce } = usePromoEditor()
const kind = ref<PromoLayerKind>('product')
const fileInput = ref<HTMLInputElement>()
const stageEl = ref<HTMLElement>()
const canvasEl = ref<HTMLElement>()
const locked = computed(() => busy.value || saving.value)
const labels = computed(() => en.value ? { background: 'Background', product: 'Product', frame: 'Frame', logo: 'Logo' } : { background: '背景', product: '商品圖', frame: '框版', logo: 'Logo' })
const savedAssets = computed(() => local.records.value.filter(record => ['background', 'frame', 'logo'].includes(record.kind)))
const storageError = computed(() => local.error.value ? localAssetErrorMessage(local.error.value, locale.value) : null)
const drafts = reactive<Record<string, string | number>>({ width: 1000, height: 1000, x: 0, y: 0, scale: 100, opacity: 100 })
const invalidFields = reactive<Record<string, boolean>>({})
const invalid = computed(() => Object.values(invalidFields).some(Boolean))
const errorText = computed(() => invalid.value ? promoErrors.invalid_options![locale.value] : error.value ? (promoErrors[error.value] ?? promoErrors.failed)![locale.value] : '')
/** The layers panel reads like an image editor's: the front layer first. */
const layersFrontToBack = computed(() => [...scene.value.layers].reverse())
watch(selectedId, () => {
  for (const key of ['x', 'y', 'scale', 'opacity']) invalidFields[key] = false
})
watch([scene, selectedId], () => {
  for (const key of ['width', 'height'] as const) if (!invalidFields[key]) drafts[key] = scene.value[key]
  for (const key of ['x', 'y', 'scale', 'opacity'] as const) if (!invalidFields[key]) drafts[key] = Math.round((selected.value?.[key] ?? 0) * 100)
})
const statusText = computed(() => {
  if (saving.value) return en.value ? 'Saving asset on this device…' : '正在這台裝置保存素材…'
  if (busy.value) return (en.value ? 'Processing images locally: ' : '正在本機處理圖片：') + (stage.value === 'encoding' ? (en.value ? 'encoding' : '編碼') : stage.value === 'rendering' ? (en.value ? 'rendering layers' : '算繪圖層') : (en.value ? 'reading / decoding' : '讀取／解碼'))
  const messages: Record<string, string> = en.value
    ? { imported: 'Layer added.', saved: 'Asset saved on this device.', cancelled: 'Cancelled. Existing layers and saved assets are unchanged.', success: 'PNG output is ready.' }
    : { imported: '已加入圖層。', saved: '已將素材保存在這台裝置。', cancelled: '已取消；既有圖層與已保存資產維持原狀。', success: 'PNG 輸出已準備完成。' }
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
    <p class="field-help">{{ en ? 'Combine backgrounds, products, frames, and Logos. No text or price tags. PNG keeps transparent areas.' : '組合背景、商品圖、框版與 Logo，不含文字與價籤。PNG 會保留透明區域。' }}</p>
    <div class="tool-workspace__grid">
      <div class="field-group">
        <label for="promo-kind">{{ en ? 'New layer type' : '新圖層類型' }}</label>
        <select id="promo-kind" v-model="kind" class="ui-input" :disabled="locked">
          <option v-for="item in promoLayerKinds" :key="item" :value="item">{{ labels[item] }}</option>
        </select>
      </div>
      <div class="field-group">
        <label for="promo-file">{{ en ? 'Import image' : '匯入圖片' }}</label>
        <input id="promo-file" ref="fileInput" class="ui-input" type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" :disabled="locked || preparing || !supported" aria-describedby="promo-input-help promo-error" @change="choose">
      </div>
    </div>
    <p id="promo-input-help" class="field-help">{{ en ? 'JPEG / PNG / WebP, up to 25 MiB and 24 MP each. HEIC/HEIF is not supported. Up to 12 layers and 100 MiB of session assets, including undo history.' : 'JPEG／PNG／WebP，每張最多 25 MiB、2,400 萬像素。不支援 HEIC／HEIF。最多 12 個圖層，含復原紀錄的作業素材合計最多 100 MiB。' }}</p>
    <p v-if="preparing" role="status">{{ en ? 'Checking local capabilities…' : '正在檢查本機處理能力…' }}</p>
    <div v-else-if="!supported" class="capability-warning">
      <p>{{ promoErrors.unsupported_browser![locale] }}</p>
      <Button variant="outline" @click="prepare">{{ en ? 'Check again' : '重新檢查' }}</Button>
    </div>

    <div class="tool-workspace__actions">
      <Button variant="outline" :disabled="locked || !canUndo" aria-keyshortcuts="Control+z Meta+z" @click="undo">{{ en ? 'Undo' : '復原' }}</Button>
      <Button variant="outline" :disabled="locked || !canRedo" aria-keyshortcuts="Control+Shift+z Meta+Shift+z" @click="redo">{{ en ? 'Redo' : '重做' }}</Button>
      <span class="field-help">{{ en ? 'Ctrl/⌘ Z · Shift Z to redo (outside numeric fields)' : 'Ctrl／⌘ Z · Shift Z 重做（數字欄位外）' }}</span>
    </div>
    <div class="brand-promo__editor">
      <section class="brand-promo__preview" :aria-label="en ? 'Composition preview' : '組合預覽'">
        <h2>{{ en ? 'Composition preview' : '組合預覽' }}</h2>
        <div class="brand-promo__stage-frame">
          <div
            ref="stageEl"
            class="brand-promo__stage"
            data-promo-stage
            tabindex="0"
            role="group"
            :aria-label="en ? 'Composition preview. Select a layer, then drag it or its handles.' : '組合預覽。選取圖層後可直接拖曳圖層或控制點。'"
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
            <div v-if="selectionStyle" class="brand-promo__selection" data-promo-selection :style="selectionStyle" aria-hidden="true">
              <span v-for="handle in promoHandles" :key="handle" class="brand-promo__handle" :class="`brand-promo__handle--${handle}`" :data-handle="handle" />
            </div>
          </div>
        </div>
        <p id="promo-stage-help" class="field-help">
          {{ en
            ? 'Click a layer, then drag to move it. Drag a corner to scale proportionally (Shift scales freely), drag an edge to stretch one side, and hold Alt to scale from the centre. Arrow keys nudge, Delete removes, and Ctrl/⌘ + ] or [ moves it up or down; hold Ctrl/⌘ to drag a selected layer that is covered.'
            : '點選圖層後直接拖曳移動；拖曳四角等比例縮放（按住 Shift 自由縮放），拖曳四邊單向拉伸，按住 Alt 從中心縮放。方向鍵微調、Delete 移除，Ctrl／⌘＋] 或 [ 調整上下層；被蓋住的已選圖層可按住 Ctrl／⌘ 拖曳。' }}
        </p>
        <p class="field-help">{{ scene.width }} × {{ scene.height }} · {{ en ? 'Preview uses smaller images. Export uses the original files.' : '預覽採縮小圖片，輸出使用原始檔案。' }}</p>
      </section>
      <section class="brand-promo__layers" :aria-label="en ? 'Layers, front to back' : '圖層，由上到下'">
        <h2>{{ en ? 'Layers, front to back' : '圖層，由上到下' }}</h2>
        <p v-if="!scene.layers.length" class="field-help">{{ en ? 'Import a product image to begin.' : '先匯入商品圖，開始組合。' }}</p>
        <p v-else class="field-help">{{ en ? 'Drag a row by its grip to change the stacking order.' : '拖曳左側握把可調整圖層上下順序。' }}</p>
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
              <span>{{ labels[layer.kind] }} · {{ layer.visible ? (en ? 'Visible' : '顯示') : (en ? 'Hidden' : '隱藏') }}</span>
              <span v-if="!assets[layer.assetId]">{{ en ? 'Missing — import again or remove' : '缺失：請重新匯入或移除' }}</span>
            </Button>
          </li>
        </ol>
        <fieldset v-if="selected" :disabled="locked" class="brand-promo__controls">
          <legend>{{ en ? 'Selected layer' : '選取的圖層' }} · {{ labels[selected.kind] }}</legend>
          <p class="brand-promo__filename">{{ assets[selected.assetId]?.file.name }}</p>
          <div class="tool-workspace__actions">
            <Button variant="outline" :disabled="scene.layers.at(-1)?.id === selectedId" aria-keyshortcuts="Control+Shift+BracketRight Meta+Shift+BracketRight" @click="moveToEdge('front')">{{ en ? 'Bring to front' : '移到最上層' }}</Button>
            <Button variant="outline" :disabled="scene.layers.at(-1)?.id === selectedId" aria-keyshortcuts="Control+BracketRight Meta+BracketRight" @click="move(1)">{{ en ? 'Move forward' : '上移一層' }}</Button>
            <Button variant="outline" :disabled="scene.layers[0]?.id === selectedId" aria-keyshortcuts="Control+BracketLeft Meta+BracketLeft" @click="move(-1)">{{ en ? 'Move backward' : '下移一層' }}</Button>
            <Button variant="outline" :disabled="scene.layers[0]?.id === selectedId" aria-keyshortcuts="Control+Shift+BracketLeft Meta+Shift+BracketLeft" @click="moveToEdge('back')">{{ en ? 'Send to back' : '移到最下層' }}</Button>
            <Button variant="outline" :aria-pressed="selected.visible" @click="patchLayer({ visible: !selected.visible })">{{ en ? 'Show layer' : '顯示圖層' }}</Button>
          </div>
          <div class="field-group">
            <label for="promo-fit">{{ en ? 'Fit' : '填滿方式' }}</label>
            <select id="promo-fit" class="ui-input" :value="selected.fit" @change="patchLayer({ fit: ($event.target as HTMLSelectElement).value as 'contain' | 'cover' })">
              <option value="contain">{{ en ? 'Contain whole image' : '完整放入' }}</option>
              <option value="cover">{{ en ? 'Fill and crop' : '填滿裁切' }}</option>
            </select>
          </div>
          <div v-for="field in transforms" :key="field.key" class="field-group">
            <label :for="`promo-${field.key}`">{{ field.label }}</label>
            <Input :id="`promo-${field.key}`" :model-value="drafts[field.key]" :aria-invalid="Boolean(invalidFields[field.key])" type="number" :min="field.min" :max="field.max" step="1" aria-describedby="promo-transform-help promo-error" @update:model-value="transform(field.key, $event)" />
          </div>
          <div v-if="selected.scaleY !== undefined" class="tool-workspace__actions">
            <Button variant="outline" @click="patchLayer({ scaleY: undefined })">{{ en ? 'Restore original proportions' : '還原原始比例' }}</Button>
          </div>
          <p id="promo-transform-help" class="field-help">{{ en ? 'For exact values: position is measured from the centre as a share of the canvas, and scale keeps a stretched layer\'s proportions.' : '需要精確數值時使用：位置從畫布中心起算，以畫布百分比表示；縮放會保留已拉伸圖層的比例。' }}</p>
          <div class="tool-workspace__actions">
            <Button v-for="direction in (['left', 'right', 'up', 'down'] as const)" :key="direction" variant="outline" @click="transform(direction === 'left' || direction === 'right' ? 'x' : 'y', Math.round(selected[direction === 'left' || direction === 'right' ? 'x' : 'y'] * 100) + (direction === 'left' || direction === 'up' ? -1 : 1))">
              {{ en ? `Nudge ${direction}` : { left: '向左微調', right: '向右微調', up: '向上微調', down: '向下微調' }[direction] }}
            </Button>
          </div>
          <div class="tool-workspace__actions">
            <Button v-if="selected.kind !== 'product'" variant="outline" @click="save">{{ en ? 'Save asset on this device' : '保存素材到這台裝置' }}</Button>
            <Button variant="outline" @click="remove">{{ en ? 'Remove layer' : '移除圖層' }}</Button>
          </div>
        </fieldset>
      </section>
    </div>

    <form @submit.prevent="!invalid && produce()">
      <fieldset :disabled="locked" class="brand-promo__controls">
        <legend>{{ en ? 'PNG output size' : 'PNG 輸出尺寸' }}</legend>
        <div class="tool-workspace__grid">
          <div v-for="dimension in (['width', 'height'] as const)" :key="dimension" class="field-group">
            <label :for="`promo-${dimension}`">{{ dimension === 'width' ? (en ? 'Width (px)' : '寬度（像素）') : (en ? 'Height (px)' : '高度（像素）') }}</label>
            <Input :id="`promo-${dimension}`" :model-value="drafts[dimension]" :aria-invalid="Boolean(invalidFields[dimension])" type="number" min="1" max="8192" step="1" aria-describedby="promo-error" @update:model-value="resize(dimension, $event)" />
          </div>
        </div>
      </fieldset>
      <div class="tool-workspace__actions">
        <Button type="submit" :disabled="locked || !supported || !scene.layers.length || invalid">{{ en ? 'Produce PNG' : '產生 PNG' }}</Button>
        <Button v-if="busy" type="button" variant="outline" @click="cancel">{{ en ? 'Cancel' : '取消' }}</Button>
      </div>
    </form>
    <p id="promo-error" role="alert" class="field-error">{{ errorText }}</p>
    <p role="status">{{ statusText }}</p>
    <div v-if="busy" role="progressbar" :aria-label="en ? 'Local image processing' : '本機圖片處理'">{{ en ? 'Working locally. You can cancel.' : '正在本機處理，可隨時取消。' }}</div>
    <figure v-if="outputPreview && !invalid" class="brand-promo__result">
      <img :src="outputPreview" :alt="en ? 'PNG output preview' : 'PNG 輸出預覽'">
      <figcaption>{{ en ? 'Re-encoded PNG does not copy source metadata. Keep your originals.' : '重新編碼的 PNG 不複製來源中繼資料，請保留原始檔案。' }}</figcaption>
    </figure>
    <Button v-if="output && !invalid" as-child><a :href="output" download="brand-promo.png">{{ en ? 'Download PNG' : '下載 PNG' }}</a></Button>

    <section class="brand-promo__library" :aria-label="en ? 'Saved local assets' : '已保存本機資產'">
      <h2>{{ en ? 'Saved on this device' : '保存在這台裝置' }}</h2>
      <p class="field-help">{{ en ? 'Only explicit saves are kept in this browser database. Layouts are not saved. Private browsing, clearing site data, and reclaimed storage may remove assets; export a backup from Local assets.' : '只有主動保存的素材會留在此瀏覽器資料庫，配置不會保存。無痕模式、清除網站資料或空間回收可能讓素材消失；請到本機資產匯出備份。' }}</p>
      <p>{{ en ? 'Local asset usage' : '本機資產用量' }}：{{ (local.usage.value.totalBytes / 1024 / 1024).toFixed(2) }} MiB</p>
      <NuxtLink :to="withLocale('/storage/')">{{ en ? 'Manage local assets and backups' : '管理本機資產與備份' }}</NuxtLink>
      <Button variant="outline" :disabled="local.busy.value || locked" @click="local.refresh">{{ en ? 'Refresh saved assets' : '重新讀取已保存素材' }}</Button>
      <p v-if="storageError" role="alert" class="field-error">{{ storageError.title }} {{ storageError.recovery }}</p>
      <p v-if="local.unreadable.value.length" class="field-error">{{ en ? 'Some assets cannot be read. Manage them on the local assets page; they have not been deleted.' : '部分資產無法讀取，請到本機資產頁管理；它們尚未被刪除。' }}</p>
      <ul>
        <li v-for="record in savedAssets" :key="record.id">
          <span>{{ record.name }} · {{ (record.bytes / 1024).toFixed(1) }} KiB</span>
          <Button variant="outline" :disabled="locked" @click="reuse(record)">{{ en ? 'Add saved asset' : '加入已保存素材' }}</Button>
        </li>
      </ul>
    </section>
  </Card>
</template>
