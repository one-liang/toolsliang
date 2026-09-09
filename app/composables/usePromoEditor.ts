import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { createPromoHistory, createPromoLayer, type PromoLayer, type PromoLayerKind, type PromoScene } from '@/features/tools/brand-promo-image/scene'
import { createPromoRenderer } from '@/features/tools/brand-promo-image/engine'
import { createImageCompressor } from '@/features/tools/image-compressor/engine'
import { createLocalAssetRepository } from '@/features/shell/local-assets/repository'
import { openLocalAssetStore } from '@/features/shell/local-assets/indexeddb-store'
import type { LocalAssetRecord } from '@/features/shell/local-assets/schema'
import { useLocalAssets } from './useLocalAssets'
import { useWorkspaceDirty } from './useWorkspaceDirty'

interface SessionAsset { file: File, url: string, width: number, height: number }

/** Session pixels are deliberately separate from the undoable, serializable scene. */
export function usePromoEditor() {
  const history = createPromoHistory({ width: 1000, height: 1000, layers: [] })
  const scene = shallowRef(history.scene)
  const assets = shallowRef<Record<string, SessionAsset>>({})
  const selectedId = ref('')
  const selected = computed(() => scene.value.layers.find(layer => layer.id === selectedId.value))
  const canUndo = ref(false), canRedo = ref(false)
  const busy = ref(false), saving = ref(false), preparing = ref(true), supported = ref(false)
  const error = ref(''), message = ref(''), stage = ref('')
  const output = ref(''), outputPreview = ref('')
  const local = useLocalAssets()
  const repository = createLocalAssetRepository(openLocalAssetStore)
  const importer = createImageCompressor(), renderer = createPromoRenderer()
  let generation = 0, mounted = true
  useWorkspaceDirty('brand-promo-image', computed(() => scene.value.layers.length > 0 || busy.value || saving.value))

  function clearOutput() {
    if (output.value) URL.revokeObjectURL(output.value)
    if (outputPreview.value) URL.revokeObjectURL(outputPreview.value)
    output.value = ''; outputPreview.value = ''
  }
  function sync() {
    scene.value = history.scene
    canUndo.value = history.canUndo; canRedo.value = history.canRedo
    if (!scene.value.layers.some(layer => layer.id === selectedId.value)) selectedId.value = scene.value.layers.at(-1)?.id ?? ''
    clearOutput(); message.value = ''; error.value = ''
  }
  function commit(next: PromoScene) {
    if (busy.value || saving.value) return
    history.commit(next); sync()
  }
  function patchLayer(patch: Partial<PromoLayer>) {
    commit({ ...scene.value, layers: scene.value.layers.map(layer => layer.id === selectedId.value ? { ...layer, ...patch } : layer) })
  }
  function move(direction: number) {
    const layers = [...scene.value.layers]
    const index = layers.findIndex(layer => layer.id === selectedId.value)
    const target = index + direction
    if (index < 0 || target < 0 || target >= layers.length) return
    const [layer] = layers.splice(index, 1)
    layers.splice(target, 0, layer!)
    commit({ ...scene.value, layers })
  }
  function remove() { commit({ ...scene.value, layers: scene.value.layers.filter(layer => layer.id !== selectedId.value) }) }
  function undo() { if (!busy.value && !saving.value) { history.undo(); sync() } }
  function redo() { if (!busy.value && !saving.value) { history.redo(); sync() } }
  function cancel() {
    generation++; importer.cancel(); renderer.cancel(); busy.value = false; stage.value = ''; message.value = 'cancelled'
  }
  async function prepare() {
    preparing.value = true
    const capabilities = await renderer.prepare()
    if (!mounted) return
    supported.value = capabilities.supported && capabilities.formats.includes('image/png')
    preparing.value = false
  }
  async function importFile(file: File, kind: PromoLayerKind, assetId: string = crypto.randomUUID()) {
    if (busy.value || saving.value) return
    if (scene.value.layers.length >= 12) { error.value = 'layer_limit'; return }
    const bytes = Object.values(assets.value).reduce((total, asset) => total + asset.file.size, 0)
    if (bytes + file.size > 100 * 1024 * 1024) { error.value = 'session_limit'; return }
    busy.value = true; error.value = ''; message.value = ''; stage.value = 'reading'
    const current = ++generation
    const result = await importer.run({ file, format: 'image/png', quality: 1, maxWidth: 800, maxHeight: 800 }, { onProgress: progress => { stage.value = progress.stage } })
    if (!mounted || current !== generation) return
    busy.value = false; stage.value = ''
    if (result.status === 'error') { error.value = result.error.code; return }
    if (result.status === 'cancelled') { message.value = 'cancelled'; return }
    try {
      // A new session id avoids invalidating another layer's reference or its undo history.
      if (assets.value[assetId]) assetId = crypto.randomUUID()
      const url = URL.createObjectURL(result.output.blob)
      assets.value = { ...assets.value, [assetId]: { file, url, width: result.output.sourceWidth, height: result.output.sourceHeight } }
      const layer = createPromoLayer(kind, assetId)
      commit({ ...scene.value, layers: [...scene.value.layers, layer] })
      selectedId.value = layer.id; message.value = 'imported'
    }
    catch { error.value = 'memory_limit' }
  }
  async function reuse(record: LocalAssetRecord) {
    if (record.payload.format !== 'binary' || !['background', 'frame', 'logo'].includes(record.kind)) { error.value = 'missing_asset'; return }
    await importFile(new File([new Uint8Array(record.payload.bytes)], record.name, { type: record.payload.mediaType }), record.kind as PromoLayerKind, record.id)
  }
  async function save() {
    const layer = selected.value
    if (!layer || layer.kind === 'product' || busy.value || saving.value) return
    const asset = assets.value[layer.assetId]
    if (!asset) { error.value = 'missing_asset'; return }
    saving.value = true; error.value = ''; message.value = ''
    try {
      const result = await repository.save({ kind: layer.kind, name: asset.file.name, payload: { format: 'binary', mediaType: asset.file.type, bytes: new Uint8Array(await asset.file.arrayBuffer()) } })
      if (!mounted) return
      if (!result.ok) local.error.value = result.code
      else { await local.refresh(); message.value = 'saved' }
    }
    catch { error.value = 'read_failed' }
    finally { saving.value = false }
  }
  async function produce() {
    if (busy.value || saving.value || !supported.value || !scene.value.layers.length) return
    busy.value = true; error.value = ''; message.value = ''; clearOutput()
    const current = ++generation
    const files = Object.fromEntries(scene.value.layers.map(layer => [layer.assetId, assets.value[layer.assetId]?.file]).filter((entry): entry is [string, File] => entry[1] instanceof File))
    const result = await renderer.run({ scene: scene.value, files }, { onProgress: progress => { stage.value = progress.stage } })
    if (!mounted || current !== generation) return
    busy.value = false; stage.value = ''
    if (result.status === 'error') error.value = result.error.code
    else if (result.status === 'cancelled') message.value = 'cancelled'
    else {
      try { output.value = URL.createObjectURL(result.output.blob); outputPreview.value = URL.createObjectURL(result.output.preview); message.value = 'success' }
      catch { clearOutput(); error.value = 'memory_limit' }
    }
  }
  onMounted(prepare)
  onBeforeUnmount(() => {
    mounted = false; generation++; importer.dispose(); renderer.dispose(); clearOutput()
    Object.values(assets.value).forEach(asset => URL.revokeObjectURL(asset.url))
    assets.value = {}
  })
  return { scene, assets, selectedId, selected, canUndo, canRedo, busy, saving, preparing, supported, error, message, stage, output, outputPreview, local, commit, patchLayer, move, remove, undo, redo, cancel, prepare, importFile, reuse, save, produce }
}
