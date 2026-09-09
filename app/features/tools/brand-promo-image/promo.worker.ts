import { imageDimensions } from '../../images/dimensions'
import { exceedsImageLimits } from '../../images/limits'
import { imageSignature } from '../../images/input'
import { detectEncodableFormats } from '../../images/encoders'
import { promoPlacement } from './scene'
import type { PromoInput, PromoWireOutput } from './engine'
import type { WorkerReply } from '../engine/worker-engine'

declare const self: DedicatedWorkerGlobalScope
const send = (message: WorkerReply<PromoWireOutput>, transfer: Transferable[] = []) => self.postMessage(message, transfer)

async function render({ scene, files }: PromoInput) {
  let canvas: OffscreenCanvas | undefined
  let preview: OffscreenCanvas | undefined
  let bitmap: ImageBitmap | undefined
  let failure = 'read_failed'
  try {
    canvas = new OffscreenCanvas(scene.width, scene.height)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('unsupported_browser')
    for (const [index, layer] of scene.layers.entries()) {
      send({ type: 'progress', progress: { stage: 'rendering', completed: index, total: scene.layers.length } })
      if (!layer.visible) continue
      const file = files[layer.assetId]
      if (!file) throw new Error('missing_asset')
      const bytes = new Uint8Array(await file.arrayBuffer())
      const dimensions = imageDimensions(bytes)
      const format = imageSignature(bytes)
      if (!dimensions || !format) throw new Error('corrupt_image')
      if (exceedsImageLimits(dimensions.width, dimensions.height)) throw new Error('too_large')
      // Only one decoded layer is resident at a time, alongside output and preview.
      if (dimensions.width * dimensions.height * 8 + scene.width * scene.height * 8 + bytes.byteLength * 2 + 800 * 800 * 8 > 384 * 1024 * 1024) throw new Error('memory_limit')
      failure = 'decode_failed'
      bitmap = await createImageBitmap(new Blob([bytes], { type: format }), { imageOrientation: 'from-image' })
      if (exceedsImageLimits(bitmap.width, bitmap.height)) throw new Error('too_large')
      const placement = promoPlacement(layer, bitmap.width, bitmap.height, scene.width, scene.height)
      context.globalAlpha = layer.opacity
      context.drawImage(bitmap, placement.x, placement.y, placement.width, placement.height)
      bitmap.close(); bitmap = undefined
    }
    send({ type: 'progress', progress: { stage: 'encoding', completed: scene.layers.length, total: scene.layers.length } })
    failure = 'encode_failed'
    const blob = await canvas.convertToBlob({ type: 'image/png' })
    if (blob.type !== 'image/png') throw new Error('unsupported_encoder')
    const ratio = Math.min(1, 800 / scene.width, 800 / scene.height)
    preview = new OffscreenCanvas(Math.max(1, Math.round(scene.width * ratio)), Math.max(1, Math.round(scene.height * ratio)))
    const previewContext = preview.getContext('2d')
    if (!previewContext) throw new Error('unsupported_browser')
    previewContext.drawImage(canvas, 0, 0, preview.width, preview.height)
    const output = { bytes: await blob.arrayBuffer(), preview: await (await preview.convertToBlob({ type: 'image/png' })).arrayBuffer(), width: scene.width, height: scene.height }
    send({ type: 'result', output }, [output.bytes, output.preview])
  }
  catch (error) {
    const known = ['unsupported_browser', 'missing_asset', 'corrupt_image', 'too_large', 'memory_limit', 'unsupported_encoder']
    send({ type: 'error', code: error instanceof Error && known.includes(error.message) ? error.message : error instanceof RangeError ? 'memory_limit' : failure })
  }
  finally {
    bitmap?.close()
    if (canvas) { canvas.width = 0; canvas.height = 0 }
    if (preview) { preview.width = 0; preview.height = 0 }
  }
}
self.onmessage = async (event: MessageEvent<{ type: 'prepare' } | { type: 'run', input: PromoInput }>) => {
  if (event.data.type === 'prepare') {
    try { send({ type: 'capabilities', ...await detectEncodableFormats(['image/png']) }) }
    catch { send({ type: 'capabilities', supported: false, formats: [], reason: 'unsupported_browser' }) }
  }
  else await render(event.data.input)
}
