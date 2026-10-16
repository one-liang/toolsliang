<script setup lang="ts">
import { computed, nextTick, ref, useId } from 'vue'
import { ImagePlus, Trash2, TriangleAlert } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { admitImageBatch, type ImageBatchLimits } from '@/features/images/batch'
import { validateImageInput } from '@/features/images/input'
import { imageInputLimits } from '@/features/images/limits'
import { heicMessage, imageBatchLimitsNotice, imageBatchRefusalMessage, imageInputErrors } from '@/features/images/messages'
import { formatStoredSize } from '@/features/shell/local-assets/usage'

/**
 * Where pictures enter an image tool: one or many at a time, chosen or dropped.
 *
 * Empty, it is a drop zone. Once the batch holds a picture it folds into one
 * row of small controls, so the screen belongs to the preview. Every file is
 * checked here against the shared per-file limits and the batch limits before
 * the tool sees it, and each refusal is reported with the file it refused.
 * Pixel limits need the picture decoded, so `useImageBatch` settles those.
 */
const props = withDefaults(defineProps<{
  /** How many pictures the batch already holds. */
  count: number
  /** What those pictures add up to, in bytes. */
  bytes: number
  limits: ImageBatchLimits
  disabled?: boolean
}>(), { disabled: false })

const emit = defineEmits<{ add: [files: File[]], clear: [] }>()

const { locale } = useAppLocale()
const en = computed(() => locale.value === 'en')
const id = useId()
const input = ref<HTMLInputElement>()
const chooseButton = ref<{ $el: HTMLElement }>()
const clearButton = ref<{ $el: HTMLElement }>()
const keepButton = ref<{ $el: HTMLElement }>()
const dragging = ref(false)
const checking = ref(false)
const confirming = ref(false)
const issues = ref<{ code: string, message: string, names: string[] }[]>([])
let depth = 0
let queue = Promise.resolve()

const accept = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp'
const compact = computed(() => props.count > 0)
const limitsNotice = computed(() => imageBatchLimitsNotice(props.limits, locale.value))
/** The per-picture limits in the same units as the batch ones, so one sentence never mixes two. */
const perImage = computed(() => {
  const size = formatStoredSize(imageInputLimits.maxBytes, locale.value)

  return en.value
    ? ` Each image up to ${size} and ${imageInputLimits.maxPixels / 1_000_000} megapixels.`
    : `每張最多 ${size}、${(imageInputLimits.maxPixels / 10_000).toLocaleString('zh-TW')} 萬像素。`
})
const meter = computed(() => en.value
  ? `${props.count} / ${props.limits.maxItems} images · ${formatStoredSize(props.bytes, locale.value)} / ${formatStoredSize(props.limits.maxBytes, locale.value)}`
  : `${props.count}／${props.limits.maxItems} 張 · ${formatStoredSize(props.bytes, locale.value)}／${formatStoredSize(props.limits.maxBytes, locale.value)}`)

/** A long list of refused files names the first few and counts the rest. */
function namesOf(names: string[]) {
  const shown = names.slice(0, 3).join(en.value ? ', ' : '、')
  const rest = names.length - 3
  if (rest <= 0) return shown

  return en.value ? `${shown} and ${rest} more` : `${shown} 等 ${names.length} 張`
}

function focusOf(button: { $el: HTMLElement } | undefined) {
  button?.$el.focus()
}

function open() {
  if (!props.disabled) input.value?.click()
}

/** One code per file the shared limits refuse; read failures count as an unreadable picture. */
async function inspect(file: File) {
  try {
    return await validateImageInput(file) ?? (file.size > imageInputLimits.maxBytes ? 'too_large' : undefined)
  }
  catch { return 'corrupt_image' }
}

/**
 * Selections are taken one after another, after the batch has caught up with
 * the last one, so two quick drops are never both measured against the same
 * count.
 */
function take(files: File[]) {
  queue = queue.then(async () => {
    if (!files.length || props.disabled) return
    checking.value = true
    const refused = new Map<string, { message: string, names: string[] }>()
    const refuse = (code: string, message: string, name: string) => {
      const entry = refused.get(code) ?? { message, names: [] }
      entry.names.push(name)
      refused.set(code, entry)
    }
    const valid: File[] = []
    for (const file of files) {
      const code = await inspect(file)
      if (code) refuse(code, imageInputErrors[code]![locale.value], file.name)
      else valid.push(file)
    }
    await nextTick()
    const admission = admitImageBatch({ count: props.count, bytes: props.bytes }, valid.map(file => ({ bytes: file.size })), props.limits)
    for (const { index, code } of admission.rejected) refuse(code, imageBatchRefusalMessage(code, props.limits, locale.value), valid[index]!.name)
    checking.value = false
    issues.value = [...refused].map(([code, entry]) => ({ code, ...entry }))
    if (admission.accepted.length) emit('add', admission.accepted.map(index => valid[index]!))
  }).catch(() => { checking.value = false })

  return queue
}

function choose(event: Event) {
  const target = event.target as HTMLInputElement
  const files = Array.from(target.files ?? [])
  target.value = ''
  void take(files)
}

const carriesFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files')

function enter(event: DragEvent) {
  if (!carriesFiles(event) || props.disabled) return
  depth += 1
  dragging.value = true
}

function leave() {
  depth = Math.max(0, depth - 1)
  if (!depth) dragging.value = false
}

function drop(event: DragEvent) {
  depth = 0
  dragging.value = false
  if (!props.disabled) void take(Array.from(event.dataTransfer?.files ?? []))
}

async function askToClear() {
  confirming.value = true
  await nextTick()
  focusOf(keepButton.value)
}

async function keep() {
  confirming.value = false
  await nextTick()
  focusOf(clearButton.value)
}

async function clear() {
  confirming.value = false
  issues.value = []
  emit('clear')
  await nextTick()
  focusOf(chooseButton.value)
}

/** For the tool to call when focus has nowhere left to go, such as after the last picture is removed. */
function focus() {
  focusOf(chooseButton.value)
}

defineExpose({ focus, take })
</script>

<template>
  <div class="image-batch-picker" :class="{ 'image-batch-picker--compact': compact }" :aria-busy="checking">
    <div
      class="image-batch-picker__zone"
      :class="{ 'image-batch-picker__zone--confirming': confirming && compact }"
      :data-dragging="dragging || undefined"
      @dragenter.prevent="enter"
      @dragover.prevent
      @dragleave="leave"
      @drop.prevent="drop"
    >
      <input
        :id="`${id}-files`"
        ref="input"
        class="sr-only"
        type="file"
        multiple
        :accept="accept"
        tabindex="-1"
        aria-hidden="true"
        :disabled="disabled"
        data-batch-input
        @change="choose"
      >
      <template v-if="!compact">
        <span class="image-batch-picker__icon" aria-hidden="true"><ImagePlus :size="24" /></span>
        <div class="image-batch-picker__body">
          <p class="image-batch-picker__title">
            {{ dragging ? (en ? 'Drop to add the images' : '放開就會加入圖片') : (en ? 'Choose or drop images' : '選擇或拖放圖片') }}
          </p>
          <p :id="`${id}-help`" class="image-batch-picker__help">
            {{ en ? 'JPEG, PNG or WebP.' : 'JPEG、PNG、WebP。' }}{{ limitsNotice }}{{ perImage }}
          </p>
          <p class="image-batch-picker__help">{{ heicMessage[locale] }}</p>
          <Button ref="chooseButton" class="image-batch-picker__choose" :disabled="disabled" :aria-describedby="`${id}-help`" @click="open">
            <ImagePlus :size="18" aria-hidden="true" />{{ en ? 'Choose images' : '選擇圖片' }}
          </Button>
        </div>
      </template>
      <template v-else>
        <div v-if="!confirming" class="image-batch-picker__bar">
          <Button ref="chooseButton" variant="outline" :disabled="disabled" :aria-describedby="`${id}-meter`" @click="open">
            <ImagePlus :size="18" aria-hidden="true" />{{ en ? 'Add images' : '加入圖片' }}
          </Button>
          <Button ref="clearButton" variant="outline" :disabled="disabled" @click="askToClear">
            <Trash2 :size="18" aria-hidden="true" />{{ en ? 'Clear all' : '全部清除' }}
          </Button>
          <p :id="`${id}-meter`" class="image-batch-picker__meter">
            {{ dragging ? (en ? 'Drop to add the images' : '放開就會加入圖片') : meter }}
          </p>
        </div>
        <div v-else class="image-batch-picker__confirm" role="group" :aria-labelledby="`${id}-confirm`" @keydown.esc="keep">
          <p :id="`${id}-confirm`">
            {{ en ? `Clear all ${count} images? Finished results go with them.` : `清除全部 ${count} 張圖片？處理好的結果也會一起清除。` }}
          </p>
          <Button variant="destructive" @click="clear">{{ en ? 'Clear all' : '確定清除' }}</Button>
          <Button ref="keepButton" variant="outline" @click="keep">{{ en ? 'Keep them' : '取消' }}</Button>
        </div>
      </template>
    </div>
    <div role="alert" class="image-batch-picker__issues" :class="{ 'image-batch-picker__issues--shown': issues.length }">
      <p v-for="issue in issues" :key="issue.code" :data-batch-issue="issue.code">
        <TriangleAlert :size="16" aria-hidden="true" />
        <span><strong class="image-batch-picker__names">{{ namesOf(issue.names) }}</strong>{{ en ? ': ' : '：' }}{{ issue.message }}</span>
      </p>
    </div>
  </div>
</template>
