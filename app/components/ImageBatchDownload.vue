<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, toRaw, useId, watch } from 'vue'
import { Download, TriangleAlert } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { useImageArchive } from '@/composables/useImageArchive'
import type { ImageArchiveEntryInput } from '@/features/images/archive'
import { imageArchiveErrors } from '@/features/images/messages'
import { formatStoredSize } from '@/features/shell/local-assets/usage'

/**
 * How a batch's finished images leave the tool.
 *
 * One image downloads as itself. Several can still be taken one by one, and
 * all of them at once as a ZIP packed on this device. The names are the
 * caller's — `nameImageOutputs` gives the original's name with a suffix — and
 * the same name is used for the single file and for its entry in the ZIP.
 */
const props = withDefaults(defineProps<{
  /** Finished outputs only, each already named; the names must not repeat. */
  files: readonly ImageArchiveEntryInput[]
  /** What the ZIP is saved as, extension included. */
  archiveName: string
  disabled?: boolean
}>(), { disabled: false })

const { locale } = useAppLocale()
const en = computed(() => locale.value === 'en')
const id = useId()
/**
 * Plain entries, never the reactive proxies a parent may hold: a proxy cannot be
 * handed to the packing worker or turned into a download link.
 */
const entries = computed(() => props.files.map(file => ({ name: file.name, blob: toRaw(file.blob) })))
const archive = useImageArchive(() => entries.value)
const urls = shallowRef<string[]>([])
let held = new Map<Blob, string>()
const prepared = ref(false)

const total = computed(() => formatStoredSize(props.files.reduce((sum, file) => sum + file.blob.size, 0), locale.value))
const sizeOf = (file: ImageArchiveEntryInput) => formatStoredSize(file.blob.size, locale.value)
/** Why the ZIP cannot be offered right now, if it cannot. Checking capability is not a reason. */
const problem = computed(() => {
  if (props.files.length < 2) return ''
  const code = archive.issue.value ?? (archive.failure.value || (prepared.value && !archive.supported.value && !archive.building.value ? 'unsupported_browser' : ''))
  if (!code) return ''

  return (imageArchiveErrors[code as keyof typeof imageArchiveErrors] ?? imageArchiveErrors.failed)[locale.value]
})
const status = computed(() => {
  if (archive.building.value) return en.value ? 'Packing the ZIP on this device…' : '正在這台裝置上打包 ZIP…'
  if (archive.url.value) return en.value ? 'The ZIP is ready and downloading.' : 'ZIP 已打包好，開始下載。'
  return ''
})

const sameFiles = (a: readonly ImageArchiveEntryInput[], b: readonly ImageArchiveEntryInput[]) =>
  a.length === b.length && a.every((file, index) => file.name === b[index]!.name && file.blob === b[index]!.blob)

/**
 * One object URL per output, kept while the same output is offered and
 * released the moment it is not. A packed ZIP only stands while the outputs it
 * holds are exactly the ones on offer.
 */
watch(entries, (files, previous) => {
  if (previous && sameFiles(files, previous)) return
  const next = new Map<Blob, string>()
  for (const file of files) next.set(file.blob, held.get(file.blob) ?? URL.createObjectURL(file.blob))
  for (const [blob, url] of held) if (!next.has(blob)) URL.revokeObjectURL(url)
  held = next
  urls.value = files.map(file => next.get(file.blob)!)
  archive.release()
}, { immediate: true })

/** The writer is only woken once there is a batch to pack, so a single-image tool never starts it. */
watch(() => props.files.length > 1, (several) => {
  if (!several || prepared.value) return
  void archive.prepare().then(() => { prepared.value = true })
}, { immediate: true })

function save(url: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = props.archiveName
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
}

async function downloadAll() {
  if (props.disabled || archive.building.value) return
  if (!archive.url.value) await archive.build()
  if (archive.url.value) save(archive.url.value)
}

onBeforeUnmount(() => {
  for (const url of held.values()) URL.revokeObjectURL(url)
  held.clear()
})
</script>

<template>
  <div v-if="files.length" class="image-batch-download" :aria-busy="archive.building.value">
    <div v-if="files.length === 1" class="image-batch-download__row">
      <Button as-child :aria-disabled="disabled || undefined">
        <a :href="disabled ? undefined : urls[0]" :download="files[0]!.name" data-batch-download>
          <Download :size="18" aria-hidden="true" />{{ en ? 'Download image' : '下載圖片' }}
        </a>
      </Button>
      <p class="image-batch-download__meta">
        <span class="image-batch-download__name">{{ files[0]!.name }}</span><span class="image-batch-download__size">{{ sizeOf(files[0]!) }}</span>
      </p>
    </div>
    <template v-else>
      <div class="image-batch-download__row">
        <Button :disabled="disabled || archive.building.value || Boolean(problem) || !archive.supported.value" data-batch-download-all @click="downloadAll">
          <Download :size="18" aria-hidden="true" />{{ archive.building.value ? (en ? 'Packing…' : '正在打包…') : (en ? 'Download all (ZIP)' : '全部下載（ZIP）') }}
        </Button>
        <Button v-if="archive.building.value" variant="outline" @click="archive.cancel">{{ en ? 'Cancel' : '取消' }}</Button>
        <p :id="`${id}-total`" class="image-batch-download__meta">
          {{ en ? `${files.length} images, ${total} in all` : `${files.length} 張，合計 ${total}` }}
        </p>
      </div>
      <p role="alert" class="image-batch-download__error" :class="{ 'image-batch-download__error--shown': problem }">
        <template v-if="problem"><TriangleAlert :size="16" aria-hidden="true" />{{ problem }}</template>
      </p>
      <p class="sr-only" role="status">{{ status }}</p>
      <details class="image-batch-download__each" :open="Boolean(problem) || undefined">
        <summary>{{ en ? `Download one by one (${files.length})` : `逐張下載（${files.length} 張）` }}</summary>
        <ul>
          <li v-for="(file, index) in files" :key="file.name">
            <span class="image-batch-download__name">{{ file.name }}</span>
            <span class="image-batch-download__size">{{ sizeOf(file) }}</span>
            <Button as-child variant="outline" size="icon" :aria-disabled="disabled || undefined">
              <a :href="disabled ? undefined : urls[index]" :download="file.name" :aria-label="en ? `Download ${file.name}` : `下載 ${file.name}`" data-batch-download>
                <Download :size="18" aria-hidden="true" />
              </a>
            </Button>
          </li>
        </ul>
      </details>
    </template>
  </div>
</template>
