import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { validateImageInput } from '@/features/images/input'
import { imageInputLimits } from '@/features/images/limits'
import { createBackgroundRemover } from '@/features/tools/image-background-remover/engine'
import { createCompliantImageRenderer } from '@/features/tools/compliant-product-image/engine'
import { createPromoRenderer } from '@/features/tools/brand-promo-image/engine'
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
  planLayoutInput,
  resolveLayoutBounds,
  type WorkbenchLayoutSettings,
} from '@/features/tools/product-image-workbench/pipeline'
import {
  blockWorkbenchStep,
  resetWorkbenchStep,
  completeWorkbenchStep,
  createWorkbenchSession,
  failWorkbenchStep,
  finalWorkbenchArtifact,
  goToWorkbenchStep,
  setWorkbenchPurpose,
  skipWorkbenchStep,
  startWorkbenchStep,
  unblockWorkbenchStep,
  workbenchProgress,
  workbenchSteps,
  noteWorkbenchStepError,
  type WorkbenchPurpose,
  type WorkbenchStep,
} from '@/features/tools/product-image-workbench/session'
import { useWorkspaceDirty } from './useWorkspaceDirty'
import { useUnloadGuard } from './useUnloadGuard'

/**
 * One image and its results, kept out of the session document on purpose: the
 * session is the shape of the run and stays inspectable, while every pixel
 * lives here and is released the moment the component goes away.
 */
interface StepArtifact { blob: Blob, file: File, url: string, width: number, height: number, bytes: number, format: string }

/** The steps that hold a produced file; `import` holds the merchant's own file instead. */
const artifactSteps = ['cutout', 'layout', 'brand'] as const

function releaseArtifact(artifact: StepArtifact | undefined) {
  if (artifact) URL.revokeObjectURL(artifact.url)
}

/**
 * The workbench: a session, three engines it does not own, and the rule that
 * one engine's trouble never becomes another step's.
 *
 * Each step runs one engine, records its own outcome on its own step, and
 * hands its result forward as a plain `File`. Nothing is written to disk, no
 * intermediate result is uploaded, and cancelling terminates the worker that
 * was running rather than waiting for it.
 */
export function useProductImageWorkbench() {
  const remover = createBackgroundRemover()
  const layoutEngine = createCompliantImageRenderer()
  const brandEngine = createPromoRenderer()

  const session = ref(createWorkbenchSession())
  const source = shallowRef<File>()
  const sourceUrl = ref('')
  const sourceSize = shallowRef<{ width: number, height: number }>()
  const artifacts = shallowRef<Partial<Record<'cutout' | 'layout' | 'brand', StepArtifact>>>({})
  const frame = shallowRef<File>()
  const logo = shallowRef<File>()
  const frameUrl = ref('')
  const logoUrl = ref('')

  const running = ref<typeof artifactSteps[number] | ''>('')
  const stage = ref('')
  const preparing = ref(true)
  const layoutSupported = ref(false)
  const validating = ref(false)
  const notice = ref('')

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

  let generation = 0
  let mounted = true

  const busy = computed(() => Boolean(running.value) || validating.value)
  const dirty = computed(() => Boolean(source.value) || busy.value)
  const preset = computed(() => findCompliantImagePreset(presetId.value)!)
  const evaluationDate = computed(() => today.value || preset.value.reviewedAt)
  const presetStatus = computed(() => resolvePresetStatus(preset.value, evaluationDate.value))
  const presetDisabled = computed(() => presetStatus.value === 'expired' || presetStatus.value === 'retired')
  const bounds = computed(() => resolveLayoutBounds(session.value.purpose, preset.value, evaluationDate.value))
  const byteRange = computed(() => resolveByteRange(preset.value, evaluationDate.value))
  const progress = computed(() => workbenchProgress(session.value))
  const finalStep = computed(() => finalWorkbenchArtifact(session.value))
  const output = computed(() => finalStep.value ? artifacts.value[finalStep.value] : undefined)
  /** What the next step consumes: the cutout when there is one, otherwise the imported file. */
  const layoutSource = computed(() => artifacts.value.cutout?.file ?? source.value)

  useWorkspaceDirty('product-image-workbench', dirty)
  useUnloadGuard(dirty)

  function setArtifact(step: typeof artifactSteps[number], artifact: StepArtifact | undefined) {
    releaseArtifact(artifacts.value[step])
    artifacts.value = { ...artifacts.value, [step]: artifact }
  }

  /** Re-running a step throws away it and everything after it, so no stale file can be downloaded. */
  function dropFrom(step: WorkbenchStep) {
    const from = workbenchSteps.indexOf(step)
    for (const later of artifactSteps) {
      if (workbenchSteps.indexOf(later) >= from) setArtifact(later, undefined)
    }
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
    if (session.value.purpose !== 'compliant') return
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

  const availableFormats = computed<EncodableFormat[]>(() => session.value.purpose === 'compliant'
    ? resolveOutputFormats(preset.value, evaluationDate.value, layoutFormats.value)
    : layoutFormats.value)

  /**
   * Which engines this device can actually run. Kept as state rather than
   * applied once, because the brand step only exists on one branch: switching
   * branches has to ask the same question again instead of quietly offering a
   * step whose engine was already found unavailable.
   */
  const supported = ref({ cutout: false, brand: false })

  function applyCapabilities() {
    session.value = supported.value.cutout
      ? unblockWorkbenchStep(session.value, 'cutout')
      : blockWorkbenchStep(session.value, 'cutout', 'capability')
    if (session.value.purpose === 'promotional' && !supported.value.brand) {
      session.value = blockWorkbenchStep(session.value, 'brand', 'capability')
    }
  }

  /**
   * §12.11 asks for a preflight before any engine is loaded. Each engine is
   * asked separately and only its own step is disabled, so a device that cannot
   * run the model still lays out and brands an image.
   */
  async function prepare() {
    preparing.value = true
    const [cutout, layout, brand] = await Promise.all([remover.prepare(), layoutEngine.prepare(), brandEngine.prepare()])
    if (!mounted) return
    layoutSupported.value = layout.supported
    layoutFormats.value = layout.supported
      ? encodableFormats.filter(format => layout.formats.includes(formatMimeTypes[format]))
      : [...encodableFormats]
    supported.value = { cutout: cutout.supported, brand: brand.supported }
    applyCapabilities()
    preparing.value = false
    applyPreset()
  }

  function goTo(step: WorkbenchStep) {
    if (busy.value) return
    session.value = goToWorkbenchStep(session.value, step)
  }

  function choosePurpose(purpose: WorkbenchPurpose) {
    if (busy.value || session.value.purpose === purpose) return
    dropFrom('layout')
    session.value = setWorkbenchPurpose(session.value, purpose)
    applyCapabilities()
    if (purpose === 'compliant') applyPreset()
  }

  function skip(step: WorkbenchStep) {
    if (busy.value) return
    dropFrom(step)
    session.value = skipWorkbenchStep(session.value, step)
    notice.value = 'skipped'
  }

  function releaseSource() {
    if (sourceUrl.value) URL.revokeObjectURL(sourceUrl.value)
    sourceUrl.value = ''
    sourceSize.value = undefined
  }

  function measure(file: File, onSize: (size: { width: number, height: number }) => void) {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => { if (mounted) onSize({ width: image.naturalWidth, height: image.naturalHeight }) }
    // A picture the browser refuses to decode simply has no measured size; the
    // engine reports the failure when the step runs.
    image.onerror = () => {}
    image.src = url

    return url
  }

  async function importSource(file: File) {
    if (busy.value) return
    const current = ++generation
    validating.value = true
    notice.value = ''
    try {
      const code = await validateImageInput(file) ?? (file.size > imageInputLimits.maxBytes ? 'too_large' : undefined)
      if (!mounted || current !== generation) return
      // A refused file must not cost the merchant the image they already imported.
      if (code) {
        session.value = noteWorkbenchStepError(session.value, 'import', code)
        return
      }
      dropFrom('cutout')
      releaseSource()
      source.value = file
      sourceUrl.value = measure(file, size => { sourceSize.value = size })
      session.value = completeWorkbenchStep(startWorkbenchStep(session.value, 'import'), 'import')
      notice.value = 'imported'
    }
    catch {
      if (mounted && current === generation) session.value = noteWorkbenchStepError(session.value, 'import', 'corrupt_image')
    }
    finally {
      if (mounted && current === generation) validating.value = false
    }
  }

  async function chooseBrandAsset(kind: 'frame' | 'logo', file: File) {
    if (busy.value) return
    const code = await validateImageInput(file) ?? (file.size > imageInputLimits.maxBytes ? 'too_large' : undefined)
    if (!mounted) return
    if (code) {
      session.value = noteWorkbenchStepError(session.value, 'brand', code)
      return
    }
    const url = measure(file, () => {})
    if (kind === 'frame') {
      if (frameUrl.value) URL.revokeObjectURL(frameUrl.value)
      frame.value = file
      frameUrl.value = url
    }
    else {
      if (logoUrl.value) URL.revokeObjectURL(logoUrl.value)
      logo.value = file
      logoUrl.value = url
    }
    notice.value = 'asset-added'
  }

  function clearBrandAsset(kind: 'frame' | 'logo') {
    if (kind === 'frame') {
      if (frameUrl.value) URL.revokeObjectURL(frameUrl.value)
      frame.value = undefined
      frameUrl.value = ''
    }
    else {
      if (logoUrl.value) URL.revokeObjectURL(logoUrl.value)
      logo.value = undefined
      logoUrl.value = ''
    }
  }

  /** One engine run, recorded on one step. Every exit lands on the same step. */
  async function runStep(step: typeof artifactSteps[number], run: (onProgress: (name: string) => void) => Promise<
    { status: 'success', blob: Blob, width: number, height: number } | { status: 'cancelled' } | { status: 'error', code: string }
  >) {
    if (busy.value) return
    const current = ++generation
    notice.value = ''
    dropFrom(step)
    session.value = startWorkbenchStep(session.value, step)
    running.value = step
    stage.value = ''
    const outcome = await run(name => { if (current === generation) stage.value = name })
    if (!mounted || current !== generation) return
    running.value = ''
    stage.value = ''
    if (outcome.status === 'cancelled') {
      session.value = resetWorkbenchStep(session.value, step)
      notice.value = 'cancelled'
      return
    }
    if (outcome.status === 'error') {
      session.value = failWorkbenchStep(session.value, step, outcome.code)
      return
    }
    try {
      setArtifact(step, toArtifact(outcome.blob, `${step}-result`, outcome.width, outcome.height))
      session.value = completeWorkbenchStep(session.value, step)
      notice.value = 'step-done'
    }
    catch {
      session.value = failWorkbenchStep(session.value, step, 'memory_limit')
    }
  }

  function removeBackground() {
    const file = source.value
    if (!file) return
    return runStep('cutout', async (onProgress) => {
      const outcome = await remover.run({ file }, { onProgress: progress => onProgress(progress.stage) })
      if (outcome.status === 'success') return { status: 'success' as const, blob: outcome.output.blob, width: outcome.output.width, height: outcome.output.height }
      return outcome.status === 'cancelled' ? { status: 'cancelled' as const } : { status: 'error' as const, code: outcome.error.code }
    })
  }

  function renderLayout() {
    const file = layoutSource.value
    if (!file) {
      session.value = failWorkbenchStep(session.value, 'layout', 'missing_step_input')
      return
    }
    if (session.value.purpose === 'compliant' && presetDisabled.value) {
      session.value = failWorkbenchStep(session.value, 'layout', 'preset_unavailable')
      return
    }
    const input = planLayoutInput({ file, purpose: session.value.purpose, settings: settings.value, byteRange: byteRange.value })
    return runStep('layout', async (onProgress) => {
      onProgress('validating-preset')
      const outcome = await layoutEngine.run(input, { onProgress: progress => onProgress(progress.stage) })
      if (outcome.status === 'success') return { status: 'success' as const, blob: outcome.output.blob, width: outcome.output.width, height: outcome.output.height }
      return outcome.status === 'cancelled' ? { status: 'cancelled' as const } : { status: 'error' as const, code: outcome.error.code }
    })
  }

  function composeBrand() {
    const product = artifacts.value.layout
    if (!product) {
      session.value = failWorkbenchStep(session.value, 'brand', 'missing_step_input')
      return
    }
    if (!frame.value && !logo.value) {
      session.value = failWorkbenchStep(session.value, 'brand', 'missing_asset')
      return
    }
    const input = planBrandScene({
      canvas: { width: product.width, height: product.height },
      product: product.file,
      frame: frame.value,
      logo: logo.value,
      ...brandSettings.value,
    })
    return runStep('brand', async (onProgress) => {
      onProgress('composing')
      const outcome = await brandEngine.run(input, { onProgress: progress => onProgress(progress.stage) })
      if (outcome.status === 'success') return { status: 'success' as const, blob: outcome.output.blob, width: outcome.output.width, height: outcome.output.height }
      return outcome.status === 'cancelled' ? { status: 'cancelled' as const } : { status: 'error' as const, code: outcome.error.code }
    })
  }

  /** Cancellation terminates the worker of the step that is running and nothing else. */
  function cancel() {
    const step = running.value
    if (!step) return
    ++generation
    if (step === 'cutout') remover.cancel()
    if (step === 'layout') layoutEngine.cancel()
    if (step === 'brand') brandEngine.cancel()
    running.value = ''
    stage.value = ''
    session.value = resetWorkbenchStep(session.value, step)
    notice.value = 'cancelled'
  }

  function reset() {
    if (busy.value) cancel()
    ++generation
    for (const step of artifactSteps) setArtifact(step, undefined)
    clearBrandAsset('frame')
    clearBrandAsset('logo')
    releaseSource()
    source.value = undefined
    session.value = createWorkbenchSession(session.value.purpose)
    notice.value = 'reset'
  }

  /**
   * A setting that changed after its step ran describes an output that no
   * longer exists, so the step goes back to the merchant instead of leaving a
   * file that does not match the numbers on screen still downloadable.
   */
  function invalidate(step: 'layout' | 'brand') {
    if (busy.value || !['done', 'failed'].includes(session.value.states[step])) return
    dropFrom(step)
    session.value = resetWorkbenchStep(session.value, step)
  }

  watch(presetId, () => {
    settings.value = { ...settings.value, presetId: presetId.value }
    applyPreset()
  })
  watch(settings, () => invalidate('layout'), { deep: true })
  watch([brandSettings, frame, logo], () => invalidate('brand'), { deep: true })

  onMounted(() => {
    today.value = new Date().toISOString().slice(0, 10)
    void prepare()
  })

  onBeforeUnmount(() => {
    mounted = false
    ++generation
    remover.dispose()
    layoutEngine.dispose()
    brandEngine.dispose()
    for (const step of artifactSteps) releaseArtifact(artifacts.value[step])
    artifacts.value = {}
    releaseSource()
    if (frameUrl.value) URL.revokeObjectURL(frameUrl.value)
    if (logoUrl.value) URL.revokeObjectURL(logoUrl.value)
  })

  return {
    artifacts,
    availableFormats,
    bounds,
    brandSettings,
    busy,
    byteRange,
    cancel,
    chooseBrandAsset,
    choosePurpose,
    clearBrandAsset,
    composeBrand,
    evaluationDate,
    frame,
    frameUrl,
    goTo,
    importSource,
    layoutSource,
    layoutSupported,
    logo,
    logoUrl,
    notice,
    output,
    prepare,
    preparing,
    preset,
    presetDisabled,
    presetId,
    presetStatus,
    progress,
    removeBackground,
    renderLayout,
    reset,
    running,
    session,
    settings,
    skip,
    source,
    sourceSize,
    sourceUrl,
    stage,
    today,
  }
}
