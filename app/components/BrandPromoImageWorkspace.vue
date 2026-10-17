<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Download, Images, Redo2, Undo2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import ImageBatchDownload from '@/components/ImageBatchDownload.vue'
import ImageBatchStrip from '@/components/ImageBatchStrip.vue'
import PromoCanvas from '@/components/PromoCanvas.vue'
import PromoLayers from '@/components/PromoLayers.vue'
import type { ImageBatchItem } from '@/composables/useImageBatch'
import { usePromoEditor } from '@/composables/usePromoEditor'
import { usePromoShortcuts } from '@/composables/usePromoShortcuts'
import type { PromoLayerKind } from '@/features/tools/brand-promo-image/scene'
import { promoErrors } from '@/features/tools/brand-promo-image/content'

const { locale } = useAppLocale()
const en = computed(() => locale.value === 'en')
const editor = usePromoEditor()
const {
  scene, assets, selected, canUndo, canRedo, busy, preparing, supported, error, message, stage, task, output, undo, redo, cancel, prepare, importFile, produce,
  batch, batchIndex, batchLayer, batchSize, outputs, producing, importBatch, showBatch, removeFromBatch,
} = editor
/** The add buttons follow the order a merchant builds a promo image in: the product first. */
const addKinds: PromoLayerKind[] = ['product', 'background', 'frame', 'logo']
const kind = ref<PromoLayerKind>('product')
const fileInput = ref<HTMLInputElement>()
const batchInput = ref<HTMLInputElement>()
const locked = computed(() => busy.value)
const shortcut = usePromoShortcuts(editor, locked)
const labels = computed(() => en.value ? { background: 'Background', product: 'Product', frame: 'Frame', logo: 'Logo' } : { background: '背景', product: '商品圖', frame: '框版', logo: 'Logo' })
/** A verb ahead of a layer name, spaced the way Chinese copy spaces a Latin word such as Logo. */
function lead(verb: string, kind: PromoLayerKind) {
  return en.value || /^[A-Za-z]/.test(labels.value[kind]) ? `${verb} ` : verb
}
/** Set by the layers panel while a typed number is out of range. */
const invalid = ref(false)
const errorText = computed(() => invalid.value ? promoErrors.invalid_options![locale.value] : error.value ? (promoErrors[error.value] ?? promoErrors.failed)![locale.value] : '')
const several = computed(() => batchSize.value > 1)
const ready = computed(() => (several.value ? outputs.value.length > 0 : Boolean(output.value)) && !invalid.value)
/** The product layer more photos would join: the batch's own, the selected one, or the first. */
const batchTarget = computed(() => batchLayer.value ?? (selected.value?.kind === 'product' ? selected.value : scene.value.layers.find(layer => layer.kind === 'product')))
/** The batch's photos as thumbnails; each is done once the batch's PNGs are made. */
const batchItems = computed<ImageBatchItem[]>(() => batch.value.assetIds.flatMap((assetId, index) => {
  const asset = assets.value[assetId]
  if (!asset) return []
  const status = producing.value === index ? 'running' : outputs.value.length ? 'done' : 'pending'
  return [{ id: assetId, file: asset.file, url: asset.url, status, retryable: false }]
}))
function pickBatch() {
  batchInput.value?.click()
}
function chooseBatch(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  if (files.length) void importBatch(files)
  input.value = ''
}
/* The produce button gives way to the download link; focus follows it instead of dropping to the page. */
watch(ready, async (now) => {
  const focused = document.activeElement
  if (!now || (focused && focused !== document.body && focused.id !== 'promo-produce')) return
  await nextTick()
  ;(document.getElementById('promo-download') ?? document.querySelector<HTMLElement>('.brand-promo [data-batch-download-all]'))?.focus()
})
const statusText = computed(() => {
  if (busy.value) {
    if (task.value === 'import') return en.value ? 'Reading the image…' : '正在讀取圖片…'
    if (several.value && producing.value >= 0) return en.value ? `Making PNG ${producing.value + 1} of ${batchSize.value}…` : `正在產生第 ${producing.value + 1}／${batchSize.value} 張 PNG…`
    return stage.value === 'encoding' ? (en.value ? 'Making the PNG…' : '正在產生 PNG…') : (en.value ? 'Combining layers…' : '正在合成圖層…')
  }
  const messages: Record<string, string> = en.value
    ? { imported: 'Layer added.', batch_added: 'Product photos added. Each one gets this layout.', cancelled: 'Cancelled. Your layers are unchanged.', success: several.value ? 'Your PNGs are ready to download.' : 'Your PNG is ready to download.' }
    : { imported: '已加入圖層。', batch_added: '已加入商品圖，每一張都會套用這個版面。', cancelled: '已取消，圖層維持原狀。', success: several.value ? 'PNG 都準備好了，可以下載。' : 'PNG 已準備好，可以下載。' }
  return messages[message.value] ?? ''
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
</script>

<template>
  <Card class="tool-workspace brand-promo" :class="{ 'brand-promo--batch': several }" :aria-busy="locked" @keydown="shortcut">
    <p v-if="preparing" role="status" class="capability-checking">{{ en ? 'Checking that this browser can make the image…' : '正在確認這個瀏覽器能否製作圖片…' }}</p>
    <div v-else-if="!supported" class="capability-warning">
      <p>{{ promoErrors.unsupported_browser![locale] }}</p>
      <Button variant="outline" @click="prepare">{{ en ? 'Check again' : '重新檢查' }}</Button>
    </div>

    <!-- The picture on the left, every control on the right: nothing sits under the canvas for it to cover. -->
    <div class="brand-promo__editor">
      <div class="brand-promo__main">
        <ImageBatchStrip
          v-if="several"
          class="brand-promo__strip"
          :items="batchItems"
          :selected-id="batch.assetIds[batchIndex]"
          :disabled="locked"
          @select="id => showBatch(batch.assetIds.indexOf(id))"
          @remove="id => removeFromBatch(batch.assetIds.indexOf(id))"
        />
        <PromoCanvas :editor="editor" :empty-text="en ? 'Add a product image, then a background, frame, or Logo.' : '先加入商品圖，再疊上背景、框版或 Logo。'" />
        <p v-show="scene.layers.length" id="promo-stage-help" class="field-help brand-promo__help">
          {{ en
            ? 'Drag a layer on the preview to move it, a corner to resize it, or an edge to stretch it. After clicking the preview, arrow keys nudge and Delete removes.'
            : '在預覽上拖曳圖層即可移動，拖曳四角縮放、四邊拉伸。點一下預覽後，方向鍵可微調、Delete 可移除。' }}
        </p>
      </div>

      <div class="brand-promo__side">
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

        <div class="brand-promo__output">
          <div class="brand-promo__actions">
            <Button variant="outline" size="icon" :disabled="locked || !canUndo" :aria-label="en ? 'Undo' : '復原'" :title="en ? 'Undo (Ctrl/⌘ Z)' : '復原（Ctrl／⌘ Z）'" aria-keyshortcuts="Control+z Meta+z" @click="undo">
              <Undo2 :size="18" aria-hidden="true" />
            </Button>
            <Button variant="outline" size="icon" :disabled="locked || !canRedo" :aria-label="en ? 'Redo' : '重做'" :title="en ? 'Redo (Ctrl/⌘ Shift Z)' : '重做（Ctrl／⌘ Shift Z）'" aria-keyshortcuts="Control+Shift+z Meta+Shift+z" @click="redo">
              <Redo2 :size="18" aria-hidden="true" />
            </Button>
            <Button v-if="ready && !several" as-child class="brand-promo__primary">
              <a id="promo-download" :href="output" download="brand-promo.png"><Download :size="18" aria-hidden="true" />{{ en ? 'Download PNG' : '下載 PNG' }}</a>
            </Button>
            <Button v-else-if="!ready" id="promo-produce" class="brand-promo__primary" :disabled="locked || !supported || !scene.layers.length || invalid" aria-describedby="promo-error" @click="!invalid && produce()">
              {{ several ? (en ? `Make ${batchSize} PNGs` : `產生 ${batchSize} 張 PNG`) : (en ? 'Make PNG' : '產生 PNG') }}
            </Button>
            <Button v-if="busy" variant="outline" @click="cancel">{{ en ? 'Cancel' : '取消' }}</Button>
          </div>
          <ImageBatchDownload v-if="several && ready" class="brand-promo__downloads" :files="outputs" archive-name="brand-promo.zip" />
          <p id="promo-error" role="alert" class="field-error">{{ errorText }}</p>
          <p role="status" class="brand-promo__status">{{ statusText }}</p>
        </div>

        <div v-if="batchTarget" class="brand-promo__batch" data-promo-batch>
          <Button variant="outline" :disabled="locked || !supported" aria-describedby="promo-batch-help promo-error" data-promo-batch-add @click="pickBatch">
            <Images :size="18" aria-hidden="true" />{{ several ? (en ? 'Add more product photos' : '加入更多商品圖') : (en ? 'Use this layout for more photos' : '套用到多張商品圖') }}
          </Button>
          <p id="promo-batch-help" class="field-help">
            {{ several
              ? (en ? `${batchSize} product photos share this layout; making the PNGs makes one for each.` : `${batchSize} 張商品圖共用這個版面，產生時每張各一張 PNG。`)
              : (en ? 'Add other product photos: each is placed in this product layer with the same position, size and layer order.' : '加入其他商品圖，每一張都放進這個商品圖層，位置、大小與圖層順序不變。') }}
          </p>
          <input ref="batchInput" class="brand-promo__file" type="file" multiple accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" tabindex="-1" aria-hidden="true" data-promo-batch-input @change="chooseBatch">
        </div>

        <PromoLayers v-model:invalid="invalid" :editor="editor" />
      </div>
    </div>
  </Card>
</template>
