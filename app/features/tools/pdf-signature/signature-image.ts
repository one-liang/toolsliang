import { exceedsImageLimits, imageInputLimits } from '@/features/images/limits'
import {
  opaqueBounds,
  signatureHasTransparency,
  signatureRasterSize,
  validateSignatureImageFile,
  type SignatureForm,
} from './domain/signature'
import type { SignatureInputErrorCode } from './content'

/** A signature as everything downstream takes it: a transparent PNG and its pixel size. */
export interface CreatedSignature {
  name: string
  form: SignatureForm
  bytes: ArrayBuffer
  width: number
  height: number
}

export type SignatureImageResult = { ok: true, signature: CreatedSignature } | { ok: false, code: SignatureInputErrorCode }

/** Writes a canvas out as the PNG every form of signature ends up as. */
export async function encodeSignature(canvas: HTMLCanvasElement, name: string, form: SignatureForm): Promise<CreatedSignature | undefined> {
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob) return undefined

  return { name, form, bytes: await blob.arrayBuffer(), width: canvas.width, height: canvas.height }
}

/**
 * Turns an imported picture straight into a signature, so choosing the file is
 * the whole step. The picture is cropped to the pixels that are not transparent
 * and never upscaled: its own pixels are the most it has. The decoded bitmap is
 * closed before this returns, because a large picture is tens of megabytes of
 * RGBA that nothing holds on to once the PNG exists.
 */
export async function importSignatureImage(
  files: File[],
  { maxPlacedWidthPt, name }: { maxPlacedWidthPt: number, name: string },
): Promise<SignatureImageResult> {
  if (files.length !== 1) return { ok: false, code: 'multiple_files' }

  const file = files[0]!
  const refused = await validateSignatureImageFile(file)
  if (refused) return { ok: false, code: refused }
  if (file.size > imageInputLimits.maxBytes) return { ok: false, code: 'signature_too_large' }

  let bitmap: ImageBitmap | undefined
  try {
    bitmap = await createImageBitmap(file)
    if (exceedsImageLimits(bitmap.width, bitmap.height)) return { ok: false, code: 'signature_too_large' }

    const probe = document.createElement('canvas')
    probe.width = bitmap.width
    probe.height = bitmap.height
    const probeContext = probe.getContext('2d', { willReadFrequently: true })
    if (!probeContext) return { ok: false, code: 'unsupported_format' }
    probeContext.drawImage(bitmap, 0, 0)
    const pixels = probeContext.getImageData(0, 0, probe.width, probe.height).data
    if (!signatureHasTransparency(pixels)) return { ok: false, code: 'signature_is_opaque' }

    const crop = opaqueBounds(pixels, bitmap.width, bitmap.height) ?? { x: 0, y: 0, width: bitmap.width, height: bitmap.height }
    const width = Math.min(signatureRasterSize({ aspect: crop.width / crop.height, maxPlacedWidthPt }).width, crop.width)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = Math.max(1, Math.round(width * (crop.height / crop.width)))
    const context = canvas.getContext('2d')
    if (!context) return { ok: false, code: 'unsupported_format' }
    context.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height)

    const signature = await encodeSignature(canvas, name, 'image')
    return signature ? { ok: true, signature } : { ok: false, code: 'unsupported_format' }
  }
  catch {
    return { ok: false, code: 'unsupported_format' }
  }
  finally {
    bitmap?.close()
  }
}
