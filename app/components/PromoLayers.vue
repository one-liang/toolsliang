<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ArrowDown, ArrowUp, GripVertical, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { PromoEditor } from '@/composables/usePromoEditor'
import { promoScaleRange, type PromoLayerKind } from '@/features/tools/brand-promo-image/scene'

/**
 * The layout's layers, front first, and the numbers behind the selected one and
 * the PNG size: the keyboard and screen-reader route to everything the canvas
 * does with a pointer. Shared by the brand promo image and the product
 * workbench.
 */
const props = withDefaults(defineProps<{
  editor: PromoEditor
  locked?: boolean
}>(), { locked: false })
/** True while a typed number is outside what the renderer accepts; the PNG must not be made until it is fixed. */
const invalid = defineModel<boolean>('invalid', { default: false })

const { locale } = useAppLocale()
const en = computed(() => locale.value === 'en')
const { scene, selectedId, selected, busy, assetOf, commit, patchLayer, reorder, move, remove } = props.editor
const locked = computed(() => busy.value || props.locked)
const labels = computed(() => en.value ? { background: 'Background', product: 'Product', frame: 'Frame', logo: 'Logo' } : { background: '背景', product: '商品圖', frame: '框版', logo: 'Logo' })
/** A verb ahead of a layer name, spaced the way Chinese copy spaces a Latin word such as Logo. */
function lead(verb: string, kind: PromoLayerKind) {
  return en.value || /^[A-Za-z]/.test(labels.value[kind]) ? `${verb} ` : verb
}
const drafts = reactive<Record<string, string | number>>({ width: 1000, height: 1000, x: 0, y: 0, scale: 100, opacity: 100 })
const invalidFields = reactive<Record<string, boolean>>({})
watch(() => Object.values(invalidFields).some(Boolean), (now) => { invalid.value = now }, { immediate: true })
/** The layers panel reads like an image editor's: the front layer first. */
const layersFrontToBack = computed(() => [...scene.value.layers].reverse())
watch(selectedId, () => {
  for (const key of ['x', 'y', 'scale', 'opacity']) invalidFields[key] = false
})
watch([scene, selectedId], () => {
  for (const key of ['width', 'height'] as const) if (!invalidFields[key]) drafts[key] = scene.value[key]
  for (const key of ['x', 'y', 'scale', 'opacity'] as const) if (!invalidFields[key]) drafts[key] = Math.round((selected.value?.[key] ?? 0) * 100)
}, { immediate: true })
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
</script>

<template>
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
            <img v-if="assetOf(layer)" class="brand-promo__thumb" :src="assetOf(layer)!.url" alt="" draggable="false">
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
</template>
