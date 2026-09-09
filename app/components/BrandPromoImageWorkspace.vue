<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { usePromoEditor } from '@/composables/usePromoEditor'
import { promoLayerKinds, promoPlacement, type PromoLayer, type PromoLayerKind } from '@/features/tools/brand-promo-image/scene'
import { promoErrors } from '@/features/tools/brand-promo-image/content'
import { localAssetErrorMessage } from '@/features/shell/local-assets/content'

const { locale, withLocale } = useAppLocale()
const en = computed(() => locale.value === 'en')
const { scene, assets, selectedId, selected, canUndo, canRedo, busy, saving, preparing, supported, error, message, stage, output, outputPreview, local, commit, patchLayer, move, remove, undo, redo, cancel, prepare, importFile, reuse, save, produce } = usePromoEditor()
const kind = ref<PromoLayerKind>('product')
const fileInput = ref<HTMLInputElement>()
const locked = computed(() => busy.value || saving.value)
const labels = computed(() => en.value ? { background: 'Background', product: 'Product', frame: 'Frame', logo: 'Logo' } : { background: '背景', product: '商品圖', frame: '框版', logo: 'Logo' })
const savedAssets = computed(() => local.records.value.filter(record => ['background', 'frame', 'logo'].includes(record.kind)))
const storageError = computed(() => local.error.value ? localAssetErrorMessage(local.error.value, locale.value) : null)
const drafts = reactive<Record<string, string | number>>({ width: 1000, height: 1000, x: 0, y: 0, scale: 100, opacity: 100 })
const invalidFields = reactive<Record<string, boolean>>({})
const invalid = computed(() => Object.values(invalidFields).some(Boolean))
const errorText = computed(() => invalid.value ? promoErrors.invalid_options![locale.value] : error.value ? (promoErrors[error.value] ?? promoErrors.failed)![locale.value] : '')
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
  patchLayer({ [key]: value / 100 })
}
function resize(key: 'width' | 'height', raw: string | number) {
  drafts[key] = raw
  const value = Number(raw)
  invalidFields[key] = !Number.isInteger(value) || value < 1 || value > 8192 || value * scene.value[key === 'width' ? 'height' : 'width'] > 24_000_000
  if (invalidFields[key]) return
  commit({ ...scene.value, [key]: value })
}
function layerStyle(layer: PromoLayer) {
  const asset = assets.value[layer.assetId]
  if (!asset) return {}
  const p = promoPlacement(layer, asset.width, asset.height, scene.value.width, scene.value.height)
  return { left: `${p.x / scene.value.width * 100}%`, top: `${p.y / scene.value.height * 100}%`, width: `${p.width / scene.value.width * 100}%`, height: `${p.height / scene.value.height * 100}%`, opacity: layer.opacity }
}
function choose(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) void importFile(file, kind.value)
  input.value = ''
}
function shortcut(event: KeyboardEvent) {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return
  event.preventDefault()
  if (event.shiftKey) redo()
  else undo()
}
</script>

<template>
  <Card class="tool-workspace brand-promo" :aria-busy="locked" @keydown="shortcut">
    <p class="eyebrow">{{ en ? 'Your assets, your device' : '你的素材，留在你的裝置' }}</p>
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
      <section class="brand-promo__layers" :aria-label="en ? 'Layers, back to front' : '圖層，由底到頂'">
        <h2>{{ en ? 'Layers, back to front' : '圖層，由底到頂' }}</h2>
        <p v-if="!scene.layers.length" class="field-help">{{ en ? 'Import a product image to begin.' : '先匯入商品圖，開始組合。' }}</p>
        <ol>
          <li v-for="(layer, index) in scene.layers" :key="layer.id">
            <Button variant="outline" :aria-pressed="selectedId === layer.id" :disabled="locked" @click="selectedId = layer.id">
              {{ index + 1 }} · {{ labels[layer.kind] }} · {{ layer.visible ? (en ? 'Visible' : '顯示') : (en ? 'Hidden' : '隱藏') }}
              <span v-if="!assets[layer.assetId]">{{ en ? 'Missing — import again or remove' : '缺失：請重新匯入或移除' }}</span>
            </Button>
          </li>
        </ol>
        <fieldset v-if="selected" :disabled="locked" class="brand-promo__controls">
          <legend>{{ en ? 'Selected layer' : '選取的圖層' }} · {{ labels[selected.kind] }}</legend>
          <p class="brand-promo__filename">{{ assets[selected.assetId]?.file.name }}</p>
          <div class="tool-workspace__actions">
            <Button variant="outline" :disabled="scene.layers[0]?.id === selectedId" @click="move(-1)">{{ en ? 'Move backward' : '下移一層' }}</Button>
            <Button variant="outline" :disabled="scene.layers.at(-1)?.id === selectedId" @click="move(1)">{{ en ? 'Move forward' : '上移一層' }}</Button>
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
          <p id="promo-transform-help" class="field-help">{{ en ? 'Position is measured from the centre as a share of the canvas. Use number fields or nudge buttons.' : '位置從置中起算，以畫布百分比表示。可用數字欄位或微調按鈕。' }}</p>
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
      <section class="brand-promo__preview" :aria-label="en ? 'Composition preview' : '組合預覽'">
        <h2>{{ en ? 'Composition preview' : '組合預覽' }}</h2>
        <div class="brand-promo__canvas" role="img" :aria-label="en ? 'Local layer composition preview' : '本機圖層組合預覽'" :style="{ aspectRatio: `${scene.width} / ${scene.height}`, '--promo-ratio': scene.width / scene.height }">
          <template v-for="layer in scene.layers" :key="layer.id">
            <img v-if="layer.visible && assets[layer.assetId]" :src="assets[layer.assetId]!.url" :style="layerStyle(layer)" alt="">
          </template>
        </div>
        <p class="field-help">{{ scene.width }} × {{ scene.height }} · {{ en ? 'Preview uses smaller images. Export uses the original files.' : '預覽採縮小圖片，輸出使用原始檔案。' }}</p>
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
