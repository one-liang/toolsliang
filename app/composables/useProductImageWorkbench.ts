import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { validateImageInput } from '@/features/images/input'
import { imageInputLimits } from '@/features/images/limits'
import { createBackgroundRemover } from '@/features/tools/image-background-remover/engine'
import type { EngineOutcome, ToolEngine } from '@/features/tools/engine/contract'
import { createCompliantImageRenderer } from '@/features/tools/compliant-product-image/engine'
import { createPromoRenderer } from '@/features/tools/brand-promo-image/engine'
import { createImageCompressor } from '@/features/tools/image-compressor/engine'
import { createArchiveWriter } from '@/features/tools/product-image-workbench/engine'
import { checkWorkbenchArchive, workbenchOutputName } from '@/features/tools/product-image-workbench/archive'
import {
  compliantImagePresets,
} from '@/features/tools/compliant-product-image/domain/reference'
import {
  findCompliantImagePreset,
  resolvePresetStatus,
} from '@/features/tools/compliant-product-image/domain/preset'
import {
  encodableFormats,
  formatMimeTypes,
  resolveByteRange,
  resolveOutputFormats,
  suggestOutputSize,
  type EncodableFormat,
} from '@/features/tools/compliant-product-image/domain/render'
import {
  planBrandScene,
  planCompressionInput,
  planLayoutInput,
  resolveLayoutBounds,
  type WorkbenchCompressionSettings,
  type WorkbenchLayoutSettings,
} from '@/features/tools/product-image-workbench/pipeline'
import {
  admitWorkbenchFiles,
  advanceWorkbenchQueue,
  clearWorkbenchQueue,
  createWorkbenchQueue,
  goToWorkbenchStep,
  measureWorkbenchItem,
  planWorkbenchRuns,
  removeWorkbenchItem,
  resolveWorkbenchLaneLimits,
  resolveWorkbenchLimits,
  setWorkbenchQueuePurpose,
  updateWorkbenchItem,
  updateWorkbenchItems,
  updateWorkbenchPipeline,
  workbenchLaneOf,
  workbenchQueueBytes,
  workbenchQueueOutputs,
  workbenchQueueProgress,
  workbenchStepStatus,
} from '@/features/tools/product-image-workbench/queue'
import {
  blockWorkbenchStep,
  completeWorkbenchStep,
  failWorkbenchStep,
  noteWorkbenchStepError,
  resetWorkbenchStep,
  skipWorkbenchStep,
  startWorkbenchStep,
  unblockWorkbenchStep,
  workbenchSteps,
  type WorkbenchPurpose,
  type WorkbenchSession,
  type WorkbenchStep,
} from '@/features/tools/product-image-workbench/session'
import { useWorkspaceDirty } from './useWorkspaceDirty'
import { useUnloadGuard } from './useUnloadGuard'

/**
 * One item's file and results, kept out of the queue document on purpose: the
 * queue is the shape of the batch and stays inspectable, while every pixel
 * lives here and is released the moment the component goes away.
 */
interface StepArtifact { blob: Blob, file: File, url: string, width: number, height: number, bytes: number, format: string }

/** The steps that run an engine and hold a produced file. */
const engineSteps = ['cutout', 'layout', 'brand', 'compress'] as const

type EngineStep = typeof engineSteps[number]

/** How many of one step's engines may run at once, before the device lowers it further. */
const poolSizes: Record<EngineStep, number> = { cutout: 1, layout: 2, brand: 2, compress: 2 }

type StepRun
  = { status: 'success', blob: Blob, width: number, height: number }
    | { status: 'cancelled' }
    | { status: 'error', code: string }

function releaseArtifact(artifact: StepArtifact | undefined) {
  if (artifact) URL.revokeObjectURL(artifact.url)
}

/**
 * The workbench: a queue, five engines it does not own, and the rule that one
 * item's trouble never becomes another item's.
 *
 * A batch is configured once and applied to every item, so a step is started
 * for the whole queue and the queue decides who runs next — never more at a
 * time than §12.11's lanes allow. Each item records its own outcome on its own
 * step, and hands its result forward as a plain `File`. Nothing is written to
 * disk, nothing is uploaded, and cancelling terminates the workers that were
 * running rather than waiting for them.
 */
export function useProductImageWorkbench() {
  /** One pool per step, sized by the lane it competes in. */
  const pools = {
    cutout: Array.from({ length: poolSizes.cutout }, createBackgroundRemover),
    layout: Array.from({ length: poolSizes.layout }, createCompliantImageRenderer),
    brand: Array.from({ length: poolSizes.brand }, createPromoRenderer),
    compress: Array.from({ length: poolSizes.compress }, createImageCompressor),
  }
  const archiver = createArchiveWriter()

  const limits = ref(resolveWorkbenchLimits({}))
  const laneLimits = ref(resolveWorkbenchLaneLimits({}))
  const queue = ref(createWorkbenchQueue('compliant', limits.value))

  /** Everything the queue document deliberately does not hold, keyed by item id. */
  const sources = shallowRef<Record<string, File>>({})
  const previews = shallowRef<Record<string, string>>({})
  const sizes = shallowRef<Record<string, { width: number, height: number }>>({})
  const artifacts = shallowRef<Record<string, Partial<Record<EngineStep, StepArtifact>>>>({})

  const frame = shallowRef<File>()
  const logo = shallowRef<File>()
  const frameUrl = ref('')
  const logoUrl = ref('')
  const frameSize = shallowRef<{ width: number, height: number }>()
  const logoSize = shallowRef<{ width: number, height: number }>()

  const runningStep = ref<EngineStep | ''>('')
  const stages = ref<Record<string, string>>({})
  const preparing = ref(true)
  const validating = ref(false)
  const archiving = ref(false)
  const archiveUrl = ref('')
  const notice = ref('')
  const importIssues = ref<{ kind: 'input' | 'admission', code: string }[]>([])
  const selected = ref('')

  /** The device's own day, so a preset that has not been re-read stops being usable here. */
  const today = ref('')

  const presetId = ref(compliantImagePresets[0]!.id)
  const layoutFormats = ref<EncodableFormat[]>([...encodableFormats])
  const settings = ref<WorkbenchLayoutSettings>({
    presetId: presetId.value,
    width: 1000,
    height: 1000,
    format: 'image/jpeg',
    fit: 'cover',
    zoom: 100,
    offsetX: 0,
    offsetY: 0,
    background: '#ffffff',
  })
  const brandSettings = ref({ logoScale: 25, logoX: 35, logoY: -35, logoOpacity: 100 })
  const compression = ref<WorkbenchCompressionSettings>({ format: 'image/jpeg', quality: 80, maxWidth: 2000, maxHeight: 2000 })

  /** Which item is running which step's engine, so one item can be cancelled on its own. */
  const active = new Map<string, { step: EngineStep, slot: number }>()
  /** Items the merchant pulled out of the batch that is running, so none is started again. */
  const withdrawn = new Set<string>()
  let generation = 0
  let mounted = true

  const busy = computed(() => Boolean(runningStep.value) || validating.value || archiving.value)
  const items = computed(() => queue.value.items)
  const dirty = computed(() => items.value.length > 0 || busy.value)
  const purpose = computed(() => queue.value.purpose)
  const pipeline = computed(() => queue.value.pipeline)
  const current = computed(() => queue.value.current)
  const preset = computed(() => findCompliantImagePreset(presetId.value)!)
  const evaluationDate = computed(() => today.value || preset.value.reviewedAt)
  const presetStatus = computed(() => resolvePresetStatus(preset.value, evaluationDate.value))
  const presetDisabled = computed(() => presetStatus.value === 'expired' || presetStatus.value === 'retired')
  const bounds = computed(() => resolveLayoutBounds(purpose.value, preset.value, evaluationDate.value))
  const byteRange = computed(() => resolveByteRange(preset.value, evaluationDate.value))
  const progress = computed(() => workbenchQueueProgress(queue.value))
  const outputs = computed(() => workbenchQueueOutputs(queue.value))
  const usedBytes = computed(() => workbenchQueueBytes(queue.value))
  const previewItem = computed(() => items.value.find(item => item.id === selected.value) ?? items.value[0])

  useWorkspaceDirty('product-image-workbench', dirty)
  useUnloadGuard(dirty)

  function setArtifact(id: string, step: EngineStep, artifact: StepArtifact | undefined) {
    releaseArtifact(artifacts.value[id]?.[step])
    artifacts.value = { ...artifacts.value, [id]: { ...artifacts.value[id], [step]: artifact } }
  }

  /** Re-running a step throws away it and everything after it, so no stale file can be downloaded. */
  function dropFrom(id: string, step: WorkbenchStep) {
    const from = workbenchSteps.indexOf(step)
    for (const later of engineSteps) {
      if (workbenchSteps.indexOf(later) >= from) setArtifact(id, later, undefined)
    }
  }

  function releaseItem(id: string) {
    for (const step of engineSteps) releaseArtifact(artifacts.value[id]?.[step])
    if (previews.value[id]) URL.revokeObjectURL(previews.value[id]!)
  }

  function toArtifact(blob: Blob, name: string, width: number, height: number): StepArtifact {
    return {
      blob,
      file: new File([blob], name, { type: blob.type }),
      url: URL.createObjectURL(blob),
      width,
      height,
      bytes: blob.size,
      format: blob.type,
    }
  }

  function applyPreset() {
    if (purpose.value !== 'compliant') return
    const size = suggestOutputSize(preset.value, evaluationDate.value)
    const formats = resolveOutputFormats(preset.value, evaluationDate.value, layoutFormats.value)
    const preferred = formats.includes('jpeg') ? 'jpeg' : formats[0]
    settings.value = {
      ...settings.value,
      presetId: presetId.value,
      width: size.width,
      height: size.height,
      format: preferred ? formatMimeTypes[preferred] : settings.value.format,
    }
  }

  const availableFormats = computed<EncodableFormat[]>(() => purpose.value === 'compliant'
    ? resolveOutputFormats(preset.value, evaluationDate.value, layoutFormats.value)
    : layoutFormats.value)

  /**
   * Which engines this device can actually run. Kept as state rather than
   * applied once, because two steps only exist on one branch: switching
   * branches has to ask the same question again instead of quietly offering a
   * step whose engine was already found unavailable.
   */
  const supported = ref<Record<EngineStep, boolean>>({ cutout: false, layout: false, brand: false, compress: false })
  const archiveSupported = ref(false)
  const layoutSupported = computed(() => supported.value.layout)

  function applyCapabilities() {
    for (const step of engineSteps) {
      // While the compliant branch is running, the promotional steps are already
      // absent for a product reason; a capability answer must not overwrite that.
      if (queue.value.pipeline.blocked[step] === 'purpose') continue
      queue.value = updateWorkbenchPipeline(queue.value, session => supported.value[step]
        ? unblockWorkbenchStep(session, step)
        : blockWorkbenchStep(session, step, 'capability'))
    }
  }

  /**
   * §12.11 asks for a preflight before any engine is loaded. Each engine is
   * asked separately and only its own step is disabled, so a device that cannot
   * run the model still lays out and brands a batch — and the archive is
   * offered only once the writer itself has answered.
   */
  async function prepare() {
    preparing.value = true
    const [cutout, layout, brand, compress, archive] = await Promise.all([
      ...engineSteps.map(step => pools[step][0]!.prepare()),
      archiver.prepare(),
    ])
    if (!mounted || !cutout || !layout || !brand || !compress || !archive) return
    layoutFormats.value = layout.supported
      ? encodableFormats.filter(format => layout.formats.includes(formatMimeTypes[format]))
      : [...encodableFormats]
    supported.value = { cutout: cutout.supported, layout: layout.supported, brand: brand.supported, compress: compress.supported }
    archiveSupported.value = archive.supported
    applyCapabilities()
    preparing.value = false
    applyPreset()
  }

  function goTo(step: WorkbenchStep) {
    if (busy.value) return
    queue.value = goToWorkbenchStep(queue.value, step)
  }

  function choosePurpose(next: WorkbenchPurpose) {
    if (busy.value || purpose.value === next) return
    for (const item of items.value) dropFrom(item.id, 'layout')
    queue.value = setWorkbenchQueuePurpose(queue.value, next)
    applyCapabilities()
    if (next === 'compliant') applyPreset()
  }

  function skip(step: WorkbenchStep) {
    if (busy.value) return
    for (const item of items.value) dropFrom(item.id, step)
    queue.value = advanceWorkbenchQueue(updateWorkbenchItems(queue.value, session => skipWorkbenchStep(session, step)), step)
    notice.value = 'skipped'
  }

  function measure(file: File, onSize: (size: { width: number, height: number }) => void, onFailure: () => void) {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => { if (mounted) onSize({ width: image.naturalWidth, height: image.naturalHeight }) }
    image.onerror = () => { if (mounted) onFailure() }
    image.src = url

    return url
  }

  /**
   * Takes in a batch. Every ceiling §12.11 states is checked here, before any
   * engine starts, so a batch that was accepted is a batch that can be run:
   * the file itself, then the queue's item and byte limits, then the picture's
   * own dimensions once the browser has read them.
   */
  async function importFiles(files: File[]) {
    if (busy.value || files.length === 0) return
    validating.value = true
    importIssues.value = []
    notice.value = ''
    const issues: { kind: 'input' | 'admission', code: string }[] = []
    try {
      const checked = await Promise.all(files.map(async file => ({
        file,
        code: await validateImageInput(file).catch(() => 'corrupt_image' as const) ?? (file.size > imageInputLimits.maxBytes ? 'too_large' : undefined),
      })))
      if (!mounted) return
      for (const entry of checked) if (entry.code) issues.push({ kind: 'input', code: entry.code })
      const usable = checked.filter(entry => !entry.code).map(entry => entry.file)
      const { queue: grown, accepted, rejected } = admitWorkbenchFiles(queue.value, usable.map(file => ({ bytes: file.size })))
      for (const refusal of rejected) issues.push({ kind: 'admission', code: refusal.code })
      const admitted = usable.filter((_, index) => !rejected.some(refusal => refusal.index === index))
      queue.value = grown

      accepted.forEach((item, index) => {
        const file = admitted[index]!
        sources.value = { ...sources.value, [item.id]: file }
        previews.value = {
          ...previews.value,
          [item.id]: measure(
            file,
            (size) => {
              sizes.value = { ...sizes.value, [item.id]: size }
              queue.value = advanceWorkbenchQueue(measureWorkbenchItem(queue.value, item.id, size), 'import')
            },
            () => { queue.value = updateWorkbenchItem(queue.value, item.id, session => failWorkbenchStep(session, 'import', 'corrupt_image')) },
          ),
        }
      })
      applyCapabilities()
      if (!selected.value && accepted[0]) selected.value = accepted[0].id
      importIssues.value = issues.filter((issue, index) => issues.findIndex(other => other.code === issue.code) === index)
      if (accepted.length) notice.value = 'imported'
    }
    finally {
      if (mounted) validating.value = false
    }
  }

  function without<T>(record: Record<string, T>, id: string): Record<string, T> {
    return Object.fromEntries(Object.entries(record).filter(([key]) => key !== id))
  }

  function removeItem(id: string) {
    if (busy.value) return
    releaseItem(id)
    sources.value = without(sources.value, id)
    previews.value = without(previews.value, id)
    artifacts.value = without(artifacts.value, id)
    sizes.value = without(sizes.value, id)
    queue.value = removeWorkbenchItem(queue.value, id)
    // An empty batch has nothing to be on a later step for.
    if (items.value.length === 0) queue.value = { ...queue.value, current: 'import' }
    if (selected.value === id) selected.value = items.value[0]?.id ?? ''
    notice.value = 'removed'
  }

  function selectItem(id: string) {
    selected.value = id
  }

  async function chooseBrandAsset(kind: 'frame' | 'logo', file: File) {
    if (busy.value) return
    const code = await validateImageInput(file) ?? (file.size > imageInputLimits.maxBytes ? 'too_large' : undefined)
    if (!mounted) return
    if (code) {
      queue.value = updateWorkbenchItems(queue.value, session => noteWorkbenchStepError(session, 'brand', code))
      return
    }
    // The preview places these with the same geometry the renderer uses, so it
    // needs their decoded size, not just something to show.
    if (kind === 'frame') {
      if (frameUrl.value) URL.revokeObjectURL(frameUrl.value)
      frameSize.value = undefined
      frame.value = file
      frameUrl.value = measure(file, (size) => { frameSize.value = size }, () => {})
    }
    else {
      if (logoUrl.value) URL.revokeObjectURL(logoUrl.value)
      logoSize.value = undefined
      logo.value = file
      logoUrl.value = measure(file, (size) => { logoSize.value = size }, () => {})
    }
    notice.value = 'asset-added'
  }

  function clearBrandAsset(kind: 'frame' | 'logo') {
    if (kind === 'frame') {
      if (frameUrl.value) URL.revokeObjectURL(frameUrl.value)
      frame.value = undefined
      frameUrl.value = ''
      frameSize.value = undefined
    }
    else {
      if (logoUrl.value) URL.revokeObjectURL(logoUrl.value)
      logo.value = undefined
      logoUrl.value = ''
      logoSize.value = undefined
    }
  }

  /** The five engines answer in the same shape; this is that shape, once. */
  function toStepOutcome<T extends { blob: Blob, width: number, height: number }>(outcome: EngineOutcome<T>): StepRun {
    if (outcome.status === 'success') return { status: 'success', blob: outcome.output.blob, width: outcome.output.width, height: outcome.output.height }
    if (outcome.status === 'cancelled') return { status: 'cancelled' }

    return { status: 'error', code: outcome.error.code }
  }

  /** What one step feeds on: the previous step that actually produced a file. */
  function inputFor(id: string, step: EngineStep): File | undefined {
    const produced = artifacts.value[id]
    if (step === 'cutout') return sources.value[id]
    if (step === 'layout') return produced?.cutout?.file ?? sources.value[id]
    if (step === 'brand') return produced?.layout?.file

    return produced?.brand?.file ?? produced?.layout?.file
  }

  async function execute(id: string, step: EngineStep, slot: number, onProgress: (stage: string) => void): Promise<StepRun> {
    const file = inputFor(id, step)
    if (!file) return { status: 'error', code: 'missing_step_input' }

    if (step === 'cutout') {
      const engine = pools.cutout[slot] as ToolEngine<{ file: File }, { blob: Blob, width: number, height: number }>
      return toStepOutcome(await engine.run({ file }, { onProgress: update => onProgress(update.stage) }))
    }
    if (step === 'layout') {
      if (purpose.value === 'compliant' && presetDisabled.value) return { status: 'error', code: 'preset_unavailable' }
      onProgress('validating-preset')
      const input = planLayoutInput({ file, purpose: purpose.value, settings: settings.value, byteRange: byteRange.value })
      return toStepOutcome(await pools.layout[slot]!.run(input, { onProgress: update => onProgress(update.stage) }))
    }
    if (step === 'brand') {
      if (!frame.value && !logo.value) return { status: 'error', code: 'missing_asset' }
      const product = artifacts.value[id]!.layout!
      onProgress('composing')
      const input = planBrandScene({
        canvas: { width: product.width, height: product.height },
        product: file,
        frame: frame.value,
        logo: logo.value,
        ...brandSettings.value,
      })
      return toStepOutcome(await pools.brand[slot]!.run(input, { onProgress: update => onProgress(update.stage) }))
    }

    const input = planCompressionInput({ file, settings: compression.value })
    return toStepOutcome(await pools.compress[slot]!.run(input, { onProgress: update => onProgress(update.stage) }))
  }

  function claim(step: EngineStep) {
    const taken = new Set([...active.values()].filter(entry => entry.step === step).map(entry => entry.slot))

    return Array.from({ length: poolSizes[step] }, (_, index) => index).find(index => !taken.has(index)) ?? 0
  }

  function setStage(id: string, stage: string) {
    stages.value = { ...stages.value, [id]: stage }
  }

  /** One engine run for one item, recorded on that item's own step. */
  async function runItem(id: string, step: EngineStep) {
    const slot = claim(step)
    active.set(id, { step, slot })
    dropFrom(id, step)
    queue.value = updateWorkbenchItem(queue.value, id, session => startWorkbenchStep(session, step))
    setStage(id, '')
    const outcome = await execute(id, step, slot, stage => setStage(id, stage))
    active.delete(id)
    if (!mounted) return
    setStage(id, '')
    if (outcome.status === 'cancelled') {
      queue.value = updateWorkbenchItem(queue.value, id, session => resetWorkbenchStep(session, step))
      return
    }
    if (outcome.status === 'error') {
      queue.value = updateWorkbenchItem(queue.value, id, session => failWorkbenchStep(session, step, outcome.code))
      return
    }
    try {
      setArtifact(id, step, toArtifact(outcome.blob, `${step}-result`, outcome.width, outcome.height))
      queue.value = updateWorkbenchItem(queue.value, id, session => completeWorkbenchStep(session, step))
    }
    catch {
      queue.value = updateWorkbenchItem(queue.value, id, session => failWorkbenchStep(session, step, 'memory_limit'))
    }
  }

  function laneLimitFor(step: EngineStep) {
    const lane = workbenchLaneOf(step)

    return Math.min(poolSizes[step], lane ? laneLimits.value[lane] : 1)
  }

  /**
   * Runs one step across the batch, never more at a time than the lane allows.
   *
   * The queue decides who starts; this only keeps the lane full and waits. An
   * item that finishes frees its slot for the next one, so a batch of twenty
   * never has twenty workers open, and the page stays answerable throughout.
   */
  async function runStep(step: EngineStep, only?: string) {
    if (busy.value) return
    const run = ++generation
    runningStep.value = step
    notice.value = ''
    withdrawn.clear()
    const inFlight = new Map<string, Promise<void>>()
    while (run === generation) {
      const ready = only
        ? (queue.value.items.find(item => item.id === only && item.session.states[step] === 'ready') ? [only] : [])
        : planWorkbenchRuns(queue.value, step, { running: [...inFlight.keys(), ...withdrawn], limit: laneLimitFor(step) })
      for (const id of ready.filter(candidate => !inFlight.has(candidate) && !withdrawn.has(candidate))) {
        inFlight.set(id, runItem(id, step).finally(() => inFlight.delete(id)))
      }
      if (inFlight.size === 0) break
      await Promise.race(inFlight.values())
    }
    await Promise.allSettled(inFlight.values())
    if (!mounted || run !== generation) return
    runningStep.value = ''
    if (!only) queue.value = advanceWorkbenchQueue(queue.value, step)
    notice.value = 'step-done'
  }

  /** Retry one item at the step it stopped on, without disturbing the rest of the batch. */
  function retryItem(id: string) {
    const session = queue.value.items.find(item => item.id === id)?.session
    const step = session && engineSteps.find(candidate => session.states[candidate] === 'failed')
    if (!step) return
    queue.value = updateWorkbenchItem(queue.value, id, entry => resetWorkbenchStep(entry, step))

    return runStep(step, id)
  }

  /**
   * Cancelling one item terminates that item's worker and hands its step back.
   * It is also withdrawn from the batch that is running, because a step handed
   * back is a step the scheduler would otherwise pick up again immediately.
   */
  function cancelItem(id: string) {
    const entry = active.get(id)
    if (!entry) return
    active.delete(id)
    withdrawn.add(id)
    pools[entry.step][entry.slot]!.cancel()
  }

  /**
   * Cancel-all stops the batch where it is. Items that explicitly finished keep
   * their results and stay downloadable; everything that was still running or
   * still waiting is handed back, so nothing half-produced is ever offered.
   */
  function cancelAll() {
    if (!runningStep.value && !archiving.value) return
    ++generation
    for (const [id, entry] of active) {
      active.delete(id)
      pools[entry.step][entry.slot]!.cancel()
    }
    archiver.cancel()
    runningStep.value = ''
    archiving.value = false
    stages.value = {}
    notice.value = 'cancelled'
  }

  function reset() {
    if (busy.value) cancelAll()
    ++generation
    for (const item of items.value) releaseItem(item.id)
    releaseArchive()
    clearBrandAsset('frame')
    clearBrandAsset('logo')
    sources.value = {}
    previews.value = {}
    sizes.value = {}
    artifacts.value = {}
    stages.value = {}
    importIssues.value = []
    selected.value = ''
    queue.value = clearWorkbenchQueue(queue.value)
    notice.value = 'reset'
  }

  function releaseArchive() {
    if (archiveUrl.value) URL.revokeObjectURL(archiveUrl.value)
    archiveUrl.value = ''
  }

  const archiveEntries = computed(() => outputs.value.flatMap((entry) => {
    const artifact = artifacts.value[entry.id]?.[entry.step]
    if (!artifact) return []

    return [{ name: workbenchOutputName(purpose.value, entry.ordinal, artifact.format), blob: artifact.blob }]
  }))

  const archiveIssue = computed(() => checkWorkbenchArchive({
    count: archiveEntries.value.length,
    bytes: archiveEntries.value.reduce((total, entry) => total + entry.blob.size, 0),
  }))

  /** Packs every finished output into one file, here, on a worker. */
  async function buildArchive() {
    if (busy.value || archiveIssue.value || !archiveSupported.value) return
    releaseArchive()
    archiving.value = true
    const run = ++generation
    const outcome = await archiver.run({ entries: archiveEntries.value }, { onProgress: update => setStage('archive', update.stage) })
    if (!mounted || run !== generation) return
    archiving.value = false
    setStage('archive', '')
    if (outcome.status === 'success') {
      archiveUrl.value = URL.createObjectURL(outcome.output.blob)
      notice.value = 'archive-ready'
      return
    }
    if (outcome.status === 'error') {
      queue.value = updateWorkbenchItems(queue.value, session => noteWorkbenchStepError(session, 'output', outcome.error.code))
    }
  }

  /**
   * A setting that changed after its step ran describes an output that no
   * longer exists, so the step goes back to the merchant instead of leaving a
   * file that does not match the numbers on screen still downloadable.
   */
  function invalidate(step: EngineStep) {
    if (busy.value) return
    releaseArchive()
    for (const item of items.value) {
      if (!['done', 'failed'].includes(item.session.states[step])) continue
      dropFrom(item.id, step)
      queue.value = updateWorkbenchItem(queue.value, item.id, session => resetWorkbenchStep(session, step))
    }
  }

  /** The first step that stopped this item, so its row can say what happened. */
  function failedStep(session: WorkbenchSession) {
    return workbenchSteps.find(step => session.states[step] === 'failed')
  }

  /**
   * Only a step an engine runs can be retried. A file the shared image limits
   * refused stopped at the import, and the fix is a different file — offering
   * to run it again would be a button that cannot work.
   */
  function canRetryItem(session: WorkbenchSession) {
    return engineSteps.some(step => session.states[step] === 'failed')
  }

  watch(presetId, () => {
    settings.value = { ...settings.value, presetId: presetId.value }
    applyPreset()
  })
  watch(settings, () => invalidate('layout'), { deep: true })
  watch([brandSettings, frame, logo], () => invalidate('brand'), { deep: true })
  watch(compression, () => invalidate('compress'), { deep: true })
  watch(outputs, () => releaseArchive())

  onMounted(() => {
    today.value = new Date().toISOString().slice(0, 10)
    const device = navigator as Navigator & { deviceMemory?: number }
    limits.value = resolveWorkbenchLimits({ deviceMemory: device.deviceMemory })
    laneLimits.value = resolveWorkbenchLaneLimits({ hardwareConcurrency: navigator.hardwareConcurrency })
    queue.value = { ...queue.value, limits: limits.value }
    void prepare()
  })

  onBeforeUnmount(() => {
    mounted = false
    ++generation
    for (const step of engineSteps) for (const engine of pools[step]) engine.dispose()
    archiver.dispose()
    for (const item of items.value) releaseItem(item.id)
    releaseArchive()
    artifacts.value = {}
    previews.value = {}
    if (frameUrl.value) URL.revokeObjectURL(frameUrl.value)
    if (logoUrl.value) URL.revokeObjectURL(logoUrl.value)
  })

  return {
    archiveIssue,
    archiveSupported,
    archiveUrl,
    archiving,
    artifacts,
    availableFormats,
    bounds,
    brandSettings,
    buildArchive,
    busy,
    byteRange,
    cancelAll,
    cancelItem,
    canRetryItem,
    chooseBrandAsset,
    choosePurpose,
    clearBrandAsset,
    compression,
    current,
    evaluationDate,
    failedStep,
    frame,
    frameSize,
    frameUrl,
    goTo,
    importFiles,
    importIssues,
    items,
    laneLimits,
    layoutSupported,
    limits,
    logo,
    logoSize,
    logoUrl,
    notice,
    outputs,
    pipeline,
    prepare,
    preparing,
    preset,
    presetDisabled,
    presetId,
    presetStatus,
    previewItem,
    previews,
    progress,
    purpose,
    queue,
    removeItem,
    reset,
    retryItem,
    runStep,
    runningStep,
    selectItem,
    selected,
    settings,
    sizes,
    skip,
    sources,
    stages,
    stepStatus: (step: WorkbenchStep) => workbenchStepStatus(queue.value, step),
    today,
    usedBytes,
  }
}
