import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { createPromoHistory, createPromoLayer, reorderPromoLayers, type PromoLayer, type PromoLayerKind, type PromoScene } from '@/features/tools/brand-promo-image/scene'
import { createPromoRenderer } from '@/features/tools/brand-promo-image/engine'
import { createImageCompressor } from '@/features/tools/image-compressor/engine'
import { useWorkspaceDirty } from './useWorkspaceDirty'

interface SessionAsset { file: File, url: string, width: number, height: number }

/**
 * Session pixels are deliberately separate from the undoable, serializable scene.
 * Nothing here is written to the device: the composition and its images go away
 * with the page.
 */
export function usePromoEditor() {
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
  const importer = createImageCompressor(), renderer = createPromoRenderer()
  let generation = 0, mounted = true
  useWorkspaceDirty('brand-promo-image', computed(() => scene.value.layers.length > 0 || busy.value))

  function clearOutput() {
    if (output.value) URL.revokeObjectURL(output.value)
    output.value = ''
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
  function remove() { commit({ ...scene.value, layers: scene.value.layers.filter(layer => layer.id !== selectedId.value) }) }
  function undo() { if (!busy.value) { history.undo(); sync() } }
  function redo() { if (!busy.value) { history.redo(); sync() } }
  function cancel() {
    generation++; importer.cancel(); renderer.cancel(); busy.value = false; stage.value = ''; task.value = ''; message.value = 'cancelled'
  }
  async function prepare() {
    preparing.value = true
    const capabilities = await renderer.prepare()
    if (!mounted) return
    supported.value = capabilities.supported && capabilities.formats.includes('image/png')
    preparing.value = false
  }
  async function importFile(file: File, kind: PromoLayerKind) {
    if (busy.value) return
    if (scene.value.layers.length >= 12) { error.value = 'layer_limit'; return }
    const bytes = Object.values(assets.value).reduce((total, asset) => total + asset.file.size, 0)
    if (bytes + file.size > 100 * 1024 * 1024) { error.value = 'session_limit'; return }
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
      commit({ ...scene.value, layers: [...scene.value.layers, layer] })
      selectedId.value = layer.id; message.value = 'imported'
    }
    catch { error.value = 'memory_limit' }
  }
  async function produce() {
    if (busy.value || !supported.value || !scene.value.layers.length) return
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
  return { scene, assets, selectedId, selected, canUndo, canRedo, busy, preparing, supported, error, message, stage, task, output, commit, preview, revert, patchLayer, reorder, move, moveToEdge, remove, undo, redo, cancel, prepare, importFile, produce }
}
