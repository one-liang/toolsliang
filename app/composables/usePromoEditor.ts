import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { createPromoHistory, createPromoLayer, reorderPromoLayers, type PromoLayer, type PromoLayerKind, type PromoScene } from '@/features/tools/brand-promo-image/scene'
import { createPromoRenderer } from '@/features/tools/brand-promo-image/engine'
import { createImageCompressor } from '@/features/tools/image-compressor/engine'
import { nameImageOutputs } from '@/features/images/archive'
import { imageBatchLimits } from '@/features/images/batch'
import { useWorkspaceDirty } from './useWorkspaceDirty'

export interface SessionAsset { file: File, url: string, width: number, height: number }

export interface PromoEditorOptions {
  /** What the pictures added in one visit may add up to. */
  sessionLimit?: number
  /**
   * Where a new layer goes: on top, as an image editor does, or by its kind —
   * background at the back, then the product, the frame and the Logo — for a
   * layout that is built up once and reused.
   */
  order?: 'top' | 'kind'
  /** Whether this editor reports unfinished work for itself; a page that embeds it reports for the whole page. */
  trackDirty?: boolean
}

/** The asset id a slot layer carries; its picture is handed in from outside the editor. */
const slotAssetId = 'slot'
const kindRank: Record<PromoLayerKind, number> = { background: 0, product: 1, frame: 2, logo: 3 }

/**
 * One product layer standing for several product photos: the layout is made
 * once, and every photo is placed in that layer's frame in turn. The photos are
 * session pixels like any other asset, so they are not steps in the history.
 */
interface PromoBatch { layerId: string, assetIds: string[] }

/** The tool's own names, never the photos': brand-promo.png, then -2, -3 and so on. */
function promoOutputNames(count: number) {
  return nameImageOutputs(Array.from({ length: count }, () => ({ name: 'brand-promo.png', format: 'image/png' })), '')
}

/**
 * Session pixels are deliberately separate from the undoable, serializable scene.
 * Nothing here is written to the device: the composition and its images go away
 * with the page.
 */
export function usePromoEditor(options: PromoEditorOptions = {}) {
  const sessionLimit = options.sessionLimit ?? 100 * 1024 * 1024
  const history = createPromoHistory({ width: 1000, height: 1000, layers: [] })
  const scene = shallowRef(history.scene)
  const assets = shallowRef<Record<string, SessionAsset>>({})
  const selectedId = ref('')
  const selected = computed(() => scene.value.layers.find(layer => layer.id === selectedId.value))
  const canUndo = ref(false), canRedo = ref(false)
  const busy = ref(false), preparing = ref(true), supported = ref(false)
  const error = ref(''), message = ref(''), stage = ref('')
  /** Which long job `busy` belongs to, so the status names it in the visitor's words. */
  const task = ref<'import' | 'produce' | ''>('')
  const output = ref('')
  const batch = shallowRef<PromoBatch>({ layerId: '', assetIds: [] })
  /** Which of the batch's photos the preview shows. */
  const batchIndex = ref(0)
  /** One finished PNG per photo, in batch order, once every one of them is made. */
  const outputs = shallowRef<{ name: string, blob: Blob }[]>([])
  /** The photo being made right now, while a batch is produced. */
  const producing = ref(-1)
  const importer = createImageCompressor(), renderer = createPromoRenderer()
  let generation = 0, mounted = true
  if (options.trackDirty !== false) useWorkspaceDirty('brand-promo-image', computed(() => scene.value.layers.length > 0 || busy.value))

  function clearOutput() {
    if (output.value) URL.revokeObjectURL(output.value)
    output.value = ''
    outputs.value = []
  }
  /**
   * A product layer whose picture is not the editor's: the workbench lays out
   * the template once, and each of its photos is shown, and rendered, in it.
   */
  const slot = shallowRef<{ layerId: string, asset?: SessionAsset }>({ layerId: '' })
  const slotLayer = computed(() => scene.value.layers.find(layer => layer.id === slot.value.layerId))
  /** The layer the batch belongs to, while it is still in the scene. */
  const batchLayer = computed(() => scene.value.layers.find(layer => layer.id === batch.value.layerId))
  const batchSize = computed(() => batchLayer.value ? batch.value.assetIds.length : 0)
  /** What a layer shows: a batch layer shows the photo picked in the batch, every other layer its own image. */
  function assetOf(layer: PromoLayer) {
    if (layer.id === slot.value.layerId) return slot.value.asset
    const id = layer.id === batch.value.layerId && batchSize.value > 1 ? batch.value.assetIds[batchIndex.value] ?? layer.assetId : layer.assetId
    return assets.value[id]
  }
  /** Which picture a layer is drawing right now, as a stable key for anything cached per picture. */
  function shownAssetId(layer: PromoLayer) {
    if (layer.id === slot.value.layerId) return slot.value.asset ? `slot:${slot.value.asset.url}` : layer.assetId
    return layer.id === batch.value.layerId && batchSize.value > 1 ? batch.value.assetIds[batchIndex.value] ?? layer.assetId : layer.assetId
  }
  function withLayer(layers: PromoLayer[], layer: PromoLayer) {
    if (options.order !== 'kind') return [...layers, layer]
    const index = layers.reduce((position, entry, at) => kindRank[entry.kind] <= kindRank[layer.kind] ? at + 1 : position, 0)
    return [...layers.slice(0, index), layer, ...layers.slice(index)]
  }
  /** Gives the scene its slot layer, once; the picture shown in it is set with `showInSlot`. */
  function ensureSlot() {
    if (slotLayer.value || busy.value) return
    const layer = createPromoLayer('product', slotAssetId)
    slot.value = { ...slot.value, layerId: layer.id }
    commit({ ...scene.value, layers: withLayer(scene.value.layers, layer) })
  }
  function showInSlot(asset: SessionAsset | undefined) {
    slot.value = { ...slot.value, asset }
  }
  /**
   * The template drawn with `file` in its slot layer, as one PNG. It leaves the
   * editor's own state alone: whoever calls it owns the run and its result.
   */
  async function renderSlot(file: File, signal?: AbortSignal) {
    const files: Record<string, File> = {}
    for (const layer of scene.value.layers) {
      const source = layer.id === slot.value.layerId ? file : assets.value[layer.assetId]?.file
      if (source) files[layer.assetId] = source
    }
    return renderer.run({ scene: scene.value, files }, { signal })
  }
  function cancelRender() {
    renderer.cancel()
  }
  /** The scene as it is drawn with one of the batch's photos in its layer. */
  function sceneFor(index: number): PromoScene {
    const assetId = batch.value.assetIds[index]
    return assetId ? { ...scene.value, layers: scene.value.layers.map(layer => layer.id === batch.value.layerId ? { ...layer, assetId } : layer) } : scene.value
  }
  function sync() {
    scene.value = history.scene
    canUndo.value = history.canUndo; canRedo.value = history.canRedo
    if (!scene.value.layers.some(layer => layer.id === selectedId.value)) selectedId.value = scene.value.layers.at(-1)?.id ?? ''
    clearOutput(); message.value = ''; error.value = ''
  }
  function commit(next: PromoScene) {
    if (busy.value) return
    history.commit(next); sync()
  }
  /**
   * A gesture in progress on the preview: drawn straight away, but not a step
   * in the history until `commit` is called once the pointer is released.
   */
  function preview(next: PromoScene) {
    if (busy.value) return
    scene.value = next
    clearOutput(); message.value = ''; error.value = ''
  }
  /** Puts the canvas back to the last committed step, for a gesture abandoned with Escape. */
  function revert() { if (!busy.value) sync() }
  function patchLayer(patch: Partial<PromoLayer>) {
    commit({ ...scene.value, layers: scene.value.layers.map(layer => layer.id === selectedId.value ? { ...layer, ...patch } : layer) })
  }
  /** Moves a layer to a position in the back-to-front order. */
  function reorder(id: string, index: number) {
    const layers = reorderPromoLayers(scene.value.layers, id, index)
    if (layers !== scene.value.layers) commit({ ...scene.value, layers })
  }
  function move(direction: number) {
    const index = scene.value.layers.findIndex(layer => layer.id === selectedId.value)
    const target = index + direction
    if (index < 0 || target < 0 || target >= scene.value.layers.length) return
    reorder(selectedId.value, target)
  }
  /** Brings the selected layer to the front, or sends it to the back. */
  function moveToEdge(edge: 'front' | 'back') {
    if (selectedId.value) reorder(selectedId.value, edge === 'front' ? scene.value.layers.length - 1 : 0)
  }
  /** The slot layer is where the photos go, so it stays: there is nothing to put them in without it. */
  function remove() {
    if (selectedId.value === slot.value.layerId) return
    commit({ ...scene.value, layers: scene.value.layers.filter(layer => layer.id !== selectedId.value) })
  }
  function undo() { if (!busy.value) { history.undo(); sync() } }
  function redo() { if (!busy.value) { history.redo(); sync() } }
  function cancel() {
    generation++; importer.cancel(); renderer.cancel(); busy.value = false; stage.value = ''; task.value = ''; producing.value = -1; message.value = 'cancelled'
  }
  async function prepare() {
    preparing.value = true
    const capabilities = await renderer.prepare()
    if (!mounted) return
    supported.value = capabilities.supported && capabilities.formats.includes('image/png')
    preparing.value = false
  }
  /** Reads one picture into a session asset: a small preview for the stage, and the file itself for the render. */
  async function readAsset(file: File, current: number) {
    const result = await importer.run({ file, format: 'image/png', quality: 1, maxWidth: 800, maxHeight: 800 }, { onProgress: progress => { stage.value = progress.stage } })
    if (!mounted || current !== generation) return 'stale' as const
    if (result.status !== 'success') return result
    const assetId = crypto.randomUUID()
    const url = URL.createObjectURL(result.output.blob)
    assets.value = { ...assets.value, [assetId]: { file, url, width: result.output.sourceWidth, height: result.output.sourceHeight } }
    return { status: 'success' as const, assetId }
  }
  /**
   * More product photos for one product layer, to be made with the same
   * layout. The layer the visitor has selected takes them when it is a product
   * layer; otherwise the batch's own layer, or the first product layer.
   */
  async function importBatch(files: File[]) {
    if (busy.value || !files.length) return
    const selectedProduct = selected.value?.kind === 'product' ? selected.value : undefined
    const layer = batchLayer.value ?? selectedProduct ?? scene.value.layers.find(entry => entry.kind === 'product')
    if (!layer) return
    if (batch.value.layerId !== layer.id) { batch.value = { layerId: layer.id, assetIds: [layer.assetId] }; batchIndex.value = 0 }
    const room = imageBatchLimits.maxItems - batch.value.assetIds.length
    if (room <= 0 || files.length > room) { error.value = 'batch_limit'; if (room <= 0) return }
    busy.value = true; task.value = 'import'; message.value = ''; stage.value = 'reading'
    const current = ++generation
    let added = 0
    for (const file of files.slice(0, Math.max(0, room))) {
      const bytes = Object.values(assets.value).reduce((total, asset) => total + asset.file.size, 0)
      if (bytes + file.size > sessionLimit) { error.value = 'session_limit'; break }
      const result = await readAsset(file, current)
      if (result === 'stale') return
      if (result.status === 'cancelled') { message.value = 'cancelled'; break }
      if (result.status === 'error') { error.value = result.error.code; continue }
      batch.value = { ...batch.value, assetIds: [...batch.value.assetIds, result.assetId] }
      added += 1
    }
    busy.value = false; stage.value = ''; task.value = ''
    if (added) { clearOutput(); batchIndex.value = batch.value.assetIds.length - added; if (!error.value) message.value = 'batch_added' }
  }
  /** Shows one of the batch's photos in its layer; nothing about the layout changes. */
  function showBatch(index: number) {
    if (index >= 0 && index < batch.value.assetIds.length) batchIndex.value = index
  }
  /**
   * Takes one photo out of the batch. The first photo is the layer's own image,
   * so taking it out hands the layer to the next photo as one undoable step.
   */
  function removeFromBatch(index: number) {
    if (busy.value || index < 0 || index >= batch.value.assetIds.length) return
    const assetIds = batch.value.assetIds.filter((_, position) => position !== index)
    if (index === 0 && batchLayer.value && assetIds[0]) {
      const layerId = batchLayer.value.id
      commit({ ...scene.value, layers: scene.value.layers.map(layer => layer.id === layerId ? { ...layer, assetId: assetIds[0]! } : layer) })
    }
    batch.value = { ...batch.value, assetIds }
    batchIndex.value = Math.min(batchIndex.value, Math.max(0, assetIds.length - 1))
    clearOutput()
  }
  async function importFile(file: File, kind: PromoLayerKind) {
    if (busy.value) return
    if (scene.value.layers.length >= 12) { error.value = 'layer_limit'; return }
    const bytes = Object.values(assets.value).reduce((total, asset) => total + asset.file.size, 0)
    if (bytes + file.size > sessionLimit) { error.value = 'session_limit'; return }
    busy.value = true; task.value = 'import'; error.value = ''; message.value = ''; stage.value = 'reading'
    const current = ++generation
    const result = await importer.run({ file, format: 'image/png', quality: 1, maxWidth: 800, maxHeight: 800 }, { onProgress: progress => { stage.value = progress.stage } })
    if (!mounted || current !== generation) return
    busy.value = false; stage.value = ''; task.value = ''
    if (result.status === 'error') { error.value = result.error.code; return }
    if (result.status === 'cancelled') { message.value = 'cancelled'; return }
    try {
      const assetId = crypto.randomUUID()
      const url = URL.createObjectURL(result.output.blob)
      assets.value = { ...assets.value, [assetId]: { file, url, width: result.output.sourceWidth, height: result.output.sourceHeight } }
      const layer = createPromoLayer(kind, assetId)
      commit({ ...scene.value, layers: withLayer(scene.value.layers, layer) })
      selectedId.value = layer.id; message.value = 'imported'
    }
    catch { error.value = 'memory_limit' }
  }
  /** Every photo of the batch, one after another, each with the same layout; the PNGs are offered once all of them are made. */
  async function produceBatch() {
    busy.value = true; task.value = 'produce'; error.value = ''; message.value = ''; clearOutput()
    const current = ++generation
    const made: Blob[] = []
    for (let index = 0; index < batch.value.assetIds.length; index++) {
      producing.value = index
      const next = sceneFor(index)
      const files = Object.fromEntries(next.layers.map(layer => [layer.assetId, assets.value[layer.assetId]?.file]).filter((entry): entry is [string, File] => entry[1] instanceof File))
      const result = await renderer.run({ scene: next, files }, { onProgress: progress => { stage.value = progress.stage } })
      if (!mounted || current !== generation) return
      if (result.status === 'error') { error.value = result.error.code; break }
      if (result.status === 'cancelled') { message.value = 'cancelled'; break }
      made.push(result.output.blob)
    }
    busy.value = false; stage.value = ''; task.value = ''; producing.value = -1
    if (made.length !== batch.value.assetIds.length) return
    const names = promoOutputNames(made.length)
    outputs.value = made.map((blob, index) => ({ name: names[index]!, blob }))
    message.value = 'success'
  }
  async function produce() {
    if (busy.value || !supported.value || !scene.value.layers.length) return
    if (batchSize.value > 1) return produceBatch()
    busy.value = true; task.value = 'produce'; error.value = ''; message.value = ''; clearOutput()
    const current = ++generation
    const files = Object.fromEntries(scene.value.layers.map(layer => [layer.assetId, assets.value[layer.assetId]?.file]).filter((entry): entry is [string, File] => entry[1] instanceof File))
    const result = await renderer.run({ scene: scene.value, files }, { onProgress: progress => { stage.value = progress.stage } })
    if (!mounted || current !== generation) return
    busy.value = false; stage.value = ''; task.value = ''
    if (result.status === 'error') error.value = result.error.code
    else if (result.status === 'cancelled') message.value = 'cancelled'
    else {
      // The preview on the stage is already the result, so only the file is kept.
      try { output.value = URL.createObjectURL(result.output.blob); message.value = 'success' }
      catch { clearOutput(); error.value = 'memory_limit' }
    }
  }
  onMounted(prepare)
  onBeforeUnmount(() => {
    mounted = false; generation++; importer.dispose(); renderer.dispose(); clearOutput()
    Object.values(assets.value).forEach(asset => URL.revokeObjectURL(asset.url))
    assets.value = {}
  })
  return {
    scene, assets, selectedId, selected, canUndo, canRedo, busy, preparing, supported, error, message, stage, task, output, commit, preview, revert, patchLayer, reorder, move, moveToEdge, remove, undo, redo, cancel, prepare, importFile, produce,
    batch, batchIndex, batchLayer, batchSize, outputs, producing, assetOf, shownAssetId, importBatch, showBatch, removeFromBatch,
    slot, slotLayer, ensureSlot, showInSlot, renderSlot, cancelRender,
  }
}

export type PromoEditor = ReturnType<typeof usePromoEditor>
