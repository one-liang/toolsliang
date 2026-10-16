import { stripJpegMetadata } from '../../images/jpeg-metadata'
import { imageDimensions } from '../../images/dimensions'
import { exceedsImageLimits } from '../../images/limits'
import { imageSignature } from '../../images/input'
import { detectEncodableFormats } from '../../images/encoders'
import { planPlacement } from './domain/placement'
import type { EncodableMimeType } from './domain/render'
import type { CompliantRenderInput, CompliantRenderWireOutput } from './types'
import type { WorkerReply } from '../engine/worker-engine'

declare const self: DedicatedWorkerGlobalScope
const formats: EncodableMimeType[] = ['image/png', 'image/jpeg', 'image/webp']
const send = (message: WorkerReply<CompliantRenderWireOutput>, transfer: Transferable[] = []) => self.postMessage(message, transfer)
const progress = (stage: string) => send({ type: 'progress', progress: { stage, completed: 0, total: 1 } })

/** The quality a lossy layout is written at; the compress step is where capacity is decided. */
const layoutQuality = 0.92

const capabilities = () => detectEncodableFormats(formats)

async function encode(canvas: OffscreenCanvas, input: CompliantRenderInput) {
  const quality = input.format === 'image/png' ? undefined : layoutQuality
  const blob = await canvas.convertToBlob({ type: input.format, quality })
  if (blob.type !== input.format) throw new Error('unsupported_encoder')

  return { blob, quality }
}

async function render(input: CompliantRenderInput) {
  let bitmap: ImageBitmap | undefined
  let canvas: OffscreenCanvas | undefined
  let preview: OffscreenCanvas | undefined
  let failure = 'read_failed'
  try {
    const bytes = new Uint8Array(await input.file.arrayBuffer())
    const format = imageSignature(bytes)
    if (!format) { send({ type: 'error', code: 'unsupported_format' }); return }
    const dimensions = imageDimensions(bytes)
    if (!dimensions) { send({ type: 'error', code: 'corrupt_image' }); return }
    if (exceedsImageLimits(dimensions.width, dimensions.height)) { send({ type: 'error', code: 'too_large' }); return }
    // Source pixels, the output canvas, the encoder's copies, and a bounded preview.
    const estimatedBytes = dimensions.width * dimensions.height * 8 + input.width * input.height * 8 + bytes.byteLength * 2 + 800 * 800 * 8
    if (estimatedBytes > 384 * 1024 * 1024) { send({ type: 'error', code: 'memory_limit' }); return }

    progress('decoding')
    failure = 'decode_failed'
    bitmap = await createImageBitmap(new Blob([bytes], { type: format }), { imageOrientation: 'from-image' })
    if (exceedsImageLimits(bitmap.width, bitmap.height)) { send({ type: 'error', code: 'too_large' }); return }

    progress('fitting')
    const placement = planPlacement({
      sourceWidth: bitmap.width,
      sourceHeight: bitmap.height,
      targetWidth: input.width,
      targetHeight: input.height,
      fit: input.fit,
      zoom: input.zoom,
      offsetX: input.offsetX,
      offsetY: input.offsetY,
    })

    progress('rendering')
    failure = 'memory_limit'
    canvas = new OffscreenCanvas(input.width, input.height)
    const context = canvas.getContext('2d')
    if (!context) { send({ type: 'error', code: 'unsupported_browser' }); return }
    // The background is painted first so a contained fit or an offset crop never
    // leaves a transparent hole that reads as a white or black edge.
    context.fillStyle = input.background
    context.fillRect(0, 0, input.width, input.height)
    context.drawImage(bitmap, placement.x, placement.y, placement.width, placement.height)
    const sourceWidth = bitmap.width, sourceHeight = bitmap.height
    bitmap.close(); bitmap = undefined

    progress('encoding')
    failure = 'encode_failed'
    const { blob, quality } = await encode(canvas, input)
    const encoded = await blob.arrayBuffer()
    const previewScale = Math.min(1, 800 / input.width, 800 / input.height)
    preview = new OffscreenCanvas(Math.max(1, Math.round(input.width * previewScale)), Math.max(1, Math.round(input.height * previewScale)))
    const previewContext = preview.getContext('2d')
    if (!previewContext) { send({ type: 'error', code: 'unsupported_browser' }); return }
    previewContext.drawImage(canvas, 0, 0, preview.width, preview.height)

    const output: CompliantRenderWireOutput = {
      // Re-encoding never copies the source EXIF, GPS or IPTC records; the page says so.
      bytes: input.format === 'image/jpeg' ? stripJpegMetadata(new Uint8Array(encoded)) : encoded,
      preview: await (await preview.convertToBlob({ type: 'image/png' })).arrayBuffer(),
      format: input.format,
      width: input.width,
      height: input.height,
      sourceWidth,
      sourceHeight,
      coverage: placement.coverage,
      quality,
    }
    send({ type: 'result', output }, [output.bytes, output.preview])
  }
  catch (error) {
    const code = error instanceof Error && error.message === 'unsupported_encoder'
      ? 'unsupported_encoder'
      : error instanceof RangeError ? 'memory_limit' : failure
    send({ type: 'error', code })
  }
  finally {
    bitmap?.close()
    if (canvas) { canvas.width = 0; canvas.height = 0 }
    if (preview) { preview.width = 0; preview.height = 0 }
  }
}

self.onmessage = async (event: MessageEvent<{ type: 'prepare' } | { type: 'run', input: CompliantRenderInput }>) => {
  if (event.data.type === 'prepare') {
    try { send({ type: 'capabilities', ...await capabilities() }) }
    catch { send({ type: 'capabilities', supported: false, formats: [], reason: 'unsupported_browser' }) }
  }
  else await render(event.data.input)
}
