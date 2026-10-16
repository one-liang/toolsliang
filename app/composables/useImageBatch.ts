import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { resolveImageBatchLimits, type ImageBatchStatus } from '@/features/images/batch'
import { exceedsImageLimits } from '@/features/images/limits'
import { measureImage } from '@/features/images/measure'

export interface ImageBatchItem<Result = unknown> {
  /** Generated here, never derived from the file, so nothing about the source travels with it. */
  id: string
  file: File
  /** The picture itself, for its thumbnail and its preview. Released when the item leaves the batch. */
  url: string
  /** The decoded size, once the browser has read it. */
  size?: { width: number, height: number }
  status: ImageBatchStatus
  /** A code from `imageInputErrors` or from the tool's own errors. */
  error?: string
  /** False when trying again cannot help, because the picture itself is refused. */
  retryable: boolean
  result?: Result
}

export type ImageBatchItemPatch<Result> = Partial<Pick<ImageBatchItem<Result>, 'status' | 'error' | 'retryable' | 'result'>>

/**
 * The pictures an image tool is working through, and which one is on screen.
 *
 * It holds the files, their previews and where each one has got to; the tool
 * does the work and reports back through `update`. A picture the browser
 * cannot decode, or one larger than the shared image limits, is settled as
 * failed the moment it is read, so a batch never reports work as possible that
 * cannot start. Everything stays in this tab: the previews are object URLs of
 * the person's own files and are released when they leave the batch.
 */
export function useImageBatch<Result = unknown>(options: { release?: (result: Result) => void } = {}) {
  const items = shallowRef<ImageBatchItem<Result>[]>([])
  const selectedId = ref<string>()
  const limits = ref(resolveImageBatchLimits({}))
  let added = 0
  let mounted = true

  const selected = computed(() => items.value.find(item => item.id === selectedId.value))
  const held = computed(() => ({ count: items.value.length, bytes: items.value.reduce((total, item) => total + item.file.size, 0) }))
  const progress = computed(() => {
    const summary: Record<ImageBatchStatus, number> & { total: number } = { total: items.value.length, pending: 0, running: 0, done: 0, failed: 0 }
    for (const item of items.value) summary[item.status] += 1

    return summary
  })

  function patch(id: string, change: Partial<ImageBatchItem<Result>>) {
    items.value = items.value.map((item) => {
      if (item.id !== id) return item
      if ('result' in change && item.result !== undefined && item.result !== change.result) options.release?.(item.result)

      return { ...item, ...change }
    })
  }

  const waiting = (id: string) => items.value.find(item => item.id === id)?.status === 'pending'

  function release(item: ImageBatchItem<Result>) {
    URL.revokeObjectURL(item.url)
    if (item.result !== undefined) options.release?.(item.result)
  }

  /** Takes files the picker has already admitted; the first of them goes on screen when nothing is. */
  function add(files: readonly File[]) {
    const fresh = files.map((file): ImageBatchItem<Result> => {
      added += 1
      const id = `image-${added}`

      return {
        id,
        file,
        status: 'pending',
        retryable: true,
        // Measuring settles only a picture still waiting: once a tool has started on
        // it, the tool's own engine reads the file and gives the more exact verdict.
        url: measureImage(
          file,
          (size) => {
            if (!mounted) return
            patch(id, exceedsImageLimits(size.width, size.height) && waiting(id)
              ? { size, status: 'failed', error: 'too_large', retryable: false }
              : { size })
          },
          () => { if (mounted && waiting(id)) patch(id, { status: 'failed', error: 'corrupt_image', retryable: false }) },
        ),
      }
    })
    items.value = [...items.value, ...fresh]
    if (!selected.value && fresh[0]) selectedId.value = fresh[0].id

    return fresh
  }

  function update(id: string, change: ImageBatchItemPatch<Result>) {
    patch(id, change)
  }

  function select(id: string) {
    if (items.value.some(item => item.id === id)) selectedId.value = id
  }

  /** The neighbour after it takes the screen, or the one before when it was last. */
  function remove(id: string) {
    const index = items.value.findIndex(item => item.id === id)
    if (index < 0) return
    release(items.value[index]!)
    items.value = items.value.filter(item => item.id !== id)
    if (selectedId.value === id) selectedId.value = (items.value[index] ?? items.value[index - 1])?.id
  }

  function clear() {
    items.value.forEach(release)
    items.value = []
    selectedId.value = undefined
  }

  onMounted(() => {
    limits.value = resolveImageBatchLimits({ deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory })
  })
  onBeforeUnmount(() => {
    mounted = false
    clear()
  })

  return { add, clear, held, items, limits, progress, remove, select, selected, selectedId, update }
}
