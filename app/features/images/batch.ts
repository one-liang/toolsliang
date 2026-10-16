/**
 * How many pictures one image tool takes at a time, and how much they may add
 * up to.
 *
 * A visitor who batches photos in one image tool and then in the next must be
 * refused at the same point by both, so the ceilings live beside the per-file
 * limits rather than in each tool. The per-file limits (`imageInputLimits`)
 * still apply to every picture on its own; these bound the batch around them.
 */
export interface ImageBatchLimits {
  maxItems: number
  maxBytes: number
}

/** §12.11's first-release ceiling, before this device is asked what it can hold. */
export const imageBatchLimits: ImageBatchLimits = { maxItems: 20, maxBytes: 200 * 1024 * 1024 }

/**
 * A batch is held in memory from import to download, and every step adds a
 * result beside the source it came from, so the byte budget is a fraction of
 * what the device admits to having rather than the whole of it. `deviceMemory`
 * is coarse and absent in some browsers; when it says nothing, the shared
 * first-release ceiling stands, because a limit invented from silence is not
 * more careful, only more annoying.
 */
export function resolveImageBatchLimits(device: { deviceMemory?: number }, base: ImageBatchLimits = imageBatchLimits): ImageBatchLimits {
  if (!device.deviceMemory) return { ...base }
  const maxBytes = Math.min(base.maxBytes, Math.round(device.deviceMemory * 1024 ** 3 / 8))

  return { maxBytes, maxItems: Math.max(1, Math.min(base.maxItems, Math.round(base.maxItems * maxBytes / base.maxBytes))) }
}

export type ImageBatchRefusal = 'too_many_items' | 'batch_too_large'

export interface ImageBatchAdmission {
  /** Positions in the candidate list, in order, of the files that fit. */
  accepted: number[]
  rejected: { index: number, code: ImageBatchRefusal }[]
}

/**
 * Which of the candidates fit beside what the batch already holds. A candidate
 * that does not fit is refused by name and does not stop a smaller one after it
 * from being taken; nothing already held is ever pushed out.
 */
export function admitImageBatch(
  held: { count: number, bytes: number },
  candidates: readonly { bytes: number }[],
  limits: ImageBatchLimits,
): ImageBatchAdmission {
  const admission: ImageBatchAdmission = { accepted: [], rejected: [] }
  let { count, bytes } = held

  candidates.forEach((candidate, index) => {
    if (count >= limits.maxItems) admission.rejected.push({ index, code: 'too_many_items' })
    else if (bytes + candidate.bytes > limits.maxBytes) admission.rejected.push({ index, code: 'batch_too_large' })
    else {
      count += 1
      bytes += candidate.bytes
      admission.accepted.push(index)
    }
  })

  return admission
}

/** Where one picture of a batch has got to. */
export type ImageBatchStatus = 'pending' | 'running' | 'done' | 'failed'
