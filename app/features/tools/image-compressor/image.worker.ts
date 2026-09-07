import { stripJpegMetadata } from '../../images/jpeg-metadata'
import { imageDimensions } from '../../images/dimensions'
import { imageSignature } from '../../images/input'
import type { CompressionInput, CompressionWireOutput, ImageFormat } from './types'
import type { WorkerReply } from '../engine/worker-engine'

declare const self: DedicatedWorkerGlobalScope
const formats: ImageFormat[] = ['image/png', 'image/jpeg', 'image/webp']
const send = (message: WorkerReply<CompressionWireOutput>, transfer: Transferable[] = []) => self.postMessage(message, transfer)
const progress = (stage: string) => send({ type: 'progress', progress: { stage, completed: 0, total: 1 } })

async function capabilities() {
  const supportedFormats: ImageFormat[] = []
  if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap !== 'function') return { supported: false, formats: supportedFormats }
  const canvas = new OffscreenCanvas(1, 1)
  try {
    if (!canvas.getContext('2d')) return { supported: false, formats: supportedFormats }
    for (const format of formats) {
      try { if ((await canvas.convertToBlob({ type: format })).type === format) supportedFormats.push(format) }
      catch { /* This encoder is unavailable; the UI offers the working formats. */ }
    }
    return { supported: supportedFormats.length > 0, formats: supportedFormats }
  }
  finally { canvas.width = 0; canvas.height = 0 }
}

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
    if (!width || !height || width > 8192 || height > 8192 || width * height > 24_000_000) { send({ type: 'error', code: 'too_large' }); return }
    // Conservative allowance for source/target pixels, codec copies, encoded bytes, and a bounded preview.
    const estimatedBytes = width * height * 8 + Math.min(width * height, input.maxWidth * input.maxHeight) * 8 + bytes.byteLength * 2 + 800 * 800 * 8
    if (estimatedBytes > 384 * 1024 * 1024) { send({ type: 'error', code: 'memory_limit' }); return }
    progress('decoding')
    failure = 'decode_failed'
    bitmap = await createImageBitmap(new Blob([bytes], { type: format }), { imageOrientation: 'from-image' })
    if (!bitmap.width || !bitmap.height || bitmap.width > 8192 || bitmap.height > 8192 || bitmap.width * bitmap.height > 24_000_000) { send({ type: 'error', code: 'too_large' }); return }
    const scale = Math.min(1, input.maxWidth / bitmap.width, input.maxHeight / bitmap.height)
    const outWidth = Math.max(1, Math.round(bitmap.width * scale)), outHeight = Math.max(1, Math.round(bitmap.height * scale))
    progress('processing')
    failure = 'memory_limit'
    canvas = new OffscreenCanvas(outWidth, outHeight)
    const context = canvas.getContext('2d')
    if (!context) { send({ type: 'error', code: 'unsupported_browser' }); return }
    if (input.format === 'image/jpeg') { context.fillStyle = '#ffffff'; context.fillRect(0, 0, outWidth, outHeight) }
    context.drawImage(bitmap, 0, 0, outWidth, outHeight)
    const previewScale = Math.min(1, 800 / bitmap.width, 800 / bitmap.height)
    preview = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * previewScale)), Math.max(1, Math.round(bitmap.height * previewScale)))
    const previewContext = preview.getContext('2d')
    if (!previewContext) { send({ type: 'error', code: 'unsupported_browser' }); return }
    previewContext.drawImage(bitmap, 0, 0, preview.width, preview.height)
    const sourceWidth = bitmap.width, sourceHeight = bitmap.height
    bitmap.close(); bitmap = undefined
    progress('encoding')
    failure = 'encode_failed'
    const blob = await canvas.convertToBlob({ type: input.format, quality: input.quality })
    if (blob.type !== input.format) { send({ type: 'error', code: 'unsupported_encoder' }); return }
    const encoded = await blob.arrayBuffer()
    const output: CompressionWireOutput = { bytes: input.format === 'image/jpeg' ? stripJpegMetadata(new Uint8Array(encoded)) : encoded, preview: await (await preview.convertToBlob({ type: 'image/png' })).arrayBuffer(), format: input.format, width: outWidth, height: outHeight, sourceWidth, sourceHeight }
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
