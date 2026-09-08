import { imageDimensions } from '../../images/dimensions'
import { exceedsImageLimits } from '../../images/limits'
import { imageSignature } from '../../images/input'
import { OFFLINE_ASSET_CACHE } from '../../pwa/cache-policy'
import { inferenceRuntimeAsset, inferenceRuntimeModuleAsset, portraitMattingModel, portraitModelAsset } from './domain/model'
import type { BackgroundRemovalInput, BackgroundRemovalWireOutput } from './types'
import type { WorkerReply } from '../engine/worker-engine'

declare const self: DedicatedWorkerGlobalScope

/**
 * The runtime is loaded from this site's own versioned asset rather than
 * bundled, so this worker is built from application code only and the page can
 * declare its hashed file name. Types come from the package the asset was
 * copied from; the import below is erased at build time.
 */
type Ort = typeof import('onnxruntime-web/wasm')
type OrtTensor = InstanceType<Ort['Tensor']>
type OrtSession = Awaited<ReturnType<Ort['InferenceSession']['create']>>

const send = (message: WorkerReply<BackgroundRemovalWireOutput>, transfer: Transferable[] = []) => self.postMessage(message, transfer)
const progress = (stage: string) => send({ type: 'progress', progress: { stage, completed: 0, total: 1 } })
const PREVIEW_SIDE = 800
/** Source pixels, the composed output, the resampled matte and the encoder all hold a full copy. */
const MEMORY_BUDGET_BYTES = 512 * 1024 * 1024

/**
 * WebGPU is not part of version one: the WebAssembly baseline is the tier T18
 * measured in all three browsers, and it is the only one whose weights this
 * build ships. Threads are left to the runtime, which falls back to a single
 * thread when the page is not cross-origin isolated.
 */
function capabilities() {
  const supported = typeof WebAssembly === 'object'
    && typeof OffscreenCanvas !== 'undefined'
    && typeof createImageBitmap === 'function'
    && typeof caches !== 'undefined'
    && typeof crypto?.subtle !== 'undefined'
  return { supported, formats: supported ? ['image/png'] : [] }
}

/**
 * This worker is instantiated from a Blob URL, which has no base path to
 * resolve a site-relative address against. A Blob URL still carries the origin
 * that created it, so the cache is asked for the same absolute address the
 * download stored.
 */
function assetAddress(path: string) {
  return new URL(path, new URL(self.location.href).origin).href
}

/**
 * Reads one already-downloaded asset. The tool never fetches it here: an asset
 * arrives through the visitor's own download, which verifies its digest before
 * anything is stored, so a worker that finds nothing asks for that download
 * instead of reaching for the network.
 */
async function cachedAsset(path: string, bytes: number) {
  const cache = await caches.open(OFFLINE_ASSET_CACHE)
  const response = await cache.match(assetAddress(path))
  if (!response) return { code: 'model_download_failed' as const }
  const buffer = await response.arrayBuffer()
  // A truncated or evicted entry would otherwise surface as an opaque parse error.
  if (buffer.byteLength !== bytes) return { code: 'model_digest_mismatch' as const }
  return { buffer }
}

function context(canvas: OffscreenCanvas) {
  const value = canvas.getContext('2d', { willReadFrequently: true })
  if (!value) throw new Error('unsupported_browser')
  return value
}

function release(canvas: OffscreenCanvas | undefined) {
  if (canvas) { canvas.width = 0; canvas.height = 0 }
}

/** Planar, normalized exactly as the T18 measurements preprocessed the candidate. */
function toTensor(ort: Ort, source: ImageBitmap) {
  const { width, height, mean, std, scale } = portraitMattingModel.input
  const canvas = new OffscreenCanvas(width, height)
  try {
    const canvasContext = context(canvas)
    canvasContext.drawImage(source, 0, 0, width, height)
    const data = canvasContext.getImageData(0, 0, width, height).data
    const pixels = width * height
    const planar = new Float32Array(pixels * 3)
    for (let index = 0; index < pixels; index += 1) {
      for (let channel = 0; channel < 3; channel += 1) {
        planar[channel * pixels + index] = (data[index * 4 + channel]! * scale - mean[channel]!) / std[channel]!
      }
    }
    // Even the half-precision export declares float32 at the graph boundary.
    return new ort.Tensor('float32', planar, [1, 3, height, width])
  }
  finally { release(canvas) }
}

/** The matte is the rank-4 single-channel output, whichever name the export gave it. */
function pickMatte(results: Record<string, unknown>) {
  let best: OrtTensor | undefined
  for (const value of Object.values(results)) {
    const tensor = value as OrtTensor
    const dims = tensor.dims
    if (dims.length !== 4 || dims[1] !== 1) continue
    if (!best || dims[2]! * dims[3]! > best.dims[2]! * best.dims[3]!) best = tensor
  }
  return best
}

function toAlpha(tensor: OrtTensor) {
  const values = Float32Array.from(tensor.data as ArrayLike<number>)
  if (portraitMattingModel.output.activation === 'sigmoid') {
    for (let index = 0; index < values.length; index += 1) values[index] = 1 / (1 + Math.exp(-values[index]!))
  }
  else if (portraitMattingModel.output.activation === 'minmax') {
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY
    for (const value of values) { if (value < min) min = value; if (value > max) max = value }
    const span = max - min || 1
    for (let index = 0; index < values.length; index += 1) values[index] = (values[index]! - min) / span
  }
  return values
}

async function encode(canvas: OffscreenCanvas) {
  return await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer()
}

async function remove(input: BackgroundRemovalInput) {
  let bitmap: ImageBitmap | undefined
  let matte: OffscreenCanvas | undefined
  let scaled: OffscreenCanvas | undefined
  let composed: OffscreenCanvas | undefined
  let preview: OffscreenCanvas | undefined
  let session: OrtSession | undefined
  let failure = 'failed'
  try {
    const bytes = new Uint8Array(await input.file.arrayBuffer())
    const format = imageSignature(bytes)
    if (!format) { send({ type: 'error', code: 'unsupported_format' }); return }
    const dimensions = imageDimensions(bytes)
    if (!dimensions) { send({ type: 'error', code: 'corrupt_image' }); return }
    const { width, height } = dimensions
    if (exceedsImageLimits(width, height)) { send({ type: 'error', code: 'too_large' }); return }
    const { width: modelWidth, height: modelHeight } = portraitMattingModel.input
    const estimate = width * height * 20 + PREVIEW_SIDE * PREVIEW_SIDE * 8 + modelWidth * modelHeight * 12
    if (estimate > MEMORY_BUDGET_BYTES) { send({ type: 'error', code: 'insufficient_memory' }); return }

    progress('decoding')
    failure = 'corrupt_image'
    bitmap = await createImageBitmap(new Blob([bytes], { type: format }), { imageOrientation: 'from-image' })
    const sourceWidth = bitmap.width
    const sourceHeight = bitmap.height
    if (exceedsImageLimits(sourceWidth, sourceHeight)) { send({ type: 'error', code: 'too_large' }); return }

    progress('preparing-model')
    failure = 'model_download_failed'
    const runtime = await cachedAsset(inferenceRuntimeAsset.url, inferenceRuntimeAsset.bytes)
    if (!runtime.buffer) { send({ type: 'error', code: runtime.code }); return }
    const weights = await cachedAsset(portraitModelAsset.url, portraitModelAsset.bytes)
    if (!weights.buffer) { send({ type: 'error', code: weights.code }); return }
    const ort = await import(/* @vite-ignore */ assetAddress(inferenceRuntimeModuleAsset.url)) as Ort
    failure = 'insufficient_memory'
    ort.env.wasm.wasmBinary = runtime.buffer
    ort.env.logLevel = 'error'
    session = await ort.InferenceSession.create(new Uint8Array(weights.buffer), { executionProviders: ['wasm'], graphOptimizationLevel: 'all' })

    progress('inference')
    failure = 'inference_failed'
    const results = await session.run({ [session.inputNames[0]!]: toTensor(ort, bitmap) })
    const tensor = pickMatte(results)
    if (!tensor) { send({ type: 'error', code: 'inference_failed' }); return }
    const alpha = toAlpha(tensor)
    await session.release()
    session = undefined

    progress('mask')
    failure = 'insufficient_memory'
    const matteWidth = tensor.dims[3]!
    const matteHeight = tensor.dims[2]!
    matte = new OffscreenCanvas(matteWidth, matteHeight)
    const matteContext = context(matte)
    const matteImage = matteContext.createImageData(matteWidth, matteHeight)
    let kept = 0
    for (let index = 0; index < alpha.length; index += 1) {
      const level = Math.round(Math.min(1, Math.max(0, alpha[index]!)) * 255)
      if (level > 127) kept += 1
      matteImage.data[index * 4] = level
      matteImage.data[index * 4 + 1] = level
      matteImage.data[index * 4 + 2] = level
      matteImage.data[index * 4 + 3] = 255
    }
    matteContext.putImageData(matteImage, 0, 0)

    scaled = new OffscreenCanvas(sourceWidth, sourceHeight)
    const scaledContext = context(scaled)
    scaledContext.drawImage(matte, 0, 0, sourceWidth, sourceHeight)
    const matteData = scaledContext.getImageData(0, 0, sourceWidth, sourceHeight).data
    release(matte); matte = undefined

    composed = new OffscreenCanvas(sourceWidth, sourceHeight)
    const composedContext = context(composed)
    composedContext.drawImage(bitmap, 0, 0)
    const image = composedContext.getImageData(0, 0, sourceWidth, sourceHeight)
    for (let index = 0; index < matteData.length; index += 4) image.data[index + 3] = matteData[index]!
    composedContext.putImageData(image, 0, 0)
    release(scaled); scaled = undefined

    const previewScale = Math.min(1, PREVIEW_SIDE / sourceWidth, PREVIEW_SIDE / sourceHeight)
    preview = new OffscreenCanvas(Math.max(1, Math.round(sourceWidth * previewScale)), Math.max(1, Math.round(sourceHeight * previewScale)))
    context(preview).drawImage(bitmap, 0, 0, preview.width, preview.height)
    bitmap.close(); bitmap = undefined

    progress('encoding')
    failure = 'failed'
    const output: BackgroundRemovalWireOutput = {
      bytes: await encode(composed),
      preview: await encode(preview),
      width: sourceWidth,
      height: sourceHeight,
      coverage: kept / (matteWidth * matteHeight),
    }
    send({ type: 'result', output }, [output.bytes, output.preview])
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    send({ type: 'error', code: error instanceof RangeError || /bad_alloc|out of memory|allocation/i.test(message) ? 'insufficient_memory' : failure })
  }
  finally {
    bitmap?.close()
    void session?.release()
    for (const canvas of [matte, scaled, composed, preview]) release(canvas)
  }
}

self.onmessage = async (event: MessageEvent<{ type: 'prepare' } | { type: 'run', input: BackgroundRemovalInput }>) => {
  if (event.data.type === 'prepare') {
    try { send({ type: 'capabilities', ...capabilities() }) }
    catch { send({ type: 'capabilities', supported: false, formats: [], reason: 'unsupported_browser' }) }
  }
  else await remove(event.data.input)
}
