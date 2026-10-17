import { stripJpegMetadata } from '../../images/jpeg-metadata'
import { originalAsOutput } from '../../images/original-as-output'
import { imageDimensions } from '../../images/dimensions'
import { exceedsImageLimits } from '../../images/limits'
import { imageSignature } from '../../images/input'
import { detectEncodableFormats } from '../../images/encoders'
import { choosePalette, paletteWorkingBytes, writeIndexedPng } from '../../images/png-palette'
import type { CompressionInput, CompressionWireOutput, ImageFormat } from './types'
import type { WorkerReply } from '../engine/worker-engine'

declare const self: DedicatedWorkerGlobalScope
const formats: ImageFormat[] = ['image/png', 'image/jpeg', 'image/webp']
const send = (message: WorkerReply<CompressionWireOutput>, transfer: Transferable[] = []) => self.postMessage(message, transfer)
const progress = (stage: string) => send({ type: 'progress', progress: { stage, completed: 0, total: 1 } })

const capabilities = () => detectEncodableFormats(formats)

async function compress(input: CompressionInput) {
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
    const { width, height } = dimensions
    if (exceedsImageLimits(width, height)) { send({ type: 'error', code: 'too_large' }); return }
    // Below full quality, PNG is reduced to at most 256 colours and written here, since a canvas only writes PNG losslessly.
    const palette = input.format === 'image/png' && input.quality < 1 && typeof CompressionStream === 'function'
    // Conservative allowance for source/target pixels, codec copies, encoded bytes, and a bounded preview. An indexed PNG
    // keeps no codec copy of the target, only its compressed bytes (at most about one per pixel, held twice) and fixed tables.
    const targetPixels = Math.min(width * height, input.maxWidth * input.maxHeight)
    const estimatedBytes = width * height * 8 + (palette ? targetPixels * 6 + paletteWorkingBytes : targetPixels * 8) + bytes.byteLength * 2 + 800 * 800 * 8
    if (estimatedBytes > 384 * 1024 * 1024) { send({ type: 'error', code: 'memory_limit' }); return }
    progress('decoding')
    failure = 'decode_failed'
    bitmap = await createImageBitmap(new Blob([bytes], { type: format }), { imageOrientation: 'from-image' })
    if (exceedsImageLimits(bitmap.width, bitmap.height)) { send({ type: 'error', code: 'too_large' }); return }
    const scale = Math.min(1, input.maxWidth / bitmap.width, input.maxHeight / bitmap.height)
    const outWidth = Math.max(1, Math.round(bitmap.width * scale)), outHeight = Math.max(1, Math.round(bitmap.height * scale))
    progress('processing')
    failure = 'memory_limit'
    canvas = new OffscreenCanvas(outWidth, outHeight)
    const context = canvas.getContext('2d', { willReadFrequently: palette })
    if (!context) { send({ type: 'error', code: 'unsupported_browser' }); return }
    if (input.format === 'image/jpeg') { context.fillStyle = '#ffffff'; context.fillRect(0, 0, outWidth, outHeight) }
    context.drawImage(bitmap, 0, 0, outWidth, outHeight)
    // The preview is drawn from the output, so it shows what the file will look like (JPEG's white fill included)
    // at a size the page can show without decoding the full picture on its own thread.
    const previewScale = Math.min(1, 800 / outWidth, 800 / outHeight)
    preview = new OffscreenCanvas(Math.max(1, Math.round(outWidth * previewScale)), Math.max(1, Math.round(outHeight * previewScale)))
    const previewContext = preview.getContext('2d')
    if (!previewContext) { send({ type: 'error', code: 'unsupported_browser' }); return }
    previewContext.drawImage(canvas, 0, 0, preview.width, preview.height)
    const sourceWidth = bitmap.width, sourceHeight = bitmap.height
    bitmap.close(); bitmap = undefined
    let reencoded: ArrayBuffer
    if (palette) {
      const rows = (y: number, count: number) => context.getImageData(0, y, outWidth, count).data
      progress('reducing-colors')
      failure = 'encode_failed'
      const colors = choosePalette(outWidth, outHeight, rows)
      progress('encoding')
      reencoded = await writeIndexedPng(outWidth, outHeight, rows, colors)
    }
    else {
      progress('encoding')
      failure = 'encode_failed'
      const blob = await canvas.convertToBlob({ type: input.format, quality: input.quality })
      if (blob.type !== input.format) { send({ type: 'error', code: 'unsupported_encoder' }); return }
      const encoded = await blob.arrayBuffer()
      reencoded = input.format === 'image/jpeg' ? stripJpegMetadata(new Uint8Array(encoded)) : encoded
    }
    // A source saved leaner than these settings only grows when re-encoded. Keeping format and size, it is itself a valid answer.
    const original = format === input.format && outWidth === sourceWidth && outHeight === sourceHeight ? originalAsOutput(bytes) : undefined
    const delivered = original && original.byteLength <= reencoded.byteLength ? original : reencoded
    const output: CompressionWireOutput = { bytes: delivered, preview: await (await preview.convertToBlob({ type: 'image/png' })).arrayBuffer(), format: input.format, width: outWidth, height: outHeight, sourceWidth, sourceHeight, keptOriginal: delivered === original }
    send({ type: 'result', output }, [output.bytes, output.preview])
  }
  catch (error) { send({ type: 'error', code: error instanceof RangeError ? 'memory_limit' : failure }) }
  finally {
    bitmap?.close()
    if (canvas) { canvas.width = 0; canvas.height = 0 }
    if (preview) { preview.width = 0; preview.height = 0 }
  }
}

self.onmessage = async (event: MessageEvent<{ type: 'prepare' } | { type: 'run', input: CompressionInput }>) => {
  if (event.data.type === 'prepare') {
    try { send({ type: 'capabilities', ...await capabilities() }) }
    catch { send({ type: 'capabilities', supported: false, formats: [], reason: 'unsupported_browser' }) }
  }
  else await compress(event.data.input)
}
