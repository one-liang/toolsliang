import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { useImageBatch, type ImageBatchItem } from './useImageBatch'
import { useBackgroundRemovalModel } from './useBackgroundRemovalModel'
import { usePromoEditor, type SessionAsset } from './usePromoEditor'
import { useUnloadGuard } from './useUnloadGuard'
import { useWorkspaceDirty } from './useWorkspaceDirty'
import { imageInputLimits } from '@/features/images/limits'
import { createBackgroundRemover } from '@/features/tools/image-background-remover/engine'
import { createImageCompressor } from '@/features/tools/image-compressor/engine'
import { defaultOutputFormat, recommendedQuality } from '@/features/tools/image-compressor/output-settings'
import type { ImageFormat } from '@/features/tools/image-compressor/types'
import type { EngineCapabilities } from '@/features/tools/engine/contract'
import type { modelPreparationIssues } from '@/features/tools/image-background-remover/content'
import { workbenchOutputName } from '@/features/tools/product-image-workbench/archive'

/** One finished picture: the file to download and a small preview to show. */
export interface WorkbenchResult { blob: Blob, url: string, format: string, width: number, height: number }

/** The three jobs the workbench chains, each the same as the tool it comes from. */
export interface WorkbenchJobs { cutout: boolean, compose: boolean, compress: boolean }

export type WorkbenchStage = 'preparing-model' | 'cutout' | 'compose' | 'compress'

/** A picture that cannot be read or is over the limits stays refused however often it is tried. */
const finalErrors = new Set(['unsupported_format', 'unsupported_heic', 'too_large', 'corrupt_image'])
const imageFormats = ['image/jpeg', 'image/png', 'image/webp'] as const

/**
 * The workbench: the portrait background remover, the brand promo layout and
 * the image compressor, run on every photo of a batch in turn with one set of
 * choices.
 *
 * Each job is the engine of the tool it comes from, with that tool's own
 * settings: the cutout is the portrait model, the layout is the brand promo
 * editor with the photo in its product layer, and the compression keeps the
 * size at the recommended quality and only asks for a format. One photo is
 * worked on at a time, so the model and the encoders never compete for the
 * device's memory, and one photo's failure is only that photo's. A cutout is
 * kept per photo, so changing the layout or the format redoes only what follows
 * it. Nothing is written to the device and nothing is uploaded.
 */
export function useProductWorkbench() {
  const batch = useImageBatch<WorkbenchResult>({ release: result => URL.revokeObjectURL(result.url) })
  const { items, selected } = batch
  const editor = usePromoEditor({ sessionLimit: 200 * 1024 * 1024, order: 'kind', trackDirty: false })
  const remover = createBackgroundRemover()
  const compressor = createImageCompressor()
  const model = useBackgroundRemovalModel()

  const jobs = reactive<WorkbenchJobs>({ cutout: false, compose: true, compress: true })
  /** 'auto' lets each picture follow its own format, as the image compressor does. */
  const format = ref<'auto' | ImageFormat>('auto')
  const removerCapabilities = shallowRef<EngineCapabilities>()
  const compressorCapabilities = shallowRef<EngineCapabilities>()
  const cutouts = shallowRef<Record<string, SessionAsset>>({})
  const running = ref(false)
  const runningId = ref<string>()
  const stage = ref<WorkbenchStage | ''>('')
  /** Pressed start while the model was still on its way; the run follows on its own. */
  const waiting = ref(false)
  /** Nothing runs until the visitor presses start, and again once the batch has been worked through. */
  const paused = ref(true)
  const message = ref<'cancelled' | 'done' | ''>('')
  const issue = ref<keyof typeof modelPreparationIssues | ''>('')
  let generation = 0
  let mounted = true

  const removerSupported = computed(() => Boolean(removerCapabilities.value?.supported))
  const offeredFormats = computed<ImageFormat[]>(() => compressorCapabilities.value?.supported ? compressorCapabilities.value.formats as ImageFormat[] : [...imageFormats])
  const busy = computed(() => running.value || waiting.value)
  const anyJob = computed(() => jobs.cutout || jobs.compose || jobs.compress)
  const pending = computed(() => items.value.filter(item => item.status === 'pending').length)
  const done = computed(() => items.value.filter((item): item is ImageBatchItem<WorkbenchResult> & { result: WorkbenchResult } => item.status === 'done' && Boolean(item.result)))
  const dirty = computed(() => items.value.length > 0 || busy.value)
  useWorkspaceDirty('product-image-workbench', dirty)
  useUnloadGuard(dirty)

  /** The picture a photo is shown and laid out with: its cutout once there is one. */
  function pictureOf(item: ImageBatchItem<WorkbenchResult>): SessionAsset | undefined {
    const cutout = jobs.cutout ? cutouts.value[item.id] : undefined
    if (cutout) return cutout
    return item.size ? { file: item.file, url: item.url, width: item.size.width, height: item.size.height } : undefined
  }
  const downloads = computed(() => done.value.map(item => ({
    name: workbenchOutputName(items.value.indexOf(item) + 1, item.result.format),
    blob: item.result.blob,
  })))

  async function prepare() {
    const [removal, compression] = await Promise.all([remover.prepare(), compressor.prepare()])
    if (!mounted) return
    removerCapabilities.value = removal
    compressorCapabilities.value = compression
    // A job this browser cannot do is not left ticked: it would only fail on every photo.
    if (!removal.supported) jobs.cutout = false
    if (!compression.supported) jobs.compress = false
  }
  watch([editor.preparing, editor.supported], ([checking, capable]) => {
    if (!checking && !capable) jobs.compose = false
  })

  /** Stops whatever is running without touching the results already made. */
  function interrupt() {
    ++generation
    remover.cancel()
    compressor.cancel()
    editor.cancelRender()
    if (runningId.value) batch.update(runningId.value, { status: 'pending' })
    running.value = false
    runningId.value = undefined
    waiting.value = false
    stage.value = ''
  }

  type Step = { status: 'success', file: File, preview?: Blob, width: number, height: number } | { status: 'error', code: string } | { status: 'cancelled' } | { status: 'stale' }

  /** The portrait model on one photo; its cutout is kept for every later run. */
  async function cutout(item: ImageBatchItem<WorkbenchResult>, current: number): Promise<Step> {
    const kept = cutouts.value[item.id]
    if (kept) return { status: 'success', file: kept.file, width: kept.width, height: kept.height }
    if (!model.ready.value) {
      waiting.value = true
      stage.value = 'preparing-model'
      const outcome = await model.download()
      if (current !== generation || !mounted) return { status: 'stale' }
      waiting.value = false
      if (outcome !== 'ready') {
        issue.value = outcome === 'cancelled' ? 'failed' : outcome
        return { status: 'cancelled' }
      }
    }
    stage.value = 'cutout'
    const outcome = await remover.run({ file: item.file })
    if (current !== generation || !mounted) return { status: 'stale' }
    if (outcome.status !== 'success') {
      if (outcome.status === 'error' && (outcome.error.code === 'model_download_failed' || outcome.error.code === 'model_digest_mismatch')) {
        model.forget()
        issue.value = 'failed'
        return { status: 'cancelled' }
      }
      return outcome.status === 'error' ? { status: 'error', code: outcome.error.code } : { status: 'cancelled' }
    }
    const file = new File([outcome.output.blob], 'cutout.png', { type: 'image/png' })
    const asset = { file, url: URL.createObjectURL(outcome.output.blob), width: outcome.output.width, height: outcome.output.height }
    cutouts.value = { ...cutouts.value, [item.id]: asset }
    return { status: 'success', file, width: asset.width, height: asset.height }
  }

  /**
   * Takes the next waiting photo through the jobs that are on. Starting never
   * asks the visitor to fetch anything first: if the model is still on its
   * way, this waits for it and carries on.
   */
  async function pump() {
    if (running.value || waiting.value || paused.value || !mounted || !anyJob.value) return
    const item = items.value.find(entry => entry.status === 'pending')
    if (!item) {
      paused.value = true
      if (done.value.length) message.value = 'done'
      return
    }
    const current = ++generation
    running.value = true
    runningId.value = item.id
    batch.update(item.id, { status: 'running', error: undefined })
    const fail = (code: string) => batch.update(item.id, { status: 'failed', error: code, retryable: !finalErrors.has(code) })
    const settle = () => { running.value = false; runningId.value = undefined; stage.value = '' }

    let file = item.file
    let size = item.size
    let preview: Blob | undefined
    if (jobs.cutout) {
      const step = await cutout(item, current)
      if (step.status === 'stale') return
      if (step.status !== 'success') {
        settle()
        batch.update(item.id, step.status === 'error' ? { status: 'failed', error: step.code, retryable: !finalErrors.has(step.code) } : { status: 'pending' })
        if (step.status === 'cancelled') paused.value = true
        return
      }
      file = step.file
      size = { width: step.width, height: step.height }
    }
    if (jobs.compose) {
      stage.value = 'compose'
      const outcome = await editor.renderSlot(file)
      if (current !== generation || !mounted) return
      if (outcome.status !== 'success') { settle(); return outcome.status === 'error' ? fail(outcome.error.code) : batch.update(item.id, { status: 'pending' }) }
      file = new File([outcome.output.blob], 'layout.png', { type: 'image/png' })
      size = { width: outcome.output.width, height: outcome.output.height }
      preview = outcome.output.preview
    }
    if (jobs.compress) {
      stage.value = 'compress'
      const source = imageFormats.find(type => type === file.type)
      const target = format.value !== 'auto' && offeredFormats.value.includes(format.value) ? format.value : defaultOutputFormat(source, offeredFormats.value)
      // Every accepted picture fits within the largest side, so the output keeps its size.
      const outcome = await compressor.run({ file, format: target, quality: recommendedQuality, maxWidth: imageInputLimits.maxSide, maxHeight: imageInputLimits.maxSide })
      if (current !== generation || !mounted) return
      if (outcome.status !== 'success') { settle(); return outcome.status === 'error' ? fail(outcome.error.code) : batch.update(item.id, { status: 'pending' }) }
      file = new File([outcome.output.blob], 'output', { type: outcome.output.format })
      size = { width: outcome.output.width, height: outcome.output.height }
      preview = outcome.output.preview
    }
    settle()
    try {
      const url = URL.createObjectURL(preview ?? file)
      batch.update(item.id, { status: 'done', result: { blob: file, url, format: file.type || 'image/png', width: size?.width ?? 0, height: size?.height ?? 0 } })
    }
    catch { fail('memory_limit') }
  }

  function start() {
    if (busy.value || !anyJob.value) return
    issue.value = ''
    message.value = ''
    paused.value = false
    void pump()
  }

  /** Stopping while the model is on its way also stops the transfer, so cancelling never keeps spending the visitor's data. */
  function cancel() {
    interrupt()
    model.cancel()
    paused.value = true
    message.value = 'cancelled'
  }

  function retry(id: string) {
    batch.update(id, { status: 'pending', error: undefined, retryable: true })
    start()
  }

  function forgetCutout(id: string) {
    const kept = cutouts.value[id]
    if (!kept) return
    URL.revokeObjectURL(kept.url)
    const { [id]: _, ...rest } = cutouts.value
    cutouts.value = rest
  }

  function remove(id: string) {
    if (id === runningId.value) interrupt()
    forgetCutout(id)
    batch.remove(id)
  }

  /** Clearing the photos keeps the layout: the next photos are laid out the same way. */
  function clear() {
    interrupt()
    for (const id of Object.keys(cutouts.value)) forgetCutout(id)
    paused.value = true
    issue.value = ''
    message.value = ''
    batch.clear()
  }

  function add(files: File[]) {
    message.value = ''
    batch.add(files)
  }

  /** Any change to what the batch should become makes every result stale; a cutout is kept, as it does not depend on it. */
  function invalidate() {
    if (running.value || waiting.value) interrupt()
    message.value = ''
    for (const item of items.value) {
      if (item.status === 'done' || item.status === 'running' || (item.status === 'failed' && item.retryable)) batch.update(item.id, { status: 'pending', error: undefined, result: undefined })
    }
  }

  watch(() => ({ ...jobs }), invalidate)
  watch(format, invalidate)
  watch(() => editor.scene.value, invalidate)
  watch(items, () => { void pump() })
  /** The layout always has the photo on screen in its product layer. */
  watch([() => jobs.compose, () => items.value.length > 0, () => editor.slotLayer.value, busy], ([compose, chosen, layer, working]) => {
    if (compose && chosen && !layer && !working) editor.ensureSlot()
  }, { immediate: true })
  watch([selected, cutouts, () => jobs.cutout], () => {
    editor.showInSlot(selected.value ? pictureOf(selected.value) : undefined)
  }, { immediate: true })
  /**
   * Turning the cutout on with photos chosen is the sign the visitor means to
   * use it, so the model starts arriving then; opening the page alone fetches
   * nothing. How this background attempt ends is only reported once the
   * visitor asks to start.
   */
  watch([() => jobs.cutout, () => items.value.length > 0, removerSupported], ([on, chosen, capable]) => {
    if (on && chosen && capable && !model.ready.value) void model.download()
  })

  onMounted(prepare)
  onBeforeUnmount(() => {
    mounted = false
    ++generation
    remover.dispose()
    compressor.dispose()
    for (const asset of Object.values(cutouts.value)) URL.revokeObjectURL(asset.url)
  })

  return {
    batch, items, selected, editor, jobs, format, offeredFormats, removerSupported, compressorCapabilities, removerCapabilities,
    running, runningId, stage, waiting, paused, message, issue, busy, anyJob, pending, done, downloads, cutouts, model,
    pictureOf, prepare, start, cancel, retry, remove, clear, add,
  }
}
