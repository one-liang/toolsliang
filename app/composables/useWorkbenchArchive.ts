import { computed, onBeforeUnmount, ref } from 'vue'
import { createArchiveWriter } from '@/features/tools/product-image-workbench/engine'
import { checkWorkbenchArchive } from '@/features/tools/product-image-workbench/archive'
import type { WorkbenchArchiveEntryInput } from '@/features/tools/product-image-workbench/types'

/**
 * Packing the finished outputs into one file, here on the device.
 *
 * It knows nothing about the batch that produced them — only the entries it is
 * handed — so the reasons it can refuse are its own: an empty batch, a set of
 * outputs no single container can hold, and a browser that cannot run the
 * writer at all. §12.11 asks for that last one to be answered before an archive
 * is offered, which is why the engine is asked on mount rather than on click.
 */
export function useWorkbenchArchive(entries: () => WorkbenchArchiveEntryInput[]) {
  const writer = createArchiveWriter()
  const supported = ref(false)
  const building = ref(false)
  const stage = ref('')
  const url = ref('')
  const failure = ref('')
  let mounted = true

  const issue = computed(() => checkWorkbenchArchive({
    count: entries().length,
    bytes: entries().reduce((total, entry) => total + entry.blob.size, 0),
  }))

  function release() {
    if (url.value) URL.revokeObjectURL(url.value)
    url.value = ''
    failure.value = ''
  }

  async function prepare() {
    const capabilities = await writer.prepare()
    if (mounted) supported.value = capabilities.supported
  }

  /** Resolves once the archive exists, or once the reason it does not is recorded. */
  async function build() {
    if (building.value || issue.value || !supported.value) return
    release()
    building.value = true
    const outcome = await writer.run({ entries: entries() }, { onProgress: progress => { stage.value = progress.stage } })
    if (!mounted) return
    building.value = false
    stage.value = ''
    if (outcome.status === 'success') url.value = URL.createObjectURL(outcome.output.blob)
    else if (outcome.status === 'error') failure.value = outcome.error.code
  }

  function cancel() {
    if (!building.value) return
    writer.cancel()
    building.value = false
    stage.value = ''
  }

  onBeforeUnmount(() => {
    mounted = false
    writer.dispose()
    release()
  })

  return { build, building, cancel, failure, issue, prepare, release, stage, supported, url }
}
